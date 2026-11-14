const assert=require("node:assert/strict");
const mem=new Map();
global.localStorage={getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)};
const Q=require("../engine.js");global.QuantCore=Q;
const D=require("../decision.js");global.DecisionLab=D;
const J=require("../decision-journal.js");
function demo(week,stockScore,price,shares=5){
 return {week,asof:"2026-11-10",market:{type:"constructive",label:"偏多"},
 holdings:[{symbol:"GOOGL",shares,cost:120,price,score:stockScore}],
 top:[{symbol:"NVDA",score:75,price:150}],newsTitles:{},cash:200,unpriced:[],pricedValue:price*shares+200};
}
assert.equal(J.isoWeek("2026-11-12"),"2026-11-09");
assert.equal(J.isoWeek("2026-11-08"),"2026-11-02");
const d=J.changes(demo("2026-11-02",60,100),demo("2026-11-09",80,110,8));
assert.ok(d.some(x=>x.type==="holding-change"));
assert.ok(d.some(x=>x.type==="score"));
assert.ok(d.some(x=>x.type==="price"));
assert.ok(d.every(x=>x.symbol==="GOOGL"));
const bar=(n=320)=>Array.from({length:n},(_,i)=>["2025-"+String(Math.floor(i/28)%12+1).padStart(2,"0")+"-"+String(i%28+1).padStart(2,"0"),101,103,100,100+i*.2,1e6]);
const snapshot={asof:"2026-11-10",market:{type:"constructive",label:"偏多"},ranked:[{symbol:"GOOGL",score:80,price:200,asof:"2026-11-10",className:"candidate",vol:.2,dd:-.1,decision:"研究建倉"},{symbol:"NVDA",score:77,price:150,asof:"2026-11-10",className:"candidate",decision:"研究建倉"}]};
const state={snapshot,portfolio:[{symbol:"GOOGL",shares:3,cost:150}],cash:2000,data:{},fundamentals:{symbols:{GOOGL:{forward_pe:20,fcf_yield:.03,revenue_growth:.1,operating_margin:.25}}},model:{passed_research_gate:false}};
const first=J.sync(state,{symbols:{}},"2026-11-12");
assert.equal(first.historyCount,1);
assert.equal(first.current.holdings[0].price,200);
assert.equal(first.changes[0].type,"first");
assert.equal(J.sync(state,{symbols:{}},"2026-11-13").historyCount,1);
assert.equal(J.read().history.length,1);
const r=J.addReport("GOOGL 減少估值溢價，需要觀察下一季 EPS 成長後再加碼。","2026-11-09");
assert.ok(r.id);
const a=J.addAction("GOOGL","持有","按照當週研究紀錄");
assert.ok(a.createdAt);
const brief=J.minimalPacket(state,{symbols:{}},"weekly");
assert.ok(brief.includes("GOOGL"));
assert.ok(brief.includes("shares"));
assert.ok(brief.includes("未通過")||brief.includes("通過樣本外測試"));
assert.ok(brief.length<7500,"limit request token budget");
const missingSnapshot={asof:"2026-11-12",market:{type:"unknown",price:null},
 ranked:[{symbol:"MISSING",price:null,score:null,asof:"2026-11-12",className:"wait"}]};
const missingState={snapshot:missingSnapshot,data:{},cash:500,
 portfolio:[{symbol:"MISSING",shares:3,cost:100}],fundamentals:{symbols:{}},model:null};
const invalid=J.capture(missingState,{symbols:{}},"2026-11-13");
assert.equal(invalid.holdings[0].price,null);
assert.equal(invalid.holdings[0].score,null);
assert.equal(invalid.market.price,null);
assert.deepEqual(invalid.unpriced,["MISSING"]);
assert.equal(invalid.pricedValue,500);
assert.equal(invalid.portfolioComplete,false);
const missingBrief=J.minimalPacket(missingState,{symbols:{}},"weekly");
assert.ok(missingBrief.includes('"totalEstimatedAssets":null'));
assert.ok(missingBrief.includes('"unpricedHoldings":["MISSING"]'));
assert.ok(!missingBrief.includes('"totalEstimatedAssets":500'));
console.log("PASS: weekly delta, local journal, reports, decisions and compact brief ("+brief.length+" characters)");
