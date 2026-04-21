import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useCustomer, useCustomerOrders, useCustomerServiceTickets } from '../../hooks/useCustomers'
import { useDealers } from '../../hooks/useUsers'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/common/StatusBadge'
import { formatDate, formatPhone, formatCurrency } from '../../utils/formatters'

const EXEMPTION_TYPES = ['Agricultural Producer', 'Reseller', 'Non-Profit', 'Other']
const TABS = ['Profile', 'Orders', 'Service History']

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#8B6914] bg-white transition-colors'

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-[#9A9A9A] shrink-0">{label}</span>
      <span className="text-xs text-[#1A1A1A] font-medium text-right break-words max-w-[60%]">{value || '—'}</span>
    </div>
  )
}

export default function CustomerDetail() {
  const { id } = useParams()
  const { customer, loading } = useCustomer(id)
  const { orders, loading: ordersLoading } = useCustomerOrders(id)
  const { tickets, loading: ticketsLoading } = useCustomerServiceTickets(id)
  const { dealers } = useDealers()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState('Profile')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [transferring, setTransferring] = useState(false)
  const [transferDealerId, setTransferDealerId] = useState('')
  const [transferSaving, setTransferSaving] = useState(false)

  const openTransfer = () => {
    setTransferDealerId(customer.assignedDealerId ?? '')
    setTransferring(true)
  }

  const handleTransfer = async () => {
    setTransferSaving(true)
    try {
      const dealer = dealers.find((d) => d.id === transferDealerId)
      await updateDoc(doc(db, 'customers', id), {
        assignedDealerId: transferDealerId || null,
        assignedDealerName: dealer?.displayName ?? null,
        updatedAt: serverTimestamp(),
      })
      setTransferring(false)
    } finally {
      setTransferSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'customers', id))
      navigate('/customers')
    } finally {
      setDeleting(false)
    }
  }

  const startEdit = () => { setForm({ ...customer }); setEditing(true) }
  const cancelEdit = () => { setForm(null); setEditing(false) }

  const set = (field) => (e) => {
    const val = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e
    if (field === 'assignedDealerId') {
      const dealer = dealers.find((d) => d.id === val)
      setForm((f) => ({ ...f, assignedDealerId: val, assignedDealerName: dealer?.displayName ?? '' }))
    } else {
      setForm((f) => ({ ...f, [field]: val }))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'customers', id), {
        firstName: form.firstName,
        lastName: form.lastName,
        fullName: `${form.firstName} ${form.lastName}`,
        company: form.company ?? null,
        email: form.email,
        phone: form.phone,
        address: form.address ?? null,
        assignedDealerId: form.assignedDealerId ?? null,
        assignedDealerName: form.assignedDealerName ?? null,
        notes: form.notes ?? null,
        taxExempt: form.taxExempt ?? false,
        exemptionType: form.taxExempt ? (form.exemptionType ?? null) : null,
        exemptionCertificate: form.taxExempt ? (form.exemptionCertificate ?? null) : null,
        exemptionNotes: form.taxExempt ? (form.exemptionNotes ?? null) : null,
        updatedAt: serverTimestamp(),
      })
      setEditing(false)
      setForm(null)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-screen-lg mx-auto animate-pulse space-y-4">
        <div className="h-6 bg-gray-100 rounded w-1/4" />
        <div className="h-10 bg-gray-100 rounded w-1/2" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 bg-gray-100 rounded-xl" />
          <div className="h-72 bg-gray-100 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#9A9A9A]">Customer not found.</p>
        <Link to="/customers" className="text-[#8B6914] hover:underline text-sm mt-2 block">Back to Customers</Link>
      </div>
    )
  }

  const f = editing ? form : customer
  const totalRevenue = orders
    .filter((o) => o.status === 'Delivered')
    .reduce((sum, o) => sum + (o.orderTotal ?? 0), 0)

  return (
    <div className="p-4 sm:p-6 max-w-screen-lg mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <Link to="/customers" className="text-[#9A9A9A] hover:text-[#1A1A1A] text-sm transition-colors">← Customers</Link>
          <h1 className="text-2xl font-bold text-[#1A1A1A] mt-1">{customer.fullName}</h1>
          {customer.company && <p className="text-[#9A9A9A] text-sm">{customer.company}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!editing
            ? <button onClick={startEdit} className="border border-gray-200 text-[#1A1A1A] text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-[#F4F4F5] transition-colors">Edit</button>
            : <>
                <button onClick={cancelEdit} className="border border-gray-200 text-[#1A1A1A] text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-[#F4F4F5] transition-colors">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="bg-[#8B6914] hover:bg-[#7a5c11] text-white text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
          }
          {customer.sourceLeadId && (
            <Link to={`/leads/${customer.sourceLeadId}`}
              className="border border-gray-200 text-[#9A9A9A] text-sm px-3 py-1.5 rounded-lg hover:bg-[#F4F4F5] transition-colors">
              View Original Lead
            </Link>
          )}
          {isAdmin && !editing && (
            <button onClick={() => setConfirmDelete(true)}
              className="border border-red-200 text-red-500 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: tabs */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                  tab === t ? 'border-[#8B6914] text-[#8B6914]' : 'border-transparent text-[#9A9A9A] hover:text-[#1A1A1A]'
                }`}>
                {t}
                {t === 'Orders' && orders.length > 0 && (
                  <span className="ml-1.5 bg-[#F4F4F5] text-[#9A9A9A] text-xs px-1.5 py-0.5 rounded-full">{orders.length}</span>
                )}
                {t === 'Service History' && tickets.length > 0 && (
                  <span className="ml-1.5 bg-[#F4F4F5] text-[#9A9A9A] text-xs px-1.5 py-0.5 rounded-full">{tickets.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* PROFILE TAB */}
            {tab === 'Profile' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">First Name</label>
                    {editing ? <input value={f.firstName ?? ''} onChange={set('firstName')} className={inputCls} />
                      : <p className="text-sm font-medium text-[#1A1A1A]">{customer.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Last Name</label>
                    {editing ? <input value={f.lastName ?? ''} onChange={set('lastName')} className={inputCls} />
                      : <p className="text-sm font-medium text-[#1A1A1A]">{customer.lastName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Email</label>
                    {editing ? <input type="email" value={f.email ?? ''} onChange={set('email')} className={inputCls} />
                      : <a href={`mailto:${customer.email}`} className="text-sm text-[#4A90B8] hover:underline">{customer.email}</a>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Phone</label>
                    {editing ? <input type="tel" value={f.phone ?? ''} onChange={set('phone')} className={inputCls} />
                      : <a href={`tel:${customer.phone}`} className="text-sm text-[#4A90B8] hover:underline">{formatPhone(customer.phone)}</a>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Company</label>
                    {editing ? <input value={f.company ?? ''} onChange={set('company')} className={inputCls} />
                      : <p className="text-sm text-[#1A1A1A]">{customer.company || '—'}</p>}
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Assigned Rep</label>
                      {editing
                        ? <select value={f.assignedDealerId ?? ''} onChange={set('assignedDealerId')} className={inputCls}>
                            <option value="">Unassigned</option>
                            {dealers.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
                          </select>
                        : <p className="text-sm text-[#1A1A1A]">{customer.assignedDealerName || 'Unassigned'}</p>}
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Address</label>
                    {editing ? <input value={f.address ?? ''} onChange={set('address')} className={inputCls} />
                      : <p className="text-sm text-[#1A1A1A]">{customer.address || '—'}</p>}
                  </div>
                </div>

                {/* Tax exempt section */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-[#1A1A1A]">Tax Exemption</h3>
                    {editing
                      ? <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={f.taxExempt ?? false} onChange={set('taxExempt')}
                            className="w-4 h-4 accent-[#8B6914] rounded" />
                          <span className="text-sm text-[#1A1A1A]">Tax Exempt</span>
                        </label>
                      : customer.taxExempt
                        ? <span className="text-xs font-medium text-[#4CAF7D] bg-[#4CAF7D]/10 px-2.5 py-1 rounded-full">✓ Tax Exempt</span>
                        : <span className="text-xs text-[#9A9A9A]">Not exempt</span>
                    }
                  </div>

                  {(editing ? f.taxExempt : customer.taxExempt) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-0">
                      <div>
                        <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Exemption Type</label>
                        {editing
                          ? <select value={f.exemptionType ?? ''} onChange={set('exemptionType')} className={inputCls}>
                              <option value="">Select…</option>
                              {EXEMPTION_TYPES.map((t) => <option key={t}>{t}</option>)}
                            </select>
                          : <p className="text-sm text-[#1A1A1A]">{customer.exemptionType || '—'}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Certificate #</label>
                        {editing
                          ? <input value={f.exemptionCertificate ?? ''} onChange={set('exemptionCertificate')} placeholder="Optional" className={inputCls} />
                          : <p className="text-sm text-[#1A1A1A]">{customer.exemptionCertificate || '—'}</p>}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Exemption Notes</label>
                        {editing
                          ? <textarea value={f.exemptionNotes ?? ''} onChange={set('exemptionNotes')} rows={2} className={`${inputCls} resize-none`} />
                          : <p className="text-sm text-[#1A1A1A]">{customer.exemptionNotes || '—'}</p>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="border-t border-gray-100 pt-4">
                  <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Notes</label>
                  {editing
                    ? <textarea value={f.notes ?? ''} onChange={set('notes')} rows={3} className={`${inputCls} resize-none`} />
                    : <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap">{customer.notes || '—'}</p>}
                </div>
              </div>
            )}

            {/* ORDERS TAB */}
            {tab === 'Orders' && (
              <div>
                {ordersLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-[#9A9A9A] text-sm">No orders yet.</p>
                    <Link to="/orders" className="text-[#8B6914] hover:underline text-sm mt-1 block">Go to Orders →</Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orders.map((order) => (
                      <div key={order.id} onClick={() => navigate(`/orders/${order.id}`)}
                        className="flex items-center justify-between gap-3 p-3 border border-gray-100 rounded-lg hover:bg-[#F4F4F5] cursor-pointer transition-colors">
                        <div>
                          <p className="text-sm font-semibold text-[#1A1A1A]">{order.orderNumber || order.id}</p>
                          <p className="text-xs text-[#9A9A9A]">{formatDate(order.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={order.status} />
                          <span className="text-sm font-semibold text-[#1A1A1A]">{formatCurrency(order.orderTotal)}</span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold">
                      <span className="text-[#9A9A9A]">Total Revenue (Delivered)</span>
                      <span className="text-[#4CAF7D]">{formatCurrency(totalRevenue)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SERVICE HISTORY TAB */}
            {tab === 'Service History' && (
              <div>
                {ticketsLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-[#9A9A9A] text-sm">No service tickets yet.</p>
                    <Link to="/service/new" className="text-[#8B6914] hover:underline text-sm mt-1 block">Create Service Ticket →</Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tickets.map((ticket) => (
                      <div key={ticket.id} onClick={() => navigate(`/service/${ticket.id}`)}
                        className="flex items-center justify-between gap-3 p-3 border border-gray-100 rounded-lg hover:bg-[#F4F4F5] cursor-pointer transition-colors">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1A1A1A]">{ticket.ticketNumber || ticket.id}</p>
                          <p className="text-xs text-[#9A9A9A] truncate">{ticket.issueDescription || '—'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={ticket.priority} />
                          <StatusBadge status={ticket.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Stats */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-3">Overview</p>
            <div className="space-y-1">
              <InfoRow label="Customer Since" value={formatDate(customer.createdAt)} />
              <InfoRow label="Orders" value={`${orders.length} order${orders.length !== 1 ? 's' : ''}`} />
              <InfoRow label="Revenue" value={formatCurrency(totalRevenue)} />
              <InfoRow label="Service Tickets" value={`${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`} />
              {!isAdmin && <InfoRow label="Assigned Rep" value={customer.assignedDealerName} />}
              {customer.originatingDealerName && (
                <InfoRow label="Originated With" value={customer.originatingDealerName} />
              )}
            </div>
          </div>

          {/* Assigned Rep (admin transfer) */}
          {isAdmin && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-3">Assigned Rep</p>
              {transferring ? (
                <div className="space-y-2">
                  <select
                    value={transferDealerId}
                    onChange={(e) => setTransferDealerId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#8B6914] bg-white"
                  >
                    <option value="">Unassigned</option>
                    {dealers.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <button onClick={() => setTransferring(false)}
                      className="flex-1 border border-gray-200 text-[#1A1A1A] text-xs font-medium py-1.5 rounded-lg hover:bg-[#F4F4F5] transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleTransfer} disabled={transferSaving}
                      className="flex-1 bg-[#8B6914] hover:bg-[#7a5c11] text-white text-xs font-semibold py-1.5 rounded-lg disabled:opacity-60 transition-colors">
                      {transferSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[#1A1A1A]">{customer.assignedDealerName || 'Unassigned'}</span>
                  <button onClick={openTransfer}
                    className="text-xs text-[#8B6914] hover:underline font-medium shrink-0">
                    Transfer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-3">Quick Actions</p>
            <div className="space-y-1.5">
              {customer.email && (
                <a href={`mailto:${customer.email}`} className="flex items-center gap-2 text-sm text-[#1A1A1A] hover:text-[#8B6914] transition-colors py-1">
                  ✉️ Email {customer.firstName}
                </a>
              )}
              {customer.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-sm text-[#1A1A1A] hover:text-[#8B6914] transition-colors py-1">
                  📞 Call {customer.firstName}
                </a>
              )}
              <Link to={`/invoices/new?customerId=${id}`} className="flex items-center gap-2 text-sm text-[#1A1A1A] hover:text-[#8B6914] transition-colors py-1 block">
                🧾 Create Invoice
              </Link>
              <Link to={`/quotes/new?customerId=${id}`} className="flex items-center gap-2 text-sm text-[#1A1A1A] hover:text-[#8B6914] transition-colors py-1 block">
                📋 Build Quote
              </Link>
              <Link to={`/service/new?customerId=${id}`} className="flex items-center gap-2 text-sm text-[#1A1A1A] hover:text-[#8B6914] transition-colors py-1 block">
                🔧 New Service Ticket
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-base font-semibold text-[#1A1A1A] mb-1">Delete Customer?</h2>
            <p className="text-sm text-[#9A9A9A] mb-5">
              This will permanently delete <span className="font-medium text-[#1A1A1A]">{customer.fullName}</span> and cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(false)}
                className="border border-gray-200 text-[#1A1A1A] text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#F4F4F5] transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60 transition-colors">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
