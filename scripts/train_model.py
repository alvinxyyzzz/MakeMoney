#!/usr/bin/env python3
"""Leakage-guarded LightGBM 21-session cross-sectional *research* model.

Uses locally versioned adjusted OHLCV in data/*.json, never private holdings.
Models 21-session forward excess return vs SPY as an experimental rank signal.
Training at t requires target at t+21, uses fixed 2025 holdout and avoids
asserting live performance, audited profitability or actual Qlib integration.
"""
from __future__ import annotations
import json
import pathlib
from datetime import datetime,timezone

import numpy as np
import pandas as pd
import lightgbm as lgb

ROOT=pathlib.Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
OUT=DATA/"model-signals.json"
FEATURES=["r5","r21","r63","r126","r252","ma20","ma50","ma200","vol20","vol60","rsi14","range63","turnover"]
HORIZON=21
BENCH="SPY"
TEST_DATE="2025-01-01"
MIN_TRAIN=5000
MIN_TEST=600
SEED=2026
IGNORE={"SPY","VOO","QQQM","RSP","SCHD","IJR","GLD"}

def read(symbol):
 try:
  x=json.loads((DATA/f"{symbol}.json").read_text())
  b=x.get("bars",[])
  if len(b)<350:return None
  d=pd.DataFrame(b,columns=["date","open","high","low","close","volume"])
  d["date"]=pd.to_datetime(d["date"],utc=True)
  for c in ["open","high","low","close","volume"]:d[c]=pd.to_numeric(d[c],errors="coerce")
  d=d.set_index("date").sort_index()
  return d[~d.index.duplicated(keep="last")]
 except (OSError,ValueError,KeyError,TypeError):
  return None

def make_factors(df):
 c=df["close"]
 f=pd.DataFrame(index=df.index)
 f["r5"]=c.pct_change(5)
 f["r21"]=c.pct_change(21)
 f["r63"]=c.pct_change(63)
 f["r126"]=c.pct_change(126)
 f["r252"]=c.shift(21)/c.shift(252)-1
 for span in [20,50,200]:f[f"ma{span}"]=c/c.rolling(span).mean()-1
 ret=np.log(c/c.shift(1))
 for span in [20,60]:f[f"vol{span}"]=ret.rolling(span).std()*np.sqrt(252)
 change=c.diff()
 positive=change.clip(lower=0).ewm(alpha=1/14,adjust=False).mean()
 negative=(-change.clip(upper=0)).ewm(alpha=1/14,adjust=False).mean()
 f["rsi14"]=1-(1+positive/negative.replace(0,np.nan)).pow(-1)
 f["range63"]=c/c.rolling(63).max()-1
 f["turnover"]=df["volume"]/df["volume"].rolling(20).mean()-1
 return f.replace([np.inf,-np.inf],np.nan)

def sample(symbol,df,spy):
 fact=make_factors(df)
 future=df["close"].shift(-HORIZON)/df["close"]-1
 s=spy["close"].reindex(df.index,method="ffill")
 sb=s.shift(-HORIZON)/s-1
 # A missing future price / SPY observation must never yield a false zero label.
 target=(future-sb).where(future.notna()&sb.notna())
 fact["target"]=target
 fact["symbol"]=symbol
 fact["date"]=fact.index
 return fact.reset_index(drop=True)

