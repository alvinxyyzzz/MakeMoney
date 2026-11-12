/* Decision Lab: transparent, repeatable ranking and portfolio-risk methods.
 * No claim of trained ML; provides evidence for subsequent AI assessment.
 */
(function(root){
"use strict";
const Q=root.QuantCore;
const isNum=x=>typeof x==="number"&&Number.isFinite(x);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const average=a=>a.reduce((s,x)=>s+x,0)/a.length;
const variance=a=>a.length>1?a.reduce((s,x)=>s+(x-average(a))**2,0)/(a.length-1):NaN;
const ageDays=(date,now)=>Math.max(0,Math.floor((Date.parse(now||new Date().toISOString().slice(0,10))-Date.parse(date))/86400000));
const last=a=>a[a.length-1];
const norm=b=>Q.normalizeBars(b||[]);
function returnMap(series){
  const out={},b=norm(series);
  for(let i=1;i<b.length;i++)out[b[i].d]=b[i].c/b[i-1].c-1;
  return out;
}
function pairedReturns(a,b,window){
  const x=returnMap(a),y=returnMap(b);
  return Object.keys(x).filter(d=>Object.hasOwn(y,d)).sort().slice(-(window||126)).map(d=>[x[d],y[d]]);
}
function corr(a,b,window){
  const pairs=pairedReturns(a,b,window);if(pairs.length<60)return null;
  const x=pairs.map(z=>z[0]),y=pairs.map(z=>z[1]),mx=average(x),my=average(y);
  const denom=Math.sqrt(variance(x)*variance(y));
  return denom>0?pairs.reduce((s,z)=>s+(z[0]-mx)*(z[1]-my),0)/(pairs.length-1)/denom:null;
}
function beta(a,b,window){
  const pairs=pairedReturns(a,b,window);if(pairs.length<60)return null;
  const x=pairs.map(z=>z[0]),y=pairs.map(z=>z[1]),mx=average(x),my=average(y),v=variance(y);
  return v>0?pairs.reduce((s,z)=>s+(z[0]-mx)*(z[1]-my),0)/(pairs.length-1)/v:null;
}
function maxDD(bars,n){
  const b=norm(bars).slice(-(n||252));if(b.length<2)return null;
  let peak=b[0].c,dd=0;
  b.forEach(x=>{peak=Math.max(peak,x.c);dd=Math.min(dd,x.c/peak-1);});
  return dd;
}
function market(spy){
  const b=norm(spy);if(b.length<252)return {type:"unknown",label:"大盤資料不足"};
  const f=Q.features(b),i=b.length-1,p=f.close[i],ma200=f.sma200[i],ma50=f.sma50[i];
  let type="defensive",label="風險防禦";
  if(p>ma200&&ma50>ma200){type="constructive";label="偏多環境";}
  else if(p>ma200){type="transition";label="大盤過渡";}
  return {type,label,asof:b[i].d,ma200,price:p,vol:f.vol20[i],dd:maxDD(b,252)};
}
function assess(symbol,barData,spy,now){
  const b=norm(barData);if(b.length<280)return null;
  const f=Q.features(b),i=b.length-1,p=f.close[i],trend=p>f.sma200[i],alignment=f.sma50[i]>f.sma200[i];
  const sp=norm(spy),j=sp.length-1,same=sp.length>=252&&last(sp).d===last(b).d;
  const r63=p/b[i-63].c-1,r126=p/b[i-126].c-1;
  const relative=same?r63-(sp[j].c/sp[j-63].c-1):null;
  const m=f.mom12_1[i],vol=f.vol20[i],dd=maxDD(b,252),rsi=f.rsi14[i];
  const factors=[
    {name:"長期趨勢",weight:25,points:trend?25:0,detail:"SMA 200"},
    {name:"中期均線",weight:15,points:alignment?15:0,detail:"SMA 50 > SMA 200"},
    {name:"12−1 動能",weight:20,points:clamp((m+.1)/.35,0,1)*20,detail:"剔除近期21交易日"},
    {name:"對 SPY 強度",weight:15,points:isNum(relative)?clamp((relative+.12)/.36,0,1)*15:null,detail:"同日63交易日相對表現"},
    {name:"歷史風險",weight:15,points:clamp((.75-vol)/.5,0,1)*8+clamp((dd+.55)/.45,0,1)*7,detail:"波動率與高點回撤"},
    {name:"RSI 偏離",weight:10,points:clamp(1-Math.abs(rsi-52)/38,0,1)*10,detail:"高低兩端均扣分"}
  ];
  const valid=factors.filter(x=>isNum(x.points));
  const score=Math.round(valid.reduce((s,x)=>s+x.points,0)/valid.reduce((s,x)=>s+x.weight,0)*100);
  const env=market(spy),stale=ageDays(last(b).d,now)>6,lv=Q.levels(f);
  let decision="等待研究",reason="信號仍有分歧，尚未有充分的風險報酬優勢",className="wait";
  if(!trend){decision="防禦 / 暫不買";reason="價格低於200日均線，避免僅因跌深而買入";className="defensive";}
  else if(score>=70&&alignment&&env.type==="constructive"){decision="當前可研究建倉";reason="多因子一致性較高，仍須通過估值與財報核實";className="candidate";}
  else if(score>=55){decision="保持關注";reason="有部分優勢，但缺乏完整確認";className="wait";}
  if(env.type==="defensive"&&className==="candidate"){decision="降低新倉力度";reason="市場處於防禦環境，優先控制組合風險";className="wait";}
  if(stale){decision="資料過期，暫停推薦";reason="日線資料超過6天未更新";className="stale";}
  return {symbol,asof:last(b).d,age:ageDays(last(b).d,now),price:p,score,decision,reason,className,
    factors,relative,r63,r126,trend,alignment,momentum:m,vol,dd,rsi,levels:lv,market:env.label,
    source:"adjusted daily OHLC / transparent deterministic research",valuationVerified:false};
}
function scan(data,spy,now){
 return Object.keys(data||{}).map(t=>assess(t,data[t],spy,now)).filter(Boolean).sort((a,b)=>b.score-a.score||a.symbol.localeCompare(b.symbol));
}
function portfolio(positions,data,spy,cash){
 const list=[];
 (positions||[]).forEach(p=>{
  const b=norm(data&&data[p.symbol]),shares=+p.shares;
  if(!b.length||!isNum(shares)||shares<=0)return;
  const price=last(b).c;
  list.push({symbol:p.symbol,shares,price,value:shares*price,cost:+p.cost||0,bars:b});
 });
 if(!list.length)return null;
 const money=Math.max(0,+cash||0),invested=list.reduce((s,x)=>s+x.value,0),total=invested+money;
 list.forEach(x=>{x.weight=x.value/total;x.beta=spy?beta(x.bars,spy,126):null;});
 const topWeight=Math.max(...list.map(x=>x.weight)),hhi=list.reduce((s,x)=>s+x.weight**2,0);
 const weights=list.map(x=>x.weight);
 const dates=list.map(x=>returnMap(x.bars));
 const allDates=Object.keys(dates[0]).filter(d=>dates.every(m=>Object.hasOwn(m,d))).sort().slice(-126);
 let annVol=null;
 if(allDates.length>=60){
  const daily=allDates.map(d=>dates.reduce((s,m,i)=>s+weights[i]*m[d],0));
  annVol=Math.sqrt(variance(daily)*252);
 }
 const strongest=list.map(a=>({symbol:a.symbol,other:list.filter(b=>b.symbol!==a.symbol).map(b=>({symbol:b.symbol,corr:corr(a.bars,b.bars,126)})).filter(x=>isNum(x.corr)).sort((x,y)=>y.corr-x.corr)[0]})).filter(x=>x.other);
 const clusters=strongest.filter(x=>x.other.corr>.75);
 return {list,total,invested,cash:money,concentration:topWeight,hhi,annVol,clusters,beta:list.reduce((s,x)=>s+(x.beta||0)*x.weight,0),coverage:allDates.length,largest:list.slice().sort((a,b)=>b.weight-a.weight)[0]};
}
function actionForHolding(symbol,assessed,weight,limit){
 if(!assessed)return {label:"缺少資料",kind:"stale",why:"請先更新該股票歷史資料"};
 if(assessed.className==="stale")return {label:"暫不操作",kind:"stale",why:"報價已過期"};
 if(weight>limit)return {label:"檢視減倉",kind:"defensive",why:"組合比重超過 "+Math.round(limit*100)+"% 設定上限"};
 if(!assessed.trend)return {label:"重新評估持有",kind:"defensive",why:"長期趨勢轉弱，核對基本面及投資論點是否受損"};
 if(assessed.score>=70)return {label:"持有 / 研究加碼",kind:"candidate",why:"技術面較強，但仍需檢查估值與最新財報"};
 return {label:"持有觀察",kind:"wait",why:"訊號分歧；避免沒有基本面理由的頻繁交易"};
}
function sectorSummary(ranked,tagged){
 const by={};
 ranked.forEach(x=>{const tag=tagged[x.symbol]||"其他";if(!by[tag])by[tag]=[];by[tag].push(x);});
 return Object.entries(by).map(([sector,items])=>({sector,items,top:items[0],score:Math.round(items.reduce((s,x)=>s+x.score,0)/items.length)}))
 .sort((a,b)=>b.score-a.score);
}
const SECTORS={
 NVDA:"AI 算力",AMD:"AI 算力",AVGO:"AI 算力",MU:"AI 半導體",TSM:"半導體製造",ASML:"半導體設備",AMAT:"半導體設備",LRCX:"半導體設備",
 MSFT:"大型科技平台",GOOGL:"大型科技平台",AMZN:"大型科技平台",META:"大型科技平台",AAPL:"消費科技",
 ORCL:"AI 基礎建設",CRWV:"AI 基礎建設",VRT:"電力與散熱",ETN:"電力與散熱",CEG:"電力與核能",NEE:"電力與能源",
 COST:"必需消費",WMT:"必需消費",PG:"必需消費",KO:"必需消費",MCD:"可選消費",
 JPM:"金融",BRK_B:"金融",V:"金融",MA:"金融",UNH:"醫療",LLY:"醫療",JNJ:"醫療",
 CAT:"工業",DE:"工業",GE:"工業",WM:"公共服務",O:"不動產 REIT",PLD:"不動產 REIT",AMT:"不動產 REIT",
 ADBE:"企業軟體",NOW:"企業軟體",CRM:"企業軟體",PANW:"網路安全",CRWD:"網路安全",
 SPY:"大盤 ETF",VOO:"大盤 ETF",QQQM:"大盤 ETF",SCHD:"股息 ETF",RSP:"等權 ETF",IJR:"小盤 ETF",
 TSLA:"電動車與自動駕駛",HD:"可選消費",DIS:"媒體與消費",XOM:"石油能源",CVX:"石油能源",GLD:"黃金 ETF"
};
const api={assess,scan,market,portfolio,corr,beta,maxDD,actionForHolding,sectorSummary,SECTORS,ageDays};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.DecisionLab=api;
})(typeof window!=="undefined"?window:globalThis);
