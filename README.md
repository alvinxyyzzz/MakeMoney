# MakeMoney · Weekly Investment Decision Cockpit

**Current release: MVP v2 — 12 November 2026.** A mobile-first, static investment decision workspace, focused on **what to do with your Firstrade US stocks this week** and **which sectors or candidates deserve immediate deeper research**.

- [Open the deployed app](https://alvinxyyzzz.github.io/MakeMoney/)
- [Inspect GitHub Actions](https://github.com/alvinxyyzzz/MakeMoney/actions)
- [Model selection & validation protocol](docs/research-design.md)

### What you can actually use now

| Screen | Function |
| --- | --- |
| 本週決策 | Market regime, your holdings' conditional actions, concentration/correlation warnings, and technical candidates |
| 我的持倉 | Import Firstrade position CSV **locally**, preview, confirm, edit, save browser-only and back up to JSON |
| 發掘機會 | Scan **53** predefined US equities and ETFs across AI chips, power, industrials, financials, healthcare, real estate, consumer and software |
| 個股研究 | Adjusted daily prices, moving averages, factor decomposition, ATR scenario zones, risk position sizing |
| 策略實驗 | 7 deterministic long-only strategies, costs and chronological out-of-sample-period display (not a true blind test) |
| Individual stock card | Quant score, conditional action, current EOD context, factors, research gaps and timestamped news links |
| ✦ AI 深入分析 | **Copies an evidence packet for manual paste into ChatGPT**, no API key or automatic AI calls |

**Important distinction:** The weekly screen automatically gives **rules-based conditional actions**, not a complete AI fundamental recommendation. The ChatGPT button enables an actual deep research conversation after you intentionally paste the packet; it does not run ChatGPT models inside the website or quietly send sensitive holdings to a backend.

### First-time weekly workflow

1. Open **我的持倉** and import a Firstrade CSV with columns such as \`Symbol,Quantity,Average Cost\`. Some statements contain extra lines and headers; the parser searches for compatible holdings columns, groups duplicate tickers and records skipped rows. Always inspect the preview before confirming. If you have no CSV, use the manual holdings entry fields.
2. The holdings, cash and imported price files are saved in the browser only, not in this public GitHub repository. On iPhone, add the site to the Home Screen via Safari's Share menu.
3. Check **本週決策** for your holdings' portfolio-weight warning and current technical action. Tap any symbol for the decision card.
4. Open **發掘機會** to compare sectors, including non-AI names. A "current candidate" means **technical setup eligible for fundamental review**, not that a DCF or earnings report has proven it undervalued.
5. For a full AI committee review, tap **✦ AI 深入分析**. The app prepares a locally assembled prompt with your entered holdings, date-stamped price factors and available headline URLs. It copies it to clipboard (or downloads TXT if copying fails). **You choose whether to paste this private packet into ChatGPT.**
6. Export the holdings backup JSON regularly, especially before clearing Safari storage or reinstalling a PWA. The exported file contains personal financial information.

### Data & automatic update schedule (Taiwan time)

| Update | Schedule | ChatGPT tokens | Type |
| --- | --- | --- | --- |
| End-of-day US market data | Tuesday–Saturday at 11:20 | **0** | GitHub Actions + yfinance, adjusted OHLC, non-real-time |
| Weekly dated RSS headlines | Sunday at 09:30 | **0** | GitHub Actions public RSS retrieval; linked titles, not AI news synthesis |
| Weekly fundamental snapshots | Sunday at 10:45 | **0** | Yahoo Finance secondary-source P/E, FCF yield, revenue growth and margins; partial coverage possible |
| LightGBM cross-sectional research | Sunday at 11:30 | **0 ChatGPT tokens** | GitHub Actions training/validation using public historical OHLC, not ChatGPT |
| Portfolio analysis dashboard | Whenever you open the website | **0** | Runs on your device, localStorage |
| Deep fundamental/market AI research | When you request it in ChatGPT | **Uses your ChatGPT model usage** | User-initiated, verified current research, not automatic website inference |

GitHub Actions has its own runner usage and restrictions; "zero ChatGPT tokens" does not imply zero hosting, finance-feed or provider cost. Actual GitHub schedules may be delayed, especially during service issues. US market holidays do not produce new sessions.

**Real-time quotes are deliberately excluded from MVP.** A weekly investment process does not need millisecond or intraday ticks. Adding licensed market-data feeds, quote redistribution rights, keys, and broker-like availability would increase costs and operational complexity. EOD updated once per US trading day is more proportionate to weekly reviews; the app labels its data date and will not claim live prices.

### Research and actual machine learning

**Deterministic baseline:** The browser runs custom original JavaScript implementations of 7 quant strategies, long-term trend, 12–1 momentum, RSI and 20-day breakout. A separate Decision Lab ranks 53 current watchlist names on SMA200, MA alignment, 12–1 momentum, relative SPY performance, volatility/drawdown and RSI. The output is a **heuristic score, not success probability**.

**Experimental trained LightGBM:** GitHub Actions trains a cross-sectional regression model on daily point-in-time-like price factors, targeting next-21-session **excess return versus SPY** with chronological holdout beginning 2025-01-01. It never uses today's unobserved label to train. See [scripts/train_model.py](scripts/train_model.py), [data/model-signals.json](data/model-signals.json) and its public training logs. The baseline and validation metrics are available in the artifact. The model's ranking is **hidden unless its holdout mean Spearman IC exceeds 0.025 and surpasses a fixed simple-factor baseline**.

Initial real experiment (2026-11-12): holdout IC about **−0.0037**, failing the gate. This is a valuable negative result; the app will **not** present model-generated buys just because a machine-learning library exists. No automated optimized-alpha or live trading claim is made. The current 53-name universe has survivorship and selection bias and is not sufficient to establish investable net-of-cost outperformance.

| Source framework | What is actually adopted | What is not falsely claimed |
| --- | --- | --- |
| [Microsoft Qlib](https://github.com/microsoft/qlib) | Alpha158-inspired factor families and disciplined train/test protocol | No direct Qlib runtime, weights or imported benchmark returns |
| [vectorbt](https://github.com/polakowo/vectorbt) | Parameterized strategy comparisons, cost accounting and reproducible research | No vectorbt runtime, no guaranteed net alpha |
| [QuantConnect LEAN](https://github.com/QuantConnect/Lean) | Trade timestamp discipline and conservative next-session execution principle | No realistic intraday fills, broker order management or LEAN engine |
| [PyPortfolioOpt](https://github.com/robertmartin8/PyPortfolioOpt) | Concentration/correlation/volatility risk perspective | No actual constrained portfolio optimizer |
| [ML for Trading](https://github.com/stefan-jansen/machine-learning-for-trading) | Sample-out validation, leakage checks and anti-overfitting rigor | No copying of published historical ML results |

**Not investment advice.** No live brokerage or Firstrade API connection exists. Yahoo Finance/yfinance market data are intended for personal educational/research use and may not be licensed for public redistribution or commercial resale. Check rights before promoting a public site; secure a licensed market data source for commercialization. This public GitHub Pages site and its static market/news JSON are accessible to others; your imported holdings are not committed.

### GitHub Pages

The site uses [GitHub Pages Actions](.github/workflows/publish-pages.yml), which packages the app only and redeploys after source changes or completed price/news/model workflows. Repositories and Pages websites are **publicly accessible here**. If the deploy job fails or the website returns 404, inspect Settings → Pages and the [deployment workflow](https://github.com/alvinxyyzzz/MakeMoney/actions).

### Test and maintain

Run \`node tests/engine.test.cjs\` and \`node tests/decision.test.cjs\`.

The project has separate weekly-price, RSS and ML workflows. Each writes only public/static reference JSON; **no API key or portfolio credential should ever be committed**.

### Caveats and planned improvements

- Secondary-source P/E, FCF yield, revenue growth and margins are refreshed weekly where accessible, but these fields may have non-matching fiscal periods and are not SEC-filed facts; audited earnings commentary, deeper valuation and DCF still require source-verified ChatGPT research. There is no automatically reasoned weekly AI report inside the static website.
- Some CSV exports may use different names, field formats or options; import has an explicit preview and skip notice.
- Technical adjusted prices should not be read as current broker-executable bid/ask. For trading, check the live quotation in Firstrade.
- Default technical portfolio warnings use a simple 20% single-stock threshold. The user's stated approximate 40% tolerance is a **risk boundary**, not a promise that stops can keep losses below it.
- Backtests are simplified: no real order-book fill, earnings gaps, bid-ask spreads, taxes, benchmark dividend policy differences or real-time corporate-action adjustment guarantees.
- Model validation must not be repurposed as proof of profitable implementation. Independent portfolio-level forward testing and licensed corporate financial data are priorities before any commercial product.
