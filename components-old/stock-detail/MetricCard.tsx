interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
}

export function MetricCard({ label, value, sublabel }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
      {sublabel && (
        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
          {sublabel}
        </p>
      )}
    </div>
  );
}
