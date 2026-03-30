# Stock Screener — Project Architecture

Last updated: 2026-03-30

Real-time stock screener built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, Finnhub API (REST + WebSocket), and OpenAI GPT-4o-mini.

---

## Rendering Strategy

### `/` — Homepage (ISR, 55-second revalidation)

Both server-side data functions use the `'use cache'` directive with a custom `cacheLife`:

```ts
'use cache';
cacheLife({ revalidate: 55, stale: 55, expire: 60 });
```

**Cache HIT** (request arrives within 55s of last revalidation):
- Next.js serves the cached RSC payload from the Data Cache instantly.
- Zero Finnhub API calls. Zero server computation.
- All concurrent users within that 55s window share the same single cached response — 1 fetch serves N visitors.

**Cache MISS / background revalidation** (first request after 55s):
- Next.js serves the stale cached payload to the current requester (no wait).
- Triggers a background revalidation: fetches 25 fresh quotes (concurrency=3) plus any expired cached data.
- Next requester gets the fresh payload.

**What runs on revalidation:**
- `fetchAllStocks(STOCK_SYMBOLS)` — all 25 symbols, delivering a complete `Stock[]` to `StockTable`
  - `fetchQuote(symbol)` × 25 — always fresh, no cache (live prices)
  - `fetchCachedProfile(symbol)` × 25 — served from `'use cache'` (days TTL), no Finnhub hit
  - `fetchBasicFinancials(symbol)` × 25 — served from `'use cache'` (hours TTL), no Finnhub hit

`MarketStatusData` is **not** ISR-cached at the component level — it runs fresh on every request. The underlying `fetchMarketHolidays` is cached at the function level (`'use cache'`, days TTL). `fetchMarketStatus` is always fresh. Client-side polling in `MarketStatusIndicator` (every 60s) already keeps the indicator live — component-level ISR caching here would be redundant.

**`connection()` removed:** Previously, both data functions called `await connection()` which opted them out of static rendering entirely (every visit was fully dynamic). Removing it unlocks ISR.

**All 25 symbols server-fetched:** Previously the server only fetched the first 5 symbols and the client batch-loaded the rest incrementally via `fetch('/api/stocks')`. Now the server delivers all 25 in the ISR snapshot — no client-side initial data fetching.

---

### `/stock/[symbol]` — Stock Detail (fully dynamic, per-request)

No ISR — each visit fetches fresh quote + profile data. Slow-changing data is cached at the function level.

Each section is an independent `async` server component with its own Suspense boundary:

| Section | Data fetched | Cache |
|---------|-------------|-------|
| `HeaderSection` | `fetchStockDetail()` → quote + profile | quote: none; profile: `'use cache'` days |
| `KeyMetrics` | `fetchBasicFinancials()` | `'use cache'` hours |
| `CompanyProfile` | `fetchCachedProfile()` | `'use cache'` days |
| `AnalystRecommendations` | `fetchRecommendationTrends()` | `'use cache'` hours |
| `NewsSection` | `fetchCompanyNews()` | `'use cache'` hours |

---

## Caching Map — Full Reference

| Data | Function | Cache layer | TTL | Hits Finnhub when |
|------|----------|-------------|-----|-------------------|
| Stock quote (live price) | `fetchQuote` | **None** | — | Every ISR revalidation (~55s) or manual refresh |
| Company profile (name, market cap, industry) | `fetchCachedProfile` | `'use cache'` | days | First request after deploy, then once per day |
| Basic financials (P/E, EPS, Beta, 52W High…) | `fetchBasicFinancials` | `'use cache'` | hours | Once per symbol per hour |
| Market status (open/closed/session) | `fetchMarketStatus` | **None** | — | Every page request (initial SSR) + `MarketStatusIndicator` client poll (60s) |
| Market holidays | `fetchMarketHolidays` | `'use cache'` (function level) | days | First request after deploy, then once per day |
| Company news | `fetchCompanyNews` | `'use cache'` | hours | Once per symbol+date range per hour |
| Recommendation trends | `fetchRecommendationTrends` | `'use cache'` | hours | Once per symbol per hour |
| AI insight text | `lib/insight-cache.ts` (in-memory Map) | In-memory | 1 hour | Every request outside the 1h TTL window |

### Why no cache on quotes and market status

These are the only two values that change meaningfully during trading hours. Caching them would make the 55s ISR revalidation pointless — the whole purpose of the revalidation cycle is to deliver fresh prices and current market open/close state.

### Why in-memory Map for AI insights

