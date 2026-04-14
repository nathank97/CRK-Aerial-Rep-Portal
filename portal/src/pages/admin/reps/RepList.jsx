import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReps } from '../../../hooks/useReps'
import { formatDate } from '../../../utils/formatters'
import StatusBadge from '../../../components/common/StatusBadge'

const STATUSES = ['Prospect', 'In Onboarding', 'Active Rep', 'Inactive Rep', 'Terminated']

const statusColor = {
  'Active Rep': 'bg-[#4CAF7D]/10 text-[#4CAF7D]',
  'In Onboarding': 'bg-[#4A90B8]/10 text-[#4A90B8]',
  'Prospect': 'bg-[#E6A817]/10 text-[#E6A817]',
  'Inactive Rep': 'bg-gray-100 text-gray-500',
  'Terminated': 'bg-[#D95F5F]/10 text-[#D95F5F]',
}

export default function RepList() {
  const navigate = useNavigate()
  const { reps, loading } = useReps()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const filtered = useMemo(() => {
    return reps.filter((r) => {
      const matchSearch = !search || [r.firstName, r.lastName, r.email, r.company]
        .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      const matchStatus = !filterStatus || r.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [reps, search, filterStatus])

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Rep Manager</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{reps.length} rep{reps.length !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/admin/reps/pipeline')}
            className="border border-gray-200 text-[#1A1A1A] px-4 py-2 rounded-lg text-sm hover:bg-[#F4F4F5] transition-colors">
            Pipeline View
          </button>
          <button onClick={() => navigate('/admin/reps/new')}
            className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
            + Add Rep
          </button>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {STATUSES.map((s) => {
          const count = reps.filter((r) => r.status === s).length
          return (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                filterStatus === s ? 'border-[#8B6914] bg-[#8B6914]/5' : 'border-gray-100 bg-white hover:border-gray-200'
              }`}>
              <p className="text-xl font-bold text-[#1A1A1A]">{count}</p>
              <p className="text-xs text-[#9A9A9A] mt-0.5">{s}</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, company…"
          className={`${inputCls} w-full max-w-xs`} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        {filterStatus && (
          <button onClick={() => setFilterStatus('')} className="text-xs text-[#9A9A9A] hover:text-[#1A1A1A]">
            Clear filter ×
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-[#F4F4F5]">
              {['Rep', 'Status', 'Territory', 'Commission', 'Start Date', 'Linked Dealer', 'Actions'].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="py-3 px-4"><div className="h-4 bg-gray-100 rounded w-3/4" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-[#9A9A9A] text-sm">
                {reps.length === 0 ? 'No reps yet. Add the first rep above.' : 'No reps match your filters.'}
              </td></tr>
            ) : filtered.map((rep) => (
              <tr key={rep.id} onClick={() => navigate(`/admin/reps/${rep.id}`)}
                className="hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#8B6914]/15 flex items-center justify-center text-xs font-bold text-[#8B6914]">
                      {(rep.firstName ?? '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-[#1A1A1A]">{rep.firstName} {rep.lastName}</p>
                      {rep.company && <p className="text-xs text-[#9A9A9A]">{rep.company}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[rep.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {rep.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-[#9A9A9A] text-xs">{rep.territoryName || '—'}</td>
                <td className="py-3 px-4">
                  {rep.commissionPercent != null ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#8B6914]/10 text-[#8B6914]">
                      {rep.commissionPercent}%
                    </span>
                  ) : <span className="text-[#9A9A9A]">—</span>}
                </td>
                <td className="py-3 px-4 text-xs text-[#9A9A9A]">{formatDate(rep.startDate) || '—'}</td>
                <td className="py-3 px-4 text-xs text-[#9A9A9A]">{rep.linkedDealerName || '—'}</td>
                <td className="py-3 px-4">
                  <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/reps/${rep.id}`) }}
                    className="text-xs text-[#8B6914] hover:underline font-medium">View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
