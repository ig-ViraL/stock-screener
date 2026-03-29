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
  // Prefer server-only env var; fall back to NEXT_PUBLIC for dev setups where
  // only the browser key is configured.
  const key = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
  if (!key) {
    throw new Error(
      "Finnhub API key missing. Set FINNHUB_API_KEY (preferred) or NEXT_PUBLIC_FINNHUB_API_KEY."
    );
  }
  return key;
}

// ---------------------------------------------------------------------------
// Profile — cached with 'use cache' (company name, market cap rarely change)
// ---------------------------------------------------------------------------

export async function fetchCachedProfile(
  symbol: string
): Promise<FinnhubProfile> {
  "use cache";
  cacheLife({ stale: 86400, revalidate: 86400 });

  const normalizedSymbol = symbol.toUpperCase();
  const res = await fetch(
    `${FINNHUB_BASE}/stock/profile2?symbol=${encodeURIComponent(normalizedSymbol)}&token=${getApiKey()}`
  );
  if (!res.ok) {
    throw new Error(
      `Finnhub profile request failed for ${normalizedSymbol}: ${res.status}`
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Quote — 30s cache (price data, refreshes frequently during trading hours)
// ---------------------------------------------------------------------------

export async function fetchQuote(symbol: string): Promise<FinnhubQuote> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30 });

  const res = await fetch(
    `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${getApiKey()}`
  );
  if (!res.ok) {
    throw new Error(
      `Finnhub quote request failed for ${symbol}: ${res.status}`
    );
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Composite — assembles a Stock from cached profile + fresh-ish quote
// ---------------------------------------------------------------------------

export async function fetchStock(symbol: string): Promise<Stock | null> {
  try {
    const [quote, profile, basicFinancials] = await Promise.all([
      fetchQuote(symbol),
      fetchCachedProfile(symbol),
      fetchBasicFinancials(symbol).catch(() => null),
    ]);

    if (!quote.c || !profile.name) return null;

    const fiftyTwoWeekHigh = basicFinancials?.metric["52WeekHigh"];
    const fiftyTwoWeekLow = basicFinancials?.metric["52WeekLow"];
    const priceVs52wHigh =
      fiftyTwoWeekHigh && fiftyTwoWeekHigh > 0
        ? ((quote.c - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100
        : null;

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
      fiftyTwoWeekHigh: fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: fiftyTwoWeekLow ?? null,
      priceVs52wHigh:
        priceVs52wHigh !== null ? Number(priceVs52wHigh.toFixed(2)) : null,
    };
  } catch (error) {
    console.error(`Failed to fetch stock data for ${symbol}:`, error);
    return null;
  }
}

export async function fetchAllStocks(
  symbols: readonly string[]
): Promise<Stock[]> {
  const CONCURRENCY = 3;
  const stocks: Stock[] = [];

  for (let index = 0; index < symbols.length; index += CONCURRENCY) {
    const batch = symbols.slice(index, index + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((s) => fetchStock(s))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        stocks.push(result.value);
      }
    }
  }

  return stocks;
}

// ---------------------------------------------------------------------------
// Market Status — 30s cache (changes throughout the trading day)
// ---------------------------------------------------------------------------

export async function fetchMarketStatus(
  exchange = "US"
): Promise<MarketStatus> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30 });

  const res = await fetch(
    `${FINNHUB_BASE}/stock/market-status?exchange=${encodeURIComponent(exchange)}&token=${getApiKey()}`
  );
  if (!res.ok) {
    throw new Error(`Finnhub market-status request failed: ${res.status}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Market Holidays — cached with 'use cache' (holiday calendar rarely changes)
// ---------------------------------------------------------------------------

export async function fetchMarketHolidays(
  exchange = "US"
): Promise<MarketHoliday[]> {
  "use cache";
  cacheLife({ stale: 86400, revalidate: 86400 });

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
  cacheLife({ stale: 3600, revalidate: 3600 });

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
// Company News — 30-min cache
// ---------------------------------------------------------------------------

export async function fetchCompanyNews(
  symbol: string,
  from: string,
  to: string
): Promise<FinnhubNewsItem[]> {
  "use cache";
  cacheLife({ stale: 1800, revalidate: 1800 });

  const res = await fetch(
    `${FINNHUB_BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&token=${getApiKey()}`
  );
  if (!res.ok) {
    throw new Error(
      `Finnhub company-news request failed for ${symbol}: ${res.status}`
    );
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Recommendation Trends — cached hours (updated monthly by analysts)
// ---------------------------------------------------------------------------

export async function fetchRecommendationTrends(
  symbol: string
): Promise<FinnhubRecommendation[]> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 3600 });

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
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      priceVs52wHigh: null,
    };
  } catch (error) {
    console.error(`Failed to fetch stock detail for ${symbol}:`, error);
    return null;
  }
}
