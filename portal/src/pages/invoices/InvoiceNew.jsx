import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { addDoc, getDoc, doc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { useCustomers } from '../../hooks/useCustomers'
import { invoicesCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import LineItemBuilder, { calcTotals } from '../../components/quotes/LineItemBuilder'
import { formatCurrency } from '../../utils/formatters'
import { nextInvoiceNumber } from '../../utils/numbering'
import { getTaxRate } from '../../utils/taxService'
import { computePaymentStatus } from '../../hooks/useInvoices'

export default function InvoiceNew() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { customers } = useCustomers()

  const preCustomerId = searchParams.get('customerId') ?? ''
  const preOrderId = searchParams.get('orderId') ?? ''
  const preRepId = searchParams.get('repId') ?? ''

  // Customer fields
  const [customerId, setCustomerId] = useState(preCustomerId)
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerState, setCustomerState] = useState('')

  // Line items & tax
  const [lineItems, setLineItems] = useState([])
  const [taxRate, setTaxRate] = useState(0)
  const [taxExempt, setTaxExempt] = useState(false)
  const [exemptionType, setExemptionType] = useState('')
  const [exemptionCertificate, setExemptionCertificate] = useState('')

  // Payment
  const [paymentTerms, setPaymentTerms] = useState('Net 30')
  const [dueDate, setDueDate] = useState('')
  const [amountPaid, setAmountPaid] = useState(0)

  // Notes
  const [notes, setNotes] = useState('')
  const [internalNotes, setInternalNotes] = useState('')

  // Linked
  const [linkedOrderId, setLinkedOrderId] = useState(preOrderId)
  const [linkedOrderNumber, setLinkedOrderNumber] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingPrefill, setLoadingPrefill] = useState(false)

  const { subtotal, taxAmount, total } = calcTotals(lineItems, taxRate, taxExempt)
  const balanceDue = total - (parseFloat(amountPaid) || 0)
  const paymentStatus = computePaymentStatus({
    total,
    amountPaid: parseFloat(amountPaid) || 0,
    dueDate: dueDate ? new Date(dueDate) : null,
  })

  // Pre-fill from orderId
  useEffect(() => {
    if (!preOrderId) return
    setLoadingPrefill(true)
    getDoc(doc(db, 'orders', preOrderId)).then((snap) => {
      if (snap.exists()) {
        const o = snap.data()
        setLinkedOrderId(preOrderId)
        setLinkedOrderNumber(o.orderNumber ?? '')
        setLineItems(o.lineItems ?? [])
        setCustomerId(o.customerId ?? '')
        setCustomerName(o.customerName ?? '')
        setCustomerEmail(o.customerEmail ?? '')
        setCustomerAddress(o.customerAddress ?? '')
        setCustomerState(o.customerState ?? '')
        setTaxExempt(o.taxExempt ?? false)
        setTaxRate(o.taxRate ?? 0)
      }
    }).finally(() => setLoadingPrefill(false))
  }, [preOrderId])

  // Pre-fill from customerId (when no order)
  useEffect(() => {
    if (!preCustomerId || preOrderId) return
    getDoc(doc(db, 'customers', preCustomerId)).then((snap) => {
      if (snap.exists()) {
        const c = snap.data()
        setCustomerName(`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.companyName || '')
        setCustomerEmail(c.email ?? '')
        setCustomerAddress(c.address ?? '')
        setCustomerState(c.state ?? '')
        setTaxExempt(c.taxExempt ?? false)
        if (c.state) {
          getTaxRate(c.state).then(setTaxRate)
        }
      }
    })
  }, [preCustomerId, preOrderId])

  // When a customer is selected from dropdown
  const handleCustomerSelect = async (e) => {
    const cid = e.target.value
    setCustomerId(cid)
    if (!cid) {
      setCustomerName('')
      setCustomerEmail('')
      setCustomerAddress('')
      setCustomerState('')
      setTaxExempt(false)
      setTaxRate(0)
      return
    }
    const c = customers.find((x) => x.id === cid)
    if (c) {
      setCustomerName(`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.companyName || '')
      setCustomerEmail(c.email ?? '')
      setCustomerAddress(c.address ?? '')
      setCustomerState(c.state ?? '')
      setTaxExempt(c.taxExempt ?? false)
      if (c.state) {
        const rate = await getTaxRate(c.state)
        setTaxRate(rate)
      }
    }
  }

  // Fetch tax rate when state changes manually
  const handleStateChange = async (e) => {
    const state = e.target.value
    setCustomerState(state)
    if (state && state.length === 2) {
      const rate = await getTaxRate(state)
      setTaxRate(rate)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (lineItems.length === 0) {
      setError('Add at least one line item before saving.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const invoiceNumber = await nextInvoiceNumber()
      const paid = parseFloat(amountPaid) || 0
      const ref = await addDoc(invoicesCol, {
        invoiceNumber,
        status: paymentStatus,
        paymentStatus,
        customerId: customerId || null,
        customerName,
        customerEmail,
        customerAddress,
        customerState,
        lineItems,
        subtotal,
        taxRate: parseFloat(taxRate) || 0,
        taxExempt,
        exemptionType,
        exemptionCertificate,
        taxAmount,
        total,
        amountPaid: paid,
        balanceDue: total - paid,
        paymentTerms,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes,
        internalNotes,
        linkedOrderId: linkedOrderId || null,
        linkedOrderNumber: linkedOrderNumber || null,
        sentAt: null,
        repId: preRepId || null,
        dealerId: user.uid,
        dealerName: profile?.displayName ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      if (preRepId) {
        navigate(`/admin/reps/${preRepId}`)
      } else {
        navigate(`/invoices/${ref.id}`)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to save invoice. Please try again.')
      setSaving(false)
    }
  }

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] w-full bg-white'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  if (loadingPrefill) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center text-[#9A9A9A] text-sm animate-pulse">
        Loading order data…
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => preRepId ? navigate(`/admin/reps/${preRepId}`) : navigate('/invoices')} className="text-[#9A9A9A] hover:text-[#111111] text-sm transition-colors">
          {preRepId ? '← Rep' : '← Invoices'}
        </button>
        <span className="text-[#9A9A9A]">/</span>
        <h1 className="text-xl font-bold text-[#111111]">New Invoice</h1>
        {linkedOrderNumber && (
          <span className="text-xs bg-[#8B6914]/10 text-[#8B6914] px-2 py-0.5 rounded-full font-medium">
            From Order {linkedOrderNumber}
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Customer */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-4">Customer</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Linked Customer</label>
              <select value={customerId} onChange={handleCustomerSelect} className={inputCls}>
                <option value="">— Select or enter manually —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.companyName || c.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Customer Name</label>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full name or company" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <input type="text" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Street, City, State ZIP" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>State (2-letter)</label>
              <input type="text" value={customerState} onChange={handleStateChange}
                maxLength={2} placeholder="MN" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-4">Line Items</h2>
          <LineItemBuilder items={lineItems} onChange={setLineItems} />

          {lineItems.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#9A9A9A]">Subtotal</span>
                  <span className="font-medium text-[#111111]">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9A9A9A]">Tax ({taxRate}%){taxExempt ? ' — Exempt' : ''}</span>
                  <span className="font-medium text-[#111111]">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-gray-200 pt-2">
                  <span className="text-[#111111]">Total</span>
                  <span className="text-[#8B6914]">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tax Settings */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-4">Tax Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tax Rate (%)</label>
              <input type="number" min="0" step="0.01" value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)} className={inputCls} />
              <p className="text-xs text-[#9A9A9A] mt-1">Auto-fetched from state when state is set.</p>
            </div>
            <div className="flex items-center mt-4 sm:mt-5">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B6914]" />
                <span className="ml-3 text-sm font-medium text-[#111111]">Tax Exempt</span>
              </label>
            </div>
            {taxExempt && (
              <>
                <div>
                  <label className={labelCls}>Exemption Type</label>
                  <input type="text" value={exemptionType} onChange={(e) => setExemptionType(e.target.value)}
                    placeholder="e.g. Resale, Agricultural…" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Exemption Certificate #</label>
                  <input type="text" value={exemptionCertificate} onChange={(e) => setExemptionCertificate(e.target.value)}
                    placeholder="Certificate number" className={inputCls} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Payment Terms */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-4">Payment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Payment Terms</label>
              <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputCls}>
                <option>Due on Receipt</option>
                <option>Net 15</option>
                <option>Net 30</option>
                <option>Net 45</option>
                <option>Net 60</option>
                <option>COD</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Amount Paid ($)</label>
              <input type="number" min="0" step="0.01" value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)} className={inputCls} />
            </div>
          </div>
          {lineItems.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm text-[#9A9A9A]">Payment Status:</span>
              <span className={`text-sm font-semibold ${
                paymentStatus === 'Paid' ? 'text-[#4CAF7D]' :
                paymentStatus === 'Overdue' ? 'text-[#D95F5F]' :
                paymentStatus === 'Partial' ? 'text-[#8B6914]' : 'text-[#E6A817]'
              }`}>
                {paymentStatus}
              </span>
              <span className="text-sm text-[#9A9A9A]">· Balance Due: {formatCurrency(balanceDue)}</span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-4">Notes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Notes (visible on PDF)</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Customer-facing notes…" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Internal Notes (not on PDF)</label>
              <textarea rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Internal notes only…" className={inputCls} />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-[#D95F5F]/10 border border-[#D95F5F]/30 rounded-lg px-4 py-3 text-sm text-[#D95F5F]">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/invoices')}
            className="px-5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-[#111111] hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="px-5 py-2 rounded-lg bg-[#8B6914] hover:bg-[#7a5c12] text-white text-sm font-semibold transition-colors disabled:opacity-60">
            {saving ? 'Saving…' : 'Save Invoice'}
          </button>
        </div>
      </form>
    </div>
  )
}
