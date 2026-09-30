const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allocate, positiveDecimal, settlementAmounts, requestUri, menuUrl, MINTS } = require('../.test-build/settlement.js');
test('all equal split remainders are conserved', () => {
  for (let cents=0;cents<1000;cents++) for(let count=1;count<12;count++) {
    const shares=allocate(cents,count);
    assert.equal(shares.reduce((a,b)=>a+b,0),cents);
    assert.ok(Math.max(...shares)-Math.min(...shares)<=1);
  }
});
test('manual SKR conversion preserves rounded total and explicit rate', () => {
  assert.deepEqual(settlementAmounts([100,200],'SKR','50'),['50.0000','100.0000']);
  assert.deepEqual(settlementAmounts([1,1,1],'SKR','0.3333'),['0.0034','0.0033','0.0033']);
  assert.throws(()=>settlementAmounts([100],'SKR',''));
  for(let i=1;i<100;i++) {
    const shares=allocate(i,7); const amounts=settlementAmounts(shares,'SKR','0.12345');
    assert.equal(amounts.reduce((a,b)=>a+Math.round(Number(b)*10000),0),Math.round(i*0.12345*100));
  }
});
test('USDC amounts do not change and invalid amounts fail', () => {
  assert.deepEqual(settlementAmounts([334,333,333],'USDC',''),['3.34','3.33','3.33']);
  for(const value of ['0','-1','NaN','Infinity','1e3','1,2.3','']) assert.throws(()=>positiveDecimal(value));
  assert.equal(positiveDecimal('2,5'),2.5);
});
test('URI has correct token and encoded message', () => {
  const uri=requestUri('recipient','SKR','50.0000','Ali & Ece');
  assert.ok(uri.includes(`spl-token=${MINTS.SKR}`));
  assert.ok(uri.includes('amount=50.0000'));
  assert.ok(uri.includes('Ali%20%26%20Ece'));
});
test('menu links require HTTPS and reject credentials', () => {
  assert.equal(menuUrl('https://cafe.example/menu'), 'https://cafe.example/menu');
  for (const link of ['javascript:alert(1)','http://cafe.example','solana:address','https://user:password@cafe.example','not a link']) assert.throws(()=>menuUrl(link));
});
