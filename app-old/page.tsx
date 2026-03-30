import { Suspense } from "react";
import { connection } from "next/server";
import { StockTableSkeleton } from "@/components/StockTableSkeleton";
import { StockTable } from "@/components/StockTable";
import { MarketStatusIndicator } from "@/components/MarketStatusIndicator";
import {
  fetchAllStocks,
  fetchMarketStatus,
  fetchMarketHolidays,
} from "@/lib/finnhub";
import { STOCK_SYMBOLS } from "@/lib/symbols";
import type { MarketInfo } from "@/lib/types";

async function StockData() {
  await connection();
  const stocks = await fetchAllStocks(STOCK_SYMBOLS.slice(0, 5));
  return <StockTable initialStocks={stocks} />;
}

async function MarketStatusData() {
  await connection();
  let data: MarketInfo | null = null;
  try {
    const [status, holidays] = await Promise.all([
      fetchMarketStatus("US"),
      fetchMarketHolidays("US"),
    ]);
    data = { status, holidays };
  } catch {
    /* Client will retry via polling */
  }
  return <MarketStatusIndicator initialData={data} />;
}

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Stock Screener
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Real-time market data for {STOCK_SYMBOLS.length} stocks
            </p>
          </div>
          <Suspense
            fallback={
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-300 dark:bg-zinc-600" />
                Loading&hellip;
              </span>
            }
          >
            <MarketStatusData />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col px-4 py-6">
        <Suspense fallback={<StockTableSkeleton />}>
          <StockData />
        </Suspense>
      </main>
    </div>
  );
}
