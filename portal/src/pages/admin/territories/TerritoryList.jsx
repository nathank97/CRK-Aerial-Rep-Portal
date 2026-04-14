import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { useTerritories } from '../../../hooks/useTerritories'
import { territoriesCol } from '../../../firebase/firestore'
import { db } from '../../../firebase/config'
import { formatDate } from '../../../utils/formatters'

const TERRITORY_STATUSES = ['Active', 'Open', 'Planned']

const statusColor = {
  Active: 'bg-[#4CAF7D]/10 text-[#4CAF7D]',
  Open: 'bg-[#E6A817]/10 text-[#E6A817]',
  Planned: 'bg-gray-100 text-gray-500',
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY',
]

const EMPTY_FORM = {
  name: '', regionLabel: '', status: 'Active', statesCovered: [], assignedRep: '', notes: '',
}

// ─── Territory Modal ──────────────────────────────────────────────────────────

function TerritoryModal({ territory, onClose }) {
  const isEdit = !!territory?.id
  const [form, setForm] = useState(isEdit ? {
    name: territory.name ?? '',
    regionLabel: territory.regionLabel ?? '',
    status: territory.status ?? 'Active',
    statesCovered: territory.statesCovered ?? [],
    assignedRep: territory.assignedRep ?? '',
    notes: territory.notes ?? '',
  } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  function toggleState(state) {
    setForm((f) => ({
      ...f,
      statesCovered: f.statesCovered.includes(state)
        ? f.statesCovered.filter((s) => s !== state)
        : [...f.statesCovered, state],
    }))
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        regionLabel: form.regionLabel.trim(),
        status: form.status,
        statesCovered: form.statesCovered,
        assignedRep: form.assignedRep.trim() || null,
        notes: form.notes.trim(),
        updatedAt: serverTimestamp(),
      }
      if (isEdit) {
        await updateDoc(doc(db, 'territories', territory.id), data)
      } else {
        await addDoc(territoriesCol, { ...data, createdAt: serverTimestamp() })
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-[#1A1A1A]">{isEdit ? 'Edit Territory' : 'New Territory'}</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <label className={labelCls}>Territory Name *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls} placeholder="e.g. Midwest Region, Texas Panhandle" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Region Label</label>
              <input value={form.regionLabel} onChange={(e) => setForm((f) => ({ ...f, regionLabel: e.target.value }))}
                className={inputCls} placeholder="e.g. Midwest, Southwest" />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
                {TERRITORY_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Assigned Rep</label>
            <input value={form.assignedRep} onChange={(e) => setForm((f) => ({ ...f, assignedRep: e.target.value }))}
              className={inputCls} placeholder="Rep name (free text)" />
          </div>

          {/* States Covered */}
          <div>
            <label className={labelCls}>States Covered ({form.statesCovered.length} selected)</label>
            <div className="grid grid-cols-6 gap-1.5 mt-2 max-h-52 overflow-y-auto border border-gray-100 rounded-xl p-3">
              {US_STATES.map((s) => (
                <button key={s} type="button"
                  onClick={() => toggleState(s)}
                  className={`text-xs font-mono font-bold py-1.5 rounded-lg transition-colors ${
                    form.statesCovered.includes(s)
                      ? 'bg-[#8B6914] text-white'
                      : 'bg-[#F4F4F5] text-[#9A9A9A] hover:bg-[#E8E8E8]'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
            {form.statesCovered.length > 0 && (
              <button onClick={() => setForm((f) => ({ ...f, statesCovered: [] }))}
                className="text-xs text-[#9A9A9A] hover:text-[#D95F5F] mt-1">
                Clear all states
              </button>
            )}
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2} className={inputCls} placeholder="Notes about this territory…" />
          </div>

          {error && <p className="text-sm text-[#D95F5F]">{error}</p>}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Territory'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TerritoryList() {
  const navigate = useNavigate()
  const { territories, loading } = useTerritories()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editItem, setEditItem] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  const filtered = useMemo(() => {
    return territories.filter((t) => {
      const matchSearch = !search || [t.name, t.regionLabel, t.assignedRep]
        .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      const matchStatus = !filterStatus || t.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [territories, search, filterStatus])

  async function handleDelete() {
    if (!deleteId) return
    await deleteDoc(doc(db, 'territories', deleteId))
    setDeleteId(null)
  }

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Territories</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{territories.length} territor{territories.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/admin/territories/map')}
            className="border border-gray-200 text-[#1A1A1A] px-4 py-2 rounded-lg text-sm hover:bg-[#F4F4F5] transition-colors">
            Map View
          </button>
          <button onClick={() => setEditItem({})}
            className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
            + Add Territory
          </button>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {TERRITORY_STATUSES.map((s) => {
          const count = territories.filter((t) => t.status === s).length
          return (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                filterStatus === s ? 'border-[#8B6914] bg-[#8B6914]/5' : 'border-gray-100 bg-white hover:border-gray-200'
              }`}>
              <p className="text-xl font-bold text-[#1A1A1A]">{count}</p>
              <p className="text-xs text-[#9A9A9A] mt-0.5">{s}</p>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, region, rep…"
          className={`${inputCls} w-full max-w-xs`} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls}>
          <option value="">All Statuses</option>
          {TERRITORY_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
              <div className="flex gap-1 mt-3">
                {Array.from({ length: 8 }).map((__, j) => <div key={j} className="h-6 w-8 bg-gray-100 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-xl">
          <p className="text-[#1A1A1A] font-medium">
            {territories.length === 0 ? 'No territories yet.' : 'No territories match your filters.'}
          </p>
          {territories.length === 0 && (
            <button onClick={() => setEditItem({})}
              className="mt-4 bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
              Create First Territory
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div key={t.id} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-[#1A1A1A]">{t.name}</h3>
                  {t.regionLabel && <p className="text-xs text-[#9A9A9A]">{t.regionLabel}</p>}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {t.status}
                </span>
              </div>

              {t.assignedRep && (
                <p className="text-sm text-[#1A1A1A] mb-2">👤 {t.assignedRep}</p>
              )}

              {/* States */}
              {t.statesCovered?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {t.statesCovered.slice(0, 12).map((s) => (
                    <span key={s} className="text-xs font-mono font-bold px-1.5 py-0.5 bg-[#F4F4F5] text-[#9A9A9A] rounded">
                      {s}
                    </span>
                  ))}
                  {t.statesCovered.length > 12 && (
                    <span className="text-xs text-[#9A9A9A]">+{t.statesCovered.length - 12} more</span>
                  )}
                </div>
              )}

              {t.notes && <p className="text-xs text-[#9A9A9A] mb-3 line-clamp-2">{t.notes}</p>}

              <div className="flex gap-3 pt-2 border-t border-gray-50">
                <button onClick={() => setEditItem(t)} className="text-xs text-[#8B6914] hover:underline font-medium">Edit</button>
                <button onClick={() => setDeleteId(t.id)} className="text-xs text-[#D95F5F] hover:underline font-medium">Delete</button>
                <span className="text-xs text-[#9A9A9A] ml-auto">{formatDate(t.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editItem !== null && <TerritoryModal territory={editItem} onClose={() => setEditItem(null)} />}

      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Delete Territory?</h3>
            <p className="text-sm text-[#9A9A9A] mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#c44f4f] transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
