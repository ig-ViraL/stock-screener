# HTTP API

## `GET /api/stocks`

Returns normalized stock data for the screener.

### Query parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `symbols` | `string` (comma-separated) | All 25 tracked symbols | Filter to specific symbols (must be in the allowlist) |

Validated with Zod. Unknown symbols are silently filtered out; at least one valid symbol must remain or a 400 is returned.

### Response shape

```json
{
  "stocks": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc",
      "price": 178.72,
      "previousClose": 176.55,
      "change": 2.17,
      "percentChange": 1.23,
      "highToday": 179.61,
      "lowToday": 176.21,
      "openPrice": 177.00,
      "marketCap": 2840000,
      "fiftyTwoWeekHigh": 199.62,
      "fiftyTwoWeekLow": 164.08,
      "priceVs52wHigh": -10.47
    }
  ],
  "timestamp": 1711180800000
}
```

`marketCap` is in millions of USD (Finnhub convention). `priceVs52wHigh` is computed as `((price - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100` and rounded to 2 decimals. 52-week fields can be `null` if Finnhub metric data is unavailable.

### Caching

No caching applied — this route is fully dynamic. Each request hits Finnhub REST in real time.

### Rate limiting

Enforced by `proxy.ts`: **30 requests per minute per IP**. Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header.

---

## `GET /api/market`

Returns current US market status and holiday calendar.

### Query parameters

None.

### Response shape

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

### Caching

`status` is served from a 30-second in-memory cache in `lib/finnhub.ts`. `holidays` uses `'use cache'` with `cacheLife('days')`.

### Rate limiting

Enforced by `proxy.ts`: **30 requests per minute per IP**.

---

## `POST /api/insight`

Generates a short AI-written analyst-style commentary for a stock. Streams tokens via `ReadableStream`.

### Request body (JSON)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | `string` | Yes | Stock ticker (e.g. `"AAPL"`) |
| `name` | `string` | Yes | Company name |
| `price` | `number` | Yes | Current price |
| `change` | `number` | Yes | Absolute price change |
| `percentChange` | `number` | Yes | Percentage change |
| `marketCap` | `number` | Yes | Market cap in millions USD |
| `industry` | `string` | Yes | Finnhub industry classification |
| `metrics` | `object` | No | Extended metrics (see below) |

**Optional `metrics` object:**

| Field | Type | Description |
|-------|------|-------------|
| `peRatio` | `number` | Price-to-earnings ratio |
| `eps` | `number` | Earnings per share |
| `beta` | `number` | Beta coefficient |
| `dividendYield` | `number` | Indicated annual dividend yield (%) |
| `roe` | `number` | Return on equity (%) |
| `debtToEquity` | `number` | Total debt to equity ratio |

Validated with Zod. Invalid body returns `400` with error details.

### Response

**Success (200):** `Content-Type: text/plain; charset=utf-8`

The response body is a `ReadableStream` of UTF-8 text. Tokens arrive incrementally (token-by-token for cache misses; single chunk for cache hits). Read with `response.body.getReader()` + `TextDecoder`.

Custom header `X-Insight-Cached: true|false` indicates whether the response was served from cache.

**Errors:**

| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "error": "...", "details": {...} }` | Invalid or missing request body |
| `500` | `{ "error": "AI service not configured" }` | `OPENAI_API_KEY` env var missing |
| `502` | `{ "error": "AI service temporarily unavailable" }` | OpenAI API call failed |

Error responses are JSON (not streams) so the client can parse them cleanly.

### Caching

**Server-side:** In-memory `Map` with **1-hour TTL** per symbol. Cached insights are served as a single-chunk stream. Expired entries are lazily deleted on read.

**Client-side:** Module-level `Map` in the `useInsight` hook prevents redundant fetches when re-opening the modal for the same stock within a session.

**Limitations:** In-memory cache does not survive server restarts and is per-process. Would need Redis/Upstash for production horizontal scaling.

### Rate limiting

Enforced by `proxy.ts` (same as `/api/stocks`): **30 requests per minute per IP**.
