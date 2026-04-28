import { useState, useMemo, useEffect } from 'react'
import { onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { useDealers } from '../../hooks/useUsers'
import { useCatalog } from '../../hooks/useCatalog'
import { useAuth } from '../../context/AuthContext'
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
  const low = threshold != null && available > 0 && available <= threshold
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

function useAllInventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const unsub = onSnapshot(inventoryCol, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])
  return { items, loading }
}

// ── Edit Item Modal ──────────────────────────────────────────────────────────
function EditItemModal({ item, dealers, isAdmin, onClose }) {
  const [form, setForm] = useState({
    modelName: item.modelName ?? '',
    sku: item.sku ?? '',
    serialNumber: item.serialNumber ?? '',
    condition: item.condition ?? 'New',
    quantityOnHand: item.quantityOnHand ?? 0,
    quantityReserved: item.quantityReserved ?? 0,
    msrp: item.msrp ?? '',
    dealerPrice: item.dealerPrice ?? '',
    costPrice: item.costPrice ?? '',
    lowStockThreshold: item.lowStockThreshold ?? '',
    notes: item.notes ?? '',
    dealerId: item.dealerId ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  async function handleSave() {
    if (!form.modelName.trim()) { setError('Model name is required.'); return }
    setSaving(true)
    try {
      await updateDoc(doc(db, 'inventory', item.id), {
        modelName: form.modelName.trim(),
        sku: form.sku.trim() || null,
        serialNumber: form.serialNumber.trim() || null,
        condition: form.condition,
        quantityOnHand: parseInt(form.quantityOnHand) || 0,
        quantityReserved: parseInt(form.quantityReserved) || 0,
        quantityAvailable: Math.max(0, (parseInt(form.quantityOnHand) || 0) - (parseInt(form.quantityReserved) || 0)),
        msrp: form.msrp !== '' ? parseFloat(form.msrp) : null,
        dealerPrice: form.dealerPrice !== '' ? parseFloat(form.dealerPrice) : null,
        costPrice: form.costPrice !== '' ? parseFloat(form.costPrice) : null,
        lowStockThreshold: form.lowStockThreshold !== '' ? parseInt(form.lowStockThreshold) : null,
        notes: form.notes.trim() || null,
        ...(isAdmin && form.dealerId ? { dealerId: form.dealerId } : {}),
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  const cls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'
  const lbl = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Edit Entry</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isAdmin && (
            <div>
              <label className={lbl}>Location</label>
              <select value={form.dealerId} onChange={set('dealerId')} className={cls}>
                <option value="">Unassigned</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.location ? `${d.location} — ${d.displayName || d.email}` : (d.displayName || d.email)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={lbl}>Model Name *</label>
            <input value={form.modelName} onChange={set('modelName')} className={cls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>SKU</label>
              <input value={form.sku} onChange={set('sku')} className={cls} />
            </div>
            <div>
              <label className={lbl}>Serial #</label>
              <input value={form.serialNumber} onChange={set('serialNumber')} className={cls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Condition</label>
              <select value={form.condition} onChange={set('condition')} className={cls}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Qty On Hand</label>
              <input type="number" min="0" value={form.quantityOnHand} onChange={set('quantityOnHand')} className={cls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Qty Reserved</label>
              <input type="number" min="0" value={form.quantityReserved} onChange={set('quantityReserved')} className={cls} />
            </div>
            <div>
              <label className={lbl}>Low Stock Alert ≤</label>
              <input type="number" min="0" value={form.lowStockThreshold} onChange={set('lowStockThreshold')} placeholder="e.g. 2" className={cls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>MSRP / Unit</label>
              <input type="number" min="0" step="0.01" value={form.msrp} onChange={set('msrp')} placeholder="0.00" className={cls} />
            </div>
            <div>
              <label className={lbl}>Rep Price / Unit</label>
              <input type="number" min="0" step="0.01" value={form.dealerPrice} onChange={set('dealerPrice')} placeholder="0.00" className={cls} />
            </div>
            {isAdmin && (
              <div>
                <label className={lbl}>CRK Cost / Unit</label>
                <input type="number" min="0" step="0.01" value={form.costPrice} onChange={set('costPrice')} placeholder="0.00" className={cls} />
              </div>
            )}
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} className={`${cls} resize-none`} />
          </div>
          {error && <p className="text-xs text-[#D95F5F]">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Transfer Stock Modal ─────────────────────────────────────────────────────
function TransferModal({ item, dealers, onClose }) {
  const [toDealerId, setToDealerId] = useState('')
  const [qty, setQty] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const available = (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0)
  const otherDealers = dealers.filter((d) => d.id !== item.dealerId)

  async function handleTransfer() {
    if (!toDealerId) { setError('Select a destination.'); return }
    if (qty < 1 || qty > available) { setError(`Qty must be 1–${available}.`); return }
    setSaving(true)
    try {
      await updateDoc(doc(db, 'inventory', item.id), {
        quantityOnHand: (item.quantityOnHand ?? 0) - qty,
        updatedAt: serverTimestamp(),
      })
      await addDoc(inventoryCol, {
        dealerId: toDealerId,
        modelName: item.modelName,
        sku: item.sku ?? '',
        serialNumber: item.serialNumber ?? '',
        condition: item.condition ?? 'New',
        quantityOnHand: qty,
        quantityReserved: 0,
        costPrice: item.costPrice ?? null,
        lowStockThreshold: item.lowStockThreshold ?? null,
        notes: `Transferred from ${item.dealerId}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch {
      setError('Transfer failed. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Transfer Stock</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-[#1A1A1A]">{item.modelName}</p>
            <p className="text-xs text-[#9A9A9A]">Available to transfer: {available}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">To Location</label>
            <select value={toDealerId} onChange={(e) => setToDealerId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]">
              <option value="">Select location…</option>
              {otherDealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.location ? `${d.location} — ${d.displayName || d.email}` : (d.displayName || d.email)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Quantity</label>
            <input type="number" min="1" max={available} value={qty}
              onChange={(e) => setQty(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]" />
          </div>
          {error && <p className="text-xs text-[#D95F5F]">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5]">Cancel</button>
          <button onClick={handleTransfer} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#7a5c12] disabled:opacity-50">
            {saving ? 'Transferring…' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Stock Modal ──────────────────────────────────────────────────────────
function AddStockModal({ dealers, catalog, onClose, fixedDealerId }) {
  const [dealerId, setDealerId] = useState(fixedDealerId ?? '')
  const [catalogId, setCatalogId] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [modelName, setModelName] = useState('')
  const [sku, setSku] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [condition, setCondition] = useState('New')
  const [quantity, setQuantity] = useState(1)
  const [costPrice, setCostPrice] = useState('')
  const [msrp, setMsrp] = useState('')
  const [dealerPrice, setDealerPrice] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const catalogMatches = useMemo(() => {
    if (!catalogSearch.trim()) return catalog
    const q = catalogSearch.toLowerCase()
    return catalog.filter((c) => c.name?.toLowerCase().includes(q) || c.sku?.toLowerCase().includes(q))
  }, [catalog, catalogSearch])

  function handleCatalogSelect(item) {
    setCatalogId(item.id)
    setCatalogSearch(item.name + (item.sku ? ` (${item.sku})` : ''))
    setModelName(item.name)
    setSku(item.sku ?? '')
    setCatalogOpen(false)
  }

  function clearCatalog() {
    setCatalogId(''); setCatalogSearch(''); setModelName(''); setSku('')
  }

  async function handleSave() {
    if (!dealerId) { setError('Select a location.'); return }
    if (!modelName.trim()) { setError('Model name is required.'); return }
    if (quantity < 1) { setError('Quantity must be at least 1.'); return }
    setSaving(true)
    try {
      await addDoc(inventoryCol, {
        dealerId,
        catalogId: catalogId || null,
        modelName: modelName.trim(),
        sku: sku.trim() || '',
        serialNumber: serialNumber.trim() || '',
        condition,
        quantityOnHand: quantity,
        quantityReserved: 0,
        quantityAvailable: quantity,
        msrp: msrp !== '' ? parseFloat(msrp) : null,
        dealerPrice: dealerPrice !== '' ? parseFloat(dealerPrice) : null,
        costPrice: costPrice !== '' ? parseFloat(costPrice) : null,
        lowStockThreshold: lowStockThreshold !== '' ? parseInt(lowStockThreshold) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  const cls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Add Stock</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!fixedDealerId && (
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Location *</label>
              <select value={dealerId} onChange={(e) => setDealerId(e.target.value)} className={cls}>
                <option value="">Select location…</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.location ? `${d.location} — ${d.displayName || d.email}` : (d.displayName || d.email)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="relative">
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">From Catalog</label>
            <div className="relative">
              <input
                value={catalogSearch}
                onChange={(e) => { setCatalogSearch(e.target.value); setCatalogOpen(true); if (!e.target.value) clearCatalog() }}
                onFocus={() => setCatalogOpen(true)}
                onBlur={() => setTimeout(() => setCatalogOpen(false), 150)}
                placeholder="Search by name or SKU… (optional)"
                className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:border-[#8B6914]"
              />
              {catalogId && (
                <button onClick={clearCatalog} type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-[#1A1A1A] text-base leading-none">×</button>
              )}
            </div>
            {catalogOpen && catalogMatches.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-sm">
                {catalogMatches.map((c) => (
                  <li key={c.id} onMouseDown={() => handleCatalogSelect(c)}
                    className="px-3 py-2 hover:bg-[#F4F4F5] cursor-pointer">
                    <span className="font-medium text-[#1A1A1A]">{c.name}</span>
                    {c.sku && <span className="ml-2 text-xs text-[#9A9A9A]">{c.sku}</span>}
                  </li>
                ))}
              </ul>
            )}
            {catalogOpen && catalogSearch.trim() && catalogMatches.length === 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-[#9A9A9A]">
                No catalog items match "{catalogSearch}"
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Model Name *</label>
            <input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="e.g. DJI Agras T50" className={cls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">SKU</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className={cls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Serial #</label>
              <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className={cls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value)} className={cls}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Quantity *</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className={cls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">MSRP / Unit</label>
              <input type="number" min="0" step="0.01" value={msrp} onChange={(e) => setMsrp(e.target.value)} placeholder="0.00" className={cls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Rep Price / Unit</label>
              <input type="number" min="0" step="0.01" value={dealerPrice} onChange={(e) => setDealerPrice(e.target.value)} placeholder="0.00" className={cls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">CRK Cost / Unit</label>
              <input type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00" className={cls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Low Stock Alert</label>
            <input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} placeholder="e.g. 2" className={cls} />
          </div>
          {error && <p className="text-xs text-[#D95F5F]">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5]">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#7a5c12] disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Stock'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function InventoryMaster() {
  const { user, isAdmin } = useAuth()
  const { items, loading } = useAllInventory()
  const { dealers, loading: dealersLoading } = useDealers()
  const { catalog } = useCatalog()

  const [search, setSearch] = useState('')
  const [filterDealer, setFilterDealer] = useState('')
  const [filterCondition, setFilterCondition] = useState('')
  const [filterAvail, setFilterAvail] = useState('')
  const [activeTab, setActiveTab] = useState('summary')
  const [showAdd, setShowAdd] = useState(false)
  const [transferItem, setTransferItem] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [deleteItem, setDeleteItem] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteItem) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'inventory', deleteItem.id))
      setDeleteItem(null)
    } finally {
      setDeleting(false)
    }
  }

  // Maps dealerId → location name (falls back to displayName if no location set)
  const dealerMap = useMemo(() => {
    const m = {}
    dealers.forEach((d) => { m[d.id] = d.location || d.displayName || d.email || d.id })
    return m
  }, [dealers])

  // Unique location names for filter dropdown
  const locationOptions = useMemo(() => {
    const locs = [...new Set(dealers.map((d) => d.location || d.displayName || d.email).filter(Boolean))]
    return locs.sort()
  }, [dealers])

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const available = (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0)
      const itemLocation = dealerMap[item.dealerId] || 'Unassigned'
      const matchSearch = !search || [item.modelName, item.sku, item.serialNumber, itemLocation]
        .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      const matchDealer = !filterDealer || itemLocation === filterDealer
      const matchCond = !filterCondition || item.condition === filterCondition
      const matchAvail = !filterAvail
        || (filterAvail === 'out' && available === 0)
        || (filterAvail === 'low' && available > 0 && item.lowStockThreshold != null && available <= item.lowStockThreshold)
        || (filterAvail === 'ok' && (item.lowStockThreshold == null || available > item.lowStockThreshold))
      return matchSearch && matchDealer && matchCond && matchAvail
    })
  }, [items, search, filterDealer, filterCondition, filterAvail, dealerMap])

  // Summary: group by modelName + condition, sum quantities, collect locations
  const summaryGroups = useMemo(() => {
    const groups = {}
    filtered.forEach((item) => {
      const key = `${item.modelName ?? ''}||${item.condition ?? ''}`
      if (!groups[key]) {
        groups[key] = {
          modelName: item.modelName ?? '—',
          condition: item.condition ?? '',
          totalOnHand: 0,
          totalReserved: 0,
          locations: [],
          msrp: item.msrp ?? null,
          repPrice: item.dealerPrice ?? null,
        }
      }
      const qty = item.quantityOnHand ?? 0
      groups[key].totalOnHand += qty
      groups[key].totalReserved += item.quantityReserved ?? 0
      if (groups[key].msrp == null && item.msrp != null) groups[key].msrp = item.msrp
      if (groups[key].repPrice == null && item.dealerPrice != null) groups[key].repPrice = item.dealerPrice
      const locName = dealerMap[item.dealerId] || 'Unassigned'
      const existing = groups[key].locations.find((l) => l.name === locName)
      if (existing) existing.qty += qty
      else groups[key].locations.push({ name: locName, qty })
    })
    return Object.values(groups).sort((a, b) => a.modelName.localeCompare(b.modelName))
  }, [filtered, dealerMap])

  // By location grouping — keyed by location name so reps at the same location are combined
  const byLocation = useMemo(() => {
    const groups = {}
    filtered.forEach((item) => {
      const locName = dealerMap[item.dealerId] || 'Unassigned'
      if (!groups[locName]) groups[locName] = []
      groups[locName].push(item)
    })
    return groups
  }, [filtered, dealerMap])

  // KPIs (across all items, not just filtered)
  const totalUnits = items.reduce((s, i) => s + (i.quantityOnHand ?? 0), 0)
  const totalAvailable = items.reduce((s, i) => s + Math.max(0, (i.quantityOnHand ?? 0) - (i.quantityReserved ?? 0)), 0)
  const lowStockCount = items.filter((i) => {
    const avail = (i.quantityOnHand ?? 0) - (i.quantityReserved ?? 0)
    return avail > 0 && i.lowStockThreshold != null && avail <= i.lowStockThreshold
  }).length
  const outOfStockCount = items.filter((i) => (i.quantityOnHand ?? 0) - (i.quantityReserved ?? 0) <= 0).length

  const isLoading = loading || dealersLoading
  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'
  const TABS = [
    { key: 'summary', label: 'Summary' },
    { key: 'byLocation', label: 'By Location' },
    { key: 'log', label: 'Log' },
  ]

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {showAdd && (
        <AddStockModal dealers={dealers} catalog={catalog} onClose={() => setShowAdd(false)}
          fixedDealerId={isAdmin ? undefined : user?.uid} />
      )}
      {transferItem && isAdmin && (
        <TransferModal item={transferItem} dealers={dealers} onClose={() => setTransferItem(null)} />
      )}
      {editItem && (
        <EditItemModal item={editItem} dealers={dealers} isAdmin={isAdmin} onClose={() => setEditItem(null)} />
      )}
      {deleteItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#1A1A1A]">Delete Entry</h2>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[#1A1A1A]">
                Are you sure you want to delete <span className="font-semibold">{deleteItem.modelName}</span>? This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
              <button onClick={() => setDeleteItem(null)} disabled={deleting}
                className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#c44f4f] disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Inventory</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">All locations — real-time</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
          + Add Stock
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Units', value: totalUnits, color: 'text-[#1A1A1A]' },
          { label: 'Available', value: totalAvailable, color: 'text-[#4CAF7D]' },
          { label: 'Low Stock', value: lowStockCount, color: 'text-[#E6A817]' },
          { label: 'Out of Stock', value: outOfStockCount, color: 'text-[#D95F5F]' },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <p className="text-xs text-[#9A9A9A] font-semibold uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-100">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key ? 'border-[#8B6914] text-[#8B6914]' : 'border-transparent text-[#9A9A9A] hover:text-[#1A1A1A]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search model, SKU, serial…"
          className={`${inputCls} col-span-2 md:col-span-1`} />
        <select value={filterDealer} onChange={(e) => setFilterDealer(e.target.value)} className={inputCls}>
          <option value="">All Locations</option>
          {locationOptions.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
        </select>
        <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} className={inputCls}>
          <option value="">All Conditions</option>
          {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)} className={inputCls}>
          <option value="">All Availability</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      {/* ── SUMMARY TAB ── */}
      {activeTab === 'summary' && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm hidden md:table">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F4F4F5]">
                {['Model', 'Condition', 'MSRP / Unit', 'Rep Price / Unit', 'Total On Hand', 'Total Reserved', 'Total Available', 'Locations'].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
              ) : summaryGroups.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-[#9A9A9A] text-sm">No inventory found.</td></tr>
              ) : summaryGroups.map((g, i) => {
                const totalAvail = g.totalOnHand - g.totalReserved
                return (
                  <tr key={i} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="py-3 px-4 font-medium text-[#1A1A1A]">{g.modelName}</td>
                    <td className="py-3 px-4">
                      {g.condition
                        ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conditionColor[g.condition] ?? 'bg-gray-100 text-gray-600'}`}>{g.condition}</span>
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-[#9A9A9A]">{g.msrp != null ? formatCurrency(g.msrp) : '—'}</td>
                    <td className="py-3 px-4 font-medium text-[#4CAF7D]">{g.repPrice != null ? formatCurrency(g.repPrice) : '—'}</td>
                    <td className="py-3 px-4 text-center font-semibold text-[#1A1A1A]">{g.totalOnHand}</td>
                    <td className="py-3 px-4 text-center text-[#9A9A9A]">{g.totalReserved}</td>
                    <td className="py-3 px-4 text-center">
                      <AvailBadge available={totalAvail} threshold={null} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {g.locations.map((l) => (
                          <span key={l.name} className="text-xs bg-[#F4F4F5] text-[#1A1A1A] px-2 py-0.5 rounded-full">
                            {l.name}: {l.qty}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {/* Mobile summary */}
          <div className="md:hidden divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-4 animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              ))
            ) : summaryGroups.length === 0 ? (
              <div className="text-center py-12 text-[#9A9A9A] text-sm">No inventory found.</div>
            ) : summaryGroups.map((g, i) => {
              const totalAvail = g.totalOnHand - g.totalReserved
              return (
                <div key={i} className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-semibold text-[#1A1A1A]">{g.modelName}</p>
                    {g.condition && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conditionColor[g.condition] ?? 'bg-gray-100 text-gray-600'}`}>{g.condition}</span>}
                  </div>
                  {(g.msrp != null || g.repPrice != null) && (
                    <div className="flex gap-4 text-xs mb-2">
                      {g.msrp != null && <span className="text-[#9A9A9A]">MSRP/unit: <span className="font-medium text-[#1A1A1A]">{formatCurrency(g.msrp)}</span></span>}
                      {g.repPrice != null && <span className="text-[#9A9A9A]">Rep Price/unit: <span className="font-medium text-[#4CAF7D]">{formatCurrency(g.repPrice)}</span></span>}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-center mb-2">
                    <div className="bg-[#F4F4F5] rounded-lg py-1.5">
                      <p className="text-xs text-[#9A9A9A]">On Hand</p>
                      <p className="font-bold text-[#1A1A1A]">{g.totalOnHand}</p>
                    </div>
                    <div className="bg-[#F4F4F5] rounded-lg py-1.5">
                      <p className="text-xs text-[#9A9A9A]">Reserved</p>
                      <p className="font-bold text-[#1A1A1A]">{g.totalReserved}</p>
                    </div>
                    <div className="bg-[#F4F4F5] rounded-lg py-1.5">
                      <p className="text-xs text-[#9A9A9A]">Available</p>
                      <p className="font-bold text-[#1A1A1A]">{totalAvail}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.locations.map((l) => (
                      <span key={l.name} className="text-xs bg-[#F4F4F5] text-[#1A1A1A] px-2 py-0.5 rounded-full">{l.name}: {l.qty}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── BY LOCATION TAB ── */}
      {activeTab === 'byLocation' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-4">
                  <div className="h-5 bg-gray-200 rounded w-1/4 mb-4" />
                  {[1, 2, 3].map((j) => <div key={j} className="h-4 bg-gray-100 rounded mb-2" />)}
                </div>
              ))}
            </div>
          ) : Object.keys(byLocation).length === 0 ? (
            <div className="text-center py-12 text-[#9A9A9A] text-sm">No inventory found.</div>
          ) : Object.entries(byLocation).sort(([a], [b]) => a.localeCompare(b)).map(([locName, locItems]) => {
            const locTotalUnits = locItems.reduce((s, i) => s + (i.quantityOnHand ?? 0), 0)
            const locOutCount = locItems.filter((i) => (i.quantityOnHand ?? 0) - (i.quantityReserved ?? 0) <= 0).length
            return (
              <div key={locName} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-[#F4F4F5] border-b border-gray-100">
                  <div>
                    <p className="font-semibold text-[#1A1A1A]">{locName}</p>
                    <p className="text-xs text-[#9A9A9A]">{locItems.length} entr{locItems.length !== 1 ? 'ies' : 'y'} · {locTotalUnits} total units</p>
                  </div>
                  {locOutCount > 0 && (
                    <span className="text-xs font-semibold bg-[#D95F5F]/15 text-[#D95F5F] px-2 py-0.5 rounded-full">{locOutCount} out</span>
                  )}
                </div>
                <table className="w-full text-sm hidden md:table">
                  <thead>
                    <tr className="border-b border-gray-50">
                      {['Model', 'SKU / Serial', 'Condition', 'MSRP / Unit', 'Rep Price / Unit', 'On Hand', 'Reserved', 'Available', ...(isAdmin ? ['CRK Cost / Unit', ''] : [])].map((h) => (
                        <th key={h} className="text-left py-2 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {locItems.map((item) => {
                      const available = (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0)
                      return (
                        <tr key={item.id} className="hover:bg-[#FAFAFA]">
                          <td className="py-2 px-4 font-medium text-[#1A1A1A]">{item.modelName}</td>
                          <td className="py-2 px-4">
                            <p className="text-[#1A1A1A]">{item.sku || '—'}</p>
                            {item.serialNumber && <p className="text-xs text-[#9A9A9A]">#{item.serialNumber}</p>}
                          </td>
                          <td className="py-2 px-4">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conditionColor[item.condition] ?? 'bg-gray-100 text-gray-600'}`}>
                              {item.condition ?? '—'}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-[#9A9A9A]">{item.msrp != null ? formatCurrency(item.msrp) : '—'}</td>
                          <td className="py-2 px-4 font-medium text-[#4CAF7D]">{item.dealerPrice != null ? formatCurrency(item.dealerPrice) : '—'}</td>
                          <td className="py-2 px-4 text-center font-semibold">{item.quantityOnHand ?? 0}</td>
                          <td className="py-2 px-4 text-center text-[#9A9A9A]">{item.quantityReserved ?? 0}</td>
                          <td className="py-2 px-4 text-center"><AvailBadge available={available} threshold={item.lowStockThreshold} /></td>
                          {isAdmin && <td className="py-2 px-4 text-[#9A9A9A]">{item.costPrice != null ? formatCurrency(item.costPrice) : '—'}</td>}
                          {isAdmin && (
                            <td className="py-2 px-4">
                              <button onClick={() => setTransferItem(item)} className="text-xs text-[#8B6914] hover:underline font-medium">Transfer</button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="md:hidden divide-y divide-gray-50">
                  {locItems.map((item) => {
                    const available = (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0)
                    return (
                      <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-[#1A1A1A] truncate">{item.modelName}</p>
                          <p className="text-xs text-[#9A9A9A]">{item.sku || 'No SKU'} · {item.condition}</p>
                          <div className="flex gap-3 text-xs mt-0.5">
                            {item.msrp != null && <span className="text-[#9A9A9A]">MSRP: {formatCurrency(item.msrp)}</span>}
                            {item.dealerPrice != null && <span className="text-[#4CAF7D] font-medium">Rep: {formatCurrency(item.dealerPrice)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-[#1A1A1A]">{item.quantityOnHand ?? 0}</span>
                          <AvailBadge available={available} threshold={item.lowStockThreshold} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── LOG TAB ── */}
      {activeTab === 'log' && (
        <>
          <div className="hidden md:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F4F4F5]">
                  {['Model', 'Location', 'SKU / Serial', 'Condition', 'On Hand', 'Reserved', 'Available', 'MSRP / Unit', 'Rep Price / Unit', ...(isAdmin ? ['CRK Cost / Unit'] : []), 'Added', ''].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={isAdmin ? 10 : 9} />)
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 12 : 11} className="py-12 text-center text-[#9A9A9A] text-sm">No entries found.</td></tr>
                ) : filtered.map((item) => {
                  const available = (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0)
                  return (
                    <tr key={item.id} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="py-3 px-4 font-medium text-[#1A1A1A]">{item.modelName}</td>
                      <td className="py-3 px-4 text-[#9A9A9A] text-xs">{dealerMap[item.dealerId] || '—'}</td>
                      <td className="py-3 px-4">
                        <p className="text-[#1A1A1A]">{item.sku || '—'}</p>
                        {item.serialNumber && <p className="text-xs text-[#9A9A9A]">#{item.serialNumber}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conditionColor[item.condition] ?? 'bg-gray-100 text-gray-600'}`}>
                          {item.condition ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-[#1A1A1A]">{item.quantityOnHand ?? 0}</td>
                      <td className="py-3 px-4 text-center text-[#9A9A9A]">{item.quantityReserved ?? 0}</td>
                      <td className="py-3 px-4 text-center"><AvailBadge available={available} threshold={item.lowStockThreshold} /></td>
                      <td className="py-3 px-4 text-[#9A9A9A]">{item.msrp != null ? formatCurrency(item.msrp) : '—'}</td>
                      <td className="py-3 px-4 text-[#9A9A9A]">{item.dealerPrice != null ? formatCurrency(item.dealerPrice) : '—'}</td>
                      {isAdmin && <td className="py-3 px-4 text-[#9A9A9A]">{item.costPrice != null ? formatCurrency(item.costPrice) : '—'}</td>}
                      <td className="py-3 px-4 text-xs text-[#9A9A9A] whitespace-nowrap">{formatDate(item.createdAt ?? item.updatedAt)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => setEditItem(item)} className="text-xs text-[#8B6914] hover:underline font-medium">Edit</button>
                          {isAdmin && (
                            <button onClick={() => setTransferItem(item)} className="text-xs text-[#9A9A9A] hover:underline font-medium">Transfer</button>
                          )}
                          {isAdmin && (
                            <button onClick={() => setDeleteItem(item)} className="text-xs text-[#D95F5F] hover:underline font-medium">Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile log cards */}
          <div className="md:hidden space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-[#9A9A9A] text-sm">No entries found.</div>
            ) : filtered.map((item) => {
              const available = (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0)
              return (
                <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-[#1A1A1A]">{item.modelName}</p>
                      <p className="text-xs text-[#9A9A9A]">{dealerMap[item.dealerId] || '—'} · {formatDate(item.createdAt ?? item.updatedAt)}</p>
                    </div>
                    <AvailBadge available={available} threshold={item.lowStockThreshold} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#9A9A9A] mb-3">
                    {item.sku && <span>SKU: {item.sku}</span>}
                    {item.serialNumber && <span>S/N: {item.serialNumber}</span>}
                    {item.condition && <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${conditionColor[item.condition] ?? 'bg-gray-100 text-gray-600'}`}>{item.condition}</span>}
                    {item.msrp != null && <span>MSRP: <span className="font-medium text-[#1A1A1A]">{formatCurrency(item.msrp)}</span></span>}
                    {item.dealerPrice != null && <span>Dealer: <span className="font-medium text-[#1A1A1A]">{formatCurrency(item.dealerPrice)}</span></span>}
                    {isAdmin && item.costPrice != null && <span>CRK Cost: <span className="font-medium text-[#1A1A1A]">{formatCurrency(item.costPrice)}</span></span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-[#F4F4F5] rounded-lg py-1.5">
                      <p className="text-xs text-[#9A9A9A]">On Hand</p>
                      <p className="font-bold text-[#1A1A1A]">{item.quantityOnHand ?? 0}</p>
                    </div>
                    <div className="bg-[#F4F4F5] rounded-lg py-1.5">
                      <p className="text-xs text-[#9A9A9A]">Reserved</p>
                      <p className="font-bold text-[#1A1A1A]">{item.quantityReserved ?? 0}</p>
                    </div>
                    <div className="bg-[#F4F4F5] rounded-lg py-1.5">
                      <p className="text-xs text-[#9A9A9A]">Available</p>
                      <p className="font-bold text-[#1A1A1A]">{available}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditItem(item)}
                      className="flex-1 text-sm border border-[#8B6914] text-[#8B6914] rounded-lg py-1.5 hover:bg-[#8B6914]/5 transition-colors">
                      Edit
                    </button>
                    {isAdmin && (
                      <button onClick={() => setTransferItem(item)}
                        className="flex-1 text-sm border border-gray-200 text-[#9A9A9A] rounded-lg py-1.5 hover:bg-[#F4F4F5] transition-colors">
                        Transfer
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => setDeleteItem(item)}
                        className="flex-1 text-sm border border-[#D95F5F] text-[#D95F5F] rounded-lg py-1.5 hover:bg-[#D95F5F]/5 transition-colors">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Mobile FAB */}
      <button onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 z-40 md:hidden w-14 h-14 bg-[#8B6914] text-white rounded-full shadow-lg text-2xl flex items-center justify-center hover:bg-[#7a5c12] transition-colors">
        +
      </button>
    </div>
  )
}
