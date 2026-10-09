const test = require("node:test");
const assert = require("node:assert/strict");
const { encodeBase58 } = require("../.test-build/base58.js");
test("base58 signature preserves leading zeros", () => {
  assert.equal(encodeBase58(Uint8Array.from([0, 0, 1])), "112");
  assert.equal(encodeBase58(Uint8Array.from([0, 0, 0])), "111");
  assert.equal(encodeBase58(Uint8Array.from([57])), "z");
});
