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
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Recent News
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No recent news found for {symbol}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Recent News
      </h2>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex gap-3 py-3 first:pt-0 last:pb-0"
          >
            {item.image && (
              <img
                src={item.image}
                alt=""
                className="h-16 w-24 shrink-0 rounded-md object-cover"
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium text-zinc-900 group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400">
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
