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
