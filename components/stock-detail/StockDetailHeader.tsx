import { DayRangeBar } from "./DayRangeBar";
import {
  formatPrice,
  formatChange,
  formatPercent,
  formatMarketCap,
} from "@/lib/format";
import type { StockDetail, FinnhubMetrics } from "@/lib/types";

interface StockDetailHeaderProps {
  stock: StockDetail;
  metrics: FinnhubMetrics | null;
}

export function StockDetailHeader({
  stock,
  metrics,
}: StockDetailHeaderProps) {
  const isPositive = stock.change >= 0;
  const changeColor = isPositive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
  const changeBg = isPositive
    ? "bg-emerald-50 dark:bg-emerald-950/40"
    : "bg-red-50 dark:bg-red-950/40";

  const week52High = metrics?.metric["52WeekHigh"];
  const week52Low = metrics?.metric["52WeekLow"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {stock.logo && (
            <img
              src={stock.logo}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-lg border border-zinc-200 object-contain dark:border-zinc-700"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {stock.symbol}
              </h1>
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {stock.exchange}
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {stock.name} &middot; {stock.industry}
            </p>
          </div>
        </div>

      </div>

      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
          {formatPrice(stock.price)}
        </span>
        <span
          className={`rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${changeBg} ${changeColor}`}
        >
          {formatChange(stock.change)} ({formatPercent(stock.percentChange)})
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Open</span>
          <span className="ml-2 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
            {formatPrice(stock.openPrice)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Prev Close</span>
          <span className="ml-2 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
            {formatPrice(stock.previousClose)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Mkt Cap</span>
          <span className="ml-2 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
            {formatMarketCap(stock.marketCap)}
          </span>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Currency</span>
          <span className="ml-2 font-medium text-zinc-900 dark:text-zinc-100">
            {stock.currency}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DayRangeBar
          low={stock.lowToday}
          high={stock.highToday}
          current={stock.price}
          label="Day Range"
        />
        {typeof week52Low === "number" && typeof week52High === "number" && (
          <DayRangeBar
            low={week52Low}
            high={week52High}
            current={stock.price}
            label="52-Week Range"
          />
        )}
      </div>
    </div>
  );
}
