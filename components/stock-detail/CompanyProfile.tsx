import { fetchCachedProfile } from "@/lib/finnhub";

interface CompanyProfileProps {
  symbol: string;
}

export async function CompanyProfile({ symbol }: CompanyProfileProps) {
  const profile = await fetchCachedProfile(symbol);

  const details = [
    { label: "Exchange", value: profile.exchange },
    { label: "Currency", value: profile.currency },
    { label: "Country", value: profile.country },
    { label: "IPO Date", value: profile.ipo || "—" },
    {
      label: "Shares Outstanding",
      value: profile.shareOutstanding
        ? `${(profile.shareOutstanding / 1000).toFixed(1)}B`
        : "—",
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Company Profile
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        {details.map((d) => (
          <div key={d.label}>
            <dt className="text-zinc-500 dark:text-zinc-400">{d.label}</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">
              {d.value}
            </dd>
          </div>
        ))}
      </dl>
      {profile.weburl && (
        <a
          href={profile.weburl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          {new URL(profile.weburl).hostname.replace("www.", "")}
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-4.5-6H18m0 0v4.5m0-4.5L10.5 13.5"
            />
          </svg>
        </a>
      )}
    </div>
  );
}
