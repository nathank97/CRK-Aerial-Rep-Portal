import { useState, useRef, useMemo } from 'react'
import { addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { purchaseOrdersCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

const CONDITIONS = ['New', 'Demo', 'Refurbished']
const CATEGORIES = ['Drone Kit', 'Parts', 'Accessory', 'Other']
const CATALOG_CATEGORY = { Drone: 'Drone Kit', Part: 'Parts', Accessory: 'Accessory', Service: 'Other', Other: 'Other' }

function blankRow(key) {
  return {
    _key: key, itemId: null, catalogId: null,
    brand: '', category: 'Drone Kit', modelName: '', sku: '',
    condition: 'New', orderedQty: 1, costPrice: '', msrp: '', lowStockThreshold: '',
    receivedQty: 0, inventoryIds: [],
  }
}

const iCls = 'border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#8B6914] bg-white w-full'
const lbl = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'
const hCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'

const STATUS_OPTS = ['Draft', 'Ordered']

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
  const [status, setStatus] = useState(
    (po && !['Draft', 'Ordered'].includes(po.status)) ? po.status : (po?.status ?? 'Draft')
  )

  const [rows, setRows] = useState(() => {
    if (!po?.items?.length) return [blankRow(1)]
    return po.items.map((item, i) => ({
      _key: i + 1,
      itemId: item.id,
      catalogId: item.catalogId ?? null,
      brand: item.brand ?? '',
      category: item.category ?? 'Drone Kit',
      modelName: item.modelName ?? '',
      sku: item.sku ?? '',
      condition: item.condition ?? 'New',
      orderedQty: item.orderedQty ?? 1,
      costPrice: item.costPrice ?? '',
      msrp: item.msrp ?? '',
      lowStockThreshold: item.lowStockThreshold ?? '',
      receivedQty: item.receivedQty ?? 0,
      inventoryIds: item.inventoryIds ?? [],
    }))
  })

  const [catalogSearches, setCatalogSearches] = useState(() => {
    if (!po?.items?.length) return {}
    const s = {}
    po.items.forEach((item, i) => {
      if (item.catalogId) s[i + 1] = item.modelName + (item.sku ? ` (${item.sku})` : '')
    })
    return s
  })
  const [openCatalogRow, setOpenCatalogRow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

  function updateRow(key, field, value) {
    setRows((p) => p.map((r) => (r._key === key ? { ...r, [field]: value } : r)))
  }

  function updateRowMulti(key, updates) {
    setRows((p) => p.map((r) => (r._key === key ? { ...r, ...updates } : r)))
  }

  function removeRow(key) {
    setRows((p) => p.filter((r) => r._key !== key))
  }

  function handleCatalogSearch(key, value) {
    setCatalogSearches((p) => ({ ...p, [key]: value }))
    setOpenCatalogRow(key)
    if (!value) updateRow(key, 'catalogId', null)
  }

  function handleCatalogSelect(key, item) {
    updateRowMulti(key, {
      catalogId: item.id,
      brand: item.manufacturer ?? '',
      category: CATALOG_CATEGORY[item.type] ?? 'Other',
      modelName: item.name,
      sku: item.sku ?? '',
      msrp: item.msrp ?? '',
      costPrice: item.cost ?? '',
    })
    setCatalogSearches((p) => ({ ...p, [key]: item.name + (item.sku ? ` (${item.sku})` : '') }))
    setOpenCatalogRow(null)
  }

  function clearCatalog(key) {
    setCatalogSearches((p) => ({ ...p, [key]: '' }))
    updateRow(key, 'catalogId', null)
  }

  function buildItems() {
    return rows.map((row, i) => ({
      id: row.itemId ?? String(row._key),
      catalogId: row.catalogId ?? null,
      brand: row.brand.trim() || null,
      category: row.category || null,
      modelName: row.modelName.trim(),
      sku: row.sku.trim() || null,
      condition: row.condition,
      orderedQty: parseInt(row.orderedQty) || 1,
      receivedQty: row.receivedQty ?? 0,
      costPrice: row.costPrice !== '' ? parseFloat(row.costPrice) : null,
      msrp: row.msrp !== '' ? parseFloat(row.msrp) : null,
      lowStockThreshold: row.lowStockThreshold !== '' ? parseInt(row.lowStockThreshold) : null,
      inventoryIds: row.inventoryIds ?? [],
    }))
  }

  async function handleSave() {
    setError('')
    if (!supplierName.trim()) { setError('Supplier / Vendor name is required.'); return }
    if (!orderDate) { setError('Order date is required.'); return }
    if (!dealerId) { setError('Location is required.'); return }
    if (rows.length === 0) { setError('Add at least one item.'); return }
    const badIdx = rows.findIndex((r) => !r.modelName.trim())
    if (badIdx !== -1) { setError(`Row ${badIdx + 1}: Model name is required.`); return }
    const overReceived = rows.find((r) => {
      const ordered = parseInt(r.orderedQty) || 1
      return r.receivedQty > ordered
    })
    if (overReceived) {
      setError(`"${overReceived.modelName}": Ordered qty cannot be less than already received qty (${overReceived.receivedQty}).`)
      return
    }

    setSaving(true)
    const items = buildItems()
    const finalStatus = (['Partially Received', 'Fully Received'].includes(status)) ? status : status

    try {
      if (!po) {
        await addDoc(purchaseOrdersCol, {
          supplierName: supplierName.trim(),
          poNumber: poNumber.trim() || null,
          orderDate,
          expectedDelivery: expectedDelivery || null,
          notes: notes.trim() || null,
          dealerId,
          status: finalStatus,
          items,
          createdBy: profile?.displayName ?? user?.email ?? '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else {
        await updateDoc(doc(db, 'purchaseOrders', po.id), {
          supplierName: supplierName.trim(),
          poNumber: poNumber.trim() || null,
          orderDate,
          expectedDelivery: expectedDelivery || null,
          notes: notes.trim() || null,
          dealerId,
          status: finalStatus,
          items,
          updatedAt: serverTimestamp(),
        })
      }
      onClose()
    } catch (e) {
      console.error(e)
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  const isSystemStatus = ['Partially Received', 'Fully Received'].includes(status)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">
              {po ? 'Edit Purchase Order' : 'New Purchase Order'}
            </h2>
            {po && <p className="text-xs text-[#9A9A9A] mt-0.5">{po.supplierName}{po.poNumber ? ` · PO ${po.poNumber}` : ''}</p>}
          </div>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              {isSystemStatus ? (
                <div className={`${hCls} bg-[#F4F4F5] text-[#9A9A9A]`}>{status}</div>
              ) : (
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={hCls}>
                  {STATUS_OPTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className={lbl}>Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" className={hCls} />
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#1A1A1A]">
                Items <span className="text-[#9A9A9A] font-normal">({rows.length})</span>
              </p>
              <button onClick={addRow} className="text-sm font-semibold text-[#8B6914] hover:underline">+ Add Row</button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="text-sm" style={{ minWidth: 1050 }}>
                <thead>
                  <tr className="bg-[#F4F4F5] border-b border-gray-200">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-8">#</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">From Catalog</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Brand</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Category</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Model Name *</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">SKU</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Condition</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Ordered *</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Cost</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">MSRP</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">Low Stock ≤</th>
                    <th className="px-3 py-2.5 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, idx) => {
                    const isReceived = (row.receivedQty ?? 0) > 0
                    return (
                      <tr key={row._key} className={isReceived ? 'bg-[#4CAF7D]/5' : 'hover:bg-[#FAFAFA]'}>
                        <td className="px-3 py-1.5 text-xs text-[#9A9A9A] text-center">
                          {isReceived
                            ? <span className="text-[9px] font-bold bg-[#4CAF7D]/20 text-[#4CAF7D] px-1 py-0.5 rounded">RCV</span>
                            : idx + 1}
                        </td>
                        {/* Catalog search */}
                        <td className="px-2 py-1.5 relative">
                          <div className="relative">
                            <input
                              value={catalogSearches[row._key] ?? ''}
                              onChange={(e) => handleCatalogSearch(row._key, e.target.value)}
                              onFocus={() => setOpenCatalogRow(row._key)}
                              onBlur={() => setTimeout(() => setOpenCatalogRow(null), 150)}
                              placeholder="Search…"
                              className={iCls}
                              style={{ minWidth: 130, paddingRight: row.catalogId ? 24 : undefined }}
                            />
                            {row.catalogId && (
                              <button type="button" onClick={() => clearCatalog(row._key)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-[#1A1A1A] text-sm leading-none">×</button>
                            )}
                          </div>
                          {openCatalogRow === row._key && catalogMatches.length > 0 && (
                            <ul className="absolute z-30 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto text-sm" style={{ minWidth: 220 }}>
                              {catalogMatches.map((c) => (
                                <li key={c.id} onMouseDown={() => handleCatalogSelect(row._key, c)}
                                  className="px-3 py-2 hover:bg-[#F4F4F5] cursor-pointer">
                                  <span className="font-medium text-[#1A1A1A]">{c.name}</span>
                                  {c.sku && <span className="ml-2 text-xs text-[#9A9A9A]">{c.sku}</span>}
                                  {c.manufacturer && <span className="ml-2 text-xs text-[#9A9A9A]">· {c.manufacturer}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={row.brand} onChange={(e) => updateRow(row._key, 'brand', e.target.value)}
                            placeholder="DJI" className={iCls} style={{ minWidth: 80 }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={row.category} onChange={(e) => updateRow(row._key, 'category', e.target.value)}
                            className={iCls} style={{ minWidth: 110 }}>
                            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                          </select>
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
                          <select value={row.condition} onChange={(e) => updateRow(row._key, 'condition', e.target.value)}
                            className={iCls} style={{ minWidth: 110 }}>
                            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min={row.receivedQty > 0 ? row.receivedQty : 1} value={row.orderedQty}
                            onChange={(e) => updateRow(row._key, 'orderedQty', e.target.value)}
                            className={iCls} style={{ minWidth: 65 }} />
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
                          {isReceived
                            ? <span className="text-xs text-[#9A9A9A]">{row.receivedQty}/{row.orderedQty}</span>
                            : <button onClick={() => removeRow(row._key)}
                                className="text-[#D95F5F] hover:text-[#c44f4f] font-bold text-lg leading-none">×</button>
                          }
                        </td>
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={12} className="py-8 text-center text-sm text-[#9A9A9A]">No items — click "+ Add Row"</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {rows.length > 0 && (
              <button onClick={addRow} className="mt-2 text-sm text-[#8B6914] hover:underline font-medium">+ Add Row</button>
            )}
          </div>

          {error && <p className="text-sm text-[#D95F5F] font-medium">{error}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] text-sm font-medium py-2.5 rounded-lg hover:bg-[#F4F4F5]">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-[#7a5c11] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : po ? 'Save Changes' : `Save PO — ${rows.length} item${rows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
