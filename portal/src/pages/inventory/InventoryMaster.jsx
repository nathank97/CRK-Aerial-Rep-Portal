import { useState, useMemo, useEffect } from 'react'
import { onSnapshot, addDoc, updateDoc, deleteDoc, getDocs, getDoc, query, where, doc, serverTimestamp, deleteField } from 'firebase/firestore'
import { useDealers } from '../../hooks/useUsers'
import { useCatalog } from '../../hooks/useCatalog'
import { useAuth } from '../../context/AuthContext'
import { getDealerPrice } from '../../utils/pricing'
import { inventoryCol, inventoryBatchesCol, purchaseOrdersCol, inventoryTxCol, invoicesCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { SkeletonRow } from '../../components/common/SkeletonCard'
import { usePurchaseOrders } from '../../hooks/usePurchaseOrders'
import { useInventoryTransactions } from '../../hooks/useInventoryTransactions'
import PurchaseOrderModal from './PurchaseOrderModal'
import ReceivePOModal, { EditReceptionModal } from './ReceivePOModal'
import { writeTx } from '../../utils/inventoryTransactions'

const CONDITIONS = ['New', 'Demo', 'Refurbished']
const CATEGORIES = ['Drone Kit', 'Parts', 'Accessory', 'Other']
const CATALOG_CATEGORY = { Drone: 'Drone Kit', Part: 'Parts', Accessory: 'Accessory', Service: 'Other', Other: 'Other' }

function SortTh({ label, sortKey, sort, onSort, className = '' }) {
  const active = sort.key === sortKey
  return (
    <th onClick={() => onSort(sortKey)}
      className={`text-left py-2 px-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider cursor-pointer select-none hover:text-[#1A1A1A] transition-colors ${className}`}>
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[10px] leading-none ${active ? 'text-[#8B6914]' : 'opacity-25'}`}>
          {active && sort.dir === 'desc' ? '↓' : '↑'}
        </span>
      </span>
    </th>
  )
}

function applySort(arr, key, dir, getVal) {
  if (!key) return arr
  return [...arr].sort((a, b) => {
    let av = getVal ? getVal(a, key) : a[key]
    let bv = getVal ? getVal(b, key) : b[key]
    if (av == null && bv == null) return 0
    if (av == null) return dir === 'asc' ? 1 : -1
    if (bv == null) return dir === 'asc' ? -1 : 1
    if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return dir === 'asc' ? av - bv : bv - av
  })
}

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
    brand: item.brand ?? '',
    category: item.category ?? 'Drone Kit',
    modelName: item.modelName ?? '',
    sku: item.sku ?? '',
    serialNumber: item.serialNumber ?? '',
    condition: item.condition ?? 'New',
    quantityOnHand: item.quantityOnHand ?? 0,
    quantityReserved: item.quantityReserved ?? 0,
    msrp: item.msrp ?? '',
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
        brand: form.brand.trim() || null,
        category: form.category || null,
        modelName: form.modelName.trim(),
        sku: form.sku.trim() || null,
        serialNumber: form.serialNumber.trim() || null,
        condition: form.condition,
        quantityOnHand: parseInt(form.quantityOnHand) || 0,
        quantityReserved: parseInt(form.quantityReserved) || 0,
        quantityAvailable: Math.max(0, (parseInt(form.quantityOnHand) || 0) - (parseInt(form.quantityReserved) || 0)),
        msrp: form.msrp !== '' ? parseFloat(form.msrp) : null,
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Brand</label>
              <input value={form.brand} onChange={set('brand')} placeholder="e.g. DJI, Autel, AgEagle" className={cls} />
            </div>
            <div>
              <label className={lbl}>Category</label>
              <select value={form.category} onChange={set('category')} className={cls}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
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
              <div className={`${cls} bg-[#F4F4F5] text-[#4CAF7D] font-medium`}>
                {form.msrp !== '' && dealers.find((d) => d.id === form.dealerId)
                  ? formatCurrency(getDealerPrice({ msrp: parseFloat(form.msrp) }, dealers.find((d) => d.id === form.dealerId)))
                  : <span className="text-[#9A9A9A] font-normal">Auto-calculated from rep's margin</span>}
              </div>
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

// ── Adjust Quantity Modal ────────────────────────────────────────────────────
function AdjustQtyModal({ item, profile, onClose }) {
  const [delta, setDelta] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const cls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  const lbl = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  async function handleSave() {
    const d = parseInt(delta)
    if (isNaN(d) || d === 0) { setError('Enter a non-zero quantity change.'); return }
    setSaving(true)
    try {
      const newOnHand = (item.quantityOnHand ?? 0) + d
      await updateDoc(doc(db, 'inventory', item.id), {
        quantityOnHand: newOnHand,
        quantityAvailable: Math.max(0, newOnHand - (item.quantityReserved ?? 0)),
        updatedAt: serverTimestamp(),
      })
      await writeTx([{
        type: 'adjustment',
        qty: d,
        modelName: item.modelName ?? null,
        brand: item.brand ?? null,
        sku: item.sku ?? null,
        category: item.category ?? null,
        dealerId: item.dealerId ?? null,
        inventoryId: item.id,
        sourceType: 'manual',
        notes: notes.trim() || null,
        createdBy: profile?.displayName ?? '',
      }])
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  const previewQty = delta && !isNaN(parseInt(delta)) && parseInt(delta) !== 0
    ? (item.quantityOnHand ?? 0) + parseInt(delta)
    : null

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">Adjust Quantity</h2>
            <p className="text-xs text-[#9A9A9A] mt-0.5">{item.modelName}{item.sku ? ` · ${item.sku}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {error && <p className="text-xs text-[#D95F5F]">{error}</p>}
          <div>
            <label className={lbl}>Quantity Change (+ or −) *</label>
            <input type="number" value={delta} onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. 1 or -2" className={cls} autoFocus />
            <p className="text-xs text-[#9A9A9A] mt-1">
              Current on hand: <span className="font-semibold text-[#1A1A1A]">{item.quantityOnHand ?? 0}</span>
              {previewQty != null && (
                <> → <span className="font-semibold text-[#8B6914]">{previewQty}</span></>
              )}
            </p>
          </div>
          <div>
            <label className={lbl}>Reason / Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Correction for invoice 0019 reversal" className={cls} />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
          <button onClick={onClose} disabled={saving}
            className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#7a5c12] disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Adjustment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit Transaction Log Entry Modal ─────────────────────────────────────────
function EditTxModal({ tx, saving, onSave, onClose }) {
  const [sku, setSku] = useState(tx.sku ?? '')
  const [notes, setNotes] = useState(tx.notes ?? '')
  const cls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  const lbl = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">Edit Log Entry</h2>
            <p className="text-xs text-[#9A9A9A] mt-0.5">{tx.modelName || '—'}</p>
          </div>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={lbl}>SKU</label>
            <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="e.g. 14-007-00363" className={cls} autoFocus />
          </div>
          <div>
            <label className={lbl}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={cls} />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
          <button onClick={onClose} disabled={saving}
            className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => onSave({ sku, notes })} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#7a5c12] disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
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
        brand: item.brand ?? null,
        category: item.category ?? null,
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
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('Drone Kit')
  const [modelName, setModelName] = useState('')
  const [sku, setSku] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [condition, setCondition] = useState('New')
  const [quantity, setQuantity] = useState(1)
  const [costPrice, setCostPrice] = useState('')
  const [msrp, setMsrp] = useState('')
  const [lowStockThreshold, setLowStockThreshold] = useState('')

  const selectedDealer = dealers.find((d) => d.id === dealerId)
  const computedRepPrice = msrp !== '' && selectedDealer
    ? getDealerPrice({ msrp: parseFloat(msrp) }, selectedDealer)
    : null
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
      const ref = await addDoc(inventoryCol, {
        dealerId,
        catalogId: catalogId || null,
        brand: brand.trim() || null,
        category: category || null,
        modelName: modelName.trim(),
        sku: sku.trim() || '',
        serialNumber: serialNumber.trim() || '',
        condition,
        quantityOnHand: quantity,
        quantityReserved: 0,
        quantityAvailable: quantity,
        msrp: msrp !== '' ? parseFloat(msrp) : null,
        costPrice: costPrice !== '' ? parseFloat(costPrice) : null,
        lowStockThreshold: lowStockThreshold !== '' ? parseInt(lowStockThreshold) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      await writeTx([{
        type: 'add_stock',
        qty: quantity,
        modelName: modelName.trim(),
        brand: brand.trim() || null,
        sku: sku.trim() || null,
        category: category || null,
        dealerId,
        inventoryId: ref.id,
        sourceType: 'manual',
        createdBy: '',
      }])
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
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Brand</label>
            <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. DJI, Autel, AgEagle" className={cls} />
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
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={cls}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Quantity *</label>
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className={cls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">MSRP / Unit</label>
              <input type="number" min="0" step="0.01" value={msrp} onChange={(e) => setMsrp(e.target.value)} placeholder="0.00" className={cls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Rep Price / Unit</label>
              <div className={`${cls} bg-[#F4F4F5] text-[#4CAF7D] font-medium`}>
                {computedRepPrice != null ? formatCurrency(computedRepPrice) : <span className="text-[#9A9A9A]">Select location + enter MSRP</span>}
              </div>
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

// ── PO Preview Modal ─────────────────────────────────────────────────────────
function POPreviewModal({ po, dealerMap, catalogMap, onClose, onEdit }) {
  function fmt(n) {
    if (n == null) return '—'
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const subtotal = (po.items ?? []).filter((i) => !i.cancelled).reduce((s, i) => {
    return s + (i.orderedQty ?? 0) * (i.costPrice ?? 0)
  }, 0)
  const freight = po.freightCost ?? 0
  const grandTotal = subtotal + freight
  const statusColor = {
    Draft: 'bg-gray-100 text-gray-500',
    Ordered: 'bg-[#4A90B8]/15 text-[#4A90B8]',
    'Partially Received': 'bg-[#E6A817]/15 text-[#E6A817]',
    'Fully Received': 'bg-[#4CAF7D]/15 text-[#4CAF7D]',
    Cancelled: 'bg-gray-100 text-gray-400',
  }[po.status] ?? 'bg-gray-100 text-gray-500'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">
              {po.supplierName}{po.poNumber ? ` · PO ${po.poNumber}` : ''}
            </h2>
            <div className="mt-1">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>{po.status}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5 text-sm">
            <div>
              <p className="text-xs text-[#9A9A9A] font-semibold uppercase tracking-wider mb-0.5">Order Date</p>
              <p className="text-[#1A1A1A] font-medium">{po.orderDate || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#9A9A9A] font-semibold uppercase tracking-wider mb-0.5">Exp. Delivery</p>
              <p className="text-[#1A1A1A] font-medium">{po.expectedDelivery || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#9A9A9A] font-semibold uppercase tracking-wider mb-0.5">Location</p>
              <p className="text-[#1A1A1A] font-medium">{dealerMap[po.dealerId] || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#9A9A9A] font-semibold uppercase tracking-wider mb-0.5">Created By</p>
              <p className="text-[#1A1A1A] font-medium">{po.createdBy || '—'}</p>
            </div>
            {po.notes && (
              <div className="col-span-2 md:col-span-4">
                <p className="text-xs text-[#9A9A9A] font-semibold uppercase tracking-wider mb-0.5">Notes</p>
                <p className="text-[#1A1A1A]">{po.notes}</p>
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
            <table className="w-full text-sm" style={{ minWidth: 640 }}>
              <thead>
                <tr className="bg-[#F4F4F5] border-b border-gray-200">
                  {['#', 'Model', 'Compatible Models', 'Brand', 'SKU', 'Condition', 'Ordered', 'Received', 'Cost / Unit', 'Line Total'].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(po.items ?? []).map((item, idx) => {
                  const lineTotal = (item.orderedQty ?? 0) * (item.costPrice ?? 0)
                  const isCancelled = item.cancelled
                  const fullyReceived = (item.receivedQty ?? 0) >= item.orderedQty
                  return (
                    <tr key={item.id ?? idx} className={isCancelled ? 'opacity-50 bg-gray-50' : fullyReceived ? 'bg-[#4CAF7D]/5' : ''}>
                      <td className="px-3 py-2 text-xs text-[#9A9A9A] text-center">
                        {isCancelled
                          ? <span className="text-[9px] font-bold bg-gray-200 text-gray-500 px-1 py-0.5 rounded">CXL</span>
                          : fullyReceived
                          ? <span className="text-[9px] font-bold bg-[#4CAF7D]/20 text-[#4CAF7D] px-1 py-0.5 rounded">RCV</span>
                          : idx + 1}
                      </td>
                      <td className="px-3 py-2 font-medium text-[#1A1A1A]">{item.modelName || '—'}</td>
                      <td className="px-3 py-2 text-[#9A9A9A] text-xs">
                        {(() => {
                          const models = item.catalogId ? (catalogMap[item.catalogId]?.compatibleModels ?? []) : []
                          return models.length > 0 ? models.join(', ') : '—'
                        })()}
                      </td>
                      <td className="px-3 py-2 text-[#9A9A9A]">{item.brand || '—'}</td>
                      <td className="px-3 py-2 text-[#9A9A9A]">{item.sku || '—'}</td>
                      <td className="px-3 py-2 text-[#9A9A9A]">{item.condition || '—'}</td>
                      <td className="px-3 py-2 text-center font-medium text-[#1A1A1A]">{item.orderedQty ?? 0}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`font-medium ${fullyReceived ? 'text-[#4CAF7D]' : (item.receivedQty ?? 0) > 0 ? 'text-[#E6A817]' : 'text-[#9A9A9A]'}`}>
                          {item.receivedQty ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#9A9A9A]">{item.costPrice != null ? fmt(item.costPrice) : '—'}</td>
                      <td className="px-3 py-2 font-medium text-[#1A1A1A]">{item.costPrice != null ? fmt(lineTotal) : '—'}</td>
                    </tr>
                  )
                })}
                {(po.items ?? []).length === 0 && (
                  <tr><td colSpan={10} className="py-6 text-center text-[#9A9A9A] text-sm">No items on this order.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="bg-[#F4F4F5] rounded-lg px-5 py-3 space-y-1 text-sm min-w-[220px]">
              <div className="flex justify-between gap-8"><span className="text-[#9A9A9A]">Subtotal</span><span className="font-medium text-[#1A1A1A]">{fmt(subtotal)}</span></div>
              <div className="flex justify-between gap-8"><span className="text-[#9A9A9A]">Freight</span><span className="font-medium text-[#1A1A1A]">{freight > 0 ? fmt(freight) : '—'}</span></div>
              <div className="flex justify-between gap-8 border-t border-gray-300 pt-1 mt-1">
                <span className="font-semibold text-[#1A1A1A]">Grand Total</span>
                <span className="font-bold text-[#8B6914]">{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="border border-gray-200 text-[#1A1A1A] text-sm font-medium py-2 px-5 rounded-lg hover:bg-[#F4F4F5]">
            Close
          </button>
          <button onClick={onEdit} className="bg-[#8B6914] text-white text-sm font-semibold py-2 px-5 rounded-lg hover:bg-[#7a5c11] transition-colors">
            Edit
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function InventoryMaster() {
  const { user, profile, isAdmin, isWarehouseManager } = useAuth()
  const { items, loading } = useAllInventory()
  const { dealers, loading: dealersLoading } = useDealers()
  const { catalog } = useCatalog()
  const { pos, loading: posLoading, error: posError } = usePurchaseOrders()
  const { transactions, loading: txLoading } = useInventoryTransactions()
  const [migrating, setMigrating] = useState(false)

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
  const [showPO, setShowPO] = useState(false)
  const [editPO, setEditPO] = useState(null)
  const [cancelPO, setCancelPO] = useState(null)
  const [cancelSel, setCancelSel] = useState({})
  const [cancelBusy, setCancelBusy] = useState(false)
  const [adjustItem, setAdjustItem] = useState(null)
  const [deletingTx, setDeletingTx] = useState(null)
  const [deletingTxBusy, setDeletingTxBusy] = useState(false)
  const [editTx, setEditTx] = useState(null)
  const [editTxSaving, setEditTxSaving] = useState(false)
  const [showCleanup, setShowCleanup] = useState(false)
  const [cleanupBusy, setCleanupBusy] = useState(false)
  const [cleanupDone, setCleanupDone] = useState(false)
  const [showShortfallCleanup, setShowShortfallCleanup] = useState(false)
  const [shortfallCleanupBusy, setShortfallCleanupBusy] = useState(false)
  const [shortfallCleanupDone, setShortfallCleanupDone] = useState(false)
  const [showFullReset, setShowFullReset] = useState(false)
  const [fullResetConfirm, setFullResetConfirm] = useState('')
  const [fullResetBusy, setFullResetBusy] = useState(false)
  const [fullResetDone, setFullResetDone] = useState(false)
  const [showUnreceiveAll, setShowUnreceiveAll] = useState(false)
  const [unreceiveAllBusy, setUnreceiveAllBusy] = useState(false)
  const [unreceiveAllDone, setUnreceiveAllDone] = useState(false)
  const [showResetInvoiceDed, setShowResetInvoiceDed] = useState(false)
  const [resetInvoiceDedBusy, setResetInvoiceDedBusy] = useState(false)
  const [resetInvoiceDedDone, setResetInvoiceDedDone] = useState(false)
  const [receivePO, setReceivePO] = useState(null)
  const [editReceptionPO, setEditReceptionPO] = useState(null)
  const [deletePO, setDeletePO] = useState(null)
  const [deletingPO, setDeletingPO] = useState(false)
  const [previewPO, setPreviewPO] = useState(null)

  // One-time migration: inventoryBatches → purchaseOrders
  useEffect(() => {
    if (posLoading) return
    async function migrate() {
      const batchSnap = await getDocs(inventoryBatchesCol)
      if (batchSnap.empty) return
      setMigrating(true)
      for (const batchDoc of batchSnap.docs) {
        const batch = { id: batchDoc.id, ...batchDoc.data() }
        const itemsSnap = await getDocs(query(inventoryCol, where('batchId', '==', batch.id)))
        const batchItems = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        const poRef = await addDoc(purchaseOrdersCol, {
          supplierName: batch.supplierName ?? '',
          poNumber: batch.poNumber ?? null,
          orderDate: batch.dateReceived ?? null,
          expectedDelivery: batch.dateReceived ?? null,
          notes: batch.notes ?? null,
          dealerId: batch.dealerId ?? null,
          status: 'Fully Received',
          createdBy: batch.createdBy ?? '',
          createdAt: batch.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
          items: batchItems.map((item) => ({
            id: item.id,
            catalogId: item.catalogId ?? null,
            brand: item.brand ?? null,
            category: item.category ?? null,
            modelName: item.modelName ?? '',
            sku: item.sku ?? null,
            condition: item.condition ?? 'New',
            orderedQty: item.quantityOnHand ?? 0,
            receivedQty: item.quantityOnHand ?? 0,
            costPrice: item.costPrice ?? null,
            msrp: item.msrp ?? null,
            lowStockThreshold: item.lowStockThreshold ?? null,
            inventoryIds: [item.id],
          })),
        })
        for (const item of batchItems) {
          await updateDoc(doc(db, 'inventory', item.id), { poId: poRef.id, batchId: deleteField() })
        }
        await deleteDoc(doc(db, 'inventoryBatches', batch.id))
      }
      setMigrating(false)
    }
    migrate()
  }, [posLoading])
  const [summarySort, setSummarySort] = useState({ key: '', dir: 'asc' })
  const [locationSort, setLocationSort] = useState({ key: '', dir: 'asc' })
  const [summaryFilterBrands, setSummaryFilterBrands] = useState(new Set())
  const [summaryBrandOpen, setSummaryBrandOpen] = useState(false)
  const [summaryFilterCategory, setSummaryFilterCategory] = useState('')

  const toggleSort = (setter) => (key) =>
    setter((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))

  async function handleCancelItems() {
    if (!cancelPO) return
    setCancelBusy(true)
    try {
      const updatedItems = (cancelPO.items ?? []).map((item) => ({
        ...item,
        cancelled: cancelSel[item.id] ? true : (item.cancelled ?? false),
      }))
      const active = updatedItems.filter((i) => !i.cancelled)
      let newStatus = cancelPO.status
      if (active.length === 0) newStatus = 'Cancelled'
      else if (active.every((i) => (i.receivedQty ?? 0) >= i.orderedQty)) newStatus = 'Fully Received'
      else if (active.some((i) => (i.receivedQty ?? 0) > 0)) newStatus = 'Partially Received'
      await updateDoc(doc(db, 'purchaseOrders', cancelPO.id), {
        items: updatedItems, status: newStatus, updatedAt: serverTimestamp(),
      })
      const cancelledNow = (cancelPO.items ?? []).filter((i) => cancelSel[i.id] && !i.cancelled)
      if (cancelledNow.length > 0) {
        await writeTx(cancelledNow.map((item) => ({
          type: 'cancellation',
          qty: -(Math.max(0, item.orderedQty - (item.receivedQty ?? 0))),
          modelName: item.modelName,
          brand: item.brand ?? null,
          sku: item.sku ?? null,
          category: item.category ?? null,
          dealerId: cancelPO.dealerId,
          inventoryId: null,
          sourceType: 'purchase_order',
          sourceId: cancelPO.id,
          sourceNumber: cancelPO.poNumber || cancelPO.supplierName,
          notes: 'PO item cancelled',
          createdBy: profile?.displayName ?? '',
        })))
      }
      setCancelPO(null)
      setCancelSel({})
    } catch (e) {
      console.error('Cancel error:', e)
    } finally {
      setCancelBusy(false)
    }
  }

  const shortfallItems = items.filter((i) => i.notes === 'Auto-created: inventory shortfall')

  async function handleUnreceiveAll() {
    setUnreceiveAllBusy(true)
    try {
      const snap = await getDocs(purchaseOrdersCol)
      await Promise.all(snap.docs.map(async (poDoc) => {
        const po = poDoc.data()
        // Reset every item: zero receivedQty, clear inventoryIds
        const resetItems = (po.items ?? []).map((item) => ({
          ...item,
          receivedQty: 0,
          inventoryIds: [],
        }))
        await updateDoc(poDoc.ref, {
          items: resetItems,
          status: 'Ordered',
          lastReceivedDate: deleteField(),
          lastReceivedBy: deleteField(),
          updatedAt: serverTimestamp(),
        })
      }))
      setUnreceiveAllDone(true)
      setShowUnreceiveAll(false)
    } catch (e) {
      console.error('Un-receive error:', e)
    } finally {
      setUnreceiveAllBusy(false)
    }
  }

  async function handleResetInvoiceDeductions() {
    setResetInvoiceDedBusy(true)
    try {
      const snap = await getDocs(invoicesCol)
      const deducted = snap.docs.filter((d) => d.data().inventoryDeducted === true)
      await Promise.all(deducted.map((d) =>
        updateDoc(d.ref, {
          inventoryDeducted: false,
          inventoryDeductionDetails: [],
          inventoryDeductedAt: deleteField(),
          updatedAt: serverTimestamp(),
        })
      ))
      setResetInvoiceDedDone(true)
      setShowResetInvoiceDed(false)
    } catch (e) {
      console.error('Invoice deduction reset error:', e)
    } finally {
      setResetInvoiceDedBusy(false)
    }
  }

  async function handleShortfallCleanup() {
    setShortfallCleanupBusy(true)
    try {
      await Promise.all(shortfallItems.map((i) => deleteDoc(doc(db, 'inventory', i.id))))
      setShortfallCleanupDone(true)
      setShowShortfallCleanup(false)
    } catch (e) {
      console.error('Shortfall cleanup error:', e)
    } finally {
      setShortfallCleanupBusy(false)
    }
  }

  async function handleFullReset() {
    setFullResetBusy(true)
    try {
      // Delete every inventory document
      const invSnap = await getDocs(inventoryCol)
      await Promise.all(invSnap.docs.map((d) => deleteDoc(d.ref)))
      // Delete every transaction log document
      const txSnap = await getDocs(inventoryTxCol)
      await Promise.all(txSnap.docs.map((d) => deleteDoc(d.ref)))
      setFullResetDone(true)
      setShowFullReset(false)
    } catch (e) {
      console.error('Full reset error:', e)
    } finally {
      setFullResetBusy(false)
      setFullResetConfirm('')
    }
  }

  async function handleCleanupInventory() {
    setCleanupBusy(true)
    try {
      // Delete all inventory records not linked to a PO
      const nonPo = items.filter((i) => !i.poId)
      await Promise.all(nonPo.map((i) => deleteDoc(doc(db, 'inventory', i.id))))
      // Delete all transaction records
      const txSnap = await getDocs(inventoryTxCol)
      await Promise.all(txSnap.docs.map((d) => deleteDoc(d.ref)))
      setCleanupDone(true)
      setShowCleanup(false)
    } catch (e) {
      console.error('Cleanup error:', e)
    } finally {
      setCleanupBusy(false)
    }
  }

  async function handleDeleteTx() {
    if (!deletingTx) return
    setDeletingTxBusy(true)
    try {
      if (deletingTx.inventoryId) {
        const invSnap = await getDoc(doc(db, 'inventory', deletingTx.inventoryId))
        if (invSnap.exists()) {
          const data = invSnap.data()
          const newOnHand = (data.quantityOnHand ?? 0) - (deletingTx.qty ?? 0)
          await updateDoc(doc(db, 'inventory', deletingTx.inventoryId), {
            quantityOnHand: newOnHand,
            quantityAvailable: Math.max(0, newOnHand - (data.quantityReserved ?? 0)),
            updatedAt: serverTimestamp(),
          })
        }
      }
      await deleteDoc(doc(db, 'inventoryTransactions', deletingTx.id))
      setDeletingTx(null)
    } catch (e) {
      console.error('Delete tx error:', e)
    } finally {
      setDeletingTxBusy(false)
    }
  }

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

  // Maps dealerId → full dealer profile (for margin/tier-based rep price calculation)
  const dealerProfileMap = useMemo(() => {
    const m = {}
    dealers.forEach((d) => { m[d.id] = d })
    return m
  }, [dealers])

  // Maps catalogId → catalog item (for MSRP and tier pricing lookup)
  const catalogMap = useMemo(() => {
    const m = {}
    catalog.forEach((c) => { m[c.id] = c })
    return m
  }, [catalog])

  // Secondary lookup: catalog item by normalized SKU (for items that have no catalogId)
  const catalogSkuMap = useMemo(() => {
    const m = {}
    catalog.forEach((c) => { if (c.sku?.trim()) m[c.sku.trim().toLowerCase()] = c })
    return m
  }, [catalog])

  // Weighted-average cost per item key, derived from all PO received quantities.
  // Keyed by normalized modelName only — PO line items frequently omit brand/condition/category
  // so a 4-field key would never match the inventory summary group key.
  const avgCostByKey = useMemo(() => {
    const sumValue = {}
    const sumQty   = {}
    pos.forEach((p) => {
      ;(p.items ?? []).filter((i) => !i.cancelled && (i.receivedQty ?? 0) > 0 && i.costPrice != null).forEach((item) => {
        const key = (item.modelName ?? '').toLowerCase().trim()
        if (!key) return
        sumValue[key] = (sumValue[key] ?? 0) + item.receivedQty * item.costPrice
        sumQty[key]   = (sumQty[key]   ?? 0) + item.receivedQty
      })
    })
    const result = {}
    Object.keys(sumQty).forEach((key) => {
      if (sumQty[key] > 0) result[key] = sumValue[key] / sumQty[key]
    })
    return result
  }, [pos])

  // Outstanding PO units per item key (Ordered / Partially Received POs only).
  // Same normalized-modelName key as avgCostByKey.
  const onOrderByKey = useMemo(() => {
    const result = {}
    pos
      .filter((p) => ['Ordered', 'Partially Received'].includes(p.status))
      .forEach((p) => {
        ;(p.items ?? []).filter((i) => !i.cancelled).forEach((item) => {
          const remaining = Math.max(0, item.orderedQty - (item.receivedQty ?? 0))
          if (remaining > 0) {
            const key = (item.modelName ?? '').toLowerCase().trim()
            if (key) result[key] = (result[key] ?? 0) + remaining
          }
        })
      })
    return result
  }, [pos])

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

  // Summary: group by SKU + condition when SKU is present; fall back to brand + modelName + condition + category
  const summaryGroups = useMemo(() => {
    const resolveCatItem = (item) =>
      (item.catalogId ? catalogMap[item.catalogId] : null)
      ?? (item.sku?.trim() ? catalogSkuMap[item.sku.trim().toLowerCase()] : null)

    const groups = {}
    filtered.forEach((item) => {
      const skuKey = item.sku?.trim() ? item.sku.trim().toLowerCase() : null
      const key = skuKey
        ? `sku:${skuKey}||${item.condition ?? ''}`
        : `name:${item.brand ?? ''}||${item.modelName ?? ''}||${item.condition ?? ''}||${item.category ?? ''}`
      if (!groups[key]) {
        const catItem = resolveCatItem(item)
        const msrp = catItem?.msrp ?? item.msrp ?? null
        groups[key] = {
          _key: key,
          sku: item.sku?.trim() || '',
          brand: catItem?.manufacturer || item.brand || '',
          category: (catItem && CATALOG_CATEGORY[catItem.type]) || item.category || '',
          modelName: catItem?.name ?? item.modelName ?? '—',
          droneModels: catItem?.compatibleModels ?? [],
          condition: item.condition ?? '',
          totalOnHand: 0,
          totalReserved: 0,
          msrp,
          repPrice: msrp != null ? getDealerPrice(catItem ?? { msrp }, profile) : null,
        }
      }
      const g = groups[key]
      // Upgrade display fields if a catalog item is now resolved for this item
      if (g.modelName === '—' || g.modelName === '' || g.droneModels.length === 0 || !g.brand || !g.category) {
        const catItem = resolveCatItem(item)
        if (catItem) {
          if (g.modelName === '—' || g.modelName === '') g.modelName = catItem.name ?? g.modelName
          if (g.droneModels.length === 0) g.droneModels = catItem.compatibleModels ?? []
          if (!g.brand && catItem.manufacturer?.trim()) g.brand = catItem.manufacturer.trim()
          if (!g.category && catItem.type) g.category = CATALOG_CATEGORY[catItem.type] ?? g.category
        } else if ((g.modelName === '—' || g.modelName === '') && item.modelName) {
          g.modelName = item.modelName
        }
      }
      g.totalOnHand += item.quantityOnHand ?? 0
      g.totalReserved += item.quantityReserved ?? 0
      if (g.msrp == null) {
        const catItem = resolveCatItem(item)
        const msrp = catItem?.msrp ?? item.msrp ?? null
        if (msrp != null) {
          g.msrp = msrp
          g.repPrice = getDealerPrice(catItem ?? { msrp }, profile)
        }
      }
    })
    return Object.values(groups)
      .map((g) => {
        const lookupKey = (g.modelName === '—' ? '' : g.modelName).toLowerCase().trim()
        const avgCost = avgCostByKey[lookupKey] ?? null
        return {
          ...g,
          totalOnOrder: onOrderByKey[lookupKey] ?? 0,
          avgCost,
          totalValue: avgCost != null ? g.totalOnHand * avgCost : null,
        }
      })
      .sort((a, b) => a.modelName.localeCompare(b.modelName))
  }, [filtered, catalogMap, catalogSkuMap, profile, onOrderByKey, avgCostByKey])

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

  const sortedSummary = useMemo(() => {
    const getVal = (g, k) => {
      if (k === 'totalAvail') return g.totalOnHand - g.totalReserved
      return g[k]
    }
    const neg = summaryGroups.filter((g) => g.totalOnHand < 0)
    const rest = summaryGroups.filter((g) => g.totalOnHand >= 0)
    return [...applySort(neg, summarySort.key, summarySort.dir, getVal), ...applySort(rest, summarySort.key, summarySort.dir, getVal)]
  }, [summaryGroups, summarySort])

  const summaryBrands = useMemo(
    () => [...new Set(summaryGroups.map((g) => g.brand).filter(Boolean))].sort(),
    [summaryGroups]
  )

  const visibleSummary = useMemo(() => sortedSummary.filter((g) => {
    const matchBrand = summaryFilterBrands.size === 0 || summaryFilterBrands.has(g.brand)
    const matchCat = !summaryFilterCategory || g.category === summaryFilterCategory
    return matchBrand && matchCat
  }), [sortedSummary, summaryFilterBrands, summaryFilterCategory])

  const sortLocItems = (locItems) => {
    const getVal = (item, k) => {
      if (k === 'available') return (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0)
      if (k === 'dealerPrice') return item.msrp != null ? getDealerPrice(item, dealerProfileMap[item.dealerId]) : null
      return item[k]
    }
    const neg = locItems.filter((i) => (i.quantityOnHand ?? 0) < 0)
    const rest = locItems.filter((i) => (i.quantityOnHand ?? 0) >= 0)
    return [...applySort(neg, locationSort.key, locationSort.dir, getVal), ...applySort(rest, locationSort.key, locationSort.dir, getVal)]
  }

  // KPIs (across all items, not just filtered)
  const inStockItems = items.filter((i) => i.inventoryStatus !== 'on_order' && i.inventoryStatus !== 'cancelled')
  const totalUnits = inStockItems.reduce((s, i) => s + (i.quantityOnHand ?? 0), 0)
  const totalAvailable = inStockItems.reduce((s, i) => s + Math.max(0, (i.quantityOnHand ?? 0) - (i.quantityReserved ?? 0)), 0)
  const onOrderUnits = items.filter((i) => i.inventoryStatus === 'on_order').reduce((s, i) => s + (i.quantityOnOrder ?? 0), 0)
  const lowStockCount = inStockItems.filter((i) => {
    const avail = (i.quantityOnHand ?? 0) - (i.quantityReserved ?? 0)
    return avail > 0 && i.lowStockThreshold != null && avail <= i.lowStockThreshold
  }).length
  const outOfStockCount = inStockItems.filter((i) => (i.quantityOnHand ?? 0) - (i.quantityReserved ?? 0) <= 0).length
  const negativeStockCount = inStockItems.filter((i) => (i.quantityOnHand ?? 0) < 0).length

  const isLoading = loading || dealersLoading
  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'
  const TABS = [
    { key: 'summary', label: 'Summary' },
    { key: 'byLocation', label: 'By Location' },
    ...((isAdmin || isWarehouseManager) ? [
      { key: 'purchaseOrders', label: 'Purchase Orders' },
      { key: 'log', label: 'Log' },
    ] : []),
  ]

  return (
    <div className="p-3 md:p-5">
      {showAdd && (
        <AddStockModal dealers={dealers} catalog={catalog} onClose={() => setShowAdd(false)}
          fixedDealerId={isAdmin ? undefined : user?.uid} />
      )}
      {(showPO || editPO) && (
        <PurchaseOrderModal
          po={editPO ?? null}
          dealers={dealers}
          catalog={catalog}
          onClose={() => { setShowPO(false); setEditPO(null) }}
        />
      )}
      {receivePO && (
        <ReceivePOModal
          po={receivePO}
          dealerMap={dealerMap}
          onClose={() => setReceivePO(null)}
        />
      )}
      {editReceptionPO && (
        <EditReceptionModal
          po={editReceptionPO}
          dealerMap={dealerMap}
          onClose={() => setEditReceptionPO(null)}
        />
      )}
      {previewPO && (
        <POPreviewModal
          po={previewPO}
          dealerMap={dealerMap}
          catalogMap={catalogMap}
          onClose={() => setPreviewPO(null)}
          onEdit={() => { setEditPO(previewPO); setPreviewPO(null) }}
        />
      )}
      {deletePO && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#1A1A1A]">Delete Purchase Order</h2>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[#1A1A1A]">Delete PO from <span className="font-semibold">{deletePO.supplierName}</span>{deletePO.poNumber ? ` (${deletePO.poNumber})` : ''}? This cannot be undone.{deletePO.status !== 'Draft' ? ' Any already-received inventory items will remain in stock.' : ''}</p>
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
              <button onClick={() => setDeletePO(null)} disabled={deletingPO}
                className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">Cancel</button>
              <button onClick={async () => {
                setDeletingPO(true)
                await deleteDoc(doc(db, 'purchaseOrders', deletePO.id))
                setDeletePO(null); setDeletingPO(false)
              }} disabled={deletingPO}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#c44f4f] disabled:opacity-50">
                {deletingPO ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {migrating && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl px-8 py-6 shadow-xl text-center">
            <p className="font-semibold text-[#1A1A1A] mb-1">Migrating batch entries…</p>
            <p className="text-sm text-[#9A9A9A]">Converting to Purchase Orders. This only runs once.</p>
          </div>
        </div>
      )}
      {transferItem && isAdmin && (
        <TransferModal item={transferItem} dealers={dealers} onClose={() => setTransferItem(null)} />
      )}
      {editItem && (
        <EditItemModal item={editItem} dealers={dealers} isAdmin={isAdmin} onClose={() => setEditItem(null)} />
      )}
      {adjustItem && (
        <AdjustQtyModal item={adjustItem} profile={profile} onClose={() => setAdjustItem(null)} />
      )}
      {editTx && (
        <EditTxModal tx={editTx} saving={editTxSaving}
          onSave={async ({ sku, notes }) => {
            setEditTxSaving(true)
            try {
              await updateDoc(doc(db, 'inventoryTransactions', editTx.id), {
                sku: sku.trim() || null,
                notes: notes.trim() || null,
              })
              setEditTx(null)
            } finally {
              setEditTxSaving(false)
            }
          }}
          onClose={() => setEditTx(null)}
        />
      )}
      {showUnreceiveAll && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#D95F5F]">Un-Receive All POs</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[#1A1A1A] font-medium">This will reset every purchase order:</p>
              <ul className="text-sm text-[#9A9A9A] space-y-1 list-disc pl-4">
                <li>All <span className="font-semibold text-[#D95F5F]">{pos.length} POs</span> set back to <span className="font-semibold">Ordered</span></li>
                <li>All received quantities reset to <span className="font-semibold">0</span></li>
                <li>Inventory links cleared so each PO can be received fresh</li>
              </ul>
              <p className="text-sm text-[#9A9A9A]">Order lines, quantities ordered, and PO details are not changed. This cannot be undone.</p>
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
              <button onClick={() => setShowUnreceiveAll(false)} disabled={unreceiveAllBusy}
                className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleUnreceiveAll} disabled={unreceiveAllBusy}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2 text-sm font-semibold hover:bg-[#c44f4f] disabled:opacity-40 transition-colors">
                {unreceiveAllBusy ? 'Resetting POs…' : 'Un-Receive All POs'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showResetInvoiceDed && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#D95F5F]">Reset Invoice Deductions</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[#1A1A1A] font-medium">This will clear the deduction status on all invoices:</p>
              <ul className="text-sm text-[#9A9A9A] space-y-1 list-disc pl-4">
                <li>Every invoice flagged as <span className="font-semibold text-[#D95F5F]">Inventory Deducted</span> will be reset</li>
                <li>Inventory quantities are <span className="font-semibold text-[#1A1A1A]">not changed</span></li>
                <li>The deduction log details are cleared from each invoice</li>
              </ul>
              <p className="text-sm text-[#9A9A9A]">After this, each invoice will show the "Deduct Inventory" button again as if it was never run.</p>
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
              <button onClick={() => setShowResetInvoiceDed(false)} disabled={resetInvoiceDedBusy}
                className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleResetInvoiceDeductions} disabled={resetInvoiceDedBusy}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2 text-sm font-semibold hover:bg-[#c44f4f] disabled:opacity-40 transition-colors">
                {resetInvoiceDedBusy ? 'Clearing…' : 'Reset All Invoice Deductions'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showFullReset && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#D95F5F]">Full Inventory Reset</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[#1A1A1A] font-medium">This will permanently delete:</p>
              <ul className="text-sm text-[#9A9A9A] space-y-1 list-disc pl-4">
                <li>All <span className="font-semibold text-[#D95F5F]">{items.length} inventory records</span></li>
                <li>The entire <span className="font-semibold text-[#D95F5F]">transaction log</span></li>
              </ul>
              <p className="text-sm text-[#9A9A9A]">
                Purchase orders, invoices, quotes, and orders are <span className="font-semibold text-[#1A1A1A]">not affected</span>. You can re-receive stock against existing POs after the reset.
              </p>
              <p className="text-sm text-[#9A9A9A]">This cannot be undone. Type <span className="font-mono font-bold text-[#D95F5F]">RESET</span> to confirm.</p>
              <input
                value={fullResetConfirm}
                onChange={(e) => setFullResetConfirm(e.target.value)}
                placeholder="Type RESET to confirm"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D95F5F] font-mono"
                autoFocus
              />
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
              <button onClick={() => { setShowFullReset(false); setFullResetConfirm('') }} disabled={fullResetBusy}
                className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleFullReset} disabled={fullResetBusy || fullResetConfirm !== 'RESET'}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2 text-sm font-semibold hover:bg-[#c44f4f] disabled:opacity-40 transition-colors">
                {fullResetBusy ? 'Resetting…' : 'Reset Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showShortfallCleanup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#1A1A1A]">Remove Shortfall Records</h2>
            </div>
            <div className="px-5 py-4 space-y-2">
              <p className="text-sm text-[#1A1A1A]">
                This will permanently delete <span className="font-semibold text-[#D95F5F]">{shortfallItems.length} auto-created shortfall record{shortfallItems.length !== 1 ? 's' : ''}</span>.
              </p>
              <p className="text-sm text-[#9A9A9A]">
                These are phantom entries created when an invoice deduction couldn't find a matching inventory item. They appear as negative rows in the Summary tab and are safe to remove. Your real inventory records are not affected.
              </p>
              <p className="text-sm text-[#9A9A9A]">This cannot be undone.</p>
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
              <button onClick={() => setShowShortfallCleanup(false)} disabled={shortfallCleanupBusy}
                className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleShortfallCleanup} disabled={shortfallCleanupBusy}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#c44f4f] disabled:opacity-50">
                {shortfallCleanupBusy ? 'Removing…' : 'Remove Shortfalls'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCleanup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#1A1A1A]">Clean Up Inventory</h2>
            </div>
            <div className="px-5 py-4 space-y-2">
              <p className="text-sm text-[#1A1A1A]">This will permanently delete:</p>
              <ul className="text-sm text-[#9A9A9A] space-y-1 list-disc pl-4">
                <li><span className="font-semibold text-[#D95F5F]">{items.filter((i) => !i.poId).length} inventory records</span> not linked to a Purchase Order</li>
                <li>All <span className="font-semibold text-[#D95F5F]">{transactions.length} transaction log entries</span></li>
              </ul>
              <p className="text-sm text-[#9A9A9A]">
                Inventory received against your existing PO will be kept. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
              <button onClick={() => setShowCleanup(false)} disabled={cleanupBusy}
                className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleCleanupInventory} disabled={cleanupBusy}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#c44f4f] disabled:opacity-50">
                {cleanupBusy ? 'Cleaning…' : 'Delete & Clean Up'}
              </button>
            </div>
          </div>
        </div>
      )}
      {deletingTx && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-[#1A1A1A]">Delete Transaction</h2>
            </div>
            <div className="px-5 py-4 space-y-2">
              <p className="text-sm text-[#1A1A1A]">
                Delete this transaction for <span className="font-semibold">{deletingTx.modelName}</span>?
              </p>
              {deletingTx.inventoryId && (
                <p className="text-sm text-[#9A9A9A]">
                  This will also reverse the inventory change:
                  {' '}<span className={`font-semibold ${-(deletingTx.qty ?? 0) > 0 ? 'text-[#4CAF7D]' : 'text-[#D95F5F]'}`}>
                    {-(deletingTx.qty ?? 0) > 0 ? '+' : ''}{-(deletingTx.qty ?? 0)} units
                  </span>
                  {' '}will be applied to the inventory record.
                </p>
              )}
            </div>
            <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
              <button onClick={() => setDeletingTx(null)} disabled={deletingTxBusy}
                className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDeleteTx} disabled={deletingTxBusy}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#c44f4f] disabled:opacity-50">
                {deletingTxBusy ? 'Deleting…' : 'Delete & Reverse'}
              </button>
            </div>
          </div>
        </div>
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
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={() => setShowUnreceiveAll(true)}
              className="border border-[#D95F5F] text-[#D95F5F] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#D95F5F]/5 transition-colors">
              Un-Receive All POs
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowResetInvoiceDed(true)}
              className="border border-[#D95F5F] text-[#D95F5F] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#D95F5F]/5 transition-colors">
              Reset Invoice Deductions
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowFullReset(true)}
              className="border border-[#D95F5F] text-[#D95F5F] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#D95F5F]/5 transition-colors">
              Reset Inventory
            </button>
          )}
          <button onClick={() => setShowAdd(true)}
            className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
            + Add Stock
          </button>
        </div>
      </div>
      {unreceiveAllDone && (
        <div className="mb-4 bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 rounded-lg px-4 py-3 text-sm text-[#4CAF7D] font-medium">
          ✓ All POs reset to Ordered. You can now receive them fresh against the Purchase Orders tab.
        </div>
      )}
      {resetInvoiceDedDone && (
        <div className="mb-4 bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 rounded-lg px-4 py-3 text-sm text-[#4CAF7D] font-medium">
          ✓ Invoice deductions cleared. All invoices can now be re-deducted fresh.
        </div>
      )}
      {fullResetDone && (
        <div className="mb-4 bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 rounded-lg px-4 py-3 text-sm text-[#4CAF7D] font-medium">
          ✓ Inventory reset complete. Receive stock against your existing POs to rebuild.
        </div>
      )}

      {/* One-time cleanup banner */}
      {isAdmin && !cleanupDone && items.filter((i) => !i.poId).length > 0 && (
        <div className="mb-4 bg-[#E6A817]/10 border border-[#E6A817]/30 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-[#E6A817] font-medium">
            {items.filter((i) => !i.poId).length} inventory items are not linked to a Purchase Order.
            Click to remove them and keep only PO-received stock.
          </p>
          <button onClick={() => setShowCleanup(true)}
            className="shrink-0 bg-[#E6A817] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#d4960e] transition-colors">
            Clean Up Now
          </button>
        </div>
      )}
      {cleanupDone && (
        <div className="mb-4 bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 rounded-lg px-4 py-3 text-sm text-[#4CAF7D] font-medium">
          ✓ Cleanup complete — only PO-linked inventory remains.
        </div>
      )}
      {isAdmin && !shortfallCleanupDone && shortfallItems.length > 0 && (
        <div className="mb-4 bg-[#D95F5F]/10 border border-[#D95F5F]/30 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-sm text-[#D95F5F] font-medium">
            {shortfallItems.length} phantom shortfall record{shortfallItems.length !== 1 ? 's' : ''} detected — created when invoice deductions couldn't match an inventory item by SKU. These appear as extra rows in the Summary and can be safely removed.
          </p>
          <button onClick={() => setShowShortfallCleanup(true)}
            className="shrink-0 bg-[#D95F5F] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#c44f4f] transition-colors whitespace-nowrap">
            Remove Now
          </button>
        </div>
      )}
      {shortfallCleanupDone && (
        <div className="mb-4 bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 rounded-lg px-4 py-3 text-sm text-[#4CAF7D] font-medium">
          ✓ Shortfall records removed.
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'In Stock', value: totalUnits, color: 'text-[#1A1A1A]' },
          { label: 'On Order', value: onOrderUnits, color: onOrderUnits > 0 ? 'text-[#4A90B8]' : 'text-[#9A9A9A]' },
          { label: 'Available', value: totalAvailable, color: 'text-[#4CAF7D]' },
          { label: 'Low Stock', value: lowStockCount, color: 'text-[#E6A817]' },
          { label: 'Out of Stock', value: outOfStockCount, color: 'text-[#D95F5F]' },
          { label: 'Negative Stock', value: negativeStockCount, color: negativeStockCount > 0 ? 'text-[#D95F5F]' : 'text-[#9A9A9A]' },
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
        <>
        {/* Summary filters */}
        <div className="flex flex-wrap gap-3 mb-3">
          {/* Multi-select brand picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSummaryBrandOpen((o) => !o)}
              onBlur={() => setTimeout(() => setSummaryBrandOpen(false), 150)}
              className={`${inputCls} flex items-center gap-2 min-w-[160px] text-left`}>
              <span className="flex-1 truncate">
                {summaryFilterBrands.size === 0
                  ? 'All Brands'
                  : summaryFilterBrands.size === 1
                    ? [...summaryFilterBrands][0]
                    : `${[...summaryFilterBrands].slice(0, 2).join(', ')}${summaryFilterBrands.size > 2 ? ` +${summaryFilterBrands.size - 2}` : ''}`}
              </span>
              {summaryFilterBrands.size > 0 && (
                <span className="shrink-0 text-[10px] font-bold bg-[#8B6914] text-white px-1.5 py-0.5 rounded-full leading-none">
                  {summaryFilterBrands.size}
                </span>
              )}
              <span className="shrink-0 text-[#9A9A9A] text-xs">▾</span>
            </button>
            {summaryBrandOpen && (
              <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg min-w-[200px] max-h-64 overflow-y-auto py-1">
                {summaryBrands.map((b) => (
                  <label key={b} className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#F4F4F5] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={summaryFilterBrands.has(b)}
                      onChange={() => setSummaryFilterBrands((prev) => {
                        const next = new Set(prev)
                        next.has(b) ? next.delete(b) : next.add(b)
                        return next
                      })}
                      className="w-4 h-4 rounded border-gray-300 text-[#8B6914] cursor-pointer"
                    />
                    <span className="text-sm text-[#1A1A1A]">{b}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <select value={summaryFilterCategory} onChange={(e) => setSummaryFilterCategory(e.target.value)} className={inputCls}>
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {(summaryFilterBrands.size > 0 || summaryFilterCategory) && (
            <button onClick={() => { setSummaryFilterBrands(new Set()); setSummaryFilterCategory('') }}
              className="text-xs text-[#9A9A9A] hover:text-[#1A1A1A] border border-gray-200 px-3 py-2 rounded-lg transition-colors">
              Clear filters
            </button>
          )}
          <span className="text-xs text-[#9A9A9A] self-center ml-auto">
            {visibleSummary.length} group{visibleSummary.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm hidden md:table" style={{ minWidth: 900 }}>
            <thead>
              <tr className="border-b border-gray-100 bg-[#F4F4F5]">
                {[
                  ['Item', 'modelName'], ['Model / SKU', 'sku'], ['Drone Model', 'droneModels'], ['Brand', 'brand'], ['Category', 'category'], ['Condition', 'condition'],
                  ['MSRP / Unit', 'msrp'], ['Rep Price / Unit', 'repPrice'],
                  ...(isAdmin ? [['Avg Cost', 'avgCost'], ['Total Value', 'totalValue']] : []),
                  ['Total On Hand', 'totalOnHand'], ['Total On-Order', 'totalOnOrder'],
                  ['Total Reserved', 'totalReserved'], ['Total Available', 'totalAvail'],
                ].map(([label, key]) => (
                  <SortTh key={label} label={label} sortKey={key} sort={summarySort} onSort={toggleSort(setSummarySort)} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={isAdmin ? 10 : 8} />)
              ) : visibleSummary.length === 0 ? (
                <tr><td colSpan={isAdmin ? 14 : 12} className="py-12 text-center text-[#9A9A9A] text-sm">No items match the current filters.</td></tr>
              ) : visibleSummary.map((g, i) => {
                const totalAvail = g.totalOnHand - g.totalReserved
                const isNeg = g.totalOnHand < 0
                return (
                  <tr key={i} className={`transition-colors ${isNeg ? 'bg-[#D95F5F]/5 hover:bg-[#D95F5F]/10 border-l-2 border-[#D95F5F]' : 'hover:bg-[#FAFAFA]'}`}>
                    <td className="py-2 px-3 font-medium text-[#1A1A1A]">{g.modelName}</td>
                    <td className="py-2 px-3 font-mono text-xs text-[#9A9A9A]">{g.sku || '—'}</td>
                    <td className="py-2 px-3 text-[#9A9A9A] text-xs">
                      {g.droneModels.length > 0 ? g.droneModels.join(', ') : '—'}
                    </td>
                    <td className="py-2 px-3 text-[#9A9A9A]">{g.brand || '—'}</td>
                    <td className="py-2 px-3 text-[#9A9A9A]">{g.category || '—'}</td>
                    <td className="py-2 px-3">
                      {g.condition
                        ? <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conditionColor[g.condition] ?? 'bg-gray-100 text-gray-600'}`}>{g.condition}</span>
                        : '—'}
                    </td>
                    <td className="py-2 px-3 text-[#9A9A9A]">{g.msrp != null ? formatCurrency(g.msrp) : '—'}</td>
                    <td className="py-2 px-3 font-medium text-[#4CAF7D]">{g.repPrice != null ? formatCurrency(g.repPrice) : '—'}</td>
                    {isAdmin && <td className="py-2 px-3 text-[#9A9A9A]">{g.avgCost != null ? formatCurrency(g.avgCost) : '—'}</td>}
                    {isAdmin && <td className="py-2 px-3 font-medium text-[#8B6914]">{g.totalValue != null ? formatCurrency(g.totalValue) : '—'}</td>}
                    <td className={`py-2 px-3 text-center font-semibold ${isNeg ? 'text-[#D95F5F]' : 'text-[#1A1A1A]'}`}>
                      {g.totalOnHand}
                      {isNeg && <span className="ml-1 text-[9px] font-bold bg-[#D95F5F]/20 text-[#D95F5F] px-1 py-0.5 rounded">NEG</span>}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {g.totalOnOrder > 0
                        ? <span className="text-xs font-semibold text-[#4A90B8]">{g.totalOnOrder}</span>
                        : <span className="text-xs text-[#9A9A9A]">—</span>}
                    </td>
                    <td className="py-2 px-3 text-center text-[#9A9A9A]">{g.totalReserved}</td>
                    <td className="py-2 px-3 text-center">
                      <AvailBadge available={totalAvail} threshold={null} />
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
            ) : visibleSummary.length === 0 ? (
              <div className="text-center py-12 text-[#9A9A9A] text-sm">No items match the current filters.</div>
            ) : visibleSummary.map((g, i) => {
              const totalAvail = g.totalOnHand - g.totalReserved
              return (
                <div key={i} className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-[#1A1A1A]">{g.modelName}</p>
                      {g.sku && <p className="text-xs font-mono text-[#9A9A9A]">{g.sku}</p>}
                      {g.droneModels.length > 0 && <p className="text-xs text-[#9A9A9A]">{g.droneModels.join(', ')}</p>}
                      {g.brand && <p className="text-xs text-[#9A9A9A]">{g.brand}</p>}
                    </div>
                    {g.condition && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conditionColor[g.condition] ?? 'bg-gray-100 text-gray-600'}`}>{g.condition}</span>}
                  </div>
                  {(g.msrp != null || g.repPrice != null) && (
                    <div className="flex gap-4 text-xs mb-2">
                      {g.msrp != null && <span className="text-[#9A9A9A]">MSRP/unit: <span className="font-medium text-[#1A1A1A]">{formatCurrency(g.msrp)}</span></span>}
                      {g.repPrice != null && <span className="text-[#9A9A9A]">Rep Price/unit: <span className="font-medium text-[#4CAF7D]">{formatCurrency(g.repPrice)}</span></span>}
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-[#F4F4F5] rounded-lg py-1.5">
                      <p className="text-xs text-[#9A9A9A]">On Hand</p>
                      <p className="font-bold text-[#1A1A1A]">{g.totalOnHand}</p>
                    </div>
                    <div className="bg-[#F4F4F5] rounded-lg py-1.5">
                      <p className="text-xs text-[#9A9A9A]">On Order</p>
                      <p className={`font-bold ${g.totalOnOrder > 0 ? 'text-[#4A90B8]' : 'text-[#9A9A9A]'}`}>{g.totalOnOrder > 0 ? g.totalOnOrder : '—'}</p>
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
                </div>
              )
            })}
          </div>
        </div>
        </>
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
              <div key={locName} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-x-auto">
                <div className="flex items-center justify-between px-4 py-3 bg-[#F4F4F5] border-b border-gray-100">
                  <div>
                    <p className="font-semibold text-[#1A1A1A]">{locName}</p>
                    <p className="text-xs text-[#9A9A9A]">{locItems.length} entr{locItems.length !== 1 ? 'ies' : 'y'} · {locTotalUnits} total units</p>
                  </div>
                  {locOutCount > 0 && (
                    <span className="text-xs font-semibold bg-[#D95F5F]/15 text-[#D95F5F] px-2 py-0.5 rounded-full">{locOutCount} out</span>
                  )}
                </div>
                <table className="w-full text-sm hidden md:table" style={{ minWidth: 900 }}>
                  <thead>
                    <tr className="border-b border-gray-50">
                      {[
                        ['Model', 'modelName'], ['Brand', 'brand'], ['Category', 'category'], ['SKU / Serial', 'sku'], ['Condition', 'condition'],
                        ['MSRP / Unit', 'msrp'], ['Rep Price / Unit', 'dealerPrice'],
                        ['On Hand', 'quantityOnHand'], ['Reserved', 'quantityReserved'], ['Available', 'available'],
                        ...(isAdmin ? [['CRK Cost / Unit', 'costPrice'], ['', '']] : []),
                      ].map(([label, key]) => key
                        ? <SortTh key={label} label={label} sortKey={key} sort={locationSort} onSort={toggleSort(setLocationSort)} className="py-2" />
                        : <th key={`empty-${label}`} className="py-2 px-3" />
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortLocItems(locItems).map((item) => {
                      const available = (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0)
                      return (
                        <tr key={item.id} className={`${(item.quantityOnHand ?? 0) < 0 ? 'bg-[#D95F5F]/5 hover:bg-[#D95F5F]/10 border-l-2 border-[#D95F5F]' : 'hover:bg-[#FAFAFA]'}`}>
                          <td className="py-2 px-3 font-medium text-[#1A1A1A]">{item.modelName}</td>
                          <td className="py-2 px-3 text-[#9A9A9A]">{item.brand || '—'}</td>
                          <td className="py-2 px-3 text-[#9A9A9A]">{item.category || '—'}</td>
                          <td className="py-2 px-3">
                            <p className="text-[#1A1A1A]">{item.sku || '—'}</p>
                            {item.serialNumber && <p className="text-xs text-[#9A9A9A]">#{item.serialNumber}</p>}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conditionColor[item.condition] ?? 'bg-gray-100 text-gray-600'}`}>
                              {item.condition ?? '—'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#9A9A9A]">{item.msrp != null ? formatCurrency(item.msrp) : '—'}</td>
                          <td className="py-2 px-3 font-medium text-[#4CAF7D]">{item.msrp != null ? formatCurrency(getDealerPrice(item, dealerProfileMap[item.dealerId])) : '—'}</td>
                          <td className={`py-2 px-3 text-center font-semibold ${(item.quantityOnHand ?? 0) < 0 ? 'text-[#D95F5F]' : 'text-[#1A1A1A]'}`}>
                            {item.quantityOnHand ?? 0}
                            {(item.quantityOnHand ?? 0) < 0 && <span className="ml-1 text-[9px] font-bold bg-[#D95F5F]/20 text-[#D95F5F] px-1 py-0.5 rounded">NEG</span>}
                          </td>
                          <td className="py-2 px-3 text-center text-[#9A9A9A]">{item.quantityReserved ?? 0}</td>
                          <td className="py-2 px-3 text-center">
                            {item.inventoryStatus === 'on_order'
                              ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#4A90B8]/15 text-[#4A90B8]">On Order</span>
                              : <AvailBadge available={available} threshold={item.lowStockThreshold} />}
                          </td>
                          {isAdmin && <td className="py-2 px-3 text-[#9A9A9A]">{item.costPrice != null ? formatCurrency(item.costPrice) : '—'}</td>}
                          {isAdmin && (
                            <td className="py-2 px-3">
                              <div className="flex gap-3">
                                <button onClick={() => setAdjustItem(item)} className="text-xs text-[#8B6914] hover:underline font-medium">Adjust</button>
                                <button onClick={() => setTransferItem(item)} className="text-xs text-[#8B6914] hover:underline font-medium">Transfer</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="md:hidden divide-y divide-gray-50">
                  {sortLocItems(locItems).map((item) => {
                    const available = (item.quantityOnHand ?? 0) - (item.quantityReserved ?? 0)
                    return (
                      <div key={item.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${(item.quantityOnHand ?? 0) < 0 ? 'bg-[#D95F5F]/5 border-l-2 border-[#D95F5F]' : ''}`}>
                        <div className="min-w-0">
                          <p className="font-medium text-[#1A1A1A] truncate">{item.modelName}</p>
                          {item.brand && <p className="text-xs text-[#9A9A9A]">{item.brand}</p>}
                          <p className="text-xs text-[#9A9A9A]">{item.sku || 'No SKU'} · {item.condition}</p>
                          <div className="flex gap-3 text-xs mt-0.5">
                            {item.msrp != null && <span className="text-[#9A9A9A]">MSRP: {formatCurrency(item.msrp)}</span>}
                            {item.msrp != null && <span className="text-[#4CAF7D] font-medium">Rep: {formatCurrency(getDealerPrice(item, dealerProfileMap[item.dealerId]))}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm font-semibold ${(item.quantityOnHand ?? 0) < 0 ? 'text-[#D95F5F]' : 'text-[#1A1A1A]'}`}>
                            {item.quantityOnHand ?? 0}{(item.quantityOnHand ?? 0) < 0 ? ' ⚠' : ''}
                          </span>
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

      {/* ── PURCHASE ORDERS TAB ── */}
      {activeTab === 'purchaseOrders' && (isAdmin || isWarehouseManager) && (() => {
        const openPos = pos.filter((p) => p.status !== 'Fully Received' && p.status !== 'Cancelled')
        const outstandingUnits = openPos.reduce((sum, p) =>
          sum + (p.items ?? []).filter((i) => !i.cancelled).reduce((s, i) =>
            s + Math.max(0, i.orderedQty - (i.receivedQty ?? 0)), 0), 0)
        const outstandingValue = openPos.reduce((sum, p) =>
          sum + (p.items ?? []).filter((i) => !i.cancelled).reduce((s, i) =>
            s + Math.max(0, i.orderedQty - (i.receivedQty ?? 0)) * (i.costPrice ?? 0), 0), 0)
        const overdueCount = openPos.filter((p) =>
          p.expectedDelivery && new Date(p.expectedDelivery) < new Date() &&
          ['Ordered', 'Partially Received'].includes(p.status)
        ).length
        return (
        <div>
          {posError && (
            <div className="mb-4 bg-[#D95F5F]/10 border border-[#D95F5F]/30 rounded-lg px-4 py-3 text-sm text-[#D95F5F]">
              Error loading purchase orders: {posError}. Try refreshing the page.
            </div>
          )}
          {/* PO KPI Strip */}
          {!posLoading && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Open POs', value: openPos.length, color: 'text-[#1A1A1A]', border: '' },
                { label: 'Outstanding Units', value: outstandingUnits, color: outstandingUnits > 0 ? 'text-[#E6A817]' : 'text-[#1A1A1A]', border: outstandingUnits > 0 ? 'border-[#E6A817]' : '' },
                { label: 'Outstanding Value', value: '$' + outstandingValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), color: outstandingValue > 0 ? 'text-[#8B6914]' : 'text-[#1A1A1A]', border: '' },
                { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'text-[#D95F5F]' : 'text-[#9A9A9A]', border: overdueCount > 0 ? 'border-[#D95F5F]' : '' },
              ].map((k) => (
                <div key={k.label} className={`bg-white border rounded-xl p-4 shadow-sm ${k.border || 'border-gray-100'}`}>
                  <p className="text-xs text-[#9A9A9A] font-semibold uppercase tracking-wider mb-1">{k.label}</p>
                  <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#9A9A9A]">
              {posLoading ? 'Loading…' : `${pos.length} purchase order${pos.length !== 1 ? 's' : ''}`}
            </p>
            <button onClick={() => setShowPO(true)}
              className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
              + New Purchase Order
            </button>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 900 }}>
              <thead>
                <tr className="border-b border-gray-100 bg-[#F4F4F5]">
                  {['Supplier / Vendor', 'PO #', 'Order Date', 'Exp. Delivery', 'Location', 'Items', 'Status', 'Outstanding', 'Freight', 'Created By', ''].map((h) => (
                    <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {posLoading ? (
                  Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={10} />)
                ) : pos.length === 0 ? (
                  <tr><td colSpan={10} className="py-12 text-center text-[#9A9A9A] text-sm">No purchase orders yet. Click "+ New Purchase Order" to get started.</td></tr>
                ) : pos.map((p) => {
                  const outstanding = (p.items ?? []).filter((i) => !i.cancelled && (i.receivedQty ?? 0) < i.orderedQty).length
                  const statusColor = {
                    Draft: 'bg-gray-100 text-gray-500',
                    Ordered: 'bg-[#4A90B8]/15 text-[#4A90B8]',
                    'Partially Received': 'bg-[#E6A817]/15 text-[#E6A817]',
                    'Fully Received': 'bg-[#4CAF7D]/15 text-[#4CAF7D]',
                  }[p.status] ?? 'bg-gray-100 text-gray-500'
                  const canReceive = ['Ordered', 'Partially Received'].includes(p.status)
                  const canEdit = true
                  return (
                    <tr key={p.id} onClick={() => setPreviewPO(p)} className="hover:bg-[#FAFAFA] transition-colors cursor-pointer">
                      <td className="py-2 px-3 font-medium text-[#1A1A1A]">{p.supplierName}</td>
                      <td className="py-2 px-3 text-[#9A9A9A]">{p.poNumber || '—'}</td>
                      <td className="py-2 px-3 text-[#9A9A9A] whitespace-nowrap">{p.orderDate || '—'}</td>
                      <td className="py-2 px-3 text-[#9A9A9A] whitespace-nowrap">{p.expectedDelivery || '—'}</td>
                      <td className="py-2 px-3 text-[#9A9A9A]">{dealerMap[p.dealerId] || '—'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="text-xs font-semibold bg-[#8B6914]/10 text-[#8B6914] px-2 py-0.5 rounded-full">
                          {(p.items ?? []).length}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusColor}`}>{p.status}</span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {outstanding > 0
                          ? <span className="text-xs font-semibold text-[#E6A817]">{outstanding} item{outstanding !== 1 ? 's' : ''}</span>
                          : <span className="text-xs text-[#4CAF7D]">—</span>}
                      </td>
                      <td className="py-2 px-3 text-[#9A9A9A] whitespace-nowrap">
                        {p.freightCost != null ? formatCurrency(p.freightCost) : '—'}
                      </td>
                      <td className="py-2 px-3 text-[#9A9A9A]">{p.createdBy || '—'}</td>
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          {canReceive && (
                            <button onClick={() => setReceivePO(p)} className="text-xs font-semibold text-[#4CAF7D] hover:underline">Receive</button>
                          )}
                          {p.status === 'Fully Received' && (
                            <button onClick={() => setEditReceptionPO(p)} className="text-xs font-semibold text-[#4A90B8] hover:underline">Edit Reception</button>
                          )}
                          {canEdit && (
                            <button onClick={() => setEditPO(p)} className="text-xs text-[#8B6914] hover:underline font-medium">Edit</button>
                          )}
                          <button onClick={() => setDeletePO(p)} className="text-xs text-[#D95F5F] hover:underline font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {posLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2" /><div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              ))
            ) : pos.length === 0 ? (
              <div className="text-center py-12 text-[#9A9A9A] text-sm">No purchase orders yet.</div>
            ) : pos.map((p) => {
              const outstanding = (p.items ?? []).filter((i) => !i.cancelled && (i.receivedQty ?? 0) < i.orderedQty).length
              const statusColor = {
                Draft: 'bg-gray-100 text-gray-500',
                Ordered: 'bg-[#4A90B8]/15 text-[#4A90B8]',
                'Partially Received': 'bg-[#E6A817]/15 text-[#E6A817]',
                'Fully Received': 'bg-[#4CAF7D]/15 text-[#4CAF7D]',
              }[p.status] ?? 'bg-gray-100 text-gray-500'
              return (
                <div key={p.id} onClick={() => setPreviewPO(p)} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm cursor-pointer hover:border-[#8B6914]/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-[#1A1A1A]">{p.supplierName}</p>
                      {p.poNumber && <p className="text-xs text-[#9A9A9A]">PO: {p.poNumber}</p>}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${statusColor}`}>{p.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#9A9A9A] mb-3">
                    {p.orderDate && <span>Ordered: {p.orderDate}</span>}
                    {p.expectedDelivery && <span>Expected: {p.expectedDelivery}</span>}
                    <span>Location: {dealerMap[p.dealerId] || '—'}</span>
                    <span>{(p.items ?? []).length} items</span>
                    {p.freightCost != null && <span>Freight: {formatCurrency(p.freightCost)}</span>}
                    {outstanding > 0 && <span className="text-[#E6A817] font-medium">{outstanding} outstanding</span>}
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {['Ordered', 'Partially Received'].includes(p.status) && (
                      <button onClick={() => setReceivePO(p)}
                        className="flex-1 text-sm border border-[#4CAF7D] text-[#4CAF7D] rounded-lg py-1.5 hover:bg-[#4CAF7D]/5 transition-colors font-medium">
                        Receive
                      </button>
                    )}
                    {p.status === 'Fully Received' && (
                      <button onClick={() => setEditReceptionPO(p)}
                        className="flex-1 text-sm border border-[#4A90B8] text-[#4A90B8] rounded-lg py-1.5 hover:bg-[#4A90B8]/5 transition-colors font-medium">
                        Edit Reception
                      </button>
                    )}
                    <button onClick={() => setEditPO(p)}
                      className="flex-1 text-sm border border-[#8B6914] text-[#8B6914] rounded-lg py-1.5 hover:bg-[#8B6914]/5 transition-colors">
                      Edit
                    </button>
                    <button onClick={() => setDeletePO(p)}
                      className="flex-1 text-sm border border-[#D95F5F] text-[#D95F5F] rounded-lg py-1.5 hover:bg-[#D95F5F]/5 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )
      })()}

      {/* ── LOG TAB (movement history) ── */}
      {activeTab === 'log' && (isAdmin || isWarehouseManager) && (() => {
        const TX_COLORS = {
          add_stock:      { bg: 'bg-[#4A90B8]/15', text: 'text-[#4A90B8]',  label: 'Add Stock' },
          po_ordered:     { bg: 'bg-[#4A90B8]/15', text: 'text-[#4A90B8]',  label: 'PO Ordered' },
          po_receipt:     { bg: 'bg-[#4CAF7D]/15', text: 'text-[#4CAF7D]',  label: 'PO Receipt' },
          po_adjustment:  { bg: 'bg-[#4A90B8]/15', text: 'text-[#4A90B8]',  label: 'PO Adjustment' },
          deduction:      { bg: 'bg-[#D95F5F]/15', text: 'text-[#D95F5F]',  label: 'Deduction' },
          reversal:       { bg: 'bg-[#9B59B6]/15', text: 'text-[#9B59B6]',  label: 'Reversal' },
          adjustment:     { bg: 'bg-[#E6A817]/15', text: 'text-[#E6A817]',  label: 'Adjustment' },
          transfer:       { bg: 'bg-gray-100',      text: 'text-gray-600',   label: 'Transfer' },
          cancellation:   { bg: 'bg-gray-100',      text: 'text-gray-500',   label: 'Cancelled' },
        }
        return (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-[#9A9A9A]">
                {txLoading ? 'Loading…' : `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} (latest 500)`}
              </p>
            </div>
            <div className="hidden md:block bg-white border border-gray-100 rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 900 }}>
                <thead>
                  <tr className="border-b border-gray-100 bg-[#F4F4F5]">
                    {['Date', 'Type', 'Model', 'Brand / SKU', 'Qty', 'From', 'To', 'Source', 'By', 'Notes', ''].map((h) => (
                      <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {txLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={10} />)
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan={10} className="py-12 text-center text-[#9A9A9A] text-sm">
                      No transactions yet. They are recorded as you add stock, receive POs, and deduct inventory.
                    </td></tr>
                  ) : transactions.map((tx) => {
                    const c = TX_COLORS[tx.type] ?? TX_COLORS.adjustment
                    const isNeg = (tx.qty ?? 0) < 0
                    const date = tx.createdAt?.toDate ? tx.createdAt.toDate() : null
                    const dateStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
                    return (
                      <tr key={tx.id} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-2 px-3 text-[#9A9A9A] whitespace-nowrap text-xs">{dateStr}</td>
                        <td className="py-2 px-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${c.bg} ${c.text}`}>{c.label}</span>
                        </td>
                        <td className="py-2 px-3 font-medium text-[#1A1A1A]">{tx.modelName || '—'}</td>
                        <td className="py-2 px-3 text-[#9A9A9A]">
                          <p>{tx.brand || '—'}</p>
                          {tx.sku && <p className="text-xs">{tx.sku}</p>}
                        </td>
                        <td className={`py-2 px-3 font-bold tabular-nums ${isNeg ? 'text-[#D95F5F]' : 'text-[#4CAF7D]'}`}>
                          {(tx.qty ?? 0) > 0 ? `+${tx.qty}` : tx.qty}
                        </td>
                        <td className="py-2 px-3 text-[#9A9A9A] text-xs whitespace-nowrap">{tx.fromLocation || dealerMap[tx.dealerId] || '—'}</td>
                        <td className="py-2 px-3 text-[#9A9A9A] text-xs whitespace-nowrap">{tx.toLocation || '—'}</td>
                        <td className="py-2 px-3 text-[#9A9A9A] whitespace-nowrap">
                          {tx.sourceNumber ? (
                            <span className="text-xs">{tx.sourceNumber}</span>
                          ) : tx.sourceType ? (
                            <span className="text-xs capitalize">{tx.sourceType.replace(/_/g, ' ')}</span>
                          ) : '—'}
                        </td>
                        <td className="py-2 px-3 text-[#9A9A9A]">{tx.createdBy || '—'}</td>
                        <td className="py-2 px-3 text-[#9A9A9A] text-xs max-w-[160px] truncate">{tx.notes || '—'}</td>
                        <td className="py-2 px-3">
                          <div className="flex gap-3">
                            <button onClick={() => setEditTx(tx)} className="text-xs text-[#8B6914] hover:underline font-medium">Edit</button>
                            <button onClick={() => setDeletingTx(tx)} className="text-xs text-[#D95F5F] hover:underline font-medium">Delete</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile tx cards */}
            <div className="md:hidden space-y-2">
              {txLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" /><div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                ))
              ) : transactions.map((tx) => {
                const c = TX_COLORS[tx.type] ?? TX_COLORS.adjustment
                const isNeg = (tx.qty ?? 0) < 0
                const date = tx.createdAt?.toDate ? tx.createdAt.toDate() : null
                const dateStr = date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
                return (
                  <div key={tx.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <p className="font-semibold text-[#1A1A1A]">{tx.modelName || '—'}</p>
                        {tx.brand && <p className="text-xs text-[#9A9A9A]">{tx.brand}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-bold tabular-nums ${isNeg ? 'text-[#D95F5F]' : 'text-[#4CAF7D]'}`}>
                          {(tx.qty ?? 0) > 0 ? `+${tx.qty}` : tx.qty}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center text-xs text-[#9A9A9A]">
                      <span className={`font-semibold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{c.label}</span>
                      <span>{dateStr}</span>
                      {tx.sourceNumber && <span>{tx.sourceNumber}</span>}
                      <span>{dealerMap[tx.dealerId] || '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Mobile FAB */}
      <button onClick={() => setShowAdd(true)}
        className="fixed bottom-6 right-6 z-40 md:hidden w-14 h-14 bg-[#8B6914] text-white rounded-full shadow-lg text-2xl flex items-center justify-center hover:bg-[#7a5c12] transition-colors">
        +
      </button>
    </div>
  )
}
