import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInvoices, computePaymentStatus } from '../../hooks/useInvoices'
import StatusBadge from '../../components/common/StatusBadge'
import { SkeletonRow } from '../../components/common/SkeletonCard'
import { formatCurrency, formatDate } from '../../utils/formatters'

const STATUSES = ['All', 'Unpaid', 'Partial', 'Paid', 'Overdue']

export default function InvoiceList() {
  const { invoices, loading } = useInvoices()
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')

  const enriched = invoices.map((inv) => ({
    ...inv,
    paymentStatus: computePaymentStatus(inv),
  }))

  const filtered = enriched.filter((inv) => {
    const matchStatus = statusFilter === 'All' || inv.paymentStatus === statusFilter
    const term = search.toLowerCase()
    const matchSearch =
      !term ||
      (inv.customerName ?? '').toLowerCase().includes(term) ||
      (inv.invoiceNumber ?? '').toLowerCase().includes(term)
    return matchStatus && matchSearch
  })

  const isDueDateOverdue = (inv) => {
    if (!inv.dueDate) return false
    const due = inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate)
    return due < new Date() && inv.paymentStatus !== 'Paid'
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Invoices</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{invoices.length} total invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/invoices/new')}
          className="bg-[#8B6914] hover:bg-[#7a5c12] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + New Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer or invoice #…"
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
              <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Invoice #</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Customer</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Total</th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Balance Due</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="p-0">
                    <SkeletonRow />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-[#9A9A9A] text-sm">
                  {invoices.length === 0 ? 'No invoices yet. Create your first invoice.' : 'No invoices match your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((inv) => {
                const overdue = isDueDateOverdue(inv)
                const balanceDue = (inv.total ?? 0) - (inv.amountPaid ?? 0)
                return (
                  <tr
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    className="hover:bg-[#F4F4F5] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-[#8B6914]">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4 font-medium text-[#111111]">
                      {inv.customerName || <span className="text-[#9A9A9A]">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={inv.paymentStatus} />
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#111111]">{formatCurrency(inv.total)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-[#111111]">{formatCurrency(balanceDue)}</td>
                    <td className={`py-3 px-4 ${overdue ? 'text-[#D95F5F] font-semibold' : 'text-[#9A9A9A]'}`}>
                      {formatDate(inv.dueDate)}
                    </td>
                  </tr>
                )
              })
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
            {invoices.length === 0 ? 'No invoices yet. Create your first invoice.' : 'No invoices match your filters.'}
          </div>
        ) : (
          filtered.map((inv) => {
            const overdue = isDueDateOverdue(inv)
            const balanceDue = (inv.total ?? 0) - (inv.amountPaid ?? 0)
            return (
              <div
                key={inv.id}
                onClick={() => navigate(`/invoices/${inv.id}`)}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 cursor-pointer hover:border-[#8B6914]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-[#8B6914]">{inv.invoiceNumber}</p>
                    <p className="font-semibold text-[#111111] mt-0.5 truncate">{inv.customerName || '—'}</p>
                  </div>
                  <StatusBadge status={inv.paymentStatus} />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className={`text-xs ${overdue ? 'text-[#D95F5F] font-semibold' : 'text-[#9A9A9A]'}`}>
                    Due: {formatDate(inv.dueDate)}
                  </span>
                  <div className="text-right">
                    <span className="block font-semibold text-[#111111] text-sm">{formatCurrency(inv.total)}</span>
                    {balanceDue > 0 && (
                      <span className="block text-xs text-[#9A9A9A]">Bal: {formatCurrency(balanceDue)}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
