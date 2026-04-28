import { useState, useMemo } from 'react'
import { addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { useInventory } from '../../hooks/useInventory'
import { useCatalog } from '../../hooks/useCatalog'
import { useAuth } from '../../context/AuthContext'
import { getDealerPrice } from '../../utils/pricing'
import { inventoryCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { SkeletonRow } from '../../components/common/SkeletonCard'

const CONDITIONS = ['New', 'Demo', 'Refurbished']

const conditionColor = {
  New: 'bg-[#4CAF7D]/15 text-[#4CAF7D]',
  Demo: 'bg-[#E6A817]/15 text-[#E6A817]',
  Refurbished: 'bg-[#4A90B8]/15 text-[#4A90B8]',
}

function AvailBadge({ available, threshold }) {
  const low = threshold != null && available <= threshold
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
      available === 0 ? 'bg-[#D95F5F]/15 text-[#D95F5F]'
      : low ? 'bg-[#E6A817]/15 text-[#E6A817]'
      : 'bg-[#4CAF7D]/15 text-[#4CAF7D]'
    }`}>
      {available === 0 ? '✕ Out' : low ? `⚠ ${available}` : available}
    </span>
  )
}

function AddStockModal({ onClose, onSave, catalog }) {
  const [form, setForm] = useState({
    modelName: '', catalogId: '', sku: '', serialNumber: '',
    condition: 'New', quantityOnHand: 1, costPrice: '', lowStockThreshold: 2, notes: '',
  })
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  const handleCatalogSelect = (e) => {
    const item = catalog.find((c) => c.id === e.target.value)
    setForm((p) => ({ ...p, catalogId: e.target.value, modelName: item?.name ?? p.modelName }))
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Add Stock</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl">×</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">From Catalog</label>
            <select value={form.catalogId} onChange={handleCatalogSelect} className={inputCls}>
              <option value="">Select catalog item…</option>
              {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Model Name <span className="text-[#D95F5F]">*</span></label>
            <input value={form.modelName} onChange={set('modelName')} placeholder="e.g. DJI Agras T40" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">SKU</label>
              <input value={form.sku} onChange={set('sku')} placeholder="SKU-001" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Serial #</label>
              <input value={form.serialNumber} onChange={set('serialNumber')} placeholder="SN-12345" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Condition</label>
              <select value={form.condition} onChange={set('condition')} className={inputCls}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Qty On Hand <span className="text-[#D95F5F]">*</span></label>
              <input type="number" min="1" value={form.quantityOnHand} onChange={set('quantityOnHand')} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Cost Price</label>
              <input type="number" min="0" step="0.01" value={form.costPrice} onChange={set('costPrice')} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Low Stock Alert ≤</label>
              <input type="number" min="0" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${inputCls} resize-none`} />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-sm font-medium py-2 rounded-lg hover:bg-[#F4F4F5]">Cancel</button>
          <button onClick={() => onSave(form)}
            disabled={!form.modelName || !form.quantityOnHand}
            className="flex-1 bg-[#8B6914] hover:bg-[#7a5c11] disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
            Add Stock
          </button>
        </div>
      </div>
    </div>
  )
}

function AdjustModal({ item, onClose, onSave }) {
  const [qty, setQty] = useState(item.quantityOnHand)
  const [notes, setNotes] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Adjust Stock — {item.modelName}</h2>
        <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">New Qty On Hand</label>
        <input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] mb-3" />
        <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Reason / Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] resize-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-sm font-medium py-2 rounded-lg hover:bg-[#F4F4F5]">Cancel</button>
          <button onClick={() => onSave(parseInt(qty), notes)}
            className="flex-1 bg-[#8B6914] hover:bg-[#7a5c11] text-white text-sm font-semibold py-2 rounded-lg">Save</button>
        </div>
      </div>
    </div>
  )
}

