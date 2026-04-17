import { useState, useMemo, useRef } from 'react'
import { addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { useCatalog } from '../../hooks/useCatalog'
import { catalogCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { formatCurrency } from '../../utils/formatters'

const ITEM_TYPES = ['Drone', 'Part', 'Accessory', 'Service', 'Other']

const typeColor = {
  Drone: 'bg-[#8B6914]/10 text-[#8B6914]',
  Part: 'bg-[#4A90B8]/10 text-[#4A90B8]',
  Accessory: 'bg-[#4CAF7D]/10 text-[#4CAF7D]',
  Service: 'bg-[#9B59B6]/10 text-[#9B59B6]',
  Other: 'bg-gray-100 text-gray-500',
}

const EMPTY_FORM = {
  name: '',
  type: 'Drone',
  sku: '',
  msrp: '',
  cost: '',
  description: '',
  manufacturer: '',
  imageUrl: '',
  notes: '',
  active: true,
  tags: '',
  tier1: '',
  tier2: '',
  tier3: '',
}

// ─── CSV Import ──────────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = ['Manufacturer','Item/Kit','Internal Reference','Tags','Sales Price']
const TEMPLATE_SAMPLE = [
  ['DJI','DJI Agras T50','DJI-T50','Drone','15000'],
  ['DJI','Replacement Battery','BAT-T50','Part','450'],
  ['XAG','Nozzle Kit','NOZ-001','Accessory','89'],
]

// Flexible column name aliases → our field name
const COL_ALIASES = {
  name:         ['name','item/kit','itemkit','item','kit','productname','itemname','title','product'],
  sku:          ['internalreference','internalref','referenceinterne','sku','partnumber','partno','part#','itemno','code','itemcode','partnr'],
  tags:         ['tags','tag','labels','label','categories'],
  msrp:         ['salesprice','saleprice','msrp','price','listprice','retailprice','sellingprice','retail','msrpprice','unitprice'],
  manufacturer: ['manufacturer','brand','make','vendor','supplier','mfr','mfg'],
}

function normalizeHeader(h) {
  return h.toLowerCase().replace(/[\s_\-]/g, '').replace(/[^a-z0-9#]/g, '')
}

function mapHeaders(rawHeaders) {
  // Returns { fieldName: columnIndex } for recognised columns
  const map = {}
  rawHeaders.forEach((h, i) => {
    const norm = normalizeHeader(h)
    for (const [field, aliases] of Object.entries(COL_ALIASES)) {
      if (aliases.includes(norm) && !(field in map)) {
        map[field] = i
      }
    }
  })
  return map
}

function parseCSVText(text) {
  // RFC-4180 compliant parser
  const lines = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if ((ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) && !inQ) {
      if (ch === '\r') i++
      lines.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur) lines.push(cur)

  return lines.map((line) => {
    const fields = []
    let f = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        if (inQuote && line[i + 1] === '"') { f += '"'; i++ }
        else inQuote = !inQuote
      } else if (c === ',' && !inQuote) {
        fields.push(f.trim())
        f = ''
      } else {
        f += c
      }
    }
    fields.push(f.trim())
    return fields
  })
}

function sanitizePrice(v) {
  // Strip currency symbols, spaces, and commas before parsing (e.g. "$15,000.00" → "15000.00")
  if (v === '' || v == null) return ''
  return String(v).replace(/[$€£,\s]/g, '').trim()
}

function validateRow(row, idx) {
  const errors = []
  if (!row.name?.trim()) errors.push('Name is required')
  // MSRP optional — defaults to 0 if blank/missing
  const cleanPrice = sanitizePrice(row.msrp)
  if (cleanPrice !== '' && isNaN(parseFloat(cleanPrice))) errors.push('Sales Price must be a number')
  return errors
}

function normalizeType(raw) {
  if (!raw) return 'Part'
  const lower = raw.toLowerCase().trim()
  if (lower.includes('drone')) return 'Drone'
  if (lower.includes('part')) return 'Part'
  if (lower.includes('access')) return 'Accessory'
  if (lower.includes('service')) return 'Service'
  if (ITEM_TYPES.includes(raw.trim())) return raw.trim()
  return 'Part'
}

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE]
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'crk_catalog_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function ImportModal({ onClose, existingSkus }) {
  const fileRef = useRef(null)
  const [parsed, setParsed] = useState(null)   // { rows, colMap, rawHeaders }
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total }
  const [done, setDone] = useState(false)
  const [importError, setImportError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [skipDupes, setSkipDupes] = useState(true)

  function processFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      setImportError('Please select a .csv file.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const lines = parseCSVText(text)
      if (lines.length < 2) { setImportError('CSV appears to be empty or has no data rows.'); return }
      const rawHeaders = lines[0]
      const colMap = mapHeaders(rawHeaders)
      if (!('name' in colMap)) {
        setImportError("Couldn't detect a 'Name' column. Check that your CSV has a header row and matches the template.")
        return
      }
      const rows = lines.slice(1)
        .filter((r) => r.some((c) => c.trim()))  // skip blank lines
        .map((fields, idx) => {
          const get = (field) => (colMap[field] !== undefined ? (fields[colMap[field]] ?? '') : '')
          const rawTags = get('tags')
          const row = {
            name: get('name'),
            type: normalizeType(rawTags),
            sku: get('sku'),
            msrp: sanitizePrice(get('msrp')),
            manufacturer: get('manufacturer'),
            tags: rawTags,
          }
          row._errors = validateRow(row, idx)
          row._isDupe = skipDupes && !!row.sku && existingSkus.has(row.sku.trim())
          return row
        })
      setParsed({ rows, colMap, rawHeaders })
      setImportError('')
    }
    reader.readAsText(file)
  }

  function handleFile(e) { processFile(e.target.files?.[0]) }
  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    processFile(e.dataTransfer.files?.[0])
  }

  const validRows = parsed?.rows.filter((r) => r._errors.length === 0 && !r._isDupe) ?? []
  const errorRows = parsed?.rows.filter((r) => r._errors.length > 0) ?? []
  const dupeRows  = parsed?.rows.filter((r) => r._errors.length === 0 && r._isDupe) ?? []

  async function handleImport() {
    if (!validRows.length) return
    setImporting(true)
    setProgress({ done: 0, total: validRows.length })
    try {
      // Firestore batch limit = 500; chunk accordingly
      const CHUNK = 400
      let done = 0
      for (let i = 0; i < validRows.length; i += CHUNK) {
        const chunk = validRows.slice(i, i + CHUNK)
        const batch = writeBatch(db)
        const now = serverTimestamp()
        chunk.forEach((row) => {
          const ref = doc(catalogCol)
          batch.set(ref, {
            name: row.name.trim(),
            type: row.type,
            sku: row.sku.trim(),
            msrp: parseFloat(row.msrp) || 0,
            manufacturer: row.manufacturer.trim(),
            tags: row.tags.trim() || null,
            active: true,
            createdAt: now,
            updatedAt: now,
          })
        })
        await batch.commit()
        done += chunk.length
        setProgress({ done, total: validRows.length })
      }
      setDone(true)
    } catch (e) {
      console.error(e)
      setImportError('Import failed: ' + e.message)
    } finally {
      setImporting(false)
    }
  }

  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Import Catalog from CSV</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {done ? (
            // ── Success state ──
            <div className="text-center py-10">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-lg font-bold text-[#1A1A1A]">{validRows.length} item{validRows.length !== 1 ? 's' : ''} imported successfully</p>
              <p className="text-sm text-[#9A9A9A] mt-1">They're now live in your catalog.</p>
              <button onClick={onClose}
                className="mt-6 px-6 py-2.5 bg-[#8B6914] text-white rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Template download */}
              <div className="flex items-center justify-between bg-[#F4F4F5] rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#1A1A1A]">Need a template?</p>
                  <p className="text-xs text-[#9A9A9A] mt-0.5">Download a pre-formatted CSV with sample rows to fill in.</p>
                </div>
                <button onClick={downloadTemplate}
                  className="text-sm text-[#8B6914] border border-[#8B6914]/30 px-3 py-1.5 rounded-lg hover:bg-[#8B6914]/5 transition-colors font-medium whitespace-nowrap">
                  ↓ Template
                </button>
              </div>

              {/* Drop zone */}
              {!parsed && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                    dragOver ? 'border-[#8B6914] bg-[#8B6914]/5' : 'border-gray-200 hover:border-[#8B6914]/50 hover:bg-[#F4F4F5]'
                  }`}
                >
                  <p className="text-3xl mb-2">📂</p>
                  <p className="text-sm font-semibold text-[#1A1A1A]">Drop your CSV here or click to browse</p>
                  <p className="text-xs text-[#9A9A9A] mt-1">Columns: Manufacturer, Item/Kit, Internal Reference, Tags, Sales Price</p>
                  <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
                </div>
              )}

              {/* Error */}
              {importError && (
                <div className="bg-[#D95F5F]/10 border border-[#D95F5F]/30 rounded-lg px-4 py-3 text-sm text-[#D95F5F]">
                  {importError}
                </div>
              )}

              {/* Preview */}
              {parsed && !done && (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold text-[#1A1A1A]">
                      {parsed.rows.length} row{parsed.rows.length !== 1 ? 's' : ''} detected
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#4CAF7D]/10 text-[#4CAF7D] font-medium">
                      {validRows.length} will import
                    </span>
                    {dupeRows.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#E6A817]/10 text-[#E6A817] font-medium">
                        {dupeRows.length} duplicate SKU{dupeRows.length !== 1 ? 's' : ''} skipped
                      </span>
                    )}
                    {errorRows.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#D95F5F]/10 text-[#D95F5F] font-medium">
                        {errorRows.length} error{errorRows.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <button onClick={() => { setParsed(null); fileRef.current && (fileRef.current.value = '') }}
                      className="text-xs text-[#9A9A9A] hover:text-[#1A1A1A] ml-auto">
                      ← Change file
                    </button>
                  </div>

                  {/* Skip dupes toggle */}
                  {existingSkus.size > 0 && (
                    <label className="flex items-center gap-2 text-sm text-[#1A1A1A] cursor-pointer">
                      <input type="checkbox" checked={skipDupes}
                        onChange={(e) => {
                          setSkipDupes(e.target.checked)
                          // Re-mark dupes
                          setParsed((p) => ({
                            ...p,
                            rows: p.rows.map((r) => ({
                              ...r,
                              _isDupe: e.target.checked && !!r.sku && existingSkus.has(r.sku.trim()),
                            })),
                          }))
                        }}
                        className="accent-[#8B6914]" />
                      Skip rows where SKU already exists in catalog ({existingSkus.size} existing SKUs)
                    </label>
                  )}

                  {/* Preview table */}
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-xs min-w-[700px]">
                      <thead>
                        <tr className="border-b border-gray-100 bg-[#F4F4F5]">
                          <th className="text-left py-2 px-3 font-semibold text-[#9A9A9A] uppercase tracking-wider w-6"></th>
                          <th className="text-left py-2 px-3 font-semibold text-[#9A9A9A] uppercase tracking-wider">Manufacturer</th>
                          <th className="text-left py-2 px-3 font-semibold text-[#9A9A9A] uppercase tracking-wider">Item / Kit</th>
                          <th className="text-left py-2 px-3 font-semibold text-[#9A9A9A] uppercase tracking-wider">Int. Reference</th>
                          <th className="text-left py-2 px-3 font-semibold text-[#9A9A9A] uppercase tracking-wider">Tags</th>
                          <th className="text-right py-2 px-3 font-semibold text-[#9A9A9A] uppercase tracking-wider">Sales Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {parsed.rows.map((row, i) => {
                          const hasError = row._errors.length > 0
                          const isDupe = row._isDupe
                          const priceCell = (v) => v && !isNaN(parseFloat(v))
                            ? formatCurrency(parseFloat(v))
                            : <span className="text-[#9A9A9A]">—</span>
                          return (
                            <tr key={i} className={hasError ? 'bg-[#D95F5F]/5' : isDupe ? 'bg-[#E6A817]/5' : 'hover:bg-[#FAFAFA]'}>
                              <td className="py-2 px-3 text-center">
                                {hasError ? (
                                  <span title={row._errors.join(', ')} className="text-[#D95F5F] cursor-help">⚠</span>
                                ) : isDupe ? (
                                  <span title="Internal Reference already exists — will be skipped" className="text-[#E6A817] cursor-help">⊘</span>
                                ) : (
                                  <span className="text-[#4CAF7D]">✓</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-[#9A9A9A]">{row.manufacturer || '—'}</td>
                              <td className="py-2 px-3 font-medium text-[#1A1A1A]">
                                {row.name || <span className="text-[#D95F5F] italic">missing</span>}
                              </td>
                              <td className="py-2 px-3 font-mono text-[#9A9A9A]">{row.sku || '—'}</td>
                              <td className="py-2 px-3 text-[#9A9A9A] max-w-[120px] truncate">{row.tags || '—'}</td>
                              <td className="py-2 px-3 text-right text-[#1A1A1A]">{priceCell(row.msrp)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Error details */}
                  {errorRows.length > 0 && (
                    <div className="bg-[#D95F5F]/5 border border-[#D95F5F]/20 rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold text-[#D95F5F] mb-2 uppercase tracking-wider">
                        {errorRows.length} row{errorRows.length !== 1 ? 's' : ''} will be skipped due to errors
                      </p>
                      <ul className="space-y-0.5">
                        {errorRows.slice(0, 5).map((r, i) => (
                          <li key={i} className="text-xs text-[#D95F5F]">
                            Row "{r.name || '(no name)'}" — {r._errors.join(', ')}
                          </li>
                        ))}
                        {errorRows.length > 5 && (
                          <li className="text-xs text-[#9A9A9A]">…and {errorRows.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Progress bar */}
              {progress && (
                <div>
                  <div className="flex justify-between text-xs text-[#9A9A9A] mb-1">
                    <span>Importing…</span>
                    <span>{progress.done} / {progress.total}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8B6914] rounded-full transition-all"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-3 flex-shrink-0">
            <button onClick={onClose} disabled={importing}
              className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || !parsed || validRows.length === 0}
              className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50"
            >
              {importing
                ? `Importing… ${progress ? `${progress.done}/${progress.total}` : ''}`
                : parsed
                  ? `Import ${validRows.length} Item${validRows.length !== 1 ? 's' : ''}`
                  : 'Import'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Item Form Modal ─────────────────────────────────────────────────────────

function ItemModal({ item, onClose }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState(isEdit ? {
    name: item.name ?? '',
    type: item.type ?? 'Drone',
    sku: item.sku ?? '',
    msrp: item.msrp ?? '',
    cost: item.cost ?? '',
    description: item.description ?? '',
    manufacturer: item.manufacturer ?? '',
    imageUrl: item.imageUrl ?? '',
    notes: item.notes ?? '',
    active: item.active !== false,
    tags: item.tags ?? '',
    tier1: item.tier1 ?? '',
    tier2: item.tier2 ?? '',
    tier3: item.tier3 ?? '',
  } : EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setError('')
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    const toPrice = (v) => (v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : null)
    try {
      const data = {
        name: form.name.trim(),
        type: form.type,
        sku: form.sku.trim(),
        msrp: parseFloat(form.msrp) || 0,
        cost: toPrice(form.cost),
        description: form.description.trim(),
        manufacturer: form.manufacturer.trim(),
        imageUrl: form.imageUrl.trim(),
        notes: form.notes.trim(),
        active: form.active,
        tags: form.tags.trim() || null,
        tier1: toPrice(form.tier1),
        tier2: toPrice(form.tier2),
        tier3: toPrice(form.tier3),
        updatedAt: serverTimestamp(),
      }
      if (isEdit) {
        await updateDoc(doc(db, 'catalog', item.id), data)
      } else {
        await addDoc(catalogCol, { ...data, createdAt: serverTimestamp() })
      }
      onClose()
    } catch (e) {
      console.error(e)
      setError('Save failed. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-[#1A1A1A]">{isEdit ? 'Edit Item' : 'New Catalog Item'}</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Name + Type */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="e.g. DJI Agras T50" />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}>
                {ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* SKU + Manufacturer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>SKU / Part #</label>
              <input value={form.sku} onChange={(e) => set('sku', e.target.value)} className={inputCls} placeholder="SKU-1234" />
            </div>
            <div>
              <label className={labelCls}>Manufacturer</label>
              <input value={form.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} className={inputCls} placeholder="DJI, XAG, Hylio…" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={labelCls}>Tags</label>
            <input value={form.tags} onChange={(e) => set('tags', e.target.value)} className={inputCls} placeholder="e.g. Drone, Agricultural, DJI" />
          </div>

          {/* Sales Price (MSRP) + Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Sales Price / MSRP ($)</label>
              <input type="number" min="0" step="0.01" value={form.msrp}
                onChange={(e) => set('msrp', e.target.value)} className={inputCls} placeholder="0.00" />
            </div>
            <div>
              <label className={labelCls}>Cost / Wholesale ($)</label>
              <input type="number" min="0" step="0.01" value={form.cost}
                onChange={(e) => set('cost', e.target.value)} className={inputCls} placeholder="0.00" />
              <p className="text-xs text-[#9A9A9A] mt-1">Internal only — never shown to dealers.</p>
            </div>
          </div>

          {/* Tier pricing */}
          <div>
            <label className={labelCls}>Dealer Pricing Tiers ($)</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-[#9A9A9A] mb-1">Tier 1</p>
                <input type="number" min="0" step="0.01" value={form.tier1}
                  onChange={(e) => set('tier1', e.target.value)} className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <p className="text-xs text-[#9A9A9A] mb-1">Tier 2</p>
                <input type="number" min="0" step="0.01" value={form.tier2}
                  onChange={(e) => set('tier2', e.target.value)} className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <p className="text-xs text-[#9A9A9A] mb-1">Tier 3</p>
                <input type="number" min="0" step="0.01" value={form.tier3}
                  onChange={(e) => set('tier3', e.target.value)} className={inputCls} placeholder="0.00" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
              rows={3} className={inputCls} placeholder="Product description shown to dealers…" />
          </div>

          {/* Image URL */}
          <div>
            <label className={labelCls}>Image URL</label>
            <input value={form.imageUrl} onChange={(e) => set('imageUrl', e.target.value)} className={inputCls} placeholder="https://…" />
            {form.imageUrl && (
              <img src={form.imageUrl} alt="" onError={(e) => e.target.style.display = 'none'}
                className="mt-2 h-20 w-20 object-contain rounded-lg border border-gray-100" />
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Internal Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              rows={2} className={inputCls} placeholder="Internal notes (not shown to dealers)…" />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <input type="checkbox" id="active-toggle" checked={form.active} onChange={(e) => set('active', e.target.checked)}
              className="w-4 h-4 accent-[#8B6914]" />
            <label htmlFor="active-toggle" className="text-sm text-[#1A1A1A]">Active (visible in quotes & inventory)</label>
          </div>

          {error && <p className="text-sm text-[#D95F5F]">{error}</p>}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ──────────────────────────────────────────────────────────

function DeleteConfirm({ item, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false)
  async function confirm() {
    setDeleting(true)
    await onConfirm()
  }
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">Delete Item?</h3>
        <p className="text-sm text-[#9A9A9A] mb-5">
          Are you sure you want to delete <span className="font-semibold text-[#1A1A1A]">{item.name}</span>? This cannot be undone and may affect quotes and inventory.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button onClick={confirm} disabled={deleting}
            className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#c44f4f] transition-colors disabled:opacity-50">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Catalog() {
  const { catalog, loading } = useCatalog()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editItem, setEditItem] = useState(null)   // null = closed, {} = new, item = edit
  const [deleteItem, setDeleteItem] = useState(null)
  const [showImport, setShowImport] = useState(false)

  const existingSkus = useMemo(
    () => new Set(catalog.map((i) => i.sku).filter(Boolean)),
    [catalog]
  )

  const filtered = useMemo(() => {
    return catalog.filter((item) => {
      if (!showInactive && item.active === false) return false
      const matchType = !filterType || item.type === filterType
      const matchSearch = !search || [item.name, item.sku, item.manufacturer, item.description]
        .some((v) => v?.toLowerCase().includes(search.toLowerCase()))
      return matchType && matchSearch
    })
  }, [catalog, search, filterType, showInactive])

  async function handleDelete() {
    if (!deleteItem) return
    await deleteDoc(doc(db, 'catalog', deleteItem.id))
    setDeleteItem(null)
  }

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Product Catalog</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{filtered.length} item{filtered.length !== 1 ? 's' : ''} shown</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="border border-[#8B6914] text-[#8B6914] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#8B6914]/5 transition-colors">
            ↑ Import CSV
          </button>
          <button onClick={() => setEditItem({})}
            className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
            + Add Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, SKU, manufacturer…"
          className={`${inputCls} w-full max-w-xs`} />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={inputCls}>
          <option value="">All Types</option>
          {ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-[#9A9A9A] cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-[#8B6914]" />
          Show inactive
        </label>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-[#F4F4F5]">
              {['Item', 'Type', 'SKU', 'MSRP', 'Cost', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="py-3 px-4"><div className="h-4 bg-gray-100 rounded w-3/4" /></td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-[#9A9A9A] text-sm">
                {catalog.length === 0 ? 'No catalog items yet. Add the first one above.' : 'No items match your filters.'}
              </td></tr>
            ) : filtered.map((item) => (
              <tr key={item.id} className="hover:bg-[#FAFAFA] transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" onError={(e) => e.target.style.display = 'none'}
                        className="w-9 h-9 object-contain rounded-lg border border-gray-100 flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#F4F4F5] flex items-center justify-center text-base flex-shrink-0">
                        {item.type === 'Drone' ? '🚁' : item.type === 'Part' ? '⚙️' : '📦'}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-[#1A1A1A]">{item.name}</p>
                      {item.manufacturer && <p className="text-xs text-[#9A9A9A]">{item.manufacturer}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor[item.type] ?? 'bg-gray-100 text-gray-500'}`}>
                    {item.type}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-[#9A9A9A]">{item.sku || '—'}</td>
                <td className="py-3 px-4 font-semibold text-[#1A1A1A]">{formatCurrency(item.msrp)}</td>
                <td className="py-3 px-4 text-[#9A9A9A]">{item.cost != null ? formatCurrency(item.cost) : '—'}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    item.active !== false ? 'bg-[#4CAF7D]/10 text-[#4CAF7D]' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {item.active !== false ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-3">
                    <button onClick={() => setEditItem(item)} className="text-xs text-[#8B6914] hover:underline font-medium">Edit</button>
                    <button onClick={() => setDeleteItem(item)} className="text-xs text-[#D95F5F] hover:underline font-medium">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {editItem !== null && <ItemModal item={editItem} onClose={() => setEditItem(null)} />}
      {deleteItem && <DeleteConfirm item={deleteItem} onClose={() => setDeleteItem(null)} onConfirm={handleDelete} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} existingSkus={existingSkus} />}
    </div>
  )
}
