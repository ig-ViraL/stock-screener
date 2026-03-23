# Stock Screener

A web-based **real-time stock screener** for analysts: live Finnhub-backed quotes via WebSocket, URL-driven filters, a shareable stock detail view, and streaming AI insights. Built for a **Next.js 16** (App Router) full-stack assignment.

**Documentation set (keep these in sync as you develop):**

| Doc | Role |
|-----|------|
| [README.md](./README.md) | How to run, env vars, feature checklist, limitations |
| [DECISIONS_LOG.md](./DECISIONS_LOG.md) | **Running log** — append here whenever you make a choice (what / why / what we used) |
| [DECISIONS.md](./DECISIONS.md) | Curated **architecture narrative** for reviewers and interviews (merge from the log periodically) |
| [API.md](./API.md) | HTTP routes, params, shapes (expand as routes ship) |

Architecture and trade-offs are summarized in [DECISIONS.md](./DECISIONS.md). HTTP API surface is documented in [API.md](./API.md).

## Prerequisites

- **Node.js** 20+ (recommended; matches typical Next.js 16 toolchains)
- **npm** (or `pnpm` / `yarn` if you prefer)
- Accounts / keys for:
  - [Finnhub](https://finnhub.io/) (free tier; stock quotes, profile, WebSocket)
  - Your chosen LLM provider for `/api/insight` (e.g. OpenAI or Anthropic)

## Environment variables

Create a `.env.local` in the project root (never commit secrets). Example:

| Variable | Required | Where it runs | Description |
|----------|----------|----------------|-------------|
| `FINNHUB_API_KEY` | Yes | Server only | REST API calls to Finnhub from route handlers |
| `NEXT_PUBLIC_FINNHUB_API_KEY` | Yes | Client (browser) | WebSocket connection token (see trade-off note in [DECISIONS.md](./DECISIONS.md)) |
| `OPENAI_API_KEY` | If using OpenAI | Server only | LLM for streaming stock insights (later phase) |
| `ANTHROPIC_API_KEY` | If using Anthropic | Server only | Alternative LLM for insights (later phase) |

`NEXT_PUBLIC_FINNHUB_API_KEY` is exposed to the browser for the WebSocket connection. Finnhub free-tier keys are commonly treated as non-secret for client WS in demos; document the trade-off for production.

## Setup and scripts

```bash
npm install
npm run dev
```

- **Development:** [http://localhost:3000](http://localhost:3000)
- **Production build:** `npm run build` then `npm start`
- **Lint:** `npm run lint`

Optional (assignment deliverable): add `@next/bundle-analyzer` and run `ANALYZE=true npm run build` for bundle analysis; capture a screenshot for submission.

## Feature checklist (assignment scope)

Aligned with the technical brief:

- [x] Next.js 16 App Router, TypeScript, Tailwind (no UI kit)
- [x] React Compiler enabled in `next.config.ts`
- [x] Request interception + **30 req/min per IP** rate limit in **`proxy.ts`** (not `middleware.ts`)
- [x] Typed Finnhub **proxy** API: normalized fields, Zod on query params, computed fields where useful
- [x] **25** symbols: ticker, name, price, % change, market cap; **WebSocket** live updates + manual refresh fallback
- [x] Suspense + skeleton UI for data-loading routes
- [ ] **≥3** URL-driven, debounced filters with analyst-relevant metrics
- [ ] Stock **detail** with shareable URL; rendering strategy documented
- [ ] **`/api/insight`**: streaming tokens (`ReadableStream`), cached insights, graceful failure
- [ ] Explicit **`'use cache'`** only where caching is intentional (no implicit caching assumptions)

Check items off as you implement. Log decisions in [DECISIONS_LOG.md](./DECISIONS_LOG.md) as you go; roll important points into [DECISIONS.md](./DECISIONS.md) when they stabilize.

## Project layout

| Path | Purpose |
|------|---------|
| [`app/`](./app/) | App Router: layouts, pages, loading UI |
| [`app/api/`](./app/api/) | Route handlers (Finnhub proxy, `/api/insight`, etc.) — add as implemented |
| [`proxy.ts`](./proxy.ts) | Next.js 16 `proxy()` — rate limiting and request interception (add at repo root) |
| [`next.config.ts`](./next.config.ts) | Next config, including React Compiler |
| [`public/`](./public/) | Static assets |
| [`DECISIONS_LOG.md`](./DECISIONS_LOG.md) | Chronological decision notes (append during development) |

| [`lib/`](./lib/) | Shared types, Finnhub client, symbol list, formatters |
| [`components/`](./components/) | Client and server UI components (StockTable, skeleton, status badge) |
| [`hooks/`](./hooks/) | React hooks (WebSocket, future filters) |

## Known limitations

- **Finnhub free tier:** rate limits apply; batching, caching, and conservative client behavior are required (see [DECISIONS.md](./DECISIONS.md)).
- **In-memory rate limiting** in `proxy.ts` does not coordinate across multiple server instances or survive restarts; not suitable as-is for horizontal scale without a shared store.
- **WebSocket** behavior depends on network and browser tab lifecycle; reconnection logic should handle drops without taking down the UI.

## Related documentation

- **[DECISIONS_LOG.md](./DECISIONS_LOG.md)** — Append-only log: *why* and *what we used* for each decision as it happens.
- **[DECISIONS.md](./DECISIONS.md)** — Polished rationale for reviewers (sync from the log).
- **[API.md](./API.md)** — Endpoints, parameters, response shapes, caching (update alongside route handlers).

## License

Private / assignment use unless you add a public license.
