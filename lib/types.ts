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
