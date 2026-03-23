# Architecture and product decisions

This document records **why** the stock screener is built the way it is—not a list of libraries. It is meant to support code review and a follow-up interview walkthrough.

**While developing:** Add a short entry to [DECISIONS_LOG.md](./DECISIONS_LOG.md) whenever you make a meaningful choice (stack, file layout, env vars, trade-offs). That file is the **working memory**; this file is the **curated summary**—update sections here when decisions are final or before submission.

---

## 1. Rendering and caching (Next.js 16)

**Baseline:** In Next.js 16, **dynamic execution is the default**. There is **no implicit `fetch` caching**; anything we cache must opt in with the **`'use cache'`** directive deliberately.

| Surface | Strategy | Rationale |
|---------|----------|-----------|
| Main screener (list + live prices) | **Dynamic** | Quotes and WebSocket-driven state change continuously; forcing static or stale cache would contradict “live” UX. |
| Stock detail | **Dynamic** with optional **cached** fragments | Core narrative: current context matters. Company **profile**-style fields (name, industry, description) change rarely; those can use **`'use cache'`** with a sensible scope/TTL so we do not hammer Finnhub for identical profile data on every navigation. Exact boundaries should match the implemented route split. |
| API route handlers | **Dynamic** | Proxies and LLM calls are request-scoped; no blanket caching unless explicitly marked. |

**Suspense:** Any route that waits on server data should use **Suspense** with a **skeleton** UI so the shell renders immediately and streaming/fallback behavior stays predictable.

**What we avoid:** Relying on “it used to revalidate” patterns from older Next versions without `'use cache'` or explicit cache APIs.

---

## 2. `proxy.ts` vs `middleware.ts`

Next.js 16 deprecates **`middleware.ts`** for the kind of network interception we need; request handling belongs in **`proxy.ts`**, which exports a **`proxy()`** function and runs on the **Node.js** runtime boundary.

**Decision:** Implement **rate limiting (30 requests per minute per IP)** and any other request interception in **`proxy.ts`**, not in `middleware.ts`.

**Why it matters:** Keeps behavior aligned with the framework’s supported interception model for this version and avoids shipping a solution evaluators flag as a red flag.

---

## 3. Real-time architecture (WebSocket)

**Source:** Finnhub WebSocket (`wss://ws.finnhub.io`) for **live** prices; the brief requires updates **without** full page reload and discourages **polling** as the primary mechanism.

**Client ownership:** WebSocket connection and subscription state live in the **client** (e.g. a dedicated hook or client component), because browsers own WebSocket APIs and the feed is session-scoped.

**Lifecycle:** On mount: connect and subscribe to the watched symbols. On unmount: unsubscribe and **close** the socket to avoid leaks. On **disconnect**: exponential backoff (capped) **reconnection** with a maximum retry policy so a bad network does not spin forever.

**Smooth UI:** Naively calling `setState` on every tick can **jank** the main thread. We commit updates on a **throttled** schedule (250ms batching via `setTimeout`) so multiple ticks collapse into one paint when the event loop is busy.

**Disconnect UX:** The hook exposes a `ConnectionStatus` (`connected`, `connecting`, `reconnecting`, `disconnected`) rendered as a visible badge next to the table. When the WebSocket is down, a **Fetch Latest Prices** button lets the user pull fresh REST data on demand so stale prices never go unnoticed.

---

## 4. Filters (URL-driven, analyst-relevant)

**Requirement:** At least **three** filters that an analyst would actually use, with **financial** justification—not arbitrary min/max fields.

**Implemented trio:**

1. **Daily % change** (min / max) — Momentum screening. `pctMin` and `pctMax` query params. "Show me stocks up >3%" catches breakout candidates; "down >2%" catches mean-reversion plays. Uses the already-computed `percentChange` field on `Stock`.
2. **Market capitalization** (categorical tiers) — `cap` query param, comma-separated tier names. Four tiers matching institutional fund mandates: Mega (>$200B), Large ($10–200B), Mid ($2–10B), Small (<$2B). UI is toggle buttons rather than range sliders because these are categorical buckets, not continuous ranges.
3. **Sector / Industry** (multi-select) — `sector` query param, comma-separated. Uses `finnhubIndustry` from the profile data we already fetch and cache. Sector rotation is a core analyst strategy; filtering by sector lets analysts focus on specific macro exposures.

