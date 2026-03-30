interface DayRangeBarProps {
  low: number;
  high: number;
  current: number;
  label: string;
  formatValue?: (v: number) => string;
}

const defaultFormat = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD" });

export function DayRangeBar({
  low,
  high,
  current,
  label,
  formatValue = defaultFormat,
}: DayRangeBarProps) {
  const range = high - low;
  const pct = range > 0 ? ((current - low) / range) * 100 : 50;
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium">{label}</span>
      </div>
      <div className="space-y-1.5 text-xs tabular-nums">
        <div className="relative h-2 rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-zinc-300 to-zinc-400 opacity-50 dark:from-zinc-700 dark:to-zinc-600" />
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow dark:border-zinc-900"
            style={{ left: `${clamped}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">
            Low {formatValue(low)}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            High {formatValue(high)}
          </span>
        </div>
        <div className="text-right text-zinc-600 dark:text-zinc-300">
          Current <span className="font-semibold">{formatValue(current)}</span>
        </div>
      </div>
    </div>
  );
}
