#!/usr/bin/env python3
"""Personal-use EOD data cache for MakeMoney.

Yahoo Finance historical price data fetched via yfinance are intended for
personal research only. This script does not create live, licensed quotes.
Price rows are adjusted OHLC (auto_adjust=True), preserving split/dividend
adjustment consistency. Never upload credentials or personal holdings.
"""
from __future__ import annotations

import json
import math
import os
import pathlib
import sys
import time
from datetime import datetime, timezone

import yfinance as yf

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data"
SYMBOLS = [
    "NVDA", "GOOGL", "MSFT", "AAPL", "TSLA", "TSM",
    "ADBE", "NOW", "AMZN", "META", "AMD", "CEG",
    "SPY", "VOO", "QQQM", "SCHD", "RSP", "IJR",
    "AVGO", "MU", "ASML", "AMAT", "LRCX", "ORCL", "CRWV",
    "VRT", "ETN", "NEE", "COST", "WMT", "PG", "KO", "MCD",
    "JPM", "V", "MA", "UNH", "LLY", "JNJ", "CAT", "DE", "GE",
    "O", "PLD", "AMT", "HD", "DIS", "XOM", "CVX", "PANW",
    "CRWD", "CRM", "GLD",
]
YEARS = os.getenv("MAKEMONEY_HISTORY", "8y")
MIN_ROWS = 320


def valid_num(value: object) -> bool:
    try:
        return math.isfinite(float(value)) and float(value) > 0
    except (ValueError, TypeError):
        return False


def rows_from_dataframe(frame) -> list[list]:
    rows = []
    if frame is None or frame.empty:
        return rows
    for date, row in frame.iterrows():
        try:
            d = date.strftime("%Y-%m-%d")
            o, h, l, c = (float(row[k]) for k in ("Open", "High", "Low", "Close"))
            v = float(row["Volume"]) if "Volume" in frame.columns else 0
            if not all(valid_num(x) for x in (o, h, l, c)):
                continue
            if h < max(o, l, c) or l > min(o, h, c):
                continue
            if not math.isfinite(v) or v < 0:
                v = 0
            # 4 decimal places is sufficient for EOD scenario research.
            rows.append([d, round(o, 4), round(h, 4), round(l, 4), round(c, 4), int(v)])
        except (KeyError, ValueError, TypeError, OverflowError):
            continue
    return rows


def cached(symbol: str) -> list[list]:
    path = OUT / f"{symbol}.json"
    if not path.exists():
        return []
    try:
        content = json.loads(path.read_text(encoding="utf-8"))
        return content.get("bars", []) if isinstance(content, dict) else []
    except (OSError, json.JSONDecodeError):
        return []


def fetch_symbol(symbol: str) -> list[list]:
    last_error = None
    for attempt in range(3):
        try:
            data = yf.Ticker(symbol).history(
                period=YEARS,
                interval="1d",
                auto_adjust=True,
                actions=False,
                repair=False,
                raise_errors=True,
            )
            rows = rows_from_dataframe(data)
            if len(rows) >= MIN_ROWS:
                return rows
            last_error = RuntimeError(f"only {len(rows)} valid rows")
        except Exception as exc:
            last_error = exc
        time.sleep(2 * (attempt + 1))
    print(f"[WARN] {symbol}: {last_error}", file=sys.stderr)
    return []


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    catalog = {
        "updated_at": now,
        "provider": "Yahoo Finance via yfinance (personal research only)",
        "price_mode": "historical adjusted OHLC; daily; not live",
        "symbols": {},
        "failed": [],
    }
    successful = 0
    for symbol in SYMBOLS:
        new_rows = fetch_symbol(symbol)
        old_rows = cached(symbol)
        if new_rows and (not old_rows or new_rows[-1][0] >= old_rows[-1][0]):
            payload = {
                "symbol": symbol, "source": "Yahoo Finance / yfinance",
                "price_mode": "auto_adjust=True", "fetched_at": now,
                "bars": new_rows,
            }
            (OUT / f"{symbol}.json").write_text(
                json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
            rows = new_rows
            successful += 1
            freshness = "updated"
        elif old_rows:
            rows = old_rows
            freshness = "cached; fetch failed or older"
            catalog["failed"].append(symbol)
        else:
            print(f"[ERROR] {symbol}: no usable data", file=sys.stderr)
            catalog["failed"].append(symbol)
            continue
        catalog["symbols"][symbol] = {
            "first": rows[0][0], "last": rows[-1][0],
            "rows": len(rows), "status": freshness
        }
        print(f"{symbol}: {len(rows)} rows through {rows[-1][0]} ({freshness})")
        time.sleep(0.4)

    # Never destroy last good catalog on a total provider outage.
    if not catalog["symbols"]:
        print("[ERROR] Provider unavailable and no cached market data.", file=sys.stderr)
        return 1
    (OUT / "catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Fresh downloads: {successful}/{len(SYMBOLS)}. Missing: {catalog['failed']}")
    return 0 if successful else 1


if __name__ == "__main__":
    raise SystemExit(main())
