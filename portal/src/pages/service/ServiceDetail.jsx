import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { useServiceTicket } from '../../hooks/useServiceTickets'
import { useCustomers } from '../../hooks/useCustomers'
import { useAuth } from '../../context/AuthContext'
import { db } from '../../firebase/config'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters'
import StatusBadge from '../../components/common/StatusBadge'

const STATUSES = ['Open', 'In Progress', 'Waiting on Parts', 'Waiting on Customer', 'Resolved', 'Closed']
const PRIORITIES = ['Low', 'Normal', 'High', 'Critical']
const SERVICE_TYPES = ['Repair', 'Maintenance', 'Warranty', 'Inspection', 'Software Update', 'Other']

const priorityColor = {
  Low: 'bg-gray-100 text-gray-500',
  Normal: 'bg-[#4A90B8]/15 text-[#4A90B8]',
  High: 'bg-[#E6A817]/15 text-[#E6A817]',
  Critical: 'bg-[#D95F5F]/15 text-[#D95F5F]',
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">{label}</p>
      <div className="text-sm text-[#1A1A1A]">{children}</div>
    </div>
  )
}

function EditableField({ label, value, field, editing, onChange, type = 'text', options }) {
  if (!editing) {
    return <Field label={label}>{value || '—'}</Field>
  }
  if (options) {
    return (
      <div>
        <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">{label}</label>
        <select value={value ?? ''} onChange={(e) => onChange(field, e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]">
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
    )
  }
  if (type === 'textarea') {
    return (
      <div>
        <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">{label}</label>
        <textarea value={value ?? ''} onChange={(e) => onChange(field, e.target.value)}
          rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]" />
      </div>
    )
  }
  return (
    <div>
      <label className="block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">{label}</label>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(field, e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]" />
    </div>
  )
}

