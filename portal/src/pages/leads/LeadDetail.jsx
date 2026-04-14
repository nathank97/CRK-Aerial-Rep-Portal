import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { leadActivityCol } from '../../firebase/firestore'
import { convertLeadToCustomer } from '../../utils/customerUtils'
import { useLead } from '../../hooks/useLeads'
import { useDealers } from '../../hooks/useUsers'
import { useAuth } from '../../context/AuthContext'
import LeadActivityLog from '../../components/leads/LeadActivityLog'
import LeadChatThread from '../../components/leads/LeadChatThread'
import StatusBadge from '../../components/common/StatusBadge'
import { formatDate, formatDateTime, formatCurrency, formatPhone } from '../../utils/formatters'

const STAGES = ['New', 'Contacted', 'Pending', 'Demo Scheduled', 'Proposal Sent', 'Won', 'Lost']
const SOURCES = ['Website', 'Referral', 'Trade Show', 'Cold Outreach', 'Other']
const TABS = ['Details', 'Activity', 'Chat']

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#8B6914] bg-white transition-colors'

export default function LeadDetail() {
  const { id } = useParams()
  const { lead, loading } = useLead(id)
  const { dealers } = useDealers()
  const { user, profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState('Details')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const canEdit = isAdmin || lead?.assignedDealerId === user?.uid
  const canDelete = isAdmin

  const startEdit = () => {
    setForm({ ...lead, budget: lead.budget ?? '' })
    setEditing(true)
  }
  const cancelEdit = () => { setForm(null); setEditing(false) }

  const set = (field) => (e) => {
    const val = e.target ? e.target.value : e
    if (field === 'assignedDealerId') {
      const dealer = dealers.find((d) => d.id === val)
      setForm((f) => ({ ...f, assignedDealerId: val, assignedDealerName: dealer?.displayName ?? '' }))
    } else {
      setForm((f) => ({ ...f, [field]: val }))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        company: form.company,
        address: form.address,
        budget: form.budget ? parseFloat(form.budget) : null,
        source: form.source,
        notes: form.notes,
        assignedDealerId: form.assignedDealerId,
        assignedDealerName: form.assignedDealerName,
        updatedAt: serverTimestamp(),
      }
      await updateDoc(doc(db, 'leads', id), updates)
      setEditing(false)
      setForm(null)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    if (!lead || lead.status === newStatus) return
    const prevStatus = lead.status
    await updateDoc(doc(db, 'leads', id), { status: newStatus, updatedAt: serverTimestamp() })
    // Auto-convert to customer on Won
    if (newStatus === 'Won') {
      await convertLeadToCustomer({ ...lead, status: 'Won' }, profile)
    }
    await addDoc(leadActivityCol(id), {
      type: 'Status Change',
      details: `Status changed from ${prevStatus} to ${newStatus}`,
      previousStatus: prevStatus,
      newStatus,
      createdByName: profile?.displayName ?? 'Unknown',
      createdById: user?.uid,
      timestamp: serverTimestamp(),
    })
  }

  const handleDelete = async () => {
    await deleteDoc(doc(db, 'leads', id))
    navigate('/leads')
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-screen-lg mx-auto animate-pulse space-y-4">
        <div className="h-6 bg-gray-100 rounded w-1/4" />
        <div className="h-10 bg-gray-100 rounded w-1/2" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#9A9A9A]">Lead not found.</p>
        <Link to="/leads" className="text-[#8B6914] hover:underline text-sm mt-2 block">Back to Leads</Link>
      </div>
    )
  }

  const f = editing ? form : lead

  return (
    <div className="p-4 sm:p-6 max-w-screen-lg mx-auto">
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <Link to="/leads" className="text-[#9A9A9A] hover:text-[#1A1A1A] text-sm transition-colors">← Leads</Link>
          <h1 className="text-2xl font-bold text-[#1A1A1A] mt-1">
            {lead.firstName} {lead.lastName}
          </h1>
          {lead.company && <p className="text-[#9A9A9A] text-sm">{lead.company}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status quick-change */}
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={!canEdit}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium bg-white focus:outline-none focus:border-[#8B6914] disabled:opacity-60"
          >
            {STAGES.map((s) => <option key={s}>{s}</option>)}
          </select>

          {canEdit && !editing && (
            <button onClick={startEdit}
              className="border border-gray-200 text-[#1A1A1A] text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-[#F4F4F5] transition-colors">
              Edit
            </button>
          )}
          {editing && (
            <>
              <button onClick={cancelEdit} className="border border-gray-200 text-[#1A1A1A] text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-[#F4F4F5] transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="bg-[#8B6914] hover:bg-[#7a5c11] text-white text-sm font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 transition-colors">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
          {canDelete && !editing && (
            <button onClick={() => setConfirmDelete(true)}
              className="border border-[#D95F5F]/30 text-[#D95F5F] text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-[#D95F5F]/5 transition-colors">
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="text-lg font-bold text-[#1A1A1A] mb-2">Delete Lead?</h2>
            <p className="text-[#9A9A9A] text-sm mb-5">
              This will permanently delete {lead.firstName} {lead.lastName} and all their activity. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-gray-200 text-[#1A1A1A] text-sm font-medium py-2 rounded-lg hover:bg-[#F4F4F5]">Cancel</button>
              <button onClick={handleDelete} className="flex-1 bg-[#D95F5F] hover:bg-[#c05050] text-white text-sm font-semibold py-2 rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: tabs (details / activity / chat) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Tab nav */}
          <div className="flex border-b border-gray-100">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                  tab === t ? 'border-[#8B6914] text-[#8B6914]' : 'border-transparent text-[#9A9A9A] hover:text-[#1A1A1A]'
                }`}>
                {t}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* DETAILS TAB */}
            {tab === 'Details' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">First Name</label>
                    {editing
                      ? <input value={f.firstName} onChange={set('firstName')} className={inputCls} />
                      : <p className="text-sm text-[#1A1A1A] font-medium">{lead.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Last Name</label>
                    {editing
                      ? <input value={f.lastName} onChange={set('lastName')} className={inputCls} />
                      : <p className="text-sm text-[#1A1A1A] font-medium">{lead.lastName}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Email</label>
                    {editing
                      ? <input type="email" value={f.email} onChange={set('email')} className={inputCls} />
                      : <a href={`mailto:${lead.email}`} className="text-sm text-[#4A90B8] hover:underline">{lead.email}</a>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Phone</label>
                    {editing
                      ? <input type="tel" value={f.phone} onChange={set('phone')} className={inputCls} />
                      : <a href={`tel:${lead.phone}`} className="text-sm text-[#4A90B8] hover:underline">{formatPhone(lead.phone)}</a>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Company</label>
                    {editing
                      ? <input value={f.company ?? ''} onChange={set('company')} className={inputCls} />
                      : <p className="text-sm text-[#1A1A1A]">{lead.company || '—'}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Source</label>
                    {editing
                      ? <select value={f.source ?? ''} onChange={set('source')} className={inputCls}>
                          <option value="">Select…</option>
                          {SOURCES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      : <p className="text-sm text-[#1A1A1A]">{lead.source || '—'}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Address</label>
                    {editing
                      ? <input value={f.address ?? ''} onChange={set('address')} className={inputCls} />
                      : <p className="text-sm text-[#1A1A1A]">{lead.address || '—'}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Budget</label>
                    {editing
                      ? <input type="number" min="0" value={f.budget ?? ''} onChange={set('budget')} className={inputCls} />
                      : <p className="text-sm text-[#1A1A1A]">{lead.budget ? formatCurrency(lead.budget) : '—'}</p>}
                  </div>
                  {isAdmin && (
                    <div>
                      <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Assigned Rep</label>
                      {editing
                        ? <select value={f.assignedDealerId ?? ''} onChange={set('assignedDealerId')} className={inputCls}>
                            <option value="">Unassigned</option>
                            {dealers.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
                          </select>
                        : <p className="text-sm text-[#1A1A1A]">{lead.assignedDealerName || 'Unassigned'}</p>}
                    </div>
                  )}
                </div>

                {lead.droneModels?.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1.5">Drone Models Interest</label>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.droneModels.map((m) => (
                        <span key={m} className="bg-[#8B6914]/10 text-[#8B6914] text-xs px-2.5 py-1 rounded-full font-medium">{m}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Notes</label>
                  {editing
                    ? <textarea value={f.notes ?? ''} onChange={set('notes')} rows={4} className={`${inputCls} resize-none`} />
                    : <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap">{lead.notes || '—'}</p>}
                </div>
              </div>
            )}

            {/* ACTIVITY TAB */}
            {tab === 'Activity' && <LeadActivityLog leadId={id} />}

            {/* CHAT TAB */}
            {tab === 'Chat' && <LeadChatThread leadId={id} />}
          </div>
        </div>

        {/* Right: summary sidebar */}
        <div className="space-y-4">
          {/* Status card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-2">Status</p>
            <StatusBadge status={lead.status} size="md" />
          </div>

          {/* Key info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
            <InfoRow label="Created" value={formatDate(lead.createdAt)} />
            <InfoRow label="Last Updated" value={formatDate(lead.updatedAt)} />
            <InfoRow label="Created By" value={lead.createdByName || '—'} />
            {!isAdmin && <InfoRow label="Assigned Rep" value={lead.assignedDealerName || 'Unassigned'} />}
            {lead.budget && <InfoRow label="Budget" value={formatCurrency(lead.budget)} />}
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-2">
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-3">Quick Actions</p>
            {lead.email && (
              <a href={`mailto:${lead.email}`}
                className="flex items-center gap-2 text-sm text-[#1A1A1A] hover:text-[#8B6914] transition-colors py-1">
                ✉️ Email {lead.firstName}
              </a>
            )}
            {lead.phone && (
              <a href={`tel:${lead.phone}`}
                className="flex items-center gap-2 text-sm text-[#1A1A1A] hover:text-[#8B6914] transition-colors py-1">
                📞 Call {lead.firstName}
              </a>
            )}
            <button onClick={() => setTab('Chat')}
              className="flex items-center gap-2 text-sm text-[#1A1A1A] hover:text-[#8B6914] transition-colors py-1 w-full text-left">
              💬 Open Chat
            </button>
            <button onClick={() => setTab('Activity')}
              className="flex items-center gap-2 text-sm text-[#1A1A1A] hover:text-[#8B6914] transition-colors py-1 w-full text-left">
              📝 Log Activity
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-[#9A9A9A] shrink-0">{label}</span>
      <span className="text-xs text-[#1A1A1A] font-medium text-right">{value}</span>
    </div>
  )
}
