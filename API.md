# HTTP API

This document covers all API routes under `app/api`.

## Global middleware: rate limiting (`proxy.ts`)

All `/api/*` routes are protected by an in-memory IP-based rate limiter.

- **Window:** 60 seconds
- **Limit:** 30 requests per IP per window
- **Matcher:** `/api/:path*`

### Rate limit headers

On successful requests, middleware adds:

- `X-RateLimit-Limit`: `30`
- `X-RateLimit-Remaining`: remaining requests in the current window

When throttled, response is:

- **Status:** `429 Too Many Requests`
- **Body:**
  ```json
  {
    "error": "Too many requests",
    "retryAfterSeconds": 42
  }
  ```
- **Headers:** `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining: 0`

> Note: this limiter is process-local memory. Counters reset on restart and are not shared across multiple instances.

---

## `GET /api/stocks`

Returns normalized stock rows for the screener.

### Accepted query parameters

| Parameter | Type | Required | Default | Details |
|-----------|------|----------|---------|---------|
| `symbols` | `string` (comma-separated tickers) | No | all symbols in `STOCK_SYMBOLS` | Values are trimmed, uppercased, and filtered against the allowlist |

Validation is done with Zod:

- Unknown symbols are silently removed
- If no valid symbols remain, API returns `400`

### Success response

- **Status:** `200`
- **Content-Type:** `application/json`
- **Body shape:**

```json
{
  "stocks": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc",
      "industry": "Technology",
      "price": 178.72,
      "previousClose": 176.55,
      "change": 2.17,
      "percentChange": 1.23,
      "highToday": 179.61,
      "lowToday": 176.21,
      "openPrice": 177.0,
      "marketCap": 2840000,
      "fiftyTwoWeekHigh": 199.62,
      "fiftyTwoWeekLow": 164.08,
      "priceVs52wHigh": -10.47
    }
  ],
  "timestamp": 1711180800000
}
```

Field notes:

- `marketCap` uses Finnhub units (millions USD)
- `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`, and `priceVs52wHigh` can be `null`
- `priceVs52wHigh` is calculated as `((price - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100`, rounded to 2 decimals

### Error responses

| Status | Body shape | When |
|--------|------------|------|
| `400` | `{ "error": "Invalid parameters", "details": { ... } }` | Query validation fails |

### Caching behavior

`/api/stocks` itself is dynamic, but it composes cached upstream reads in `lib/finnhub.ts`:

- Quote cache: in-memory, 30s TTL (`fetchQuote`)
- Profile cache: in-memory + `use cache` (`cacheLife("days")`) (`fetchCachedProfile`)
- Basic financials: `use cache` (`cacheLife("hours")`) (`fetchBasicFinancials`)

---

## `GET /api/market`

Returns current US market status and holiday calendar in one payload.

### Accepted query parameters

None.

### Success response

- **Status:** `200`
- **Content-Type:** `application/json`
- **Body shape:**

```json
{
  "status": {
    "exchange": "US",
    "holiday": null,
    "isOpen": true,
    "session": "regular",
    "timezone": "America/New_York",
    "t": 1711180800
  },
  "holidays": [
    {
      "eventName": "New Year's Day",
      "atDate": "2026-01-01",
      "tradingHour": ""
    }
  ]
}
```

### Error responses

| Status | Body shape | When |
|--------|------------|------|
| `502` | `{ "error": "Failed to fetch market information" }` | Upstream Finnhub call fails |

### Caching behavior

- `status`: in-memory cache, 30s TTL (`fetchMarketStatus`)
- `holidays`: `use cache` + `cacheLife("days")` (`fetchMarketHolidays`)

---

## `POST /api/insight`

Generates short analyst-style commentary text for one stock. Response is streamed plain text.

### Accepted request body (`application/json`)

| Field | Type | Required | Validation / Notes |
|-------|------|----------|--------------------|
| `symbol` | `string` | Yes | `1..10` chars |
| `name` | `string` | Yes | non-empty |
| `price` | `number` | Yes | numeric |
| `change` | `number` | Yes | numeric |
| `percentChange` | `number` | Yes | numeric |
| `marketCap` | `number` | Yes | Finnhub units (millions USD) |
| `industry` | `string` | Yes | string |
| `metrics` | `object` | No | optional object below |

Optional `metrics` fields (all numeric, optional):

- `peRatio`
- `eps`
- `beta`
- `dividendYield`
- `roe`
- `debtToEquity`

### Success response

- **Status:** `200`
- **Content-Type:** `text/plain; charset=utf-8`
- **Body:** streamed UTF-8 text (`ReadableStream`)
- **Custom header:** `X-Insight-Cached: true|false`

Behavior:

- cache hit => one-chunk stream from cache
- cache miss => token-streamed chunks from OpenAI

### Error responses

| Status | Body shape | When |
|--------|------------|------|
| `400` | `{ "error": "Invalid JSON body" }` | Request body is not valid JSON |
| `400` | `{ "error": "Invalid request body", "details": { ... } }` | Zod body validation fails |
| `500` | `{ "error": "AI service not configured" }` | `OPENAI_API_KEY` missing |
| `502` | `{ "error": "AI service temporarily unavailable" }` | OpenAI request fails |

Error responses are JSON (not stream responses).

### Caching behavior

Server-side and client-side caching both exist:

- **Server cache (`lib/insight-cache.ts`):**
  - in-memory `Map`
  - key: uppercased `symbol`
  - TTL: 1 hour
  - expired entries deleted lazily on read
- **Client cache (`useInsight` hook):**
  - module-level in-memory map to avoid repeat fetches in the same browser session

Limitations:

- in-memory caches are per process
- not shared between instances
- reset on server restart
