# Stock Screener - Project Inventory

Date: 2026-03-23

This file is an implementation checklist/inventory of what exists in the current repo: created APIs, created pages, and the core supporting modules/components that power the app.

## Pages (Next.js App Router)

1. `app/layout.tsx`
   - Root layout: sets Geist font variables and the HTML/body shell.
   - Rendering style: **Server Root Layout** (default in App Router; no `"use client"`).
   - Why: fonts/theme variables + app-wide shell should apply everywhere without shipping extra client JS.

2. `/` (dashboard)
   - File: `app/page.tsx`
   - Renders:
     - Header with `MarketStatusIndicator` (Suspense + skeleton fallback)
     - Stock dashboard table with `StockTable` (Suspense + `StockTableSkeleton`)
   - Uses:
     - `fetchAllStocks(STOCK_SYMBOLS)` from `lib/finnhub.ts`
     - `fetchMarketStatus("US")` + `fetchMarketHolidays("US")` from `lib/finnhub.ts`
   - Rendering style: **Server Component page + Suspense boundaries**.
   - Why:
     - The dashboard needs an instant shell (loading UI) while server fetches run.
     - The live “price movement” is owned by the client WebSocket (`StockTable`), so the server only provides the initial snapshot.
     - Suspense prevents waterfall effects and keeps SSR/streaming responsive.

3. `/stock/[symbol]` (stock detail page)
   - File: `app/stock/[symbol]/page.tsx`
   - Implements:
     - `generateMetadata()` based on the requested symbol
     - Server-side fetch of stock header data via `fetchStockDetail(symbol)` and `fetchBasicFinancials(symbol)`
     - Layout composed with multiple Suspense sections:
       - `KeyMetrics`
       - `CompanyProfile`
       - `AnalystRecommendations`
       - `NewsSection`
   - Rendering style: **Async Server Component (dynamic) + Suspense per section**.
   - Why:
     - Detail data is high-density and independent; Suspense boundaries allow each section to stream as soon as its fetch is ready.
     - The page is dynamic because stock context changes; instead of static prerendering, slow-changing fragments are cached at the data-fetch layer (see caching section below).

4. Route boundaries for `/stock/[symbol]`
   - `app/stock/[symbol]/loading.tsx` -> `FullPageSkeleton`
     - Rendering style: dedicated **Loading boundary** for the detail route.
     - Why: provides a full-screen skeleton immediately while server sections load.
   - `app/stock/[symbol]/error.tsx` -> error UI + `reset()` + “Back to Dashboard”
     - Rendering style: **Error boundary** for server rendering failures.
     - Why: keeps the user in-flow with a retry (`reset`) and a safe navigation path back to `/`.
   - `app/stock/[symbol]/not-found.tsx` -> “Stock Not Found” UI
     - Rendering style: **Not Found boundary**.
     - Why: unknown symbols call `notFound()` in the page and display a clean 404 state.

## API Routes (created)

All routes are under `app/api/**/route.ts`.

1. `GET /api/market`
   - File: `app/api/market/route.ts`
   - Purpose: returns current US market status + holiday calendar.
   - Response:
     - `{ status: MarketStatus, holidays: MarketHoliday[] }`
   - Behavior:
     - Calls `fetchMarketStatus("US")` and `fetchMarketHolidays("US")` in parallel.
     - On failure returns JSON error with `502`.

2. `GET /api/stocks`
   - File: `app/api/stocks/route.ts`
   - Purpose: returns normalized stock data for the screener table.
   - Query params:
     - `symbols` (optional, comma-separated; validated against the allowlist in `lib/symbols.ts`)
   - Response:
     - `{ stocks: Stock[], timestamp: number }`
   - Behavior:
     - Validates params with Zod.
     - Uses `fetchAllStocks(parsedSymbols)` from `lib/finnhub.ts`.
     - Returns `400` on invalid query params.

