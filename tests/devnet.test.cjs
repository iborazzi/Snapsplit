const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestUri, MINTS, DEVNET_USDC } = require('../.test-build/settlement.js');
test('network selection keeps production mints and separates devnet USDC', () => {
  const main = requestUri('recipient', 'USDC', '3.50', 'Ali');
  const dev = requestUri('recipient', 'USDC', '3.50', 'Ali', 'devnet');
  assert.ok(main.includes(MINTS.USDC));
  assert.ok(dev.includes(DEVNET_USDC));
  assert.ok(!dev.includes(MINTS.USDC));
  assert.ok(dev.includes('amount=3.50'));
  assert.ok(dev.includes('label=SnapSplit%20Devnet%20Demo'));
  assert.throws(() => requestUri('recipient', 'SKR', '175.0000', 'Ali', 'devnet'));
});