export default function InventoryDealer() {
  const { items, loading } = useInventory()
  const { catalog } = useCatalog()
  const { user, profile } = useAuth()

  const [search, setSearch] = useState('')
  const [filterCondition, setFilterCondition] = useState('')
  const [filterAvail, setFilterAvail] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [adjustItem, setAdjustItem] = useState(null)

  const filtered = useMemo(() => {
    let r = items
    if (search) r = r.filter((i) => i.modelName?.toLowerCase().includes(search.toLowerCase()) || i.sku?.toLowerCase().includes(search.toLowerCase()))
    if (filterCondition) r = r.filter((i) => i.condition === filterCondition)
    if (filterAvail === 'available') r = r.filter((i) => (i.quantityAvailable ?? i.quantityOnHand - (i.quantityReserved ?? 0)) > 0)
    if (filterAvail === 'low') r = r.filter((i) => {
      const avail = i.quantityAvailable ?? i.quantityOnHand - (i.quantityReserved ?? 0)
      return i.lowStockThreshold != null && avail <= i.lowStockThreshold
    })
    if (filterAvail === 'out') r = r.filter((i) => (i.quantityAvailable ?? i.quantityOnHand - (i.quantityReserved ?? 0)) === 0)
    return r
  }, [items, search, filterCondition, filterAvail])

  const handleAddStock = async (form) => {
    const qty = parseInt(form.quantityOnHand) || 0
    await addDoc(inventoryCol, {
      modelName: form.modelName,
      catalogId: form.catalogId || null,
      sku: form.sku || null,
      serialNumber: form.serialNumber || null,
      condition: form.condition,
      quantityOnHand: qty,
      quantityReserved: 0,
      quantityAvailable: qty,
      dealerId: user.uid,
      dealerName: profile?.displayName ?? '',
      costPrice: form.costPrice ? parseFloat(form.costPrice) : null,
      lowStockThreshold: parseInt(form.lowStockThreshold) ?? 2,
      notes: form.notes || null,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
    })
    setShowAdd(false)
  }

  const handleAdjust = async (itemId, newQty, notes) => {
    const reserved = adjustItem.quantityReserved ?? 0
    await updateDoc(doc(db, 'inventory', itemId), {
      quantityOnHand: newQty,
      quantityAvailable: Math.max(0, newQty - reserved),
      notes: notes || adjustItem.notes || null,
      lastUpdated: serverTimestamp(),
    })
    setAdjustItem(null)
  }

  const totalUnits = items.reduce((s, i) => s + (i.quantityOnHand ?? 0), 0)
  const lowStockCount = items.filter((i) => {
    const avail = i.quantityAvailable ?? i.quantityOnHand - (i.quantityReserved ?? 0)
    return i.lowStockThreshold != null && avail <= i.lowStockThreshold && avail > 0
  }).length
  const outCount = items.filter((i) => (i.quantityAvailable ?? i.quantityOnHand - (i.quantityReserved ?? 0)) === 0).length

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto">
      {showAdd && <AddStockModal catalog={catalog} onClose={() => setShowAdd(false)} onSave={handleAddStock} />}
      {adjustItem && <AdjustModal item={adjustItem} onClose={() => setAdjustItem(null)} onSave={(qty, notes) => handleAdjust(adjustItem.id, qty, notes)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">My Inventory</h1>
          <p className="text-[#9A9A9A] text-sm mt-0.5">{loading ? 'Loading…' : `${items.length} item${items.length !== 1 ? 's' : ''}`}</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="bg-[#8B6914] hover:bg-[#7a5c11] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + Add Stock
        </button>
      </div>

      {/* KPI strip */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-[#1A1A1A]">{totalUnits}</p>
            <p className="text-xs text-[#9A9A9A] mt-1">Total Units</p>
          </div>
          <div className={`bg-white rounded-xl border p-4 text-center ${lowStockCount > 0 ? 'border-[#E6A817]' : 'border-gray-200'}`}>
            <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-[#E6A817]' : 'text-[#1A1A1A]'}`}>{lowStockCount}</p>
            <p className="text-xs text-[#9A9A9A] mt-1">Low Stock</p>
          </div>
          <div className={`bg-white rounded-xl border p-4 text-center ${outCount > 0 ? 'border-[#D95F5F]' : 'border-gray-200'}`}>
            <p className={`text-2xl font-bold ${outCount > 0 ? 'text-[#D95F5F]' : 'text-[#1A1A1A]'}`}>{outCount}</p>
            <p className="text-xs text-[#9A9A9A] mt-1">Out of Stock</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap mb-4 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9A9A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search model or SKU…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#8B6914] bg-white" />
        </div>
        <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B6914]">
          <option value="">All Conditions</option>
          {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#8B6914]">
          <option value="">All Availability</option>
          <option value="available">Available</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        {(search || filterCondition || filterAvail) && (
          <button onClick={() => { setSearch(''); setFilterCondition(''); setFilterAvail('') }}
            className="text-sm text-[#D95F5F] hover:underline">Clear</button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-[#F4F4F5]">
            <tr>
              {['Model', 'SKU / Serial', 'Condition', 'On Hand', 'Reserved', 'Available', 'MSRP / Unit', 'Rep Price / Unit', 'Last Updated', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={10}><SkeletonRow /></td></tr>)
              : filtered.length === 0
                ? <tr><td colSpan={10} className="text-center py-12 text-[#9A9A9A] text-sm">
                    No inventory yet. Click "Add Stock" to get started.
                  </td></tr>
                : filtered.map((item) => {
                    const avail = item.quantityAvailable ?? Math.max(0, (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0))
                    return (
                      <tr key={item.id} className="border-b border-gray-50 hover:bg-[#F4F4F5] transition-colors">
                        <td className="px-4 py-3 font-medium text-[#1A1A1A]">{item.modelName}</td>
                        <td className="px-4 py-3 text-[#9A9A9A] text-xs">
                          {item.sku && <div>SKU: {item.sku}</div>}
                          {item.serialNumber && <div>SN: {item.serialNumber}</div>}
                          {!item.sku && !item.serialNumber && '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${conditionColor[item.condition] ?? 'bg-gray-100 text-gray-600'}`}>
                            {item.condition}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{item.quantityOnHand ?? 0}</td>
                        <td className="px-4 py-3 text-[#9A9A9A]">{item.quantityReserved ?? 0}</td>
                        <td className="px-4 py-3"><AvailBadge available={avail} threshold={item.lowStockThreshold} /></td>
                        <td className="px-4 py-3 text-[#9A9A9A]">{item.msrp != null ? formatCurrency(item.msrp) : '—'}</td>
                        <td className="px-4 py-3 text-[#4CAF7D] font-medium">{item.msrp != null ? formatCurrency(getDealerPrice(item, profile)) : '—'}</td>
                        <td className="px-4 py-3 text-[#9A9A9A] whitespace-nowrap">{formatDate(item.lastUpdated)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setAdjustItem(item)}
                            className="text-xs text-[#8B6914] hover:underline font-medium">Adjust</button>
                        </td>
                      </tr>
                    )
                  })
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
          : filtered.length === 0
            ? <div className="text-center py-12 text-[#9A9A9A] text-sm">No inventory found.</div>
            : filtered.map((item) => {
                const avail = item.quantityAvailable ?? Math.max(0, (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0))
                return (
                  <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-[#1A1A1A]">{item.modelName}</p>
                        {item.sku && <p className="text-xs text-[#9A9A9A]">SKU: {item.sku}</p>}
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${conditionColor[item.condition] ?? 'bg-gray-100 text-gray-600'}`}>
                        {item.condition}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#9A9A9A] flex-wrap">
                      <span>On Hand: <b className="text-[#1A1A1A]">{item.quantityOnHand ?? 0}</b></span>
                      <span>Reserved: <b className="text-[#1A1A1A]">{item.quantityReserved ?? 0}</b></span>
                      <span>Available: <b><AvailBadge available={avail} threshold={item.lowStockThreshold} /></b></span>
                      {item.msrp != null && <span>MSRP/unit: {formatCurrency(item.msrp)}</span>}
                      {item.msrp != null && <span className="text-[#4CAF7D] font-medium">Rep Price/unit: {formatCurrency(getDealerPrice(item, profile))}</span>}
                    </div>
                    <button onClick={() => setAdjustItem(item)}
                      className="mt-3 text-xs text-[#8B6914] hover:underline font-medium">Adjust Stock</button>
                  </div>
                )
              })
        }
      </div>

      {/* Mobile FAB */}
      <button onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 md:hidden bg-[#8B6914] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-[#7a5c11] z-30">
        +
      </button>
    </div>
  )
}
