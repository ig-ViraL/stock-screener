<div align="center">

# 📈 Stock Screener

**Real-time US equities dashboard: live WebSocket prices, shareable URL-driven filters and streaming AI insights.**

[**Live Demo**](https://stock-screener-beta-two.vercel.app/) · [Architecture](./DECISIONS.md) · [API](./API.md)

![Next.js](https://img.shields.io/badge/Next.js_16-000?logo=nextdotjs) ![React](https://img.shields.io/badge/React_19-149ECA?logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_4-06B6D4?logo=tailwindcss&logoColor=white) ![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000?logo=vercel) ![CI](https://github.com/ig-ViraL/stock-screener/actions/workflows/ci.yml/badge.svg)

</div>

## Why this project

Free market-data APIs are rate-limited, and "live" dashboards tend to either hammer the API or go stale. This project is a worked answer to that trade-off: it streams 25+ tickers in real time while staying under Finnhub's free-tier cap, by choosing carefully what to cache, what to stream, and what to render on the server.

## Highlights

| | |
|:--|:--|
| ⚡ **Live prices** | 25+ stocks streamed over a Finnhub WebSocket, with reconnection handling and a connection status indicator. |
| 🚀 **90%+ cache hit rate** | Next.js `use cache` and Partial Prerendering, with TTLs tuned per data type (quotes 30s, metrics hours, profiles days). |
| 🔗 **URL-driven filters** | Filter state lives in the URL, so every view is shareable and survives a refresh. |
| 🧱 **Progressive loading** | A server-rendered first slice with Suspense skeletons, then client batches (5 symbols per request, ~900ms apart) to avoid a thundering herd. |
| 🛡️ **Rate-limit aware** | Concurrency capped on both client and server, plus request interception in Next.js 16 `proxy.ts` (30 req/min/IP). |
| 🤖 **AI insights** | Streaming LLM summary per stock via `/api/insight`, with a response cache. Works with OpenAI or Anthropic. |
| 📄 **Stock detail pages** | Key metrics, 52-week position, day-range bar, analyst recommendations, company profile and news. |

## Architecture

```
Browser ──WebSocket──────────────▶ Finnhub (live trades)
   │
   │  HTTP (batched, 5 symbols / ~900ms)
   ▼
Next.js 16 (App Router)
 ├─ proxy.ts            rate limiting + request interception
 ├─ app/page.tsx        Server Component: first 5 rows via Suspense
 ├─ /api/stocks         quote + profile + metrics, concurrency = 3
 ├─ /api/insight        streamed LLM response (OpenAI / Anthropic)
 └─ lib/finnhub.ts      in-memory quote cache (30s) + `use cache` for profile/metrics
```

The reasoning behind each decision (what is cached, what is deliberately not, and the trade-offs) is written up in [DECISIONS.md](./DECISIONS.md).

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
| `NEXT_PUBLIC_FINNHUB_API_KEY` | Yes | Client (browser) | WebSocket token for main screener live prices |
| `OPENAI_API_KEY` | If using OpenAI | Server only | LLM for streaming stock insights |
| `ANTHROPIC_API_KEY` | If using Anthropic | Server only | Alternative LLM for insights |

`NEXT_PUBLIC_FINNHUB_API_KEY` is exposed to the browser for the main screener WebSocket. Finnhub free-tier keys are commonly treated as non-secret for client WS in demos.

## Setup and scripts

```bash
npm install
npm run dev
```

- **Development:** [http://localhost:3000](http://localhost:3000)
- **Production build:** `npm run build` then `npm start`
- **Lint:** `npm run lint`

## Project layout

| Path | Purpose |
|------|---------|
| [`app/`](./app/) | App Router: layouts, pages, loading UI |
| [`app/api/`](./app/api/) | Route handlers (Finnhub proxy, `/api/insight`, etc.) |
| [`proxy.ts`](./proxy.ts) | Next.js 16 `proxy()` — rate limiting and request interception |
| [`next.config.ts`](./next.config.ts) | Next config, including React Compiler |
| [`public/`](./public/) | Static assets |
| [`DECISIONS_LOG.md`](./DECISIONS_LOG.md) | Chronological decision notes |
| [`lib/`](./lib/) | Shared types, Finnhub client, symbol list, formatters |
| [`components/`](./components/) | Client and server UI components (StockTable, skeleton, status badge) |
| [`hooks/`](./hooks/) | React hooks (WebSocket, future filters) |

## Known limitations

- **Finnhub free tier:** rate limits apply; batching, caching, and conservative client behavior are required (see [DECISIONS.md](./DECISIONS.md)).
- **In-memory rate limiting** in `proxy.ts` does not coordinate across multiple server instances or survive restarts; not suitable as-is for horizontal scale without a shared store.
- **WebSocket** behavior (main screener only) depends on network and browser tab lifecycle; reconnection logic should handle drops without taking down the UI.
- **LLM/AI insight feature testing gap:** no `OPENAI_API_KEY` (or other configured LLM key) was available during local testing, so `/api/insight` streaming behavior could not be fully validated end-to-end. When the key is missing, the endpoint returns `500` with `{ "error": "AI service not configured" }`.
- **Process-local caches:** in-memory caches (rate limiting and `/api/insight` caching) are per server process and reset on restart; multi-instance deployments require a shared cache (e.g., Redis) to behave consistently.

## Related documentation

- **[DECISIONS_LOG.md](./DECISIONS_LOG.md)** — Append-only log: *why* and *what we used* for each decision as it happens.
- **[DECISIONS.md](./DECISIONS.md)** — Polished rationale for reviewers (sync from the log).
- **[API.md](./API.md)** — Endpoints, parameters, response shapes, caching (update alongside route handlers).

## License

MIT, see [LICENSE](./LICENSE).
