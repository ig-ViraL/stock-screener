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

**Planned trio (concrete defaults subject to final data availability from Finnhub):**

1. **Daily % change** (min / max) — Captures momentum vs. mean reversion; uses computed \((c - pc) / pc\) consistent with the brief.
2. **Market capitalization** (min / max or bands) — Separates large-cap from small-cap context; liquidity and risk profiles differ materially.
3. **P/E ratio** (min / max) or **volume** (min) — P/E for valuation context; if P/E is noisy or missing for some names, volume confirms whether a move is liquid and meaningful.

**URL as state:** All active filters are reflected in **query parameters** so a filtered view is **shareable** and **restores after a hard refresh**. Implementation uses **`useSearchParams`** (or equivalent) and keeps the URL the single source of truth for filter state—not parallel `useState` that diverges.

**Debouncing:** Text fields and range inputs **debounce** before updating the URL / recomputing the filtered set so we do not filter on every keystroke.

**Invalid params:** Zod (or equivalent) validation on parse; safe fallbacks or ignored keys with no crash.

---

## 5. Stock detail view

**Interaction:** Clicking a row opens a **detail** experience (dedicated **route** recommended for clarity).

**Shareable URL:** e.g. `/stock/[symbol]` (exact path to match implementation) so analysts can link directly.

**Rendering vs list:** Detail can pull **more** profile and context fields than the table. **Profile-like** segments may use **`'use cache'`** where data is slow-changing; **price and intraday** fields stay tied to live client state or fresh fetches so the detail view does not contradict the WebSocket feed.

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
| Shared lib | [`lib/types.ts`](./lib/types.ts), [`lib/symbols.ts`](./lib/symbols.ts), [`lib/finnhub.ts`](./lib/finnhub.ts), [`lib/format.ts`](./lib/format.ts) | Done |
| Dependencies | Next **16.2.1**, React **19.2.4**, Tailwind **4**, **zod**, **babel-plugin-react-compiler** | Done |

**Still to do (later phases):** URL-driven filters, stock detail route, `/api/insight` streaming, `'use cache'` on profile data, bundle analyzer.
