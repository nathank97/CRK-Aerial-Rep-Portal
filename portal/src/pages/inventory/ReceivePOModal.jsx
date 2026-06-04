import { useState } from 'react'
import { addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { inventoryCol, purchaseOrdersCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

function calcStatus(items) {
  const allDone = items.every((i) => (i.receivedQty ?? 0) >= i.orderedQty)
  if (allDone) return 'Fully Received'
  const anyDone = items.some((i) => (i.receivedQty ?? 0) > 0)
  if (anyDone) return 'Partially Received'
  return 'Ordered'
}

export default function ReceivePOModal({ po, dealerMap, onClose }) {
  const { profile, user } = useAuth()
  const [receiveNow, setReceiveNow] = useState(() => {
    const init = {}
    po.items?.forEach((item) => { init[item.id] = '' })
    return init
  })
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
  const [receiptNotes, setReceiptNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const outstanding = (item) => Math.max(0, item.orderedQty - (item.receivedQty ?? 0))

  function receiveAll() {
    const next = {}
    po.items?.forEach((item) => { next[item.id] = outstanding(item) })
    setReceiveNow(next)
  }

  const totalReceiving = Object.values(receiveNow).reduce((s, v) => s + (parseInt(v) || 0), 0)
  const hasAnything = totalReceiving > 0

  async function handleSave() {
    setError('')
    if (!hasAnything) { setError('Enter a quantity to receive for at least one item.'); return }

    for (const item of po.items ?? []) {
      const qty = parseInt(receiveNow[item.id]) || 0
      if (qty < 0) { setError(`Quantity cannot be negative.`); return }
      if (qty > outstanding(item)) {
        setError(`"${item.modelName}": cannot receive more than the outstanding qty (${outstanding(item)}).`)
        return
      }
    }

    setSaving(true)
    try {
      const updatedItems = await Promise.all(
        (po.items ?? []).map(async (item) => {
          const qty = parseInt(receiveNow[item.id]) || 0
          if (qty === 0) return item

          const invRef = await addDoc(inventoryCol, {
            poId: po.id,
            brand: item.brand ?? null,
            category: item.category ?? null,
            modelName: item.modelName,
            sku: item.sku ?? null,
            condition: item.condition ?? 'New',
            quantityOnHand: qty,
            quantityReserved: 0,
            quantityAvailable: qty,
            msrp: item.msrp ?? null,
            costPrice: item.costPrice ?? null,
            lowStockThreshold: item.lowStockThreshold ?? null,
            dealerId: po.dealerId,
            receivedDate,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })

          return {
            ...item,
            receivedQty: (item.receivedQty ?? 0) + qty,
            inventoryIds: [...(item.inventoryIds ?? []), invRef.id],
          }
        })
      )

      const newStatus = calcStatus(updatedItems)
      await updateDoc(doc(db, 'purchaseOrders', po.id), {
        items: updatedItems,
        status: newStatus,
        lastReceivedDate: receivedDate,
        lastReceivedBy: profile?.displayName ?? user?.email ?? '',
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
              {po.supplierName}{po.poNumber ? ` · PO ${po.poNumber}` : ''} · {dealerMap[po.dealerId] || '—'}
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
              <input value={receiptNotes} onChange={(e) => setReceiptNotes(e.target.value)}
                placeholder="Optional" className={`${iCls} w-full`} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#1A1A1A]">Items</p>
            <button onClick={receiveAll}
              className="text-sm text-[#8B6914] font-semibold hover:underline">
              Receive All Outstanding
            </button>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(po.items ?? []).map((item) => {
                  const out = outstanding(item)
                  const done = out === 0
                  return (
                    <tr key={item.id} className={done ? 'bg-[#4CAF7D]/5' : ''}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#1A1A1A]">{item.modelName}</p>
                        <p className="text-xs text-[#9A9A9A]">
                          {[item.brand, item.category, item.sku].filter(Boolean).join(' · ')}
                        </p>
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
                          : <span className="text-sm font-semibold text-[#E6A817]">{out}</span>
                        }
                      </td>
                      <td className="px-3 py-3 text-center">
                        {done ? (
                          <span className="text-xs text-[#9A9A9A]">—</span>
                        ) : (
                          <input
                            type="number" min="0" max={out}
                            value={receiveNow[item.id] ?? ''}
                            onChange={(e) => setReceiveNow((p) => ({ ...p, [item.id]: e.target.value }))}
                            className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[#8B6914]"
                            placeholder="0"
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalReceiving > 0 && (
            <p className="text-sm text-[#9A9A9A]">
              Receiving <span className="font-semibold text-[#1A1A1A]">{totalReceiving}</span> total unit{totalReceiving !== 1 ? 's' : ''} — inventory records will be created automatically.
            </p>
          )}

          {error && <p className="text-sm text-[#D95F5F] font-medium">{error}</p>}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] text-sm font-medium py-2.5 rounded-lg hover:bg-[#F4F4F5]">Cancel</button>
          <button onClick={handleSave} disabled={saving || !hasAnything}
            className="flex-1 bg-[#8B6914] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#7a5c11] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : `Receive ${totalReceiving > 0 ? totalReceiving + ' Unit' + (totalReceiving !== 1 ? 's' : '') : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
