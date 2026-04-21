import { useState, useEffect } from 'react'
import { setDoc, serverTimestamp } from 'firebase/firestore'
import { emailTemplatesDoc } from '../../firebase/firestore'
import {
  useEmailTemplate,
  DEFAULT_QUOTE_SUBJECT, DEFAULT_QUOTE_BODY,
  DEFAULT_ORDER_SUBJECT, DEFAULT_ORDER_BODY,
  DEFAULT_INVOICE_SUBJECT, DEFAULT_INVOICE_BODY,
} from '../../hooks/useEmailTemplate'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'
const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

const QUOTE_PLACEHOLDERS = [
  { key: '{{quoteNumber}}', desc: 'Quote number (e.g. Q-0001)' },
  { key: '{{customerName}}', desc: 'Customer or lead name' },
  { key: '{{projectName}}', desc: 'Project name' },
  { key: '{{total}}', desc: 'Quote total' },
  { key: '{{dealerName}}', desc: "Rep's display name" },
]

const ORDER_PLACEHOLDERS = [
  { key: '{{orderNumber}}', desc: 'Order number (e.g. ORD-0001)' },
  { key: '{{customerName}}', desc: 'Customer name' },
  { key: '{{customerAddress}}', desc: 'Shipping address' },
  { key: '{{lineItems}}', desc: 'Formatted list of all items & quantities' },
  { key: '{{total}}', desc: 'Order total' },
  { key: '{{notes}}', desc: 'Order notes' },
  { key: '{{dealerName}}', desc: "Rep's display name" },
]

const INVOICE_PLACEHOLDERS = [
  { key: '{{invoiceNumber}}', desc: 'Invoice number (e.g. INV-0001)' },
  { key: '{{customerName}}', desc: 'Customer name' },
  { key: '{{total}}', desc: 'Invoice total' },
  { key: '{{balanceDue}}', desc: 'Remaining balance' },
  { key: '{{paymentTerms}}', desc: 'Payment terms (e.g. Net 30)' },
  { key: '{{dueDate}}', desc: 'Due date' },
  { key: '{{dealerName}}', desc: "Rep's display name" },
]

