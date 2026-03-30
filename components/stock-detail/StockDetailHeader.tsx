import { formatPrice, formatChange, formatPercent } from "@/lib/format";
import { DayRangeBar } from "./DayRangeBar";
import { StockDetail, FinnhubMetrics } from "@/lib/types";

interface Props {
  stock: StockDetail;
  financials: FinnhubMetrics | null;
}

export function StockDetailHeader({ stock, financials }: Props) {
  const isUp = stock.change >= 0;
  const changeColor = isUp ? "text-emerald-400" : "text-red-400";
  const changeBg   = isUp ? "bg-emerald-950/50" : "bg-red-950/50";

  const m = financials?.metric;
  const week52High = m?.["52WeekHigh"];
  const week52Low  = m?.["52WeekLow"];

  const stats = [
    { label: "Open",       value: formatPrice(stock.openPrice) },
    { label: "Prev Close", value: formatPrice(stock.previousClose) },
    { label: "Currency",   value: stock.currency || "—" },
    { label: "Exchange",   value: stock.exchange  || "—" },
  ];

  return (
    <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      {/* Logo + symbol + name */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {stock.logo && (
            <img
              src={stock.logo}
              alt={stock.name}
              width={48}
              height={48}
              className="h-12 w-12 rounded-lg border border-zinc-700 object-contain bg-white p-1"
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-100">{stock.symbol}</h1>
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
                {stock.exchange}
              </span>
            </div>
            <p className="text-sm text-zinc-500">
              {stock.name} &middot; {stock.industry}
            </p>
          </div>
        </div>

        {/* AI Insight placeholder */}
        <button
          disabled
          title="AI Insight (coming soon)"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-500 disabled:cursor-not-allowed"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          AI Insight
        </button>
      </div>

      {/* Price + change */}
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-3xl font-bold tabular-nums text-zinc-100">
          {formatPrice(stock.price)}
        </span>
        <span className={`rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${changeBg} ${changeColor}`}>
          {formatChange(stock.change)} ({formatPercent(stock.percentChange)})
        </span>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{s.label}</p>
            <p className="mt-1 text-base font-semibold tabular-nums text-zinc-100">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Range bars */}
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
