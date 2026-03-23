# Architecture and product decisions

This document records **why** the stock screener is built the way it is—not a list of libraries. It is meant to support code review and a follow-up interview walkthrough.

**While developing:** Add a short entry to [DECISIONS_LOG.md](./DECISIONS_LOG.md) whenever you make a meaningful choice (stack, file layout, env vars, trade-offs). That file is the **working memory**; this file is the **curated summary**—update sections here when decisions are final or before submission.

---

## 1. Dashboard loading (batching + caching + rendering UX)
**Context (why this matters):** The dashboard must show multiple tickers quickly while still respecting Finnhub free-tier behavior and the app’s own request interception rate limit (`proxy.ts`: 30 req/min/IP). A naive "fetch everything at once" approach creates an N+1 pattern (quote + profile + metrics per symbol) and turns refresh/load into a slow experience that can hit throttling.

**Decision: progressive SSR snapshot + batched client expansion.**

### Server initial render: fast shell first
`app/page.tsx` renders the page with **Suspense**:
- `StockTableSkeleton` is shown while the first server fetch completes.
- `StockData` is a Server Component that loads only an initial slice: `fetchAllStocks(STOCK_SYMBOLS.slice(0, 5))` and passes the results into the client component `StockTable`.

This keeps perceived performance high: users see rows immediately instead of waiting for the entire universe to be fetched.

### Client expansion: batching + delay to stay under rate limits
`components/StockTable.tsx` incrementally loads the remaining allowlisted symbols after mount:
- **Initial slice:** 5 symbols (from the server)
- **Batch size:** 5 symbols per request
- **Inter-batch delay:** ~900ms between batches
- **Retries:** up to 3 attempts per batch via `fetchStocksCoreWithRetries()`

Requests are made to `GET /api/stocks?symbols=...` and merged into existing state by symbol. The batching is intentional: it reduces burst pressure and avoids a "thundering herd" of Finnhub calls that would otherwise trip the fixed-window rate limiter.

### Backend concurrency: limit server-side fan-out too
Even after we batch on the client, the server must avoid unbounded parallelism. In `lib/finnhub.ts`:
- `fetchAllStocks()` uses `CONCURRENCY = 3`
- It processes symbols in small batches and calls `fetchStock()` for each symbol with `Promise.allSettled()`

So both layers (client and server) independently cap concurrency and reduce the chance of throttling or long tail response times.

---
### Finnhub calls per symbol (what we actually fetched)
Each symbol goes through `fetchStock(symbol)` in `lib/finnhub.ts`, which composes data from these Finnhub endpoints:
- **Quote:** `/quote` (via `fetchQuote`)
- **Profile:** `/stock/profile2` (via `fetchCachedProfile`)
- **Basic financial metrics:** `/stock/metric?metric=all` (via `fetchBasicFinancials`, best-effort)

The normalized dashboard `Stock` includes computed fields:
- `percentChange` and day range values come from the Finnhub quote payload
- `fiftyTwoWeekHigh` / `fiftyTwoWeekLow` come from the `metric["52WeekHigh"]` / `metric["52WeekLow"]` values
- `priceVs52wHigh` is computed relative to the 52-week high

Because `fetchBasicFinancials` is optional (`fetchBasicFinancials(symbol).catch(() => null)`), 52-week fields can be `null` when Finnhub metric data is unavailable; the UI handles `null` as `—`.

---
### Caching behavior (what we cache, what we don’t, and why)
The dashboard intentionally does **not** try to fully cache "today’s quotes" server-side, because:
- quotes are intraday and continuously updated by WebSocket
- stale quote responses make the "live" dashboard feel incorrect

Instead, we use caching as a **rate-limit and UX stabilizer** for slowly changing or burst-sensitive pieces:

### Quote caching (short TTL)
- `fetchQuote()` stores quotes in an in-memory `Map` for **30 seconds**
- This absorbs rapid refreshes and keeps initial snapshots cheap
- Quote caching is short to avoid noticeable staleness between refreshes

### Profile caching (days-level)
- `fetchCachedProfile()` uses:
  - an in-memory TTL (`PROFILE_TTL_MS = 24h`)
  - and Next.js cache opt-in (`"use cache"` + `cacheLife("days")`)
