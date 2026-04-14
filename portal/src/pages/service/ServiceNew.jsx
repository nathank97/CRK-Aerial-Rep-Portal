import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { addDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { useCustomers } from '../../hooks/useCustomers'
import { useDealers } from '../../hooks/useUsers'
import { serviceTicketsCol } from '../../firebase/firestore'
import { nextTicketNumber } from '../../utils/numbering'

const STATUSES = ['Open', 'In Progress', 'Waiting on Parts', 'Waiting on Customer', 'Resolved', 'Closed']
const PRIORITIES = ['Low', 'Normal', 'High', 'Critical']
const SERVICE_TYPES = ['Repair', 'Maintenance', 'Warranty', 'Inspection', 'Software Update', 'Other']

export default function ServiceNew() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, profile, isAdmin } = useAuth()
  const { customers } = useCustomers()
  const { dealers } = useDealers()

  const [customerId, setCustomerId] = useState(params.get('customerId') ?? '')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [droneModel, setDroneModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [serviceType, setServiceType] = useState('Repair')
  const [priority, setPriority] = useState('Normal')
  const [status, setStatus] = useState('Open')
  const [assignedToName, setAssignedToName] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedCustomer = customers.find((c) => c.id === customerId)

  async function handleSave() {
    if (!subject.trim()) { setError('Subject is required.'); return }
    setSaving(true)
    try {
      const ticketNumber = await nextTicketNumber()
      await addDoc(serviceTicketsCol, {
        ticketNumber,
        dealerId: isAdmin ? (selectedCustomer?.assignedDealerId ?? user.uid) : user.uid,
        customerId: customerId || null,
        customerName: selectedCustomer?.name || '',
        subject: subject.trim(),
        description: description.trim(),
        droneModel: droneModel.trim(),
        serialNumber: serialNumber.trim(),
        serviceType,
        priority,
        status,
        assignedToName: assignedToName.trim(),
        estimatedCost: estimatedCost !== '' ? parseFloat(estimatedCost) : null,
        actualCost: null,
        notes: notes.trim(),
        createdBy: user.uid,
        createdByName: profile?.displayName || user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        resolvedAt: null,
        partsUsed: [],
        laborHours: null,
      })
      navigate('/service')
    } catch (e) {
      console.error(e)
      setError('Failed to create ticket. Please try again.')
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/service')} className="text-[#9A9A9A] hover:text-[#1A1A1A] transition-colors">
          ← Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">New Service Ticket</h1>
          <p className="text-sm text-[#9A9A9A]">Auto-assigns ticket number on save</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-5">
        {/* Customer */}
        <div>
          <label className={labelCls}>Customer</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
            <option value="">— No customer linked —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ''}</option>)}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className={labelCls}>Subject *</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of the issue"
            className={inputCls} />
        </div>

        {/* Drone Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Drone Model</label>
            <input value={droneModel} onChange={(e) => setDroneModel(e.target.value)}
              placeholder="e.g. DJI Agras T50"
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Serial Number</label>
            <input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Unit serial #"
              className={inputCls} />
          </div>
        </div>

        {/* Service Type + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Service Type</label>
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className={inputCls}>
              {SERVICE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Status + Assigned To */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Assigned To</label>
            <input value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)}
              placeholder="Technician name"
              className={inputCls} />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description / Issue Details</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            rows={4} placeholder="Describe the issue, symptoms, and any troubleshooting steps already taken…"
            className={inputCls} />
        </div>

        {/* Estimated Cost */}
        <div>
          <label className={labelCls}>Estimated Cost ($)</label>
          <input type="number" min="0" step="0.01" value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            placeholder="0.00"
            className={inputCls} />
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Internal Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={2} placeholder="Internal notes (not shown to customer)…"
            className={inputCls} />
        </div>

        {error && <p className="text-sm text-[#D95F5F]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button onClick={() => navigate('/service')}
            className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Ticket'}
          </button>
        </div>
      </div>
    </div>
  )
}
