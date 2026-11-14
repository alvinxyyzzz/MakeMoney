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
const COMPANY_NAMES={
 NVDA:["nvidia"],GOOGL:["alphabet","google"],MSFT:["microsoft"],AAPL:["apple"],
 TSLA:["tesla"],TSM:["tsmc","taiwan semiconductor"],ADBE:["adobe"],NOW:["servicenow"],
 AMZN:["amazon"],META:["meta platforms","meta"],AMD:["advanced micro devices","amd"],
 CEG:["constellation energy"],AVGO:["broadcom"],MU:["micron"],ASML:["asml"],
 AMAT:["applied materials"],LRCX:["lam research"],ORCL:["oracle"],CRWV:["coreweave"],
 VRT:["vertiv"],ETN:["eaton"],NEE:["nextera"],COST:["costco"],WMT:["walmart"],
 PG:["procter & gamble","procter and gamble"],KO:["coca-cola","coca cola"],
 MCD:["mcdonald"],JPM:["jpmorgan","jp morgan"],V:["visa"],MA:["mastercard"],
 UNH:["unitedhealth"],LLY:["eli lilly"],JNJ:["johnson & johnson","johnson and johnson"],
 CAT:["caterpillar"],DE:["deere"],GE:["ge aerospace","general electric"],
 O:["realty income"],PLD:["prologis"],AMT:["american tower"],HD:["home depot"],
 DIS:["disney"],XOM:["exxon"],CVX:["chevron"],PANW:["palo alto networks"],
 CRWD:["crowdstrike"],CRM:["salesforce"],GLD:["gold etf"],
 SPY:["s&p 500","s&p500"],VOO:["vanguard s&p"],QQQM:["nasdaq 100","nasdaq-100"],
 SCHD:["schwab us dividend"],RSP:["equal weight s&p"],IJR:["s&p smallcap"]
};
const COMMON_TICKERS=new Set(["NOW","CAT","O","V","MA","GE","DE","HD","PG","KO","DIS","ON","LOW","IT","ALL","C","T"]);
function exactWord(title,part,caseSensitive){
 const source=caseSensitive?String(title||""):String(title||"").toLowerCase();
 const word=caseSensitive?String(part||""):String(part||"").toLowerCase();
 let at=source.indexOf(word);
 while(at>=0){
  const left=at===0||!/[a-z0-9]/i.test(source[at-1]);
  const right=at+word.length===source.length||!/[a-z0-9]/i.test(source[at+word.length]);
  if(left&&right)return true;
  at=source.indexOf(word,at+1);
 }
 return false;
}
function mentionsCompany(title,symbol){
 const names=COMPANY_NAMES[symbol]||[];
 if(names.some(name=>exactWord(title,name,false)))return true;
 return symbol.length>=3&&!COMMON_TICKERS.has(symbol)&&exactWord(title,symbol,true);
}
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
 const holdings=positions.filter(p=>p&&typeof p.symbol==="string"&&Number.isFinite(+p.shares)&&+p.shares>0);
 if(!holdings.length)return [];
 const symbols=new Set(holdings.map(p=>p.symbol));
 const indexed=new Map();
 const ranked=prices&&Array.isArray(prices.ranked)?prices.ranked:[];
 ranked.forEach(x=>indexed.set(x.symbol,x));
 Object.entries(prices&&prices.symbols||{}).forEach(([t,x])=>indexed.set(t,x));
 const valueMap=new Map(),missing=[];
 for(const p of holdings){
  const snap=indexed.get(p.symbol),close=snap&&snap.price;
  if(close!=null&&Number.isFinite(Number(close))&&Number(close)>0)valueMap.set(p.symbol,(+p.shares)*Number(close));
  else missing.push(p.symbol);
 }
 const complete=missing.length===0,total=complete?[...valueMap.values()].reduce((a,b)=>a+b,0):null;
 const weights=new Map([...valueMap].map(([t,v])=>[t,total>0?v/total:null]));
 const items=[],seen=new Set();
 function include(holding,source,kind,reason,raw,headlineType){
  if(!raw||!raw.title||!ALLOWED.test(raw.url||"")||ageDays(raw.published,now)>8)return;
  const key=holding+"|"+String(raw.title).toLowerCase().replace(/[\W_]/g,"").slice(0,120);
  if(seen.has(key))return;
  seen.add(key);
  const weight=weights.get(holding);
  items.push({
   holding,source,kind,reason,headlineType:headlineType||"company",
   title:String(raw.title).slice(0,220),url:raw.url,
   published:raw.published,provider:raw.source||"",
   portfolioWeight:complete&&Number.isFinite(weight)?Math.round(weight*1000)/1000:null,
   evidence:headlineType==="macro"?"topic-source":"company-name-in-headline",
   priority:(kind==="direct"?85:kind==="related"?55:kind==="sector"?42:30)+(complete&&Number.isFinite(weight)?Math.min(15,weight*45):0)
  });
 }
 for(const [source,headlines] of Object.entries(news.symbols||{})){
  if(!Array.isArray(headlines))continue;
  for(const item of headlines.slice(0,5)){
   if(!mentionsCompany(item.title||"",source))continue;
   for(const held of symbols){
    const rel=relation(source,held);if(!rel)continue;
    include(held,source,rel.type,rel.reason,item,"company");
   }
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
const api={gather,relation,ageDays,RELATED,TOPIC_SECTORS,mentionsCompany};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.PublicBridge=api;
})(typeof window!=="undefined"?window:globalThis);
