import { Suspense, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { useAuth } from '../../context/AuthContext'
import { useQuote } from '../../hooks/useQuotes'
import { quotesCol, ordersCol } from '../../firebase/firestore'
import { quoteDoc, orderDoc } from '../../firebase/firestore'
import StatusBadge from '../../components/common/StatusBadge'
import { SkeletonCard } from '../../components/common/SkeletonCard'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters'
import { nextOrderNumber } from '../../utils/numbering'
import LineItemBuilder, { calcTotals } from '../../components/quotes/LineItemBuilder'
import QuotePDF from '../../components/quotes/QuotePDF'
import { useEmailTemplate, fillTemplate } from '../../hooks/useEmailTemplate'
import { matchAndReserve } from '../../utils/inventoryReservation'
import crkLogoUrl from '../../assets/logo.png'

function ConvertModal({ quote, onClose, onConfirm, saving }) {
  const [reserve, setReserve] = useState(true)
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#111111]">Convert to Order</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-[#111111]">
            Create an order from <span className="font-semibold">{quote.quoteNumber}</span> and mark the quote as Accepted.
          </p>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={reserve}
              onChange={(e) => setReserve(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#8B6914]"
            />
            <div>
              <p className="text-sm font-semibold text-[#111111]">Reserve Inventory</p>
              <p className="text-xs text-[#9A9A9A] mt-0.5">
                Automatically match and reserve inventory at your location using SKU or model name. Items that can't be matched will be flagged.
              </p>
            </div>
          </label>
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-2 border-t border-gray-100">
          <button onClick={onClose} disabled={saving}
            className="flex-1 border border-gray-200 text-[#111111] rounded-lg py-2 text-sm hover:bg-[#F4F4F5] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => onConfirm(reserve)} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#7a5c12] disabled:opacity-50">
            {saving ? 'Converting…' : 'Convert to Order'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function QuoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { quote, loading } = useQuote(id)

  const { template: emailTemplate } = useEmailTemplate()
  const [editMode, setEditMode] = useState(false)
  const [editItems, setEditItems] = useState([])
  const [editNotes, setEditNotes] = useState('')
  const [editTerms, setEditTerms] = useState('')
  const [editTaxRate, setEditTaxRate] = useState(0)
  const [editTaxExempt, setEditTaxExempt] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [showConvertModal, setShowConvertModal] = useState(false)

  const flash = (msg) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(''), 3000)
  }

  const enterEdit = () => {
    setEditItems(quote.lineItems ?? [])
    setEditNotes(quote.notes ?? '')
    setEditTerms(quote.terms ?? '')
    setEditTaxRate(quote.taxRate ?? 0)
    setEditTaxExempt(quote.taxExempt ?? false)
    setEditMode(true)
  }

  const cancelEdit = () => setEditMode(false)

  const saveEdit = async () => {
    setSaving(true)
    try {
      const { subtotal, taxAmount, total } = calcTotals(editItems, editTaxRate, editTaxExempt)
      await updateDoc(quoteDoc(id), {
        lineItems: editItems,
        notes: editNotes,
        terms: editTerms,
        taxRate: parseFloat(editTaxRate) || 0,
        taxExempt: editTaxExempt,
        subtotal,
        taxAmount,
        total,
        updatedAt: serverTimestamp(),
      })
      setEditMode(false)
      flash('Quote updated.')
    } catch (err) {
      console.error(err)
      flash('Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (status) => {
    await updateDoc(quoteDoc(id), { status, updatedAt: serverTimestamp() })
    flash(`Status set to ${status}.`)
  }

  const handleSendQuote = async () => {
    const vars = {
      quoteNumber: quote.quoteNumber ?? '',
      customerName: quote.linkedCustomerName || quote.linkedLeadName || '',
      projectName: quote.projectName || '',
      total: formatCurrency(quote.total),
      dealerName: quote.dealerName || profile?.displayName || '',
    }
    const subject = fillTemplate(emailTemplate.quoteSubject, vars)
    const body = fillTemplate(emailTemplate.quoteBody, vars)
    const to = quote.customerEmail || ''
    const a = document.createElement('a')
    a.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    await updateDoc(quoteDoc(id), { sentAt: serverTimestamp(), status: 'Sent', updatedAt: serverTimestamp() })
    flash('Email client opened — attach the PDF and send.')
  }

  const handleConvertToOrder = async (reserve) => {
    setSaving(true)
    try {
      const orderNumber = await nextOrderNumber()
      const orderRef = await addDoc(ordersCol, {
        orderNumber,
        status: 'Processing',
        customerId: quote.customerId ?? null,
        customerName: quote.linkedCustomerName || quote.linkedLeadName || '',
        customerEmail: quote.customerEmail ?? '',
        lineItems: quote.lineItems ?? [],
        subtotal: quote.subtotal ?? 0,
        taxRate: quote.taxRate ?? 0,
        taxExempt: quote.taxExempt ?? false,
        taxAmount: quote.taxAmount ?? 0,
        total: quote.total ?? 0,
        notes: quote.notes ?? '',
        terms: quote.terms ?? '',
        linkedQuoteId: id,
        linkedQuoteNumber: quote.quoteNumber,
        linkedInvoiceId: null,
        trackingNumber: '',
        fulfillmentDate: null,
        inventoryReserved: false,
        reservedItems: [],
        dealerId: user.uid,
        dealerName: profile?.displayName ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      if (reserve && (quote.lineItems ?? []).length > 0) {
        const results = await matchAndReserve(quote.lineItems, user.uid)
        const anyMatched = results.some((r) => r.matched)
        await updateDoc(orderDoc(orderRef.id), {
          inventoryReserved: anyMatched,
          reservedItems: results,
          updatedAt: serverTimestamp(),
        })
      }

      await updateDoc(quoteDoc(id), {
        status: 'Accepted',
        convertedOrderId: orderRef.id,
        updatedAt: serverTimestamp(),
      })
      navigate(`/orders/${orderRef.id}`)
    } catch (err) {
      console.error(err)
      flash('Failed to convert to order.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
        <SkeletonCard className="h-24" />
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-40" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <p className="text-[#9A9A9A]">Quote not found.</p>
        <button onClick={() => navigate('/quotes')} className="mt-4 text-[#8B6914] text-sm underline">Back to Quotes</button>
      </div>
    )
  }

  const editTotals = editMode ? calcTotals(editItems, editTaxRate, editTaxExempt) : {}

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] w-full bg-white'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {showConvertModal && (
        <ConvertModal
          quote={quote}
          saving={saving}
          onClose={() => setShowConvertModal(false)}
          onConfirm={(reserve) => { setShowConvertModal(false); handleConvertToOrder(reserve) }}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-5">
        <Link to="/quotes" className="text-[#9A9A9A] hover:text-[#111111] transition-colors">Quotes</Link>
        <span className="text-[#9A9A9A]">/</span>
        <span className="font-semibold text-[#111111]">{quote.quoteNumber}</span>
      </div>

      {/* Flash message */}
      {actionMsg && (
        <div className="mb-4 bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 rounded-lg px-4 py-3 text-sm text-[#4CAF7D]">
          {actionMsg}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-lg font-bold text-[#8B6914]">{quote.quoteNumber}</span>
              <StatusBadge status={quote.status ?? 'Draft'} size="sm" />
            </div>
            {quote.projectName && (
              <p className="text-xs font-semibold text-[#8B6914] uppercase tracking-wider mt-1">{quote.projectName}</p>
            )}
            <p className="text-[#111111] font-semibold mt-1 text-lg">
              {quote.linkedCustomerName || quote.linkedLeadName || '—'}
            </p>
            {quote.customerEmail && <p className="text-sm text-[#9A9A9A]">{quote.customerEmail}</p>}
            {quote.customerAddress && <p className="text-sm text-[#9A9A9A]">{quote.customerAddress}</p>}
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-[#9A9A9A]">
              <span>Created: {formatDate(quote.createdAt)}</span>
              {quote.sentAt && <span>Sent: {formatDateTime(quote.sentAt)}</span>}
              {quote.createdByName && <span>By: {quote.createdByName}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {!editMode && (
              <button
                onClick={enterEdit}
                className="text-sm border border-gray-200 text-[#111111] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg transition-colors"
              >
                Edit
              </button>
            )}
            {quote.status !== 'Accepted' && quote.status !== 'Declined' && (
              <button
                onClick={() => setShowConvertModal(true)}
                disabled={saving}
                className="text-sm bg-[#8B6914] hover:bg-[#7a5c12] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                Convert to Order
              </button>
            )}
            <Suspense fallback={<span className="text-xs text-[#9A9A9A] px-3 py-1.5">Preparing PDF…</span>}>
              <PDFDownloadLink
                document={<QuotePDF quote={quote} logoSrc={quote.logoChoice === 'custom' && quote.customLogoUrl ? quote.customLogoUrl : crkLogoUrl} />}
                fileName={`${quote.quoteNumber}.pdf`}
                className="text-sm border border-gray-200 text-[#111111] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg transition-colors"
              >
                {({ loading: pdfLoading }) => pdfLoading ? 'Preparing…' : 'Download PDF'}
              </PDFDownloadLink>
            </Suspense>
            {quote.status !== 'Sent' && (
              <button
                onClick={handleSendQuote}
                disabled={saving}
                className="text-sm border border-[#4A90B8] text-[#4A90B8] hover:bg-[#4A90B8]/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                Send Quote
              </button>
            )}
            {quote.status !== 'Accepted' && (
              <button
                onClick={() => updateStatus('Accepted')}
                className="text-sm border border-[#4CAF7D] text-[#4CAF7D] hover:bg-[#4CAF7D]/5 px-3 py-1.5 rounded-lg transition-colors"
              >
                Mark Accepted
              </button>
            )}
            {quote.status !== 'Declined' && (
              <button
                onClick={() => updateStatus('Declined')}
                className="text-sm border border-[#D95F5F] text-[#D95F5F] hover:bg-[#D95F5F]/5 px-3 py-1.5 rounded-lg transition-colors"
              >
                Mark Declined
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <h2 className="text-sm font-semibold text-[#111111] mb-4">Line Items</h2>

        {editMode ? (
          <>
            <LineItemBuilder items={editItems} onChange={setEditItems} />
            {/* Edit totals */}
            {editItems.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                  <div>
                    <label className={labelCls}>Tax Rate (%)</label>
                    <input type="number" min="0" step="0.01" value={editTaxRate}
                      onChange={(e) => setEditTaxRate(e.target.value)} className={inputCls} />
                  </div>
                  <div className="flex items-center gap-2 mt-4 sm:mt-5">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={editTaxExempt}
                        onChange={(e) => setEditTaxExempt(e.target.checked)} className="sr-only peer" />
                      <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8B6914]" />
                      <span className="ml-3 text-sm font-medium text-[#111111]">Tax Exempt</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-[#9A9A9A]">Subtotal</span><span className="font-medium">{formatCurrency(editTotals.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-[#9A9A9A]">Tax</span><span className="font-medium">{formatCurrency(editTotals.taxAmount)}</span></div>
                    <div className="flex justify-between font-bold border-t pt-1.5"><span>Total</span><span className="text-[#8B6914]">{formatCurrency(editTotals.total)}</span></div>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Terms</label>
                  <textarea rows={3} value={editTerms} onChange={(e) => setEditTerms(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={cancelEdit} className="text-sm border border-gray-200 text-[#111111] hover:bg-[#F4F4F5] px-4 py-2 rounded-lg transition-colors">Cancel</button>
                <button onClick={saveEdit} disabled={saving} className="text-sm bg-[#8B6914] hover:bg-[#7a5c12] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {(quote.lineItems ?? []).length === 0 ? (
              <p className="text-sm text-[#9A9A9A] text-center py-8">No line items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Description</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-16">Qty</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-28">Unit Price</th>
                      <th className="text-right py-2 pl-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {quote.lineItems.map((item, i) => (
                      <tr key={item.id ?? i}>
                        <td className="py-2 pr-3 text-[#111111]">{item.description}</td>
                        <td className="py-2 px-2 text-right text-[#9A9A9A]">{item.quantity}</td>
                        <td className="py-2 px-2 text-right text-[#9A9A9A]">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-2 pl-2 text-right font-semibold text-[#111111]">{formatCurrency((item.quantity ?? 1) * (item.unitPrice ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals block */}
            <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#9A9A9A]">Subtotal</span>
                  <span className="font-medium text-[#111111]">{formatCurrency(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#9A9A9A]">Tax ({quote.taxRate ?? 0}%){quote.taxExempt ? ' — Exempt' : ''}</span>
                  <span className="font-medium text-[#111111]">{formatCurrency(quote.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-gray-200 pt-2">
                  <span className="text-[#111111]">Total</span>
                  <span className="text-[#8B6914] text-base">{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Notes / Terms / Links (read-only view) */}
      {!editMode && (quote.notes || quote.terms || quote.convertedOrderId) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          {quote.notes && (
            <div>
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-[#111111]">{quote.notes}</p>
            </div>
          )}
          {quote.terms && (
            <div>
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Terms</p>
              <p className="text-sm text-[#111111]">{quote.terms}</p>
            </div>
          )}
          {quote.convertedOrderId && (
            <div>
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Converted Order</p>
              <Link to={`/orders/${quote.convertedOrderId}`} className="text-sm text-[#8B6914] underline hover:text-[#7a5c12]">
                View Order
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
