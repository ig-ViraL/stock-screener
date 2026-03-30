export function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

export function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Alias kept consistent with old codebase */
export function formatPercent(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatRatio(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "—";
  return value.toFixed(2);
}

export function formatRelativeTime(unixSeconds: number): string {
  const diffMs = Date.now() - unixSeconds * 1000;
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1)  return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatMarketCap(millionsUSD: number): string {
  if (millionsUSD >= 1_000_000) {
    return `$${(millionsUSD / 1_000_000).toFixed(2)}T`;
  }
  if (millionsUSD >= 1_000) {
    return `$${(millionsUSD / 1_000).toFixed(1)}B`;
  }
  return `$${millionsUSD.toFixed(0)}M`;
}
