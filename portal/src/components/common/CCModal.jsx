import { useState } from 'react'

export default function CCModal({ title = 'Send Email', presets = [], alwaysCc = [], onCancel, onSend, sending }) {
  const [selectedPresets, setSelectedPresets] = useState([])
  const [manualInput, setManualInput] = useState('')
  const [manualEmails, setManualEmails] = useState([])
  const [inputError, setInputError] = useState('')

  const togglePreset = (email) => {
    setSelectedPresets((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    )
  }

  const addManual = () => {
    const email = manualInput.trim().toLowerCase()
    if (!email) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInputError('Enter a valid email address.')
      return
    }
    if ([...selectedPresets, ...manualEmails].includes(email)) {
      setInputError('Already added.')
      return
    }
    setManualEmails((prev) => [...prev, email])
    setManualInput('')
    setInputError('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addManual() }
  }

  const removeManual = (email) => setManualEmails((prev) => prev.filter((e) => e !== email))

  const handleSend = () => onSend([...selectedPresets, ...manualEmails])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#111111]">{title}</h2>
          <p className="text-xs text-[#9A9A9A] mt-0.5">Optionally add CC recipients before sending.</p>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {alwaysCc.length > 0 && (
            <div className="bg-[#F4F4F5] rounded-lg px-3 py-2">
              <p className="text-xs text-[#9A9A9A]">
                Always CC'd: <span className="font-medium text-[#111111]">{alwaysCc.join(', ')}</span>
              </p>
            </div>
          )}
          {presets.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-2">CC Presets</p>
              <div className="space-y-2">
                {presets.map((preset) => (
                  <label key={preset.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPresets.includes(preset.email)}
                      onChange={() => togglePreset(preset.email)}
                      className="w-4 h-4 accent-[#8B6914] shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-[#111111]">{preset.label}</span>
                      <span className="text-xs text-[#9A9A9A] ml-2">{preset.email}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-2">Add Manually</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={manualInput}
                onChange={(e) => { setManualInput(e.target.value); setInputError('') }}
                onKeyDown={handleKeyDown}
                placeholder="email@example.com"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]"
              />
              <button
                type="button"
                onClick={addManual}
                className="text-sm border border-gray-200 text-[#111111] hover:bg-[#F4F4F5] px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                Add
              </button>
            </div>
            {inputError && <p className="text-xs text-[#D95F5F] mt-1">{inputError}</p>}
            {manualEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {manualEmails.map((email) => (
                  <span key={email} className="flex items-center gap-1 bg-[#F4F4F5] text-[#111111] text-xs px-2.5 py-1 rounded-full">
                    {email}
                    <button
                      onClick={() => removeManual(email)}
                      className="text-[#9A9A9A] hover:text-[#D95F5F] ml-0.5 leading-none text-base"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-gray-100">
          <button
            onClick={onCancel}
            disabled={sending}
            className="flex-1 border border-gray-200 text-[#111111] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#7a5c12] disabled:opacity-50 transition-colors"
          >
            {sending ? 'Sending…' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  )
}
