import { cacheLife } from "next/cache";
import type {
  MarketStatus,
  MarketHoliday,
  MarketHolidayResponse,
  MarketInfo,
  FinnhubQuote,
  FinnhubProfile,
  FinnhubMetrics,
  FinnhubNewsItem,
  FinnhubRecommendation,
  Stock,
  StockDetail,
} from "./types";

const API_KEY = process.env.FINNHUB_API_KEY!;
const BASE = "https://finnhub.io/api/v1";

/**
 * Fetches current market status + upcoming holidays for a given exchange.
 *
 * 'use cache' makes this a cache boundary — Next.js caches the return value.
 * Internal fetch calls are uncached (Next.js 16 default: no implicit fetch cache),
 * so they always hit Finnhub when the cache is cold.
 *
 * cacheLife: revalidate every 60s (market status can change), expire after 1 hour.
 * Holidays are lumped in — they rarely change, 60s refresh is acceptable overhead.
 */
export async function getMarketInfo(exchange = "US"): Promise<MarketInfo> {
  "use cache";
  cacheLife({ stale: 0, revalidate: 60, expire: 3600 });

  const [statusRes, holidaysRes] = await Promise.all([
    fetch(`${BASE}/stock/market-status?exchange=${exchange}&token=${API_KEY}`),
    fetch(`${BASE}/stock/market-holiday?exchange=${exchange}&token=${API_KEY}`),
  ]);

  if (!statusRes.ok)
    throw new Error(`Finnhub market-status: HTTP ${statusRes.status}`);
  if (!holidaysRes.ok)
    throw new Error(`Finnhub market-holiday: HTTP ${holidaysRes.status}`);

  const status: MarketStatus = await statusRes.json();
  const holidayBody: MarketHolidayResponse = await holidaysRes.json();

  return { status, holidays: holidayBody.data ?? [] };
}

// ---------------------------------------------------------------------------
// Stock data
// ---------------------------------------------------------------------------

/**
 * Company profile: name, industry, market cap.
 * Changes rarely — cached for 7 days per symbol.
 */
export async function getStockProfile(symbol: string): Promise<FinnhubProfile> {
  "use cache";
  cacheLife({ stale: 0, revalidate: 604800, expire: 604800 }); // 7 days

  const res = await fetch(`${BASE}/stock/profile2?symbol=${symbol}&token=${API_KEY}`);
  if (!res.ok) throw new Error(`Finnhub profile [${symbol}]: HTTP ${res.status}`);
  return res.json();
}

/**
 * 52-week high/low, P/E ratio, beta, etc.
 * Updates daily — cached for 1 day per symbol.
 */
export async function getBasicFinancials(symbol: string): Promise<FinnhubMetrics> {
  "use cache";
  cacheLife({ stale: 0, revalidate: 86400, expire: 86400 }); // 1 day

  const res = await fetch(`${BASE}/stock/metric?symbol=${symbol}&metric=all&token=${API_KEY}`);
  if (!res.ok) throw new Error(`Finnhub financials [${symbol}]: HTTP ${res.status}`);
  return res.json();
}

/**
 * Current price snapshot. No cache — must be fresh on every ISR revalidation.
 * WebSocket will replace this for real-time updates later.
 */
export async function getQuote(symbol: string): Promise<FinnhubQuote> {
  const res = await fetch(`${BASE}/quote?symbol=${symbol}&token=${API_KEY}`);
  if (!res.ok) throw new Error(`Finnhub quote [${symbol}]: HTTP ${res.status}`);
  return res.json();
}

/**
 * Assembles a normalised Stock from the three Finnhub APIs.
 * Profile + financials come from cache; quote is always fresh.
 */
async function fetchStock(symbol: string): Promise<Stock> {
  const [quote, profile, metrics] = await Promise.all([
    getQuote(symbol),
    getStockProfile(symbol),
    getBasicFinancials(symbol),
  ]);

  const fiftyTwoWeekHigh = metrics.metric["52WeekHigh"] ?? null;

  return {
    symbol,
    name:          profile.name,
    industry:      profile.finnhubIndustry,
    price:         quote.c,
    previousClose: quote.pc,
    change:        quote.d,
    percentChange: quote.dp,
    highToday:     quote.h,
    lowToday:      quote.l,
    openPrice:     quote.o,
    marketCap:     profile.marketCapitalization,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow:  metrics.metric["52WeekLow"] ?? null,
    priceVs52wHigh:
      fiftyTwoWeekHigh && fiftyTwoWeekHigh > 0
        ? ((quote.c - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100
        : null,
    peRatio: metrics.metric.peBasicExclExtraTTM ?? null,
  };
}

/**
 * Fetches all 25 stocks with concurrency of 3 to stay within Finnhub rate limits.
 * Uses Promise.allSettled so one failure doesn't block the rest.
 */
export async function getAllStocks(symbols: readonly string[]): Promise<Stock[]> {
  const results: Stock[] = [];
  const CONCURRENCY = 3;

  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const batch = symbols.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(fetchStock));
    for (const result of settled) {
      if (result.status === "fulfilled") results.push(result.value);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Stock detail page data
// ---------------------------------------------------------------------------

/**
 * Assembles extended stock data for the detail page.
 * Quote is always fresh (no cache). Profile comes from the 7-day cache.
 * No 'use cache' here — the quote must be live on every page load.
 */
export async function getStockDetail(symbol: string): Promise<StockDetail | null> {
  try {
    const [quote, profile] = await Promise.all([
      getQuote(symbol),
      getStockProfile(symbol), // cache HIT after warm (7 days)
    ]);

    if (!quote.c || !profile.name) return null;

    return {
      symbol,
      name:             profile.name,
      industry:         profile.finnhubIndustry,
      price:            quote.c,
      previousClose:    quote.pc,
      change:           quote.d,
      percentChange:    quote.dp,
      highToday:        quote.h,
      lowToday:         quote.l,
      openPrice:        quote.o,
      marketCap:        profile.marketCapitalization,
      exchange:         profile.exchange,
      currency:         profile.currency,
      logo:             profile.logo,
      ipo:              profile.ipo,
      weburl:           profile.weburl,
      country:          profile.country,
      shareOutstanding: profile.shareOutstanding,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow:  null,
      priceVs52wHigh:   null,
      peRatio:          null,
    };
  } catch (err) {
    console.error(`getStockDetail failed for ${symbol}:`, err);
    return null;
  }
}

/**
 * Analyst recommendation trends.
 * Analysts update monthly — cached for 1 day is more than sufficient.
 */
export async function getRecommendationTrends(
  symbol: string
): Promise<FinnhubRecommendation[]> {
  "use cache";
  cacheLife({ stale: 0, revalidate: 86400, expire: 86400 * 7 });

  const res = await fetch(
    `${BASE}/stock/recommendation?symbol=${symbol}&token=${API_KEY}`
  );
  if (!res.ok)
    throw new Error(`Finnhub recommendation [${symbol}]: HTTP ${res.status}`);
  return res.json();
}

/**
 * Company news for the past 7 days.
 * Dates are computed inside the cached function so the cache key is just the symbol.
 * Refreshes every 30 minutes — news trickles in throughout the day.
 */
export async function getCompanyNews(symbol: string): Promise<FinnhubNewsItem[]> {
  "use cache";
  cacheLife({ stale: 0, revalidate: 1800, expire: 86400 });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const from = weekAgo.toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);

  const res = await fetch(
    `${BASE}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${API_KEY}`
  );
  if (!res.ok)
    throw new Error(`Finnhub company-news [${symbol}]: HTTP ${res.status}`);
  return res.json();
}
