/* Node regression checks: node tests/engine.test.cjs */
const assert=require("node:assert/strict");
const Q=require("../engine.js");
function sample(count,trend=0.0005){
  const start=Date.UTC(2021,0,1);
  return Array.from({length:count},(_,i)=>{
    const date=new Date(start+i*86400000).toISOString().slice(0,10);
    const close=100*Math.exp(trend*i+Math.sin(i/17)*0.02);
    return [date,close*0.999,close*1.015,close*0.985,close,10000+i];
  });
}
const rows=sample(760),bars=Q.normalizeBars(rows);
assert.equal(bars.length,760);
const f=Q.features(rows);
assert.equal(f.close.length,760);
assert.ok(Number.isNaN(f.sma200[198]));
assert.ok(Number.isFinite(f.sma200[199]));
assert.ok(Number.isFinite(f.rsi14[14]));
assert.ok(Number.isFinite(f.atr14[13]));
assert.ok(Number.isFinite(f.mom12_1[252]));
assert.ok(f.vol20[25]>0);
for(const id of Object.keys(Q.STRATEGIES)){
  const b=Q.backtest(rows,id,10);
  assert.equal(b.dates.length,760-254,id);
  assert.ok(b.strategy.every(x=>Number.isFinite(x)&&x>0),id);
  assert.ok(b.overall&&b.test&&b.hold&&b.testHold,id);
  assert.equal(b.test.days,b.dates.length-Math.floor(b.dates.length*0.75),id);
}
const expensive=Q.backtest(rows,"trend",100);
const free=Q.backtest(rows,"trend",0);
assert.ok(expensive.strategy.at(-1)<=free.strategy.at(-1)+0.00001,"fee sensitivity");
const modified=sample(760);
modified[759][4]*=3;
const signalBefore=Q.signals(Q.features(rows),"ensemble");
const signalAfter=Q.signals(Q.features(modified),"ensemble");
assert.deepEqual(signalBefore.slice(0,-1),signalAfter.slice(0,-1),"no future price in historical signals");
const size=Q.riskSize(20000,1,100,90,20);
assert.equal(size.shares,20);
assert.equal(size.maxLoss,200);
assert.equal(Q.riskSize(20000,1,90,100,20),null);
const csv=Q.parseCSV("Date,Open,High,Low,Close,Adj Close,Volume\n2024-01-02,90,110,80,100,50,1000\n2024-01-03,100,120,90,110,55,1200\n");
assert.equal(csv.length,2);
assert.equal(csv[0].c,50);
assert.equal(csv[0].o,45);
assert.equal(csv[0].v,1000);
assert.throws(()=>Q.backtest(sample(300),"trend",10),/320/);
console.log("PASS: bars, adjusted CSV, indicators, seven strategies, cost sensitivity, no lookahead, risk size");
