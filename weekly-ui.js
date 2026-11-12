/* Weekly home and discovery: minimal interface, factual price screen + linked news.
 * User holdings remain local; AI request copies a private packet to clipboard.
 */
(function(root){
"use strict";
const Q=root.QuantCore,D=root.DecisionLab;
const safe=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const usd=v=>Number.isFinite(v)?"$"+v.toLocaleString("en-US",{maximumFractionDigits:2}):"—";
const pct=v=>Number.isFinite(v)?(v>0?"+":"")+(v*100).toFixed(1)+"%":"—";
const short=v=>Number.isFinite(v)?(v*100).toFixed(0)+"%":"—";
const dateNow=()=>new Date().toISOString().slice(0,10);
const pick=(state,news,symbol)=>((news&&news.symbols&&news.symbols[symbol])||[]).slice(0,4);
const labelClass=cls=>({candidate:"signal-green",defensive:"signal-red",stale:"signal-amber",wait:"signal-neutral"}[cls]||"signal-neutral");
const SECTOR_PRIORITY=["AI 算力","AI 半導體","半導體製造","AI 基礎建設","電力與散熱","電力與核能","大型科技平台","企業軟體","網路安全","必需消費","可選消費","金融","醫療","工業","不動產 REIT","石油能源"];
function report(state){
 const symbols=Object.keys(state.data||{}),data=state.data||{},spy=data.SPY||[],ranked=D.scan(data,spy,dateNow()),env=D.market(spy);
 const positions=state.portfolio||[],portfolio=D.portfolio(positions,data,spy,state.cash);
 return {ranked,env,portfolio};
}
function symbolNews(news,symbol){
 const items=pick(null,news,symbol);
 if(!items.length)return '<p class="smallmuted">暫無已整理的新聞。這不是新聞面利多或利空訊號。</p>';
 return '<div class="news-links">'+items.map(x=>'<a href="'+safe(x.url)+'" target="_blank" rel="noopener noreferrer"><span class="news-time">'+safe((x.published||"").slice(0,10))+'</span><span>'+safe(x.title)+'</span><b>↗</b></a>').join("")+'</div>';
}
function marketBanner(info,news){
 const d=info.env,asof=news&&news.updated_at?news.updated_at.slice(0,10):"尚無週報";
 return '<div class="weekly-market"><div><div class="eyebrow">MARKET PULSE / 本週投資節奏</div><h2>'+safe(d.label)+'</h2><p>SPY 長期趨勢作為市場風險閘門。報價為調整後日線，非盤中價格。</p></div><div class="market-stats"><div><small>SPY 歷史收盤</small><b>'+usd(d.price)+'</b></div><div><small>SPY 200日均線</small><b>'+usd(d.ma200)+'</b></div><div><small>新聞更新</small><b>'+safe(asof)+'</b></div></div></div>';
}
function opportunityCards(items,state,news,limit){
 return '<div class="weekly-cards">'+items.slice(0,limit||6).map((x,i)=>{
 const headline=pick(state,news,x.symbol)[0];
 return '<button class="weekly-tile" data-open-symbol="'+safe(x.symbol)+'"><div class="tile-top"><span class="tile-ticker">'+safe(x.symbol)+'</span><span class="tile-sector">'+safe(D.SECTORS[x.symbol]||"其他")+'</span></div><div class="tile-value">'+usd(x.price)+'</div><div class="tile-bottom"><span class="score-circle">'+x.score+'<small>/100</small></span><span class="'+labelClass(x.className)+'">'+safe(x.decision)+'</span></div><p>'+safe(x.reason)+'</p>'+(headline?'<div class="tile-headline">新聞：'+safe(headline.title)+'</div>':'')+'</button>';
 }).join("")+'</div>';
}
function weekly(state,news){
 const info=report(state),p=info.portfolio,holdingNames=new Set((state.portfolio||[]).map(x=>x.symbol));
 const candidates=info.ranked.filter(x=>!holdingNames.has(x.symbol)&&!["大盤 ETF","股息 ETF","等權 ETF","小盤 ETF"].includes(D.SECTORS[x.symbol]||"")&&x.className!=="stale");
 let html='<section class="weekly-head"><div><div class="eyebrow">YOUR INVESTMENT OPERATING SYSTEM</div><h2>本週決策</h2><p class="subtle">先看持倉，再看大盤，最後才決定是否增加新的標的。</p></div><button data-ai="portfolio" class="button primary">✦ 用 AI 深入分析</button></section>';
 html+=marketBanner(info,news);
 if(p){
   const holdings=(state.portfolio||[]).map(x=>{
    const a=info.ranked.find(r=>r.symbol===x.symbol),data=state.data[x.symbol],last=data&&data.length?data[data.length-1]:null,weight=p.list.find(k=>k.symbol===x.symbol);
    const action=D.actionForHolding(x.symbol,a,weight?weight.weight:0,.20);
    return {symbol:x.symbol,a,action,weight};
   });
   const unknown=holdings.filter(h=>!h.a);
   html+='<div class="section-head spaced"><div><div class="eyebrow">01 / YOUR CAPITAL</div><h2>你的持倉 · 下一步</h2></div><button class="button ghost" data-tab="portfolio">更新持倉 ↗</button></div>';
   html+='<div class="weekly-metrics"><div><small>總資產（已定價 + 現金）</small><strong>'+usd(p.total)+'</strong></div><div><small>最大個股權重</small><strong>'+short(p.concentration)+'</strong></div><div><small>126日模型年化波動</small><strong>'+pct(p.annVol)+'</strong></div></div>';
   html+='<div class="decision-list">'+holdings.map(h=>
    '<button class="decision-item" data-open-symbol="'+safe(h.symbol)+'"><div class="decision-symbol"><b>'+safe(h.symbol)+'</b><small>'+short(h.weight&&h.weight.weight)+'</small></div><div class="decision-explain"><b>'+safe(h.action.label)+'</b><small>'+safe(h.action.why)+'</small></div><span class="decision-arrow">↗</span></button>'
   ).join("")+'</div>';
   if(p.clusters.length)html+='<div class="portfolio-caution">⚠ 有 '+p.clusters.length+' 組持倉在126日內呈現高度同向波動（相關係數 > 0.75）。科技股名稱不同，不代表真正分散。</div>';
   if(unknown.length)html+='<div class="portfolio-caution">有 '+unknown.length+' 個持倉缺少足夠行情，暫不給出價格型建議。</div>';
 }else{
 html+='<div class="empty-state onboarding"><div class="eyebrow">01 / START WITH YOUR HOLDINGS</div><h2>先導入 Firstrade 持倉</h2><p>匯入目前的股票數量與均價，系統才有辦法針對你的真實組合提出動作。所有私人持倉只保存在你的設備。</p><button class="button primary" data-tab="portfolio">匯入持倉 →</button></div>';
 }
 html+='<div class="section-head spaced"><div><div class="eyebrow">02 / CURRENT OPPORTUNITIES</div><h2>本週觀察名單</h2></div><button class="button ghost" data-tab="discover">全部市場機會 ↗</button></div>';
 html+='<p class="smallmuted">多因子技術評分，不是 AI 預測或已確認估值便宜。必須核對財報與消息才能判斷「現在是否值得買」。</p>';
 html+=opportunityCards(candidates,state,news,6);
 html+='<div class="section-head spaced"><div><div class="eyebrow">03 / RESEARCH EVIDENCE</div><h2>新聞與資料品質</h2></div><span class="chip">'+safe(news&&news.updated_at?news.updated_at.slice(0,10):"新聞尚未更新")+'</span></div>';
 html+='<div class="card note"><p>每週 RSS 只整理標題、日期與連結，不自動判斷新聞真假或利多利空。新聞沒列到，也不代表該公司沒有重大消息。請點進原文核對。</p>'+symbolNews(news,holdingNames.values().next().value||state.symbol)+'</div>';
 html+='<div class="card note"><b>要完整 AI 投資委員會分析？</b><p>點「用 AI 深入分析」，會產生包含私人持倉、量化訊號、資料日期及新聞連結的研究指令，由你親自貼到 ChatGPT 使用。這樣不需要將私人持倉或 API Key 傳到 GitHub Pages。</p></div>';
 return html;
}
function discover(state,news){
 const info=report(state);
 const candidates=info.ranked.filter(x=>!["大盤 ETF","股息 ETF","等權 ETF","小盤 ETF"].includes(D.SECTORS[x.symbol]||""));
 const sectors=D.sectorSummary(candidates,D.SECTORS);
 return '<div class="section-head"><div><div class="eyebrow">MARKET RADAR / BROAD UNIVERSE</div><h2>跨板塊機會雷達</h2><p class="subtle">AI、算力、能源、工業、金融、消費、醫療、REIT，不只科技股。</p></div><button class="button ghost" data-ai="discover">✦ AI 跨板塊研究</button></div>'
 +marketBanner(info,news)
 +'<div class="card note"><b>推薦等級如何判斷？</b><p>先篩長期趨勢、動能、相對強弱、波動率與回撤，最後與最新估值、自由現金流、財報與政策新聞交叉驗證。<b>目前自動化雷達僅完成第一層技術篩選</b>；沒有估值資料證據時，不能斷言已是合理建倉價。</p></div>'
 +'<div class="section-head spaced"><div><div class="eyebrow">SECTOR COMPARISON</div><h2>板塊強弱比較</h2></div></div>'
 +'<div class="sector-strips">'+sectors.map(s=>'<div class="sector-strip"><div><b>'+safe(s.sector)+'</b><small>'+s.items.length+' 檔樣本</small></div><div class="sector-bar"><span style="width:'+s.score+'%"></span></div><strong>'+s.score+'</strong></div>').join("")+'</div>'
 +'<div class="section-head spaced"><div><div class="eyebrow">QUANT FILTER</div><h2>候選標的排名</h2></div><span class="chip">'+candidates.length+' 檔已分析</span></div>'
 +opportunityCards(candidates,state,news,candidates.length)
 +'<div class="card note"><b>注意生存者偏差</b><p>監控清單是事前選定的有限標的，不能把排名當作全市場的統計顯著優勢。新聞週報與股價更新時點不同。</p></div>';
}
function detail(state,news,symbol){
 const bars=state.data[symbol],spy=state.data.SPY;
 const x=D.assess(symbol,bars,spy,dateNow());
 if(!x)return '<div class="card note"><b>'+safe(symbol)+' 尚未有足夠行情</b></div>';
 const h=(state.portfolio||[]).find(p=>p.symbol===symbol),v=h?h.shares*x.price:null;
 const action=h?D.actionForHolding(symbol,x,D.portfolio(state.portfolio,state.data,spy,state.cash)?.list.find(z=>z.symbol===symbol)?.weight||0,.20):null;
 let html='<div class="detail-head"><button class="button ghost" data-return="1">← 返回</button><div><div class="eyebrow">'+safe(D.SECTORS[symbol]||"市場觀察")+'</div><h2>'+safe(symbol)+' · 投資決策卡</h2></div><button class="button primary" data-ai-symbol="'+safe(symbol)+'">✦ AI 深入研究</button></div>';
 html+='<div class="hero"><div><div class="eyebrow">調整後收盤 / '+safe(x.asof)+'</div><div class="price">'+usd(x.price)+'</div><p class="'+labelClass(x.className)+'">'+safe(action?action.label:x.decision)+'</p><p class="smallmuted">'+safe(action?action.why:x.reason)+'</p></div><div class="detail-score"><small>多因子評分</small><strong>'+x.score+'<span>/ 100</span></strong><small>非預測成功率</small></div></div>';
 html+='<div class="metric-grid">'+[
  ["相對 SPY 63日",pct(x.relative)],["12−1 動能",pct(x.momentum)],["20日年化波動",pct(x.vol)],["近252日回撤",pct(x.dd)]
 ].map(a=>'<div class="metric"><span>'+a[0]+'</span><strong>'+a[1]+'</strong></div>').join("")+'</div>';
 html+='<div class="section-head spaced"><div><div class="eyebrow">SIGNAL ANATOMY</div><h2>這個結論的依據</h2></div></div><div class="factor-grid">'+x.factors.map(f=>'<div class="factor"><div class="factor-badge '+(f.points>=f.weight*.65?"pos":f.points<=f.weight*.3?"neg":"neu")+'">'+(f.points===null?"—":Math.round(f.points))+'</div><div><strong>'+safe(f.name)+'</strong><small>'+safe(f.detail)+'</small></div></div>').join("")+'</div>';
 html+='<div class="section-head spaced"><div><div class="eyebrow">SCENARIO MAP</div><h2>執行規劃，不是價格預測</h2></div></div>';
 const lv=x.levels;
 if(lv&&lv.bullish){
 html+='<div class="level-grid">'+[
  ["技術回踩觀察",usd(lv.buy[0])+" – "+usd(lv.buy[1])],["加碼觀察",usd(lv.add[0])+" – "+usd(lv.add[1])],["技術失效",usd(lv.stop)],["情境目標",usd(lv.target[0])+" – "+usd(lv.target[1])]
 ].map(a=>'<div class="level"><span>'+a[0]+'</span><strong>'+a[1]+'</strong></div>').join("")+'</div>';
 }else html+='<div class="card warning-card"><h3>未形成多頭趨勢，拒絕給出無根據的「便宜買點」</h3><p>如果趨勢改善，先觀察 '+usd(lv&&lv.recovery)+' 周邊，再看財報、估值與宏觀風險。</p></div>';
 if(h)html+='<div class="card note"><b>你的持倉</b><p>'+h.shares+' 股 · 成本 '+usd(h.cost)+' · 最新調整後價格估算市值 '+usd(v)+' · 未實現價差 '+pct(x.price/h.cost-1)+'</p></div>';
 html+='<div class="section-head spaced"><div><div class="eyebrow">SOURCE REVIEW</div><h2>本週相關報導</h2></div></div><div class="card">'+symbolNews(news,symbol)+'</div>';
 html+='<div class="card note"><b>重要缺口</b><p>目前沒有正式授權的即時成交價、完整分析師預測、最新法說逐字稿或經過驗證的 DCF 估值。AI 深度研究應優先補足這些證據，而不是把 '+x.score+' 分當成公司內在價值。</p></div>';
 return html;
}
function aiPacket(state,news,mode,symbol){
 const r=report(state),positions=(state.portfolio||[]),portfolio=r.portfolio;
 const select=mode==="symbol"?r.ranked.filter(x=>x.symbol===symbol):mode==="discover"?r.ranked.slice(0,25):r.ranked.filter(x=>positions.some(p=>p.symbol===x.symbol)).concat(r.ranked.filter(x=>!positions.some(p=>p.symbol===x.symbol)).slice(0,12));
 const rows=select.map(x=>({
  ticker:x.symbol,sector:D.SECTORS[x.symbol]||"未分類",asof:x.asof,adjusted_close:Number(x.price.toFixed(2)),
  technical_score:x.score,technical_action:x.decision,trend_above_sma200:x.trend,
  momentum_12_1:Number(x.momentum.toFixed(4)),vol_annual:Number(x.vol.toFixed(4)),recent_drawdown:Number(x.dd.toFixed(4)),
  news:pick(state,news,x.symbol).map(n=>({date:n.published,title:n.title,url:n.url}))
 }));
 const personal=positions.map(p=>({ticker:p.symbol,shares:p.shares,avg_cost_usd:p.cost}));
 return [
 "你是嚴謹的美股投資研究委員會（基本面、量化、宏觀、風控與反方）。請使用當前可訪問的最新來源完成研究，不能把下列歷史行情當成今日即時價。",
 "任務："+(mode==="symbol"?"全面研究 "+symbol+" 的持倉/建倉動作":mode==="discover"?"跨 AI、消費、能源、工業、金融、醫療、REIT 等板塊提出值得即刻研究建倉的候選":"結合我的現有 Firstrade 美股組合做每週操作覆盤、加減倉優先級及新增候選"),
 "使用者偏好：3–5年成長導向，可承受約40%最大回撤，但應以更低風險的有效方案為優先；關注既有持倉集中和現金比例，不必強行增加新標的。",
 "請引用可核對的最新公司財報、SEC公告、宏觀、近期新聞、估值（P/E、EV/FCF、FCF Yield、成長）、分析師觀點與反方論證；核實發布日期和實際事件日期。拒絕無法確認的資料，分清事實、推斷與假設。",
 "對每個候選明確給【現在可考慮建倉 / 加碼 / 持有 / 減倉 / 暫不買】，給建議動作、具體理由、可執行但不是必達的價位/比例、反證、風險、組合影響。若資料不足，不得強行買入。",
 "請對 Qlib Alpha158/LightGBM、vectorbt的成本/回測方法、LEAN的執行/滑價框架、PyPortfolioOpt的相關性/權重風控理念做可解釋交叉驗證；本網頁沒有訓練這些模型，禁止宣稱已執行它們。",
 "本機匯出時間："+new Date().toISOString(),
 "歷史市場快照 JSON（只是研究輸入，不可當作即時價）：",
 JSON.stringify({market:r.env,positions:personal,portfolio_summary:portfolio?{total_usd:portfolio.total,cash_usd:state.cash,max_single_weight:portfolio.concentration,annualized_vol_estimate:portfolio.annVol,high_correlation_pairs:portfolio.clusters}:null,
  weekly_news_updated_at:news&&news.updated_at,universe:rows},null,2),
 "輸出格式：①結論摘要 ②持倉逐檔操作矩陣 ③新的機會（含非AI板塊）④每個建倉候選基本面/估值證據與反方 ⑤宏觀情境 ⑥數據時效及來源 ⑦本週具體執行清單。資訊並非券商即時資料，請勿自動下單。"
 ].join("\n\n");
}
const api={weekly,discover,detail,aiPacket,report};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.WeeklyUI=api;
})(typeof window!=="undefined"?window:globalThis);
