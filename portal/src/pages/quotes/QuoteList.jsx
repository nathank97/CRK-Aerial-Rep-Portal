import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteDoc, doc } from 'firebase/firestore'
import { useQuotes } from '../../hooks/useQuotes'
import { useAuth } from '../../context/AuthContext'
import { db } from '../../firebase/config'
import StatusBadge from '../../components/common/StatusBadge'
import { SkeletonRow } from '../../components/common/SkeletonCard'
import { formatCurrency, formatDate } from '../../utils/formatters'

const STATUSES = ['All', 'Draft', 'Sent', 'Accepted', 'Declined', 'Expired']

export default function QuoteList() {
  const { quotes, loading } = useQuotes()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [deleteItem, setDeleteItem] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = quotes.filter((q) => {
    const matchStatus = statusFilter === 'All' || q.status === statusFilter
    const term = search.toLowerCase()
    const matchSearch =
      !term ||
      (q.linkedCustomerName ?? '').toLowerCase().includes(term) ||
      (q.linkedLeadName ?? '').toLowerCase().includes(term) ||
      (q.quoteNumber ?? '').toLowerCase().includes(term)
    return matchStatus && matchSearch
  })

  async function handleDelete() {
    if (!deleteItem) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'quotes', deleteItem.id))
      setDeleteItem(null)
    } finally {
      setDeleting(false)
    }
  }

  const colSpan = isAdmin ? 6 : 5

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {deleteItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#111111]">Delete Quote</h2>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[#111111]">
                Are you sure you want to delete quote <span className="font-semibold">{deleteItem.quoteNumber}</span>? This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
              <button onClick={() => setDeleteItem(null)} disabled={deleting}
                className="flex-1 border border-gray-200 text-[#111111] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#c44f4f] disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Quotes</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{quotes.length} total quote{quotes.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/quotes/new')}
          className="bg-[#8B6914] hover:bg-[#7a5c12] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + New Quote
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer or quote #…"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>
          ))}
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-[#F4F4F5]">
              <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Quote #</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Customer / Lead</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Total</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Created</th>
              {isAdmin && <th className="py-3 px-4" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={colSpan} className="p-0">
                    <SkeletonRow />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="py-16 text-center text-[#9A9A9A] text-sm">
                  {quotes.length === 0 ? 'No quotes yet. Create your first quote.' : 'No quotes match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => navigate(`/quotes/${q.id}`)}
                  className="hover:bg-[#F4F4F5] cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-[#8B6914]">{q.quoteNumber}</td>
                  <td className="py-3 px-4 font-medium text-[#111111]">
                    {q.linkedCustomerName || q.linkedLeadName || <span className="text-[#9A9A9A]">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={q.status ?? 'Draft'} />
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-[#111111]">{formatCurrency(q.total)}</td>
                  <td className="py-3 px-4 text-[#9A9A9A]">{formatDate(q.createdAt)}</td>
                  {isAdmin && (
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setDeleteItem(q)}
                        className="text-xs text-[#D95F5F] hover:underline font-medium">
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse space-y-2">
              <div className="h-3 bg-gray-100 rounded w-1/3" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[#9A9A9A] text-sm">
            {quotes.length === 0 ? 'No quotes yet. Create your first quote.' : 'No quotes match your filters.'}
          </div>
        ) : (
          filtered.map((q) => (
            <div
              key={q.id}
              onClick={() => navigate(`/quotes/${q.id}`)}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 cursor-pointer hover:border-[#8B6914]/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-[#8B6914]">{q.quoteNumber}</p>
                  <p className="font-semibold text-[#111111] mt-0.5 truncate">
                    {q.linkedCustomerName || q.linkedLeadName || '—'}
                  </p>
                </div>
                <StatusBadge status={q.status ?? 'Draft'} />
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[#9A9A9A] text-xs">{formatDate(q.createdAt)}</span>
                <span className="font-semibold text-[#111111] text-sm">{formatCurrency(q.total)}</span>
              </div>
              {isAdmin && (
                <div className="mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setDeleteItem(q)}
                    className="text-xs text-[#D95F5F] font-medium hover:underline">
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Mobile FAB */}
      <button onClick={() => navigate('/quotes/new')}
        className="fixed bottom-6 right-6 md:hidden bg-[#8B6914] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-[#7a5c12] transition-colors z-30">
        +
      </button>
    </div>
  )
}
