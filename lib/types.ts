// ---------------------------------------------------------------------------
// Stock data
// ---------------------------------------------------------------------------

export interface FinnhubQuote {
  c: number;   // current price
  d: number;   // change
  dp: number;  // change percent
  h: number;   // day high
  l: number;   // day low
  o: number;   // open
  pc: number;  // previous close
  t: number;   // timestamp
}

export interface FinnhubProfile {
  country: string;
  currency: string;
  exchange: string;
  finnhubIndustry: string;
  ipo: string;
  logo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
}

export interface FinnhubMetrics {
  metric: {
    "52WeekHigh"?: number;
    "52WeekLow"?: number;
    "52WeekHighDate"?: string;
    "52WeekLowDate"?: string;
    beta?: number;
    peBasicExclExtraTTM?: number;
    pbAnnual?: number;
    dividendYieldIndicatedAnnual?: number;
    roeTTM?: number;
    netProfitMarginTTM?: number;
    "10DayAverageTradingVolume"?: number;
    [key: string]: number | string | undefined;
  };
  metricType: string;
  symbol: string;
}

export interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface FinnhubRecommendation {
  buy: number;
  hold: number;
  period: string;
  sell: number;
  strongBuy: number;
  strongSell: number;
  symbol: string;
}

/** Normalised stock row used throughout the app */
export interface Stock {
  symbol: string;
  name: string;
  industry: string;
  price: number;
  previousClose: number;
  change: number;
  percentChange: number;
  highToday: number;
  lowToday: number;
  openPrice: number;
  marketCap: number;            // in millions USD
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  priceVs52wHigh: number | null; // ((price - 52wHigh) / 52wHigh) * 100
  peRatio: number | null;
}

/** Extended stock data for the detail page */
export interface StockDetail extends Stock {
  exchange: string;
  currency: string;
  logo: string;
  ipo: string;
  weburl: string;
  country: string;
  shareOutstanding: number;
}

// ---------------------------------------------------------------------------
// Market status
// ---------------------------------------------------------------------------

export type MarketSession = "pre-market" | "regular" | "post-market" | null;

export interface MarketStatus {
  exchange: string;
  holiday: string | null;
  isOpen: boolean;
  session: MarketSession;
  timezone: string;
  t: number;
}

export interface MarketHoliday {
  eventName: string;
  atDate: string;
  tradingHour: string;
}

export interface MarketHolidayResponse {
  data: MarketHoliday[];
  exchange: string;
  timezone: string;
}

export interface MarketInfo {
  status: MarketStatus;
  holidays: MarketHoliday[];
}
