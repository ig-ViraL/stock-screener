export function formatPrice(price: number): string {
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatMarketCap(capInMillions: number): string {
  if (capInMillions >= 1_000_000) {
    return `$${(capInMillions / 1_000_000).toFixed(1)}T`;
  }
  if (capInMillions >= 1_000) {
    return `$${(capInMillions / 1_000).toFixed(1)}B`;
  }
  return `$${capInMillions.toFixed(0)}M`;
}

export function formatPercent(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}`;
}
