const test = require("node:test");
const assert = require("node:assert/strict");
const { PublicKey } = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  decodeTransferCheckedInstruction
} = require("@solana/spl-token");

const {
  tokenAmountToUnits,
  buildDevnetUsdcInstruction,
  DEVNET_USDC_MINT
} = require("../.test-build/devnet-transfer.js");

const key = (n) => new PublicKey(Uint8Array.from(
  Array(32).fill(n)
));

test("3.50 USDC becomes 3500000 units", () => {
  assert.equal(tokenAmountToUnits("3.50", 6), 3500000n);
});

test("invalid amounts are rejected", () => {
  assert.throws(() => tokenAmountToUnits("0", 6));
  assert.throws(() => tokenAmountToUnits("-1", 6));
  assert.throws(() => tokenAmountToUnits("1.0000001", 6));
  assert.throws(() => tokenAmountToUnits("abc", 6));
});

test("Devnet transfer uses SPL Token and reference", () => {
  const instruction = buildDevnetUsdcInstruction({
    sourceTokenAccount: key(1),
    destinationTokenAccount: key(2),
    owner: key(3),
    recipient: key(4),
    reference: key(5),
    amount: "3.50",
    mintDecimals: 6
  });

  assert.equal(
    instruction.programId.toBase58(),
    TOKEN_PROGRAM_ID.toBase58()
  );

  const decoded = decodeTransferCheckedInstruction(instruction);

  assert.equal(decoded.data.amount, 3500000n);
  assert.equal(decoded.data.decimals, 6);
  assert.equal(
    decoded.keys.mint.pubkey.toBase58(),
    DEVNET_USDC_MINT.toBase58()
  );

  const reference = instruction.keys.find(
    (entry) => entry.pubkey.equals(key(5))
  );

  assert.ok(reference);
  assert.equal(reference.isSigner, false);
  assert.equal(reference.isWritable, false);
});

test("sender cannot equal recipient", () => {
  assert.throws(() => buildDevnetUsdcInstruction({
    sourceTokenAccount: key(1),
    destinationTokenAccount: key(2),
    owner: key(3),
    recipient: key(3),
    reference: key(5),
    amount: "3.50",
    mintDecimals: 6
  }));
});
