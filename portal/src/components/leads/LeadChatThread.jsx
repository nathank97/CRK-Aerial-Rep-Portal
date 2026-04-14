import { useState, useRef, useEffect } from 'react'
import { addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '../../firebase/config'
import { leadChatCol } from '../../firebase/firestore'
import { useLeadChat } from '../../hooks/useLeads'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime } from '../../utils/formatters'

export default function LeadChatThread({ leadId }) {
  const { messages, loading } = useLeadChat(leadId)
  const { user, profile } = useAuth()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async ({ messageText, attachmentUrl = null, attachmentName = null } = {}) => {
    const content = messageText ?? text.trim()
    if (!content && !attachmentUrl) return
    setSending(true)
    try {
      await addDoc(leadChatCol(leadId), {
        authorId: user.uid,
        authorName: profile?.displayName ?? 'Unknown',
        text: content,
        attachmentUrl: attachmentUrl ?? null,
        attachmentName: attachmentName ?? null,
        timestamp: serverTimestamp(),
      })
      setText('')
    } finally {
      setSending(false)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `lead-chat/${leadId}/${Date.now()}-${file.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await sendMessage({ messageText: '', attachmentUrl: url, attachmentName: file.name })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const isImage = (name) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name ?? '')

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2" style={{ maxHeight: '420px' }}>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-2">
                <div className="w-7 h-7 bg-gray-100 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                  <div className="h-10 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-[#9A9A9A] text-sm py-6">
            No messages yet. Start the conversation.
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.authorId === user?.uid
            return (
              <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-[#8B6914] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {msg.authorName?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    {!isMine && <span className="text-xs font-semibold text-[#1A1A1A]">{msg.authorName}</span>}
                    <span className="text-xs text-[#9A9A9A]">{formatDateTime(msg.timestamp)}</span>
                  </div>
                  {msg.text && (
                    <div className={`px-3 py-2 rounded-xl text-sm leading-snug ${
                      isMine
                        ? 'bg-[#8B6914] text-white rounded-tr-none'
                        : 'bg-white border border-gray-200 text-[#1A1A1A] rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  )}
                  {msg.attachmentUrl && (
                    <div className="mt-1">
                      {isImage(msg.attachmentName) ? (
                        <a href={msg.attachmentUrl} target="_blank" rel="noreferrer">
                          <img src={msg.attachmentUrl} alt={msg.attachmentName} className="max-w-[200px] rounded-lg border border-gray-200" />
                        </a>
                      ) : (
                        <a
                          href={msg.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 text-xs text-[#4A90B8] hover:underline bg-white border border-gray-200 rounded-lg px-3 py-2"
                        >
                          📎 {msg.attachmentName ?? 'Attachment'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar — pinned to bottom on mobile */}
      <div className="mt-3 flex gap-2 items-end border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="p-2 text-[#9A9A9A] hover:text-[#8B6914] transition-colors shrink-0"
          title="Attach file"
        >
          {uploading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          capture="environment"
          onChange={handleFile}
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Message… (Enter to send)"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] placeholder-[#9A9A9A] focus:outline-none focus:border-[#8B6914] resize-none transition-colors"
        />
        <button
          onClick={() => sendMessage()}
          disabled={sending || !text.trim()}
          className="bg-[#8B6914] hover:bg-[#7a5c11] disabled:opacity-40 text-white p-2 rounded-xl transition-colors shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )
}
