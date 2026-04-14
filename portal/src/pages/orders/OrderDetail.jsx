import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { useOrder } from '../../hooks/useOrders'
import { orderDoc, invoicesCol } from '../../firebase/firestore'
import StatusBadge from '../../components/common/StatusBadge'
import { SkeletonCard } from '../../components/common/SkeletonCard'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { nextInvoiceNumber } from '../../utils/numbering'
import { getTaxRate } from '../../utils/taxService'
import { computePaymentStatus } from '../../hooks/useInvoices'

const ORDER_STATUSES = ['Processing', 'Fulfilled', 'Shipped', 'Delivered', 'Cancelled']

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { order, loading } = useOrder(id)

  const [saving, setSaving] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [trackingEdit, setTrackingEdit] = useState('')
  const [fulfillmentEdit, setFulfillmentEdit] = useState('')
  const [editingTracking, setEditingTracking] = useState(false)
  const [notesEdit, setNotesEdit] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)

  const flash = (msg) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 3000)
  }

  const handleStatusChange = async (e) => {
    const status = e.target.value
    setSaving(true)
    try {
      await updateDoc(orderDoc(id), { status, updatedAt: serverTimestamp() })
      flash(`Status updated to ${status}.`)
    } catch (err) {
      console.error(err)
      flash('Failed to update status.')
    } finally {
      setSaving(false)
    }
  }

  const startTrackingEdit = () => {
    setTrackingEdit(order.trackingNumber ?? '')
    setFulfillmentEdit(order.fulfillmentDate ?? '')
    setEditingTracking(true)
  }

  const saveTracking = async () => {
    setSaving(true)
    try {
      await updateDoc(orderDoc(id), {
        trackingNumber: trackingEdit,
        fulfillmentDate: fulfillmentEdit || null,
        updatedAt: serverTimestamp(),
      })
      setEditingTracking(false)
      flash('Tracking info saved.')
    } catch (err) {
      console.error(err)
      flash('Failed to save tracking.')
    } finally {
      setSaving(false)
    }
  }

  const startNotesEdit = () => {
    setNotesEdit(order.notes ?? '')
    setEditingNotes(true)
  }

  const saveNotes = async () => {
    setSaving(true)
    try {
      await updateDoc(orderDoc(id), { notes: notesEdit, updatedAt: serverTimestamp() })
      setEditingNotes(false)
      flash('Notes saved.')
    } catch (err) {
      console.error(err)
      flash('Failed to save notes.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateInvoice = async () => {
    if (!window.confirm('Create an invoice from this order?')) return
    setSaving(true)
    try {
      const invoiceNumber = await nextInvoiceNumber()
      // Try to get tax rate from customer state if available
      const taxRate = order.customerState ? await getTaxRate(order.customerState) : (order.taxRate ?? 0)
      const taxExempt = order.taxExempt ?? false
      const subtotal = order.subtotal ?? 0
      const taxAmount = taxExempt ? 0 : subtotal * (taxRate / 100)
      const total = subtotal + taxAmount
      const amountPaid = 0
      const paymentStatus = computePaymentStatus({ total, amountPaid, dueDate: null })

      const invoiceRef = await addDoc(invoicesCol, {
        invoiceNumber,
        status: paymentStatus,
        customerId: order.customerId ?? null,
        customerName: order.customerName ?? '',
        customerEmail: order.customerEmail ?? '',
        customerAddress: order.customerAddress ?? '',
        customerState: order.customerState ?? '',
        lineItems: order.lineItems ?? [],
        subtotal,
        taxRate,
        taxExempt,
        exemptionType: '',
        exemptionCertificate: '',
        taxAmount,
        total,
        amountPaid,
        balanceDue: total,
        paymentStatus,
        paymentTerms: 'Net 30',
        dueDate: null,
        notes: order.notes ?? '',
        internalNotes: '',
        linkedOrderId: id,
        linkedOrderNumber: order.orderNumber,
        sentAt: null,
        dealerId: user.uid,
        dealerName: profile?.displayName ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      // Link invoice back to order
      await updateDoc(orderDoc(id), {
        linkedInvoiceId: invoiceRef.id,
        updatedAt: serverTimestamp(),
      })

      navigate(`/invoices/${invoiceRef.id}`)
    } catch (err) {
      console.error(err)
      flash('Failed to create invoice.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-32" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <p className="text-[#9A9A9A]">Order not found.</p>
        <button onClick={() => navigate('/orders')} className="mt-4 text-[#8B6914] text-sm underline">Back to Orders</button>
      </div>
    )
  }

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] w-full bg-white'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-5">
        <Link to="/orders" className="text-[#9A9A9A] hover:text-[#111111] transition-colors">Orders</Link>
        <span className="text-[#9A9A9A]">/</span>
        <span className="font-semibold text-[#111111]">{order.orderNumber}</span>
      </div>

      {/* Flash */}
      {actionMsg && (
        <div className="mb-4 bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 rounded-lg px-4 py-3 text-sm text-[#4CAF7D]">
          {actionMsg}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-lg font-bold text-[#8B6914]">{order.orderNumber}</span>
              <StatusBadge status={order.status ?? 'Processing'} />
            </div>
            <p className="text-[#111111] font-semibold mt-1 text-lg">{order.customerName || '—'}</p>
            {order.customerEmail && <p className="text-sm text-[#9A9A9A]">{order.customerEmail}</p>}
            <p className="text-xs text-[#9A9A9A] mt-1">Created: {formatDate(order.createdAt)}</p>
          </div>

          <div className="flex flex-wrap gap-2 items-start">
            {/* Status selector */}
            <select
              value={order.status ?? 'Processing'}
              onChange={handleStatusChange}
              disabled={saving}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#8B6914] bg-white"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {!order.linkedInvoiceId && (
              <button
                onClick={handleCreateInvoice}
                disabled={saving}
                className="text-sm bg-[#8B6914] hover:bg-[#7a5c12] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                Create Invoice
              </button>
            )}
          </div>
        </div>

        {/* Linked documents */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
          {order.linkedQuoteId && (
            <div>
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Linked Quote</p>
              <Link to={`/quotes/${order.linkedQuoteId}`} className="text-sm text-[#8B6914] underline hover:text-[#7a5c12]">
                {order.linkedQuoteNumber || 'View Quote'}
              </Link>
            </div>
          )}
          {order.linkedInvoiceId && (
            <div>
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Linked Invoice</p>
              <Link to={`/invoices/${order.linkedInvoiceId}`} className="text-sm text-[#8B6914] underline hover:text-[#7a5c12]">
                View Invoice
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <h2 className="text-sm font-semibold text-[#111111] mb-4">Line Items</h2>
        {(order.lineItems ?? []).length === 0 ? (
          <p className="text-sm text-[#9A9A9A] text-center py-8">No line items on this order.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Description</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-16">Qty</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-28">Unit Price</th>
                  <th className="text-right py-2 pl-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.lineItems.map((item, i) => (
                  <tr key={item.id ?? i}>
                    <td className="py-2 pr-3 text-[#111111]">{item.description}</td>
                    <td className="py-2 px-2 text-right text-[#9A9A9A]">{item.quantity}</td>
                    <td className="py-2 px-2 text-right text-[#9A9A9A]">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 pl-2 text-right font-semibold text-[#111111]">{formatCurrency((item.quantity ?? 1) * (item.unitPrice ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#9A9A9A]">Subtotal</span>
              <span className="font-medium text-[#111111]">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9A9A9A]">Tax ({order.taxRate ?? 0}%){order.taxExempt ? ' — Exempt' : ''}</span>
              <span className="font-medium text-[#111111]">{formatCurrency(order.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-gray-200 pt-2">
              <span className="text-[#111111]">Total</span>
              <span className="text-[#8B6914] text-base">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tracking & Fulfillment */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#111111]">Tracking & Fulfillment</h2>
          {!editingTracking && (
            <button
              onClick={startTrackingEdit}
              className="text-xs text-[#8B6914] hover:text-[#7a5c12] font-medium transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {editingTracking ? (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Tracking Number</label>
              <input type="text" value={trackingEdit} onChange={(e) => setTrackingEdit(e.target.value)} className={inputCls} placeholder="e.g. 1Z999AA10123456784" />
            </div>
            <div>
              <label className={labelCls}>Fulfillment Date</label>
              <input type="date" value={fulfillmentEdit} onChange={(e) => setFulfillmentEdit(e.target.value)} className={inputCls} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditingTracking(false)} className="text-sm border border-gray-200 text-[#111111] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveTracking} disabled={saving} className="text-sm bg-[#8B6914] hover:bg-[#7a5c12] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className={labelCls}>Tracking Number</p>
              <p className="text-[#111111]">{order.trackingNumber || <span className="text-[#9A9A9A]">Not set</span>}</p>
            </div>
            <div>
              <p className={labelCls}>Fulfillment Date</p>
              <p className="text-[#111111]">{order.fulfillmentDate ? formatDate(order.fulfillmentDate) : <span className="text-[#9A9A9A]">Not set</span>}</p>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#111111]">Notes</h2>
          {!editingNotes && (
            <button onClick={startNotesEdit} className="text-xs text-[#8B6914] hover:text-[#7a5c12] font-medium transition-colors">Edit</button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-3">
            <textarea rows={4} value={notesEdit} onChange={(e) => setNotesEdit(e.target.value)} className={inputCls} placeholder="Order notes…" />
            <div className="flex gap-2">
              <button onClick={() => setEditingNotes(false)} className="text-sm border border-gray-200 text-[#111111] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg transition-colors">Cancel</button>
              <button onClick={saveNotes} disabled={saving} className="text-sm bg-[#8B6914] hover:bg-[#7a5c12] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#111111]">{order.notes || <span className="text-[#9A9A9A]">No notes.</span>}</p>
        )}
      </div>
    </div>
  )
}
