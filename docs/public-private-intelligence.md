# Public Information × Private Holdings — Design and Safety

**Goal:** each week answer *"What changed in the public world, and why might it matter to the positions I actually hold?"* Do not build another generic stock news feed.

## In production now (V3)

1. Public GitHub Actions collect adjusted EOD prices, RSS titles/links, vendor fundamentals and research-only model diagnostics. Their outputs are public reference files. **Personal holdings are never copied into the repository.**
2. At release time \`scripts/build_snapshot.cjs\` derives a compact \`data/weekly-signals.json\`, sharing the browser's real quant factors; its output is around 54 KB instead of forcing the iPhone to download ~5.6 MB of complete symbol history for a weekly view.
3. In Safari/PWA, \`app.js\` loads public metadata, and lazy-loads full historical bars only for actual positions, SPY and opened details. Local positions stay in browser storage.
4. \`public-bridge.js\` joins public news to local symbol positions. Three types of relationships: **direct ticker**, **hypothesized supply-chain/competitive linkage**, **same sector**, plus broad topic exposure. The relationship list is hand-curated and speculative: **it never asserts a headline is bullish or bearish**.
5. \`decision-journal.js\` keeps up to 16 weekly snapshots, 16 saved research summaries and 100 manually recorded actions on the device. It detects weekly deltas and builds small AI briefs using the user's *own* state, rather than uploading the entire universe.
6. The AI action copies a compact packet. The user controls if/when to paste it into ChatGPT; there is **no automatic LLM call, API secret, broker login or trading connection**.
7. The portfolio calculator does not label a partial valuation as total assets or infer complete weights when any position lacks a price.

## The next major information sources to implement (not yet connected)

| Source | Evidence | How it joins the portfolio | Constraints |
| --- | --- | --- | --- |
| [SEC EDGAR company filings](https://data.sec.gov/) | 8-K, 10-Q, 10-K, S-3, official disclosures | CIK ↔ ticker, new filing dates, actual revision to metrics or thesis | Comply with fair-access requests and declared User-Agent; no invented SEC credentials. Prefer source links and verified minimal facts |
| Company Investor Relations | Earnings release, presentation, guidance | Ticker and release timestamp; parse revenue, capex, guidance vs prior | Check original content, avoid copyrighted wholesale text |
| Exchange or trusted corporate-action feeds | Ex-date, splits, mergers | Correct position quantities, cost basis, price adjustments | Actual broker cost basis wins over modeled prices |
| [FRED series](https://fred.stlouisfed.org/docs/api/fred/) | Yields, macro observations and revisions | Tag sectors by rate sensitivity; compare changes to thesis | FRED API key and per-series third-party rights; never store a key in browser/source |
| Sector/industry research | Price-to-sales, peers, margins, growth | Compare a stock to peer groups rather than one arbitrary universal P/E threshold | Vendors' estimated fields are not audited filings |
| Company calendars | Earnings date, investor day, regulatory deadlines | Identify an event **before** taking a large position | Verify announcements; earnings dates often move |

An SEC filing is more authoritative than a news headline about the filing. No newspaper headline should automatically cause "sell" or "buy."

## How the personalized intelligence layer should prioritize alerts

The **relevance** of an event is distinct from the event's **direction**:
- **Relevance** = source credibility × portfolio exposure × linkage confidence × recency × novelty.
- **Directional impact** (good or bad) requires more evidence: magnitude vs consensus, earnings quality, valuation implications, and possible second-order effects. If missing, label *"needs review"*.
- Distinguish **direct fact** (a filing about a held company) from **hypothesis** (a news story about a related industry).
- Deduplicate events and maintain source URL, publisher, publication timestamp, fact effective date, instrument, relationship, and recorded observation date.
- Never treat a numerical factor score as a likelihood of profit.

### Example (hypothetical)

User holds **GOOGL**, **NVDA** and **TSM**. A newly published **NVDA** investor-relations update may be *directly* relevant to NVDA, while offering *possible* monitoring links for TSM's manufacturing outlook and GOOGL's AI capex exposure. It does **not** establish that those other companies' earnings have changed. The app should link the original evidence, show *"check capex, margins and customer concentration"*, and reserve a deeper AI call for an event that is material to portfolio weights or breaks an earlier thesis.

## Token-efficient weekly loop

**0 ChatGPT tokens** for source collection, deterministic feature screens, local delta comparison, and event relevance. These tasks use GitHub runner/hosting allowances and may have separate provider costs.

**Instant or no LLM** for formatting or describing an already computed change.

**Medium** only for a sourced weekly portfolio decision note when materially new evidence appears.

**High** for up to a few genuinely important ambiguous investment theses, major earnings changes or portfolio reallocation decisions.

Keep AI output as a compact, human-reviewable memo:
- action (hold/add/trim/research/avoid);
- what changed, its source and date;
- effect on the original business thesis;
- valuation upside/downside and what would disprove the decision;
- portfolio size/sector correlation and cash opportunity cost;
- data gaps and next review trigger.

Save that memo *locally*, and only send **deltas plus the relevant previous research summary** on the next request. Do not submit 53 complete price histories, old RSS titles or a 16-report archive every week.

## Critical privacy and publishing caveats

- GitHub Pages and the code repository are currently public. Do not put holdings, IDs, brokerage statements, credentials, or personalized research records in GitHub Actions inputs or public JSON.
- \`localStorage\` is not an encrypted personal financial vault. It is tied to the browser and origin and can be lost if data are cleared; personal backups must be handled as sensitive. Future syncing needs consent, encryption and authentication.
- Vendor historical market-data/financial-data terms may limit republishing. A public repo does not automatically grant redistribution rights. This remains a product risk until a properly licensed source or private data path is adopted.
- No automated trading, portfolio optimization guarantee, or verified news sentiment is part of V3. Be conservative with news-driven suggestions.
