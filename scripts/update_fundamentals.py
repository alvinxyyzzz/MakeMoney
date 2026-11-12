#!/usr/bin/env python3
"""Weekly *secondary-source* fundamentals snapshot. Personal research only.

Never mistake Yahoo Finance screener fields for filed SEC values. Missing values
stay null. The snapshot is NOT a licensed commercial redistributable feed.
"""
from __future__ import annotations
import json
import math
import pathlib
import time
from datetime import datetime,timezone
import yfinance as yf

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"data"/"fundamentals.json"
CATALOG=ROOT/"data"/"catalog.json"
FIELDS={
 "name":"longName","sector":"sector","industry":"industry","currency":"currency",
 "trailing_pe":"trailingPE","forward_pe":"forwardPE","price_to_sales":"priceToSalesTrailing12Months",
 "ev_to_ebitda":"enterpriseToEbitda","market_cap":"marketCap","free_cash_flow":"freeCashflow",
 "total_revenue":"totalRevenue","revenue_growth":"revenueGrowth","earnings_growth":"earningsGrowth",
 "gross_margin":"grossMargins","operating_margin":"operatingMargins","profit_margin":"profitMargins",
 "return_on_equity":"returnOnEquity","debt_to_equity":"debtToEquity","dividend_yield":"dividendYield",
 "analyst_target_mean":"targetMeanPrice","analyst_count":"numberOfAnalystOpinions"
}
def acceptable(x):
 if isinstance(x,(int,float)) and not isinstance(x,bool):
  return float(x) if math.isfinite(float(x)) else None
 if isinstance(x,str):
  return x.strip()[:120] if x.strip() else None
 return None
def record(info):
 r={}
 for public,remote in FIELDS.items():r[public]=acceptable(info.get(remote))
 cap=r["market_cap"];cash=r["free_cash_flow"]
 r["fcf_yield"]=cash/cap if cap and cap>0 and cash is not None else None
 completeness=sum(r.get(k) is not None for k in ("forward_pe","revenue_growth","operating_margin","fcf_yield"))
 r["coverage"]=completeness
 r["warning"]="Vendor aggregate estimates: no guaranteed period alignment or SEC filing timestamp"
 return r
def main():
 now=datetime.now(timezone.utc).isoformat(timespec="seconds")
 catalog=json.loads(CATALOG.read_text(encoding="utf-8"))
 symbols=[s for s in catalog.get("symbols",{}) if s not in ("VOO","SPY","QQQM","RSP","SCHD","IJR","GLD")]
 previous={}
 try:previous=json.loads(OUTPUT.read_text(encoding="utf-8"))
 except (OSError,json.JSONDecodeError):pass
 rows={};errors=[];count=0
 for symbol in symbols:
  try:
   info=yf.Ticker(symbol).get_info()
   if isinstance(info,dict) and any(info.get(k) is not None for k in ("marketCap","forwardPE","totalRevenue")):
    rows[symbol]=record(info);count+=1
   elif symbol in (previous.get("symbols") or {}):
    rows[symbol]=previous["symbols"][symbol];errors.append(symbol)
   else:errors.append(symbol)
  except Exception as ex:
   if symbol in (previous.get("symbols") or {}):rows[symbol]=previous["symbols"][symbol]
   errors.append(symbol)
   print("[WARN]",symbol,type(ex).__name__,str(ex)[:160],flush=True)
  time.sleep(.15)
 if not count:
  print("Fundamentals provider unavailable: preserve last good data",flush=True)
  return 0 if previous.get("symbols") else 1
 result={"updated_at":now,"source":"Yahoo Finance via yfinance get_info, secondary/vendor data",
   "not_audited":True,"not_sec_as_filed":True,"price_basis":"Yahoo dynamic vendor fields; not guaranteed same session as EOD adjusted close",
   "symbols":rows,"failed":errors,"fresh_symbols":count}
 OUTPUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("Fresh fundamentals:",count,"of",len(symbols),"unavailable:",len(errors),flush=True)
 return 0
if __name__=="__main__":raise SystemExit(main())
