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
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-2 text-xs tabular-nums">
        <span className="w-16 text-right text-zinc-500 dark:text-zinc-400">
          {formatValue(low)}
        </span>
        <div className="relative h-1.5 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-sm dark:border-zinc-900"
            style={{ left: `${clamped}%` }}
          />
        </div>
        <span className="w-16 text-zinc-500 dark:text-zinc-400">
          {formatValue(high)}
        </span>
      </div>
    </div>
  );
}
