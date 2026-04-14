import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { repsCol } from '../../../firebase/firestore'
import { db } from '../../../firebase/config'
import { useAllUsers } from '../../../hooks/useUsers'

const STATUSES = ['Prospect', 'In Onboarding', 'Active Rep', 'Inactive Rep', 'Terminated']
const PIPELINE_STAGES = ['Prospect', 'Contacted', 'In Negotiation', 'Signed', 'Declined']

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY',
]

export default function RepNew() {
  const navigate = useNavigate()
  const { users } = useAllUsers()
  const dealers = users.filter((u) => u.role === 'dealer')

  const [form, setForm] = useState({
    firstName: '', lastName: '', company: '', email: '', phone: '',
    address: '', status: 'Prospect', pipelineStage: 'Prospect',
    commissionPercent: '', startDate: '', contractRenewalDate: '',
    linkedDealerId: '', linkedDealerName: '', territoryName: '',
    performanceGoalRevenue: '', performanceGoalLeads: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSave() {
    if (!form.firstName.trim()) { setError('First name is required.'); return }
    setSaving(true)
    try {
      const linkedDealer = dealers.find((d) => d.id === form.linkedDealerId)
      const docRef = await addDoc(repsCol, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        company: form.company.trim() || null,
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || null,
        status: form.status,
        pipelineStage: form.status === 'Prospect' ? form.pipelineStage : null,
        commissionPercent: form.commissionPercent !== '' ? parseFloat(form.commissionPercent) : null,
        startDate: form.startDate || null,
        contractRenewalDate: form.contractRenewalDate || null,
        linkedDealerId: form.linkedDealerId || null,
        linkedDealerName: (linkedDealer?.displayName ?? form.linkedDealerName.trim()) || null,
        territoryName: form.territoryName.trim() || null,
        performanceGoalRevenue: form.performanceGoalRevenue !== '' ? parseFloat(form.performanceGoalRevenue) : null,
        performanceGoalLeads: form.performanceGoalLeads !== '' ? parseInt(form.performanceGoalLeads) : null,
        performanceRating: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      // Add initial note if provided
      if (form.notes.trim()) {
        await addDoc(collection(db, 'reps', docRef.id, 'notes'), {
          text: form.notes.trim(),
          type: 'General Note',
          createdAt: serverTimestamp(),
        })
      }
      navigate(`/admin/reps/${docRef.id}`)
    } catch (e) {
      console.error(e)
      setError('Failed to create rep. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/admin/reps')} className="text-[#9A9A9A] hover:text-[#1A1A1A]">← Back</button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Add Rep</h1>
          <p className="text-sm text-[#9A9A9A]">Create a new rep or prospect record</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-5">
        {/* Name + Company */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name *</label>
            <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputCls} placeholder="John" />
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputCls} placeholder="Smith" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Company / Business Name</label>
          <input value={form.company} onChange={(e) => set('company', e.target.value)} className={inputCls} placeholder="Smith Ag Solutions" />
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} placeholder="(555) 000-0000" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Address</label>
          <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} placeholder="123 Main St, City, State" />
        </div>

        {/* Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          {form.status === 'Prospect' && (
            <div>
              <label className={labelCls}>Pipeline Stage</label>
              <select value={form.pipelineStage} onChange={(e) => set('pipelineStage', e.target.value)} className={inputCls}>
                {PIPELINE_STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Commission + Territory */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Commission / Margin %</label>
            <div className="relative">
              <input type="number" min="0" max="100" step="0.5" value={form.commissionPercent}
                onChange={(e) => set('commissionPercent', e.target.value)} className={inputCls + ' pr-8'} placeholder="20" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#9A9A9A]">%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Territory</label>
            <input value={form.territoryName} onChange={(e) => set('territoryName', e.target.value)} className={inputCls} placeholder="e.g. Midwest Region" />
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Contract Renewal Date</label>
            <input type="date" value={form.contractRenewalDate} onChange={(e) => set('contractRenewalDate', e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Linked Dealer */}
        <div>
          <label className={labelCls}>Linked Dealer Account</label>
          <select value={form.linkedDealerId} onChange={(e) => set('linkedDealerId', e.target.value)} className={inputCls}>
            <option value="">— None —</option>
            {dealers.map((d) => <option key={d.id} value={d.id}>{d.displayName} ({d.email})</option>)}
          </select>
        </div>

        {/* Performance Goals */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Monthly Revenue Goal ($)</label>
            <input type="number" min="0" value={form.performanceGoalRevenue}
              onChange={(e) => set('performanceGoalRevenue', e.target.value)} className={inputCls} placeholder="50000" />
          </div>
          <div>
            <label className={labelCls}>Monthly Lead Goal (#)</label>
            <input type="number" min="0" value={form.performanceGoalLeads}
              onChange={(e) => set('performanceGoalLeads', e.target.value)} className={inputCls} placeholder="10" />
          </div>
        </div>

        {/* Initial Notes */}
        <div>
          <label className={labelCls}>Initial Notes</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
            rows={3} className={inputCls} placeholder="Add any initial notes about this rep or prospect…" />
        </div>

        {error && <p className="text-sm text-[#D95F5F]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={() => navigate('/admin/reps')}
            className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Rep'}
          </button>
        </div>
      </div>
    </div>
  )
}
