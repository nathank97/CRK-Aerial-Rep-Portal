import { useState, useEffect, useMemo, useRef } from 'react'
import { addDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { documentsCol } from '../../firebase/firestore'
import { db, storage } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { useAllUsers } from '../../hooks/useUsers'
import { formatDate, formatDateTime } from '../../utils/formatters'

const LINK_TYPES = ['Global', 'Lead', 'Customer', 'Order', 'Service Ticket']

const fileIcon = (mimeType = '') => {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊'
  return '📎'
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

function UploadModal({ onClose, isAdmin, dealers }) {
  const { user, profile } = useAuth()
  const fileRef = useRef(null)
  const [files, setFiles] = useState([])
  const [linkType, setLinkType] = useState('Global')
  const [linkedId, setLinkedId] = useState('')
  const [description, setDescription] = useState('')
  const [targetDealerId, setTargetDealerId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  function handleFilePick(e) {
    setFiles(Array.from(e.target.files ?? []))
    setError('')
  }

  async function upload() {
    if (files.length === 0) { setError('Please select at least one file.'); return }
    if (isAdmin && !targetDealerId) { setError('Please select which dealer this document is for.'); return }
    setUploading(true)
    setError('')
    // Dealers always upload to themselves; admins upload to the selected dealer
    const dealerId = isAdmin ? targetDealerId : user.uid
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const path = `documents/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        const storageRef = ref(storage, path)

        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file)
          task.on('state_changed',
            (snap) => setProgress(Math.round(((i + snap.bytesTransferred / snap.totalBytes) / files.length) * 100)),
            reject,
            async () => {
              const url = await getDownloadURL(storageRef)
              await addDoc(documentsCol, {
                fileName: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
                storagePath: path,
                downloadUrl: url,
                dealerId,
                linkType,
                linkedId: linkType === 'Global' ? null : (linkedId.trim() || null),
                description: description.trim(),
                uploadedBy: profile?.displayName ?? user.email,
                uploadedById: user.uid,
                createdAt: serverTimestamp(),
              })
              resolve()
            }
          )
        })
      }
      onClose()
    } catch (e) {
      console.error(e)
      setError('Upload failed. Please try again.')
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Upload Document</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#8B6914] transition-colors"
          >
            {files.length > 0 ? (
              <div>
                {files.map((f) => (
                  <p key={f.name} className="text-sm text-[#1A1A1A] font-medium">{f.name}</p>
                ))}
                <p className="text-xs text-[#9A9A9A] mt-1">{files.length} file{files.length !== 1 ? 's' : ''} selected</p>
              </div>
            ) : (
              <div>
                <p className="text-2xl mb-2">📁</p>
                <p className="text-sm text-[#1A1A1A] font-medium">Click to select files</p>
                <p className="text-xs text-[#9A9A9A] mt-1">PDF, Word, Excel, images, or any file type</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFilePick} />

          {/* Description */}
          <div>
            <label className={labelCls}>Description / Tag</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className={inputCls} placeholder="e.g. Spec sheet, Training guide, Contract…" />
          </div>

          {/* Dealer selector (admin only) */}
          {isAdmin && (
            <div>
              <label className={labelCls}>For Dealer *</label>
              <select value={targetDealerId} onChange={(e) => setTargetDealerId(e.target.value)} className={inputCls}>
                <option value="">— Select dealer —</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>{d.displayName} ({d.email})</option>
                ))}
              </select>
            </div>
          )}

          {/* Link type */}
          <div>
            <label className={labelCls}>Linked To</label>
            <select value={linkType} onChange={(e) => { setLinkType(e.target.value); setLinkedId('') }} className={inputCls}>
              {LINK_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          {linkType !== 'Global' && (
            <div>
              <label className={labelCls}>{linkType} ID</label>
              <input value={linkedId} onChange={(e) => setLinkedId(e.target.value)}
                className={inputCls} placeholder={`Paste the ${linkType.toLowerCase()} record ID…`} />
            </div>
          )}

          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-[#9A9A9A] mb-1">
                <span>Uploading…</span><span>{progress}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#8B6914] rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-[#D95F5F]">{error}</p>}
        </div>
        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button onClick={upload} disabled={uploading}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {uploading ? `Uploading ${progress}%…` : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ doc: docItem, onClose }) {
  const isImage = docItem.mimeType?.startsWith('image/')
  const isPdf = docItem.mimeType === 'application/pdf'

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="font-semibold text-[#1A1A1A]">{docItem.fileName}</p>
            <p className="text-xs text-[#9A9A9A]">{formatBytes(docItem.sizeBytes)} · {docItem.uploadedBy}</p>
          </div>
          <div className="flex items-center gap-3">
            <a href={docItem.downloadUrl} download={docItem.fileName} target="_blank" rel="noreferrer"
              className="text-xs text-[#8B6914] border border-[#8B6914] px-3 py-1.5 rounded-lg hover:bg-[#8B6914]/5 transition-colors">
              Download
            </a>
            <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          {isImage ? (
            <img src={docItem.downloadUrl} alt={docItem.fileName} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
          ) : isPdf ? (
            <iframe src={docItem.downloadUrl} title={docItem.fileName} className="w-full h-[70vh] rounded-lg border border-gray-100" />
          ) : (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">{fileIcon(docItem.mimeType)}</p>
              <p className="text-[#1A1A1A] font-medium">{docItem.fileName}</p>
              <p className="text-sm text-[#9A9A9A] mt-1 mb-4">Preview not available for this file type.</p>
              <a href={docItem.downloadUrl} download={docItem.fileName} target="_blank" rel="noreferrer"
                className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
                Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentLibrary() {
  const { user, isAdmin } = useAuth()
  const { users } = useAllUsers()
  const dealers = useMemo(() => users.filter((u) => u.role === 'dealer').sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? '')), [users])
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLinkType, setFilterLinkType] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [preview, setPreview] = useState(null)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (!user) return
    const q = isAdmin
      ? query(documentsCol, orderBy('createdAt', 'desc'))
      : query(documentsCol, where('dealerId', '==', user.uid), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user?.uid, isAdmin])

  const filtered = useMemo(() => {
    return docs.filter((d) => {
      const matchSearch = !search || [d.fileName, d.description, d.uploadedBy]
        .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      const matchType = !filterLinkType || d.linkType === filterLinkType
      return matchSearch && matchType
    })
  }, [docs, search, filterLinkType])

  async function handleDelete(docItem) {
    setDeleting(docItem.id)
    try {
      // Delete from Storage
      if (docItem.storagePath) {
        try { await deleteObject(ref(storage, docItem.storagePath)) } catch (_) {}
      }
      // Delete from Firestore
      await deleteDoc(doc(db, 'documents', docItem.id))
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(null)
    }
  }

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Document Library</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
          + Upload
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, description, uploader…"
          className={`${inputCls} w-full max-w-xs`} />
        <select value={filterLinkType} onChange={(e) => setFilterLinkType(e.target.value)} className={inputCls}>
          <option value="">All Types</option>
          {LINK_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* Documents grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-xl">
          <p className="text-4xl mb-3">📁</p>
          <p className="text-[#1A1A1A] font-medium">No documents yet</p>
          <p className="text-sm text-[#9A9A9A] mt-1 mb-4">Upload spec sheets, manuals, contracts, and more.</p>
          <button onClick={() => setShowUpload(true)}
            className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
            Upload First Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((docItem) => (
            <div key={docItem.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#F4F4F5] flex items-center justify-center text-xl flex-shrink-0">
                  {fileIcon(docItem.mimeType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1A1A1A] text-sm truncate">{docItem.fileName}</p>
                  {docItem.description && (
                    <p className="text-xs text-[#9A9A9A] truncate mt-0.5">{docItem.description}</p>
                  )}
                  <p className="text-xs text-[#9A9A9A] mt-0.5">{formatBytes(docItem.sizeBytes)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#8B6914]/10 text-[#8B6914]">
                  {docItem.linkType ?? 'Global'}
                </span>
                {docItem.linkedId && (
                  <span className="text-xs text-[#9A9A9A] font-mono truncate">{docItem.linkedId.slice(0, 8)}…</span>
                )}
              </div>

              <p className="text-xs text-[#9A9A9A] mb-3">
                {docItem.uploadedBy} · {formatDate(docItem.createdAt)}
              </p>

              <div className="flex gap-2">
                {(docItem.mimeType?.startsWith('image/') || docItem.mimeType === 'application/pdf') && (
                  <button onClick={() => setPreview(docItem)}
                    className="flex-1 text-xs border border-gray-200 text-[#1A1A1A] py-1.5 rounded-lg hover:bg-[#F4F4F5] transition-colors">
                    Preview
                  </button>
                )}
                <a href={docItem.downloadUrl} download={docItem.fileName} target="_blank" rel="noreferrer"
                  className="flex-1 text-center text-xs bg-[#8B6914] text-white py-1.5 rounded-lg hover:bg-[#7a5c12] transition-colors">
                  Download
                </a>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(docItem)}
                    disabled={deleting === docItem.id}
                    className="text-xs text-[#D95F5F] border border-[#D95F5F]/30 px-2.5 py-1.5 rounded-lg hover:bg-[#D95F5F]/5 transition-colors disabled:opacity-50"
                  >
                    {deleting === docItem.id ? '…' : 'Del'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB for mobile */}
      <button onClick={() => setShowUpload(true)}
        className="fixed bottom-6 right-6 z-40 md:hidden w-14 h-14 bg-[#8B6914] text-white rounded-full shadow-lg text-2xl flex items-center justify-center hover:bg-[#7a5c12] transition-colors">
        +
      </button>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} isAdmin={isAdmin} dealers={dealers} />}
      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
