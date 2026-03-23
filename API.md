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
      "marketCap": 2840000
    }
  ],
  "timestamp": 1711180800000
}
```

`marketCap` is in millions of USD (Finnhub convention).

### Caching

No caching applied — this route is fully dynamic. Each request hits Finnhub REST in real time.

### Rate limiting

Enforced by `proxy.ts`: **30 requests per minute per IP**. Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header.

---

*Future endpoints:* `/api/insight` (streaming AI commentary) will be documented here when implemented.
