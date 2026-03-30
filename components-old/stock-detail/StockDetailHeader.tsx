import { DayRangeBar } from "./DayRangeBar";
import { InsightButton } from "./InsightButton";
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

  const m = metrics?.metric;
  const insightData = {
    symbol: stock.symbol,
    name: stock.name,
    price: stock.price,
    change: stock.change,
    percentChange: stock.percentChange,
    marketCap: stock.marketCap,
    industry: stock.industry,
    metrics: m
      ? {
          peRatio: m.peBasicExclExtraTTM as number | undefined,
          eps: m.epsBasicExclExtraItemsTTM as number | undefined,
          beta: m.beta as number | undefined,
          dividendYield: m.dividendYieldIndicatedAnnual as number | undefined,
          roe: m.roeTTM as number | undefined,
          debtToEquity: m.totalDebtToEquityQuarterly as number | undefined,
        }
      : undefined,
  };

  const week52High = m?.["52WeekHigh"];
  const week52Low = m?.["52WeekLow"];
  const stats = [
    { label: "Open", value: formatPrice(stock.openPrice) },
    { label: "Prev Close", value: formatPrice(stock.previousClose) },
    { label: "Mkt Cap", value: formatMarketCap(stock.marketCap) },
    { label: "Currency", value: stock.currency },
  ];

  return (
    <div className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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

        <InsightButton stock={insightData} />
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/60"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {stat.label}
            </p>
            <p className="mt-1 text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
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
