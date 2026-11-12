/* Public/private information bridge: joins public news metadata to local ticker positions.
 * Heuristic exposure relationships are hypotheses, NOT verified causality, returns, or sentiment.
 * Nothing in the portfolio is uploaded, searched remotely, or written to public Github.
 */
(function(root){
"use strict";
const D=root.DecisionLab;
const RELATED={
 NVDA:["TSM","MSFT","GOOGL","AMZN","META","VRT","ETN","CEG","MU","AMD"],
 TSM:["NVDA","AMD","AAPL","AVGO","ASML","AMAT"],
 MSFT:["NVDA","GOOGL","AMZN","META","ORCL","NOW"],
 GOOGL:["NVDA","MSFT","META","AMZN"],
 AMZN:["NVDA","MSFT","GOOGL","VRT","ETN"],
 META:["NVDA","GOOGL","MSFT"],
 VRT:["NVDA","MSFT","AMZN","GOOGL","ETN"],
 CEG:["VRT","ETN","NEE","MSFT","AMZN"],
 ETN:["VRT","CEG","AMZN","MSFT"],
 MU:["NVDA","AMD","AVGO"],
 ADBE:["NOW","CRM","MSFT"],
 NOW:["CRM","ADBE","MSFT"],
 JPM:["V","MA"],
 O:["PLD","AMT"],
 PLD:["O","AMT"],
 WMT:["COST","PG","KO"],
 COST:["WMT","PG"]
};
const TOPIC_SECTORS={
 ai:["AI 算力","AI 半導體","半導體製造","半導體設備","AI 基礎建設","電力與散熱","大型科技平台","企業軟體"],
 energy:["電力與核能","電力與能源","電力與散熱","石油能源"],
 consumer:["必需消費","可選消費","消費科技","媒體與消費"],
 realestate:["不動產 REIT"],
 macro:["大盤 ETF","金融","不動產 REIT","小盤 ETF","等權 ETF"]
};
const ALLOWED=/^https:\/\//;
function ageDays(date,now){
 if(!date)return Infinity;
 const x=Date.parse(date),y=Date.parse(now||new Date().toISOString());
 return Number.isFinite(x)&&Number.isFinite(y)?Math.max(0,(y-x)/86400000):Infinity;
}
function relation(subject,held){
 if(subject===held)return {type:"direct",reason:"你的直接持倉"};
 if((RELATED[subject]||[]).includes(held)||(RELATED[held]||[]).includes(subject))
  return {type:"related",reason:"產業鏈／競爭關係的監控假設，非確定性影響"};
 const a=D.SECTORS[subject],b=D.SECTORS[held];
 if(a&&a===b)return {type:"sector",reason:"同板塊事件，可能與估值或預期相關"};
 return null;
}
function gather(positions,news,prices,now){
 if(!Array.isArray(positions)||!positions.length||!news)return [];
 const symbols=new Set(positions.filter(p=>p&&p.symbol).map(p=>p.symbol)),pMap=new Map(positions.map(p=>[p.symbol,p]));
 const valueMap=new Map();
 for(const p of positions){
  const snap=prices&&prices.symbols&&prices.symbols[p.symbol];
  if(snap&&Number.isFinite(+snap.price))valueMap.set(p.symbol,(+p.shares||0)*snap.price);
 }
 const total=[...valueMap.values()].reduce((a,b)=>a+b,0);
 const weights=new Map([...valueMap].map(([t,v])=>[t,total>0?v/total:0]));
 const items=[],seen=new Set();
 function include(holding,source,kind,reason,raw,headlineType){
  if(!raw||!raw.title||!ALLOWED.test(raw.url||"")||ageDays(raw.published,now)>8)return;
  const key=holding+"|"+String(raw.title).toLowerCase();
  if(seen.has(key))return;
  seen.add(key);
  const weight=weights.get(holding)||0;
  items.push({
   holding,source,kind,reason,headlineType:headlineType||"company",
   title:String(raw.title).slice(0,220),url:raw.url,
   published:raw.published,provider:raw.source||"",
   priority:(kind==="direct"?85:kind==="related"?55:kind==="sector"?42:30)+Math.min(15,weight*45)
  });
 }
 for(const [source,headlines] of Object.entries(news.symbols||{})){
  if(!Array.isArray(headlines))continue;
  for(const held of symbols){
   const rel=relation(source,held);if(!rel)continue;
   for(const item of headlines.slice(0,3))include(held,source,rel.type,rel.reason,item,"company");
  }
 }
 for(const [topic,headlines] of Object.entries(news.topics||{})){
  if(!Array.isArray(headlines))continue;
  for(const held of symbols){
   const sector=D.SECTORS[held]||"";
   if(!(TOPIC_SECTORS[topic]||[]).includes(sector))continue;
   for(const item of headlines.slice(0,2))include(held,topic,"macro","與持倉所屬產業相關的宏觀主題，需閱讀原始資料",item,"macro");
  }
 }
 const uniqueByHolding={};
 for(const item of items.sort((a,b)=>b.priority-a.priority||String(b.published).localeCompare(a.published))){
  if(!uniqueByHolding[item.holding])uniqueByHolding[item.holding]=[];
  if(uniqueByHolding[item.holding].length<2)uniqueByHolding[item.holding].push(item);
 }
 return Object.values(uniqueByHolding).flat().sort((a,b)=>b.priority-a.priority||String(b.published).localeCompare(a.published)).slice(0,8);
}
const api={gather,relation,ageDays,RELATED,TOPIC_SECTORS};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.PublicBridge=api;
})(typeof window!=="undefined"?window:globalThis);