def main():
 spy=read(BENCH)
 if spy is None:raise RuntimeError("SPY benchmark unavailable")
 catalog=json.loads((DATA/"catalog.json").read_text())
 data={}
 samples=[]
 for ticker in catalog.get("symbols",{}):
  if ticker in IGNORE:continue
  bars=read(ticker)
  if bars is None:continue
  data[ticker]=bars
  samples.append(sample(ticker,bars,spy))
 if len(data)<25:raise RuntimeError(f"Insufficient cross-sectional universe: {len(data)}")
 frame=pd.concat(samples,ignore_index=True)
 frame=frame.dropna(subset=FEATURES)
 labeled=frame.dropna(subset=["target"]).copy()
 # Purge final label horizon before holdout: no train sample whose outcome
 # window touches the first test date.
 cutoff=pd.Timestamp(TEST_DATE,tz="UTC")
 train=labeled[labeled["date"]<cutoff-pd.Timedelta(days=HORIZON*2)]
 hold=labeled[labeled["date"]>=cutoff]
 if len(train)<MIN_TRAIN or len(hold)<MIN_TEST:raise RuntimeError(f"Training/test too small {len(train)}/{len(hold)}")
 xtrain=train[FEATURES].to_numpy(dtype=np.float32)
 ytrain=train["target"].to_numpy(dtype=np.float32)
 xtest=hold[FEATURES].to_numpy(dtype=np.float32)
 # Fixed, unoptimized model config (cannot tune on holdout then still call it unseen).
 params=dict(objective="regression",learning_rate=.035,num_leaves=15,
    min_data_in_leaf=200,feature_fraction=.85,bagging_fraction=.8,bagging_freq=1,
    lambda_l2=5,verbosity=-1,num_threads=2,seed=SEED,feature_fraction_seed=SEED,
    bagging_seed=SEED,deterministic=True,force_col_wise=True)
 model=lgb.train(params,lgb.Dataset(xtrain,label=ytrain,feature_name=FEATURES),num_boost_round=130)
 hold["pred"]=model.predict(xtest)
 ics=[]
 for _,group in hold.groupby("date"):
  if len(group)<15:continue
  ic=group["pred"].rank().corr(group["target"].rank())
  if pd.notna(ic):ics.append(float(ic))
 mean_ic=float(np.mean(ics)) if ics else None
 # Equal-weight cross-sectional factor baseline, rank correlation against same target.
 hold["baseline"]=hold.groupby("date")[["r63","r126","ma200"]].rank(pct=True).mean(axis=1)
 baseics=[]
 for _,group in hold.groupby("date"):
  if len(group)<15:continue
  v=group["baseline"].rank().corr(group["target"].rank())
  if pd.notna(v):baseics.append(float(v))
 base_ic=float(np.mean(baseics)) if baseics else None
 # Aggregate labels overlap; daily observations are NOT independent portfolio returns.
 validated=(mean_ic is not None and len(ics)>=80 and mean_ic>0.025
            and (base_ic is None or mean_ic>base_ic))
 # Refit on the whole available, *already labeled* history for next-period inference.
 # Latest 21 sessions have no labels and cannot leak into training.
 live_train=labeled[labeled["date"]<labeled["date"].max()-pd.Timedelta(days=1)]
 final=lgb.train(params,lgb.Dataset(live_train[FEATURES].to_numpy(dtype=np.float32),
                  label=live_train["target"].to_numpy(dtype=np.float32),
                  feature_name=FEATURES),num_boost_round=130)
 latest=frame.sort_values("date").groupby("symbol").tail(1)
 scores=final.predict(latest[FEATURES].to_numpy(dtype=np.float32))
 latest=latest.copy()
 latest["pred"]=scores
 latest["rank_percentile"]=latest["pred"].rank(pct=True)
 signals={}
 for _,r in latest.iterrows():
  signals[r["symbol"]]={"rank":round(float(r["rank_percentile"])*100,1),
     "experimental_excess_return_estimate":round(float(r["pred"]),5),
     "asof":r["date"].strftime("%Y-%m-%d")}
 result={
  "trained_at":datetime.now(timezone.utc).isoformat(timespec="seconds"),
  "model":"LightGBM regression on original Qlib-inspired price factors (not Qlib runtime)",
  "prediction_horizon_sessions":HORIZON,"benchmark":"SPY adjusted closing prices",
  "validation_start":TEST_DATE,"holdout_test_points":int(len(hold)),
  "holdout_cross_sections":len(ics),
  "holdout_mean_spearman_ic":round(mean_ic,5) if mean_ic is not None else None,
  "fixed_factor_baseline_ic":round(base_ic,5) if base_ic is not None else None,
  "passed_research_gate":bool(validated),
  "gate":"mean holdout cross-sectional IC > 0.025 and better than baseline",
  "warning":"Experimental observational OOS rank evidence only. No realistic net-of-cost strategy or 2026 independent blind-test assertion.",
  "symbols":signals if validated else {},
  "tested_universe_size":len(data),"rows_train":len(train),
  "no_credential_or_holdings":True,
 }
 OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("MODEL VALIDATION:",result["passed_research_gate"],"IC:",mean_ic,
      "baseline IC:",base_ic,"universe:",len(data),"samples:",len(train),"/",len(hold))
 return 0

if __name__=="__main__":raise SystemExit(main())
