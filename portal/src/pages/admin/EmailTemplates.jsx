import { useState, useEffect } from 'react'
import { setDoc, serverTimestamp } from 'firebase/firestore'
import { emailTemplatesDoc } from '../../firebase/firestore'
import { useEmailTemplate, DEFAULT_QUOTE_SUBJECT, DEFAULT_QUOTE_BODY } from '../../hooks/useEmailTemplate'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'
const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

const PLACEHOLDERS = [
  { key: '{{quoteNumber}}', desc: 'Quote number (e.g. Q-0001)' },
  { key: '{{customerName}}', desc: 'Customer or lead name' },
  { key: '{{projectName}}', desc: 'Project name' },
  { key: '{{total}}', desc: 'Quote total (e.g. $12,500.00)' },
  { key: '{{dealerName}}', desc: "Rep's display name" },
]

export default function EmailTemplates() {
  const { template, loading } = useEmailTemplate()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading) {
      setSubject(template.quoteSubject)
      setBody(template.quoteBody)
    }
  }, [loading, template])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await setDoc(emailTemplatesDoc, {
        quoteSubject: subject.trim() || DEFAULT_QUOTE_SUBJECT,
        quoteBody: body.trim() || DEFAULT_QUOTE_BODY,
        updatedAt: serverTimestamp(),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error(err)
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="bg-white rounded-xl border border-gray-200 h-64" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Email Templates</h1>
        <p className="text-sm text-[#9A9A9A] mt-0.5">
          Customize the email that pre-fills when a rep clicks "Send Quote". The rep attaches the PDF and sends from their own email client.
        </p>
      </div>

      {/* Placeholder reference */}
      <div className="bg-[#F4F4F5] rounded-xl p-4 mb-6">
        <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-3">Available Placeholders</p>
        <div className="space-y-2">
          {PLACEHOLDERS.map(({ key, desc }) => (
            <div key={key} className="flex items-center gap-3 text-sm">
              <code className="font-mono text-[#8B6914] bg-white border border-gray-200 px-2 py-0.5 rounded text-xs shrink-0">
                {key}
              </code>
              <span className="text-[#9A9A9A]">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
        <div>
          <label className={labelCls}>Email Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={DEFAULT_QUOTE_SUBJECT}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Email Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className={`${inputCls} resize-y font-mono`}
          />
          <p className="text-xs text-[#9A9A9A] mt-1.5">
            This opens pre-filled in the rep's email app. They attach the PDF before hitting send.
          </p>
        </div>

        {error && (
          <div className="bg-[#D95F5F]/10 border border-[#D95F5F]/30 rounded-lg px-4 py-2 text-sm text-[#D95F5F]">
            {error}
          </div>
        )}

        {saved && (
          <div className="bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 rounded-lg px-4 py-2 text-sm text-[#4CAF7D]">
            Template saved successfully.
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={() => { setSubject(DEFAULT_QUOTE_SUBJECT); setBody(DEFAULT_QUOTE_BODY) }}
            className="text-sm text-[#9A9A9A] hover:text-[#1A1A1A] transition-colors"
          >
            Reset to default
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-[#8B6914] hover:bg-[#7a5c11] text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </form>
    </div>
  )
}
