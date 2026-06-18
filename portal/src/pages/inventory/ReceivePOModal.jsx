import { useState } from 'react'
import { addDoc, updateDoc, getDoc, doc, serverTimestamp } from 'firebase/firestore'
import { inventoryCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { writeTx } from '../../utils/inventoryTransactions'

export function EditReceptionModal({ po, dealerMap, onClose }) {
  const { profile, user } = useAuth()
  const [quantities, setQuantities] = useState(() => {
    const init = {}
    po.items?.forEach((item) => { init[item.id] = String(item.receivedQty ?? 0) })
    return init
  })
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const locationName = dealerMap[po.dealerId] || po.dealerId || '—'

  const changedItems = (po.items ?? []).filter((item) => {
    if (item.cancelled) return false
    const newQty = parseInt(quantities[item.id])
    return !isNaN(newQty) && newQty !== (item.receivedQty ?? 0)
  })
  const hasChanges = changedItems.length > 0

  async function handleSave() {
    setError('')
    for (const item of po.items ?? []) {
      if (item.cancelled) continue
      const newQty = parseInt(quantities[item.id])
      if (isNaN(newQty) || newQty < 0) { setError('All quantities must be 0 or more.'); return }
      if (newQty > item.orderedQty) {
        setError(`"${item.modelName}": cannot exceed ordered quantity (${item.orderedQty}).`)
        return
      }
    }

    setSaving(true)
    const createdBy = profile?.displayName ?? user?.email ?? ''

    try {
      const updatedItems = await Promise.all(
        (po.items ?? []).map(async (item) => {
          if (item.cancelled) return item
          const newQty = parseInt(quantities[item.id]) ?? (item.receivedQty ?? 0)
          const oldQty = item.receivedQty ?? 0
          const delta = newQty - oldQty
          if (delta === 0) return item

          if (item.inventoryIds?.length > 0) {
            const invId = item.inventoryIds[0]
            const invSnap = await getDoc(doc(db, 'inventory', invId))
            if (invSnap.exists()) {
              const d = invSnap.data()
              const newOnHand = Math.max(0, (d.quantityOnHand ?? 0) + delta)
              await updateDoc(doc(db, 'inventory', invId), {
                quantityOnHand: newOnHand,
                quantityAvailable: Math.max(0, newOnHand - (d.quantityReserved ?? 0)),
                updatedAt: serverTimestamp(),
              })
              await writeTx([{
                type: 'po_adjustment',
                qty: delta,
                modelName: item.modelName,
                brand: item.brand ?? null,
                sku: item.sku ?? null,
                category: item.category ?? null,
                dealerId: po.dealerId,
                inventoryId: invId,
                sourceType: 'purchase_order',
                sourceId: po.id,
                sourceNumber: po.poNumber || po.supplierName,
                fromLocation: delta > 0 ? (po.supplierName || 'Supplier') : locationName,
                toLocation: delta > 0 ? locationName : 'Adjustment',
                notes: notes.trim() || `Reception edit: ${oldQty} → ${newQty}`,
                createdBy,
              }])
            }
          }

          return { ...item, receivedQty: newQty }
        })
      )

      const newStatus = calcStatus(updatedItems)
      await updateDoc(doc(db, 'purchaseOrders', po.id), {
        items: updatedItems,
        status: newStatus,
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      console.error(e)
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  const iCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">Edit Reception</h2>
            <p className="text-xs text-[#9A9A9A] mt-0.5">
              {po.supplierName}{po.poNumber ? ` · PO ${po.poNumber}` : ''} · {locationName}
            </p>
          </div>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Adjustment Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — reason for editing received quantities"
              className={`${iCls} w-full`} />
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F4F4F5] border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Item</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Ordered</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Currently Received</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Adjust To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(po.items ?? []).map((item) => {
                  if (item.cancelled) {
                    return (
                      <tr key={item.id} className="bg-gray-50 opacity-60">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1A1A1A]">{item.modelName}</p>
                          <p className="text-xs text-[#9A9A9A]">{[item.brand, item.sku].filter(Boolean).join(' · ')}</p>
                        </td>
                        <td className="px-3 py-3 text-center text-[#1A1A1A]">{item.orderedQty}</td>
                        <td className="px-3 py-3 text-center text-[#9A9A9A]">{item.receivedQty ?? 0}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-semibold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Cancelled</span>
                        </td>
                      </tr>
                    )
                  }
                  const newQty = parseInt(quantities[item.id])
                  const oldQty = item.receivedQty ?? 0
                  const delta = isNaN(newQty) ? 0 : newQty - oldQty
                  const changed = !isNaN(newQty) && newQty !== oldQty
                  return (
                    <tr key={item.id} className={changed ? (delta > 0 ? 'bg-[#4CAF7D]/5' : 'bg-[#D95F5F]/5') : ''}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1A1A1A]">{item.modelName}</p>
                        <p className="text-xs text-[#9A9A9A]">{[item.brand, item.sku].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className="px-3 py-3 text-center text-[#1A1A1A]">{item.orderedQty}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-semibold text-[#4CAF7D]">{oldQty}</span>
                        {changed && (
                          <span className={`ml-2 text-xs font-semibold ${delta > 0 ? 'text-[#4CAF7D]' : 'text-[#D95F5F]'}`}>
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number" min="0" max={item.orderedQty}
                          value={quantities[item.id] ?? ''}
                          onChange={(e) => setQuantities((p) => ({ ...p, [item.id]: e.target.value }))}
                          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[#8B6914]"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-[#D95F5F] font-medium">{error}</p>}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] text-sm font-medium py-2.5 rounded-lg hover:bg-[#F4F4F5]">Cancel</button>
          <button onClick={handleSave} disabled={saving || !hasChanges}
            className="flex-1 bg-[#4A90B8] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#3d7ea3] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : `Save${changedItems.length > 0 ? ` (${changedItems.length} change${changedItems.length !== 1 ? 's' : ''})` : ' Changes'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function calcStatus(items) {
  const active = items.filter((i) => !i.cancelled)
  if (active.length === 0) return 'Fully Received'
  if (active.every((i) => (i.receivedQty ?? 0) >= i.orderedQty)) return 'Fully Received'
  if (active.some((i) => (i.receivedQty ?? 0) > 0)) return 'Partially Received'
  return 'Ordered'
}

export default function ReceivePOModal({ po, dealerMap, onClose }) {
  const { profile, user } = useAuth()
  const [receiveNow, setReceiveNow] = useState(() => {
    const init = {}
    po.items?.forEach((item) => { init[item.id] = '' })
    return init
  })
  const [cancelNow, setCancelNow] = useState({})
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
  const [receiptNotes, setReceiptNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const outstanding = (item) => Math.max(0, item.orderedQty - (item.receivedQty ?? 0))
  const locationName = dealerMap[po.dealerId] || po.dealerId || '—'

  function toggleCancel(itemId) {
    setCancelNow((p) => {
      const next = { ...p, [itemId]: !p[itemId] }
      if (next[itemId]) setReceiveNow((rn) => ({ ...rn, [itemId]: '' }))
      return next
    })
  }

  function receiveAll() {
    const next = {}
    po.items?.forEach((item) => {
      if (!item.cancelled && !cancelNow[item.id]) next[item.id] = outstanding(item)
      else next[item.id] = ''
    })
    setReceiveNow(next)
  }

  const totalReceiving = Object.values(receiveNow).reduce((s, v) => s + (parseInt(v) || 0), 0)
  const totalCancelling = Object.keys(cancelNow).filter((k) => cancelNow[k]).length
  const hasAnything = totalReceiving > 0 || totalCancelling > 0

  async function handleSave() {
    setError('')
    if (!hasAnything) { setError('Enter a quantity to receive or mark at least one item as cancelled.'); return }
    for (const item of po.items ?? []) {
      if (item.cancelled || cancelNow[item.id]) continue
      const qty = parseInt(receiveNow[item.id]) || 0
      if (qty < 0) { setError('Quantity cannot be negative.'); return }
      if (qty > outstanding(item)) {
        setError(`"${item.modelName}": cannot receive more than outstanding qty (${outstanding(item)}).`)
        return
      }
    }

    setSaving(true)
    const createdBy = profile?.displayName ?? user?.email ?? ''

    try {
      const updatedItems = await Promise.all(
        (po.items ?? []).map(async (item) => {
          if (item.cancelled) return item

          const qty = parseInt(receiveNow[item.id]) || 0
          const isCancellingNow = !!cancelNow[item.id]
          if (qty === 0 && !isCancellingNow) return item

          const newReceivedQty = (item.receivedQty ?? 0) + qty

          if (qty > 0) {
            if (item.inventoryIds?.length > 0) {
              // New flow: update existing on_order record
              const invId = item.inventoryIds[0]
              const invSnap = await getDoc(doc(db, 'inventory', invId))
              if (invSnap.exists()) {
                const d = invSnap.data()
                const newOnHand = (d.quantityOnHand ?? 0) + qty
                const newOnOrder = Math.max(0, (d.quantityOnOrder ?? item.orderedQty) - qty)
                await updateDoc(doc(db, 'inventory', invId), {
                  quantityOnHand: newOnHand,
                  quantityOnOrder: newOnOrder,
                  quantityAvailable: Math.max(0, newOnHand - (d.quantityReserved ?? 0)),
                  inventoryStatus: 'in_stock',
                  receivedDate,
                  updatedAt: serverTimestamp(),
                })
                await writeTx([{
                  type: 'po_receipt',
                  qty,
                  modelName: item.modelName,
                  brand: item.brand ?? null,
                  sku: item.sku ?? null,
                  category: item.category ?? null,
                  dealerId: po.dealerId,
                  inventoryId: invId,
                  sourceType: 'purchase_order',
                  sourceId: po.id,
                  sourceNumber: po.poNumber || po.supplierName,
                  fromLocation: po.supplierName || 'Supplier',
                  toLocation: locationName,
                  notes: receiptNotes || null,
                  createdBy,
                }])
              }
              if (!isCancellingNow) return { ...item, receivedQty: newReceivedQty }
            } else {
              // Legacy flow: create new inventory record
              const invRef = await addDoc(inventoryCol, {
                poId: po.id,
                inventoryStatus: 'in_stock',
                dealerId: po.dealerId,
                brand: item.brand ?? null,
                category: item.category ?? null,
                modelName: item.modelName,
                sku: item.sku ?? null,
                condition: item.condition ?? 'New',
                quantityOnHand: qty,
                quantityOnOrder: 0,
                quantityReserved: 0,
                quantityAvailable: qty,
                msrp: item.msrp ?? null,
                costPrice: item.costPrice ?? null,
                lowStockThreshold: item.lowStockThreshold ?? null,
                receivedDate,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
              await writeTx([{
                type: 'po_receipt',
                qty,
                modelName: item.modelName,
                brand: item.brand ?? null,
                sku: item.sku ?? null,
                category: item.category ?? null,
                dealerId: po.dealerId,
                inventoryId: invRef.id,
                sourceType: 'purchase_order',
                sourceId: po.id,
                sourceNumber: po.poNumber || po.supplierName,
                fromLocation: po.supplierName || 'Supplier',
                toLocation: locationName,
                notes: receiptNotes || null,
                createdBy,
              }])
              if (!isCancellingNow) {
                return { ...item, receivedQty: newReceivedQty, inventoryIds: [...(item.inventoryIds ?? []), invRef.id] }
              }
            }
          }

          if (isCancellingNow) {
            const cancelQty = outstanding(item) - qty
            if (item.inventoryIds?.length > 0) {
              const invId = item.inventoryIds[0]
              const invSnap = await getDoc(doc(db, 'inventory', invId))
              if (invSnap.exists()) {
                const d = invSnap.data()
                if ((d.quantityOnHand ?? 0) > 0 || qty > 0) {
                  await updateDoc(doc(db, 'inventory', invId), { quantityOnOrder: 0, updatedAt: serverTimestamp() })
                } else {
                  await updateDoc(doc(db, 'inventory', invId), { inventoryStatus: 'cancelled', quantityOnOrder: 0, updatedAt: serverTimestamp() })
                }
              }
            }
            if (cancelQty > 0) {
              await writeTx([{
                type: 'cancellation',
                qty: -cancelQty,
                modelName: item.modelName,
                brand: item.brand ?? null,
                sku: item.sku ?? null,
                category: item.category ?? null,
                dealerId: po.dealerId,
                inventoryId: item.inventoryIds?.[0] ?? null,
                sourceType: 'purchase_order',
                sourceId: po.id,
                sourceNumber: po.poNumber || po.supplierName,
                fromLocation: locationName,
                toLocation: 'Cancelled',
                notes: receiptNotes || null,
                createdBy,
              }])
            }
            return { ...item, receivedQty: newReceivedQty, cancelled: true }
          }

          return { ...item, receivedQty: newReceivedQty }
        })
      )

      const newStatus = calcStatus(updatedItems)
      await updateDoc(doc(db, 'purchaseOrders', po.id), {
        items: updatedItems,
        status: newStatus,
        lastReceivedDate: receivedDate,
        lastReceivedBy: createdBy,
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch (e) {
      console.error(e)
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  const iCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">Receive Against PO</h2>
            <p className="text-xs text-[#9A9A9A] mt-0.5">
              {po.supplierName}{po.poNumber ? ` · PO ${po.poNumber}` : ''} · {locationName}
            </p>
          </div>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Date Received</label>
              <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={`${iCls} w-full`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Notes</label>
              <input value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)} placeholder="Optional" className={`${iCls} w-full`} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1A1A1A]">Items</p>
            <button onClick={receiveAll} className="text-sm text-[#8B6914] font-semibold hover:underline">Receive All Outstanding</button>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F4F4F5] border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Item</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Ordered</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Received</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Outstanding</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Receive Now</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Cancel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(po.items ?? []).map((item) => {
                  const out = outstanding(item)
                  const done = out === 0 && !item.cancelled
                  const alreadyCancelled = item.cancelled
                  const isCancellingNow = !!cancelNow[item.id]

                  if (alreadyCancelled) {
                    return (
                      <tr key={item.id} className="bg-gray-50 opacity-60">
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#1A1A1A]">{item.modelName}</p>
                          <p className="text-xs text-[#9A9A9A]">{[item.brand, item.category, item.sku].filter(Boolean).join(' · ')}</p>
                        </td>
                        <td className="px-3 py-3 text-center text-[#1A1A1A]">{item.orderedQty}</td>
                        <td className="px-3 py-3 text-center text-[#9A9A9A]">{item.receivedQty ?? 0}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-semibold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Cancelled</span>
                        </td>
                        <td className="px-3 py-3 text-center text-[#9A9A9A]">—</td>
                        <td className="px-3 py-3 text-center text-[#9A9A9A]">—</td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={item.id} className={done ? 'bg-[#4CAF7D]/5' : isCancellingNow ? 'bg-[#D95F5F]/5' : ''}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1A1A1A]">{item.modelName}</p>
                        <p className="text-xs text-[#9A9A9A]">{[item.brand, item.category, item.sku].filter(Boolean).join(' · ')}</p>
                      </td>
                      <td className="px-3 py-3 text-center text-[#1A1A1A]">{item.orderedQty}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-sm font-semibold ${(item.receivedQty ?? 0) > 0 ? 'text-[#4CAF7D]' : 'text-[#9A9A9A]'}`}>
                          {item.receivedQty ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {done
                          ? <span className="text-xs font-semibold bg-[#4CAF7D]/15 text-[#4CAF7D] px-2 py-0.5 rounded-full">Done</span>
                          : <span className={`text-sm font-semibold ${isCancellingNow ? 'text-[#D95F5F] line-through' : 'text-[#E6A817]'}`}>{out}</span>
                        }
                      </td>
                      <td className="px-3 py-3 text-center">
                        {done ? (
                          <span className="text-xs text-[#9A9A9A]">—</span>
                        ) : (
                          <input
                            type="number" min="0" max={out}
                            value={receiveNow[item.id] ?? ''}
                            disabled={isCancellingNow}
                            onChange={(e) => setReceiveNow((p) => ({ ...p, [item.id]: e.target.value }))}
                            className={`w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[#8B6914] ${isCancellingNow ? 'bg-gray-100 opacity-50' : ''}`}
                            placeholder="0"
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {done ? (
                          <span className="text-xs text-[#9A9A9A]">—</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={isCancellingNow}
                            onChange={() => toggleCancel(item.id)}
                            className="w-4 h-4 rounded border-gray-300 text-[#D95F5F] cursor-pointer"
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {hasAnything && (
            <p className="text-sm text-[#9A9A9A]">
              {totalReceiving > 0 && <>Receiving <span className="font-semibold text-[#1A1A1A]">{totalReceiving}</span> unit{totalReceiving !== 1 ? 's' : ''}</>}
              {totalReceiving > 0 && totalCancelling > 0 && ' · '}
              {totalCancelling > 0 && <>Cancelling <span className="font-semibold text-[#D95F5F]">{totalCancelling}</span> item{totalCancelling !== 1 ? 's' : ''}</>}
            </p>
          )}

          {error && <p className="text-sm text-[#D95F5F] font-medium">{error}</p>}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] text-sm font-medium py-2.5 rounded-lg hover:bg-[#F4F4F5]">Close</button>
          <button onClick={handleSave} disabled={saving || !hasAnything}
            className="flex-1 bg-[#8B6914] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#7a5c11] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : `Confirm${totalReceiving > 0 ? ` ${totalReceiving} unit${totalReceiving !== 1 ? 's' : ''}` : ''}${totalCancelling > 0 ? `${totalReceiving > 0 ? ' +' : ''} ${totalCancelling} cancel${totalCancelling !== 1 ? 's' : ''}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
