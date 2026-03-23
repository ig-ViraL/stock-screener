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

export function formatRatio(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) return "—";
  return value.toFixed(2);
}

export function formatLargeNumber(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toFixed(2);
}

export function formatRelativeTime(unixSeconds: number): string {
  const now = Date.now();
  const diffMs = now - unixSeconds * 1000;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
