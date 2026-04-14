import { useState } from 'react'
import { addDoc, serverTimestamp } from 'firebase/firestore'
import { useLeadActivity } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthContext'
import { leadActivityCol } from '../../firebase/firestore'
import { formatDateTime } from '../../utils/formatters'

const ACTIVITY_TYPES = ['Call', 'Email Sent', 'Note', 'Meeting', 'Demo', 'Quote Sent']

const TYPE_ICONS = {
  Call: '📞',
  'Email Sent': '✉️',
  Note: '📝',
  'Status Change': '🔄',
  Meeting: '🤝',
  Demo: '🚁',
  'Quote Sent': '📋',
}

export default function LeadActivityLog({ leadId }) {
  const { activity, loading } = useLeadActivity(leadId)
  const { profile } = useAuth()
  const [type, setType] = useState('Note')
  const [details, setDetails] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!details.trim()) return
    setSaving(true)
    try {
      await addDoc(leadActivityCol(leadId), {
        type,
        details: details.trim(),
        createdByName: profile?.displayName ?? 'Unknown',
        createdById: profile?.uid,
        timestamp: serverTimestamp(),
      })
      setDetails('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Add entry form */}
      <form onSubmit={handleSubmit} className="mb-5 bg-[#F4F4F5] rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Log Activity</h3>
        <div className="flex gap-2 flex-wrap">
          {ACTIVITY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                type === t
                  ? 'bg-[#8B6914] text-white border-[#8B6914]'
                  : 'bg-white text-[#9A9A9A] border-gray-200 hover:border-[#8B6914] hover:text-[#8B6914]'
              }`}
            >
              {TYPE_ICONS[t]} {t}
            </button>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Add details…"
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1A1A1A] placeholder-[#9A9A9A] focus:outline-none focus:border-[#8B6914] resize-none bg-white transition-colors"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !details.trim()}
            className="bg-[#8B6914] hover:bg-[#7a5c11] disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Log'}
          </button>
        </div>
      </form>

      {/* Activity feed */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : activity.length === 0 ? (
        <p className="text-center text-[#9A9A9A] text-sm py-6">No activity yet.</p>
      ) : (
        <div className="space-y-1">
          {activity.map((entry) => (
            <div key={entry.id} className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
              <div className="w-8 h-8 rounded-full bg-[#8B6914]/10 flex items-center justify-center text-sm shrink-0">
                {TYPE_ICONS[entry.type] ?? '•'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#1A1A1A]">{entry.type}</span>
                  {entry.type === 'Status Change' && entry.previousStatus && (
                    <span className="text-xs text-[#9A9A9A]">
                      {entry.previousStatus} → {entry.newStatus}
                    </span>
                  )}
                  <span className="text-xs text-[#9A9A9A] ml-auto">{formatDateTime(entry.timestamp)}</span>
                </div>
                {entry.details && (
                  <p className="text-sm text-[#1A1A1A] mt-0.5">{entry.details}</p>
                )}
                <p className="text-xs text-[#9A9A9A] mt-0.5">by {entry.createdByName}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
