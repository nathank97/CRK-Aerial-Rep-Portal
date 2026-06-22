import { useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { purchaseOrdersCol, inventoryCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { writeTx } from '../../utils/inventoryTransactions'

const CONDITIONS = ['New', 'Demo', 'Refurbished']
const CATEGORIES = ['Drone Kit', 'Parts', 'Accessory', 'Other']
const CATALOG_CATEGORY = { Drone: 'Drone Kit', Part: 'Parts', Accessory: 'Accessory', Service: 'Other', Other: 'Other' }

function safeStr(v) { if (v == null) return ''; return typeof v === 'string' ? v : String(v) }
function safeNum(v) { if (v === '' || v == null) return null; const n = parseFloat(v); return isNaN(n) ? null : n }
function safeInt(v) { if (v === '' || v == null) return null; const n = parseInt(v); return isNaN(n) ? null : n }
function fmt(n) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function blankRow(key) {
  return {
    _key: key, itemId: null, catalogId: null,
    brand: '', category: 'Drone Kit', modelName: '', sku: '',
    condition: 'New', orderedQty: 1, costPrice: '', msrp: '', lowStockThreshold: '',
    receivedQty: 0, inventoryIds: [], cancelled: false,
  }
}

const iCls = 'border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#8B6914] bg-white w-full'
const lbl = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'
const hCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'

export default function PurchaseOrderModal({ po, dealers, catalog, onClose }) {
  const { profile, user } = useAuth()
  const keyRef = useRef(po ? (po.items?.length ?? 0) + 1 : 1)
  const nextKey = () => { keyRef.current += 1; return keyRef.current }

  const [supplierName, setSupplierName] = useState(po?.supplierName ?? '')
  const [poNumber, setPoNumber] = useState(po?.poNumber ?? '')
  const [orderDate, setOrderDate] = useState(po?.orderDate ?? new Date().toISOString().slice(0, 10))
  const [expectedDelivery, setExpectedDelivery] = useState(po?.expectedDelivery ?? '')
  const [dealerId, setDealerId] = useState(po?.dealerId ?? '')
  const [notes, setNotes] = useState(po?.notes ?? '')
  const [freightCost, setFreightCost] = useState(po?.freightCost != null ? String(po.freightCost) : '')

  const [rows, setRows] = useState(() => {
    if (!po?.items?.length) return [blankRow(1)]
    return po.items.map((item, i) => ({
      _key: i + 1,
      itemId: item.id,
      catalogId: item.catalogId ?? null,
      brand: safeStr(item.brand),
      category: item.category ?? 'Drone Kit',
      modelName: safeStr(item.modelName),
      sku: safeStr(item.sku),
      condition: item.condition ?? 'New',
      orderedQty: item.orderedQty ?? 1,
      costPrice: item.costPrice != null ? String(item.costPrice) : '',
      msrp: item.msrp != null ? String(item.msrp) : '',
      lowStockThreshold: item.lowStockThreshold != null ? String(item.lowStockThreshold) : '',
      receivedQty: item.receivedQty ?? 0,
      inventoryIds: item.inventoryIds ?? [],
      cancelled: item.cancelled ?? false,
    }))
  })

  const [catalogSearches, setCatalogSearches] = useState(() => {
    if (!po?.items?.length) return {}
    const s = {}
    po.items.forEach((item, i) => {
      if (item.catalogId) s[i + 1] = safeStr(item.modelName) + (item.sku ? ` (${item.sku})` : '')
    })
    return s
  })
  const [openCatalogRow, setOpenCatalogRow] = useState(null)
  const [catalogAnchor, setCatalogAnchor] = useState(null)
  const catalogInputRefs = useRef({})
  const [saving, setSaving] = useState(false)

  function positionCatalogDropdown(key) {
    const el = catalogInputRefs.current[key]
    if (el) {
      const rect = el.getBoundingClientRect()
      setCatalogAnchor({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 240) })
    }
  }
  const [error, setError] = useState('')

  const isDraft = !po || po.status === 'Draft'
  const currentStatus = po?.status ?? 'Draft'

  const dealerName = useMemo(() => {
    const d = dealers.find((d) => d.id === dealerId)
    return d ? (d.location || d.displayName || d.email || '') : ''
  }, [dealers, dealerId])

  const catalogMatches = useMemo(() => {
    if (openCatalogRow === null) return []
    const q = (catalogSearches[openCatalogRow] ?? '').toLowerCase().trim()
    if (!q) return catalog.slice(0, 50)
    return catalog.filter((c) =>
      c.name?.toLowerCase().includes(q) || c.sku?.toLowerCase().includes(q) ||
      c.manufacturer?.toLowerCase().includes(q)
    )
  }, [openCatalogRow, catalogSearches, catalog])

  function addRow() { setRows((p) => [...p, blankRow(nextKey())]) }
  function updateRow(key, field, value) { setRows((p) => p.map((r) => r._key === key ? { ...r, [field]: value } : r)) }
  function updateRowMulti(key, updates) { setRows((p) => p.map((r) => r._key === key ? { ...r, ...updates } : r)) }
  function removeRow(key) { setRows((p) => p.filter((r) => r._key !== key)) }

  function handleCatalogSearch(key, value) {
    setCatalogSearches((p) => ({ ...p, [key]: value }))
    setOpenCatalogRow(key)
    if (!value) updateRow(key, 'catalogId', null)
  }

  function handleCatalogSelect(key, item) {
    updateRowMulti(key, {
      catalogId: item.id,
      brand: safeStr(item.manufacturer),
      category: CATALOG_CATEGORY[item.type] ?? 'Other',
      modelName: safeStr(item.name),
      sku: safeStr(item.sku),
      msrp: item.msrp != null ? String(item.msrp) : '',
      costPrice: item.cost != null ? String(item.cost) : '',
    })
    setCatalogSearches((p) => ({ ...p, [key]: safeStr(item.name) + (item.sku ? ` (${item.sku})` : '') }))
    setOpenCatalogRow(null)
  }

  function clearCatalog(key) {
    setCatalogSearches((p) => ({ ...p, [key]: '' }))
    updateRow(key, 'catalogId', null)
  }

  function buildItems() {
    return rows.map((row) => ({
      id: row.itemId ?? String(row._key),
      catalogId: row.catalogId ?? null,
      brand: safeStr(row.brand).trim() || null,
      category: row.category || null,
      modelName: safeStr(row.modelName).trim(),
      sku: safeStr(row.sku).trim() || null,
      condition: row.condition,
      orderedQty: parseInt(row.orderedQty) || 1,
      receivedQty: row.receivedQty ?? 0,
      costPrice: safeNum(row.costPrice),
      msrp: safeNum(row.msrp),
      lowStockThreshold: safeInt(row.lowStockThreshold),
      inventoryIds: row.inventoryIds ?? [],
      cancelled: row.cancelled ?? false,
    }))
  }

  function validate() {
    if (!supplierName.trim()) { setError('Supplier / Vendor name is required.'); return false }
    if (!orderDate) { setError('Order date is required.'); return false }
    if (!dealerId) { setError('Location is required.'); return false }
    if (rows.length === 0) { setError('Add at least one item.'); return false }
    const badIdx = rows.findIndex((r) => !safeStr(r.modelName).trim())
    if (badIdx !== -1) { setError(`Row ${badIdx + 1}: Model name is required.`); return false }
    const overReceived = rows.find((r) => (r.receivedQty ?? 0) > (parseInt(r.orderedQty) || 1))
    if (overReceived) {
      setError(`"${overReceived.modelName}": Ordered qty cannot be less than received qty (${overReceived.receivedQty}).`)
      return false
    }
    return true
  }

  async function handleSaveDraft() {
    setError('')
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        supplierName: supplierName.trim(),
        poNumber: poNumber.trim() || null,
        orderDate,
        expectedDelivery: expectedDelivery || null,
        notes: notes.trim() || null,
        dealerId,
        status: 'Draft',
        freightCost: safeNum(freightCost),
        items: buildItems(),
        updatedAt: serverTimestamp(),
      }
      if (!po) {
        await addDoc(purchaseOrdersCol, { ...payload, createdBy: profile?.displayName ?? user?.email ?? '', createdAt: serverTimestamp() })
      } else {
        await updateDoc(doc(db, 'purchaseOrders', po.id), payload)
      }
      onClose()
    } catch (e) {
      setError(`Failed to save: ${e?.message ?? 'Unknown error'}`)
      setSaving(false)
    }
  }

  async function handleMarkOrdered() {
    setError('')
    if (!validate()) return
    setSaving(true)
    try {
      const createdBy = profile?.displayName ?? user?.email ?? ''
      const baseItems = buildItems()
      const basePayload = {
        supplierName: supplierName.trim(),
        poNumber: poNumber.trim() || null,
        orderDate,
        expectedDelivery: expectedDelivery || null,
        notes: notes.trim() || null,
        dealerId,
        status: 'Ordered',
        freightCost: safeNum(freightCost),
        updatedAt: serverTimestamp(),
      }

      // Create PO first if new (need the ID for inventory records)
      let poId = po?.id
      if (!poId) {
        const poRef = await addDoc(purchaseOrdersCol, {
          ...basePayload,
          items: baseItems,
          createdBy,
          createdAt: serverTimestamp(),
        })
        poId = poRef.id
      }

      // Create on_order inventory records for items that don't have one yet
      const updatedItems = await Promise.all(baseItems.map(async (item) => {
        if (item.inventoryIds?.length > 0) {
          // Already has inventory — sync fields only
          await Promise.all(item.inventoryIds.map((invId) =>
            updateDoc(doc(db, 'inventory', invId), {
              catalogId: item.catalogId ?? null,
              brand: item.brand ?? null,
              modelName: item.modelName,
              sku: item.sku ?? null,
              category: item.category ?? null,
              condition: item.condition,
              msrp: item.msrp ?? null,
              costPrice: item.costPrice ?? null,
              lowStockThreshold: item.lowStockThreshold ?? null,
              updatedAt: serverTimestamp(),
            })
          ))
          return item
        }

        const invRef = await addDoc(inventoryCol, {
          poId,
          poItemId: item.id,
          catalogId: item.catalogId ?? null,
          inventoryStatus: 'on_order',
          dealerId,
          brand: item.brand ?? null,
          category: item.category ?? null,
          modelName: item.modelName,
          sku: item.sku ?? null,
          condition: item.condition ?? 'New',
          quantityOnHand: 0,
          quantityOnOrder: item.orderedQty,
          quantityReserved: 0,
          quantityAvailable: 0,
          msrp: item.msrp ?? null,
          costPrice: item.costPrice ?? null,
          lowStockThreshold: item.lowStockThreshold ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        await writeTx([{
          type: 'po_ordered',
          qty: item.orderedQty,
          modelName: item.modelName,
          brand: item.brand ?? null,
          sku: item.sku ?? null,
          category: item.category ?? null,
          dealerId,
          inventoryId: invRef.id,
          sourceType: 'purchase_order',
          sourceId: poId,
          sourceNumber: poNumber.trim() || supplierName.trim(),
          fromLocation: supplierName.trim() || 'Supplier',
          toLocation: dealerName || dealerId,
          createdBy,
        }])

        return { ...item, inventoryIds: [invRef.id] }
      }))

      await updateDoc(doc(db, 'purchaseOrders', poId), { ...basePayload, items: updatedItems })
      onClose()
    } catch (e) {
      console.error('PO save error:', e)
      setError(`Failed to save: ${e?.message ?? 'Unknown error'}`)
      setSaving(false)
    }
  }

  async function handleSaveChanges() {
    setError('')
    if (!validate()) return
    setSaving(true)
    try {
      const items = buildItems()
      const payload = {
        supplierName: supplierName.trim(),
        poNumber: poNumber.trim() || null,
        orderDate,
        expectedDelivery: expectedDelivery || null,
        notes: notes.trim() || null,
        dealerId,
        status: currentStatus,
        freightCost: safeNum(freightCost),
        items,
        updatedAt: serverTimestamp(),
      }
      await updateDoc(doc(db, 'purchaseOrders', po.id), payload)

      // Sync field corrections to existing inventory records
      const invUpdates = []
      for (const item of items) {
        if (!item.inventoryIds?.length) continue
        const patch = {
          catalogId: item.catalogId ?? null,
          brand: item.brand ?? null,
          modelName: item.modelName,
          sku: item.sku ?? null,
          category: item.category ?? null,
          condition: item.condition,
          msrp: item.msrp ?? null,
          costPrice: item.costPrice ?? null,
          lowStockThreshold: item.lowStockThreshold ?? null,
          updatedAt: serverTimestamp(),
        }
        for (const invId of item.inventoryIds) {
          invUpdates.push(updateDoc(doc(db, 'inventory', invId), patch))
        }
      }
      if (invUpdates.length > 0) await Promise.all(invUpdates)
      onClose()
    } catch (e) {
      setError(`Failed to save: ${e?.message ?? 'Unknown error'}`)
      setSaving(false)
    }
  }

  const lineTotal = (row) => {
    const qty = parseInt(row.orderedQty) || 0
    const cost = safeNum(row.costPrice)
    return cost != null ? qty * cost : null
  }
  const subtotal = rows.reduce((s, r) => { const t = lineTotal(r); return t != null ? s + t : s }, 0)
  const freight = safeNum(freightCost) ?? 0
  const grandTotal = subtotal + freight

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">
              {po ? 'Edit Purchase Order' : 'New Purchase Order'}
            </h2>
            {po && (
              <p className="text-xs text-[#9A9A9A] mt-0.5">
                {po.supplierName}{po.poNumber ? ` · PO ${po.poNumber}` : ''} · <span className="font-medium">{po.status}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className={lbl}>Supplier / Vendor <span className="text-[#D95F5F]">*</span></label>
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="e.g. DJI Enterprise" className={hCls} />
            </div>
            <div>
              <label className={lbl}>PO Number</label>
              <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-2024-001" className={hCls} />
            </div>
            <div>
              <label className={lbl}>Order Date <span className="text-[#D95F5F]">*</span></label>
              <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={hCls} />
            </div>
            <div>
              <label className={lbl}>Expected Delivery</label>
              <input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} className={hCls} />
            </div>
            <div>
              <label className={lbl}>Freight Cost</label>
              <input type="number" min="0" step="0.01" value={freightCost} onChange={(e) => setFreightCost(e.target.value)} placeholder="0.00" className={hCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Location <span className="text-[#D95F5F]">*</span></label>
              <select value={dealerId} onChange={(e) => setDealerId(e.target.value)} className={hCls}>
                <option value="">Select location…</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.location ? `${d.location} — ${d.displayName || d.email}` : (d.displayName || d.email)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <div className={`${hCls} bg-[#F4F4F5] text-[#9A9A9A]`}>{currentStatus}</div>
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" className={hCls} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#1A1A1A]">
                Items <span className="text-[#9A9A9A] font-normal">({rows.length})</span>
              </p>
              <button onClick={addRow} className="text-sm font-semibold text-[#8B6914] hover:underline">+ Add Row</button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="text-sm" style={{ minWidth: 1150 }}>
                <thead>
                  <tr className="bg-[#F4F4F5] border-b border-gray-200">
                    {[['#','w-8'],['From Catalog',''],['Brand',''],['Category',''],['Model Name *',''],['SKU',''],['Condition',''],['Ordered *',''],['Cost / Unit',''],['MSRP / Unit',''],['Total Cost',''],['Low Stock ≤',''],['','w-8']].map(([h, w]) => (
                      <th key={h} className={`text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap ${w}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, idx) => {
                    const isReceived = (row.receivedQty ?? 0) > 0
                    const isCancelled = row.cancelled
                    const total = lineTotal(row)
                    return (
                      <tr key={row._key} className={isCancelled ? 'bg-gray-50 opacity-60' : isReceived ? 'bg-[#4CAF7D]/5' : 'hover:bg-[#FAFAFA]'}>
                        <td className="px-3 py-1.5 text-xs text-[#9A9A9A] text-center">
                          {isCancelled
                            ? <span className="text-[9px] font-bold bg-gray-200 text-gray-500 px-1 py-0.5 rounded">CXL</span>
                            : isReceived
                            ? <span className="text-[9px] font-bold bg-[#4CAF7D]/20 text-[#4CAF7D] px-1 py-0.5 rounded">RCV</span>
                            : idx + 1}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <input
                              ref={el => { catalogInputRefs.current[row._key] = el }}
                              value={catalogSearches[row._key] ?? ''}
                              onChange={(e) => {
                                handleCatalogSearch(row._key, e.target.value)
                                positionCatalogDropdown(row._key)
                              }}
                              onFocus={() => {
                                setOpenCatalogRow(row._key)
                                positionCatalogDropdown(row._key)
                              }}
                              onBlur={() => setTimeout(() => setOpenCatalogRow(null), 150)}
                              placeholder="Search…"
                              disabled={isCancelled}
                              className={iCls}
                              style={{ minWidth: 130, paddingRight: row.catalogId ? 24 : undefined }}
                            />
                            {row.catalogId && !isCancelled && (
                              <button type="button" onClick={() => clearCatalog(row._key)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-[#1A1A1A] text-sm leading-none">×</button>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={row.brand} onChange={(e) => updateRow(row._key, 'brand', e.target.value)} disabled={isCancelled} placeholder="DJI" className={iCls} style={{ minWidth: 80 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={row.category} onChange={(e) => updateRow(row._key, 'category', e.target.value)} disabled={isCancelled} className={iCls} style={{ minWidth: 110 }}>
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={row.modelName} onChange={(e) => updateRow(row._key, 'modelName', e.target.value)} disabled={isCancelled} placeholder="Agras T50" className={iCls} style={{ minWidth: 140 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={row.sku} onChange={(e) => updateRow(row._key, 'sku', e.target.value)} disabled={isCancelled} placeholder="SKU-001" className={iCls} style={{ minWidth: 90 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={row.condition} onChange={(e) => updateRow(row._key, 'condition', e.target.value)} disabled={isCancelled} className={iCls} style={{ minWidth: 110 }}>
                            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min={row.receivedQty > 0 ? row.receivedQty : 1}
                            value={row.orderedQty} disabled={isCancelled}
                            onChange={(e) => updateRow(row._key, 'orderedQty', e.target.value)}
                            className={iCls} style={{ minWidth: 65 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" step="0.01" value={row.costPrice} disabled={isCancelled}
                            onChange={(e) => updateRow(row._key, 'costPrice', e.target.value)}
                            placeholder="0.00" className={iCls} style={{ minWidth: 90 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" step="0.01" value={row.msrp} disabled={isCancelled}
                            onChange={(e) => updateRow(row._key, 'msrp', e.target.value)}
                            placeholder="0.00" className={iCls} style={{ minWidth: 90 }} />
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium text-[#1A1A1A] whitespace-nowrap pr-4">
                          {total != null ? fmt(total) : <span className="text-[#9A9A9A]">—</span>}
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" value={row.lowStockThreshold} disabled={isCancelled}
                            onChange={(e) => updateRow(row._key, 'lowStockThreshold', e.target.value)}
                            placeholder="2" className={iCls} style={{ minWidth: 65 }} />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {isCancelled
                            ? <span className="text-xs text-[#9A9A9A]">—</span>
                            : isReceived
                            ? <span className="text-xs text-[#9A9A9A]">{row.receivedQty}/{row.orderedQty}</span>
                            : <button onClick={() => removeRow(row._key)} className="text-[#D95F5F] hover:text-[#c44f4f] font-bold text-lg leading-none">×</button>
                          }
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={13} className="py-8 text-center text-sm text-[#9A9A9A]">No items — click "+ Add Row"</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-end">
              <div className="bg-[#F4F4F5] rounded-lg px-5 py-3 space-y-1 text-sm min-w-[260px]">
                <div className="flex justify-between gap-8"><span className="text-[#9A9A9A]">Subtotal</span><span className="font-medium text-[#1A1A1A]">{fmt(subtotal)}</span></div>
                <div className="flex justify-between gap-8"><span className="text-[#9A9A9A]">Freight</span><span className="font-medium text-[#1A1A1A]">{freight > 0 ? fmt(freight) : '—'}</span></div>
                <div className="flex justify-between gap-8 border-t border-gray-300 pt-1 mt-1">
                  <span className="font-semibold text-[#1A1A1A]">Grand Total</span>
                  <span className="font-bold text-[#8B6914]">{fmt(grandTotal)}</span>
                </div>
              </div>
            </div>
            {rows.length > 0 && <button onClick={addRow} className="mt-2 text-sm text-[#8B6914] hover:underline font-medium">+ Add Row</button>}
          </div>

          {error && <p className="text-sm text-[#D95F5F] font-medium">{error}</p>}
        </div>

        {openCatalogRow !== null && catalogMatches.length > 0 && catalogAnchor && createPortal(
          <ul
            style={{ position: 'fixed', top: catalogAnchor.top, left: catalogAnchor.left, width: catalogAnchor.width, zIndex: 9999 }}
            className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-44 overflow-y-auto text-sm">
            {catalogMatches.map((c) => (
              <li key={c.id} onMouseDown={() => handleCatalogSelect(openCatalogRow, c)}
                className="px-3 py-2 hover:bg-[#F4F4F5] cursor-pointer">
                <span className="font-medium text-[#1A1A1A]">{c.name}</span>
                {c.sku && <span className="ml-2 text-xs text-[#9A9A9A]">{c.sku}</span>}
                {c.manufacturer && <span className="ml-2 text-xs text-[#9A9A9A]">· {c.manufacturer}</span>}
              </li>
            ))}
          </ul>,
          document.body
        )}

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="border border-gray-200 text-[#1A1A1A] text-sm font-medium py-2.5 px-5 rounded-lg hover:bg-[#F4F4F5]">
            Cancel
          </button>
          {isDraft ? (
            <>
              <button onClick={handleSaveDraft} disabled={saving}
                className="flex-1 border border-[#8B6914] text-[#8B6914] text-sm font-semibold py-2.5 rounded-lg hover:bg-[#8B6914]/5 disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save as Draft'}
              </button>
              <button onClick={handleMarkOrdered} disabled={saving}
                className="flex-1 bg-[#8B6914] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#7a5c11] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : `Mark as Ordered (${rows.filter(r => !r.cancelled).length} item${rows.filter(r => !r.cancelled).length !== 1 ? 's' : ''})`}
              </button>
            </>
          ) : (
            <button onClick={handleSaveChanges} disabled={saving}
              className="flex-1 bg-[#8B6914] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#7a5c11] disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
