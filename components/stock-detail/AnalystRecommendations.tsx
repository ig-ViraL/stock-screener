import { getRecommendationTrends } from "@/lib/finnhub";

/**
 * Analyst recommendations — cached 1 day.
 * Analysts update monthly; 1-day cache is conservative and correct.
 */
export async function AnalystRecommendations({ symbol }: { symbol: string }) {
  const trends = await getRecommendationTrends(symbol);

  if (!trends.length) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-100">Analyst Recommendations</h2>
        <p className="text-sm text-zinc-500">No analyst data available.</p>
      </div>
    );
  }

  const latest = trends[0];
  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;

  if (total === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-100">Analyst Recommendations</h2>
        <p className="text-sm text-zinc-500">No recommendations in this period.</p>
      </div>
    );
  }

  const segments = [
    { label: "Strong Buy",  count: latest.strongBuy,  color: "bg-emerald-600" },
    { label: "Buy",         count: latest.buy,         color: "bg-emerald-400" },
    { label: "Hold",        count: latest.hold,        color: "bg-zinc-500"    },
    { label: "Sell",        count: latest.sell,        color: "bg-red-400"     },
    { label: "Strong Sell", count: latest.strongSell,  color: "bg-red-600"     },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Analyst Recommendations</h2>
        <span className="text-xs text-zinc-500">{latest.period}</span>
      </div>

      {/* Stacked bar */}
      <div className="flex h-5 w-full overflow-hidden rounded-full">
        {segments.map(
          (seg) =>
            seg.count > 0 && (
              <div
                key={seg.label}
                className={`${seg.color} transition-all`}
                style={{ width: `${(seg.count / total) * 100}%` }}
                title={`${seg.label}: ${seg.count}`}
              />
            )
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map(
          (seg) =>
            seg.count > 0 && (
              <div key={seg.label} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${seg.color}`} />
                <span className="text-zinc-500">{seg.label}</span>
                <span className="font-semibold text-zinc-200">{seg.count}</span>
              </div>
            )
        )}
      </div>
    </div>
  );
}
