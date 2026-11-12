#!/usr/bin/env python3
"""Non-generative weekly news index. Sources are RSS links, not AI assertions.
For personal research use. No personal portfolio data is processed.
"""
from __future__ import annotations
import json
import pathlib
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"data"/"weekly-news.json"
TOPICS={
 "NVDA":"Nvidia earnings datacenter", "GOOGL":"Alphabet Google earnings AI",
 "MSFT":"Microsoft Azure earnings", "AAPL":"Apple earnings",
 "TSLA":"Tesla earnings vehicles", "TSM":"TSMC earnings",
 "ADBE":"Adobe earnings", "NOW":"ServiceNow earnings",
 "META":"Meta Platforms earnings AI", "AMZN":"Amazon AWS earnings",
 "AMD":"AMD earnings", "AVGO":"Broadcom earnings",
 "MU":"Micron memory earnings", "ASML":"ASML earnings",
 "ORCL":"Oracle cloud earnings", "CRWV":"CoreWeave results",
 "VRT":"Vertiv cooling earnings", "ETN":"Eaton power equipment earnings",
 "CEG":"Constellation Energy nuclear", "NEE":"NextEra Energy",
 "COST":"Costco earnings", "WMT":"Walmart earnings",
 "JPM":"JPMorgan earnings", "V":"Visa earnings",
 "LLY":"Eli Lilly earnings", "UNH":"UnitedHealth earnings",
 "CAT":"Caterpillar earnings", "GE":"GE Aerospace earnings",
 "O":"Realty Income REIT earnings", "PLD":"Prologis REIT earnings",
 "PANW":"Palo Alto Networks earnings", "CRWD":"CrowdStrike earnings",
 "SPY":"US stocks Federal Reserve CPI jobs",
 "VOO":"S&P 500 markets economy", "QQQM":"Nasdaq technology market earnings",
 "SCHD":"US dividends interest rates", "RSP":"equal weight stocks market",
 "IJR":"US small caps interest rates"
}
MACRO=[
 ("ai","AI datacenter hyperscaler demand capital expenditures"),
 ("consumer","US consumer spending retail credit"),
 ("realestate","US commercial real estate REIT interest rates"),
 ("energy","electricity grids nuclear power data centers"),
 ("macro","Federal Reserve inflation US jobs Treasury yields")
]
def get_feed(search):
 query=urllib.parse.quote(search+" when:7d",safe="")
 url="https://news.google.com/rss/search?q="+query+"&hl=en-US&gl=US&ceid=US:en"
 request=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 MakeMoneyResearch/1.0 (personal academic market-monitor)"})
 with urllib.request.urlopen(request,timeout=16) as r:
  return r.read(650_000)
def parse_feed(blob,now):
 root=ElementTree.fromstring(blob)
 found=[];seen=set()
 since=now-timedelta(days=10)
 for element in root.findall("./channel/item")[:30]:
  title=(element.findtext("title") or "").strip()
  link=(element.findtext("link") or "").strip()
  publisher=element.findtext("source") or ""
  rawdate=element.findtext("pubDate") or ""
  try:published=parsedate_to_datetime(rawdate).astimezone(timezone.utc)
  except (ValueError,TypeError):continue
  if published<since or published>now+timedelta(hours=12):continue
  if not title or not link.startswith("https://") or len(title)>260:continue
  norm=re.sub(r"\W","",title.lower())[:90]
  if norm in seen:continue
  seen.add(norm)
  found.append({"title":title,"url":link,"published":published.isoformat(timespec="seconds"),"source":publisher})
 found.sort(key=lambda x:x["published"],reverse=True)
 return found[:5]
def main():
 now=datetime.now(timezone.utc)
 prior={}
 if OUTPUT.exists():
  try:prior=json.loads(OUTPUT.read_text())
  except (json.JSONDecodeError,OSError):pass
 document={
  "updated_at":now.isoformat(timespec="seconds"),"type":"non-AI RSS headline index",
  "disclaimer":"No verified valuation, sentiment, recommendations, or news summaries. Open originals and check dates.",
  "source":"Google News RSS search, linking to original reporting and aggregator URLs",
  "symbols":{},"topics":{},"failed":[]
 }
 succeeded=0
 for symbol,phrase in TOPICS.items():
  try:
   items=parse_feed(get_feed(phrase),now)
   if items:succeeded+=1
   document["symbols"][symbol]=items
  except Exception as ex:
   document["symbols"][symbol]=(prior.get("symbols") or {}).get(symbol,[])
   document["failed"].append(symbol)
   print("[WARN]",symbol,type(ex).__name__,str(ex)[:150],flush=True)
  time.sleep(0.12)
 for category,phrase in MACRO:
  try:document["topics"][category]=parse_feed(get_feed(phrase),now)
  except Exception as ex:
   document["topics"][category]=(prior.get("topics") or {}).get(category,[])
   document["failed"].append(category)
   print("[WARN]",category,type(ex).__name__,flush=True)
  time.sleep(0.12)
 if succeeded==0:
  print("No fresh headline feed; leaving previous weekly-news data untouched",flush=True)
  return 0 if prior else 1
 OUTPUT.parent.mkdir(parents=True,exist_ok=True)
 OUTPUT.write_text(json.dumps(document,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
 print("News feeds with items:",succeeded,"/",len(TOPICS),"feed failures:",len(document["failed"]))
 return 0
if __name__=="__main__":raise SystemExit(main())
