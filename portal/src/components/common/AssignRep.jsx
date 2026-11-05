import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useAssignableReps, assignToRep, repLabel } from '../../utils/assignRep'

const selectCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'

/** Dropdown of reps (and admins). `extraOptions` render before the rep groups. */
export function RepSelect({ value, onChange, placeholder, extraOptions = null, className = selectCls, disabled }) {
  const { dealers, admins } = useAssignableReps()
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className} disabled={disabled}>
      {placeholder && <option value="">{placeholder}</option>}
      {extraOptions}
      <optgroup label="Reps">
        {dealers.map((u) => <option key={u.id} value={u.id}>{repLabel(u)}</option>)}
      </optgroup>
      {admins.length > 0 && (
        <optgroup label="Admins">
          {admins.map((u) => <option key={u.id} value={u.id}>{repLabel(u)}</option>)}
        </optgroup>
      )}
    </select>
  )
}

function useAssign(collectionName) {
  const { profile, user } = useAuth()
  const { all } = useAssignableReps()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const run = async (records, repId) => {
    const rep = all.find((u) => u.id === repId)
    if (!rep) return 0
    setBusy(true)
    setMsg(null)
    try {
      const n = await assignToRep(collectionName, records, rep, profile?.displayName || user?.email || 'Admin')
      setMsg({ ok: true, text: n === 0 ? `Already assigned to ${repLabel(rep)}.` : `Assigned ${n} to ${repLabel(rep)}.` })
      return n
    } catch (err) {
      console.error('[AssignRep] failed:', err)
      setMsg({ ok: false, text: 'Could not reassign. Please try again.' })
      return 0
    } finally {
      setBusy(false)
    }
  }
  return { run, busy, msg, setMsg }
}

/** Admin-only "Assigned rep" control for a single quote/invoice detail page. */
export function AssignRepControl({ collectionName, record }) {
  const { isAdmin } = useAuth()
  const { all } = useAssignableReps()
  const { run, busy, msg } = useAssign(collectionName)
  if (!isAdmin || !record) return null

  const known = all.some((u) => u.id === record.dealerId)
  const handleChange = async (repId) => {
    if (!repId || repId === record.dealerId) return
    const rep = all.find((u) => u.id === repId)
    if (!window.confirm(`Move this ${collectionName === 'quotes' ? 'quote' : 'invoice'} to ${repLabel(rep)}? It will leave ${record.dealerName || 'the current owner'}'s portal and appear in ${repLabel(rep)}'s.`)) return
    await run([record], repId)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
      <span className="text-[#9A9A9A] font-medium">Assigned rep:</span>
      <RepSelect
        value={record.dealerId ?? ''}
        onChange={handleChange}
        disabled={busy}
        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-[#8B6914] bg-white"
        placeholder={record.dealerId ? undefined : 'Unassigned'}
        extraOptions={record.dealerId && !known
          ? <option value={record.dealerId}>{record.dealerName || 'Removed user'} (no longer active)</option>
          : null}
      />
      {busy && <span className="text-[#9A9A9A]">Saving…</span>}
      {msg && <span className={msg.ok ? 'text-[#4CAF7D]' : 'text-[#D95F5F]'}>{msg.text}</span>}
    </div>
  )
}

/** Admin-only bulk bar shown when list rows are selected. */
export function BulkAssignBar({ collectionName, selected, onDone }) {
  const { all } = useAssignableReps()
  const { run, busy, msg } = useAssign(collectionName)
  const [repId, setRepId] = useState('')
  const noun = collectionName === 'quotes' ? 'quote' : 'invoice'
  if (selected.length === 0 && !msg) return null

  const handleAssign = async () => {
    const rep = all.find((u) => u.id === repId)
    if (!rep) return
    if (!window.confirm(`Move ${selected.length} ${noun}${selected.length !== 1 ? 's' : ''} to ${repLabel(rep)}?`)) return
    await run(selected, repId)
    setRepId('')
    onDone()
  }

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-xl border border-[#8B6914]/30 bg-[#8B6914]/5 text-sm">
      {selected.length > 0 && (
        <>
          <span className="font-semibold text-[#111111]">{selected.length} selected</span>
          <RepSelect value={repId} onChange={setRepId} placeholder="Assign to rep…" disabled={busy} />
          <button onClick={handleAssign} disabled={!repId || busy}
            className="bg-[#8B6914] hover:bg-[#7a5c12] text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50">
            {busy ? 'Assigning…' : 'Assign'}
          </button>
          <button onClick={onDone} disabled={busy} className="text-[#9A9A9A] hover:text-[#111111] text-sm">Clear</button>
        </>
      )}
      {msg && <span className={msg.ok ? 'text-[#4CAF7D]' : 'text-[#D95F5F]'}>{msg.text}</span>}
    </div>
  )
}
