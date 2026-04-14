import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLeads } from '../../hooks/useLeads'
import { useDealers } from '../../hooks/useUsers'
import { useAuth } from '../../context/AuthContext'
import KanbanBoard from '../../components/leads/KanbanBoard'
import StatusBadge from '../../components/common/StatusBadge'
import { SkeletonRow } from '../../components/common/SkeletonCard'
import { formatDate, formatCurrency } from '../../utils/formatters'

const STAGES = ['New', 'Contacted', 'Pending', 'Demo Scheduled', 'Proposal Sent', 'Won', 'Lost']
const SOURCES = ['Website', 'Referral', 'Trade Show', 'Cold Outreach', 'Other']

export default function LeadList() {
  const { leads, loading } = useLeads()
  const { dealers } = useDealers()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState('list')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterDealer, setFilterDealer] = useState('')
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')

  const filtered = useMemo(() => {
    let result = leads
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.company?.toLowerCase().includes(q) ||
          l.phone?.includes(q)
      )
    }
    if (filterStatus) result = result.filter((l) => l.status === filterStatus)
    if (filterSource) result = result.filter((l) => l.source === filterSource)
    if (filterDealer) result = result.filter((l) => l.assignedDealerId === filterDealer)
    return result
  }, [leads, search, filterStatus, filterSource, filterDealer])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = a[sortField], bv = b[sortField]
      if (av?.toDate) av = av.toDate()
      if (bv?.toDate) bv = bv.toDate()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [filtered, sortField, sortDir])

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }) =>
    sortField !== field
      ? <span className="text-gray-300 ml-1">↕</span>
      : <span className="text-[#8B6914] ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>

  const hasFilters = search || filterStatus || filterSource || filterDealer

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Leads</h1>
          <p className="text-[#9A9A9A] text-sm mt-0.5">
            {loading ? 'Loading…' : `${filtered.length} lead${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link to="/leads/new" className="hidden md:inline-flex bg-[#8B6914] hover:bg-[#7a5c11] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + New Lead
        </Link>
      </div>

      {/* Controls bar */}
      <div className="flex gap-2 flex-wrap mb-4 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9A9A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, company…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8B6914] bg-white transition-colors" />
        </div>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B6914]">
          <option value="">All Statuses</option>
          {STAGES.map((s) => <option key={s}>{s}</option>)}
        </select>

        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
          className="hidden sm:block border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B6914]">
          <option value="">All Sources</option>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>

        {isAdmin && (
          <select value={filterDealer} onChange={(e) => setFilterDealer(e.target.value)}
            className="hidden sm:block border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B6914]">
            <option value="">All Reps</option>
            {dealers.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
          </select>
        )}

        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterSource(''); setFilterDealer('') }}
            className="text-sm text-[#D95F5F] hover:underline shrink-0">Clear</button>
        )}

        <div className="ml-auto flex bg-white border border-gray-200 rounded-lg overflow-hidden shrink-0">
          <button onClick={() => setView('list')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${view === 'list' ? 'bg-[#8B6914] text-white' : 'text-[#9A9A9A] hover:text-[#1A1A1A]'}`}>
            ☰ List
          </button>
          <button onClick={() => setView('kanban')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${view === 'kanban' ? 'bg-[#8B6914] text-white' : 'text-[#9A9A9A] hover:text-[#1A1A1A]'}`}>
            ▦ Board
          </button>
        </div>
      </div>

      {/* LIST VIEW */}
      {view === 'list' && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-[#F4F4F5]">
                <tr>
                  {[
                    { label: 'Name', field: 'firstName' },
                    { label: 'Company', field: 'company' },
                    { label: 'Status', field: 'status' },
                    { label: 'Source', field: 'source' },
                    { label: 'Assigned Rep', field: 'assignedDealerName' },
                    { label: 'Budget', field: 'budget' },
                    { label: 'Last Updated', field: 'updatedAt' },
                  ].map(({ label, field }) => (
                    <th key={field} onClick={() => toggleSort(field)}
                      className="text-left px-4 py-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider cursor-pointer hover:text-[#1A1A1A] select-none whitespace-nowrap">
                      {label}<SortIcon field={field} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(6)].map((_, i) => <tr key={i}><td colSpan={7}><SkeletonRow /></td></tr>)
                  : sorted.length === 0
                    ? <tr><td colSpan={7} className="text-center py-12 text-[#9A9A9A] text-sm">
                        {hasFilters ? 'No leads match your filters.' : 'No leads yet. Create your first one!'}
                      </td></tr>
                    : sorted.map((lead) => (
                      <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}
                        className="border-b border-gray-50 hover:bg-[#F4F4F5] cursor-pointer transition-colors">
                        <td className="px-4 py-3 font-medium text-[#1A1A1A]">{lead.firstName} {lead.lastName}</td>
                        <td className="px-4 py-3 text-[#9A9A9A]">{lead.company || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                        <td className="px-4 py-3 text-[#9A9A9A]">{lead.source || '—'}</td>
                        <td className="px-4 py-3 text-[#9A9A9A]">{lead.assignedDealerName || '—'}</td>
                        <td className="px-4 py-3 text-[#9A9A9A]">{lead.budget ? formatCurrency(lead.budget) : '—'}</td>
                        <td className="px-4 py-3 text-[#9A9A9A] whitespace-nowrap">{formatDate(lead.updatedAt ?? lead.createdAt)}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {loading
              ? [...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                ))
              : sorted.length === 0
                ? <div className="text-center py-12 text-[#9A9A9A] text-sm">No leads found.</div>
                : sorted.map((lead) => (
                    <div key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}
                      className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm cursor-pointer active:bg-[#F4F4F5]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#1A1A1A] truncate">{lead.firstName} {lead.lastName}</p>
                          {lead.company && <p className="text-[#9A9A9A] text-xs mt-0.5 truncate">{lead.company}</p>}
                        </div>
                        <StatusBadge status={lead.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#9A9A9A]">
                        {lead.assignedDealerName && <span>👤 {lead.assignedDealerName}</span>}
                        {lead.source && <span>📍 {lead.source}</span>}
                        {lead.budget && <span>💰 {formatCurrency(lead.budget)}</span>}
                        <span className="ml-auto">{formatDate(lead.updatedAt ?? lead.createdAt)}</span>
                      </div>
                    </div>
                  ))
            }
          </div>
        </>
      )}

      {/* KANBAN VIEW */}
      {view === 'kanban' && (
        loading ? (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-[#F4F4F5] rounded-xl min-h-[300px] animate-pulse" style={{ minWidth: '220px' }} />
            ))}
          </div>
        ) : <KanbanBoard leads={filtered} />
      )}

      {/* Mobile FAB */}
      <Link to="/leads/new"
        className="fixed bottom-6 right-6 md:hidden bg-[#8B6914] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-[#7a5c11] transition-colors z-30">
        +
      </Link>
    </div>
  )
}
