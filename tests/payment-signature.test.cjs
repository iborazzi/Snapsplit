
const test = require("node:test");
const assert = require("node:assert/strict");
const { PublicKey } = require("@solana/web3.js");
const { matchesPayment, matchesRecordedTransfer } =
  require("../.test-build/payment-verification.js");
const { DEVNET_USDC } = require("../.test-build/settlement.js");

const expected = {
  recipient: "GmdacHzaaGtikNqmJ4crDbdbGyovQ41aJNAnU3sS4F6J",
  reference: "Cwvf2BTokWu1As2oR6oRc3Lqdq8M6kSRSxPXu2n4j8UQ",
  amount: "3.00", token: "USDC", network: "devnet"
};
const destination = "61rzJsytNNVfHpFaJRdaBM2TiSwNNyRVqZFvbAkTAyf7";
const program = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

function tx() {
  const balance = amount => ({
    accountIndex: 0, owner: expected.recipient, mint: DEVNET_USDC,
    uiTokenAmount: { amount, decimals: 6 }
  });
  return {
    transaction: { message: {
      accountKeys: [{
        pubkey: new PublicKey(destination), signer: false, writable: true
      }],
      instructions: [{
        programId: new PublicKey(program),
        parsed: { type: "transferChecked", info: {
          destination, mint: DEVNET_USDC,
          tokenAmount: { amount: "3000000", decimals: 6 }
        }}
      }]
    }},
    meta: {
      err: null, innerInstructions: [],
      preTokenBalances: [balance("52000000")],
      postTokenBalances: [balance("55000000")]
    }
  };
}

test("signature path verifies a transfer without claiming a matching reference", () => {
  assert.equal(matchesPayment(tx(), expected), false);
  assert.equal(matchesRecordedTransfer(tx(), expected), true);
});

test("signature path rejects wrong transfer details and failed transactions", () => {
  for (const change of [
    value => { value.meta.err = { InstructionError: [0, "Custom"] }; },
    value => { value.meta.postTokenBalances[0].owner = destination; },
    value => { value.meta.postTokenBalances[0].uiTokenAmount.amount = "55000001"; },
    value => { value.transaction.message.instructions = []; },
    value => { value.transaction.message.instructions[0].parsed.info.destination = program; },
    value => { value.transaction.message.instructions[0].parsed.info.mint = program; },
    value => { value.transaction.message.instructions[0].parsed.info.tokenAmount.amount = "2999999"; },
    value => { value.transaction.message.instructions[0].programId = new PublicKey(destination); }
  ]) {
    const value = tx();
    change(value);
    assert.equal(matchesRecordedTransfer(value, expected), false);
  }
  assert.equal(matchesRecordedTransfer(null, expected), false);
  assert.equal(matchesRecordedTransfer(tx(), { ...expected, token: "SKR" }), false);
});
