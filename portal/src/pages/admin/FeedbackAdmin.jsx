import { useState, useMemo } from 'react'
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { useAllFeedback } from '../../hooks/useFeedback'
import { db } from '../../firebase/config'
import { formatDate, formatDateTime } from '../../utils/formatters'

const STATUSES = ['New', 'In Review', 'In Progress', 'Resolved', "Won't Fix"]
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']
const TYPES = ['Bug Report', 'Feature Request', 'General Feedback']

const STATUS_STYLE = {
  New:          'bg-[#4A90B8]/10 text-[#4A90B8]',
  'In Review':  'bg-[#E6A817]/10 text-[#E6A817]',
  'In Progress':'bg-[#8B6914]/10 text-[#8B6914]',
  Resolved:     'bg-[#4CAF7D]/10 text-[#4CAF7D]',
  "Won't Fix":  'bg-gray-100 text-gray-500',
}

const PRIORITY_STYLE = {
  Critical: 'bg-[#D95F5F]/10 text-[#D95F5F]',
  High:     'bg-[#E6A817]/10 text-[#E6A817]',
  Medium:   'bg-[#4A90B8]/10 text-[#4A90B8]',
  Low:      'bg-gray-100 text-gray-500',
}

const PRIORITY_DOT = {
  Critical: 'bg-[#D95F5F]',
  High:     'bg-[#E6A817]',
  Medium:   'bg-[#4A90B8]',
  Low:      'bg-gray-400',
}

const PRIORITY_SORT = { Critical: 0, High: 1, Medium: 2, Low: 3 }

function DetailPanel({ item, onClose }) {
  const [status, setStatus] = useState(item.status ?? 'New')
  const [adminPriority, setAdminPriority] = useState(item.adminPriority ?? item.priority ?? 'Medium')
  const [adminNotes, setAdminNotes] = useState(item.adminNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  async function save() {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'feedback', item.id), {
        status,
        adminPriority,
        adminNotes: adminNotes.trim(),
        updatedAt: serverTimestamp(),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${PRIORITY_STYLE[item.adminPriority ?? item.priority]}`}>
                {item.adminPriority ?? item.priority}
              </span>
              <span className="text-xs text-[#9A9A9A]">{item.type}</span>
              {item.module && <span className="text-xs text-[#9A9A9A]">· {item.module}</span>}
            </div>
            <h2 className="font-bold text-[#1A1A1A] text-base leading-tight">{item.title}</h2>
            <p className="text-xs text-[#9A9A9A] mt-0.5">
              {item.submitterName} · {formatDateTime(item.createdAt)}
            </p>
          </div>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl shrink-0">×</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Description */}
          <div>
            <p className={labelCls}>Description</p>
            <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap bg-[#F4F4F5] rounded-lg p-3">{item.description}</p>
          </div>

          {/* Steps to reproduce */}
          {item.steps && (
            <div>
              <p className={labelCls}>Steps to Reproduce</p>
              <p className="text-sm text-[#1A1A1A] whitespace-pre-wrap bg-[#F4F4F5] rounded-lg p-3">{item.steps}</p>
            </div>
          )}

          {/* Submitted priority (read-only) */}
          <div>
            <p className={labelCls}>Submitted Priority</p>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${PRIORITY_STYLE[item.priority]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[item.priority]}`} />
              {item.priority}
            </span>
          </div>

          <hr className="border-gray-100" />

          {/* Admin controls */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Status</label>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setSaved(false) }} className={inputCls}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Admin Priority Override</label>
              <select value={adminPriority} onChange={(e) => { setAdminPriority(e.target.value); setSaved(false) }} className={inputCls}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Admin Notes / Response</label>
            <textarea value={adminNotes} onChange={(e) => { setAdminNotes(e.target.value); setSaved(false) }}
              rows={4} className={inputCls}
              placeholder="Internal notes or response visible to the submitter…" />
          </div>

          {saved && <p className="text-sm text-[#4CAF7D]">Changes saved.</p>}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Close
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FeedbackAdmin() {
  const { feedback, loading } = useAllFeedback()
  const [selected, setSelected] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'

  const filtered = useMemo(() => {
    return feedback
      .filter((f) => !filterStatus || f.status === filterStatus)
      .filter((f) => !filterPriority || (f.adminPriority ?? f.priority) === filterPriority)
      .filter((f) => !filterType || f.type === filterType)
      .filter((f) => !search || [f.title, f.description, f.submitterName, f.submitterEmail, f.module]
        .some((v) => v?.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => {
        const pa = PRIORITY_SORT[a.adminPriority ?? a.priority] ?? 3
        const pb = PRIORITY_SORT[b.adminPriority ?? b.priority] ?? 3
        if (pa !== pb) return pa - pb
        return 0
      })
  }, [feedback, filterStatus, filterPriority, filterType, search])

  // Summary counts
  const openCount = feedback.filter((f) => !['Resolved', "Won't Fix"].includes(f.status)).length
  const criticalCount = feedback.filter((f) => (f.adminPriority ?? f.priority) === 'Critical' && !['Resolved', "Won't Fix"].includes(f.status)).length
  const newCount = feedback.filter((f) => f.status === 'New').length

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Feedback & Bug Reports</h1>
        <p className="text-sm text-[#9A9A9A] mt-0.5">{feedback.length} total submission{feedback.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-[#4A90B8]">{openCount}</p>
          <p className="text-xs text-[#9A9A9A] mt-0.5">Open Issues</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-[#D95F5F]">{criticalCount}</p>
          <p className="text-xs text-[#9A9A9A] mt-0.5">Critical (Open)</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-bold text-[#E6A817]">{newCount}</p>
          <p className="text-xs text-[#9A9A9A] mt-0.5">Awaiting Review</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, submitter, module…"
          className={`${inputCls} w-full max-w-xs`} />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className={inputCls}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={inputCls}>
          <option value="">All Types</option>
          {TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-white border border-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
          <p className="text-[#9A9A9A] text-sm">
            {feedback.length === 0 ? 'No feedback submissions yet.' : 'No submissions match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const effectivePriority = item.adminPriority ?? item.priority
            return (
              <button key={item.id} onClick={() => setSelected(item)}
                className="w-full bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[#8B6914]/20 transition-all text-left">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {/* Priority dot + badge */}
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${PRIORITY_STYLE[effectivePriority]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[effectivePriority]}`} />
                        {effectivePriority}
                        {item.adminPriority && item.adminPriority !== item.priority && (
                          <span className="opacity-60">(was {item.priority})</span>
                        )}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLE[item.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {item.status}
                      </span>
                      <span className="text-xs text-[#9A9A9A]">{item.type}</span>
                      {item.module && <span className="text-xs text-[#9A9A9A]">· {item.module}</span>}
                    </div>
                    <p className="font-semibold text-sm text-[#1A1A1A] truncate">{item.title}</p>
                    <p className="text-xs text-[#9A9A9A] mt-0.5 line-clamp-1">{item.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-[#1A1A1A]">{item.submitterName}</p>
                    <p className="text-xs text-[#9A9A9A]">{formatDate(item.createdAt)}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {selected && <DetailPanel item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