- Rationale: name/industry/market cap type fields change rarely, but they would be expensive to refetch on every navigation/refresh.

### Metrics caching (hours-level via Next cache)
- `fetchBasicFinancials()` is wrapped with `"use cache"` and `cacheLife("hours")`
- Rationale: valuation/risk metrics used for the dashboard bars and 52-week comparisons generally shift at most daily after close (acceptable to refresh on an hourly cadence for a POC).

---
### Rendering strategy and component structure (simple on purpose)
The dashboard is split into a small set of roles to keep rendering predictable:
- `app/page.tsx`: Server Components that fetch initial data and wrap each data-dependent region in Suspense.
- `components/StockTableSkeleton.tsx`: skeleton rows so the table doesn’t "pop in" late.
- `components/StockTable.tsx`: one client component that owns:
  - incremental batched loading via `/api/stocks`
  - live updates via `useFinnhubWebSocket`
  - local sorting/merging and flashing rows for UX feedback
- `components/ConnectionStatus.tsx`: displays WebSocket connection state.

---
### Real-time state handoff (WebSocket + throttled state updates)
Once initial rows exist, the dashboard uses Finnhub WebSocket for continuous prices:
- `useFinnhubWebSocket` buffers tick updates in a `pendingUpdates` map
- It flushes updates to React at **250ms** intervals (`THROTTLE_MS = 250`) to reduce render/jank overhead
- On reconnect, it uses exponential backoff with a capped attempt count

`StockTable` applies updates by recomputing:
- `change`, `percentChange`, and `priceVs52wHigh` from the new live price while keeping cached 52-week values

This design preserves analytical context (52-week metrics) while still delivering the "live" feel for quotes.

---
### Cuts / trade-offs (intentional for time)
- We **did not** fetch all 25 symbols fully on first server render. Loading the remaining universe happens incrementally in the client to avoid slow initial paint and avoid hitting the rate limiter.
- We prioritized a stable UX and clear batching behavior over more complex adaptive scheduling (e.g., dynamic concurrency based on observed throttling). That can be revisited if the POC becomes a production tool.

---

## 2. `proxy.ts` vs `middleware.ts`

Next.js 16 deprecates **`middleware.ts`** for the kind of network interception we need; request handling belongs in **`proxy.ts`**, which exports a **`proxy()`** function and runs on the **Node.js** runtime boundary.

**Decision:** Implement **rate limiting (30 requests per minute per IP)** and any other request interception in **`proxy.ts`**, not in `middleware.ts`.

**Why it matters:** Keeps behavior aligned with the framework's supported interception model for this version and avoids shipping a solution evaluators flag as a red flag.

---

## 3. Real-time architecture (WebSocket)

**Source:** Finnhub WebSocket (`wss://ws.finnhub.io`) for **live** prices; the brief requires updates **without** full page reload and discourages **polling** as the primary mechanism.

**Client ownership:** WebSocket connection and subscription state live in the **client** (e.g. a dedicated hook or client component), because browsers own WebSocket APIs and the feed is session-scoped.

**Lifecycle:** On mount: connect and subscribe to the watched symbols. On unmount: unsubscribe and **close** the socket to avoid leaks. On **disconnect**: exponential backoff (capped) **reconnection** with a maximum retry policy so a bad network does not spin forever.

**Smooth UI:** Naively calling `setState` on every tick can **jank** the main thread. We commit updates on a **throttled** schedule (250ms batching via `setTimeout`) so multiple ticks collapse into one paint when the event loop is busy.

**Disconnect UX:** The hook exposes a `ConnectionStatus` (`connected`, `connecting`, `reconnecting`, `disconnected`) rendered as a visible badge next to the table. When the WebSocket is down, a **Fetch Latest Prices** button lets the user pull fresh REST data on demand so stale prices never go unnoticed.

---

## 4. Filters (URL-driven, analyst-relevant)

**Requirement:** At least **three** filters that an analyst would actually use, with financial justification and URL persistence.

**Decision:** We selected three filters that are high-signal for screening while staying within free-tier API constraints and keeping interactions fast on the client.

