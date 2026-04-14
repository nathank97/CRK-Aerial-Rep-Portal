import { useState, useMemo } from 'react'
import { addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { useCatalog } from '../../hooks/useCatalog'
import { catalogCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { formatCurrency } from '../../utils/formatters'

const ITEM_TYPES = ['Drone', 'Part', 'Accessory', 'Service', 'Other']

const typeColor = {
  Drone: 'bg-[#8B6914]/10 text-[#8B6914]',
  Part: 'bg-[#4A90B8]/10 text-[#4A90B8]',
  Accessory: 'bg-[#4CAF7D]/10 text-[#4CAF7D]',
  Service: 'bg-[#9B59B6]/10 text-[#9B59B6]',
  Other: 'bg-gray-100 text-gray-500',
}

const EMPTY_FORM = {
  name: '',
  type: 'Drone',
  sku: '',
  msrp: '',
  cost: '',
  description: '',
  manufacturer: '',
  imageUrl: '',
  notes: '',
  active: true,
}

// ─── Item Form Modal ─────────────────────────────────────────────────────────

function ItemModal({ item, onClose }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState(isEdit ? {
    name: item.name ?? '',
    type: item.type ?? 'Drone',
    sku: item.sku ?? '',
    msrp: item.msrp ?? '',
    cost: item.cost ?? '',
    description: item.description ?? '',
    manufacturer: item.manufacturer ?? '',
    imageUrl: item.imageUrl ?? '',
    notes: item.notes ?? '',
    active: item.active !== false,
  } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (form.msrp === '' || isNaN(parseFloat(form.msrp))) { setError('MSRP is required.'); return }
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        type: form.type,
        sku: form.sku.trim(),
        msrp: parseFloat(form.msrp),
        cost: form.cost !== '' ? parseFloat(form.cost) : null,
        description: form.description.trim(),
        manufacturer: form.manufacturer.trim(),
        imageUrl: form.imageUrl.trim(),
        notes: form.notes.trim(),
        active: form.active,
        updatedAt: serverTimestamp(),
      }
      if (isEdit) {
        await updateDoc(doc(db, 'catalog', item.id), data)
      } else {
        await addDoc(catalogCol, { ...data, createdAt: serverTimestamp() })
      }
      onClose()
    } catch (e) {
      console.error(e)
      setError('Save failed. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-[#1A1A1A]">{isEdit ? 'Edit Item' : 'New Catalog Item'}</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Name + Type */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="e.g. DJI Agras T50" />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}>
                {ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* SKU + Manufacturer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>SKU / Part #</label>
              <input value={form.sku} onChange={(e) => set('sku', e.target.value)} className={inputCls} placeholder="SKU-1234" />
            </div>
            <div>
              <label className={labelCls}>Manufacturer</label>
              <input value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} className={inputCls} placeholder="DJI, XAG, Hylio…" />
            </div>
          </div>

          {/* MSRP + Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>MSRP ($) *</label>
              <input type="number" min="0" step="0.01" value={form.msrp}
                onChange={(e) => set('msrp', e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Cost / Wholesale ($)</label>
              <input type="number" min="0" step="0.01" value={form.cost}
                onChange={(e) => set('cost', e.target.value)} className={inputCls} placeholder="0.00" />
              <p className="text-xs text-[#9A9A9A] mt-1">Internal only — never shown to dealers.</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={3} className={inputCls} placeholder="Product description shown to dealers…" />
          </div>

          {/* Image URL */}
          <div>
            <label className={labelCls}>Image URL</label>
            <input value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} className={inputCls} placeholder="https://…" />
            {form.imageUrl && (
              <img src={form.imageUrl} alt="" onError={(e) => e.target.style.display = 'none'}
                className="mt-2 h-20 w-20 object-contain rounded-lg border border-gray-100" />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Internal Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              rows={2} className={inputCls} placeholder="Internal notes (not shown to dealers)…" />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <input type="checkbox" id="active-toggle" checked={form.active} onChange={(e) => set('active', e.target.checked)}
              className="w-4 h-4 accent-[#8B6914]" />
            <label htmlFor="active-toggle" className="text-sm text-[#1A1A1A]">Active (visible in quotes & inventory)</label>
          </div>

          {error && <p className="text-sm text-[#D95F5F]">{error}</p>}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ──────────────────────────────────────────────────────────

function DeleteConfirm({ item, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false)
  async function confirm() {
    setDeleting(true)
    await onConfirm()
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Delete Item?</h3>
        <p className="text-sm text-[#9A9A9A] mb-5">
          Are you sure you want to delete <span className="font-semibold text-[#1A1A1A]">{item.name}</span>? This cannot be undone and may affect quotes and inventory.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button onClick={confirm} disabled={deleting}
            className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#c44f4f] transition-colors disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Catalog() {
  const { catalog, loading } = useCatalog()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editItem, setEditItem] = useState(null)   // null = closed, {} = new, item = edit
  const [deleteItem, setDeleteItem] = useState(null)

  const filtered = useMemo(() => {
    return catalog.filter((item) => {
      if (!showInactive && item.active === false) return false
      const matchType = !filterType || item.type === filterType
      const matchSearch = !search || [item.name, item.sku, item.manufacturer, item.description]
        .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      return matchType && matchSearch
    })
  }, [catalog, search, filterType, showInactive])

  async function handleDelete() {
    if (!deleteItem) return
    await deleteDoc(doc(db, 'catalog', deleteItem.id))
    setDeleteItem(null)
  }

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Product Catalog</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{filtered.length} item{filtered.length !== 1 ? 's' : ''} shown</p>
        </div>
        <button onClick={() => setEditItem({})}
          className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
          + Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, SKU, manufacturer…"
          className={`${inputCls} w-full max-w-xs`} />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={inputCls}>
          <option value="">All Types</option>
          {ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-[#9A9A9A] cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-[#8B6914]" />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-[#F4F4F5]">
              {['Item', 'Type', 'SKU', 'MSRP', 'Cost', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="py-3 px-4"><div className="h-4 bg-gray-100 rounded w-3/4" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-[#9A9A9A] text-sm">
                {catalog.length === 0 ? 'No catalog items yet. Add the first one above.' : 'No items match your filters.'}
              </td></tr>
            ) : filtered.map((item) => (
              <tr key={item.id} className="hover:bg-[#FAFAFA] transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" onError={(e) => e.target.style.display = 'none'}
                        className="w-9 h-9 object-contain rounded-lg border border-gray-100 flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#F4F4F5] flex items-center justify-center text-base flex-shrink-0">
                        {item.type === 'Drone' ? '🚁' : item.type === 'Part' ? '⚙️' : '📦'}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-[#1A1A1A]">{item.name}</p>
                      {item.manufacturer && <p className="text-xs text-[#9A9A9A]">{item.manufacturer}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor[item.type] ?? 'bg-gray-100 text-gray-500'}`}>
                    {item.type}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-[#9A9A9A]">{item.sku || '—'}</td>
                <td className="py-3 px-4 font-semibold text-[#1A1A1A]">{formatCurrency(item.msrp)}</td>
                <td className="py-3 px-4 text-[#9A9A9A]">{item.cost != null ? formatCurrency(item.cost) : '—'}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    item.active !== false ? 'bg-[#4CAF7D]/10 text-[#4CAF7D]' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {item.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-3">
                    <button onClick={() => setEditItem(item)} className="text-xs text-[#8B6914] hover:underline font-medium">Edit</button>
                    <button onClick={() => setDeleteItem(item)} className="text-xs text-[#D95F5F] hover:underline font-medium">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {editItem !== null && <ItemModal item={editItem} onClose={() => setEditItem(null)} />}
      {deleteItem && <DeleteConfirm item={deleteItem} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} />}
    </div>
  )
}
