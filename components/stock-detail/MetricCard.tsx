interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
}

export function MetricCard({ label, value, sublabel }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-100">{value}</p>
      {sublabel && <p className="mt-0.5 text-xs text-zinc-600">{sublabel}</p>}
    </div>
  );
}
