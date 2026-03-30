import { getStockProfile } from "@/lib/finnhub";

/**
 * Company profile — cached 7 days at function level.
 * Streams in essentially instantly after first cache warm.
 */
export async function CompanyProfile({ symbol }: { symbol: string }) {
  const profile = await getStockProfile(symbol);

  const details = [
    { label: "Currency",           value: profile.currency || "—" },
    { label: "Country",            value: profile.country  || "—" },
    { label: "IPO Date",           value: profile.ipo      || "—" },
    {
      label: "Shares Outstanding",
      value: profile.shareOutstanding
        ? `${(profile.shareOutstanding / 1000).toFixed(1)}B`
        : "—",
    },
    { label: "Exchange", value: profile.exchange || "—" },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-100">Company Profile</h2>
        <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400">
          {symbol}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        {details.map((d) => (
          <div key={d.label} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{d.label}</dt>
            <dd className="mt-1 text-base font-semibold text-zinc-100">{d.value}</dd>
          </div>
        ))}
      </dl>

      {profile.weburl && (
        <a
          href={profile.weburl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          {(() => { try { return new URL(profile.weburl).hostname.replace("www.", ""); } catch { return profile.weburl; } })()}
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-4.5-6H18m0 0v4.5m0-4.5L10.5 13.5" />
          </svg>
        </a>
      )}
    </div>
  );
}
