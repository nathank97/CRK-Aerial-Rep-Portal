import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  updateDoc, deleteDoc, addDoc, doc, collection, onSnapshot, query,
  orderBy, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { useRep, useRepNotes } from '../../../hooks/useReps'
import { useAllUsers } from '../../../hooks/useUsers'
import { db, storage } from '../../../firebase/config'
import { formatDate } from '../../../utils/formatters'

const STATUSES = ['Prospect', 'In Onboarding', 'Active Rep', 'Inactive Rep', 'Terminated']
const PIPELINE_STAGES = ['Prospect', 'Contacted', 'In Negotiation', 'Signed', 'Declined']
const NOTE_TYPES = ['Call', 'Email', 'Meeting', 'Review', 'Contract Update', 'General Note']
const DOC_TYPES = ['Dealer Agreement', 'Commission Agreement', 'Onboarding Documents', 'W9 / Tax Forms', 'Other']

const statusColor = {
  'Active Rep': 'bg-[#4CAF7D]/10 text-[#4CAF7D]',
  'In Onboarding': 'bg-[#4A90B8]/10 text-[#4A90B8]',
  Prospect: 'bg-[#E6A817]/10 text-[#E6A817]',
  'Inactive Rep': 'bg-gray-100 text-gray-500',
  Terminated: 'bg-[#D95F5F]/10 text-[#D95F5F]',
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">{label}</p>
      <div className="text-sm text-[#1A1A1A]">{children || '—'}</div>
    </div>
  )
}