### 1) Daily % Change (`pctMin`, `pctMax`)
- **What it is:** Numeric min/max filter on `percentChange`.
- **Why we chose it:** It is the fastest momentum lens ("show me leaders/laggards today") and directly supports both breakout and mean-reversion workflows.
- **Why it is cheap:** `percentChange` is already available in the loaded stock payload; no additional API calls needed.

### 2) Market Cap tier (`cap`)
- **What it is:** Multi-select categorical tiers: `mega`, `large`, `mid`, `small`.
- **Why we chose it:** Market cap is a core institutional segmentation axis (liquidity, volatility profile, mandate fit).
- **Why categorical instead of slider:** Analysts typically think in tier buckets, not continuous cap ranges, so toggles are quicker and clearer.

### 3) Sector/Industry (`sector`)
- **What it is:** Multi-select filter from `stock.industry` values.
- **Why we chose it:** Sector rotation and thematic concentration are central to macro-aware screening.
- **Why it is cheap:** Industry is already present from profile data; no extra endpoint calls.

### Why we did not choose other filters (for this POC)
- **P/E as a top-level dashboard filter:** rejected because it would add expensive per-symbol metric pressure if treated as always-on filter data in a larger universe.
- **Volume/technical indicators:** rejected because they would require additional market data pipelines and increase complexity for limited interview-time value.
- **Arbitrary price range slider:** rejected because raw price alone is less decision-useful than % move, cap tier, and sector context.

### URL-driven behavior (shareable and refresh-safe)
All active filters are encoded in query parameters so a screen can be copied, bookmarked, and restored after refresh.

Example:
- `/?pctMin=-2&cap=mega,large&sector=Technology`

Implementation choices:
- `useSearchParams()` is treated as the source of truth.
- URL updates use `router.replace()` (not `push`) to avoid polluting browser history while users type/toggle.
- Parsing/serialization lives in `lib/filters.ts` for a single canonical format.

### Debounce and interaction model
- % change numeric fields debounce at 300ms to avoid URL churn during typing.
- Tier and sector toggles apply immediately because they are discrete, low-frequency interactions.

### Validation and safety
- Zod schema in `lib/filters.ts` validates `pctMin`, `pctMax`, `cap`, and `sector`.
- Invalid or malformed query params fall back to no-op defaults instead of throwing.

### Real-time state handling with filters
Filtering is client-side (`applyFilters`) over in-memory rows, while WebSocket updates continue to mutate the same stock objects. This means active filters remain applied naturally as prices change in real time.

### Trade-offs and revisit points
- Client-side filtering is ideal for a 25-symbol dashboard; if universe size grows, server-side filtering/pagination would be revisited.
- Sector labels currently reflect upstream `industry` naming; future normalization/mapping can improve consistency across equivalent labels.
- We kept filter count intentionally small to preserve clarity and speed in a time-boxed POC.

| File | Role |
|------|------|
| [`lib/filters.ts`](./lib/filters.ts) | Types, Zod schema, `applyFilters()`, `getCapTier()` |
| [`hooks/useStockFilters.ts`](./hooks/useStockFilters.ts) | URL <-> filter state bridge, debounce, `clearFilters` |
| [`components/FilterBar.tsx`](./components/FilterBar.tsx) | UI: number inputs, cap-tier toggles, sector pills, clear button |

---

## 5. Stock detail view

**Route:** `/stock/[symbol]` — a dedicated page (not a modal or panel).

**Why a page:** The detail view contains high-density analyst context (header, metrics, profile, analyst recommendations, news) — too much for a panel. A page supports:
- Shareable URLs: `/stock/AAPL` can be sent directly to colleagues.
- Deep focus: analysts examining a stock need an uncluttered workspace.
- Independent rendering strategy from the screener listing.
- Browser back/forward navigation.

**Rendering strategy:** Dynamic Server Component page with section-level Suspense boundaries. We intentionally keep this route separate from dashboard real-time behavior: detail starts from a server snapshot and focuses on richer context over continuous ticks.

| Data | Strategy | Rationale |
|------|----------|-----------|
| Quote + detail header fields | Dynamic with short in-memory TTL (`fetchQuote`) | Gives fresh price context without running a detail-page WebSocket |
| Company profile | `'use cache'` + `cacheLife('days')` + in-memory profile TTL | Profile and business identity data changes slowly |
| Basic financials (metrics) | `'use cache'` + `cacheLife('hours')` | Ratios/fundamental metrics update slowly relative to intraday prices |
| Analyst recommendations | `'use cache'` + `cacheLife('hours')` | Recommendation trends change on analyst cadence, not per tick |
| Company news | 30-minute in-memory TTL | Needs freshness, but can still tolerate short cache window |

