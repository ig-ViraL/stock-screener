const ROWS = 25;

function Pulse({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-zinc-800 ${className ?? ""}`} />
  );
}

export function StockTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
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
          {Array.from({ length: ROWS }, (_, i) => (
            <tr key={i} className="border-b border-zinc-800/50">
              <td className="px-4 py-3"><Pulse className="h-4 w-14" /></td>
              <td className="px-4 py-3"><Pulse className="h-4 w-32" /></td>
              <td className="px-4 py-3 text-right"><Pulse className="ml-auto h-4 w-16" /></td>
              <td className="px-4 py-3 text-right"><Pulse className="ml-auto h-4 w-14" /></td>
              <td className="px-4 py-3 text-right"><Pulse className="ml-auto h-4 w-16" /></td>
              <td className="px-4 py-3 text-right"><Pulse className="ml-auto h-4 w-20" /></td>
              <td className="px-4 py-3 text-right"><Pulse className="ml-auto h-4 w-16" /></td>
              <td className="px-4 py-3 text-right"><Pulse className="ml-auto h-4 w-14" /></td>
              <td className="px-2 py-3"><Pulse className="mx-auto h-5 w-5 rounded" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
