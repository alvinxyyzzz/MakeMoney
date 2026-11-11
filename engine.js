/* MakeMoney QuantCore v1 — deterministic, educational research engine.
 * Uses adjusted daily OHLC. Signals at close t-2, positions for close(t-1)->close(t).
 * No ML predictions or brokerage integration are implied.
 */
(function (root) {
  "use strict";
  var STRATEGIES = {
    ensemble: "多因子共識",
    trend: "SMA 趨勢",
    momentum: "12-1 動能",
    meanrev: "順勢 RSI 回歸",
    breakout: "20日突破",
    volatility: "波動率目標",
    buyhold: "買入持有"
  };
  function n(x) { return Number(x); }
  function isNum(x) { return typeof x === "number" && Number.isFinite(x); }
  function round(x, digits) { return isNum(x) ? Number(x.toFixed(digits == null ? 2 : digits)) : null; }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function normalizeBars(raw) {
    var rows = Array.isArray(raw) ? raw : (raw && raw.bars) || [];
    var seen = {};
    rows.forEach(function (r) {
      var a = Array.isArray(r);
      var d = String(a ? r[0] : (r.d || r.date || "")).slice(0, 10);
      var c = n(a ? r[4] : (r.c != null ? r.c : r.close));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !isNum(c) || c <= 0) return;
      var o = n(a ? r[1] : r.o), h = n(a ? r[2] : r.h), l = n(a ? r[3] : r.l), v = n(a ? r[5] : r.v);
      if (!isNum(o) || o <= 0) o = c;
      if (!isNum(h) || h <= 0) h = Math.max(o, c);
      if (!isNum(l) || l <= 0) l = Math.min(o, c);
      seen[d] = { d:d, o:o, h:Math.max(h, l, o, c), l:Math.min(h, l, o, c), c:c, v:isNum(v) && v >= 0 ? v : 0 };
    });
    return Object.keys(seen).sort().map(function (d) { return seen[d]; });
  }
  function mean(a) { return a.length ? a.reduce(function (s,x) { return s+x; },0)/a.length : NaN; }
  function stdev(a) {
    if (a.length < 2) return NaN;
    var m=mean(a);
    return Math.sqrt(a.reduce(function (s,x) { return s+(x-m)*(x-m); },0)/(a.length-1));
  }
  function features(bars) {
    var rows = normalizeBars(bars), N=rows.length, close=rows.map(function (r) {return r.c;});
    var f={ bars:rows, close:close, sma20:[],sma50:[],sma200:[],rsi14:[],atr14:[],vol20:[],mom12_1:[],high20:[],low10:[] };
    var sums=[0], sq=[0], gains=0,losses=0,atr=0,avgGain=0,avgLoss=0,ret=[];
    for(var i=0;i<N;i++) {
      var p=close[i],prev=i?close[i-1]:p,chg=i?p-prev:0;
      sums.push(sums[i]+p);sq.push(sq[i]+p*p);
      [20,50,200].forEach(function(w) { f["sma"+w][i]=i+1>=w?(sums[i+1]-sums[i+1-w])/w:NaN; });
      f.high20[i]=i>=20?Math.max.apply(null,rows.slice(i-20,i).map(function(r){return r.h;})):NaN;
      f.low10[i]=i>=10?Math.min.apply(null,rows.slice(i-10,i).map(function(r){return r.l;})):NaN;
      f.mom12_1[i]=i>=252?close[i-21]/close[i-252]-1:NaN;
      var tr=Math.max(rows[i].h-rows[i].l,Math.abs(rows[i].h-prev),Math.abs(rows[i].l-prev));
      if (i<14) atr+=tr;
      if (i===13) atr/=14;
      else if(i>13) atr=(atr*13+tr)/14;
      f.atr14[i]=i>=13?atr:NaN;
      if(i>0) {
        var g=Math.max(chg,0),l=Math.max(-chg,0);
        if(i<=14) { gains+=g;losses+=l; if(i===14){avgGain=gains/14;avgLoss=losses/14;} }
        else {avgGain=(avgGain*13+g)/14;avgLoss=(avgLoss*13+l)/14;}
      }
      f.rsi14[i]=i<14?NaN:(avgLoss===0?(avgGain===0?50:100):100-100/(1+avgGain/avgLoss));
      if(i>0)ret.push(Math.log(p/prev));
      f.vol20[i]=ret.length>=20?stdev(ret.slice(-20))*Math.sqrt(252):NaN;
    }
    return f;
  }
  function strength(f,i) {
    if(i<252) return {score:0,parts:[]};
    var p=f.close[i],parts=[];
    parts.push({name:"長期趨勢",score:p>f.sma200[i]?1:-1,detail:"價格 vs SMA200"});
    parts.push({name:"中期排列",score:f.sma50[i]>f.sma200[i]?1:-1,detail:"SMA50 vs SMA200"});
    parts.push({name:"12-1 動能",score:f.mom12_1[i]>0?1:-1,detail:"跳過最近21個交易日"});
    var r=f.rsi14[i],s=r<35?1:(r>75?-1:0);
    parts.push({name:"RSI",score:s,detail:"RSI14 = "+round(r,1)});
    var total=parts.reduce(function(x,p){return x+p.score;},0);
    return {score:total,parts:parts};
  }
  function signals(f,id) {
    id=STRATEGIES[id]?id:"ensemble";
    var result=[],holding=0;
    for (var i=0;i<f.close.length;i++) {
      if(i<252) {result.push(0);continue;}
      var p=f.close[i],up=p>f.sma200[i],s=0,r=f.rsi14[i];
      if(id==="buyhold") s=1;
      if(id==="trend") s=up && f.sma50[i]>f.sma200[i]?1:0;
      if(id==="momentum") s=up && f.mom12_1[i]>0?1:0;
      if(id==="meanrev") {
        if(!up || r>60)holding=0;
        else if(r<35)holding=1;
        s=holding;
      }
      if(id==="breakout") {
        if(p<f.sma20[i] || (isNum(f.low10[i]) && p<f.low10[i]))holding=0;
        else if(isNum(f.high20[i]) && p>f.high20[i])holding=1;
        s=holding;
      }
      if(id==="volatility") s=up&&f.sma50[i]>f.sma200[i]&&isNum(f.vol20[i])?clamp(0.18/Math.max(f.vol20[i],0.01),0,1):0;
      if(id==="ensemble") { var q=strength(f,i).score;s=!up?0:(q>=2?1:(q<=-2?0:0.5)); }
      result.push(s);
    }
    return result;
  }
  function stats(curve) {
    if(!curve || curve.length<3) return null;
    var start=curve[0],end=curve[curve.length-1],a=[],peak=start,mdd=0;
    for(var i=1;i<curve.length;i++){a.push(curve[i]/curve[i-1]-1);peak=Math.max(peak,curve[i]);mdd=Math.min(mdd,curve[i]/peak-1);}
    var years=a.length/252;
    return { total:end/start-1,cagr:Math.pow(end/start,1/years)-1,vol:stdev(a)*Math.sqrt(252),sharpe:stdev(a)>0?mean(a)/stdev(a)*Math.sqrt(252):null,maxDrawdown:mdd,positiveDays:a.filter(function(x){return x>0;}).length/a.length,days:a.length };
  }
  function backtest(bars,id,feeBps) {
    var f=features(bars),N=f.close.length;
    if(N<320) throw new Error("至少需要 320 個交易日的歷史價格，才能進行可比較的回測。");
    var sig=signals(f,id),fee=clamp(n(feeBps)||0,0,200)/10000;
    var e=10000,b=10000,last=0,dates=[],strategy=[],benchmark=[],exposure=0,trades=0,turnover=0;
    for(var i=254;i<N;i++) {
      // t-2 close produces the decision, t-1 close is next-session execution,
      // then earn close(t-1)->close(t) return. Do not use close(t).
      var pos=sig[i-2],r=f.close[i]/f.close[i-1]-1,delta=Math.abs(pos-last);
      var cost=fee*delta;
      e=e*(1+pos*r-cost);
      b=b*(1+r-(i===254?fee:0));
      dates.push(f.bars[i].d);strategy.push(e);benchmark.push(b);
      if(delta>0.00001)trades++;
      exposure+=pos;turnover+=delta;last=pos;
    }
    var split=Math.floor(strategy.length*0.75);
    return { dates:dates,strategy:strategy,benchmark:benchmark,
      overall:stats([10000].concat(strategy)),hold:stats([10000].concat(benchmark)),
      test:stats([strategy[split-1]].concat(strategy.slice(split))),
      testHold:stats([benchmark[split-1]].concat(benchmark.slice(split))),
      splitDate:dates[split],feeBps:feeBps,tradeCount:trades,
      exposure:exposure/strategy.length,turnover:turnover,
      latestSignal:sig[N-1],priorExecutable:sig[N-2],warmup:254 };
  }
  function levels(f) {
    var i=f.close.length-1;
    if(i<252) return null;
    var price=f.close[i],atr=f.atr14[i],up=price>f.sma200[i];
    if(!isNum(atr)||atr<=0)atr=price*0.02;
    var band=up?[Math.max(.01,price-1.5*atr),Math.max(.01,price-.45*atr)]:null;
    var stop=up?Math.max(.01,Math.min(f.sma200[i]*.99,price-2.6*atr)):null;
    return { bullish:up,price:round(price),atr:round(atr),buy:band&&band.map(function(x){return round(x);}),
      add:up?[round(Math.max(.01,price-2.5*atr)),round(Math.max(.01,price-1.5*atr))]:null,
      stop:round(stop),target:up?[round(price+2*atr),round(price+3.5*atr)]:null,
      recovery:round(f.sma200[i]*1.01),trend:round(f.sma200[i]),high20:round(f.high20[i]) };
  }
  function riskSize(capital,riskPct,entry,stop,maxAllocationPct) {
    var c=n(capital),r=n(riskPct),p=n(entry),s=n(stop),max=n(maxAllocationPct);
    if(![c,r,p,s,max].every(isNum)||c<=0||r<=0||p<=s||max<=0) return null;
    var byRisk=Math.floor(c*r/100/(p-s)),byCap=Math.floor(c*max/100/p),q=Math.max(0,Math.min(byRisk,byCap));
    return {shares:q,notional:round(q*p),maxLoss:round(q*(p-s)),riskBudget:round(c*r/100),riskPct:round(q*(p-s)/c*100,3)};
  }
  function parseCSV(text) {
    var lines=String(text||"").replace(/^\uFEFF/,"").trim().split(/\r?\n/);
    var head=lines.shift().split(",").map(function(x){return x.replace(/"/g,"").trim().toLowerCase().replace(/[\s_-]/g,"");});
    function idx(names){for(var j=0;j<names.length;j++){var k=head.indexOf(names[j]);if(k>=0)return k;}return -1;}
    var d=idx(["date","datetime"]),o=idx(["open"]),h=idx(["high"]),l=idx(["low"]),c=idx(["close"]),a=idx(["adjclose","adjustedclose"]),v=idx(["volume"]);
    if(d<0||c<0) throw new Error("CSV 需要 Date 與 Close 欄位；也支援 Open、High、Low、Adj Close、Volume。");
    var rows=[];
    lines.forEach(function(line){
      if(!line.trim())return;
      var x=line.split(",").map(function(y){return y.replace(/"/g,"").trim();}),close=n(x[c]),adj=a>=0?n(x[a]):NaN;
      if(!isNum(close)||close<=0)return;
      var ratio=isNum(adj)&&adj>0?adj/close:1;
      var get=function(k){return k>=0&&isNum(n(x[k]))&&n(x[k])>0?n(x[k])*ratio:close*ratio;};
      rows.push([x[d].slice(0,10),get(o),get(h),get(l),close*ratio,v>=0?n(x[v]):0]);
    });
    var cleaned=normalizeBars(rows);
    if(cleaned.length<2)throw new Error("沒有足夠的有效日期與價格資料。");
    return cleaned;
  }
  var api={STRATEGIES:STRATEGIES,normalizeBars:normalizeBars,features:features,strength:strength,signals:signals,stats:stats,backtest:backtest,levels:levels,riskSize:riskSize,parseCSV:parseCSV,round:round};
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  root.QuantCore=api;
})(typeof window!=="undefined"?window:globalThis);
