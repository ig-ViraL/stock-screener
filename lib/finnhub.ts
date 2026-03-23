import { cacheLife } from "next/cache";
import type {
  FinnhubQuote,
  FinnhubProfile,
  FinnhubMetrics,
  FinnhubNewsItem,
  FinnhubRecommendation,
  Stock,
  StockDetail,
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

const PROFILE_TTL_MS = 24 * 60 * 60_000;

interface CachedProfile {
  data: FinnhubProfile;
  ts: number;
}

const profileCache = new Map<string, CachedProfile>();
const inflightProfileRequests = new Map<string, Promise<FinnhubProfile>>();

export async function fetchCachedProfile(
  symbol: string
): Promise<FinnhubProfile> {
  const normalizedSymbol = symbol.toUpperCase();
  const cached = profileCache.get(normalizedSymbol);
  if (cached && Date.now() - cached.ts < PROFILE_TTL_MS) {
    return cached.data;
  }

  const inflight = inflightProfileRequests.get(normalizedSymbol);
  if (inflight) {
    return inflight;
  }

  const request = (async () => {
    "use cache";
    cacheLife("days");

    const res = await fetch(
      `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(normalizedSymbol)}&token=${getApiKey()}`
    );
    if (!res.ok) {
      throw new Error(
        `Finnhub profile request failed for ${normalizedSymbol}: ${res.status}`
      );
    }

    const data: FinnhubProfile = await res.json();
    profileCache.set(normalizedSymbol, { data, ts: Date.now() });
    return data;
  })();

  inflightProfileRequests.set(normalizedSymbol, request);
  try {
    return await request;
  } finally {
    inflightProfileRequests.delete(normalizedSymbol);
  }
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
  const CONCURRENCY = 6;
  const stocks: Stock[] = [];

  for (let index = 0; index < symbols.length; index += CONCURRENCY) {
    const batch = symbols.slice(index, index + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map((s) => fetchStock(s)));

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        stocks.push(result.value);
      }
    }
  }

  return stocks;
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

// ---------------------------------------------------------------------------
// Basic Financials — cached hours (ratios change at most daily after close)
// ---------------------------------------------------------------------------

export async function fetchBasicFinancials(
  symbol: string
): Promise<FinnhubMetrics> {
  "use cache";
  cacheLife("hours");

  const res = await fetch(
    `${FINNHUB_BASE}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${getApiKey()}`
  );
  if (!res.ok) {
    throw new Error(
      `Finnhub metric request failed for ${symbol}: ${res.status}`
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Company News — 30-min in-memory cache
// ---------------------------------------------------------------------------

const NEWS_TTL_MS = 30 * 60_000;

interface CachedNews {
  data: FinnhubNewsItem[];
  ts: number;
}

const newsCache = new Map<string, CachedNews>();

export async function fetchCompanyNews(
  symbol: string,
  from: string,
  to: string
): Promise<FinnhubNewsItem[]> {
  const key = `${symbol}:${from}:${to}`;
  const cached = newsCache.get(key);
  if (cached && Date.now() - cached.ts < NEWS_TTL_MS) {
    return cached.data;
  }

  const res = await fetch(
    `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&token=${getApiKey()}`
  );
  if (!res.ok) {
    throw new Error(
      `Finnhub company-news request failed for ${symbol}: ${res.status}`
    );
  }

  const data: FinnhubNewsItem[] = await res.json();
  newsCache.set(key, { data, ts: Date.now() });
  return data;
}

// ---------------------------------------------------------------------------
// Recommendation Trends — cached hours (updated monthly by analysts)
// ---------------------------------------------------------------------------

export async function fetchRecommendationTrends(
  symbol: string
): Promise<FinnhubRecommendation[]> {
  "use cache";
  cacheLife("hours");

  const res = await fetch(
    `${FINNHUB_BASE}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${getApiKey()}`
  );
  if (!res.ok) {
    throw new Error(
      `Finnhub recommendation request failed for ${symbol}: ${res.status}`
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Stock Detail — assembles extended stock data for the detail page
// ---------------------------------------------------------------------------

export async function fetchStockDetail(
  symbol: string
): Promise<StockDetail | null> {
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
      exchange: profile.exchange,
      currency: profile.currency,
      logo: profile.logo,
      ipo: profile.ipo,
      weburl: profile.weburl,
      country: profile.country,
      shareOutstanding: profile.shareOutstanding,
    };
  } catch (error) {
    console.error(`Failed to fetch stock detail for ${symbol}:`, error);
    return null;
  }
}