OpenAI responses are streamed chunk-by-chunk via `ReadableStream`. The `'use cache'` directive cannot cache streaming responses — it requires a serializable return value. The in-memory Map in `lib/insight-cache.ts` is the only correct server-side option. The client hook (`hooks/useInsight.ts`) also maintains a session-level Map cache so re-opening the same stock's modal skips the server entirely.

### Why `'use cache'` beats in-memory Maps for everything else

In-memory Maps are per-process and per-instance. In serverless deployments (Vercel), each invocation may be a fresh process — the cache is always cold. In multi-instance deployments, different servers hold different states. Next.js `'use cache'` stores results in the shared Data Cache, so 3 concurrent tabs = 1 Finnhub call, not 3.

---

## Real-Time Price Updates

### Primary path: Finnhub WebSocket

`hooks/useFinnhubWebSocket.ts` connects directly from the browser to `wss://ws.finnhub.io?token=KEY`.

- Subscribes to all symbols present in the stocks state
- Incoming trade messages are throttled/batched at 250ms intervals before flushing to state
- On each price tick: recalculates `change`, `percentChange`, `priceVs52wHigh` from `previousClose` (which is fixed from the ISR snapshot)
- Reconnection: exponential backoff starting at 1s, doubling to 30s max, 10 attempts
- Re-establishes connection on tab visibility change (hidden → visible)

**Limitation:** Finnhub free tier allows 1 concurrent WebSocket connection. Every user beyond the first will fail to connect.

### Fallback path: "Fetch Latest Prices" button

When WebSocket status is anything other than `"connected"` (i.e. `"connecting"`, `"reconnecting"`, or `"disconnected"`), a button appears in `StockTable`.

On click: `GET /api/stocks?symbols=<all25>` → single request, server fetches 25 fresh quotes at concurrency=3. Profile and financials are served from `'use cache'` — no extra Finnhub calls. Result replaces `stocks` state.

No batching needed client-side: the server's `fetchAllStocks` already handles the concurrency internally, and only quotes (25 calls) actually hit Finnhub.

---

## Data Flow Diagram

```
Browser request → /
  │
  ├─ StockData: ISR cache VALID (< 55s old)
  │    └─ Serve cached Stock[] RSC payload instantly
  │
  ├─ StockData: ISR cache STALE (> 55s)
  │    ├─ Serve stale Stock[] to current request (no wait)
  │    └─ Background revalidation:
  │         ├─ fetchQuote × 25          → Finnhub REST (fresh)
  │         ├─ fetchCachedProfile × 25  → Data Cache (days TTL)
  │         └─ fetchBasicFinancials × 25 → Data Cache (hours TTL)
  │
  └─ MarketStatusData: always fresh per request
       ├─ fetchMarketStatus()   → Finnhub REST (always fresh)
       └─ fetchMarketHolidays() → Data Cache (days TTL, function-level)

Client hydrates with all 25 stocks
  ├─ WebSocket connected
  │    └─ Live price ticks → handlePriceUpdate() → row flash
  └─ WebSocket not connected
       └─ "Fetch Latest Prices" button → GET /api/stocks → setStocks()

MarketStatusIndicator
  └─ Initialised with SSR data → polls GET /api/market every 60s
```

---

## API Routes

### `GET /api/stocks`
- **Purpose:** Return normalized `Stock[]` for given symbols.
- **Query params:** `symbols` (optional, comma-separated; Zod-validated against `STOCK_SYMBOLS` allowlist; defaults to all 25)
- **Response:** `{ stocks: Stock[], timestamp: number }`
- **Used by:** `StockTable` manual refresh button (when WS is not connected)
- **Caching:** None at the route level — delegates to `fetchAllStocks` which calls cached profile/financials and fresh quotes

### `GET /api/market`
- **Purpose:** Return current US market status + holiday calendar.
- **Response:** `{ status: MarketStatus, holidays: MarketHoliday[] }`
- **Used by:** `MarketStatusIndicator` (polls every 60s)
- **Caching:** Holidays served from `'use cache'`; market status always fresh

### `POST /api/insight`
- **Purpose:** Stream 2–3 sentence analyst commentary via OpenAI GPT-4o-mini.
- **Request body (Zod-validated):** `{ symbol, name, price, change, percentChange, marketCap, industry, metrics? }`
- **Response:** `text/plain` `ReadableStream`, header `X-Insight-Cached: true|false`
- **Caching:** Server-side in-memory Map in `lib/insight-cache.ts` (1h TTL). Cache hit returns stored text as a single-chunk stream. Cache miss streams from OpenAI and stores completed text.
- **Error codes:** `400` invalid body, `500` missing API key, `502` OpenAI failure

All routes protected by `proxy.ts` rate limiter: **30 requests / 60s per IP**.

---

## Client Components