**Why not P/E or volume?** P/E requires an additional Finnhub endpoint (`/stock/metric`) per symbol—25 more API calls on a 60/min rate limit. Volume would require aggregating WebSocket tick data or another API call. Both were rejected in favor of industry/sector, which is already available from the cached profile data at zero additional API cost.

**URL as state:** All active filters are reflected in **query parameters** so a filtered view is **shareable** and **restores after a hard refresh**. Example: `/?pctMin=-2&cap=mega,large&sector=Technology`. Implementation uses **`useSearchParams`** as the single source of truth—no parallel `useState` that could diverge. URL updates use **`router.replace()`** (not `push`) so filter toggles don't pollute browser history.

**Debouncing:** Only the % change text inputs debounce (300ms via `useRef` + `setTimeout`). Toggle buttons (cap tier, sector) update immediately since there is no intermediate typing state.

**Validation:** Zod schema in `lib/filters.ts` parses URL params with safe fallbacks. Invalid or absent params silently default to "no constraint"—the app never crashes on a malformed URL.

**Client-side only:** All 25 stocks are loaded at once; filtering is a pure `Array.filter()` call. Server-side filtering would add a round-trip for no benefit.

| File | Role |
|------|------|
| [`lib/filters.ts`](./lib/filters.ts) | Types, Zod schema, `applyFilters()`, `getCapTier()` |
| [`hooks/useStockFilters.ts`](./hooks/useStockFilters.ts) | URL ↔ filter state bridge, debounce, `clearFilters` |
| [`components/FilterBar.tsx`](./components/FilterBar.tsx) | UI: number inputs, cap-tier toggles, sector pills, clear button |

---

## 5. Stock detail view

**Route:** `/stock/[symbol]` — a dedicated page (not a modal or panel).

**Why a page:** The detail view contains high-density analyst context (header, metrics, profile, analyst recommendations, news) — too much for a panel. A page supports:
- Shareable URLs: `/stock/AAPL` can be sent directly to colleagues.
- Deep focus: analysts examining a stock need an uncluttered workspace.
- Independent rendering strategy from the screener listing.
- Browser back/forward navigation.

**Rendering strategy:** Dynamic Server Component page — **independent from the main listing** (which is also dynamic but for different reasons). Each section is wrapped in its own `<Suspense>` boundary; all data fetches start in parallel with no waterfalls.

| Data | Strategy | Rationale |
|------|----------|-----------|
| Quote (price, change) | Dynamic (30s TTL snapshot) | Detail page uses server-fetched context; live ticks are reserved for screener table |
| Company profile | `'use cache'` + `cacheLife('days')` | Name, HQ, IPO date change almost never |
| Basic financials (metrics) | `'use cache'` + `cacheLife('hours')` | P/E, EPS, beta change daily at most |
| Analyst recommendations | `'use cache'` + `cacheLife('hours')` | Updated monthly by analysts |
| Company news | 30-min in-memory TTL | Changes throughout the day |

**Why not `generateStaticParams`?** Stock data is live. Pre-rendering 25 pages would show stale prices. The page is dynamic; only specific data fragments are cached per the table above.

**Information architecture — what an analyst sees:**

1. **Header (Decision Snapshot):** Logo, ticker, price with $ and % change, exchange, market cap, day range bar, 52-week range bar.
2. **Key Metrics:** Grouped by Valuation (P/E, P/B, EPS), Profitability (ROE, Net Margin, Revenue/Share), Risk (Beta, Debt/Equity), Dividends (Yield).
3. **Company Profile:** Exchange, currency, country, IPO date, website.
4. **Analyst Recommendations:** Horizontal stacked bar of strongBuy/buy/hold/sell/strongSell with color coding.
5. **Recent News:** Latest 8 headlines with source, relative timestamp, thumbnails, external links.

| File | Role |
|------|------|
| [`app/stock/[symbol]/page.tsx`](./app/stock/[symbol]/page.tsx) | Server Component orchestrator with parallel Suspense |
| [`app/stock/[symbol]/loading.tsx`](./app/stock/[symbol]/loading.tsx) | Full-page skeleton |
| [`app/stock/[symbol]/error.tsx`](./app/stock/[symbol]/error.tsx) | Error boundary with retry |
| [`app/stock/[symbol]/not-found.tsx`](./app/stock/[symbol]/not-found.tsx) | Unknown symbol 404 |
| [`components/stock-detail/`](./components/stock-detail/) | Header, metrics, profile, recommendations, news |

