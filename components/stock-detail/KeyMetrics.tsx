import { fetchBasicFinancials } from "@/lib/finnhub";
import { formatRatio } from "@/lib/format";
import { MetricCard } from "./MetricCard";

interface KeyMetricsProps {
  symbol: string;
}

export async function KeyMetrics({ symbol }: KeyMetricsProps) {
  const data = await fetchBasicFinancials(symbol);
  const m = data.metric;

  const sections = [
    {
      title: "Valuation",
      metrics: [
        { label: "P/E Ratio (TTM)", value: formatRatio(m.peBasicExclExtraTTM) },
        { label: "Price / Book", value: formatRatio(m.pbAnnual) },
        {
          label: "EPS (TTM)",
          value:
            m.epsBasicExclExtraItemsTTM !== undefined
              ? `$${m.epsBasicExclExtraItemsTTM.toFixed(2)}`
              : "—",
        },
      ],
    },
    {
      title: "Profitability",
      metrics: [
        {
          label: "ROE (TTM)",
          value:
            m.roeTTM !== undefined ? `${m.roeTTM.toFixed(2)}%` : "—",
        },
        {
          label: "Net Margin (TTM)",
          value:
            m.netProfitMarginTTM !== undefined
              ? `${m.netProfitMarginTTM.toFixed(2)}%`
              : "—",
        },
        {
          label: "Revenue / Share",
          value:
            m.revenuePerShareTTM !== undefined
              ? `$${m.revenuePerShareTTM.toFixed(2)}`
              : "—",
        },
      ],
    },
    {
      title: "Risk",
      metrics: [
        {
          label: "Beta",
          value: formatRatio(m.beta),
          sublabel: "Volatility vs market",
        },
        {
          label: "Debt / Equity",
          value: formatRatio(m.totalDebtToEquityQuarterly),
        },
      ],
    },
    {
      title: "Dividends",
      metrics: [
        {
          label: "Dividend Yield",
          value:
            m.dividendYieldIndicatedAnnual !== undefined
              ? `${m.dividendYieldIndicatedAnnual.toFixed(2)}%`
              : "—",
        },
      ],
    },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Key Metrics
        </h2>
        {sections.map((section) => (
          <div key={section.title}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