**Why not `generateStaticParams`?** Pre-rendering would freeze live price context. We keep the page dynamic and cache only slow-changing fragments.

### Finnhub APIs used on detail and what we display

1. **`/quote` + `/stock/profile2` (via `fetchStockDetail`)**
   - Displayed in `StockDetailHeader`: current price, change, % change, day range, open, previous close, market cap, exchange, currency, company identity (name/logo/industry).
   - **Why it matters:** first-glance decision framing. Analysts need immediate "what is happening now?" plus company context before reading deeper metrics.

2. **`/stock/metric?metric=all` (via `fetchBasicFinancials`)**
   - Displayed in `KeyMetrics` and used in header 52-week range.
   - Metrics shown include valuation (P/E, P/B, EPS), profitability (ROE, net margin, revenue/share), risk (beta, debt/equity), and dividends (yield).
   - **Why it matters:** these metrics are core for comparing quality, valuation, and risk profile before taking or rejecting a position.

3. **`/stock/recommendation` (via `fetchRecommendationTrends`)**
   - Displayed as `AnalystRecommendations` stacked distribution (strong buy -> strong sell).
   - **Why it matters:** consensus positioning adds market-sentiment context and can validate or challenge a contrarian thesis.

4. **`/company-news` (via `fetchCompanyNews`)**
   - Displayed as latest 8 stories with source and relative time in `NewsSection`.
   - **Why it matters:** headline flow explains abrupt moves and helps analysts connect price action to catalysts.

### Information architecture — what an analyst sees on the page

1. **Header (Decision Snapshot):** Logo, ticker, price with $ and % change, exchange, market cap, day range bar, 52-week range bar.
2. **Key Metrics:** Grouped by Valuation (P/E, P/B, EPS), Profitability (ROE, Net Margin, Revenue/Share), Risk (Beta, Debt/Equity), Dividends (Yield).
3. **Company Profile:** Exchange, currency, country, IPO date, website.
4. **Analyst Recommendations:** Horizontal stacked bar of strongBuy/buy/hold/sell/strongSell with color coding.
5. **Recent News:** Latest 8 headlines with source, relative timestamp, thumbnails, external links.

### Trade-offs and scope cuts

- We removed the chart/candles path from the detail experience for this POC because free-tier candle reliability and added complexity were not worth the risk to UX stability.
- We also removed a dedicated detail-page WebSocket; detail is now a high-quality snapshot page while the dashboard remains the true live surface.
- This trade-off favors consistency and clarity during interviews and demos. If revisited later, charting + selective live updates can be reintroduced behind capability checks.

| File | Role |
|------|------|
| [`app/stock/[symbol]/page.tsx`](./app/stock/[symbol]/page.tsx) | Server Component orchestrator with parallel Suspense |
| [`app/stock/[symbol]/loading.tsx`](./app/stock/[symbol]/loading.tsx) | Full-page skeleton |
| [`app/stock/[symbol]/error.tsx`](./app/stock/[symbol]/error.tsx) | Error boundary with retry |
| [`app/stock/[symbol]/not-found.tsx`](./app/stock/[symbol]/not-found.tsx) | Unknown symbol 404 |
| [`components/stock-detail/`](./components/stock-detail/) | Header, metrics, profile, recommendations, news |

---

## 6. AI-powered insight (`/api/insight`)

**Behavior:** Short **2-3 sentence** analyst-style commentary based on structured inputs (quote + key metrics sent from the client). Uses OpenAI `gpt-4o-mini` via the `openai` SDK.

**Streaming:** The route returns `new Response(readableStream)` with `Content-Type: text/plain; charset=utf-8`. For cache misses, tokens from `openai.chat.completions.create({ stream: true })` are piped through a `ReadableStream` -- the client reads via `response.body.getReader()` + `TextDecoder` and updates state on each chunk. For cache hits, the full text is enqueued in a single chunk (same API, instant delivery).

**Caching (two layers):**

