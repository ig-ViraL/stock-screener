# Stock Screener

A web-based **real-time stock screener** for analysts: live Finnhub-backed quotes via WebSocket, URL-driven filters, a shareable stock detail view, and streaming AI insights.

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

Private / assignment use unless you add a public license.
