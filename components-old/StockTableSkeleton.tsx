const SKELETON_ROWS = 20;

function Pulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-zinc-200 dark:bg-zinc-700 ${className ?? ""}`}
    />
  );
}

export function StockTableSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-zinc-200 bg-zinc-100 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <th className="px-4 py-3">Symbol</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3 text-right">Price</th>
            <th className="px-4 py-3 text-right">Change</th>
            <th className="px-4 py-3 text-right">% Change</th>
            <th className="px-4 py-3 text-right">Market Cap</th>
            <th className="px-4 py-3 text-right">52W High</th>
            <th className="px-4 py-3 text-right">vs 52W High</th>
            <th className="w-12 px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <tr
              key={i}
              className="border-b border-zinc-100 dark:border-zinc-800/50"
            >
              <td className="px-4 py-3">
                <Pulse className="h-4 w-14" />
              </td>
              <td className="px-4 py-3">
                <Pulse className="h-4 w-32" />
              </td>
              <td className="px-4 py-3 text-right">
                <Pulse className="ml-auto h-4 w-16" />
              </td>
              <td className="px-4 py-3 text-right">
                <Pulse className="ml-auto h-4 w-14" />
              </td>
              <td className="px-4 py-3 text-right">
                <Pulse className="ml-auto h-4 w-16" />
              </td>
              <td className="px-4 py-3 text-right">
                <Pulse className="ml-auto h-4 w-20" />
              </td>
              <td className="px-4 py-3 text-right">
                <Pulse className="ml-auto h-4 w-16" />
              </td>
              <td className="px-4 py-3 text-right">
                <Pulse className="ml-auto h-4 w-14" />
              </td>
              <td className="px-2 py-3">
                <Pulse className="mx-auto h-5 w-5 rounded" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
