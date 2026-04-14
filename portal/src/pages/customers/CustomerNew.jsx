import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { addDoc, serverTimestamp } from 'firebase/firestore'
import { customersCol } from '../../firebase/firestore'
import { useDealers } from '../../hooks/useUsers'
import { useAuth } from '../../context/AuthContext'

const EXEMPTION_TYPES = ['Agricultural Producer', 'Reseller', 'Non-Profit', 'Other']

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'
const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

export default function CustomerNew() {
  const navigate = useNavigate()
  const { dealers } = useDealers()
  const { user, profile, isAdmin } = useAuth()

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    assignedDealerId: '',
    taxExempt: false,
    exemptionType: '',
    exemptionCertificate: '',
    exemptionNotes: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSave() {
    if (!form.firstName.trim()) { setError('First name is required.'); return }
    setSaving(true)
    try {
      const linkedDealer = dealers.find((d) => d.id === form.assignedDealerId)
      const assignedDealerId = isAdmin
        ? (form.assignedDealerId || null)
        : (user?.uid ?? null)
      const assignedDealerName = isAdmin
        ? (linkedDealer?.displayName ?? null)
        : (profile?.displayName ?? null)

      const now = serverTimestamp()
      const ref = await addDoc(customersCol, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        assignedDealerId,
        assignedDealerName,
        taxExempt: form.taxExempt,
        exemptionType: form.taxExempt ? (form.exemptionType || null) : null,
        exemptionCertificate: form.taxExempt ? (form.exemptionCertificate.trim() || null) : null,
        exemptionNotes: form.taxExempt ? (form.exemptionNotes.trim() || null) : null,
        notes: form.notes.trim() || null,
        sourceLeadId: null,
        createdByName: profile?.displayName ?? user?.email ?? 'Unknown',
        createdById: user?.uid ?? null,
        createdAt: now,
        updatedAt: now,
      })
      navigate(`/customers/${ref.id}`)
    } catch (e) {
      console.error(e)
      setError('Failed to save customer. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/customers" className="text-[#9A9A9A] hover:text-[#1A1A1A] text-sm transition-colors">← Customers</Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Add Customer</h1>
          <p className="text-sm text-[#9A9A9A]">Create a new customer record manually</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-5">

        {/* Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name *</label>
            <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)}
              className={inputCls} placeholder="Jane" />
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)}
              className={inputCls} placeholder="Smith" />
          </div>
        </div>

        {/* Company */}
        <div>
          <label className={labelCls}>Company</label>
          <input value={form.company} onChange={(e) => set('company', e.target.value)}
            className={inputCls} placeholder="Smith Farms LLC" />
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
              className={inputCls} placeholder="jane@example.com" />
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)}
              className={inputCls} placeholder="(555) 000-0000" />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className={labelCls}>Address</label>
          <input value={form.address} onChange={(e) => set('address', e.target.value)}
            className={inputCls} placeholder="123 Main St, City, State" />
        </div>

        {/* Assigned dealer — admin only */}
        {isAdmin && (
          <div>
            <label className={labelCls}>Assigned Rep</label>
            <select value={form.assignedDealerId} onChange={(e) => set('assignedDealerId', e.target.value)} className={inputCls}>
              <option value="">— Unassigned —</option>
              {dealers.map((d) => <option key={d.id} value={d.id}>{d.displayName}</option>)}
            </select>
          </div>
        )}

        {/* Tax exemption */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Tax Exemption</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.taxExempt} onChange={(e) => set('taxExempt', e.target.checked)}
                className="w-4 h-4 accent-[#8B6914] rounded" />
              <span className="text-sm text-[#1A1A1A]">Tax Exempt</span>
            </label>
          </div>

          {form.taxExempt && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Exemption Type</label>
                <select value={form.exemptionType} onChange={(e) => set('exemptionType', e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {EXEMPTION_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Certificate #</label>
                <input value={form.exemptionCertificate} onChange={(e) => set('exemptionCertificate', e.target.value)}
                  className={inputCls} placeholder="Optional" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Exemption Notes</label>
                <textarea value={form.exemptionNotes} onChange={(e) => set('exemptionNotes', e.target.value)}
                  rows={2} className={`${inputCls} resize-none`} />
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
            rows={3} className={`${inputCls} resize-none`} placeholder="Any additional notes about this customer…" />
        </div>

        {error && <p className="text-sm text-[#D95F5F]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Link to="/customers"
            className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm text-center hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Create Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}
