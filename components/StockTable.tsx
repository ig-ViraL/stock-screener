"use client";

import Link from "next/link";
import { useMemo, useEffect, useRef, useState } from "react";
import { applyFilters } from "@/lib/filters";
import { formatPrice, formatChange, formatPct, formatMarketCap } from "@/lib/format";
import { useStockFilters } from "@/hooks/useStockFilters";
import { useFinnhubWebSocket, type ConnectionStatus } from "@/hooks/useFinnhubWebSocket";
import { FilterBar } from "@/components/FilterBar";
import type { Stock } from "@/lib/types";

interface Props {
  initialStocks: Stock[];
}

export function StockTable({ initialStocks }: Props) {
  const { filters, activeFilterCount, setNumericFilter, toggleCapTier, toggleSector, clearFilters } =
    useStockFilters();

  // Stable symbol list derived from server data
  const symbols = useMemo(() => initialStocks.map((s) => s.symbol), [initialStocks]);

  const { priceMap, status } = useFinnhubWebSocket(symbols);

  // Flash animation: track which symbols had a price change in the latest flush
  const prevPricesRef = useRef<Map<string, number>>(new Map());
  const [flashedSymbols, setFlashedSymbols] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (priceMap.size === 0) return;

    const changed = new Set<string>();
    for (const [sym, price] of priceMap) {
      if (prevPricesRef.current.get(sym) !== price) changed.add(sym);
      prevPricesRef.current.set(sym, price);
    }
    if (changed.size === 0) return;

    setFlashedSymbols((prev) => new Set([...prev, ...changed]));

    const timer = setTimeout(() => {
      setFlashedSymbols((prev) => {
        const next = new Set(prev);
        for (const sym of changed) next.delete(sym);
        return next;
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [priceMap]);

  // Merge live WebSocket prices into the ISR snapshot
  const mergedStocks = useMemo(() => {
    if (priceMap.size === 0) return initialStocks;
    return initialStocks.map((stock) => {
      const livePrice = priceMap.get(stock.symbol);
      if (!livePrice) return stock;
      const change = livePrice - stock.previousClose;
      const percentChange =
        stock.previousClose > 0 ? (change / stock.previousClose) * 100 : 0;
      const priceVs52wHigh =
        stock.fiftyTwoWeekHigh && stock.fiftyTwoWeekHigh > 0
          ? ((livePrice - stock.fiftyTwoWeekHigh) / stock.fiftyTwoWeekHigh) * 100
          : null;
      return { ...stock, price: livePrice, change, percentChange, priceVs52wHigh };
    });
  }, [initialStocks, priceMap]);

  const sectors = useMemo(
    () => [...new Set(initialStocks.map((s) => s.industry).filter(Boolean))].sort(),
    [initialStocks]
  );

  const stocks = applyFilters(mergedStocks, filters);

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Connection status */}
      <div className="shrink-0 flex items-center justify-between gap-3">
        <WSStatusBadge status={status} />
      </div>

      <div className="shrink-0">
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

      {/* Table fills remaining height and scrolls internally */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-zinc-800">
        <div className="h-full overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3 text-right">% Change</th>
              <th className="px-4 py-3 text-right">Market Cap</th>
              <th className="px-4 py-3 text-right">52W High</th>
              <th className="px-4 py-3 text-right">vs 52W High</th>
              <th className="w-12 px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {stocks.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                  No stocks match the current filters.{" "}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-blue-400 underline hover:text-blue-300"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            ) : (
              stocks.map((stock) => (
                <StockRow
                  key={stock.symbol}
                  stock={stock}
                  flashed={flashedSymbols.has(stock.symbol)}
                />
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      <p className="shrink-0 text-right text-xs text-zinc-600">
        {stocks.length} of {initialStocks.length} stocks · base data refreshes every 55s
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WebSocket status badge
// ---------------------------------------------------------------------------
function WSStatusBadge({ status }: { status: ConnectionStatus }) {
  const config = {
    connected:    { dot: "bg-emerald-500 animate-pulse", label: "Live",         color: "text-emerald-400" },
    connecting:   { dot: "bg-amber-500 animate-pulse",   label: "Connecting…",  color: "text-amber-400"   },
    reconnecting: { dot: "bg-amber-500 animate-pulse",   label: "Reconnecting…",color: "text-amber-400"   },
    disconnected: { dot: "bg-red-500",                   label: "Disconnected", color: "text-red-400"     },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium ${config.color}`}>
      <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stock row
// ---------------------------------------------------------------------------
function StockRow({ stock, flashed }: { stock: Stock; flashed: boolean }) {
  const isUp = stock.percentChange >= 0;
  const changeColor = isUp ? "text-emerald-400" : "text-red-400";

  return (
    <tr
      className={`border-b border-zinc-800/50 transition-colors hover:bg-zinc-900/60 ${flashed ? "row-flash" : ""}`}
    >
      <td className="px-4 py-3">
        <Link
          href={`/stock/${stock.symbol}`}
          className="font-mono font-semibold text-zinc-100 hover:text-emerald-400"
        >
          {stock.symbol}
        </Link>
      </td>

      <td className="px-4 py-3 text-zinc-400">{stock.name}</td>

      <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-100">
        {stock.price > 0 ? formatPrice(stock.price) : "—"}
      </td>

      <td className={`px-4 py-3 text-right font-mono tabular-nums ${changeColor}`}>
        {stock.change !== 0 ? formatChange(stock.change) : "—"}
      </td>

      <td className={`px-4 py-3 text-right font-mono tabular-nums ${changeColor}`}>
        {formatPct(stock.percentChange)}
      </td>

      <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
        {stock.marketCap > 0 ? formatMarketCap(stock.marketCap) : "—"}
      </td>

      <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-400">
        {stock.fiftyTwoWeekHigh ? formatPrice(stock.fiftyTwoWeekHigh) : "—"}
      </td>

      <td className="px-4 py-3 text-right font-mono tabular-nums">
        {stock.priceVs52wHigh !== null ? (
          <span className={stock.priceVs52wHigh >= 0 ? "text-emerald-400" : "text-red-400"}>
            {formatPct(stock.priceVs52wHigh)}
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>

      <td className="px-2 py-3 text-center">
        <button
          type="button"
          disabled
          title="AI Insight (coming soon)"
          className="rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-400 disabled:cursor-not-allowed"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
