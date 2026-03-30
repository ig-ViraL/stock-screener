import { getMarketInfo } from "@/lib/finnhub";
import { MarketStatusDropdown } from "./MarketStatusDropdown";

/**
 * Async Server Component — fetches market data and renders the interactive dropdown.
 * Data is cached via getMarketInfo() ('use cache', revalidate: 60s).
 * Wrap this in <Suspense> with <MarketStatusSkeleton> as fallback in the layout.
 */
export async function MarketStatus() {
  const data = await getMarketInfo();
  return <MarketStatusDropdown data={data} />;
}

/** Shown by Suspense while MarketStatus is loading. */
export function MarketStatusSkeleton() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-500">
      <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-600" />
      Loading&hellip;
    </span>
  );
}