| Layer | Storage | Key | TTL | Rationale |
|-------|---------|-----|-----|-----------|
| Server | In-memory `Map` in `lib/insight-cache.ts` | Symbol (uppercase) | 1 hour | Stock context shifts intraday; hourly refresh balances freshness vs LLM cost. Does not survive restarts or scale across processes -- acceptable for single-instance demo, would need Redis in production. |
| Client | Module-level `Map` in `hooks/useInsight.ts` | Symbol (uppercase) | Session lifetime | Avoids network round-trip when re-opening the modal for the same stock. Cleared naturally on page navigation. |

**Failure isolation:** `useInsight` catches all errors and exposes them via `error` state -- errors are never thrown to crash parent components. The modal renders in a `createPortal` to `document.body`, so no error from the AI path can propagate to `StockTable`, `StockDetailHeader`, or any Suspense boundary. Missing `OPENAI_API_KEY` returns 500; OpenAI API failure returns 502; both as JSON so the client can parse cleanly.

**UI:** `InsightModal` (portal-based, accessible) shows streaming text with a blinking cursor, skeleton loading before the first token, inline error with retry button, and an "AI-generated" disclaimer.

| File | Role |
|------|------|
| [`lib/insight-cache.ts`](./lib/insight-cache.ts) | Server-side in-memory cache (get/set with TTL) |
| [`app/api/insight/route.ts`](./app/api/insight/route.ts) | POST route handler: Zod validation, cache check, OpenAI streaming, ReadableStream response |
| [`hooks/useInsight.ts`](./hooks/useInsight.ts) | Client hook: fetch + getReader, client cache, error isolation |
| [`components/InsightModal.tsx`](./components/InsightModal.tsx) | Portal modal with streaming display |
| [`components/stock-detail/InsightButton.tsx`](./components/stock-detail/InsightButton.tsx) | Client button for detail page header |

---

## 7. API layer (Finnhub proxy)

**Single typed boundary:** A Next.js **route handler** proxies Finnhub REST calls so the **browser never holds** the Finnhub API key.

**Normalization:** Responses are **normalized** to stable field names, **computed** fields added where useful (e.g. `percentChange`, distance from **52-week** range), and **unused** Finnhub fields stripped before JSON to the client.

**Validation:** **Zod** (or equivalent) on **all** query parameters for proxy routes.

**Documentation:** Every exported endpoint is described in [API.md](./API.md) (params, shape, caching).

---

## 8. Rate limiting

**Rule:** **30 requests per minute per IP** in **`proxy.ts`**, backed by an **in-memory** map.

**Production limitations (explicit):** In-memory limits **do not** share state across **multiple** Node processes or regions; **restarts** reset counts; **client IP** may be wrong behind certain proxies unless `x-forwarded-for` is handled carefully. For real production, a shared store (Redis) and consistent edge configuration would be required.

---

## 9. Scope and intentional cuts (time-boxing)

Examples of defensible **non-goals** for a 4-5 hour slice:

- **No user accounts / auth** — Screeners are often single-session tools unless required.
- **No full portfolio or order flow** — Out of scope for a screening MVP.
- **No alternate data or news sentiment** — Unless time allows a thin link-out.

**Principle:** A **clearly explained** omission beats a **half-finished** feature.

---

## 10. React Compiler

**Decision:** Enable the **React Compiler** in `next.config.ts` so automatic memoization reduces the need for manual `React.memo` / `useMemo`.

**Exception policy:** If manual memoization is added, include a **short inline comment** explaining why the compiler is insufficient for that case.

---

## Implementation status (sync with repo)

**Phase 1 complete**

