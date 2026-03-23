import { cacheLife } from "next/cache";
import type {
  FinnhubQuote,
  FinnhubProfile,
  Stock,
  MarketStatus,
  MarketHoliday,
  MarketHolidayResponse,
} from "./types";

const FINNHUB_BASE = "https://finnhub.io/api/v1";

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY environment variable is not set");
  return key;
}

// ---------------------------------------------------------------------------
// Profile — cached with 'use cache' (company name, market cap rarely change)
// ---------------------------------------------------------------------------

export async function fetchCachedProfile(
  symbol: string
): Promise<FinnhubProfile> {
  "use cache";
  cacheLife("days");

  const res = await fetch(
    `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${getApiKey()}`
  );
  if (!res.ok) {
    throw new Error(
      `Finnhub profile request failed for ${symbol}: ${res.status}`
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Quote — short-lived in-memory cache (30s) to absorb rapid refreshes
// ---------------------------------------------------------------------------

const QUOTE_TTL_MS = 30_000;

interface CachedQuote {
  data: FinnhubQuote;
  ts: number;
}

const quoteCache = new Map<string, CachedQuote>();

export async function fetchQuote(symbol: string): Promise<FinnhubQuote> {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.ts < QUOTE_TTL_MS) {
    return cached.data;
  }

  const res = await fetch(
    `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${getApiKey()}`
  );
  if (!res.ok) {
    throw new Error(
      `Finnhub quote request failed for ${symbol}: ${res.status}`
    );
  }

  const data: FinnhubQuote = await res.json();
  quoteCache.set(symbol, { data, ts: Date.now() });
  return data;
}

// ---------------------------------------------------------------------------
// Composite — assembles a Stock from cached profile + fresh-ish quote
// ---------------------------------------------------------------------------

export async function fetchStock(symbol: string): Promise<Stock | null> {
  try {
    const [quote, profile] = await Promise.all([
      fetchQuote(symbol),
      fetchCachedProfile(symbol),
    ]);

    if (!quote.c || !profile.name) return null;

    return {
      symbol,
      name: profile.name,
      industry: profile.finnhubIndustry,
      price: quote.c,
      previousClose: quote.pc,
      change: quote.d,
      percentChange: quote.dp,
      highToday: quote.h,
      lowToday: quote.l,
      openPrice: quote.o,
      marketCap: profile.marketCapitalization,
    };
  } catch (error) {
    console.error(`Failed to fetch stock data for ${symbol}:`, error);
    return null;
  }
}

export async function fetchAllStocks(
  symbols: readonly string[]
): Promise<Stock[]> {
  const results = await Promise.allSettled(symbols.map((s) => fetchStock(s)));

  return results
    .filter(
      (r): r is PromiseFulfilledResult<Stock | null> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value)
    .filter((s): s is Stock => s !== null);
}

// ---------------------------------------------------------------------------
// Market Status — 30s in-memory cache (changes throughout the trading day)
// ---------------------------------------------------------------------------

const STATUS_TTL_MS = 30_000;

let statusCache: { data: MarketStatus; ts: number } | null = null;

export async function fetchMarketStatus(
  exchange = "US"
): Promise<MarketStatus> {
  if (statusCache && Date.now() - statusCache.ts < STATUS_TTL_MS) {
    return statusCache.data;
  }

  const res = await fetch(
    `${FINNHUB_BASE}/stock/market-status?exchange=${encodeURIComponent(exchange)}&token=${getApiKey()}`
  );
  if (!res.ok) {
    throw new Error(`Finnhub market-status request failed: ${res.status}`);
  }

  const data: MarketStatus = await res.json();
  statusCache = { data, ts: Date.now() };
  return data;
}

// ---------------------------------------------------------------------------
// Market Holidays — cached with 'use cache' (holiday calendar rarely changes)
// ---------------------------------------------------------------------------

export async function fetchMarketHolidays(
  exchange = "US"
): Promise<MarketHoliday[]> {
  "use cache";
  cacheLife("days");

  const res = await fetch(
    `${FINNHUB_BASE}/stock/market-holiday?exchange=${encodeURIComponent(exchange)}&token=${getApiKey()}`
  );
  if (!res.ok) {
    throw new Error(`Finnhub market-holiday request failed: ${res.status}`);
  }

  const body: MarketHolidayResponse = await res.json();
  return body.data;
}