function PlaceholderList({ items }) {
  return (
    <div className="bg-[#F4F4F5] rounded-xl p-4 mb-5">
      <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-3">Available Placeholders</p>
      <div className="space-y-2">
        {items.map(({ key, desc }) => (
          <div key={key} className="flex items-center gap-3 text-sm">
            <code className="font-mono text-[#8B6914] bg-white border border-gray-200 px-2 py-0.5 rounded text-xs shrink-0">
              {key}
            </code>
            <span className="text-[#9A9A9A]">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function EmailTemplates() {
  const { template, loading } = useEmailTemplate()
  const [activeTab, setActiveTab] = useState('quote')

  // Quote fields
  const [quoteSubject, setQuoteSubject] = useState('')
  const [quoteBody, setQuoteBody] = useState('')

  // Order fields
  const [orderSubject, setOrderSubject] = useState('')
  const [orderBody, setOrderBody] = useState('')
  const [warehouseEmail, setWarehouseEmail] = useState('')

  // Invoice fields
  const [invoiceSubject, setInvoiceSubject] = useState('')
  const [invoiceBody, setInvoiceBody] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading) {
      setQuoteSubject(template.quoteSubject)
      setQuoteBody(template.quoteBody)
      setOrderSubject(template.orderSubject)
      setOrderBody(template.orderBody)
      setWarehouseEmail(template.warehouseEmail)
      setInvoiceSubject(template.invoiceSubject)
      setInvoiceBody(template.invoiceBody)
    }
  }, [loading, template])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await setDoc(emailTemplatesDoc, {
        quoteSubject: quoteSubject.trim() || DEFAULT_QUOTE_SUBJECT,
        quoteBody: quoteBody.trim() || DEFAULT_QUOTE_BODY,
        orderSubject: orderSubject.trim() || DEFAULT_ORDER_SUBJECT,
        orderBody: orderBody.trim() || DEFAULT_ORDER_BODY,
        warehouseEmail: warehouseEmail.trim(),
        invoiceSubject: invoiceSubject.trim() || DEFAULT_INVOICE_SUBJECT,
        invoiceBody: invoiceBody.trim() || DEFAULT_INVOICE_BODY,
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

  const handleReset = () => {
    if (activeTab === 'quote') { setQuoteSubject(DEFAULT_QUOTE_SUBJECT); setQuoteBody(DEFAULT_QUOTE_BODY) }
    if (activeTab === 'order') { setOrderSubject(DEFAULT_ORDER_SUBJECT); setOrderBody(DEFAULT_ORDER_BODY) }
    if (activeTab === 'invoice') { setInvoiceSubject(DEFAULT_INVOICE_SUBJECT); setInvoiceBody(DEFAULT_INVOICE_BODY) }
  }

  const TABS = [
    { key: 'quote', label: 'Quote' },
    { key: 'order', label: 'Order (Warehouse)' },
    { key: 'invoice', label: 'Invoice' },
  ]

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
          Customize the emails that pre-fill when reps click Send. They send from their own email client.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#F4F4F5] rounded-xl p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-[#1A1A1A] shadow-sm'
                : 'text-[#9A9A9A] hover:text-[#1A1A1A]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Quote tab */}
        {activeTab === 'quote' && (
          <>
            <PlaceholderList items={QUOTE_PLACEHOLDERS} />
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div>
                <label className={labelCls}>Subject</label>
                <input value={quoteSubject} onChange={(e) => setQuoteSubject(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Body</label>
                <textarea value={quoteBody} onChange={(e) => setQuoteBody(e.target.value)} rows={12} className={`${inputCls} resize-y font-mono`} />
                <p className="text-xs text-[#9A9A9A] mt-1.5">Opens pre-filled in the rep's email app. They attach the PDF before sending.</p>
              </div>
            </div>
          </>
        )}

        {/* Order tab */}
        {activeTab === 'order' && (
          <>
            <PlaceholderList items={ORDER_PLACEHOLDERS} />
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div>
                <label className={labelCls}>Warehouse Email</label>
                <input
                  type="email"
                  value={warehouseEmail}
                  onChange={(e) => setWarehouseEmail(e.target.value)}
                  placeholder="warehouse@crkgp.com"
                  className={inputCls}
                />
                <p className="text-xs text-[#9A9A9A] mt-1.5">Pre-fills the To field when a rep sends an order to the warehouse.</p>
              </div>
              <div>
                <label className={labelCls}>Subject</label>
                <input value={orderSubject} onChange={(e) => setOrderSubject(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Body</label>
                <textarea value={orderBody} onChange={(e) => setOrderBody(e.target.value)} rows={14} className={`${inputCls} resize-y font-mono`} />
                <p className="text-xs text-[#9A9A9A] mt-1.5">Sent to the warehouse with all order and shipping details.</p>
              </div>
            </div>
          </>
        )}

        {/* Invoice tab */}
        {activeTab === 'invoice' && (
          <>
            <PlaceholderList items={INVOICE_PLACEHOLDERS} />
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <div>
                <label className={labelCls}>Subject</label>
                <input value={invoiceSubject} onChange={(e) => setInvoiceSubject(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Body</label>
                <textarea value={invoiceBody} onChange={(e) => setInvoiceBody(e.target.value)} rows={12} className={`${inputCls} resize-y font-mono`} />
                <p className="text-xs text-[#9A9A9A] mt-1.5">Opens pre-filled in the rep's email app. They attach the PDF before sending.</p>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="bg-[#D95F5F]/10 border border-[#D95F5F]/30 rounded-lg px-4 py-2 text-sm text-[#D95F5F]">{error}</div>
        )}
        {saved && (
          <div className="bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 rounded-lg px-4 py-2 text-sm text-[#4CAF7D]">Template saved successfully.</div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <button type="button" onClick={handleReset} className="text-sm text-[#9A9A9A] hover:text-[#1A1A1A] transition-colors">
            Reset current tab to default
          </button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 bg-[#8B6914] hover:bg-[#7a5c11] text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors">
            {saving ? 'Saving…' : 'Save All Templates'}
          </button>
        </div>
      </form>
    </div>
  )
}
