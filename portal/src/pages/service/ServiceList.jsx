import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useServiceTickets } from '../../hooks/useServiceTickets'
import { formatDate } from '../../utils/formatters'
import StatusBadge from '../../components/common/StatusBadge'
import { SkeletonRow } from '../../components/common/SkeletonCard'

const STATUSES = ['Open', 'In Progress', 'Waiting on Parts', 'Waiting on Customer', 'Resolved', 'Closed']
const PRIORITIES = ['Low', 'Normal', 'High', 'Critical']

const priorityColor = {
  Low: 'bg-gray-100 text-gray-500',
  Normal: 'bg-[#4A90B8]/15 text-[#4A90B8]',
  High: 'bg-[#E6A817]/15 text-[#E6A817]',
  Critical: 'bg-[#D95F5F]/15 text-[#D95F5F]',
}

export default function ServiceList() {
  const navigate = useNavigate()
  const { tickets, loading } = useServiceTickets()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch = !search || [t.ticketNumber, t.subject, t.customerName, t.droneModel]
        .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      const matchStatus = !filterStatus || t.status === filterStatus
      const matchPri = !filterPriority || t.priority === filterPriority
      return matchSearch && matchStatus && matchPri
    })
  }, [tickets, search, filterStatus, filterPriority])

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Service Tickets</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''} total</p>
        </div>
        <button onClick={() => navigate('/service/new')}
          className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
          + New Ticket
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ticket #, subject, customer…"
          className={`${inputCls} col-span-2 md:col-span-1`} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className={inputCls}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-[#F4F4F5]">
              {['Ticket #', 'Subject', 'Customer', 'Drone Model', 'Priority', 'Status', 'Opened', 'Assigned To'].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-[#9A9A9A] text-sm">No tickets found.</td></tr>
            ) : filtered.map((t) => (
              <tr key={t.id} onClick={() => navigate(`/service/${t.id}`)}
                className="hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                <td className="py-3 px-4 font-mono text-xs font-semibold text-[#8B6914]">{t.ticketNumber}</td>
                <td className="py-3 px-4 font-medium text-[#1A1A1A] max-w-xs truncate">{t.subject}</td>
                <td className="py-3 px-4 text-[#9A9A9A]">{t.customerName || '—'}</td>
                <td className="py-3 px-4 text-[#9A9A9A]">{t.droneModel || '—'}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityColor[t.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                    {t.priority ?? 'Normal'}
                  </span>
                </td>
                <td className="py-3 px-4"><StatusBadge status={t.status} /></td>
                <td className="py-3 px-4 text-xs text-[#9A9A9A]">{formatDate(t.createdAt)}</td>
                <td className="py-3 px-4 text-[#9A9A9A] text-xs">{t.assignedToName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
              <div className="flex gap-2">
                <div className="h-5 bg-gray-200 rounded-full w-16" />
                <div className="h-5 bg-gray-100 rounded-full w-20" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[#9A9A9A] text-sm">No tickets found.</div>
        ) : filtered.map((t) => (
          <div key={t.id} onClick={() => navigate(`/service/${t.id}`)}
            className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm active:bg-[#F4F4F5] transition-colors cursor-pointer">
            <div className="flex items-start justify-between mb-1">
              <span className="font-mono text-xs font-semibold text-[#8B6914]">{t.ticketNumber}</span>
              <StatusBadge status={t.status} />
            </div>
            <p className="font-semibold text-[#1A1A1A] mb-1">{t.subject}</p>
            <p className="text-sm text-[#9A9A9A] mb-2">{t.customerName || 'No customer'}{t.droneModel ? ` · ${t.droneModel}` : ''}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityColor[t.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                {t.priority ?? 'Normal'}
              </span>
              <span className="text-xs text-[#9A9A9A]">{formatDate(t.createdAt)}</span>
              {t.assignedToName && <span className="text-xs text-[#9A9A9A]">· {t.assignedToName}</span>}
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => navigate('/service/new')}
        className="fixed bottom-6 right-6 z-40 md:hidden w-14 h-14 bg-[#8B6914] text-white rounded-full shadow-lg text-2xl flex items-center justify-center hover:bg-[#7a5c12] transition-colors">
        +
      </button>
    </div>
  )
}
