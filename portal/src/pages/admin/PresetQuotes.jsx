import { useState } from 'react'
import { addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { presetQuotesCol } from '../../firebase/firestore'
import { usePresetQuotes } from '../../hooks/usePresetQuotes'
import { useAuth } from '../../context/AuthContext'
import LineItemBuilder, { calcTotals } from '../../components/quotes/LineItemBuilder'
import { formatCurrency, formatDate } from '../../utils/formatters'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'
const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

function PresetForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [terms, setTerms] = useState(initial?.terms ?? '')
  const [lineItems, setLineItems] = useState(initial?.lineItems ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { subtotal } = calcTotals(lineItems, 0, false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Preset name is required.'); return }
    if (lineItems.length === 0) { setError('Add at least one line item.'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({ name: name.trim(), description: description.trim(), notes: notes.trim(), terms: terms.trim(), lineItems })
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Preset Name <span className="text-[#D95F5F]">*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Starter Package" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description for dealers" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Line Items <span className="text-[#D95F5F]">*</span></label>
        <LineItemBuilder items={lineItems} onChange={setLineItems} />
        {lineItems.length > 0 && (
          <div className="mt-3 flex justify-end">
            <span className="text-sm text-[#9A9A9A]">Subtotal: <span className="font-semibold text-[#1A1A1A]">{formatCurrency(subtotal)}</span></span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Default Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Pre-filled notes on the quote…" className={`${inputCls} resize-none`} />
        </div>
        <div>
          <label className={labelCls}>Default Terms</label>
          <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} placeholder="e.g. Net 30, FOB Origin…" className={`${inputCls} resize-none`} />
        </div>
      </div>

      {error && <p className="text-sm text-[#D95F5F]">{error}</p>}

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-[#1A1A1A] hover:bg-[#F4F4F5] transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-[#8B6914] hover:bg-[#7a5c11] text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors">
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Preset'}
        </button>
      </div>
    </form>
  )
}

export default function PresetQuotes() {
  const { profile } = useAuth()
  const { presets, loading } = usePresetQuotes()
  const [view, setView] = useState('list') // 'list' | 'new' | 'edit'
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  async function handleCreate(data) {
    await addDoc(presetQuotesCol, {
      ...data,
      createdById: profile?.uid ?? null,
      createdByName: profile?.displayName ?? 'Admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setView('list')
  }

  async function handleEdit(data) {
    await updateDoc(doc(db, 'presetQuotes', editing.id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
    setEditing(null)
    setView('list')
  }

  async function handleDelete(preset) {
    await deleteDoc(doc(db, 'presetQuotes', preset.id))
    setConfirmDelete(null)
  }

  return (
    <div className="p-4 sm:p-6 max-w-screen-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Preset Quotes</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">Build reusable quote templates dealers can load when creating quotes.</p>
        </div>
        {view === 'list' && (
          <button onClick={() => setView('new')}
            className="bg-[#8B6914] hover:bg-[#7a5c11] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            + New Preset
          </button>
        )}
        {view !== 'list' && (
          <button onClick={() => { setView('list'); setEditing(null) }}
            className="border border-gray-200 text-[#1A1A1A] text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#F4F4F5] transition-colors">
            ← Back to Presets
          </button>
        )}
      </div>

      {/* New / Edit form */}
      {(view === 'new' || view === 'edit') && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-5">
            {view === 'new' ? 'New Preset Quote' : `Editing — ${editing?.name}`}
          </h2>
          <PresetForm
            initial={editing}
            onSave={view === 'new' ? handleCreate : handleEdit}
            onCancel={() => { setView('list'); setEditing(null) }}
          />
        </div>
      )}

      {/* List */}
      {view === 'list' && (
        <>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 h-20" />
              ))}
            </div>
          ) : presets.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
              <p className="text-[#9A9A9A] text-sm">No preset quotes yet.</p>
              <button onClick={() => setView('new')}
                className="mt-3 text-[#8B6914] hover:underline text-sm font-medium">
                Create your first preset →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {presets.map((preset) => {
                const { subtotal } = calcTotals(preset.lineItems ?? [], 0, false)
                return (
                  <div key={preset.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-[#1A1A1A]">{preset.name}</h3>
                        {preset.description && (
                          <p className="text-sm text-[#9A9A9A] mt-0.5">{preset.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-[#9A9A9A] flex-wrap">
                          <span>{preset.lineItems?.length ?? 0} line item{preset.lineItems?.length !== 1 ? 's' : ''}</span>
                          <span>Subtotal: <span className="font-medium text-[#1A1A1A]">{formatCurrency(subtotal)}</span></span>
                          <span>Created {formatDate(preset.createdAt)}</span>
                          {preset.createdByName && <span>by {preset.createdByName}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => { setEditing(preset); setView('edit') }}
                          className="text-sm text-[#8B6914] hover:underline font-medium">
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDelete(preset)}
                          className="text-sm text-[#D95F5F] hover:underline font-medium">
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Line item preview */}
                    {preset.lineItems?.length > 0 && (
                      <div className="mt-4 border-t border-gray-50 pt-3 space-y-1">
                        {preset.lineItems.slice(0, 4).map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-xs text-[#9A9A9A]">
                            <span className="truncate mr-4">{item.description || '—'}</span>
                            <span className="shrink-0">
                              {item.quantity ?? 1} × {formatCurrency(item.unitPrice ?? 0)}
                            </span>
                          </div>
                        ))}
                        {preset.lineItems.length > 4 && (
                          <p className="text-xs text-[#9A9A9A]">+{preset.lineItems.length - 4} more item{preset.lineItems.length - 4 !== 1 ? 's' : ''}…</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-base font-semibold text-[#1A1A1A] mb-1">Delete Preset?</h2>
            <p className="text-sm text-[#9A9A9A] mb-5">
              "<span className="font-medium text-[#1A1A1A]">{confirmDelete.name}</span>" will be permanently deleted. Existing quotes are not affected.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)}
                className="border border-gray-200 text-[#1A1A1A] text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#F4F4F5] transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
