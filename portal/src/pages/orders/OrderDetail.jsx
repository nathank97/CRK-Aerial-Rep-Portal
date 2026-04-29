import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { updateDoc, addDoc, getDocs, getDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { useOrder } from '../../hooks/useOrders'
import { orderDoc, invoicesCol, inventoryCol } from '../../firebase/firestore'
import { matchAndReserve, releaseReservation } from '../../utils/inventoryReservation'
import { useEmailTemplate, fillTemplate, formatOrderLineItems } from '../../hooks/useEmailTemplate'
import StatusBadge from '../../components/common/StatusBadge'
import { SkeletonCard } from '../../components/common/SkeletonCard'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { nextInvoiceNumber } from '../../utils/numbering'
import { getTaxRate } from '../../utils/taxService'
import { computePaymentStatus } from '../../hooks/useInvoices'

const ORDER_STATUSES = ['Processing', 'Fulfilled', 'Shipped', 'Delivered', 'Cancelled']

function FulfillModal({ order, onClose, onConfirm, saving }) {
  const [inventory, setInventory] = useState([])
  const [loadingInv, setLoadingInv] = useState(true)
  const [rows, setRows] = useState([])
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    getDocs(inventoryCol).then((snap) => {
      const inv = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setInventory(inv)
      const reserved = order.reservedItems ?? []
      const initialRows = (order.lineItems ?? []).map((li) => {
        const match = reserved.find((r) => r.matched && r.description === li.description)
        return { lineItem: li, inventoryId: match?.inventoryId ?? '', oemDirect: false }
      })
      setRows(initialRows)
      setLoadingInv(false)
    })
  }, [])

  const updateRow = (i, patch) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const applyToAll = (inventoryId) =>
    setRows((prev) => prev.map((r) => (r.oemDirect ? r : { ...r, inventoryId })))

  const negativeRows = rows.filter((r) => {
    if (r.oemDirect || !r.inventoryId) return false
    const inv = inventory.find((i) => i.id === r.inventoryId)
    return inv && (inv.quantityOnHand ?? 0) - (r.lineItem.quantity ?? 1) < 0
  })
  const hasWarnings = negativeRows.length > 0
  const canConfirm = !hasWarnings || acknowledged

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#111111]">Fulfill from Warehouse</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#111111] text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {loadingInv ? (
            <p className="text-sm text-[#9A9A9A] text-center py-8 animate-pulse">Loading inventory…</p>
          ) : (
            <>
              <p className="text-xs text-[#9A9A9A] mb-1">
                Select the inventory source for each line item, or mark as OEM Direct (ships from manufacturer).
              </p>

              {rows.map((row, i) => {
                const qty = row.lineItem.quantity ?? 1
                const selInv = row.inventoryId ? inventory.find((inv) => inv.id === row.inventoryId) : null
                const wouldGoNegative = selInv && !row.oemDirect && (selInv.quantityOnHand ?? 0) - qty < 0

                return (
                  <div
                    key={i}
                    className={`border rounded-lg p-3 space-y-2 ${
                      wouldGoNegative ? 'border-[#D95F5F]/40 bg-[#D95F5F]/5' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111111] truncate">{row.lineItem.description}</p>
                        <p className="text-xs text-[#9A9A9A]">Qty: {qty}</p>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-[#9A9A9A] font-medium cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={row.oemDirect}
                          onChange={(e) => updateRow(i, { oemDirect: e.target.checked, inventoryId: '' })}
                          className="accent-[#8B6914]"
                        />
                        OEM Direct
                      </label>
                    </div>

                    {!row.oemDirect && (
                      <div className="flex gap-2 items-center">
                        <select
                          value={row.inventoryId}
                          onChange={(e) => updateRow(i, { inventoryId: e.target.value })}
                          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#8B6914] bg-white"
                        >
                          <option value="">— Select inventory item —</option>
                          {inventory.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.modelName || inv.sku || inv.id} · On Hand: {inv.quantityOnHand ?? 0}
                            </option>
                          ))}
                        </select>
                        {row.inventoryId && (
                          <button
                            onClick={() => applyToAll(row.inventoryId)}
                            className="text-xs text-[#8B6914] hover:underline whitespace-nowrap font-medium"
                          >
                            Apply to all
                          </button>
                        )}
                      </div>
                    )}

                    {wouldGoNegative && (
                      <p className="text-xs font-semibold text-[#D95F5F]">
                        Warning: deducting {qty} from {selInv.quantityOnHand ?? 0} on hand will result in{' '}
                        {(selInv.quantityOnHand ?? 0) - qty} (negative stock).
                      </p>
                    )}
                  </div>
                )
              })}

              {hasWarnings && (
                <label className="flex items-start gap-2 text-sm text-[#D95F5F] font-medium cursor-pointer mt-2 p-3 border border-[#D95F5F]/30 rounded-lg bg-[#D95F5F]/5">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-0.5 accent-[#D95F5F]"
                  />
                  I acknowledge this fulfillment will result in negative stock for one or more items.
                </label>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 border border-gray-200 text-[#111111] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(rows)}
            disabled={saving || loadingInv || !canConfirm}
            className="flex-1 bg-[#4CAF7D] hover:bg-[#3da86e] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Fulfilling…' : 'Confirm Fulfillment'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, isAdmin, isWarehouseManager } = useAuth()
  const { order, loading } = useOrder(id)
  const { template: emailTemplate } = useEmailTemplate()

  const [saving, setSaving] = useState(false)
  const [reserving, setReserving] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [trackingEdit, setTrackingEdit] = useState('')
  const [fulfillmentEdit, setFulfillmentEdit] = useState('')
  const [editingTracking, setEditingTracking] = useState(false)
  const [notesEdit, setNotesEdit] = useState('')
  const [editingNotes, setEditingNotes] = useState(false)
  const [showFulfill, setShowFulfill] = useState(false)

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

  const handleReserveInventory = async () => {
    setReserving(true)
    try {
      const results = await matchAndReserve(order.lineItems ?? [], order.dealerId ?? user.uid)
      const anyMatched = results.some((r) => r.matched)
      await updateDoc(orderDoc(id), {
        inventoryReserved: anyMatched,
        reservedItems: results,
        updatedAt: serverTimestamp(),
      })
      flash(anyMatched ? 'Inventory reserved.' : 'No matching inventory found — items flagged.')
    } catch (err) {
      console.error(err)
      flash('Failed to reserve inventory.')
    } finally {
      setReserving(false)
    }
  }

  const handleReleaseReservation = async () => {
    if (!window.confirm('Release all inventory reservations for this order?')) return
    setReserving(true)
    try {
      await releaseReservation(order.reservedItems ?? [])
      await updateDoc(orderDoc(id), {
        inventoryReserved: false,
        reservedItems: [],
        updatedAt: serverTimestamp(),
      })
      flash('Inventory reservation released.')
    } catch (err) {
      console.error(err)
      flash('Failed to release reservation.')
    } finally {
      setReserving(false)
    }
  }

  const handleSendToWarehouse = async () => {
    setSaving(true)
    try {
      const vars = {
        orderNumber: order.orderNumber ?? '',
        customerName: order.customerName ?? '',
        customerAddress: order.customerAddress ?? '',
        lineItems: formatOrderLineItems(order.lineItems),
        total: (order.total ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
        notes: order.notes || 'None',
        dealerName: order.dealerName || profile?.displayName || '',
      }
      const to = emailTemplate.warehouseEmail || ''
      if (to) {
        const subject = fillTemplate(emailTemplate.orderSubject, vars)
        const body = fillTemplate(emailTemplate.orderBody, vars)
        const a = document.createElement('a')
        a.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      await updateDoc(orderDoc(id), {
        sentToWarehouse: true,
        sentToWarehouseAt: serverTimestamp(),
        sentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      flash('Order added to warehouse queue.')
    } catch (err) {
      console.error(err)
      flash('Failed to send to warehouse.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveFromQueue = async () => {
    setSaving(true)
    try {
      await updateDoc(orderDoc(id), {
        sentToWarehouse: false,
        updatedAt: serverTimestamp(),
      })
      flash('Order removed from warehouse queue.')
    } catch (err) {
      console.error(err)
      flash('Failed to remove from queue.')
    } finally {
      setSaving(false)
    }
  }

  const handleFulfill = async (rows) => {
    setSaving(true)
    try {
      const details = []

      for (const row of rows) {
        const qty = row.lineItem.quantity ?? 1

        if (row.oemDirect) {
          details.push({ description: row.lineItem.description, qty, source: 'OEM Direct', inventoryId: null, model: null, sku: null })
          continue
        }

        if (!row.inventoryId) {
          details.push({ description: row.lineItem.description, qty, source: 'Unassigned', inventoryId: null, model: null, sku: null })
          continue
        }

        const invRef = doc(db, 'inventory', row.inventoryId)
        const invSnap = await getDoc(invRef)
        if (invSnap.exists()) {
          const data = invSnap.data()
          const newOnHand = (data.quantityOnHand ?? 0) - qty
          const wasReserved = (order.reservedItems ?? []).some(
            (r) => r.matched && r.inventoryId === row.inventoryId
          )
          const newReserved = wasReserved
            ? Math.max(0, (data.quantityReserved ?? 0) - qty)
            : (data.quantityReserved ?? 0)
          await updateDoc(invRef, {
            quantityOnHand: newOnHand,
            quantityReserved: newReserved,
            updatedAt: serverTimestamp(),
          })
          details.push({
            description: row.lineItem.description,
            qty,
            source: 'Warehouse',
            inventoryId: row.inventoryId,
            model: data.modelName ?? '',
            sku: data.sku ?? '',
          })
        }
      }

      await updateDoc(orderDoc(id), {
        status: 'Fulfilled',
        sentToWarehouse: false,
        inventoryReserved: false,
        reservedItems: [],
        fulfilledAt: serverTimestamp(),
        fulfillmentDetails: details,
        updatedAt: serverTimestamp(),
      })
      setShowFulfill(false)
      flash('Order fulfilled successfully.')
    } catch (err) {
      console.error(err)
      flash('Failed to fulfill order.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateInvoice = async () => {
    if (!window.confirm('Create an invoice from this order?')) return
    setSaving(true)
    try {
      const invoiceNumber = await nextInvoiceNumber()
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
      {showFulfill && (
        <FulfillModal
          order={order}
          onClose={() => setShowFulfill(false)}
          onConfirm={handleFulfill}
          saving={saving}
        />
      )}

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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-lg font-bold text-[#8B6914]">{order.orderNumber}</span>
              <StatusBadge status={order.status ?? 'Processing'} />
              {order.sentToWarehouse && (
                <span className="text-xs font-semibold bg-[#4A90B8]/15 text-[#4A90B8] px-2 py-0.5 rounded-full">
                  In Warehouse Queue
                </span>
              )}
            </div>
            <p className="text-[#111111] font-semibold mt-1 text-lg">{order.customerName || '—'}</p>
            {order.customerEmail && <p className="text-sm text-[#9A9A9A]">{order.customerEmail}</p>}
            <p className="text-xs text-[#9A9A9A] mt-1">Created: {formatDate(order.createdAt)}</p>
          </div>

          <div className="flex flex-wrap gap-2 items-start">
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

            {(isAdmin || isWarehouseManager) && order.status !== 'Fulfilled' && order.sentToWarehouse && (
              <button
                onClick={() => setShowFulfill(true)}
                disabled={saving}
                className="text-sm bg-[#4CAF7D] hover:bg-[#3da86e] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 font-medium"
              >
                Fulfill from Warehouse
              </button>
            )}

            {!order.sentToWarehouse ? (
              <button
                onClick={handleSendToWarehouse}
                disabled={saving}
                className="text-sm border border-[#4A90B8] text-[#4A90B8] hover:bg-[#4A90B8]/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                Send to Warehouse
              </button>
            ) : (
              <button
                onClick={handleSendToWarehouse}
                disabled={saving}
                className="text-sm border border-[#4A90B8] text-[#4A90B8] hover:bg-[#4A90B8]/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 opacity-60"
              >
                Resend to Queue
              </button>
            )}
            {order.sentToWarehouse && (isAdmin || isWarehouseManager) && (
              <button
                onClick={handleRemoveFromQueue}
                disabled={saving}
                className="text-sm border border-gray-200 text-[#9A9A9A] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                Remove from Queue
              </button>
            )}
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

      {/* Inventory Reservation */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-[#111111]">Inventory Reservation</h2>
            {order.inventoryReserved ? (
              <span className="text-xs font-semibold bg-[#4CAF7D]/15 text-[#4CAF7D] px-2 py-0.5 rounded-full">Reserved</span>
            ) : (
              <span className="text-xs font-semibold bg-[#9A9A9A]/15 text-[#9A9A9A] px-2 py-0.5 rounded-full">Not Reserved</span>
            )}
          </div>
          <div className="flex gap-2">
            {!order.inventoryReserved && (
              <button
                onClick={handleReserveInventory}
                disabled={reserving || saving}
                className="text-sm border border-[#8B6914] text-[#8B6914] hover:bg-[#8B6914]/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {reserving ? 'Reserving…' : 'Reserve Inventory'}
              </button>
            )}
            {order.inventoryReserved && isAdmin && (
              <button
                onClick={handleReleaseReservation}
                disabled={reserving || saving}
                className="text-sm border border-[#D95F5F] text-[#D95F5F] hover:bg-[#D95F5F]/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {reserving ? 'Releasing…' : 'Release Reservation'}
              </button>
            )}
          </div>
        </div>

        {order.inventoryReserved && (order.reservedItems ?? []).length > 0 ? (
          <div className="space-y-2">
            {(order.reservedItems ?? []).map((r, i) => (
              <div key={i} className={`flex items-start justify-between gap-3 text-sm py-2.5 px-3 rounded-lg border ${
                r.matched ? 'bg-[#4CAF7D]/5 border-[#4CAF7D]/20' : 'bg-[#D95F5F]/5 border-[#D95F5F]/20'
              }`}>
                <div className="min-w-0">
                  <p className="font-medium text-[#111111] truncate">{r.description}</p>
                  {r.matched
                    ? <p className="text-xs text-[#9A9A9A] mt-0.5">Matched: {r.model}{r.sku ? ` · SKU: ${r.sku}` : ''}</p>
                    : <p className="text-xs text-[#D95F5F] mt-0.5">No matching inventory found at your location</p>
                  }
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[#9A9A9A]">×{r.qty}</span>
                  {r.matched
                    ? <span className="text-xs font-semibold text-[#4CAF7D]">✓ Reserved</span>
                    : <span className="text-xs font-semibold text-[#D95F5F]">✗ Unmatched</span>
                  }
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#9A9A9A]">
            {order.inventoryReserved
              ? 'No reservation details recorded.'
              : 'No inventory has been reserved. Click "Reserve Inventory" to automatically match items by SKU or model name.'}
          </p>
        )}
      </div>

      {/* Fulfillment Details */}
      {(order.fulfillmentDetails ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <h2 className="text-sm font-semibold text-[#111111]">Fulfillment Details</h2>
            {order.fulfilledAt && (
              <span className="text-xs text-[#9A9A9A]">· {formatDate(order.fulfilledAt)}</span>
            )}
          </div>
          <div className="space-y-2">
            {order.fulfillmentDetails.map((d, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-sm py-2.5 px-3 rounded-lg border border-gray-100 bg-[#F4F4F5]">
                <div className="min-w-0">
                  <p className="font-medium text-[#111111] truncate">{d.description}</p>
                  <p className="text-xs text-[#9A9A9A] mt-0.5">
                    {d.source === 'OEM Direct'
                      ? 'OEM Direct'
                      : d.source === 'Unassigned'
                      ? 'Not assigned'
                      : `${d.model || 'Warehouse'}${d.sku ? ` · SKU: ${d.sku}` : ''}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[#9A9A9A]">×{d.qty}</span>
                  <span className={`text-xs font-semibold ${
                    d.source === 'OEM Direct' ? 'text-[#4A90B8]'
                    : d.source === 'Unassigned' ? 'text-[#9A9A9A]'
                    : 'text-[#4CAF7D]'
                  }`}>
                    {d.source === 'OEM Direct' ? 'OEM Direct' : d.source === 'Unassigned' ? 'Unassigned' : '✓ Fulfilled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
