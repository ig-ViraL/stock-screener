import { getBasicFinancials } from "@/lib/finnhub";
import { formatRatio } from "@/lib/format";
import { MetricCard } from "./MetricCard";

/**
 * Financials data — cached 1 day at function level.
 * Streams in essentially instantly after first cache warm.
 */
export async function KeyMetrics({ symbol }: { symbol: string }) {
  const data = await getBasicFinancials(symbol);
  const m = data.metric;

  const sections = [
    {
      title: "Valuation",
      metrics: [
        { label: "P/E Ratio (TTM)", value: formatRatio(m.peBasicExclExtraTTM) },
        { label: "Price / Book",    value: formatRatio(m.pbAnnual) },
        {
          label: "EPS (TTM)",
          value: m.epsBasicExclExtraItemsTTM !== undefined
            ? `$${(m.epsBasicExclExtraItemsTTM as number).toFixed(2)}`
            : "—",
        },
      ],
    },
    {
      title: "Profitability",
      metrics: [
        { label: "ROE (TTM)",          value: m.roeTTM !== undefined ? `${(m.roeTTM as number).toFixed(2)}%` : "—" },
        { label: "Net Margin (TTM)",   value: m.netProfitMarginTTM !== undefined ? `${(m.netProfitMarginTTM as number).toFixed(2)}%` : "—" },
        { label: "Revenue / Share",    value: m.revenuePerShareTTM !== undefined ? `$${(m.revenuePerShareTTM as number).toFixed(2)}` : "—" },
      ],
    },
    {
      title: "Risk",
      metrics: [
        { label: "Beta",          value: formatRatio(m.beta as number | undefined), sublabel: "Volatility vs market" },
        { label: "Debt / Equity", value: formatRatio(m.totalDebtToEquityQuarterly as number | undefined) },
      ],
    },
    {
      title: "Dividends",
      metrics: [
        {
          label: "Dividend Yield",
          value: m.dividendYieldIndicatedAnnual !== undefined
            ? `${(m.dividendYieldIndicatedAnnual as number).toFixed(2)}%`
            : "—",
        },
      ],
    },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="mb-5 text-lg font-semibold text-zinc-100">Key Metrics</h2>
      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {section.title}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {section.metrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
