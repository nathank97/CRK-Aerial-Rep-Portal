import { useState, useRef, useEffect } from 'react'
import { addDoc, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, limit } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { globalChatCol } from '../../firebase/firestore'
import { db, storage } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime } from '../../utils/formatters'

const AVATAR_COLORS = [
  '#8B6914', '#4A90B8', '#4CAF7D', '#9B59B6', '#E6A817', '#D95F5F', '#2ECC71', '#3498DB',
]

function avatarColor(name = '') {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function isImage(name = '') {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(name)
}

function Avatar({ name }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: avatarColor(name) }}
    >
      {(name ?? '?')[0].toUpperCase()}
    </div>
  )
}

export default function ChatPage() {
  const { user, profile, isAdmin } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Real-time listener — last 200 messages
  useEffect(() => {
    const q = query(globalChatCol, orderBy('timestamp', 'asc'), limit(200))
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage({ messageText, attachmentUrl = null, attachmentName = null } = {}) {
    const content = messageText ?? text.trim()
    if (!content && !attachmentUrl) return
    setSending(true)
    try {
      await addDoc(globalChatCol, {
        authorId: user.uid,
        authorName: profile?.displayName ?? user.email,
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

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `global-chat/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await sendMessage({ messageText: '', attachmentUrl: url, attachmentName: file.name })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleDelete(msgId) {
    try {
      await deleteDoc(doc(db, 'globalChat', msgId))
    } catch (e) {
      console.error(e)
    } finally {
      setDeleteConfirm(null)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Group messages by date
  function dateLabel(msg) {
    if (!msg.timestamp) return ''
    const d = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  const messagesWithDividers = []
  let lastDate = ''
  for (const msg of messages) {
    const label = dateLabel(msg)
    if (label && label !== lastDate) {
      messagesWithDividers.push({ _divider: true, label, id: `div-${label}` })
      lastDate = label
    }
    messagesWithDividers.push(msg)
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-3.5 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-[#1A1A1A]">Team Chat</h1>
          <p className="text-xs text-[#9A9A9A]">Shared channel · all dealers and admin</p>
        </div>
        <div className="text-xs text-[#9A9A9A]">{messages.length} messages</div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loading ? (
          <div className="space-y-4 pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                  <div className="h-10 bg-gray-100 rounded-xl w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="font-semibold text-[#1A1A1A]">No messages yet</p>
            <p className="text-sm text-[#9A9A9A] mt-1">Start the team conversation below.</p>
          </div>
        ) : (
          messagesWithDividers.map((item) => {
            if (item._divider) {
              return (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-[#9A9A9A] font-medium">{item.label}</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )
            }

            const msg = item
            const isMine = msg.authorId === user?.uid

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 group ${isMine ? 'flex-row-reverse' : ''} mb-2`}
              >
                <Avatar name={msg.authorName} />

                <div className={`flex flex-col max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <span className="text-xs font-semibold text-[#1A1A1A]">{msg.authorName}</span>
                    <span className="text-xs text-[#9A9A9A]">{formatDateTime(msg.timestamp)}</span>
                  </div>

                  {msg.text && (
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isMine
                        ? 'bg-[#8B6914] text-white rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-[#1A1A1A] rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  )}

                  {msg.attachmentUrl && (
                    <div className="mt-1.5">
                      {isImage(msg.attachmentName) ? (
                        <a href={msg.attachmentUrl} target="_blank" rel="noreferrer">
                          <img src={msg.attachmentUrl} alt={msg.attachmentName}
                            className="max-w-[240px] rounded-xl border border-gray-200 hover:opacity-90 transition-opacity" />
                        </a>
                      ) : (
                        <a href={msg.attachmentUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 text-xs text-[#4A90B8] hover:underline bg-white border border-gray-200 rounded-xl px-3 py-2">
                          📎 {msg.attachmentName ?? 'Attachment'}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Delete button (admin can delete any, user can delete own) */}
                  {(isAdmin || isMine) && (
                    <button
                      onClick={() => setDeleteConfirm(msg.id)}
                      className="text-xs text-[#9A9A9A] hover:text-[#D95F5F] mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 py-3">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="p-2.5 text-[#9A9A9A] hover:text-[#8B6914] transition-colors flex-shrink-0 rounded-xl hover:bg-[#F4F4F5]"
            title="Attach file"
          >
            {uploading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Message the team… (Enter to send)"
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm text-[#1A1A1A] placeholder-[#9A9A9A] focus:outline-none focus:border-[#8B6914] resize-none transition-colors"
            style={{ minHeight: 42 }}
          />

          <button
            onClick={() => sendMessage()}
            disabled={sending || !text.trim()}
            className="bg-[#8B6914] hover:bg-[#7a5c12] disabled:opacity-40 text-white p-2.5 rounded-2xl transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-[#1A1A1A] mb-2">Delete message?</h3>
            <p className="text-sm text-[#9A9A9A] mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#c44f4f] transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