---

## 6. AI-powered insight (`/api/insight`)

**Behavior:** Short **2–3 sentence** analyst-style commentary based on structured inputs (quote + key metrics we send server-side).

**Streaming:** The route returns a **`ReadableStream`** so tokens **stream** into the UI; a single blob after a long wait does not meet the bar.

**Caching:** Cache generated insights **per symbol** (and optionally a **time bucket** or version key) so repeat clicks do not re-call the LLM every time. **Invalidation:** document TTL or “new session” policy in code comments and [API.md](./API.md); optional manual refresh if product needs it.

**Failure isolation:** If the LLM fails, show an **inline error** on the insight control only; the **screener list and WebSocket feed** keep working.

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

Examples of defensible **non-goals** for a 4–5 hour slice:

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
| Stock table (client) | [`components/StockTable.tsx`](./components/StockTable.tsx) — 25 tickers, live WS prices, manual refresh | Done |
| WebSocket hook | [`hooks/useFinnhubWebSocket.ts`](./hooks/useFinnhubWebSocket.ts) — connect, reconnect, throttled flush, cleanup | Done |
| Connection indicator | [`components/ConnectionStatus.tsx`](./components/ConnectionStatus.tsx) — Live / Reconnecting / Disconnected badge | Done |
| API route | [`app/api/stocks/route.ts`](./app/api/stocks/route.ts) — Zod-validated, normalized Finnhub REST proxy | Done |
| Rate limiting | [`proxy.ts`](./proxy.ts) — 30 req/min/IP, in-memory map, matcher `/api/:path*` | Done |
| React Compiler | [`next.config.ts`](./next.config.ts) — `reactCompiler: true` | Done |
| Shared lib | [`lib/types.ts`](./lib/types.ts), [`lib/finnhub.ts`](./lib/finnhub.ts), [`lib/format.ts`](./lib/format.ts) | Done |
| Dependencies | Next **16.2.1**, React **19.2.4**, Tailwind **4**, **zod**, **babel-plugin-react-compiler** | Done |

| URL-driven filters | [`lib/filters.ts`](./lib/filters.ts), [`hooks/useStockFilters.ts`](./hooks/useStockFilters.ts), [`components/FilterBar.tsx`](./components/FilterBar.tsx) | Done |
| Industry in Stock | [`lib/types.ts`](./lib/types.ts), [`lib/finnhub.ts`](./lib/finnhub.ts) — `industry` field added | Done |

**Phase 2 complete**

| Item | Path / version | Status |
|------|----------------|--------|
| Stock detail page | [`app/stock/[symbol]/page.tsx`](./app/stock/[symbol]/page.tsx) — dynamic route, `generateMetadata`, Suspense per section | Done |
| Detail loading/error/404 | [`loading.tsx`](./app/stock/[symbol]/loading.tsx), [`error.tsx`](./app/stock/[symbol]/error.tsx), [`not-found.tsx`](./app/stock/[symbol]/not-found.tsx) | Done |
| Detail header | [`StockDetailHeader.tsx`](./components/stock-detail/StockDetailHeader.tsx) — price snapshot, day/52wk range bars | Done |
| Key metrics (server) | [`KeyMetrics.tsx`](./components/stock-detail/KeyMetrics.tsx) — P/E, EPS, beta, ROE, D/E grouped by category | Done |
| Company profile (server) | [`CompanyProfile.tsx`](./components/stock-detail/CompanyProfile.tsx) — exchange, IPO, country, website | Done |
| Analyst recommendations (server) | [`AnalystRecommendations.tsx`](./components/stock-detail/AnalystRecommendations.tsx) — stacked bar chart | Done |
| News section (server) | [`NewsSection.tsx`](./components/stock-detail/NewsSection.tsx) — 8 headlines with thumbnails | Done |
| Screener row links | [`StockTable.tsx`](./components/StockTable.tsx) — symbol/name link to `/stock/[symbol]` | Done |
| Finnhub fetchers | [`lib/finnhub.ts`](./lib/finnhub.ts) — `fetchBasicFinancials`, `fetchCompanyNews`, `fetchRecommendationTrends`, `fetchStockDetail` | Done |

**Still to do (later phases):** `/api/insight` streaming, bundle analyzer.
