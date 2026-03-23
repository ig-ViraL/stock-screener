export interface FinnhubQuote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
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
  marketCap: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  priceVs52wHigh: number | null;
}

export interface WebSocketTrade {
  p: number;
  s: string;
  t: number;
  v: number;
}

export type ConnectionStatus =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected";

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

// ---------------------------------------------------------------------------
// Stock detail — Finnhub response shapes
// ---------------------------------------------------------------------------

export interface FinnhubMetrics {
  metric: {
    "10DayAverageTradingVolume"?: number;
    "52WeekHigh"?: number;
    "52WeekHighDate"?: string;
    "52WeekLow"?: number;
    "52WeekLowDate"?: string;
    beta?: number;
    dividendYieldIndicatedAnnual?: number;
    epsBasicExclExtraItemsTTM?: number;
    epsGrowthTTMYoy?: number;
    netProfitMarginTTM?: number;
    peBasicExclExtraTTM?: number;
    pbAnnual?: number;
    roeTTM?: number;
    revenuePerShareTTM?: number;
    totalDebtToEquityQuarterly?: number;
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

export interface StockDetail extends Stock {
  exchange: string;
  currency: string;
  logo: string;
  ipo: string;
  weburl: string;
  country: string;
  shareOutstanding: number;
}
