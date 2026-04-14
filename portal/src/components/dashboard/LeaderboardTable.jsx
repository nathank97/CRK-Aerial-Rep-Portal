import { formatCurrency, formatPercent } from '../../utils/formatters'

export default function LeaderboardTable({ rows, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <div className="h-4 bg-gray-100 animate-pulse rounded w-1/4" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4 px-5 py-3 border-b border-gray-50 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-6" />
            <div className="h-4 bg-gray-100 rounded flex-1" />
            <div className="h-4 bg-gray-100 rounded w-16" />
            <div className="h-4 bg-gray-100 rounded w-20 hidden sm:block" />
            <div className="h-4 bg-gray-100 rounded w-14 hidden md:block" />
            <div className="h-4 bg-gray-100 rounded w-14 hidden md:block" />
            <div className="h-4 bg-gray-100 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
        <p className="text-[#9A9A9A] text-sm">No dealer data yet.</p>
      </div>
    )
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#1A1A1A]">Dealer Leaderboard</h2>
        <span className="text-xs text-[#9A9A9A]">Ranked by overall score</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-[#F4F4F5]">
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-10">#</th>
              <th className="text-left px-5 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Dealer</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Win Rate</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider hidden sm:table-cell">Revenue Closed</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider hidden md:table-cell">Pipeline</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider hidden md:table-cell">Svc Closed</th>
              <th className="text-right px-5 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-[#F4F4F5] transition-colors">
                <td className="px-5 py-3 text-base">
                  {medals[i] ?? <span className="text-[#9A9A9A] font-semibold text-sm">{i + 1}</span>}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#8B6914]/15 flex items-center justify-center text-[#8B6914] text-xs font-bold shrink-0">
                      {row.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="font-medium text-[#1A1A1A]">{row.name ?? 'Unknown'}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right">
                  <span className={`font-semibold ${row.winRate >= 50 ? 'text-[#4CAF7D]' : row.winRate > 0 ? 'text-[#E6A817]' : 'text-[#9A9A9A]'}`}>
                    {row.winRate}%
                  </span>
                </td>
                <td className="px-5 py-3 text-right text-[#1A1A1A] font-medium hidden sm:table-cell">
                  {formatCurrency(row.revenue)}
                </td>
                <td className="px-5 py-3 text-right text-[#9A9A9A] hidden md:table-cell">{row.pipeline}</td>
                <td className="px-5 py-3 text-right text-[#9A9A9A] hidden md:table-cell">{row.svcClosed}</td>
                <td className="px-5 py-3 text-right">
                  <span className="inline-flex items-center justify-center w-10 h-6 bg-[#8B6914]/10 text-[#8B6914] text-xs font-bold rounded-full">
                    {row.score}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
