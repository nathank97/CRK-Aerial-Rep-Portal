import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomers } from '../../hooks/useCustomers'
import { useDealers } from '../../hooks/useUsers'
import { useAuth } from '../../context/AuthContext'
import { SkeletonRow } from '../../components/common/SkeletonCard'
import { formatDate, formatPhone } from '../../utils/formatters'

export default function CustomerList() {
  const { customers, loading } = useCustomers()
  const { dealers } = useDealers()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [filterDealer, setFilterDealer] = useState('')
  const [filterTaxExempt, setFilterTaxExempt] = useState('')
  const [sortField, setSortField] = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')

  const filtered = useMemo(() => {
    let r = customers
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(
        (c) =>
          c.fullName?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q)
      )
    }
    if (filterDealer) r = r.filter((c) => c.assignedDealerId === filterDealer)
    if (filterTaxExempt === 'yes') r = r.filter((c) => c.taxExempt)
    if (filterTaxExempt === 'no') r = r.filter((c) => !c.taxExempt)
    return r
  }, [customers, search, filterDealer, filterTaxExempt])

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

  const hasFilters = search || filterDealer || filterTaxExempt

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Customers</h1>
          <p className="text-[#9A9A9A] text-sm mt-0.5">
            {loading ? 'Loading…' : `${filtered.length} customer${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 flex-wrap mb-4 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9A9A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, company…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8B6914] bg-white transition-colors" />
        </div>

        {isAdmin && (
          <select value={filterDealer} onChange={(e) => setFilterDealer(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B6914]">
            <option value="">All Reps</option>
            {dealers.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
          </select>
        )}

        <select value={filterTaxExempt} onChange={(e) => setFilterTaxExempt(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B6914]">
          <option value="">All Customers</option>
          <option value="yes">Tax Exempt</option>
          <option value="no">Taxable</option>
        </select>

        {hasFilters && (
          <button onClick={() => { setSearch(''); setFilterDealer(''); setFilterTaxExempt('') }}
            className="text-sm text-[#D95F5F] hover:underline">Clear</button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-[#F4F4F5]">
            <tr>
              {[
                { label: 'Name', field: 'fullName' },
                { label: 'Company', field: 'company' },
                { label: 'Email', field: 'email' },
                { label: 'Phone', field: 'phone' },
                { label: 'Assigned Rep', field: 'assignedDealerName' },
                { label: 'Tax Exempt', field: 'taxExempt' },
                { label: 'Customer Since', field: 'createdAt' },
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
              ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={7}><SkeletonRow /></td></tr>)
              : sorted.length === 0
                ? <tr><td colSpan={7} className="text-center py-12 text-[#9A9A9A] text-sm">
                    {hasFilters ? 'No customers match your filters.' : 'No customers yet. Customers are created automatically when a lead is marked Won.'}
                  </td></tr>
                : sorted.map((c) => (
                  <tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)}
                    className="border-b border-gray-50 hover:bg-[#F4F4F5] cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-medium text-[#1A1A1A]">{c.fullName}</td>
                    <td className="px-4 py-3 text-[#9A9A9A]">{c.company || '—'}</td>
                    <td className="px-4 py-3 text-[#4A90B8]">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-[#9A9A9A]">{formatPhone(c.phone)}</td>
                    <td className="px-4 py-3 text-[#9A9A9A]">{c.assignedDealerName || '—'}</td>
                    <td className="px-4 py-3">
                      {c.taxExempt
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-[#4CAF7D] bg-[#4CAF7D]/10 px-2 py-0.5 rounded-full">✓ Exempt</span>
                        : <span className="text-[#9A9A9A] text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[#9A9A9A] whitespace-nowrap">{formatDate(c.createdAt)}</td>
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
            ? <div className="text-center py-12 text-[#9A9A9A] text-sm">No customers found.</div>
            : sorted.map((c) => (
                <div key={c.id} onClick={() => navigate(`/customers/${c.id}`)}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm cursor-pointer active:bg-[#F4F4F5]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1A1A1A] truncate">{c.fullName}</p>
                      {c.company && <p className="text-[#9A9A9A] text-xs mt-0.5 truncate">{c.company}</p>}
                    </div>
                    {c.taxExempt && (
                      <span className="text-xs font-medium text-[#4CAF7D] bg-[#4CAF7D]/10 px-2 py-0.5 rounded-full shrink-0">Exempt</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#9A9A9A]">
                    {c.email && <span>✉ {c.email}</span>}
                    {c.phone && <span>📞 {formatPhone(c.phone)}</span>}
                    <span className="ml-auto">Since {formatDate(c.createdAt)}</span>
                  </div>
                </div>
              ))
        }
      </div>
    </div>
  )
}
