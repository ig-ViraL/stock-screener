import { getCompanyNews } from "@/lib/finnhub";
import { formatRelativeTime } from "@/lib/format";

/**
 * Company news — cached 30 minutes at function level.
 * News trickles in throughout the day; 30-min refresh keeps it reasonably fresh.
 * Streams in last — slowest section on cold cache.
 */
export async function NewsSection({ symbol }: { symbol: string }) {
  const news = await getCompanyNews(symbol);
  const items = news.slice(0, 8);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-100">Recent News</h2>
        <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400">
          {items.length > 0 ? `${items.length} stories` : symbol}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No recent news found for {symbol}.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 transition-colors hover:border-blue-800 hover:bg-blue-950/20"
            >
              {item.image && (
                <img
                  src={item.image}
                  alt=""
                  className="h-16 w-24 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-100 group-hover:text-blue-300">
                  {item.headline}
                </p>
                <p className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="font-medium">{item.source}</span>
                  <span>&middot;</span>
                  <span>{formatRelativeTime(item.datetime)}</span>
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
