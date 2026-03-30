import { cacheLife } from "next/cache";
import { Suspense } from "react";
import { getAllStocks } from "@/lib/finnhub";
import { STOCK_SYMBOLS } from "@/lib/symbols";
import { StockTable } from "@/components/StockTable";
import { StockTableSkeleton } from "@/components/StockTableSkeleton";

/**
 * ISR page — cached and revalidated every 55 seconds.
 * Quotes are always fresh on revalidation; profiles + financials come from
 * their own longer-lived function-level caches (7 days / 1 day).
 * Filters run client-side on the cached stock data.
 */
async function StockData() {
  "use cache";
  cacheLife({ stale: 55, revalidate: 55, expire: 3600 });

  const stocks = await getAllStocks(STOCK_SYMBOLS);
  return <StockTable initialStocks={stocks} />;
}

export default function Home() {
  return (
    <div className="mx-auto max-w-screen-xl h-full px-6 py-8 flex flex-col">
      <Suspense fallback={<StockTableSkeleton />}>
        <StockData />
      </Suspense>
    </div>
  );
}
