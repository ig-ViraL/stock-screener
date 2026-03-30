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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3">
      <p className="mb-2 text-xs font-medium text-zinc-500">{label}</p>
      <div className="space-y-1.5 text-xs tabular-nums">
        <div className="relative h-2 rounded-full bg-zinc-700">
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-900 bg-blue-500 shadow"
            style={{ left: `${clamped}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-zinc-500">
          <span>Low {formatValue(low)}</span>
          <span>High {formatValue(high)}</span>
        </div>
        <div className="text-right text-zinc-400">
          Current <span className="font-semibold">{formatValue(current)}</span>
        </div>
      </div>
    </div>
  );
}
