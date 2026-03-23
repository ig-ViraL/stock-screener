import { Suspense } from "react";
import { connection } from "next/server";
import { StockTableSkeleton } from "@/components/StockTableSkeleton";
import { StockTable } from "@/components/StockTable";
import { fetchAllStocks } from "@/lib/finnhub";
import { STOCK_SYMBOLS } from "@/lib/symbols";

async function StockData() {
  await connection();
  const stocks = await fetchAllStocks(STOCK_SYMBOLS);
  return <StockTable initialStocks={stocks} />;
}

export default function Home() {
  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Stock Screener
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Real-time market data for {STOCK_SYMBOLS.length} stocks
          </p>
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
