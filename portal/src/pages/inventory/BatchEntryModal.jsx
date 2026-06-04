import { useState, useEffect, useRef } from 'react'
import { addDoc, updateDoc, deleteDoc, getDocs, query, where, doc, serverTimestamp } from 'firebase/firestore'
import { inventoryBatchesCol, inventoryCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

const CONDITIONS = ['New', 'Demo', 'Refurbished']

function blankRow(key) {
  return {
    _key: key,
    inventoryId: null,
    inventoryReserved: 0,
    brand: '',
    modelName: '',
    sku: '',
    serialNumber: '',
    condition: 'New',
    quantity: 1,
    costPrice: '',
    msrp: '',
    lowStockThreshold: '',
  }
}

const iCls = 'border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#8B6914] bg-white w-full'
const lbl = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

export default function BatchEntryModal({ batch, dealers, onClose }) {
  const { profile, user } = useAuth()
  const keyRef = useRef(1)
  const nextKey = () => { keyRef.current += 1; return keyRef.current }

  const [supplierName, setSupplierName] = useState(batch?.supplierName ?? '')
  const [poNumber, setPoNumber] = useState(batch?.poNumber ?? '')
  const [dateReceived, setDateReceived] = useState(batch?.dateReceived ?? '')
  const [dealerId, setDealerId] = useState(batch?.dealerId ?? '')
  const [notes, setNotes] = useState(batch?.notes ?? '')

  const [rows, setRows] = useState(() => [blankRow(1)])
  const [removedInventoryIds, setRemovedInventoryIds] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!batch?.id) return
    setLoadingItems(true)
    getDocs(query(inventoryCol, where('batchId', '==', batch.id))).then((snap) => {
      if (snap.empty) {
        setRows([blankRow(nextKey())])
      } else {
        setRows(
          snap.docs.map((d) => {
            const data = d.data()
            return {
              _key: d.id,
              inventoryId: d.id,
              inventoryReserved: data.quantityReserved ?? 0,
              brand: data.brand ?? '',
              modelName: data.modelName ?? '',
              sku: data.sku ?? '',
              serialNumber: data.serialNumber ?? '',
              condition: data.condition ?? 'New',
              quantity: data.quantityOnHand ?? 1,
              costPrice: data.costPrice ?? '',
              msrp: data.msrp ?? '',
              lowStockThreshold: data.lowStockThreshold ?? '',
            }
          })
        )
      }
      setLoadingItems(false)
    })
  }, [batch?.id])

  function addRow() {
    setRows((prev) => [...prev, blankRow(nextKey())])
  }

  function updateRow(key, field, value) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)))
  }

  function removeRow(key) {
    const row = rows.find((r) => r._key === key)
    if (row?.inventoryId) {
      setRemovedInventoryIds((prev) => [...prev, row.inventoryId])
    }
    setRows((prev) => prev.filter((r) => r._key !== key))
  }

  async function handleSave() {
    setError('')
    if (!supplierName.trim()) { setError('Supplier / Vendor name is required.'); return }
    if (!dateReceived) { setError('Date received is required.'); return }
    if (!dealerId) { setError('Location is required.'); return }
    if (rows.length === 0) { setError('Add at least one item.'); return }
    const badIdx = rows.findIndex((r) => !r.modelName.trim())
    if (badIdx !== -1) { setError(`Row ${badIdx + 1}: Model name is required.`); return }

    setSaving(true)
    try {
      if (!batch) {
        const batchRef = await addDoc(inventoryBatchesCol, {
          supplierName: supplierName.trim(),
          poNumber: poNumber.trim() || null,
          dateReceived,
          notes: notes.trim() || null,
          dealerId,
          itemCount: rows.length,
          createdBy: profile?.displayName ?? user?.email ?? '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
        await Promise.all(
          rows.map((row) => {
            const qty = parseInt(row.quantity) || 1
            return addDoc(inventoryCol, {
              batchId: batchRef.id,
              brand: row.brand.trim() || null,
              modelName: row.modelName.trim(),
              sku: row.sku.trim() || null,
              serialNumber: row.serialNumber.trim() || null,
              condition: row.condition,
              quantityOnHand: qty,
              quantityReserved: 0,
              quantityAvailable: qty,
              msrp: row.msrp !== '' ? parseFloat(row.msrp) : null,
              costPrice: row.costPrice !== '' ? parseFloat(row.costPrice) : null,
              lowStockThreshold: row.lowStockThreshold !== '' ? parseInt(row.lowStockThreshold) : null,
              dealerId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          })
        )
      } else {
        await updateDoc(doc(db, 'inventoryBatches', batch.id), {
          supplierName: supplierName.trim(),
          poNumber: poNumber.trim() || null,
          dateReceived,
          notes: notes.trim() || null,
          dealerId,
          itemCount: rows.length,
          updatedAt: serverTimestamp(),
        })
        if (removedInventoryIds.length > 0) {
          await Promise.all(removedInventoryIds.map((id) => deleteDoc(doc(db, 'inventory', id))))
        }
        await Promise.all(
          rows.map((row) => {
            const qty = parseInt(row.quantity) || 1
            if (row.inventoryId) {
              return updateDoc(doc(db, 'inventory', row.inventoryId), {
                brand: row.brand.trim() || null,
                modelName: row.modelName.trim(),
                sku: row.sku.trim() || null,
                serialNumber: row.serialNumber.trim() || null,
                condition: row.condition,
                quantityOnHand: qty,
                quantityAvailable: Math.max(0, qty - (row.inventoryReserved ?? 0)),
                msrp: row.msrp !== '' ? parseFloat(row.msrp) : null,
                costPrice: row.costPrice !== '' ? parseFloat(row.costPrice) : null,
                lowStockThreshold: row.lowStockThreshold !== '' ? parseInt(row.lowStockThreshold) : null,
                updatedAt: serverTimestamp(),
              })
            } else {
              return addDoc(inventoryCol, {
                batchId: batch.id,
                brand: row.brand.trim() || null,
                modelName: row.modelName.trim(),
                sku: row.sku.trim() || null,
                serialNumber: row.serialNumber.trim() || null,
                condition: row.condition,
                quantityOnHand: qty,
                quantityReserved: 0,
                quantityAvailable: qty,
                msrp: row.msrp !== '' ? parseFloat(row.msrp) : null,
                costPrice: row.costPrice !== '' ? parseFloat(row.costPrice) : null,
                lowStockThreshold: row.lowStockThreshold !== '' ? parseInt(row.lowStockThreshold) : null,
                dealerId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            }
          })
        )
      }
      onClose()
    } catch (e) {
      console.error(e)
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mb-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">
              {batch ? 'Edit Batch Entry' : 'New Batch Entry'}
            </h2>
            {batch && (
              <p className="text-xs text-[#9A9A9A] mt-0.5">
                {batch.supplierName}{batch.poNumber ? ` · ${batch.poNumber}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Batch header fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className={lbl}>Supplier / Vendor <span className="text-[#D95F5F]">*</span></label>
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. DJI Enterprise"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]" />
            </div>
            <div>
              <label className={lbl}>PO Number</label>
              <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)}
                placeholder="e.g. PO-2024-001"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]" />
            </div>
            <div>
              <label className={lbl}>Date Received <span className="text-[#D95F5F]">*</span></label>
              <input type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]" />
            </div>
            <div>
              <label className={lbl}>Location <span className="text-[#D95F5F]">*</span></label>
              <select value={dealerId} onChange={(e) => setDealerId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]">
                <option value="">Select location…</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.location ? `${d.location} — ${d.displayName || d.email}` : (d.displayName || d.email)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this shipment"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]" />
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#1A1A1A]">
                Items <span className="text-[#9A9A9A] font-normal ml-1">({rows.length})</span>
              </p>
              <button onClick={addRow}
                className="text-sm font-semibold text-[#8B6914] hover:underline">
                + Add Row
              </button>
            </div>

            {loadingItems ? (
              <div className="py-8 text-center text-sm text-[#9A9A9A]">Loading items…</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="text-sm" style={{ minWidth: 960 }}>
                  <thead>
                    <tr className="bg-[#F4F4F5] border-b border-gray-200">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap w-8">#</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Brand</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Model Name *</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">SKU</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Serial #</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Condition</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Qty *</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Cost Price</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">MSRP</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Low Stock ≤</th>
                      <th className="px-3 py-2.5 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((row, idx) => (
                      <tr key={row._key} className="hover:bg-[#FAFAFA]">
                        <td className="px-3 py-1.5 text-xs text-[#9A9A9A] text-center">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <input value={row.brand} onChange={(e) => updateRow(row._key, 'brand', e.target.value)}
                            placeholder="DJI" className={iCls} style={{ minWidth: 80 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={row.modelName} onChange={(e) => updateRow(row._key, 'modelName', e.target.value)}
                            placeholder="Agras T50" className={iCls} style={{ minWidth: 140 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={row.sku} onChange={(e) => updateRow(row._key, 'sku', e.target.value)}
                            placeholder="SKU-001" className={iCls} style={{ minWidth: 90 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={row.serialNumber} onChange={(e) => updateRow(row._key, 'serialNumber', e.target.value)}
                            placeholder="SN-…" className={iCls} style={{ minWidth: 90 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={row.condition} onChange={(e) => updateRow(row._key, 'condition', e.target.value)}
                            className={iCls} style={{ minWidth: 110 }}>
                            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="1" value={row.quantity}
                            onChange={(e) => updateRow(row._key, 'quantity', e.target.value)}
                            className={iCls} style={{ minWidth: 60 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" step="0.01" value={row.costPrice}
                            onChange={(e) => updateRow(row._key, 'costPrice', e.target.value)}
                            placeholder="0.00" className={iCls} style={{ minWidth: 90 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" step="0.01" value={row.msrp}
                            onChange={(e) => updateRow(row._key, 'msrp', e.target.value)}
                            placeholder="0.00" className={iCls} style={{ minWidth: 90 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" value={row.lowStockThreshold}
                            onChange={(e) => updateRow(row._key, 'lowStockThreshold', e.target.value)}
                            placeholder="2" className={iCls} style={{ minWidth: 65 }} />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button onClick={() => removeRow(row._key)}
                            className="text-[#D95F5F] hover:text-[#c44f4f] font-bold text-lg leading-none">×</button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-sm text-[#9A9A9A]">
                          No items yet — click "+ Add Row" to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {rows.length > 0 && (
              <button onClick={addRow}
                className="mt-2 text-sm text-[#8B6914] hover:underline font-medium">
                + Add Row
              </button>
            )}
          </div>

          {error && <p className="text-sm text-[#D95F5F] font-medium">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-[#1A1A1A] text-sm font-medium py-2.5 rounded-lg hover:bg-[#F4F4F5]">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#7a5c11] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : batch ? `Save Changes (${rows.length} item${rows.length !== 1 ? 's' : ''})` : `Save Batch (${rows.length} item${rows.length !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  )
}