| Item | Path / version | Status |
|------|----------------|--------|
| App shell | [`app/layout.tsx`](./app/layout.tsx), [`app/page.tsx`](./app/page.tsx) | Done |
| Homepage screener | [`app/page.tsx`](./app/page.tsx) with `<Suspense>` + [`StockTableSkeleton`](./components/StockTableSkeleton.tsx) | Done |
| Stock table (client) | [`components/StockTable.tsx`](./components/StockTable.tsx) -- 25 tickers, live WS prices, manual refresh | Done |
| WebSocket hook | [`hooks/useFinnhubWebSocket.ts`](./hooks/useFinnhubWebSocket.ts) -- connect, reconnect, throttled flush, cleanup | Done |
| Connection indicator | [`components/ConnectionStatus.tsx`](./components/ConnectionStatus.tsx) -- Live / Reconnecting / Disconnected badge | Done |
| API route | [`app/api/stocks/route.ts`](./app/api/stocks/route.ts) -- Zod-validated, normalized Finnhub REST proxy | Done |
| Rate limiting | [`proxy.ts`](./proxy.ts) -- 30 req/min/IP, in-memory map, matcher `/api/:path*` | Done |
| React Compiler | [`next.config.ts`](./next.config.ts) -- `reactCompiler: true` | Done |
| Shared lib | [`lib/types.ts`](./lib/types.ts), [`lib/finnhub.ts`](./lib/finnhub.ts), [`lib/format.ts`](./lib/format.ts) | Done |
| Dependencies | Next **16.2.1**, React **19.2.4**, Tailwind **4**, **zod**, **babel-plugin-react-compiler** | Done |

| URL-driven filters | [`lib/filters.ts`](./lib/filters.ts), [`hooks/useStockFilters.ts`](./hooks/useStockFilters.ts), [`components/FilterBar.tsx`](./components/FilterBar.tsx) | Done |
| Industry in Stock | [`lib/types.ts`](./lib/types.ts), [`lib/finnhub.ts`](./lib/finnhub.ts) -- `industry` field added | Done |

**Phase 2 complete**

| Item | Path / version | Status |
|------|----------------|--------|
| Stock detail page | [`app/stock/[symbol]/page.tsx`](./app/stock/[symbol]/page.tsx) -- dynamic route, `generateMetadata`, Suspense per section | Done |
| Detail loading/error/404 | [`loading.tsx`](./app/stock/[symbol]/loading.tsx), [`error.tsx`](./app/stock/[symbol]/error.tsx), [`not-found.tsx`](./app/stock/[symbol]/not-found.tsx) | Done |
| Detail header | [`StockDetailHeader.tsx`](./components/stock-detail/StockDetailHeader.tsx) -- price snapshot, day/52wk range bars | Done |
| Key metrics (server) | [`KeyMetrics.tsx`](./components/stock-detail/KeyMetrics.tsx) -- P/E, EPS, beta, ROE, D/E grouped by category | Done |
| Company profile (server) | [`CompanyProfile.tsx`](./components/stock-detail/CompanyProfile.tsx) -- exchange, IPO, country, website | Done |
| Analyst recommendations (server) | [`AnalystRecommendations.tsx`](./components/stock-detail/AnalystRecommendations.tsx) -- stacked bar chart | Done |
| News section (server) | [`NewsSection.tsx`](./components/stock-detail/NewsSection.tsx) -- 8 headlines with thumbnails | Done |
| Screener row links | [`StockTable.tsx`](./components/StockTable.tsx) -- symbol/name link to `/stock/[symbol]` | Done |
| Finnhub fetchers | [`lib/finnhub.ts`](./lib/finnhub.ts) -- `fetchBasicFinancials`, `fetchCompanyNews`, `fetchRecommendationTrends`, `fetchStockDetail` | Done |

**Phase 3 complete**

| Item | Path / version | Status |
|------|----------------|--------|
| AI insight API | [`app/api/insight/route.ts`](./app/api/insight/route.ts) -- POST, Zod, OpenAI streaming, ReadableStream, cache | Done |
| Insight cache | [`lib/insight-cache.ts`](./lib/insight-cache.ts) -- in-memory Map, 1h TTL | Done |
| Insight hook | [`hooks/useInsight.ts`](./hooks/useInsight.ts) -- streaming consumer, client cache, error isolation | Done |
| Insight modal | [`components/InsightModal.tsx`](./components/InsightModal.tsx) -- portal, streaming text, accessibility | Done |
| Dashboard AI button | [`components/StockTable.tsx`](./components/StockTable.tsx) -- sparkle icon column per row | Done |
| Detail AI button | [`components/stock-detail/InsightButton.tsx`](./components/stock-detail/InsightButton.tsx) + [`StockDetailHeader.tsx`](./components/stock-detail/StockDetailHeader.tsx) | Done |

**Still to do (later phases):** bundle analyzer.
