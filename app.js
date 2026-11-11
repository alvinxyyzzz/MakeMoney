/* MakeMoney mobile research app. No network requests to brokers and no server-side holdings. */
(function(){
"use strict";
var Q=window.QuantCore;
var DEFAULTS=["NVDA","GOOGL","MSFT","AAPL","TSLA","TSM","ADBE","NOW","AMZN","META","AMD","CEG","SPY","VOO","QQQM","SCHD","RSP","IJR"];
var STORAGE="makemoney-personal-v1", state={
 tab:"research",symbol:"NVDA",period:"1Y",strategy:"ensemble",cost:10,
 portfolio:[],custom:{},catalog:null,data:{},loading:{},errors:{},asof:null,
 capital:20000,risk:1,allocation:20,cash:0
};
var root=document.getElementById("app"),status=document.getElementById("status");
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(x){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x];});}
function fmt(n,d){return Number.isFinite(n)?Number(n).toLocaleString("en-US",{minimumFractionDigits:d||0,maximumFractionDigits:d||0}):"—";}
function usd(n,d){return Number.isFinite(n)?"$"+fmt(n,d==null?2:d):"—";}
function pct(n,d){return Number.isFinite(n)?(n>=0?"+":"")+fmt(n*100,d==null?1:d)+"%":"—";}
function frac(n,d){return Number.isFinite(n)?fmt(n*100,d==null?1:d)+"%":"—";}
function priceLabel(n){return usd(n,2);}
function todayUTC(){return new Date().toISOString().slice(0,10);}
function safeSymbol(x){return /^[A-Z0-9.^-]{1,12}$/.test(x||"");}
function persist(){
 try{localStorage.setItem(STORAGE,JSON.stringify({symbol:state.symbol,period:state.period,strategy:state.strategy,cost:state.cost,portfolio:state.portfolio,custom:state.custom,capital:state.capital,risk:state.risk,allocation:state.allocation,cash:state.cash}));}
 catch(e){toast("本機儲存空間不足；請先匯出備份或刪除大型匯入資料。",true);}
}
function restore(){try{var x=JSON.parse(localStorage.getItem(STORAGE)||"{}");if(safeSymbol(x.symbol))state.symbol=x.symbol;if(["1Y","3Y","ALL"].includes(x.period))state.period=x.period;if(Q.STRATEGIES[x.strategy])state.strategy=x.strategy;if(Number.isFinite(+x.cost))state.cost=Math.min(200,Math.max(0,+x.cost));if(Array.isArray(x.portfolio))state.portfolio=x.portfolio.filter(function(p){return p&&safeSymbol(p.symbol)&&Number.isFinite(+p.shares)&&+p.shares>0;}).slice(0,100);if(x.custom&&typeof x.custom==="object")state.custom=x.custom;["capital","risk","allocation","cash"].forEach(function(k){if(Number.isFinite(+x[k])&&+x[k]>=0)state[k]=+x[k];});}catch(e){}}
function toast(msg,bad){status.textContent=msg;status.className=bad?"toast bad":"toast";status.hidden=false;clearTimeout(window._toastTimer);window._toastTimer=setTimeout(function(){status.hidden=true;},4500);}
function named(t){var names={NVDA:"NVIDIA",GOOGL:"Alphabet",MSFT:"Microsoft",AAPL:"Apple",TSLA:"Tesla",TSM:"TSMC ADR",ADBE:"Adobe",NOW:"ServiceNow",AMZN:"Amazon",META:"Meta",AMD:"AMD",CEG:"Constellation Energy",SPY:"S&P 500 ETF",VOO:"Vanguard S&P 500",QQQM:"Nasdaq-100 ETF",SCHD:"Dividend ETF",RSP:"S&P 500 Equal Weight",IJR:"Small-Cap ETF"};return names[t]||t;}
function bars(t){return state.data[t]|| (state.custom[t]&&Q.normalizeBars(state.custom[t])) || null;}
function allSymbols(){return Array.from(new Set(DEFAULTS.concat(Object.keys(state.catalog&&state.catalog.symbols||{})).concat(Object.keys(state.custom)).concat(state.portfolio.map(function(p){return p.symbol;}))));}
async function load(t){
 if(!safeSymbol(t))return;
 if(state.custom[t]){state.data[t]=Q.normalizeBars(state.custom[t]);return;}
 if(state.data[t]||state.loading[t])return;
 state.loading[t]=true;state.errors[t]=null;
 try{var r=await fetch("./data/"+encodeURIComponent(t)+".json?v="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error("尚無此股票的資料檔");var j=await r.json(),b=Q.normalizeBars(j);if(b.length<2)throw Error("歷史行情不足");state.data[t]=b;}
 catch(e){state.errors[t]=e.message||"資料讀取失敗";}
 finally{delete state.loading[t];render();}
}
async function init(){
 restore();
 try{var r=await fetch("./data/catalog.json?v="+Date.now(),{cache:"no-store"});if(r.ok)state.catalog=await r.json();}catch(e){}
 render();await Promise.all(Array.from(new Set([state.symbol,"SPY"].concat(state.portfolio.map(function(p){return p.symbol;})))).map(load));
}
function icon(name){
 var path={
 chart:'<path d="M3 17l6-6 4 3 8-9"/><path d="M17 5h4v4"/>',
 layers:'<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 15l3-4 3 2 4-5"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h15v16H6a2 2 0 0 0-2 2z"/><path d="M4 5v16"/>',
 sliders:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 15v5h16v-5"/>',
 download:'<path d="M12 3v13m-5-5 5 5 5-5"/><path d="M4 17v4h16v-4"/>'
 }[name]||'';
 return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
}
function tabs(){
 var links=[["research","研究台","chart"],["backtest","策略回測","layers"],["portfolio","我的持倉","shield"],["method","模型研究","book"]];
 return '<nav class="tabs" aria-label="主選單">'+links.map(function(t){return '<button data-tab="'+t[0]+'" class="'+(state.tab===t[0]?"active":"")+'">'+icon(t[2])+'<span>'+t[1]+'</span></button>';}).join("")+'</nav>';
}
function top(){
 var b=bars(state.symbol),last=b&&b[b.length-1],date=last&&last.d;
 var delay=date?Math.round((new Date(todayUTC()+"T00:00:00Z")-new Date(date+"T00:00:00Z"))/86400000):null;
 return '<div class="topline"><div><div class="eyebrow"><span class="live-dot"></span> PRIVATE QUANT TERMINAL <span class="ver">v1.0 RESEARCH</span></div><h1><span class="brand-mark">M<span>.</span></span> MakeMoney</h1><div class="subtitle">Research first. Trade with evidence.</div></div><div class="asof"><span class="subtle">歷史資料截至</span><b>'+esc(date||"等待行情")+'</b><span class="data-pill '+(delay!=null&&delay>4?"stale":"")+'">'+(delay==null?"未載入":delay>4?"資料可能過期":"日線 / 非即時")+'</span></div></div>';
}
function notice(){return '<div class="notice"><span class="notice-mark">◎</span><span>個人投資研究工具，不是即時交易報價、投資保證或自動下單系統。所有價位均為技術情境估算，請核對券商行情。</span></div>';}
function selector(){
 return '<div class="section-head"><div><div class="eyebrow">01 / ASSET INTELLIGENCE</div><h2>個股研究</h2></div><label class="select-wrap"><span>切換標的</span><select id="symbol-select" aria-label="選擇股票">'+allSymbols().map(function(t){return '<option value="'+esc(t)+'" '+(state.symbol===t?"selected":"")+'>'+esc(t)+' · '+esc(named(t))+'</option>';}).join("")+'</select></label></div>';
}
function welcome(t){
 return '<section class="empty-state"><div class="empty-icon">↗</div><div class="eyebrow">MARKET DATA NEEDED</div><h2>'+esc(t)+' 還沒有可用的歷史資料</h2><p>首次使用請到 GitHub 的 Actions 手動執行「Update market data」；之後將於美股交易日自動更新。也可以直接匯入 Yahoo Finance 格式 CSV。</p><div class="row-actions"><label class="button primary">'+icon("upload")+' 匯入 '+esc(t)+' CSV<input type="file" id="csv-upload" accept=".csv,text/csv" hidden></label><a href="https://github.com/alvinxyyzzz/MakeMoney/actions" target="_blank" rel="noopener" class="button ghost">開啟 GitHub Actions ↗</a></div><div class="smallmuted">狀態：'+esc(state.errors[t]||"尚未找到 data/"+t+".json")+'</div></section>';
}
function singleLineChart(arr,compare,labels,withMA){
 if(!arr||arr.length<2)return '<div class="empty-chart">資料不足，無法畫圖</div>';
 var W=760,H=260,L=14,R=10,T=14,B=34,n=arr.length,values=arr.concat(compare||[]);
 if(withMA)withMA.forEach(function(a){values=values.concat(a.filter(Number.isFinite));});
 values=values.filter(Number.isFinite);if(!values.length)return "";
 var min=Math.min.apply(null,values),max=Math.max.apply(null,values),pad=(max-min)*.09||1;min-=pad;max+=pad;
 function pt(v,i){return (L+i*(W-L-R)/(n-1)).toFixed(2)+","+(T+(max-v)/(max-min)*(H-T-B)).toFixed(2);}
 function line(a){var chunks=[],segment=[];a.forEach(function(v,i){if(Number.isFinite(v))segment.push(pt(v,i));else if(segment.length){chunks.push("M"+segment.join(" L"));segment=[];}});if(segment.length)chunks.push("M"+segment.join(" L"));return chunks.join(" ");}
 var grid="";for(var k=0;k<4;k++){var y=T+k*(H-T-B)/3,price=max-k*(max-min)/3;grid+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" stroke="#20313f" stroke-dasharray="3 6"/><text x="'+L+'" y="'+(y-5)+'" class="axis-label">'+fmt(price,price>200?0:2)+'</text>';}
 var dates=labels||[],ticks=[0,Math.floor((n-1)/2),n-1].map(function(i){return dates[i]?'<text x="'+(L+i*(W-L-R)/(n-1))+'" y="'+(H-6)+'" text-anchor="'+(i===0?"start":i===n-1?"end":"middle")+'" class="axis-label">'+esc(dates[i])+'</text>':"";}).join("");
 var path=line(arr),area=path+' L'+(W-R)+','+(H-B)+' L'+L+','+(H-B)+' Z';
 return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="歷史價格與回測曲線圖"><defs><linearGradient id="linefill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#befb88" stop-opacity=".2"/><stop offset="100%" stop-color="#befb88" stop-opacity="0"/></linearGradient></defs>'+grid+'<path d="'+area+'" fill="url(#linefill)"/><path d="'+path+'" fill="none" stroke="#c0f995" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'+(compare?'<path d="'+line(compare)+'" fill="none" stroke="#e8b178" stroke-width="1.8" stroke-dasharray="6 5"/>':"")+(withMA?withMA.map(function(s,i){return '<path d="'+line(s)+'" fill="none" stroke="'+(i?"#8495ad":"#60a5fa")+'" stroke-width="1.4" opacity=".85"/>';}).join(""):"")+ticks+'</svg>';
}
function subarr(a,start){return a.slice(start);}
function chartPrice(f){
 var len=state.period==="1Y"?252:state.period==="3Y"?756:f.close.length,start=Math.max(0,f.close.length-len);
 return '<div class="card chart-card"><div class="chart-top"><div><div class="eyebrow">ADJUSTED PRICE / USD</div><div class="chart-title">價格走勢 <span class="subtle">· '+esc(state.period)+'</span></div></div><div class="segments">'+["1Y","3Y","ALL"].map(function(t){return '<button data-period="'+t+'" class="'+(state.period===t?"on":"")+'">'+t+'</button>';}).join("")+'</div></div>'+singleLineChart(subarr(f.close,start),null,f.bars.slice(start).map(function(x){return x.d.slice(2);}),[subarr(f.sma50,start),subarr(f.sma200,start)])+'<div class="legend"><span><i class="dot lime"></i>調整後收盤價</span><span><i class="dot blue"></i>SMA 50</span><span><i class="dot silver"></i>SMA 200</span></div></div>';
}
function metric(label,val,tip,color){return '<div class="metric"><span>'+label+'</span><strong class="'+(color||"")+'">'+val+'</strong>'+(tip?'<small>'+tip+'</small>':"")+'</div>';}
function research(){
 var t=state.symbol,b=bars(t);
 var html=selector()+'<div class="ticker-strip">'+DEFAULTS.slice(0,12).map(function(x){return '<button data-symbol="'+x+'" class="'+(t===x?"selected":"")+'">'+x+'</button>';}).join("")+'</div>';
 if(!b||b.length<255)return html+welcome(t)+(b?'<div class="smallmuted">目前僅 '+b.length+' 天，至少需要 255 天分析指標。</div>':"");
 var f=Q.features(b),i=b.length-1,p=b[i].c,prev=b[i-1].c,return1=p/prev-1,lv=Q.levels(f),score=Q.strength(f,i),signal=Q.signals(f,"ensemble")[i];
 var yearly=b.length>252?p/b[b.length-253].c-1:null,low=Math.min.apply(null,b.slice(-252).map(function(x){return x.l;})),high=Math.max.apply(null,b.slice(-252).map(function(x){return x.h;}));
 var regime=bars("SPY")&&bars("SPY").length>=201?(function(){var sp=Q.features(bars("SPY")),z=sp.close.length-1;return sp.close[z]>sp.sma200[z]?"風險偏好較高":"防禦環境";})():"市場資料不足";
 var mode=signal>=1?"偏多研究":signal>=.5?"等待確認":"防禦 / 觀望";
 html+='<div class="hero"><div class="hero-copy"><div class="eyebrow">'+esc(named(t))+' / '+esc(b[i].d)+'</div><div class="price">'+usd(p)+'</div><div class="price-change '+(return1>=0?"positive":"negative")+'">'+(return1>=0?"↗ ":"↘ ")+pct(return1,2)+' <span>上一交易日</span></div></div><div class="signal-summary"><span>多因子狀態</span><strong>'+mode+'</strong><div class="signal-score"><span style="width:'+Math.max(0,(score.score+4)/8*100)+'%"></span></div><small>共識分數 '+score.score+' / +4 · '+regime+'</small></div></div>';
 html+='<div class="metric-grid">'+metric("近 1 年價格變動",pct(yearly),"價格已調整拆股與配息",yearly>=0?"positive":"negative")+metric("20日年化波動",frac(f.vol20[i]),"歷史風險，不是預測")+metric("14日 RSI",fmt(f.rsi14[i],1),f.rsi14[i]>70?"偏熱":f.rsi14[i]<30?"偏冷":"中性區間")+metric("52週波動區間",usd(low,0)+" — "+usd(high,0),"近252交易日")+'</div>';
 html+=chartPrice(f);
 html+='<div class="section-head spaced"><div><div class="eyebrow">02 / EXECUTION MAP</div><h2>買賣情境與價位</h2></div><span class="chip">ATR14 驅動 · 非預測</span></div>';
 if(lv.bullish){
 html+='<div class="level-grid">'+level("等待回踩區間",usd(lv.buy[0])+" – "+usd(lv.buy[1]),"留意支撐與趨勢是否持續","lime")+level("分批加碼觀察",usd(lv.add[0])+" – "+usd(lv.add[1]),"不代表價格一定會到","")+level("技術失效參考",usd(lv.stop),"跌破後重新評估，非保證止損","danger")+level("獲利情境參考",usd(lv.target[0])+" – "+usd(lv.target[1]),"以 ATR 推導，非分析師目標價","")+'</div>';
 }else{
 html+='<div class="card warning-card"><div class="eyebrow">RISK FIRST</div><h3>長期趨勢尚未轉強，不提供機械式抄底買區</h3><p>觀察價格能否重新站上 200 日均線附近 <b>'+usd(lv.recovery)+'</b>，並等待新一輪動能確認。這是規則式情境，不是保證反轉價。</p></div>';
 }
 html+='<div class="section-head spaced"><div><div class="eyebrow">03 / SIGNAL DECOMPOSITION</div><h2>訊號如何形成</h2></div></div><div class="factor-grid">'+score.parts.map(function(k){return '<div class="factor"><div class="factor-badge '+(k.score>0?"pos":k.score<0?"neg":"neu")+'">'+(k.score>0?"+1":k.score<0?"−1":"0")+'</div><div><strong>'+esc(k.name)+'</strong><small>'+esc(k.detail)+'</small></div></div>';}).join("")+'</div>';
 html+='<div class="card risk-panel"><div><div class="eyebrow">04 / POSITION SIZING</div><h2>風險預算計算器</h2><p>按最大可承受損失和持倉上限計算股數，不直接建議你買滿。</p></div><form id="risk-form" class="risk-form"><label>投資資金 (USD)<input type="number" name="capital" min="1" value="'+state.capital+'"></label><label>單筆風險 %<input type="number" name="risk" step=".1" min=".1" max="10" value="'+state.risk+'"></label><label>最大持倉 %<input type="number" name="allocation" step="1" min="1" max="100" value="'+state.allocation+'"></label><button class="button primary" type="submit">重新計算</button></form><div id="risk-result">'+riskOutput(lv)+'</div></div>';
 return html;
}
function level(title,value,desc,cls){return '<div class="level '+(cls||"")+'"><span>'+title+'</span><strong>'+value+'</strong><small>'+desc+'</small></div>';}
function riskOutput(lv){
 if(!lv||!lv.buy||!lv.stop)return '<div class="smallmuted">趨勢未確認，暫不計算進場股數。</div>';
 var entry=(lv.buy[0]+lv.buy[1])/2,r=Q.riskSize(state.capital,state.risk,entry,lv.stop,state.allocation);
 if(!r)return '<div class="smallmuted">請確認入場價高於失效參考價。</div>';
 return '<div class="risk-result"><div><span>情境入場價</span><b>'+usd(entry)+'</b></div><div><span>估算股數上限</span><b>'+fmt(r.shares,0)+' 股</b></div><div><span>投入金額</span><b>'+usd(r.notional)+'</b></div><div><span>觸及失效價的損失</span><b>'+usd(r.maxLoss)+' / '+frac(r.riskPct,2)+'</b></div></div>';
}
function resultMetrics(m,other){
 if(!m)return '<p class="smallmuted">資料不足。</p>';
 return '<div class="back-metrics">'+metric("策略 CAGR",pct(m.cagr),"基準 "+pct(other&&other.cagr),m.cagr>=0?"positive":"negative")+metric("最大回撤",pct(m.maxDrawdown),"基準 "+pct(other&&other.maxDrawdown),"negative")+metric("Sharpe（無風險利率0）",fmt(m.sharpe,2),"基準 "+fmt(other&&other.sharpe,2))+metric("年化波動",frac(m.vol),"基準 "+frac(other&&other.vol))+'</div>';
}
function backtestPage(){
 var t=state.symbol,b=bars(t);
 var html='<div class="section-head"><div><div class="eyebrow">STRATEGY LAB / HISTORICAL</div><h2>策略回測</h2></div></div><div class="card controls"><label>選擇標的<select id="back-symbol">'+allSymbols().map(function(x){return '<option value="'+esc(x)+'" '+(t===x?"selected":"")+'">'+esc(x)+'</option>';}).join("")+'</select></label><label>策略<select id="strategy-select">'+Object.keys(Q.STRATEGIES).map(function(x){return '<option value="'+x+'" '+(state.strategy===x?"selected":"")+'">'+Q.STRATEGIES[x]+'</option>';}).join("")+'</select></label><label>雙邊費率 / 單次換倉 (bps)<input id="cost-input" type="number" value="'+state.cost+'" min="0" max="200" step="1"></label></div>';
 if(!b||b.length<320)return html+welcome(t);
 var res;
 try{res=Q.backtest(b,state.strategy,state.cost);}catch(e){return html+'<div class="card warning-card">'+esc(e.message)+'</div>';}
 html+='<div class="card chart-card"><div class="chart-top"><div><div class="eyebrow">10,000 USD INITIAL CAPITAL / DAILY CLOSE</div><div class="chart-title">'+esc(Q.STRATEGIES[state.strategy])+' <span class="subtle">vs 買入持有</span></div></div><span class="chip">交易成本 '+state.cost+' bps</span></div>'+singleLineChart(res.strategy,res.benchmark,res.dates.map(function(x){return x.slice(2);}))+ '<div class="legend"><span><i class="dot lime"></i>策略</span><span><i class="dot amber"></i>買入持有</span></div></div>';
 html+='<div class="section-head spaced"><div><div class="eyebrow">FULL PERIOD</div><h2>完整回測區間</h2></div><span class="chip">'+esc(res.dates[0])+' → '+esc(res.dates[res.dates.length-1])+'</span></div>'+resultMetrics(res.overall,res.hold);
 html+='<div class="section-head spaced"><div><div class="eyebrow">CHRONOLOGICAL HOLDOUT</div><h2>最近 25% 時間區間</h2></div><span class="chip">起始 '+esc(res.splitDate)+'</span></div>'+resultMetrics(res.test,res.testHold);
 html+='<div class="stat-row"><div><span>持有曝險比例</span><b>'+frac(res.exposure)+'</b></div><div><span>換倉次數</span><b>'+fmt(res.tradeCount)+'</b></div><div><span>累計單向換倉量</span><b>'+fmt(res.turnover,1)+'×</b></div><div><span>執行延遲</span><b>1 個交易日</b></div></div>';
 html+='<div class="card note"><b>怎麼讀這個回測？</b><p>所有模型使用固定參數，指標在當日收盤後計算、下一交易日收盤才視為執行，避免使用尚未出現的價格。成本按照換倉比例計算；未納入真實買賣價差、稅負、融資、借券、滑價、個別除權日差異。此處最後25%是時間切分對照，不是經過完全封存的獨立盲測，歷史好績效不代表未來收益。</p></div>';
 return html;
}
function portfolioPage(){
 var P=state.portfolio,capital=0,value=0,known=0,list=P.map(function(x){
   var b=bars(x.symbol),last=b&&b.length?b[b.length-1]:null,current=last?last.c:NaN,shares=+x.shares,cost=+x.cost,invested=shares*cost,mv=Number.isFinite(current)?shares*current:null;
   capital+=invested;if(mv!=null){value+=mv;known++;}
   return {symbol:x.symbol,shares:shares,cost:cost,price:current,mv:mv,invested:invested,date:last&&last.d};
 });
 var html='<div class="section-head"><div><div class="eyebrow">PRIVATE / DEVICE ONLY</div><h2>我的投資組合</h2></div><button data-action="backup" class="button ghost">'+icon("download")+' 匯出備份</button></div><div class="card note"><b>你的股數與成本只儲存在這個瀏覽器內</b><p>不會自動同步到 GitHub 或傳給伺服器。換 iPhone、清除網站資料或重新安裝 PWA 前，請先匯出 JSON 備份。</p><label class="inline-upload">匯入先前備份 JSON<input id="backup-upload" type="file" accept=".json,application/json" hidden></label></div>';
 html+='<div class="metric-grid">'+metric("已輸入持倉成本",usd(capital,0),P.length+" 個標的")+metric("可估算市值",known?usd(value,0):"—",known+"/"+P.length+" 個有價格")+metric("已定價持倉損益",known?pct((value-list.reduce(function(s,x){return s+(x.mv!=null?x.invested:0);},0))/Math.max(1,list.reduce(function(s,x){return s+(x.mv!=null?x.invested:0);},0))):"—","未計匯率、配息、稅費")+metric("現金（手動設定）",usd(state.cash,0),"不會自動連接券商")+'</div>';
 html+='<div class="card holdings-card"><div class="card-heading"><h3>持倉明細</h3><span class="chip">'+P.length+' 檔</span></div>';
 if(!P.length)html+='<p class="empty-row">尚未新增持倉。填入股票、股數和每股成本即可開始分析。</p>';
 else html+='<div class="holdings">'+list.map(function(x,idx){var pl=x.mv==null?NaN:x.mv/x.invested-1;return '<div class="holding"><div class="ticker-emblem">'+esc(x.symbol.slice(0,2))+'</div><div class="holding-name"><b>'+esc(x.symbol)+'</b><small>'+fmt(x.shares,3)+' 股 · 成本 '+usd(x.cost)+'</small></div><div class="holding-value"><b>'+(x.mv==null?"等待行情":usd(x.mv,0))+'</b><small class="'+(pl>=0?"positive":"negative")+'">'+(Number.isFinite(pl)?pct(pl):"未定價")+'</small></div><button class="remove" data-remove="'+idx+'" aria-label="刪除 '+esc(x.symbol)+'">×</button></div>';}).join("")+'</div>';
 html+='</div><div class="card add-card"><h3>新增持倉</h3><form id="holding-form" class="holding-form"><label>股票代號<input name="symbol" placeholder="例如 NVDA" maxlength="12" required></label><label>股數<input type="number" name="shares" min=".0001" step="any" required placeholder="10"></label><label>平均成本 USD<input type="number" name="cost" min=".001" step="any" required placeholder="100"></label><button type="submit" class="button primary">+ 加入持倉</button></form></div><div class="card add-card"><h3>手動現金餘額</h3><form id="cash-form" class="inline-form"><input type="number" name="cash" min="0" step=".01" value="'+state.cash+'" aria-label="現金餘額"><button class="button ghost" type="submit">儲存</button></form></div>';
 if(known)html+='<div class="section-head spaced"><div><div class="eyebrow">CONCENTRATION WATCH</div><h2>持倉集中度</h2></div></div><div class="card concentration">'+list.filter(function(x){return x.mv!=null;}).sort(function(a,b){return b.mv-a.mv;}).map(function(x){return '<div class="bar-row"><span>'+esc(x.symbol)+'</span><div class="bar-track"><i style="width:'+(x.mv/value*100).toFixed(2)+'%"></i></div><b>'+frac(x.mv/value)+'</b></div>';}).join("")+'</div>';
 return html;
}
function methodPage(){
 var arr=[
 ["01","Microsoft Qlib","Alpha158、LightGBM、多模型實驗框架","研究參考 / 尚未訓練模型","https://github.com/microsoft/qlib"],
 ["02","vectorbt","向量化策略、交易成本與大量實驗比較","方法參考 / 未安裝 Python 套件","https://github.com/polakowo/vectorbt"],
 ["03","QuantConnect LEAN","事件驅動、歷史與即時交易模擬","架構參考 / 未整合交易引擎","https://github.com/QuantConnect/Lean"],
 ["04","PyPortfolioOpt","風險預算、均值變異與資產配置","配置研究參考 / 未執行優化器","https://github.com/PyPortfolio/PyPortfolioOpt"],
 ["05","ML for Trading","時序驗證、過擬合、交易成本、模型治理","研究方法學 / 未部署 ML","https://github.com/stefan-jansen/machine-learning-for-trading"]
 ];
 return '<div class="section-head"><div><div class="eyebrow">RESEARCH STACK / SOURCE AUDIT</div><h2>開源模型與研究框架</h2></div></div><div class="card method-intro"><h3>不追求模型數量，先追求可信度。</h3><p>這個網頁目前只有獨立實作的可解釋規則策略。Qlib、LEAN、vectorbt、PyPortfolioOpt 是已研究的開源基礎，並沒有直接把它們的模型訓練結果或績效「搬進網頁」。這樣才能避免做出漂亮但假的 AI 預測。</p></div><div class="method-list">'+arr.map(function(a){return '<a class="method-item" href="'+a[4]+'" target="_blank" rel="noopener noreferrer"><span class="method-number">'+a[0]+'</span><div><strong>'+a[1]+'</strong><p>'+a[2]+'</p><small>'+a[3]+'</small></div><span>↗</span></a>';}).join("")+'</div><div class="section-head spaced"><div><div class="eyebrow">CURRENT IMPLEMENTATION</div><h2>V1 真正已運作的策略</h2></div></div><div class="card description"><p><b>SMA 趨勢：</b>收盤價在200日均線以上且50日均線高於200日均線才持有。</p><p><b>12-1 動能：</b>比較252個交易日前到21個交易日前的價格，結合大趨勢。</p><p><b>RSI 回歸：</b>長期多頭中 RSI14 跌破35分批進入，超過60或趨勢反轉退出。</p><p><b>突破：</b>站上過去20日高點進入，跌回20日均線或跌破短期低點退出。</p><p><b>波動率目標：</b>在多頭趨勢下將估算曝險控制於目標年化18%波動以下，不槓桿。</p><p><b>多因子共識：</b>綜合長期趨勢、中期排列、動能與RSI。分數≥2偏多，≤−2轉現金，其餘半倉。</p></div><div class="card note"><b>接下來會加入什麼？</b><p>V2：嚴格滾動樣本外驗證、參數穩健性、基準比較與交易成本敏感度。V3：基本面／估值資料、事件與財報研究，再審慎導入 Qlib 的可重現模型實驗。V4：投資組合的相關性與風險權重研究。尚未驗證的能力不會顯示成已完成。</p></div><div class="card source-note"><div class="eyebrow">DATA & LIMITATIONS</div><p>行情：每日由 GitHub Actions 使用 yfinance 下載 Yahoo Finance 的歷史調整後日線（個人研究用途；非授權即時資料）。除 CSV 手動匯入外不需個人 API Key。保證金、稅負、滑價、成交機率、流動性與存活者偏差目前尚未全面處理。請勿直接將歷史回測視為可執行的實盤報酬。</p></div>';
}
function render(){
 if(!root)return;
 root.innerHTML=top()+notice()+tabs()+'<main class="page">'+(state.tab==="research"?research():state.tab==="backtest"?backtestPage():state.tab==="portfolio"?portfolioPage():methodPage())+'</main><footer>MAKEMONEY / PRIVATE RESEARCH BUILD <span>·</span> NO BROKER CONNECTION <span>·</span> NOT FINANCIAL ADVICE</footer>';
}
function selectSymbol(t){if(!safeSymbol(t))return;state.symbol=t;persist();render();load(t);}
function downloadJSON(){
 var body={format:"MakeMoney-backup-v1",exported_at:new Date().toISOString(),portfolio:state.portfolio,custom:state.custom,settings:{symbol:state.symbol,cost:state.cost,capital:state.capital,risk:state.risk,allocation:state.allocation,cash:state.cash}};
 var blob=new Blob([JSON.stringify(body,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="MakeMoney-private-backup-"+todayUTC()+".json";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
 toast("私人備份已開始下載，請妥善保存。");
}
document.addEventListener("click",function(e){
 var t=e.target.closest("[data-tab],[data-symbol],[data-period],[data-remove],[data-action]");if(!t)return;
 if(t.dataset.tab){state.tab=t.dataset.tab;render();window.scrollTo(0,0);}
 if(t.dataset.symbol)selectSymbol(t.dataset.symbol);
 if(t.dataset.period){state.period=t.dataset.period;persist();render();}
 if(t.dataset.action==="backup")downloadJSON();
 if(t.dataset.remove!=null){state.portfolio.splice(Number(t.dataset.remove),1);persist();render();}
});
document.addEventListener("change",async function(e){
 var t=e.target;
 if(t.id==="symbol-select"||t.id==="back-symbol"){selectSymbol(t.value);return;}
 if(t.id==="strategy-select"){state.strategy=t.value;persist();render();return;}
 if(t.id==="cost-input"){state.cost=Math.min(200,Math.max(0,+t.value||0));persist();render();return;}
 if(t.id==="csv-upload"&&t.files&&t.files[0]){
   try{var csv=await t.files[0].text(),b=Q.parseCSV(csv);if(b.length<255)throw Error("只有 "+b.length+" 天；至少 255 天才能產生研究訊號。");state.custom[state.symbol]=b.map(function(x){return [x.d,x.o,x.h,x.l,x.c,x.v];});state.data[state.symbol]=b;persist();render();toast("匯入成功："+b.length+" 個交易日。此資料保留在本機。");}
   catch(err){toast("CSV 匯入失敗："+err.message,true);}
 }
 if(t.id==="backup-upload"&&t.files&&t.files[0]){
   try{var j=JSON.parse(await t.files[0].text());if(j.format!=="MakeMoney-backup-v1"||!Array.isArray(j.portfolio))throw Error("不是有效的 MakeMoney 備份");
     state.portfolio=j.portfolio.filter(function(x){return x&&safeSymbol(x.symbol)&&+x.shares>0&&+x.cost>0;}).slice(0,100);
     state.custom={};Object.keys(j.custom||{}).forEach(function(s){if(safeSymbol(s)){var a=Q.normalizeBars(j.custom[s]);if(a.length>1)state.custom[s]=a.map(function(x){return [x.d,x.o,x.h,x.l,x.c,x.v];});}});
     if(j.settings){["cost","capital","risk","allocation","cash"].forEach(function(k){if(Number.isFinite(+j.settings[k])&&+j.settings[k]>=0)state[k]=+j.settings[k];});}
     state.data={};persist();render();toast("私人備份匯入成功。");await load(state.symbol);}
   catch(err){toast("備份匯入失敗："+err.message,true);}
 }
});
document.addEventListener("submit",function(e){
 var form=e.target;e.preventDefault();
 if(form.id==="holding-form"){
  var d=new FormData(form),sym=String(d.get("symbol")||"").trim().toUpperCase(),shares=+d.get("shares"),cost=+d.get("cost");
  if(!safeSymbol(sym)||!Number.isFinite(shares)||shares<=0||!Number.isFinite(cost)||cost<=0){toast("請輸入有效的美股代號、股數和成本。",true);return;}
  var old=state.portfolio.find(function(x){return x.symbol===sym;});
  if(old){var total=+old.shares+shares;old.cost=(+old.shares*+old.cost+shares*cost)/total;old.shares=total;}
  else state.portfolio.push({symbol:sym,shares:shares,cost:cost});
  persist();render();load(sym);toast("已新增 "+sym+"（本機儲存）。");
 }
 if(form.id==="cash-form"){state.cash=Math.max(0,+new FormData(form).get("cash")||0);persist();render();}
 if(form.id==="risk-form"){
  var d2=new FormData(form);
  state.capital=Math.max(1,+d2.get("capital")||1);state.risk=Math.min(10,Math.max(.1,+d2.get("risk")||1));state.allocation=Math.min(100,Math.max(1,+d2.get("allocation")||20));
  persist();render();
 }
});
init();
})();