### `StockTable` (`components/StockTable.tsx`) — `"use client"`
- Receives `initialStocks: Stock[]` (all 25) from the ISR snapshot
- State: `stocks` (updated by WS ticks or manual refresh), `flashedSymbols`, `insightStock`
- `handlePriceUpdate(Map<symbol, price>)` — recalculates derived fields from `previousClose`
- `flashRows()` — adds `row-flash` CSS class for 2s highlight animation
- URL-driven filters via `useStockFilters` (Zod-parsed query params)
- Shows "Fetch Latest Prices" button when `status !== "connected"`

### `MarketStatusIndicator` (`components/MarketStatusIndicator.tsx`) — `"use client"`
- Initialised with `initialData: MarketInfo | null` from ISR
- Polls `GET /api/market` every 60s for live open/close state
- Popover with exchange, timezone, session, upcoming holidays
- Kept as polling (not ISR-only) because open/close state changes during the day and the component should reflect it immediately

### `ThemeToggle` (`components/ThemeToggle.tsx`) — `"use client"`
- Toggles `dark` class on `document.documentElement`
- Persists choice to `localStorage('theme')`
- FOUC prevention: inline `<script>` in `<head>` (layout.tsx) reads localStorage before first paint
- Dark mode strategy: class-based via `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css`

### `FilterBar` (`components/FilterBar.tsx`) — `"use client"`
- Filters: `pctMin`/`pctMax` (% change range), market cap tier (Mega/Large/Mid/Small), sector multi-select
- Sector dropdown: `max-h` capped + `overflow-y-auto` to prevent viewport overflow
- All filter state lives in the URL via `useStockFilters` — shareable, bookmarkable, back-button safe

---

## Hooks

| Hook | Purpose |
|------|---------|
| `useFinnhubWebSocket` | WebSocket to Finnhub, batched price updates, exponential reconnection |
| `useStockFilters` | URL-synced filter state, Zod parsing, 300ms debounce on numeric inputs |
| `useInsight` | Streams `/api/insight`, accumulates chunks, session-level client cache |

---

## Lib Modules

| Module | Purpose |
|--------|---------|
| `lib/finnhub.ts` | All Finnhub fetchers — quotes, profiles, financials, news, recommendations, market data |
| `lib/insight-cache.ts` | Server in-memory Map for AI insights (1h TTL) |
| `lib/types.ts` | TypeScript interfaces: `Stock`, `StockDetail`, `MarketStatus`, `MarketInfo`, `FinnhubQuote`, etc. |
| `lib/filters.ts` | `applyFilters()`, URL serialization, cap tier thresholds |
| `lib/symbols.ts` | `STOCK_SYMBOLS` — 25-symbol allowlist |
| `lib/format.ts` | `formatPrice`, `formatPercent`, `formatMarketCap`, `formatChange`, etc. |

---

## Config

### `next.config.ts`
```ts
reactCompiler: true   // React 19 compiler — no manual useMemo/memo without justification
cacheComponents: true // enables server component caching
```

### `app/globals.css`
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *)); /* class-based dark mode */
```

Dark mode CSS variables live under `.dark {}` (not media query), so they respond to the toggle.

### `app/layout.tsx`
FOUC-prevention inline script reads `localStorage('theme')` and adds `dark` class to `<html>` synchronously before React hydrates. `suppressHydrationWarning` on `<html>` prevents React mismatch warnings caused by the class being set before hydration.

---

## Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `FINNHUB_API_KEY` | Server only | Finnhub REST API calls |
| `NEXT_PUBLIC_FINNHUB_API_KEY` | Client + server | Finnhub WebSocket token |
| `OPENAI_API_KEY` | Server only | `/api/insight` route |

---

## What Was Removed and Why

| Removed | Reason |
|---------|--------|
| `quoteCache` Map (30s in-memory) | Serverless = cold cache per invocation. ISR provides the caching boundary. |
| `statusCache` singleton (30s in-memory) | Same — wrong pattern for serverless. Fresh fetch every ~55s is correct. |
| `newsCache` Map (30min in-memory) | Replaced with `'use cache'` + `cacheLife("hours")` — the correct Next.js 16 pattern. |
| `await connection()` on homepage | Was opting the page out of static rendering entirely. Removed to enable ISR. |
| Client-side incremental batch loading | Server now delivers all 25 stocks in the ISR snapshot. No incremental client fetch needed. |
| `STOCK_SYMBOLS.slice(0, 5)` on server | Changed to full `STOCK_SYMBOLS` — complete set delivered server-side. |
| "Fetch Latest Prices" always-visible button | Replaced with a conditional button shown only when WS is not connected. |
