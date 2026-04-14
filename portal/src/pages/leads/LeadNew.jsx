import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { addDoc, serverTimestamp } from 'firebase/firestore'
import { leadsCol, leadActivityCol } from '../../firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { useDealers } from '../../hooks/useUsers'

const STAGES = ['New', 'Contacted', 'Pending', 'Demo Scheduled', 'Proposal Sent', 'Won', 'Lost']
const SOURCES = ['Website', 'Referral', 'Trade Show', 'Cold Outreach', 'Other']

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">
        {label}{required && <span className="text-[#D95F5F] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#1A1A1A] placeholder-[#9A9A9A] focus:outline-none focus:border-[#8B6914] bg-white transition-colors'

// Simple tag/chip input for drone models
function TagInput({ value = [], onChange, placeholder }) {
  const [input, setInput] = useState('')
  const add = () => {
    const tag = input.trim()
    if (tag && !value.includes(tag)) onChange([...value, tag])
    setInput('')
  }
  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg min-h-[42px] bg-white focus-within:border-[#8B6914] transition-colors cursor-text">
      {value.map((tag) => (
        <span key={tag} className="flex items-center gap-1 bg-[#8B6914]/10 text-[#8B6914] text-xs px-2.5 py-1 rounded-full font-medium">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="hover:text-[#D95F5F] leading-none">×</button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder={value.length === 0 ? placeholder : 'Add another…'}
        className="flex-1 min-w-[120px] outline-none text-sm text-[#1A1A1A] bg-transparent"
      />
    </div>
  )
}

export default function LeadNew() {
  const { user, profile, isAdmin } = useAuth()
  const { dealers } = useDealers()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    company: '', address: '', droneModels: [],
    budget: '', status: 'New', source: '',
    assignedDealerId: isAdmin ? '' : user?.uid ?? '',
    assignedDealerName: isAdmin ? '' : profile?.displayName ?? '',
    notes: '',
  })

  const set = (field) => (e) => {
    const val = e.target ? e.target.value : e
    if (field === 'assignedDealerId') {
      const dealer = dealers.find((d) => d.id === val)
      setForm((f) => ({ ...f, assignedDealerId: val, assignedDealerName: dealer?.displayName ?? '' }))
    } else {
      setForm((f) => ({ ...f, [field]: val }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.firstName || !form.lastName || !form.email || !form.phone) {
      setError('First name, last name, email, and phone are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const now = serverTimestamp()
      const docRef = await addDoc(leadsCol, {
        ...form,
        budget: form.budget ? parseFloat(form.budget) : null,
        createdById: user.uid,
        createdByName: profile?.displayName ?? 'Unknown',
        createdAt: now,
        updatedAt: now,
      })
      // Log initial creation in activity
      await addDoc(leadActivityCol(docRef.id), {
        type: 'Note',
        details: 'Lead created.',
        createdByName: profile?.displayName ?? 'Unknown',
        createdById: user.uid,
        timestamp: now,
      })
      navigate(`/leads/${docRef.id}`)
    } catch (err) {
      setError('Failed to create lead. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/leads" className="text-[#9A9A9A] hover:text-[#1A1A1A] transition-colors">
          ← Leads
        </Link>
        <span className="text-[#9A9A9A]">/</span>
        <h1 className="text-xl font-bold text-[#1A1A1A]">New Lead</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        {error && (
          <div className="bg-[#D95F5F]/10 border border-[#D95F5F] text-[#D95F5F] text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {/* Name row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First Name" required>
            <input value={form.firstName} onChange={set('firstName')} placeholder="Jane" className={inputCls} />
          </Field>
          <Field label="Last Name" required>
            <input value={form.lastName} onChange={set('lastName')} placeholder="Doe" className={inputCls} />
          </Field>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email" required>
            <input type="email" value={form.email} onChange={set('email')} placeholder="jane@farm.com" className={inputCls} />
          </Field>
          <Field label="Phone" required>
            <input type="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" className={inputCls} />
          </Field>
        </div>

        {/* Company / Address */}
        <Field label="Company">
          <input value={form.company} onChange={set('company')} placeholder="Farm name or business" className={inputCls} />
        </Field>
        <Field label="Address / Location">
          <input value={form.address} onChange={set('address')} placeholder="123 Main St, City, State" className={inputCls} />
        </Field>

        {/* Drone models interest */}
        <Field label="Drone Model Interest">
          <TagInput value={form.droneModels} onChange={set('droneModels')} placeholder="Type a model name and press Enter…" />
          <p className="text-xs text-[#9A9A9A] mt-1">Will pull from catalog once catalog is built.</p>
        </Field>

        {/* Budget / Status / Source */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Budget (USD)">
            <input type="number" min="0" step="100" value={form.budget} onChange={set('budget')} placeholder="0.00" className={inputCls} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={set('status')} className={inputCls}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Source">
            <select value={form.source} onChange={set('source')} className={inputCls}>
              <option value="">Select source…</option>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        {/* Assigned dealer — admin only */}
        {isAdmin && (
          <Field label="Assigned Rep">
            <select value={form.assignedDealerId} onChange={set('assignedDealerId')} className={inputCls}>
              <option value="">Unassigned</option>
              {dealers.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
            </select>
          </Field>
        )}

        {/* Notes */}
        <Field label="Notes">
          <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Any initial notes…"
            className={`${inputCls} resize-none`} />
        </Field>

        {/* Actions */}
        <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-1">
          <Link to="/leads" className="flex-1 text-center border border-gray-200 text-[#1A1A1A] text-sm font-semibold py-2.5 rounded-lg hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 bg-[#8B6914] hover:bg-[#7a5c11] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
            {saving ? 'Creating…' : 'Create Lead'}
          </button>
        </div>
      </form>
    </div>
  )
}
