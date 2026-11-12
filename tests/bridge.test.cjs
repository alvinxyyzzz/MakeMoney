const assert=require("node:assert/strict");
const Q=require("../engine.js");global.QuantCore=Q;
const D=require("../decision.js");global.DecisionLab=D;
const B=require("../public-bridge.js");
const now="2026-11-12T12:00:00Z";
const recent="2026-11-10T12:00:00Z";
const feed={symbols:{
 NVDA:[{title:"Hypothetical accelerator capacity update",url:"https://example.org/nvda",published:recent,source:"Test News"}],
 GOOGL:[{title:"Hypothetical Google quarterly report",url:"https://example.org/googl",published:recent,source:"Test News"}]
},topics:{
 macro:[{title:"Hypothetical market rates update",url:"https://example.org/rates",published:recent,source:"Test News"}]
}};
const holdings=[{symbol:"GOOGL",shares:10,cost:100},{symbol:"TSM",shares:4,cost:150}];
const bridge=B.gather(holdings,feed,{symbols:{GOOGL:{price:200},TSM:{price:120}}},now);
assert.ok(bridge.some(x=>x.holding==="GOOGL"&&x.kind==="direct"&&x.source==="GOOGL"));
assert.ok(bridge.some(x=>x.holding==="TSM"&&x.kind==="related"&&x.source==="NVDA"));
assert.ok(bridge.every(x=>x.title&&x.url.startsWith("https://")));
assert.ok(bridge.length<=8);
assert.equal(B.relation("NVDA","TSM").type,"related");
assert.equal(B.relation("GOOGL","GOOGL").type,"direct");
assert.equal(B.relation("KO","ASML"),null);
assert.equal(B.gather([],feed,{},now).length,0);
assert.equal(B.gather(holdings,{symbols:{GOOGL:[{title:"Stale",url:"https://example.org/a",published:"2024-01-01T12:00:00Z"}]}},{},now).length,0);
console.log("PASS: offline direct, supply-chain hypothesis, public citations, age limit and privacy-safe matching");
