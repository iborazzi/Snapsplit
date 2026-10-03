const test = require("node:test");
const assert = require("node:assert/strict");
const { PublicKey } = require("@solana/web3.js");
const {
  matchesPayment,
  decimalUnits
} = require("../.test-build/payment-verification.js");
const { DEVNET_USDC } = require("../.test-build/settlement.js");

const expected = {
  recipient: "GmdacHzaaGtikNqmJ4crDbdbGyovQ41aJNAnU3sS4F6J",
  reference: "GRfPXKYxvZuLNkmKd41xccmaBkACnJbTvz1UzE3oSVi1",
  amount: "3.50",
  token: "USDC",
  network: "devnet"
};

function balance(amount) {
  return {
    accountIndex: 1,
    mint: DEVNET_USDC,
    owner: expected.recipient,
    uiTokenAmount: { amount, decimals: 6 }
  };
}

function transaction() {
  return {
    transaction: {
      message: {
        accountKeys: [{
          pubkey: new PublicKey(expected.reference),
          signer: false,
          writable: false
        }]
      }
    },
    meta: {
      err: null,
      preTokenBalances: [balance("1000000")],
      postTokenBalances: [balance("4500000")]
    }
  };
}

test("exact payment with matching reference, owner and mint is accepted", () => {
  assert.equal(matchesPayment(transaction(), expected), true);
});

test("failed and unavailable transactions are rejected", () => {
  const tx = transaction();
  tx.meta.err = { InstructionError: [0, "Custom"] };
  assert.equal(matchesPayment(tx, expected), false);
  assert.equal(matchesPayment(null, expected), false);
});

test("wrong recipient, mint, reference and amount are rejected", () => {
  for (const change of [
    tx => { tx.meta.postTokenBalances[0].owner = expected.reference; },
    tx => { tx.meta.postTokenBalances[0].mint = expected.reference; },
    tx => { tx.transaction.message.accountKeys = []; },
    tx => { tx.meta.postTokenBalances[0].uiTokenAmount.amount = "4499999"; },
    tx => { tx.meta.postTokenBalances[0].uiTokenAmount.amount = "4500001"; }
  ]) {
    const tx = transaction();
    change(tx);
    assert.equal(matchesPayment(tx, expected), false);
  }
});

test("signer and writable reference accounts are rejected", () => {
  for (const flag of ["signer", "writable"]) {
    const tx = transaction();
    tx.transaction.message.accountKeys[0][flag] = true;
    assert.equal(matchesPayment(tx, expected), false);
  }
});

test("new recipient token account can receive the requested amount", () => {
  const tx = transaction();
  tx.meta.preTokenBalances = [];
  tx.meta.postTokenBalances = [balance("3500000")];
  assert.equal(matchesPayment(tx, expected), true);
});

test("closed recipient accounts are included in the net balance change", () => {
  const tx = transaction();
  tx.meta.preTokenBalances.push({
    ...balance("1000000"), accountIndex: 2
  });
  assert.equal(matchesPayment(tx, expected), false);
});

test("missing balance evidence and devnet SKR are rejected", () => {
  const tx = transaction();
  delete tx.meta.postTokenBalances;
  assert.equal(matchesPayment(tx, expected), false);
  assert.equal(matchesPayment(transaction(), {
    ...expected, token: "SKR"
  }), false);
});

test("decimal conversion is exact and rejects excess precision", () => {
  assert.equal(decimalUnits("3.50", 6), 3500000n);
  assert.equal(decimalUnits("0.000001", 6), 1n);
  assert.throws(() => decimalUnits("0.0000001", 6));
  assert.throws(() => decimalUnits("0", 6));
  assert.throws(() => decimalUnits("-1", 6));
});
