import { fetchCompanyNews } from "@/lib/finnhub";
import { formatRelativeTime } from "@/lib/format";

interface NewsSectionProps {
  symbol: string;
}

function formatDateParam(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function NewsSection({ symbol }: NewsSectionProps) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const news = await fetchCompanyNews(
    symbol,
    formatDateParam(weekAgo),
    formatDateParam(now)
  );

  const items = news.slice(0, 8);

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Recent News
          </h2>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {symbol}
          </span>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No recent news found for {symbol}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Recent News
        </h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {items.length} stories
        </span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/60 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-blue-900 dark:hover:bg-blue-950/30"
          >
            {item.image && (
              <img
                src={item.image}
                alt=""
                className="h-16 w-24 shrink-0 rounded-lg object-cover ring-1 ring-black/5 dark:ring-white/10"
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-900 group-hover:text-blue-700 dark:text-zinc-100 dark:group-hover:text-blue-300">
                {item.headline}
              </p>
              <p className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-medium">{item.source}</span>
                <span>&middot;</span>
                <span>{formatRelativeTime(item.datetime)}</span>
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
