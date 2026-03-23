"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useFinnhubWebSocket } from "@/hooks/useFinnhubWebSocket";
import { useStockFilters } from "@/hooks/useStockFilters";
import { ConnectionStatusBadge } from "@/components/ConnectionStatus";
import { FilterBar } from "@/components/FilterBar";
import {
  formatPrice,
  formatChange,
  formatPercent,
  formatMarketCap,
} from "@/lib/format";
import { applyFilters } from "@/lib/filters";
import type { Stock } from "@/lib/types";

const FLASH_DURATION_MS = 2_000;

interface StockTableProps {
  initialStocks: Stock[];
}

export function StockTable({ initialStocks }: StockTableProps) {
  const [stocks, setStocks] = useState<Stock[]>(initialStocks);
  const [flashedSymbols, setFlashedSymbols] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const {
    filters,
    activeFilterCount,
    setNumericFilter,
    toggleCapTier,
    toggleSector,
    clearFilters,
  } = useStockFilters();

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

          return { ...stock, price: newPrice, change, percentChange };
        })
      );
      flashRows(updates.keys());
    },
    [flashRows]
  );

  const symbols = stocks.map((s) => s.symbol);

  const { status } = useFinnhubWebSocket({
    symbols,
    onPriceUpdate: handlePriceUpdate,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/stocks");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStocks(data.stocks);
    } catch {
      setRefreshError("Failed to fetch latest prices. Try again.");
    } finally {
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
            </tr>
          </thead>
          <tbody>
            {filteredStocks.map((stock) => {
              const isPositive = stock.change >= 0;
              const changeColor = isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400";

              const isFlashing = flashedSymbols.has(stock.symbol);

              return (
                <tr
                  key={stock.symbol}
                  className={`border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40 ${isFlashing ? "row-flash" : ""}`}
                >
                  <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                    {stock.symbol}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {stock.name}
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
                </tr>
              );
            })}
            {filteredStocks.length === 0 && (
              <tr>
                <td
                  colSpan={6}
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
    </div>
  );
}
