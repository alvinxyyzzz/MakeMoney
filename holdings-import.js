/* Firstrade-friendly holdings CSV parser, offline and browser-only.
 * Preview, validation and explicit confirmation must precede replacement.
 */
(function(root){
"use strict";
const trim=v=>String(v==null?"":v).trim().replace(/^\uFEFF/,"");
const canonical=v=>trim(v).toLowerCase().replace(/[\s_./\-()（）$%]/g,"");
function csvRows(text){
 const rows=[];let row=[],value="",quoted=false;
 const s=String(text||"").replace(/^\uFEFF/,"");
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(c==='"'){if(quoted&&s[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===","&&!quoted){row.push(value);value="";}
  else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&s[i+1]==="\n")i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value="";}
  else value+=c;
 }
 if(quoted)throw Error("CSV 引號格式不完整");
 row.push(value);if(row.some(v=>v.trim()))rows.push(row);
 return rows;
}
const headings={
 symbol:["symbol","ticker","stocksymbol","securitysymbol","symboldescription","股票代號","证券代码","股票代码","代號","代码","stock"],
 shares:["quantity","shares","share","qty","position","holding","數量","股數","持股","持仓数量","持股數量"],
 cost:["averagecost","avgcost","costbasisperunit","costperunit","averageprice","purchaseprice","averageunitcost","平均成本","成本價","平均买入价","每股成本"],
 total:["totalcost","costbasisamount","costbasisvalue","totalcostbasis","總成本","总成本","costbasis"]
};
function find(headers,possibles){
 for(let i=0;i<headers.length;i++)if(possibles.includes(canonical(headers[i])))return i;
 return -1;
}
function money(value){
 let s=trim(value).replace(/[",\s$＄]/g,"");if(s.startsWith("(")&&s.endsWith(")"))s="-"+s.slice(1,-1);
 const n=Number(s);return Number.isFinite(n)?n:NaN;
}
function parse(text){
 const rows=csvRows(text),issues=[];
 let headerAt=-1,header=null,columns=null;
 for(let i=0;i<Math.min(rows.length,30);i++){
  const row=rows[i],si=find(row,headings.symbol),qi=find(row,headings.shares);
  if(si>=0&&qi>=0){
   headerAt=i;header=row;
   columns={symbol:si,shares:qi,cost:find(row,headings.cost),total:find(row,headings.total)};
   break;
  }
 }
 if(!header)throw Error("未找到股票代號與持股數量欄。請匯出 Firstrade 的持倉明細 CSV，或使用 Symbol,Quantity,Average Cost 格式。");
 const merged={},skipped=[],raw=[];
 for(let i=headerAt+1;i<rows.length;i++){
  const r=rows[i],symbol=trim(r[columns.symbol]||"").toUpperCase().replace(/^["']|["']$/g,"");
  if(!symbol||/^(TOTAL|CASH|ACCOUNT|SUMMARY|SUBTOTAL|GRAND TOTAL)$/i.test(symbol))continue;
  let shares=money(r[columns.shares]);
  if(!/^[A-Z][A-Z0-9.^-]{0,11}$/.test(symbol)||!Number.isFinite(shares)||shares<=0){
   skipped.push({row:i+1,symbol,reason:"不符合股票或正數股數格式"});continue;
  }
  let cost=columns.cost>=0?money(r[columns.cost]):NaN;
  if((!Number.isFinite(cost)||cost<=0)&&columns.total>=0){const total=money(r[columns.total]);if(total>0)cost=total/shares;}
  if(!Number.isFinite(cost)||cost<=0){skipped.push({row:i+1,symbol,reason:"缺少有效每股成本"});continue;}
  if(!merged[symbol])merged[symbol]={symbol,shares:0,invested:0};
  merged[symbol].shares+=shares;merged[symbol].invested+=shares*cost;raw.push(symbol);
 }
 const holdings=Object.values(merged).map(v=>({symbol:v.symbol,shares:Number(v.shares.toFixed(7)),cost:Number((v.invested/v.shares).toFixed(7))})).sort((a,b)=>a.symbol.localeCompare(b.symbol));
 if(!holdings.length)throw Error("沒有成功辨識可匯入持倉；可能選到交易歷史而非目前持倉報表");
 return {holdings,skipped,headerAt,headings:header,detected:columns,rows:rows.length-1-headerAt,hasCost:columns.cost>=0||columns.total>=0};
}
const api={parse,csvRows};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.HoldingsImport=api;
})(typeof window!=="undefined"?window:globalThis);
