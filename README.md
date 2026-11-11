# MakeMoney

**Private research terminal for US equities.** A mobile-first, static PWA with explainable signals, conservative daily-bar backtests, technical scenario price bands, risk sizing and local-only holdings.

This is **not** a brokerage app, live quote feed, certified investment advice, trained AI prediction model or automatic money maker.

## Status — Version 1 (2026-11-11)

Implemented:
- Historical adjusted daily OHLC chart, SMA50/200, RSI14, ATR14, annualized 20-day volatility, 12-1 momentum.
- Long-only SMA trend, 12-1 momentum, trend-filtered RSI mean reversion, 20-day breakout, 18%-volatility target, four-factor ensemble, and buy-and-hold benchmark.
- Transparent ATR-based pullback/add/technical invalidation/profit **scenario** price ranges, not guaranteed fills.
- Backtesting with one-session signal execution lag, configurable proportional trading costs, CAGR, drawdown, volatility, Sharpe, chronological final 25% comparison.
- Risk budget calculator, local-only holdings and cash, JSON backups, historical CSV import.
- iPhone-friendly PWA, manifest and home screen icon, scheduled GitHub market-data updater.

Not implemented: trained Qlib/LightGBM, actual LEAN or vectorbt runtimes, PyPortfolioOpt solver, point-in-time fundamentals, licensed commercial quotes, audited live execution, Firstrade integration.

## First-time market data

1. Open repository **Actions** → **Update market data** → **Run workflow**.
2. Let the workflow finish. It fetches personal-research historical adjusted **daily** OHLC using yfinance, then commits only data JSON files to the repository.
3. Review **data/catalog.json** for last trading date, bar count and status per symbol.
4. Updates are scheduled for **Tuesday–Saturday 11:20 Taiwan time** (03:20 UTC), after the previous US session. GitHub scheduled jobs can be delayed; weekends, holidays and provider outages can result in stale data.

The repository starts with **no fabricated example prices**. Until the first successful refresh, run Actions or import historical CSV. If the provider is unavailable, existing data are retained where possible.

Source: [yfinance](https://github.com/ranaroussi/yfinance). Yahoo Finance API market data are intended for **personal use and research/education**. Check data rights and provider terms before publishing, redistributing, selling or commercializing a website containing these files.

## Launch iPhone web app

This repository is **private**. GitHub Pages on GitHub Free is generally limited to public repositories; Pages from a private repository is available to eligible paid GitHub plans such as GitHub Pro. Even when the source repository is private, **the deployed Pages website and data should not be assumed private**.

1. In GitHub open **Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save**, only if your plan permits Pages from private repositories.
2. Confirm deployment is successful. The normal project Pages URL would be https://alvinxyyzzz.github.io/MakeMoney/ — **do not assume this URL works until GitHub confirms it**.
3. On iPhone Safari open the verified site → Share → **Add to Home Screen**. The iOS icon should come from icons/icon-180.png; after replacing a cached icon, remove and re-add the home screen shortcut.
4. If you need private access and do not have a compatible plan, use a trusted private host or a local server. Do not make the repo public merely for convenience without checking data rights and access controls.

No sensitive portfolio information is preloaded into the repository.

## Manual CSV import

Import one symbol at a time from the Research tab. Accepts header fields Date, Open, High, Low, Close, Adj Close, Volume; Date and Close are required. The parser adjusts OHLC by the ratio Adj Close / Close when the adjusted field is supplied. Historical files should contain at least **255 rows** for indicators and **320 rows** for backtesting. An unadjusted CSV can distort returns and signals.

CSV remains in your browser's local storage; it can be included in the private JSON backup exported from the holdings screen.

## Backtest methodology

- Signals only access data through close **t−2**. Trade is approximated at the **next** session close t−1 and earns return t−1 to t. This one-day delay avoids inadvertently using price t to trade before it exists.
- Daily, long-only position 0–100%, no leverage or shorting. A simplified assumption of full participation at next close is not the same as real broker execution.
- Returns use adjusted prices; dividends are not separately added. This is an approximation, not a broker-exact return series.
- Default fee is 10 basis points per unit of capital traded, adjustable. No bid-ask spread, market impact, taxes, borrowing cost, fill constraints or currency effects yet.
- Warm-up is 254 daily bars for all strategies. Final 25% results are a chronological comparison, **not** a truly untouched test, nested walk-forward validation or overfitting-proof performance.
- Benchmark is **buy-and-hold of the selected stock over identical dates** (not automatically SPY or VOO).
- Sharpe assumes 0 risk-free rate and 252 sessions/year. No point-in-time historical universe or survivorship-bias adjustments.

Run local regression tests with: **node tests/engine.test.cjs**.

Detailed architecture and model validation plan: [docs/research-design.md](docs/research-design.md).

## Open-source research foundation

| Project | Role / planned work | V1 actual runtime |
| --- | --- | --- |
| [Microsoft Qlib](https://github.com/microsoft/qlib) | Alpha158, LightGBM and ML experiment design | Not trained or deployed |
| [vectorbt](https://github.com/polakowo/vectorbt) | Vectorized backtesting, cost and sensitivity methodology | Not installed; original JS backtester |
| [QuantConnect LEAN](https://github.com/QuantConnect/Lean) | Event-driven simulation / execution | Not integrated |
| [PyPortfolioOpt](https://github.com/PyPortfolio/PyPortfolioOpt) | Portfolio risk and allocation optimization | Not integrated |
| [Machine Learning for Trading](https://github.com/stefan-jansen/machine-learning-for-trading) | Leakage, walk-forward validation, overfit defenses | Methodology reference |

**License notice:** vectorbt community edition is currently Apache 2.0 with Commons Clause, not plain MIT. Verify license rights before commercial reuse. V1 does not copy its source.

## Run locally

Install Python dependencies: **python -m pip install -r requirements.txt**.
Then update prices: **python scripts/update_prices.py**.
Serve the static repository root over HTTP (for example **python -m http.server 8000**) and open http://localhost:8000/.
To validate strategy logic run **node tests/engine.test.cjs**.

## Privacy

Portfolio shares, cost, cash and imported CSV exist only in the local browser storage. There is no login, server sync or broker connection. JSON backups include personal financial information and should be handled carefully. Clearing browser data or deleting a home-screen app may erase local data.

## Roadmap

- V2: compare to SPY/VOO/QQQM, expanding-window walk-forward, parameter robustness, transaction-cost sensitivity and stronger slippage model.
- V3: fundamental valuation, earnings and macro signals with auditably point-in-time data.
- V4: optional separate Python Qlib research pipeline and genuinely out-of-sample comparisons with simple strategies; real PyPortfolioOpt risk allocation.
- Future: opt-in broker file import, with privacy and data licensing safeguards. No auto-execution in V1.
