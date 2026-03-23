# Decision log (working notes)

**Purpose:** Append here **as you build**—every time you choose a library, pattern, route shape, env name, or trade-off. This is the **raw timeline**. Periodically fold important entries into the curated narrative in [DECISIONS.md](./DECISIONS.md) and keep [README.md](./README.md) / [API.md](./API.md) accurate.

**When to add an entry**

- You picked a **technology** or **API** (what and why).
- You chose **structure** (folders, route segments, where WebSocket lives).
- You **rejected** an alternative (brief note: what and why).
- You **changed your mind** (add a new entry; keep old ones for history).

**How to add an entry**

Copy the template below to the **bottom** of this file (newest last). Use ISO dates (`YYYY-MM-DD`).

---

## Template (copy from here)

```markdown
### YYYY-MM-DD — Short title

- **Context:** What problem or task triggered this?
- **Decision:** What we chose (concrete: package name, path, pattern).
- **Why:** Reasoning, constraints (assignment, Finnhub limits, time).
- **Alternatives considered:** Optional; one line each.
- **Follow-up:** Optional; what to document in DECISIONS.md or API.md later.
```

---

## Log (newest at bottom)

### 2026-03-23 — Documentation workflow

- **Context:** Need a single place to capture decisions during development for later [DECISIONS.md](./DECISIONS.md) updates.
- **Decision:** Use this file (`DECISIONS_LOG.md`) as the running log; keep README + DECISIONS as stable reference for reviewers.
- **Why:** The assignment rewards documented trade-offs; a chronological log is easier than editing DECISIONS.md on every commit.
- **Follow-up:** Merge finalized decisions into DECISIONS.md sections as features stabilize.

### 2026-03-23 — Phase 1 implementation choices

- **Context:** Building homepage screener with live WebSocket prices, proxy.ts rate limiting, and Suspense skeletons.
- **Decision:** 25 S&P-heavy symbols in `lib/symbols.ts`; `/api/stocks` route handler proxies Finnhub REST (quote + profile2); `proxy.ts` at repo root with 30 req/min/IP fixed-window limiter; `useFinnhubWebSocket` hook with 250ms throttled flush, exponential backoff reconnect (max 10 attempts), and cleanup on unmount; `ConnectionStatusBadge` renders socket state; manual "Fetch Latest Prices" button calls `/api/stocks` for REST resync.
- **Why:** Assignment requires >=20 stocks, real data, WebSocket (not polling), and smooth UI. Throttled batching prevents jank from rapid ticks. Reconnect with backoff handles network drops gracefully. Manual refresh covers the gap when WS is down so users are never stuck with stale prices.
- **Alternatives considered:** rAF-based flush (chose setTimeout for simpler cross-browser behavior); server-side WS proxy (rejected — adds complexity, Finnhub free keys are commonly client-visible for WS demos); single env var for both server and client (rejected — Next.js requires `NEXT_PUBLIC_` prefix for browser access).
- **Follow-up:** Update API.md with /api/stocks shape; add `'use cache'` to profile fetches in a later pass if Finnhub rate limits become a problem.

### 2026-03-23 — React Compiler enabled

- **Context:** Assignment requires React Compiler in `next.config.ts`.
- **Decision:** `reactCompiler: true` in config; installed `babel-plugin-react-compiler`. No manual `React.memo` or `useMemo` added — compiler handles memoization.
- **Why:** Aligns with Next.js 16 defaults; reduces boilerplate; assignment rubric penalizes unnecessary manual memoization.

### 2026-03-23 — proxy.ts rate limiting

- **Context:** Assignment requires request interception in `proxy.ts` (not `middleware.ts`) with 30 req/min/IP.
- **Decision:** Fixed-window in-memory `Map<ip, {count, windowStart}>` in `proxy.ts`; matcher scoped to `/api/:path*`; returns 429 with `Retry-After` header and remaining-count headers.
- **Why:** Simple, assignment-appropriate. Fixed window is easier to reason about than sliding window and sufficient for a demo. Matcher ensures only API routes are rate-limited (not pages or static assets).
- **Alternatives considered:** Sliding window (more fair but more complex); Redis-backed store (needed for production horizontal scale but out of scope).

### 2026-03-23 — Fix N+1 data fetching with `'use cache'` and quote cache

- **Context:** Page load fired 50 Finnhub calls (25 quotes + 25 profiles). Finnhub free tier caps at 60/min, so a single refresh nearly exhausted the budget and a second refresh within a minute broke. Finnhub has no batch quote endpoint (open feature request since 2020).
- **Decision:** Two-layer fix:
  1. **Profiles** (`fetchCachedProfile`): wrapped with `'use cache'` + `cacheLife('days')`. Company name, market cap, industry change very rarely; Next.js caches per-symbol automatically since `symbol` is a function argument. This eliminates all 25 profile calls on repeat visits.
  2. **Quotes** (`fetchQuote`): 30-second in-memory `Map` TTL so rapid refreshes reuse recent data. WebSocket takes over for live prices on the client anyway.
