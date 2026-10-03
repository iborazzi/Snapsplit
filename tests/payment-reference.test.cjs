
const test = require("node:test");
const assert = require("node:assert/strict");
const { requestUri, DEVNET_USDC } = require("../.test-build/settlement.js");

test("payment reference identifies a request without changing its amount or mint", () => {
  const address = "11111111111111111111111111111111";
  const reference = "GmdacHzaaGtikNqmJ4crDbdbGyovQ41aJNAnU3sS4F6J";
  const uri = requestUri(address, "USDC", "3.50", "Tom", "devnet", reference);
  const params = new URLSearchParams(uri.split("?")[1]);
  assert.equal(params.get("reference"), reference);
  assert.equal(params.get("amount"), "3.50");
  assert.equal(params.get("spl-token"), DEVNET_USDC);
  const legacy = requestUri(address, "USDC", "3.50", "Tom", "devnet");
  assert.equal(new URLSearchParams(legacy.split("?")[1]).has("reference"), false);
});