3. `POST /api/insight`
   - File: `app/api/insight/route.ts`
   - Purpose: generates an AI-written 2–3 sentence analyst-style commentary for a stock.
   - Request body (JSON, validated with Zod):
     - `symbol`, `name`, `price`, `change`, `percentChange`, `marketCap`, `industry`
     - optional `metrics` object: `peRatio`, `eps`, `beta`, `dividendYield`, `roe`, `debtToEquity`
   - Response:
     - `Content-Type: text/plain; charset=utf-8`
     - Streams via `ReadableStream`
     - Header: `X-Insight-Cached: true|false`
   - Behavior:
     - If cached: streams cached text as a single chunk.
     - If not cached: uses `openai.chat.completions.create({ stream: true })` with `gpt-4o-mini`.
     - Errors:
       - `400` invalid JSON/body
       - `500` missing `OPENAI_API_KEY`
       - `502` OpenAI failure

## Caching Strategy (project-wide, but selective)

Caching is **not** applied “everywhere” automatically. Next.js 16 treats dynamic execution as the default, so we only cache where it’s intentional (and safe) to reduce Finnhub/LLM load and avoid `429`.

Additionally:
- `next.config.ts` enables `cacheComponents: true`, which allows Next.js to cache compatible **Server Components** when data fetching is marked/cached appropriately.
- The live parts of the UI (dashboard price movement) remain client-driven via WebSocket, so they are intentionally not cached.

### 1. Next.js fetch / data caching (`'use cache'` + `cacheLife(...)`)
- Implemented in `lib/finnhub.ts` for endpoints that are expected to change slowly:
  - `fetchCachedProfile()` (company profile)
  - `fetchMarketHolidays()` (holiday calendar)
  - `fetchBasicFinancials()` (metrics / ratios)
  - `fetchRecommendationTrends()` (recommendation history)
- Why: these reduce repeated REST calls across navigations and hot reloads, while the UI remains “live enough” due to WebSocket for prices.
- How: each function uses the `'use cache'` directive and sets a specific scope TTL via `cacheLife("days" | "hours")`.

### 2. In-memory TTL caches (runtime only)
- Implemented in `lib/finnhub.ts` / `lib/insight-cache.ts` for time-bound data:
  - Quote-style data absorbed with short TTL (seconds)
  - Market status cached for ~30s
  - Company news cached for ~30 minutes
  - Insight cache (server) with 1-hour TTL in `lib/insight-cache.ts`
- Why: these values change during the trading day and don’t justify long-lived caching.
- How: `Map` + timestamp checks (`Date.now() - ts < TTL`) with lazy expiration.

### 3. Client-side cache for AI streaming
- Implemented in `hooks/useInsight.ts`:
  - Module-level `Map` caches already-generated insight text per symbol during the session.
- Why: avoids re-calling the LLM when a user re-opens the modal for the same stock.
- How: if a symbol is cached, the hook sets `insight` immediately and does not call `/api/insight`.

### 4. Dev/server restart resilience (disk cache for profiles)
- Added file-based caching for `fetchCachedProfile()` in `lib/finnhub.ts`:
  - Disk path: `./.cache/finnhub/profiles/<SYMBOL>.json`
  - TTL: uses the same profile TTL window (currently 7 days)
  - Best-effort: disk cache failures never break the request.
- Why: dev restarts/hot reloads can otherwise re-trigger profile calls and cause Finnhub `429`.
- How: on cold load, the code checks disk cache first; after a successful API response, it writes to disk.

## Rate Limiting / Proxy Layer (created)

1. `proxy.ts` (repo root)
   - Exports `proxy(request)` and applies `matcher: "/api/:path*"`.
   - Implements fixed-window rate limiting:
     - Window: `60_000ms`
     - Max requests: `30` per IP
   - Uses IP from:
     - `x-forwarded-for` (first entry) or `x-real-ip`, fallback `127.0.0.1`
   - On limit:
     - Returns `429` JSON `{ error: "Too many requests", retryAfterSeconds }`
     - Adds `Retry-After` + `X-RateLimit-*` headers

### Handling and UX on rate-limit / failures
- Server/API behavior:
  - `/api/stocks` and `/api/market` do normal input validation (Zod) and then depend on Finnhub calls.
  - If rate-limited by `proxy.ts`, the client receives `429` and should treat it as a transient failure.
- Client handling patterns:
  - `components/StockTable.tsx`:
    - Live updates come from the WebSocket.
    - Manual refresh calls `/api/stocks`; any non-OK response shows a friendly error (`Failed to fetch latest prices...`).
  - `components/MarketStatusIndicator.tsx`:
    - Polls `/api/market` every 60s and uses try/catch.
    - If the poll fails, it toggles a fetch error state and avoids crashing the header.
  - `hooks/useInsight.ts` / `components/InsightModal.tsx`:
    - Consumes errors from `/api/insight` without throwing to parent components, and renders inline retry UI.