- **Why:** Demonstrates proper `'use cache'` usage (assignment rubric "strong" signal); cuts effective calls from 50 to 25 on first load, 0 profiles + 0–25 quotes on repeat loads. Enabled `cacheComponents: true` in `next.config.ts` as required by the directive.
- **Alternatives considered:** Hardcoding profile data in `lib/symbols.ts` (fast but stale and doesn't demonstrate caching); Finnhub symbol search endpoint (only returns name, no market cap, still per-symbol).
- **Side effect:** Homepage now renders as `◐ (Partial Prerender)` — static shell prerendered, dynamic Suspense hole streams quote data. Better than fully dynamic; user sees the page shell instantly.

### 2026-03-23 — URL-driven screener filters

- **Context:** Assignment requires ≥3 analyst-relevant filters, all reflected in URL query params, surviving hard refresh, with debounced text/range inputs.
- **Decision:** Three filters implemented client-side:
  1. **Daily % Change** (min/max range) — `pctMin` / `pctMax` query params. Momentum screening: "show me stocks up >3% today" or "down >2%." Data: computed `percentChange` already on `Stock`.
  2. **Market Cap tier** (multi-select categorical) — `cap` param, comma-separated. Tiers: Mega (>$200B), Large ($10–200B), Mid ($2–10B), Small (<$2B). Maps to real institutional fund mandates and risk profiles.
  3. **Sector / Industry** (multi-select) — `sector` param, comma-separated. Uses `finnhubIndustry` from profile data. Sector rotation is a core analyst strategy.
- **URL as state:** `useSearchParams()` is the single source of truth; no parallel `useState` for filter values. `router.replace()` (not `push`) avoids polluting browser history. Example: `/?pctMin=-2&cap=mega,large&sector=Technology`.
- **Debouncing:** Only numeric inputs (% change min/max) are debounced (300ms via `useRef` + `setTimeout`). Toggle buttons (cap tier, sector pills) update the URL immediately since there is no intermediate typing state.
- **Validation:** Zod schema in `lib/filters.ts` parses URL params with safe fallbacks — invalid or missing params silently default to "no constraint" rather than crashing.
- **Data model change:** Added `industry: string` to the `Stock` interface; `fetchStock()` now passes through `profile.finnhubIndustry`.
- **Why client-side filtering:** All 25 stocks are already loaded in memory. Server-side filtering would add a round-trip for zero benefit. Pure `Array.filter()` is instant.
- **Alternatives considered:** Price range filter (rejected — "arbitrary number range" per assignment guidance; not analytically meaningful without position context); P/E ratio (rejected — requires additional Finnhub API calls to basic financials endpoint, adding latency and rate-limit pressure for 25 more calls); volume filter (rejected — not in current `Stock` data without additional API calls or aggregating WebSocket tick volumes).
- **Follow-up:** Update DECISIONS.md section 4 with final implementation; check README feature checklist.

### 2026-03-23 — Stock detail view (`/stock/[symbol]`)

- **Context:** Assignment requires a stock detail view with a shareable URL, expanded information, and a documented rendering strategy independent of the main listing.
- **Decision:** Dedicated page at `/stock/[symbol]` (not modal/panel). Dynamic Server Component page with `'use cache'` on slow-changing fragments and Suspense boundaries per section.
- **Why a page:** High-density analytical content (6 sections) needs scroll space, deep focus, and a shareable URL. Panels feel constrained for this amount of data. Pages support browser back/forward navigation naturally.
- **Rendering strategy:** Dynamic page — stock prices change continuously, so static prerendering would be stale. Specific data fragments are cached:
  - **Profile** (`'use cache'` + `cacheLife('days')`) — name, HQ, IPO rarely change.
  - **Metrics** (`'use cache'` + `cacheLife('hours')`) — P/E, beta change daily at most.
  - **Recommendations** (`'use cache'` + `cacheLife('hours')`) — updated monthly.
  - **News** (30-min in-memory TTL) — changes throughout the day.
  - **Quote** (30s in-memory TTL, existing) — real-time via WebSocket after initial load.
- **Finnhub endpoints added:**
  - `/stock/metric?metric=all` — P/E, EPS, 52-wk range, beta, dividend yield, ROE, debt/equity.
  - `/company-news` — recent headlines (free tier, 7-day window).
  - `/stock/recommendation` — analyst buy/hold/sell consensus.
  - `/stock/candle` — OHLCV candles for charting (requires paid plan; graceful fallback on free tier).
- **Chart library:** `lightweight-charts` by TradingView (~45KB). Dynamically imported with `ssr: false` so it only loads on the detail page. Chosen over recharts/chart.js for purpose-built financial chart support.
- **Information architecture (6 sections):**
  1. **Header** — price, change, logo, day range bar, 52-week range bar (client, WS updates).
  2. **Price chart** — line chart with time range buttons 1D/1W/1M/3M/1Y, volume overlay (client).
  3. **Key metrics** — grouped by Valuation/Profitability/Risk/Dividends (server).
  4. **Company profile** — exchange, IPO date, country, website (server, cached).
  5. **Analyst recommendations** — stacked bar of strongBuy/buy/hold/sell/strongSell (server).
  6. **Recent news** — 8 headlines with source, timestamp, thumbnails (server).
- **Suspense:** Each section has its own `<Suspense>` boundary so all data fetches start in parallel (no waterfalls) and sections stream in independently.
- **Next.js 16:** `params` is a `Promise` — `await` in page and `generateMetadata`. Symbol validated against `STOCK_SYMBOLS`; unknown symbols trigger `notFound()`.
- **Alternatives considered:** Modal/panel (rejected — too constrained for analyst content); static generation with `generateStaticParams` (rejected — prices are live); single API route for all detail data (rejected — Suspense boundaries need independent fetches for streaming).

### 2026-03-23 — Market status & holiday indicators

- **Context:** Finnhub offers two free-tier endpoints — `/stock/market-status` (exchange session state: pre-market, regular, post-market, closed) and `/stock/market-holiday` (full calendar of upcoming exchange holidays including early-close days). Displaying this in the dashboard gives analysts immediate context about when the exchange is active.
- **Decision:** Added a header-level popover (`MarketStatusIndicator`) that shows:
  1. **Badge** — color-coded pill indicating current session (green pulsing dot = regular trading, amber = pre/post-market, grey = closed).
  2. **Popover** — click to expand with exchange, timezone, session, and the next 5 upcoming holidays with days-until countdown. Early-close days show trading hours.
- **Data strategy:**
  - **Market status** (`fetchMarketStatus`): 30-second in-memory TTL cache (same pattern as quote cache) since session transitions happen a few times per day. Client re-polls every 60s via `/api/market` route.
  - **Market holidays** (`fetchMarketHolidays`): `'use cache'` + `cacheLife('days')` since the exchange holiday calendar rarely changes. One Finnhub call cached across all visitors.
  - Both are fetched server-side in a `Suspense` boundary for initial SSR; the client component gracefully falls back to polling if the server-side fetch fails.
- **API cost:** 2 additional Finnhub calls on cold start (status + holidays), then holidays are cached for days and status is cached for 30s. Well within the 60/min rate limit.
- **Why a popover (not inline):** The information is contextual — analysts glance at the badge to confirm the market is open, then drill into the popover for details. Keeps the header clean while still surfacing holiday awareness (early closes catch people off guard).
- **Alternatives considered:** Toast/banner on market close (dismissed by users, not persistent); separate `/market` route (over-engineering for informational data); WebSocket-based status updates (no Finnhub WS endpoint for this).

### 2026-03-23 — Remove detail chart and detail-page WebSocket

- **Context:** Finnhub free-tier access does not provide reliable candle data for detail charting, and the detail page was opening a dedicated WebSocket only for header live ticks.
- **Decision:** Removed detail chart implementation and candles API route (`PriceChart` component + `/api/stock/[symbol]/candles`). Detail header now renders server-fetched snapshot data only (no detail-page WebSocket hook).
- **Why:** Keep detail experience stable on free tier, reduce unnecessary client reconnect behavior, and remove dead chart dependency (`lightweight-charts`).
- **Alternatives considered:** Keep chart with fallback empty state (rejected — still ships unused code and unavailable UX); poll quote endpoint on detail page (rejected — unnecessary API pressure for assignment scope).

### 2026-03-23 — Source dashboard symbols from Finnhub API

- **Context:** Dashboard was backed by a hardcoded `STOCK_SYMBOLS` list, while Finnhub exposes `/stock/symbol?exchange=US` for supported symbols.
- **Decision:** Replaced fixed list with `fetchUSStockSymbols()` + `fetchDashboardSymbols(limit)` in `lib/finnhub.ts`, cached daily (`'use cache'` + in-memory TTL). Home and `/api/stocks` now default to the first 25 API-backed symbols; `/api/stocks` also supports `limit` (1..50) and optional explicit `symbols`.
- **Why:** Keeps symbol universe API-driven, avoids hardcoded maintenance, and stays within free-tier constraints by preserving a bounded default set.
- **Alternatives considered:** Load all US symbols into dashboard (rejected — too many per-request quote/profile calls for free-tier rate limits); keep static list (rejected — stale and manual).

