import { useState } from 'react'
import { addDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { feedbackCol } from '../../firebase/firestore'
import { useMyFeedback } from '../../hooks/useFeedback'
import { formatDate } from '../../utils/formatters'

const TYPES = ['Bug Report', 'Feature Request', 'General Feedback']

const PRIORITIES = [
  { value: 'Critical', label: 'Critical', desc: 'App is broken or unusable', color: 'bg-[#D95F5F]/10 text-[#D95F5F] border-[#D95F5F]/30', dot: 'bg-[#D95F5F]' },
  { value: 'High',     label: 'High',     desc: 'Major issue affecting my workflow', color: 'bg-[#E6A817]/10 text-[#E6A817] border-[#E6A817]/30', dot: 'bg-[#E6A817]' },
  { value: 'Medium',   label: 'Medium',   desc: 'Noticeable issue, workaround exists', color: 'bg-[#4A90B8]/10 text-[#4A90B8] border-[#4A90B8]/30', dot: 'bg-[#4A90B8]' },
  { value: 'Low',      label: 'Low',      desc: 'Minor or cosmetic issue', color: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' },
]

const MODULES = [
  'Dashboard', 'Leads', 'Customers', 'Quotes', 'Orders', 'Invoices',
  'Inventory', 'Service & Repair', 'Documents', 'Map', 'Chat',
  'Profile', 'Admin — Dealers', 'Admin — Catalog', 'Admin — Tax Rates',
  'Admin — Rep Manager', 'Admin — Territories', 'Login / Auth', 'Other',
]

const STATUS_STYLE = {
  New:         'bg-[#4A90B8]/10 text-[#4A90B8]',
  'In Review': 'bg-[#E6A817]/10 text-[#E6A817]',
  'In Progress':'bg-[#8B6914]/10 text-[#8B6914]',
  Resolved:    'bg-[#4CAF7D]/10 text-[#4CAF7D]',
  "Won't Fix": 'bg-gray-100 text-gray-500',
}

const PRIORITY_DOT = {
  Critical: 'bg-[#D95F5F]',
  High:     'bg-[#E6A817]',
  Medium:   'bg-[#4A90B8]',
  Low:      'bg-gray-400',
}

const EMPTY = {
  type: 'Bug Report',
  priority: 'Medium',
  title: '',
  module: '',
  description: '',
  steps: '',
}

export default function FeedbackPage() {
  const { user, profile } = useAuth()
  const { feedback, loading } = useMyFeedback()

  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setError('')
    setSubmitted(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Please enter a title.'); return }
    if (!form.description.trim()) { setError('Please describe the issue.'); return }
    setSaving(true)
    try {
      await addDoc(feedbackCol, {
        type: form.type,
        priority: form.priority,
        title: form.title.trim(),
        module: form.module || null,
        description: form.description.trim(),
        steps: form.steps.trim() || null,
        status: 'New',
        adminPriority: null,
        adminNotes: '',
        submittedByUid: user.uid,
        submitterName: profile?.displayName ?? user.email,
        submitterEmail: user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setForm(EMPTY)
      setSubmitted(true)
    } catch (e) {
      console.error(e)
      setError('Failed to submit. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Feedback & Bug Reports</h1>
        <p className="text-sm text-[#9A9A9A] mt-0.5">Report an issue or suggest an improvement. We review everything.</p>
      </div>

      {/* Submission form */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-5">Submit New Report</h2>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Type */}
          <div>
            <label className={labelCls}>Type</label>
            <div className="flex gap-2 flex-wrap">
              {TYPES.map((t) => (
                <button key={t} type="button"
                  onClick={() => set('type', t)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.type === t
                      ? 'bg-[#8B6914] text-white border-[#8B6914]'
                      : 'bg-white text-[#9A9A9A] border-gray-200 hover:border-[#8B6914]/40'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className={labelCls}>Priority / Severity</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRIORITIES.map(({ value, label, desc, color, dot }) => (
                <button key={value} type="button"
                  onClick={() => set('priority', value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    form.priority === value
                      ? `${color} border-current ring-2 ring-current ring-offset-1`
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className="text-xs font-bold">{label}</span>
                  </div>
                  <p className="text-[10px] text-[#9A9A9A] leading-tight">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Title / Summary *</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)}
              className={inputCls} placeholder="Brief description of the issue or request" />
          </div>

          {/* Module */}
          <div>
            <label className={labelCls}>Which part of the app?</label>
            <select value={form.module} onChange={(e) => set('module', e.target.value)} className={inputCls}>
              <option value="">— Select a module (optional) —</option>
              {MODULES.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description *</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={4} className={inputCls}
              placeholder={form.type === 'Bug Report'
                ? 'What happened? What did you expect to happen?'
                : 'Describe your suggestion or feedback in detail…'} />
          </div>

          {/* Steps to reproduce — only for bug reports */}
          {form.type === 'Bug Report' && (
            <div>
              <label className={labelCls}>Steps to Reproduce</label>
              <textarea value={form.steps} onChange={(e) => set('steps', e.target.value)}
                rows={3} className={inputCls}
                placeholder="1. Go to...\n2. Click...\n3. See error..." />
            </div>
          )}

          {error && <p className="text-sm text-[#D95F5F]">{error}</p>}
          {submitted && (
            <div className="bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 rounded-lg px-4 py-3">
              <p className="text-sm text-[#4CAF7D] font-medium">Submitted! We'll look into it.</p>
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Submitting…' : 'Submit Report'}
          </button>
        </form>
      </div>

      {/* My previous submissions */}
      <div>
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">My Submissions ({feedback.length})</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-16 bg-white border border-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : feedback.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
            <p className="text-sm text-[#9A9A9A]">No submissions yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {feedback.map((item) => (
              <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLE[item.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {item.status}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#9A9A9A]">
                        <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[item.adminPriority ?? item.priority] ?? 'bg-gray-400'}`} />
                        {item.adminPriority ?? item.priority}
                      </span>
                      <span className="text-xs text-[#9A9A9A]">{item.type}</span>
                    </div>
                    <p className="font-medium text-sm text-[#1A1A1A]">{item.title}</p>
                    {item.module && <p className="text-xs text-[#9A9A9A] mt-0.5">{item.module}</p>}
                  </div>
                  <span className="text-xs text-[#9A9A9A] shrink-0">{formatDate(item.createdAt)}</span>
                </div>
                {item.adminNotes && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Admin Response</p>
                    <p className="text-sm text-[#1A1A1A]">{item.adminNotes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
