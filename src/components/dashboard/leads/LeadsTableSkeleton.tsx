export function LeadsTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse font-mono text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left text-[10px] uppercase tracking-widest text-zinc-500">
            <th className="pb-3 pr-4 font-normal">Name</th>
            <th className="pb-3 pr-4 font-normal">Phone</th>
            <th className="pb-3 pr-4 font-normal">Status</th>
            <th className="pb-3 pr-4 font-normal">List name</th>
            <th className="pb-3 font-normal">Created at</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, index) => (
            <tr key={index} className="border-b border-zinc-800">
              <td className="py-3 pr-4">
                <div className="h-4 w-36 animate-pulse rounded bg-zinc-800" />
              </td>
              <td className="py-3 pr-4">
                <div className="h-4 w-28 animate-pulse rounded bg-zinc-800/90" />
              </td>
              <td className="py-3 pr-4">
                <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-800/80" />
              </td>
              <td className="py-3 pr-4">
                <div className="h-4 w-32 animate-pulse rounded bg-zinc-800/70" />
              </td>
              <td className="py-3">
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-800/60" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
