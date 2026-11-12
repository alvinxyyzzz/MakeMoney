#!/usr/bin/env node
/* Build a compact market screener from all existing daily OHLC snapshots.
 * Reuses exactly the browser's original quant engine; zero LLM usage.
 * This is a derived factor cache, not a trained ML predictor.
 */
"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),dir=path.join(root,"data");
require(path.join(root,"engine.js"));const D=require(path.join(root,"decision.js"));
const catalog=JSON.parse(fs.readFileSync(path.join(dir,"catalog.json"),"utf8"));
const data={};for(const ticker of Object.keys(catalog.symbols||{})){
 const filename=path.join(dir,ticker+".json");
 if(!fs.existsSync(filename))continue;
 try{const j=JSON.parse(fs.readFileSync(filename,"utf8"));data[ticker]=j.bars||j;}
 catch(e){process.stderr.write("Invalid JSON for "+ticker+"\n");}
}
const today=new Date().toISOString().slice(0,10),ranked=D.scan(data,data.SPY||[],today);
if(ranked.length<15)throw Error("Not enough symbols to build useful screener: "+ranked.length);
const market=D.market(data.SPY||[]);
function min(x){return x==null||!Number.isFinite(x)?null:Math.round(x*1e5)/1e5;}
const keep=x=>({
 symbol:x.symbol,asof:x.asof,price:min(x.price),age:x.age,score:x.score,
 decision:x.decision,reason:x.reason,className:x.className,relative:min(x.relative),
 trend:x.trend,alignment:x.alignment,momentum:min(x.momentum),r63:min(x.r63),
 r126:min(x.r126),vol:min(x.vol),dd:min(x.dd),rsi:min(x.rsi),
 factors:x.factors.map(p=>({name:p.name,weight:p.weight,points:min(p.points),detail:p.detail})),
 levels:x.levels
});
const result={
 generatedAt:new Date().toISOString(),asof:ranked.map(x=>x.asof).sort().pop(),
 provider:"derived indicators from daily adjusted OHLC / non-live",
 policy:"heuristic technical research only; requires fundamental confirmation",
 symbolCount:ranked.length,market,ranked:ranked.map(keep)
};
fs.writeFileSync(path.join(dir,"weekly-signals.json"),JSON.stringify(result)+"\n");
console.log("built weekly-signals.json",result.symbolCount,"names",fs.statSync(path.join(dir,"weekly-signals.json")).size,"bytes");
