const assert=require("node:assert/strict");
const Q=require("../engine.js");global.QuantCore=Q;
const D=require("../decision.js");global.DecisionLab=D;
const B=require("../public-bridge.js");
const now="2026-11-12T12:00:00Z";
const recent="2026-11-10T12:00:00Z";
const feed={symbols:{
 NVDA:[{title:"Hypothetical Nvidia accelerator capacity update",url:"https://example.org/nvda",published:recent,source:"Test News"}],
 GOOGL:[{title:"Hypothetical Google quarterly report",url:"https://example.org/googl",published:recent,source:"Test News"}]
},topics:{
 macro:[{title:"Hypothetical market rates update",url:"https://example.org/rates",published:recent,source:"Test News"}]
}};
const holdings=[{symbol:"GOOGL",shares:10,cost:100},{symbol:"TSM",shares:4,cost:150}];
const bridge=B.gather(holdings,feed,{symbols:{GOOGL:{price:200},TSM:{price:120}}},now);
assert.ok(bridge.some(x=>x.holding==="GOOGL"&&x.kind==="direct"&&x.source==="GOOGL"));
assert.ok(bridge.some(x=>x.holding==="TSM"&&x.kind==="related"&&x.source==="NVDA"));
assert.ok(bridge.every(x=>x.title&&x.url.startsWith("https://")));
assert.ok(bridge.every(x=>x.evidence==="company-name-in-headline"||x.evidence==="topic-source"));
const fromRanked=B.gather(holdings,feed,{ranked:[{symbol:"GOOGL",price:200},{symbol:"TSM",price:120}]},now);
assert.ok(fromRanked.some(x=>x.holding==="GOOGL"&&x.portfolioWeight>.8));
assert.ok(fromRanked.some(x=>x.holding==="TSM"&&x.portfolioWeight<.2));
assert.ok(fromRanked.every(x=>Number.isFinite(x.portfolioWeight)));
const missing=B.gather(holdings,feed,{ranked:[{symbol:"GOOGL",price:200}]},now);
assert.ok(missing.every(x=>x.portfolioWeight===null));
assert.ok(B.mentionsCompany("Nvidia new GPU AI chips","NVDA"));
assert.ok(B.mentionsCompany("Alphabet reports Google cloud demand","GOOGL"));
assert.ok(!B.mentionsCompany("Oracle Stock Surged After CoreWeave Earnings","NVDA"));
const misleadingFeed={symbols:{NVDA:[
 {title:"Oracle Stock Surged After CoreWeave Earnings",url:"https://example.org/misleading",published:recent},
 {title:"Nvidia Exports Rebound",url:"https://example.org/actual",published:recent}
]}};
const checked=B.gather([{symbol:"NVDA",shares:2,cost:120}],misleadingFeed,{ranked:[{symbol:"NVDA",price:200}]},now);
assert.equal(checked.length,1);
assert.ok(checked[0].title.startsWith("Nvidia"));
assert.ok(bridge.length<=8);
assert.equal(B.relation("NVDA","TSM").type,"related");
assert.equal(B.relation("GOOGL","GOOGL").type,"direct");
assert.equal(B.relation("KO","ASML"),null);
assert.equal(B.gather([],feed,{},now).length,0);
assert.equal(B.gather(holdings,{symbols:{GOOGL:[{title:"Stale",url:"https://example.org/a",published:"2024-01-01T12:00:00Z"}]}},{},now).length,0);
console.log("PASS: offline direct, supply-chain hypothesis, public citations, age limit and privacy-safe matching and verified title entities");
