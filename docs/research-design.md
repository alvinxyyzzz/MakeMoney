# MakeMoney — Model Architecture & Research Protocol
Research plan updated 2026-11-11. This document separates **what the app runs today** from **what would require a dedicated Python research pipeline**.

## 1. Decision problem

The target user is a medium-horizon US equity investor who wants actionable, explainable **conditional entry/add/trim/invalidation zones** for holdings and watchlist names across different regimes, rather than opaque return predictions.

The decision is decomposed into:
1. Regime: SPY and market breadth, volatility, treasury and earnings context. V1 only measures SPY relative to SMA200; no broad macro feed yet.
2. Quality and fundamental valuation: margins, revenue/FCF growth, forward earnings, capex, peer multiples and point-in-time updates. Not implemented.
3. Alpha: rule signals and future optional Qlib model scores.
4. Execution: a scenario range for limit-entry planning, not a guaranteed transaction.
5. Portfolio constraints: position sizing, concentration and drawdown risk; correlation is not yet modeled.
6. Validation: historical replay, costs, walk-forward and independent benchmarks.

## 2. Why these open-source projects

- **Microsoft Qlib** (https://github.com/microsoft/qlib): Research framework, not a plug-and-play buy-price predictor. Its Alpha158 feature groups and LightGBM workflows make a reasonable later baseline for cross-sectional 5–21 session return ranking. Important: the reference workflow's published historical performance must not be imported or generalized to the user's stocks; retrain on US universe with point-in-time records, costs and out-of-sample testing.
- **vectorbt** (https://github.com/polakowo/vectorbt): Good for fast repeated strategy evaluation and parameter-sensitivity runs. V1 mimics basic research ideas with original browser-side JS, not vectorbt's actual engine. Check **Apache 2.0 + Commons Clause** licensing before redistributing as a paid product.
- **QuantConnect LEAN** (https://github.com/QuantConnect/Lean): Mature event-driven fill and order mechanics, suitable for later slippage/order simulation, but unsuitable to embed directly in a small static iPhone PWA.
- **PyPortfolioOpt** (https://github.com/PyPortfolio/PyPortfolioOpt): Shrinkage covariance, Black-Litterman and HRP offer a better route to multi-stock weights than assigning all names a numerical buy score. For concentrated portfolios, estimated correlation and bounds need strict robustness checks.
- **ML for Trading, 3rd ed.** (https://github.com/stefan-jansen/machine-learning-for-trading): Research governance, timestamp integrity, multiple-testing corrections and walk-forward holdout. ML complexity is justified only after outperforming simple fixed rules net of costs.

## 3. Baselines actually implemented

Seven reproducible long-only choices share an adjusted close-data stream and identical warmup:
- Buy and hold: always invested after warmup.
- SMA trend: close > 200SMA and 50SMA > 200SMA.
- Momentum: 12-1 total return (from t−252 to t−21) positive and close > 200SMA.
- Trend-filtered mean reversion: in long-term uptrend, enter if RSI14 < 35, exit if RSI14 > 60 or trend fails.
- Breakout: close > prior 20-session high to enter, close < SMA20 or prior 10-session low to exit.
- Volatility target: if trend positive, position = minimum of 1 and 18% annual target / realized 20-session annual volatility.
- Ensemble: score each of long-term trend, moving-average alignment, 12-1 momentum and RSI. Require price above SMA200 to allow long exposure; full size if score≥2, half size if neutral and in uptrend, otherwise cash.

These are *hypotheses*. None is claimed to maximize wealth, predict an earnings gap or consistently beat the benchmark.

## 4. Price regions: what they do and don't mean

The app uses historical **ATR14** to express zones relative to current adjusted close:
- Pullback observation: last close −1.5 ATR to −0.45 ATR when close above SMA200.
- Additional observation: last close −2.5 ATR to −1.5 ATR (not an automatic averaging-down instruction).
- Technical invalidation: min(SMA200 × 0.99, last close −2.6 ATR).
- Illustration of favorable moves: last close +2 and +3.5 ATR.

When close is below SMA200, do not show buy/add/target levels; show re-entry observation around SMA200 × 1.01. These zones are **mechanical technical scenarios** with zero calibrated probability content. They are not intrinsic value or analyst targets.

## 5. Honest validation: mandatory next research cycle

Dataset:
- Point-in-time OHLCV with splits/dividends; confirm adjusted price methodology; track version and missing sessions.
- Build historical investable universes that include delisted names for any cross-sectional claim; no survivor-picked 2026 watchlist used as evidence of general stock-picking alpha.
- For fundamentals, store filing publication timestamps, not fiscal period end dates as the knowledge time.
- Track market hours and US Eastern timezone; distinguish signal timestamp from trade timestamp.

Experiments:
1. Choose primary outcomes in advance: net CAGR, drawdown, turnover and active drawdown vs SPY/QQQM; show buy-and-hold of the same asset as control.
2. Chronological train/validation/test, e.g. 2015–2020 train, 2021–2022 validation, 2023–2026 untouched test **if historical as-of data are actually available**. No random train/test split across financial timestamps.
3. For 21-day forward target labels, purge observations whose label windows overlap and embargo at least a relevant label horizon around folds.
4. Fixed walk-forward retraining dates, models and features determined before test; score with net-of-cost execution from future timestamps only.
5. Stress transaction costs at 5, 10, 25 bps plus plausible spread/slippage; low-liquidity stocks may demand more.
6. Re-run across 2020 crash, 2022 bear, 2023–2024 AI boom, 2025–2026 mixed phases, but do not assert these phases predict future regimes.
7. Correct for repeated searches (Deflated Sharpe / multiple testing), keep a run registry, report confidence intervals and failure cases.
8. Do not select models just because they scored highest on the same historical data displayed in the app.

Risk:
- A chosen drawdown tolerance is a **warning threshold**, never a backtest promise; gaps can bypass stops.
- Limit weights per name/sector, record correlation clusters, and compare recommendations under 20%, 30% and 40% stress.
- Prefer robust risk budgets and fractional Kelly constraints over unbounded prediction-based sizing.

## 6. Implementation boundary

V1 browser runs deterministic ES JavaScript only. The market action downloads 18 names with yfinance and stores adjusted day bars as static JSON; user's holdings remain in localStorage. No credentials are sent to finance providers, no news or alternative data is fetched, no broker orders placed.

V2 would add multi-benchmark backtests and true rolling evaluation to an independent Python test pipeline. V3 would fetch point-in-time quality/valuation datasets. Only then would training Qlib LightGBM or more sophisticated models be justified. Model outputs would need reproducible run identifiers, training window, data vintage, metrics and explicit as-of timestamps before appearing as trading evidence in the app.