## Core Server/Client Modules

### Server/data layer (`lib/`)
- `lib/finnhub.ts`
  - Finnhub-backed fetchers used by API routes and server components:
    - `fetchAllStocks()`, `fetchStock()`, `fetchStockDetail()`
    - `fetchMarketStatus()`, `fetchMarketHolidays()`
    - `fetchBasicFinancials()` (cached)
    - plus additional cached fetchers (news/recommendations, etc.)
  - Contains in-memory TTL caching for short-lived data (quotes/status/news), and Next caching for slow-changing fragments via `'use cache'`.

- `lib/insight-cache.ts`
  - In-memory server-side insight cache (`Map`) with 1-hour TTL:
    - `getCachedInsight(symbol)`
    - `setCachedInsight(symbol, text)`

- `lib/types.ts`
  - TypeScript interfaces for Finnhub responses and app domain models:
    - `Stock`, `StockDetail`, `MarketStatus`, `MarketHoliday`, `MarketInfo`, etc.

- `lib/filters.ts`
  - URL filter parsing/serialization + filter application:
    - percent change constraints (`pctMin`, `pctMax`)
    - cap tiers (`cap`), sector selection (`sector`)
    - `applyFilters()` and `countActiveFilters()`

- `lib/symbols.ts`
  - Dashboard symbol allowlist: `STOCK_SYMBOLS` (25 tracked tickers).

- `lib/format.ts`
  - Display format helpers:
    - currency, percent, change, market cap, relative time, etc.

### Client hooks (`hooks/`)
- `hooks/useFinnhubWebSocket.ts`
  - Client WebSocket client to Finnhub (`wss://ws.finnhub.io?token=...`)
  - Subscribes to each tracked symbol
  - Throttles UI updates (batching updates, ~250ms)
  - Reconnect logic with exponential backoff + cleanup
  - Exposes connection status: `connected | connecting | reconnecting | disconnected`

- `hooks/useStockFilters.ts`
  - Keeps filter state in URL query params (URL-driven state)
  - Debounces numeric inputs
  - Uses `router.replace()` to avoid polluting browser history

- `hooks/useInsight.ts`
  - Calls `POST /api/insight` and consumes streamed text:
    - `response.body.getReader()` + `TextDecoder`
  - Provides:
    - `insight`, `isStreaming`, `error`
    - `generateInsight(data)` and `reset()`
  - Caches per symbol in-memory on the client for the session

## UI Components (created)

Common header/dashboard components:
- `components/MarketStatusIndicator.tsx`
- `components/ConnectionStatus.tsx` (badge shown next to the table)
- `components/FilterBar.tsx`
- `components/StockTable.tsx`
- `components/StockTableSkeleton.tsx`
- `components/InsightModal.tsx`

Stock detail components:
- `components/stock-detail/StockDetailHeader.tsx`
- `components/stock-detail/KeyMetrics.tsx`
- `components/stock-detail/CompanyProfile.tsx`
- `components/stock-detail/AnalystRecommendations.tsx`
- `components/stock-detail/NewsSection.tsx`
- `components/stock-detail/InsightButton.tsx`
- `components/stock-detail/StockDetailSkeleton.tsx`
- `components/stock-detail/MetricCard.tsx`
- `components/stock-detail/DayRangeBar.tsx`

## Styling / Config

- `app/globals.css`
  - Base styles + `row-flash` animation used on price updates.

- `next.config.ts`
  - Enables React Compiler: `reactCompiler: true`
  - Enables component caching: `cacheComponents: true`

- Tailwind
  - Tailwind is referenced via `@import "tailwindcss";` in `app/globals.css`.

## Environment Variables (from `README.md`)
- `FINNHUB_API_KEY` (server only) - Finnhub REST API key
- `NEXT_PUBLIC_FINNHUB_API_KEY` (client + browser) - Finnhub WS token
- `OPENAI_API_KEY` (server only) - for `/api/insight` when using OpenAI
- `ANTHROPIC_API_KEY` (server only) - alternative LLM (later phase)