// Parts Used editor
function PartsUsedEditor({ parts, editing, onChange }) {
  function addPart() {
    onChange([...parts, { id: crypto.randomUUID(), name: '', quantity: 1, cost: 0 }])
  }
  function removePart(id) {
    onChange(parts.filter((p) => p.id !== id))
  }
  function updatePart(id, field, value) {
    onChange(parts.map((p) => p.id === id ? { ...p, [field]: value } : p))
  }

  if (!editing) {
    if (!parts || parts.length === 0) return <Field label="Parts Used">None</Field>
    return (
      <Field label="Parts Used">
        <div className="space-y-1 mt-1">
          {parts.map((p, i) => (
            <div key={p.id ?? i} className="flex justify-between text-sm">
              <span>{p.name || 'Unnamed'} × {p.quantity}</span>
              <span className="text-[#9A9A9A]">{formatCurrency(p.cost * p.quantity)}</span>
            </div>
          ))}
        </div>
      </Field>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-2">Parts Used</p>
      {parts.map((p, i) => (
        <div key={p.id ?? i} className="flex gap-2 mb-2 items-center">
          <input value={p.name} onChange={(e) => updatePart(p.id, 'name', e.target.value)}
            placeholder="Part name"
            className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#8B6914]" />
          <input type="number" min="1" value={p.quantity} onChange={(e) => updatePart(p.id, 'quantity', parseInt(e.target.value) || 1)}
            className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[#8B6914]" />
          <input type="number" min="0" step="0.01" value={p.cost} onChange={(e) => updatePart(p.id, 'cost', parseFloat(e.target.value) || 0)}
            placeholder="Cost"
            className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#8B6914]" />
          <button onClick={() => removePart(p.id)} className="text-[#9A9A9A] hover:text-[#D95F5F] text-lg leading-none">×</button>
        </div>
      ))}
      <button onClick={addPart} className="text-xs text-[#8B6914] hover:underline">+ Add Part</button>
    </div>
  )
}

export default function ServiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { ticket, loading } = useServiceTicket(id)
  const { customers } = useCustomers()
  const { isAdmin } = useAuth()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  function startEdit() {
    setDraft({ ...ticket })
    setEditing(true)
  }

  function cancelEdit() {
    setDraft(null)
    setEditing(false)
  }

  function setField(field, value) {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  async function saveChanges() {
    setSaving(true)
    try {
      const updates = {
        subject: draft.subject,
        description: draft.description,
        droneModel: draft.droneModel,
        serialNumber: draft.serialNumber,
        serviceType: draft.serviceType,
        priority: draft.priority,
        status: draft.status,
        assignedToName: draft.assignedToName,
        estimatedCost: draft.estimatedCost != null ? parseFloat(draft.estimatedCost) : null,
        actualCost: draft.actualCost != null ? parseFloat(draft.actualCost) : null,
        laborHours: draft.laborHours != null ? parseFloat(draft.laborHours) : null,
        notes: draft.notes,
        partsUsed: draft.partsUsed ?? [],
        updatedAt: serverTimestamp(),
      }
      if (['Resolved', 'Closed'].includes(draft.status) && !ticket.resolvedAt) {
        updates.resolvedAt = serverTimestamp()
      }
      await updateDoc(doc(db, 'serviceTickets', id), updates)
      setEditing(false)
      setDraft(null)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function quickStatusUpdate(newStatus) {
    const updates = { status: newStatus, updatedAt: serverTimestamp() }
    if (['Resolved', 'Closed'].includes(newStatus) && !ticket.resolvedAt) {
      updates.resolvedAt = serverTimestamp()
    }
    await updateDoc(doc(db, 'serviceTickets', id), updates)
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-6" />
        <div className="bg-white border border-gray-100 rounded-xl p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-4 bg-gray-100 rounded" />)}
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="p-6 text-center">
        <p className="text-[#9A9A9A]">Ticket not found.</p>
        <button onClick={() => navigate('/service')} className="mt-4 text-[#8B6914] hover:underline text-sm">Back to Service</button>
      </div>
    )
  }

  const data = editing ? draft : ticket
  const linkedCustomer = customers.find((c) => c.id === ticket.customerId)
  const partsCost = (data.partsUsed ?? []).reduce((s, p) => s + (p.cost ?? 0) * (p.quantity ?? 1), 0)
  const laborCost = (data.laborHours ?? 0) * 0 // can add hourly rate later
  const totalActual = (data.actualCost ?? 0)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/service')} className="text-[#9A9A9A] hover:text-[#1A1A1A]">←</button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#1A1A1A]">{ticket.ticketNumber}</h1>
              <StatusBadge status={ticket.status} />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${priorityColor[ticket.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                {ticket.priority ?? 'Normal'}
              </span>
            </div>
            <p className="text-sm text-[#9A9A9A] mt-0.5">Opened {formatDate(ticket.createdAt)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!editing ? (
            <button onClick={startEdit}
              className="border border-gray-200 text-[#1A1A1A] px-4 py-2 rounded-lg text-sm hover:bg-[#F4F4F5] transition-colors">
              Edit
            </button>
          ) : (
            <>
              <button onClick={cancelEdit}
                className="border border-gray-200 text-[#1A1A1A] px-4 py-2 rounded-lg text-sm hover:bg-[#F4F4F5] transition-colors">
                Cancel
              </button>
              <button onClick={saveChanges} disabled={saving}
                className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-100">
            {['details', 'resolution'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? 'border-[#8B6914] text-[#8B6914]'
                    : 'border-transparent text-[#9A9A9A] hover:text-[#1A1A1A]'
                }`}>
                {tab === 'details' ? 'Ticket Details' : 'Resolution & Costs'}
              </button>
            ))}
          </div>

          {activeTab === 'details' && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-5">
              <EditableField label="Subject" value={data.subject} field="subject" editing={editing} onChange={setField} />
              <div className="grid grid-cols-2 gap-4">
                <EditableField label="Drone Model" value={data.droneModel} field="droneModel" editing={editing} onChange={setField} />
                <EditableField label="Serial Number" value={data.serialNumber} field="serialNumber" editing={editing} onChange={setField} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <EditableField label="Service Type" value={data.serviceType} field="serviceType" editing={editing} onChange={setField} options={SERVICE_TYPES} />
                <EditableField label="Priority" value={data.priority} field="priority" editing={editing} onChange={setField} options={PRIORITIES} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <EditableField label="Status" value={data.status} field="status" editing={editing} onChange={setField} options={STATUSES} />
                <EditableField label="Assigned To" value={data.assignedToName} field="assignedToName" editing={editing} onChange={setField} />
              </div>
              <EditableField label="Description" value={data.description} field="description" editing={editing} onChange={setField} type="textarea" />
              <EditableField label="Internal Notes" value={data.notes} field="notes" editing={editing} onChange={setField} type="textarea" />
              <EditableField label="Estimated Cost ($)" value={data.estimatedCost} field="estimatedCost" editing={editing} onChange={setField} type="number" />
            </div>
          )}

          {activeTab === 'resolution' && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-5">
              <EditableField label="Actual Cost ($)" value={data.actualCost} field="actualCost" editing={editing} onChange={setField} type="number" />
              <EditableField label="Labor Hours" value={data.laborHours} field="laborHours" editing={editing} onChange={setField} type="number" />
              <PartsUsedEditor
                parts={data.partsUsed ?? []}
                editing={editing}
                onChange={(parts) => setField('partsUsed', parts)}
              />
              {ticket.resolvedAt && (
                <Field label="Resolved At">{formatDateTime(ticket.resolvedAt)}</Field>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick status */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-3">Update Status</p>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => quickStatusUpdate(s)}
                  disabled={ticket.status === s}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                    ticket.status === s
                      ? 'bg-[#8B6914]/10 text-[#8B6914] font-semibold'
                      : 'hover:bg-[#F4F4F5] text-[#1A1A1A]'
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Customer link */}
          {linkedCustomer && (
            <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-2">Customer</p>
              <Link to={`/customers/${linkedCustomer.id}`}
                className="font-medium text-[#8B6914] hover:underline">{linkedCustomer.name}</Link>
              {linkedCustomer.email && <p className="text-xs text-[#9A9A9A] mt-0.5">{linkedCustomer.email}</p>}
              {linkedCustomer.phone && <p className="text-xs text-[#9A9A9A]">{linkedCustomer.phone}</p>}
            </div>
          )}

          {/* Meta */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Ticket Info</p>
            <Field label="Created By">{ticket.createdByName || '—'}</Field>
            <Field label="Created">{formatDate(ticket.createdAt)}</Field>
            <Field label="Last Updated">{formatDate(ticket.updatedAt)}</Field>
            {ticket.estimatedCost != null && (
              <Field label="Estimated Cost">{formatCurrency(ticket.estimatedCost)}</Field>
            )}
            {ticket.actualCost != null && (
              <Field label="Actual Cost">{formatCurrency(ticket.actualCost)}</Field>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