function EditableField({ label, value, field, editing, onChange, type = 'text', options }) {
  const cls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  if (!editing) return <Field label={label}>{value}</Field>
  if (options) return (
    <div>
      <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">{label}</label>
      <select value={value ?? ''} onChange={(e) => onChange(field, e.target.value)} className={cls}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </div>
  )
  if (type === 'textarea') return (
    <div>
      <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">{label}</label>
      <textarea value={value ?? ''} onChange={(e) => onChange(field, e.target.value)} rows={3} className={cls} />
    </div>
  )
  return (
    <div>
      <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">{label}</label>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(field, e.target.value)} className={cls} />
    </div>
  )
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ repId }) {
  const { notes, loading } = useRepNotes(repId)
  const [text, setText] = useState('')
  const [type, setType] = useState('General Note')
  const [saving, setSaving] = useState(false)

  const NOTE_COLOR = {
    Call: 'bg-[#4A90B8]/10 text-[#4A90B8]',
    Email: 'bg-[#9B59B6]/10 text-[#9B59B6]',
    Meeting: 'bg-[#4CAF7D]/10 text-[#4CAF7D]',
    Review: 'bg-[#E6A817]/10 text-[#E6A817]',
    'Contract Update': 'bg-[#8B6914]/10 text-[#8B6914]',
    'General Note': 'bg-gray-100 text-gray-500',
  }

  async function addNote() {
    if (!text.trim()) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'reps', repId, 'notes'), {
        text: text.trim(), type, createdAt: serverTimestamp(),
      })
      setText('')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]">
          {NOTE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder="Add a private note…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]" />
        <button onClick={addNote} disabled={saving || !text.trim()}
          className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
          {saving ? 'Adding…' : 'Add Note'}
        </button>
      </div>
      <div className="space-y-3">
        {loading ? Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-1/4 mb-2" />
            <div className="h-4 bg-gray-100 rounded w-3/4" />
          </div>
        )) : notes.length === 0 ? (
          <p className="text-center text-[#9A9A9A] text-sm py-8">No notes yet.</p>
        ) : notes.map((note) => (
          <div key={note.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${NOTE_COLOR[note.type] ?? 'bg-gray-100 text-gray-500'}`}>
                {note.type}
              </span>
              <span className="text-xs text-[#9A9A9A]">{formatDate(note.createdAt)}</span>
            </div>
            <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap">{note.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

function DocsTab({ repId }) {
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [docType, setDocType] = useState('Other')
  const fileRef = useRef(null)

  useEffect(() => {
    const q = query(collection(db, 'reps', repId, 'documents'), orderBy('uploadedAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [repId])

  async function upload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `reps/${repId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
      const storageRef = ref(storage, path)
      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file)
        task.on('state_changed',
          (snap) => setProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
          reject,
          async () => {
            const url = await getDownloadURL(storageRef)
            await addDoc(collection(db, 'reps', repId, 'documents'), {
              fileName: file.name, mimeType: file.type, storagePath: path,
              downloadUrl: url, docType, uploadedAt: serverTimestamp(),
            })
            resolve()
          }
        )
      })
    } finally { setUploading(false); setProgress(0); e.target.value = '' }
  }

  async function handleDelete(d) {
    try {
      if (d.storagePath) {
        try { await deleteObject(ref(storage, d.storagePath)) } catch (_) {}
      }
      await deleteDoc(doc(db, 'reps', repId, 'documents', d.id))
    } catch (e) { console.error(e) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center gap-3 flex-wrap">
        <select value={docType} onChange={(e) => setDocType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]">
          {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
          {uploading ? `Uploading ${progress}%…` : '+ Upload Document'}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={upload} />
      </div>
      <div className="space-y-2">
        {docs.length === 0 ? (
          <p className="text-center text-[#9A9A9A] text-sm py-8">No documents uploaded yet.</p>
        ) : docs.map((d) => (
          <div key={d.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm text-[#1A1A1A]">{d.fileName}</p>
              <p className="text-xs text-[#9A9A9A] mt-0.5">{d.docType} · {formatDate(d.uploadedAt)}</p>
            </div>
            <div className="flex gap-3">
              <a href={d.downloadUrl} target="_blank" rel="noreferrer" className="text-xs text-[#8B6914] hover:underline">Download</a>
              <button onClick={() => handleDelete(d)} className="text-xs text-[#D95F5F] hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RepDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { rep, loading } = useRep(id)
  const { users } = useAllUsers()
  const dealers = users.filter((u) => u.role === 'dealer')

  const [activeTab, setActiveTab] = useState('details')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  function startEdit() { setDraft({ ...rep }); setEditing(true) }
  function cancelEdit() { setDraft(null); setEditing(false) }
  function setField(field, value) { setDraft((d) => ({ ...d, [field]: value })) }

  async function saveChanges() {
    setSaving(true)
    try {
      const linkedDealer = dealers.find((d) => d.id === draft.linkedDealerId)
      await updateDoc(doc(db, 'reps', id), {
        firstName: draft.firstName ?? '',
        lastName: draft.lastName ?? '',
        company: draft.company || null,
        email: draft.email ?? '',
        phone: draft.phone ?? '',
        address: draft.address || null,
        status: draft.status,
        pipelineStage: draft.status === 'Prospect' ? (draft.pipelineStage ?? null) : null,
        commissionPercent: draft.commissionPercent != null ? parseFloat(draft.commissionPercent) : null,
        startDate: draft.startDate || null,
        contractRenewalDate: draft.contractRenewalDate || null,
        linkedDealerId: draft.linkedDealerId || null,
        linkedDealerName: (linkedDealer?.displayName ?? draft.linkedDealerName) || null,
        territoryName: draft.territoryName || null,
        performanceGoalRevenue: draft.performanceGoalRevenue != null ? parseFloat(draft.performanceGoalRevenue) : null,
        performanceGoalLeads: draft.performanceGoalLeads != null ? parseInt(draft.performanceGoalLeads) : null,
        updatedAt: serverTimestamp(),
      })
      setEditing(false)
      setDraft(null)
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="bg-white border rounded-xl p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded" />)}
        </div>
      </div>
    )
  }

  if (!rep) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#9A9A9A]">Rep not found.</p>
        <button onClick={() => navigate('/admin/reps')} className="mt-4 text-[#8B6914] hover:underline text-sm">Back</button>
      </div>
    )
  }

  const data = editing ? draft : rep

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/reps')} className="text-[#9A9A9A] hover:text-[#1A1A1A]">←</button>
          <div className="w-12 h-12 rounded-full bg-[#8B6914]/15 flex items-center justify-center text-xl font-bold text-[#8B6914]">
            {(rep.firstName ?? '?')[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[#1A1A1A]">{rep.firstName} {rep.lastName}</h1>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[rep.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {rep.status}
              </span>
            </div>
            {rep.company && <p className="text-sm text-[#9A9A9A]">{rep.company}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={startEdit} className="border border-gray-200 text-[#1A1A1A] px-4 py-2 rounded-lg text-sm hover:bg-[#F4F4F5] transition-colors">
              Edit
            </button>
          ) : (
            <>
              <button onClick={cancelEdit} className="border border-gray-200 text-[#1A1A1A] px-4 py-2 rounded-lg text-sm hover:bg-[#F4F4F5] transition-colors">
                Cancel
              </button>
              <button onClick={saveChanges} disabled={saving}
                className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-5">
        {['details', 'notes', 'documents'].map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab ? 'border-[#8B6914] text-[#8B6914]' : 'border-transparent text-[#9A9A9A] hover:text-[#1A1A1A]'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Contact Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <EditableField label="First Name" value={data.firstName} field="firstName" editing={editing} onChange={setField} />
                <EditableField label="Last Name" value={data.lastName} field="lastName" editing={editing} onChange={setField} />
              </div>
              <EditableField label="Company" value={data.company} field="company" editing={editing} onChange={setField} />
              <div className="grid grid-cols-2 gap-4">
                <EditableField label="Email" value={data.email} field="email" editing={editing} onChange={setField} />
                <EditableField label="Phone" value={data.phone} field="phone" editing={editing} onChange={setField} />
              </div>
              <EditableField label="Address" value={data.address} field="address" editing={editing} onChange={setField} />
            </div>

            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Rep Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <EditableField label="Status" value={data.status} field="status" editing={editing} onChange={setField} options={STATUSES} />
                <EditableField label="Pipeline Stage" value={data.pipelineStage} field="pipelineStage"
                  editing={editing && data?.status === 'Prospect'} onChange={setField} options={PIPELINE_STAGES} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <EditableField label="Commission %" value={data.commissionPercent} field="commissionPercent" editing={editing} onChange={setField} type="number" />
                <EditableField label="Territory" value={data.territoryName} field="territoryName" editing={editing} onChange={setField} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <EditableField label="Start Date" value={data.startDate} field="startDate" editing={editing} onChange={setField} type="date" />
                <EditableField label="Contract Renewal" value={data.contractRenewalDate} field="contractRenewalDate" editing={editing} onChange={setField} type="date" />
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Performance Goals</h3>
              <div className="grid grid-cols-2 gap-4">
                <EditableField label="Monthly Revenue Goal ($)" value={data.performanceGoalRevenue} field="performanceGoalRevenue" editing={editing} onChange={setField} type="number" />
                <EditableField label="Monthly Lead Goal (#)" value={data.performanceGoalLeads} field="performanceGoalLeads" editing={editing} onChange={setField} type="number" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3">
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Linked Dealer</p>
              {editing ? (
                <select value={data.linkedDealerId ?? ''} onChange={(e) => setField('linkedDealerId', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]">
                  <option value="">— None —</option>
                  {dealers.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
                </select>
              ) : rep.linkedDealerName ? (
                <p className="text-sm font-medium text-[#8B6914]">{rep.linkedDealerName}</p>
              ) : (
                <p className="text-sm text-[#9A9A9A]">No dealer linked</p>
              )}
            </div>
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3">
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Record Info</p>
              <Field label="Created">{formatDate(rep.createdAt)}</Field>
              <Field label="Updated">{formatDate(rep.updatedAt)}</Field>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'notes' && <NotesTab repId={id} />}
      {activeTab === 'documents' && <DocsTab repId={id} />}
    </div>
  )
}
