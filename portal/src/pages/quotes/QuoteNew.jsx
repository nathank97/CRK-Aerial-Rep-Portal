import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { addDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { useCustomers } from '../../hooks/useCustomers'
import { quotesCol } from '../../firebase/firestore'
import LineItemBuilder, { calcTotals } from '../../components/quotes/LineItemBuilder'
import { formatCurrency } from '../../utils/formatters'
import { nextQuoteNumber } from '../../utils/numbering'

export default function QuoteNew() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { customers } = useCustomers()

  const preCustomerId = searchParams.get('customerId') ?? ''
  const preRepId = searchParams.get('repId') ?? ''

  const [customerId, setCustomerId] = useState(preCustomerId)
  const [linkedLeadName, setLinkedLeadName] = useState('')
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [taxRate, setTaxRate] = useState(0)
  const [taxExempt, setTaxExempt] = useState(false)
  const [lineItems, setLineItems] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Derive selected customer object
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null

  const { subtotal, taxAmount, total } = calcTotals(lineItems, taxRate, taxExempt)

  const handleSave = async (e) => {
    e.preventDefault()
    if (lineItems.length === 0) {
      setError('Add at least one line item before saving.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const quoteNumber = await nextQuoteNumber()
      const doc = await addDoc(quotesCol, {
        quoteNumber,
        status: 'Draft',
        customerId: customerId || null,
        linkedCustomerName: selectedCustomer
          ? `${selectedCustomer.firstName ?? ''} ${selectedCustomer.lastName ?? ''}`.trim() || selectedCustomer.companyName || ''
          : '',
        linkedLeadName: customerId ? '' : linkedLeadName,
        customerEmail: selectedCustomer?.email ?? '',
        customerAddress: selectedCustomer?.address ?? '',
        notes,
        terms,
        taxRate: parseFloat(taxRate) || 0,
        taxExempt,
        lineItems,
        subtotal,
        taxAmount,
        total,
        dealerId: user.uid,
        dealerName: profile?.displayName ?? '',
        createdByName: profile?.displayName ?? '',
        repId: preRepId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        sentAt: null,
        convertedOrderId: null,
      })
      if (preRepId) {
        navigate(`/admin/reps/${preRepId}`)
      } else {
        navigate(`/quotes/${doc.id}`)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to save quote. Please try again.')
      setSaving(false)
    }
  }

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] w-full bg-white'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => preRepId ? navigate(`/admin/reps/${preRepId}`) : navigate('/quotes')} className="text-[#9A9A9A] hover:text-[#111111] text-sm transition-colors">
          {preRepId ? '← Rep' : '← Quotes'}
        </button>
        <span className="text-[#9A9A9A]">/</span>
        <h1 className="text-xl font-bold text-[#111111]">New Quote</h1>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Customer section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-4">Customer</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Linked Customer</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Select a customer —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.companyName || c.email}
                  </option>
                ))}
              </select>
            </div>
            {!customerId && (
              <div>
                <label className={labelCls}>Lead Name (if no customer)</label>
                <input
                  type="text"
                  value={linkedLeadName}
                  onChange={(e) => setLinkedLeadName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className={inputCls}
                />
              </div>
            )}
          </div>
          {selectedCustomer && (
            <div className="mt-3 text-xs text-[#9A9A9A] space-y-0.5">
              {selectedCustomer.email && <p>{selectedCustomer.email}</p>}
              {selectedCustomer.address && <p>{selectedCustomer.address}</p>}
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-4">Line Items</h2>
          <LineItemBuilder items={lineItems} onChange={setLineItems} />

          {/* Totals */}
          {lineItems.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9A9A9A]">Subtotal</span>
                    <span className="font-medium text-[#111111]">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#9A9A9A]">Tax ({taxRate}%){taxExempt ? ' — Exempt' : ''}</span>
                    <span className="font-medium text-[#111111]">{formatCurrency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-1">
                    <span className="text-[#111111]">Total</span>
                    <span className="text-[#8B6914]">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tax & Settings */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-4">Tax & Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex items-center gap-3 mt-4 sm:mt-0">
              <label className="relative inline-flex items-center cursor-pointer mt-4">
                <input
                  type="checkbox"
                  checked={taxExempt}
                  onChange={(e) => setTaxExempt(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B6914]" />
                <span className="ml-3 text-sm font-medium text-[#111111]">Tax Exempt</span>
              </label>
            </div>
          </div>
        </div>

        {/* Notes & Terms */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-4">Notes & Terms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Visible on the quote PDF…"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Terms</label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                rows={3}
                placeholder="e.g. Net 30, FOB Origin…"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-[#D95F5F]/10 border border-[#D95F5F]/30 rounded-lg px-4 py-3 text-sm text-[#D95F5F]">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/quotes')}
            className="px-5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-[#111111] hover:bg-[#F4F4F5] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-[#8B6914] hover:bg-[#7a5c12] text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Quote'}
          </button>
        </div>
      </form>
    </div>
  )
}
