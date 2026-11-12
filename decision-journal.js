/* MakeMoney V3: local-only weekly memory and differential research packets.
 * Zero remote endpoints and zero model/API calls. Never puts broker account details in Github.
 */
(function(root){
"use strict";
const KEY="makemoney-weekly-journal-v3";
const asNum=x=>Number.isFinite(+x)?+x:null;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const date=()=>new Date().toISOString().slice(0,10);
function isoWeek(d){
 const v=new Date((d||date())+"T12:00:00Z");
 if(Number.isNaN(v.getTime()))return "unknown";
 const day=(v.getUTCDay()+6)%7;
 v.setUTCDate(v.getUTCDate()-day);
 return v.toISOString().slice(0,10);
}
function read(){
 try{
  const j=JSON.parse(localStorage.getItem(KEY)||"{}");
  return {history:Array.isArray(j.history)?j.history.slice(-16):[],reports:Array.isArray(j.reports)?j.reports.slice(-16):[],actions:Array.isArray(j.actions)?j.actions.slice(-100):[]};
 }catch(e){return {history:[],reports:[],actions:[]};}
}
function write(v){
 try{localStorage.setItem(KEY,JSON.stringify({history:v.history.slice(-16),reports:v.reports.slice(-16),actions:v.actions.slice(-100)}));return true;}catch(e){return false;}
}
function capture(state,news,now){
 const tickers=Object.keys(state.snapshot&&state.snapshot.symbols||{});
 const ranked=state.snapshot&&Array.isArray(state.snapshot.ranked)?state.snapshot.ranked:Object.values(state.snapshot&&state.snapshot.symbols||{});
 const by=new Map(ranked.map(x=>[x.symbol,x]));
 const holdings=(state.portfolio||[]).filter(p=>p&&p.symbol&&+p.shares>0).map(p=>{
  const score=by.get(p.symbol),b=state.data&&state.data[p.symbol];
  const price=score&&asNum(score.price)!=null?+score.price:b&&b.length?+b[b.length-1].c:null;
  return {symbol:p.symbol,shares:+p.shares,cost:+p.cost||null,price,score:score&&asNum(score.score),asof:score&&score.asof};
 }).sort((a,b)=>a.symbol.localeCompare(b.symbol));
 const picked=new Set(holdings.map(x=>x.symbol));
 const top=ranked.filter(x=>!picked.has(x.symbol)&&x.className!=="stale"&&x.className!=="defensive"&&!["SPY","VOO","QQQM","SCHD","RSP","IJR","GLD"].includes(x.symbol)).slice(0,12)
  .map(x=>({symbol:x.symbol,score:asNum(x.score),price:asNum(x.price),asof:x.asof,decision:x.decision}));
 const involved=new Set(holdings.map(x=>x.symbol).concat(top.map(x=>x.symbol)));
 const newsTitles={};involved.forEach(t=>{
  const a=news&&news.symbols&&news.symbols[t];
  if(a&&a.length)newsTitles[t]={title:String(a[0].title||"").slice(0,140),published:a[0].published||"",url:a[0].url||""};
 });
 const md=state.snapshot&&state.snapshot.market||{};
 const all=holdings.filter(x=>x.price!=null),knownValue=all.reduce((s,p)=>s+p.shares*p.price,0),cash=Math.max(0,+state.cash||0);
 return {week:isoWeek(now),recordedAt:new Date().toISOString(),asof:state.snapshot&&state.snapshot.asof||null,
  market:{type:md.type||"unknown",label:md.label||"待載入",price:asNum(md.price),asof:md.asof||""},
  holdings,unpriced:holdings.filter(x=>x.price==null).map(x=>x.symbol),
  pricedValue:Math.round((knownValue+cash)*100)/100,cash,
  top,newsTitles,newsUpdated:news&&news.updated_at||null,
  fundamentalUpdated:state.fundamentals&&state.fundamentals.updated_at||null,
  modelPassed:!!(state.model&&state.model.passed_research_gate)};
}
function changes(prev,current){
 const out=[];
 if(!prev)return [{type:"first",level:2,label:"首次建立投資研究快照",reason:"下週開始可以比較差異",symbol:null}];
 if(prev.market&&current.market&&prev.market.type!==current.market.type)
  out.push({type:"market",level:3,label:"大盤風險環境改變",reason:(prev.market.label||"未知")+" → "+(current.market.label||"未知"),symbol:null});
 const pa=new Map((prev.holdings||[]).map(x=>[x.symbol,x]));
 for(const curr of current.holdings||[]){
  const old=pa.get(curr.symbol);
  if(!old){out.push({type:"holding-added",level:3,label:curr.symbol+" 新增持倉",reason:"新的持股需要基本面與風險檢查",symbol:curr.symbol});continue;}
  if(Math.abs(curr.shares-old.shares)>Math.max(1e-7,old.shares*.0001))
   out.push({type:"holding-change",level:3,label:curr.symbol+" 股數改變",reason:old.shares+" → "+curr.shares+" 股",symbol:curr.symbol});
  if(curr.price>0&&old.price>0){
   const move=curr.price/old.price-1;
   if(Math.abs(move)>=.07)out.push({type:"price",level:2,label:curr.symbol+" 價格顯著變化",reason:(move>0?"+":"")+(move*100).toFixed(1)+"%（調整後日線）",symbol:curr.symbol});
  }
  if(curr.score!=null&&old.score!=null&&Math.abs(curr.score-old.score)>=12)
   out.push({type:"score",level:2,label:curr.symbol+" 技術評分變化",reason:old.score+" → "+curr.score, symbol:curr.symbol});
 }
 for(const old of prev.holdings||[])if(!(current.holdings||[]).some(x=>x.symbol===old.symbol))
  out.push({type:"holding-removed",level:3,label:old.symbol+" 已從持倉移除",reason:"請核對是否為實際賣出",symbol:old.symbol});
 const pt=new Map((prev.top||[]).map(x=>[x.symbol,x]));
 for(const item of current.top||[]){
  if(!pt.has(item.symbol)&&item.score>=67)
   out.push({type:"new-candidate",level:1,label:item.symbol+" 新進機會名單",reason:"技術分數 "+item.score+"，仍需估值與財報確認",symbol:item.symbol});
 }
 const touched=new Set(out.filter(x=>x.symbol).map(x=>x.symbol));
 const positions=new Set((current.holdings||[]).map(x=>x.symbol));
 for(const t of positions){
  if(touched.has(t))continue;
  const a=current.newsTitles&&current.newsTitles[t],b=prev.newsTitles&&prev.newsTitles[t];
  if(a&&(!b||a.title!==b.title))
    out.push({type:"news",level:1,label:t+" 出現新的新聞線索",reason:a.title,symbol:t,url:a.url});
 }
 return out.sort((a,b)=>b.level-a.level).slice(0,16);
}
function sync(state,news,now){
 const current=capture(state,news,now),db=read();
 const other=db.history.filter(x=>x.week!==current.week).sort((a,b)=>a.week.localeCompare(b.week));
 const prev=other.length?other[other.length-1]:null;
 // No repeated localStorage writes if the input fingerprint has not changed.
 const existing=db.history.find(x=>x.week===current.week);
 const changed=!existing||JSON.stringify({...existing,recordedAt:null})!==JSON.stringify({...current,recordedAt:null});
 if(changed){
  db.history=other.concat([current]).sort((a,b)=>a.week.localeCompare(b.week)).slice(-16);
  write(db);
 }
 return {current,previous:prev,changes:changes(prev,current),historyCount:db.history.length};
}
function addReport(content,week,mode){
 const value=String(content||"").trim().slice(0,12000);
 if(value.length<15)throw Error("請貼入完整 AI 研究摘要");
 const db=read(),x={id:Date.now().toString(36),week:week||isoWeek(),mode:mode||"weekly",createdAt:new Date().toISOString(),text:value};
 db.reports.push(x);
 if(!write(db))throw Error("儲存失敗，請先匯出備份或釋放空間");
 return x;
}
function addAction(symbol,action,note){
 const t=String(symbol||"").toUpperCase();
 if(!/^[A-Z0-9.^-]{1,12}$/.test(t))throw Error("無效股票代號");
 const db=read();
 const x={id:Date.now().toString(36),week:isoWeek(),symbol:t,action:String(action||"觀察").slice(0,40),
  note:String(note||"").slice(0,600),createdAt:new Date().toISOString()};
 db.actions.push(x);if(!write(db))throw Error("儲存失敗");return x;
}
function minimalPacket(state,news,mode,symbol){
 const current=capture(state,news),db=read(),prev=db.history.filter(x=>x.week<current.week).sort((a,b)=>a.week.localeCompare(b.week)).pop();
 const delta=changes(prev,current);
 const chosen=mode==="symbol"?[symbol]:mode==="discover"?(current.top||[]).slice(0,5).map(x=>x.symbol):
  [...new Set((current.holdings||[]).map(x=>x.symbol).concat(delta.map(x=>x.symbol).filter(Boolean)))].slice(0,16);
 const by=new Map((state.snapshot&&state.snapshot.ranked||[]).map(x=>[x.symbol,x]));
 const facts=state.fundamentals&&state.fundamentals.symbols||{};
 const candidates=chosen.map(t=>{
  const q=by.get(t),f=facts[t]||{},p=current.holdings.find(x=>x.symbol===t),headline=current.newsTitles[t];
  return {symbol:t,position:p?{shares:p.shares,cost:p.cost}:null,
   technical:q?{score:q.score,asof:q.asof,decision:q.decision,vol:q.vol,drawdown:q.dd}:null,
   valuation:{forwardPE:asNum(f.forward_pe),FCFYield:asNum(f.fcf_yield),revenueGrowth:asNum(f.revenue_growth),operatingMargin:asNum(f.operating_margin)},
   latestHeadline:headline||null};
 });
 const recent=db.reports.filter(x=>x.week<=current.week).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,1);
 const payload={week:current.week,market:current.market,priceAsOf:current.asof,newsUpdated:current.newsUpdated,
  fundamentalsUpdated:current.fundamentalUpdated,portfolioIncomplete:current.unpriced,pricedValue:current.pricedValue,cash:current.cash,
  delta:delta.slice(0,8).map(x=>({symbol:x.symbol,type:x.type,label:x.label,reason:x.reason})),
  tickers:candidates,previousResearch:recent.map(x=>({week:x.week,note:x.text.slice(0,650)})),modelValidated:current.modelPassed};
 const instructions=[
 "請擔任美股投資研究委員會，根據現在最新且可核對的消息作【增量分析】。以下是MakeMoney的有限技術快照（不是即時價格）。",
 "我的投資期間3–5年，成長優先，需關注40%最大回撤承受界限、現有持倉及集中度。不要為了產出建議而強制買賣。",
 "重點："+(mode==="symbol"?"深究"+symbol:mode==="discover"?"挑選本週最值得現在研究建倉的股票":"本週持倉變化與下一步操作")+"；先檢查有重大變化者，沒有變化者沿用原論點。",
 "針對真正需要行動的1–3檔，引用最新SEC/法說/財報、估值及反方論證；區分事實、推測、未知。請明確給出：現在可研究買入／加碼／持有／減碼／觀望、投入優先序、理由、失效條件及對組合的影響。",
 "Qlib/LightGBM 只有通過樣本外測試才能作證據，否則不能引用模型推薦。避免被高技術分數誤導。",
 "不要把調整後日線收盤價或二手估值當成即時成交價；如價格或來源未核實，明確標示。",
 "最後輸出短版投資決策摘要，附建議在下週保留的研究結論，方便我貼回MakeMoney，避免下次重做。","資料："+JSON.stringify(payload)
 ];
 return instructions.join("\n");
}
const api={read,write,isoWeek,capture,changes,sync,addReport,addAction,minimalPacket};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.DecisionJournal=api;
})(typeof window!=="undefined"?window:globalThis);
