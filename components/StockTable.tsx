"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useFinnhubWebSocket } from "@/hooks/useFinnhubWebSocket";
import { useStockFilters } from "@/hooks/useStockFilters";
import { ConnectionStatusBadge } from "@/components/ConnectionStatus";
import { FilterBar } from "@/components/FilterBar";
import {
  formatPrice,
  formatChange,
  formatPercent,
  formatNullablePercent,
  formatMarketCap,
} from "@/lib/format";
import { applyFilters } from "@/lib/filters";
import { InsightModal } from "@/components/InsightModal";
import type { Stock } from "@/lib/types";
import { STOCK_SYMBOLS } from "@/lib/symbols";

const FLASH_DURATION_MS = 2_000;
const BATCH_SIZE = 5;
const INTER_BATCH_DELAY_MS = 900;
const MAX_BATCH_ATTEMPTS = 3;

interface StockTableProps {
  initialStocks: Stock[];
}

export function StockTable({ initialStocks }: StockTableProps) {
  const [stocks, setStocks] = useState<Stock[]>(initialStocks);
  const [flashedSymbols, setFlashedSymbols] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [insightStock, setInsightStock] = useState<Stock | null>(null);
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const isBatchLoadingRef = useRef(false);
  // Capture loaded symbols at mount only. Using a ref prevents the batch-load
  // effect from re-running when the parent RSC re-renders (e.g. on filter URL
  // changes) and passes a new initialStocks array reference with the same data.
  const initialLoadedSymbolsRef = useRef(
    new Set(initialStocks.map((s) => s.symbol))
  );
  // React Compiler cannot statically prove Map construction is side-effect-free
  // across module boundaries; empty deps guarantees a single allocation for the
  // component lifetime regardless of re-render frequency from WebSocket updates.
  const symbolIndex = useMemo(() => {
    const m = new Map<string, number>();
    STOCK_SYMBOLS.forEach((s, i) => m.set(s, i));
    return m;
  }, []);

  const {
    filters,
    activeFilterCount,
    setNumericFilter,
    toggleCapTier,
    toggleSector,
    clearFilters,
  } = useStockFilters();

  // Deriving unique sorted sectors on every render would rebuild the Set and
  // sort on each WebSocket price tick. The Compiler optimises pure renders but
  // not arbitrary array→Set→sort derivations; memoising on stocks reference
  // change keeps FilterBar stable during high-frequency price updates.
  const sectors = useMemo(() => {
    const set = new Set(stocks.map((s) => s.industry).filter(Boolean));
    return [...set].sort();
  }, [stocks]);

  const filteredStocks = applyFilters(stocks, filters);

  const flashRows = useCallback((symbols: Iterable<string>) => {
    setFlashedSymbols((prev) => {
      const next = new Set(prev);
      for (const sym of symbols) {
        next.add(sym);

        const existing = flashTimers.current.get(sym);
        if (existing) clearTimeout(existing);

        flashTimers.current.set(
          sym,
          setTimeout(() => {
            flashTimers.current.delete(sym);
            setFlashedSymbols((s) => {
              const n = new Set(s);
              n.delete(sym);
              return n;
            });
          }, FLASH_DURATION_MS)
        );
      }
      return next;
    });
  }, []);

  const handlePriceUpdate = useCallback(
    (updates: Map<string, number>) => {
      setStocks((prev) =>
        prev.map((stock) => {
          const newPrice = updates.get(stock.symbol);
          if (newPrice === undefined) return stock;

          const change = newPrice - stock.previousClose;
          const percentChange = (change / stock.previousClose) * 100;
          const priceVs52wHigh =
            stock.fiftyTwoWeekHigh && stock.fiftyTwoWeekHigh > 0
              ? ((newPrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) *
                100
              : null;

          return {
            ...stock,
            price: newPrice,
            change,
            percentChange,
            priceVs52wHigh:
              priceVs52wHigh !== null
                ? Number(priceVs52wHigh.toFixed(2))
                : null,
          };
        })
      );
      flashRows(updates.keys());
    },
    [flashRows]
  );

  const sleep = useCallback((ms: number) => {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }, []);

  const mergeStocksBySymbol = useCallback(
    (incoming: Stock[]) => {
      if (incoming.length === 0) return;
      setStocks((prev) => {
        const map = new Map(prev.map((s) => [s.symbol, s]));
        for (const stock of incoming) map.set(stock.symbol, stock);

        const merged = Array.from(map.values());
        merged.sort(
          (a, b) => (symbolIndex.get(a.symbol) ?? 0) - (symbolIndex.get(b.symbol) ?? 0)
        );
        return merged;
      });
    },
    [symbolIndex]
  );

  const fetchStocksCore = useCallback(async (symbols: string[]) => {
    const qs = new URLSearchParams({ symbols: symbols.join(",") });

    const res = await fetch(`/api/stocks?${qs}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = (await res.json()) as { stocks: Stock[] };
    return data.stocks;
  }, []);

  const fetchStocksCoreWithRetries = useCallback(
    async (requestedSymbols: string[]) => {
      const resultMap = new Map<string, Stock>();
      let pendingSymbols = requestedSymbols.slice();

      for (let attempt = 0; attempt < MAX_BATCH_ATTEMPTS; attempt++) {
        if (pendingSymbols.length === 0) break;

        const batchStocks = await fetchStocksCore(pendingSymbols);
        for (const stock of batchStocks) resultMap.set(stock.symbol, stock);

        pendingSymbols = pendingSymbols.filter(
          (sym) => !resultMap.has(sym)
        );

        if (pendingSymbols.length === 0) break;
        await sleep(INTER_BATCH_DELAY_MS * (attempt + 1));
      }

      return requestedSymbols
        .map((sym) => resultMap.get(sym))
        .filter((s): s is Stock => Boolean(s));
    },
    [fetchStocksCore, sleep]
  );

  useEffect(() => {
    // Incrementally load the rest of the allowlisted symbols in batches of 5.
    // This keeps Finnhub calls low enough to avoid rate limiting and lets the
    // user see rows immediately.
    if (isBatchLoadingRef.current) return;

    const loadedSymbols = new Set(initialLoadedSymbolsRef.current);
    const remainingSymbols = STOCK_SYMBOLS.filter(
      (sym) => !loadedSymbols.has(sym)
    );

    if (remainingSymbols.length === 0) return;

    let cancelled = false;
    isBatchLoadingRef.current = true;

    (async () => {
      try {
        for (
          let index = 0;
          index < remainingSymbols.length;
          index += BATCH_SIZE
        ) {
          if (cancelled) return;
          const batchSymbols = remainingSymbols.slice(index, index + BATCH_SIZE);
          const batchStocks = await fetchStocksCoreWithRetries(batchSymbols);
          mergeStocksBySymbol(batchStocks);
          for (const stock of batchStocks) loadedSymbols.add(stock.symbol);
          await sleep(INTER_BATCH_DELAY_MS);
        }

        // If we hit occasional rate limiting, retry just the missing symbols once
        // more to try to keep the UI at >= 20 visible rows.
        if (!cancelled && loadedSymbols.size < 20) {
          const missingSymbols = remainingSymbols.filter(
            (sym) => !loadedSymbols.has(sym)
          );

          for (let index = 0; index < missingSymbols.length; index += BATCH_SIZE) {
            if (cancelled) return;
            const batchSymbols = missingSymbols.slice(
              index,
              index + BATCH_SIZE
            );
            const batchStocks = await fetchStocksCoreWithRetries(batchSymbols);
            mergeStocksBySymbol(batchStocks);
            for (const stock of batchStocks) loadedSymbols.add(stock.symbol);
            await sleep(INTER_BATCH_DELAY_MS);
          }
        }
      } catch (err) {
        console.error("[StockTable] Failed incremental load:", err);
        if (!cancelled) {
          setRefreshError(
            "Failed to load all stocks (rate limited). Some may be missing."
          );
        }
      } finally {
        isBatchLoadingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      isBatchLoadingRef.current = false;
    };
  }, [fetchStocksCoreWithRetries, mergeStocksBySymbol, sleep]);

  const symbols = useMemo(() => stocks.map((s) => s.symbol), [stocks]);

  const { status } = useFinnhubWebSocket({
    symbols,
    onPriceUpdate: handlePriceUpdate,
  });

  const handleRefresh = async () => {
    if (isBatchLoadingRef.current) return;
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      isBatchLoadingRef.current = true;
      for (let i = 0; i < STOCK_SYMBOLS.length; i += BATCH_SIZE) {
        const batchSymbols = STOCK_SYMBOLS.slice(i, i + BATCH_SIZE);
        const batchStocks = await fetchStocksCoreWithRetries(batchSymbols);
        mergeStocksBySymbol(batchStocks);
        await sleep(INTER_BATCH_DELAY_MS);
      }
    } catch {
      setRefreshError("Failed to fetch latest prices. Try again.");
    } finally {
      isBatchLoadingRef.current = false;
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <ConnectionStatusBadge status={status} />

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
        >
          {isRefreshing ? "Refreshing\u2026" : "Fetch Latest Prices"}
        </button>
      </div>

      <div className="mb-4 shrink-0">
        <FilterBar
          filters={filters}
          activeFilterCount={activeFilterCount}
          sectors={sectors}
          onNumericFilter={setNumericFilter}
          onToggleCapTier={toggleCapTier}
          onToggleSector={toggleSector}
          onClear={clearFilters}
        />
      </div>

      {refreshError && (
        <div className="mb-4 shrink-0 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {refreshError}
        </div>
      )}

      <div className="mb-2 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
        Showing {filteredStocks.length} of {stocks.length} stocks
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-zinc-200 bg-zinc-100 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3 text-right">% Change</th>
              <th className="px-4 py-3 text-right">Market Cap</th>
              <th className="px-4 py-3 text-right">52W High</th>
              <th className="px-4 py-3 text-right">vs 52W High</th>
              <th className="w-12 px-2 py-3 text-center">
                <span className="sr-only">AI Insight</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredStocks.map((stock) => {
              const isPositive = stock.change >= 0;
              const changeColor = isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400";
              const vs52Color =
                stock.priceVs52wHigh === null
                  ? "text-zinc-500 dark:text-zinc-400"
                  : stock.priceVs52wHigh >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400";

              const isFlashing = flashedSymbols.has(stock.symbol);

              return (
                <tr
                  key={stock.symbol}
                  className={`border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40 ${isFlashing ? "row-flash" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                    <Link
                      href={`/stock/${stock.symbol}`}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {stock.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    <Link href={`/stock/${stock.symbol}`} className="hover:underline">
                      {stock.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {formatPrice(stock.price)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${changeColor}`}
                  >
                    {formatChange(stock.change)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${changeColor}`}
                  >
                    {formatPercent(stock.percentChange)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {formatMarketCap(stock.marketCap)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                    {stock.fiftyTwoWeekHigh !== null
                      ? formatPrice(stock.fiftyTwoWeekHigh)
                      : "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${vs52Color}`}
                  >
                    {formatNullablePercent(stock.priceVs52wHigh)}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInsightStock(stock);
                      }}
                      title="AI Analysis"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-violet-500 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-violet-400 dark:hover:bg-violet-950/40 dark:hover:text-violet-300"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredStocks.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-12 text-center"
                >
                  <p className="text-zinc-500 dark:text-zinc-400">
                    No stocks match your filters.
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Clear all filters
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {insightStock ? (
        <InsightModal
          isOpen={true}
          onClose={() => setInsightStock(null)}
          stock={insightStock}
        />
      ) : null}
    </div>
  );
}
