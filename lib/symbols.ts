export const STOCK_SYMBOLS = [
  "AAPL",  // Apple
  "MSFT",  // Microsoft
  "GOOGL", // Alphabet
  "AMZN",  // Amazon
  "NVDA",  // NVIDIA
  "META",  // Meta
  "TSLA",  // Tesla
  "JPM",   // JP Morgan
  "V",     // Visa
  "JNJ",   // Johnson & Johnson
  "WMT",   // Walmart
  "PG",    // Procter & Gamble
  "MA",    // Mastercard
  "UNH",   // UnitedHealth
  "HD",    // Home Depot
  "DIS",   // Disney
  "BAC",   // Bank of America
  "XOM",   // ExxonMobil
  "NFLX",  // Netflix
  "COST",  // Costco
  "PEP",   // PepsiCo
  "KO",    // Coca-Cola
  "CSCO",  // Cisco
  "INTC",  // Intel
  "CRM",   // Salesforce
] as const;

export type StockSymbol = (typeof STOCK_SYMBOLS)[number];
