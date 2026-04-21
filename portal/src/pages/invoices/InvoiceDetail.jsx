import { Suspense, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { useAuth } from '../../context/AuthContext'
import { useInvoice, computePaymentStatus } from '../../hooks/useInvoices'
import { invoiceDoc, invoicesCol } from '../../firebase/firestore'
import StatusBadge from '../../components/common/StatusBadge'
import { SkeletonCard } from '../../components/common/SkeletonCard'
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters'
import { nextInvoiceNumber } from '../../utils/numbering'
import InvoicePDF from '../../components/invoices/InvoicePDF'
import crkLogoUrl from '../../assets/logo.png'
import { useEmailTemplate, fillTemplate } from '../../hooks/useEmailTemplate'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { invoice, loading } = useInvoice(id)
  const { template: emailTemplate } = useEmailTemplate()

  const [saving, setSaving] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [actionErr, setActionErr] = useState('')

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [editPaymentTerms, setEditPaymentTerms] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editInternalNotes, setEditInternalNotes] = useState('')
  const [editAmountPaid, setEditAmountPaid] = useState(0)
  const [editPaidAt, setEditPaidAt] = useState('')

  // Partial payment modal
  const [showPartialModal, setShowPartialModal] = useState(false)
  const [partialAmount, setPartialAmount] = useState('')
  const [partialDate, setPartialDate] = useState('')

  const flash = (msg, isErr = false) => {
    if (isErr) {
      setActionErr(msg)
      setTimeout(() => setActionErr(''), 4000)
    } else {
      setActionMsg(msg)
      setTimeout(() => setActionMsg(''), 3000)
    }
  }

  const toDateString = (ts) => {
    if (!ts) return ''
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return d.toISOString().split('T')[0]
  }

  const enterEdit = () => {
    setEditPaymentTerms(invoice.paymentTerms ?? 'Net 30')
    setEditDueDate(toDateString(invoice.dueDate))
    setEditNotes(invoice.notes ?? '')
    setEditInternalNotes(invoice.internalNotes ?? '')
    setEditAmountPaid(invoice.amountPaid ?? 0)
    setEditPaidAt(toDateString(invoice.paidAt))
    setEditMode(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const paid = parseFloat(editAmountPaid) || 0
      const total = invoice.total ?? 0
      const balanceDue = total - paid
      const dueTs = editDueDate ? new Date(editDueDate) : null
      const paidTs = editPaidAt ? new Date(editPaidAt) : null
      const paymentStatus = computePaymentStatus({ total, amountPaid: paid, dueDate: dueTs })
      await updateDoc(invoiceDoc(id), {
        paymentTerms: editPaymentTerms,
        dueDate: dueTs,
        paidAt: paidTs,
        notes: editNotes,
        internalNotes: editInternalNotes,
        amountPaid: paid,
        balanceDue,
        paymentStatus,
        status: paymentStatus,
        updatedAt: serverTimestamp(),
      })
      setEditMode(false)
      flash('Invoice updated.')
    } catch (err) {
      console.error(err)
      flash('Failed to save changes.', true)
    } finally {
      setSaving(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!window.confirm('Mark this invoice as fully paid?')) return
    setSaving(true)
    try {
      const total = invoice.total ?? 0
      await updateDoc(invoiceDoc(id), {
        amountPaid: total,
        balanceDue: 0,
        paymentStatus: 'Paid',
        status: 'Paid',
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      flash('Invoice marked as Paid.')
    } catch (err) {
      console.error(err)
      flash('Failed to update.', true)
    } finally {
      setSaving(false)
    }
  }

  const handleRecordPartial = async () => {
    const amount = parseFloat(partialAmount)
    if (!amount || amount <= 0) return
    setSaving(true)
    try {
      const total = invoice.total ?? 0
      const newPaid = Math.min((invoice.amountPaid ?? 0) + amount, total)
      const balanceDue = total - newPaid
      const paymentStatus = computePaymentStatus({ total, amountPaid: newPaid, dueDate: invoice.dueDate })
      const fullyPaid = balanceDue === 0
      const paidTs = partialDate
        ? new Date(partialDate)
        : fullyPaid
          ? serverTimestamp()
          : undefined
      await updateDoc(invoiceDoc(id), {
        amountPaid: newPaid,
        balanceDue,
        paymentStatus,
        status: paymentStatus,
        ...(paidTs !== undefined ? { paidAt: paidTs } : {}),
        updatedAt: serverTimestamp(),
      })
      setShowPartialModal(false)
      setPartialAmount('')
      setPartialDate('')
      flash(`Payment of ${formatCurrency(amount)} recorded.`)
    } catch (err) {
      console.error(err)
      flash('Failed to record payment.', true)
    } finally {
      setSaving(false)
    }
  }

  const handleSendInvoice = async () => {
    const vars = {
      invoiceNumber: invoice.invoiceNumber ?? '',
      customerName: invoice.customerName ?? '',
      total: formatCurrency(invoice.total),
      balanceDue: formatCurrency(invoice.balanceDue ?? invoice.total),
      paymentTerms: invoice.paymentTerms ?? 'Net 30',
      dueDate: formatDate(invoice.dueDate),
      dealerName: invoice.dealerName || profile?.displayName || '',
    }
    const subject = fillTemplate(emailTemplate.invoiceSubject, vars)
    const body = fillTemplate(emailTemplate.invoiceBody, vars)
    const to = invoice.customerEmail || ''
    const a = document.createElement('a')
    a.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    await updateDoc(invoiceDoc(id), { sentAt: serverTimestamp(), updatedAt: serverTimestamp() })
    flash('Email client opened — attach the PDF and send.')
  }

  const handleDuplicate = async () => {
    setSaving(true)
    try {
      const invoiceNumber = await nextInvoiceNumber()
      const { id: _id, invoiceNumber: _num, sentAt, createdAt, updatedAt, amountPaid, balanceDue, paymentStatus, status, ...rest } = invoice
      const ref = await addDoc(invoicesCol, {
        ...rest,
        invoiceNumber,
        status: 'Unpaid',
        paymentStatus: 'Unpaid',
        amountPaid: 0,
        balanceDue: invoice.total ?? 0,
        sentAt: null,
        dealerId: user.uid,
        dealerName: profile?.displayName ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      navigate(`/invoices/${ref.id}`)
    } catch (err) {
      console.error(err)
      flash('Failed to duplicate invoice.', true)
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

  if (!invoice) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <p className="text-[#9A9A9A]">Invoice not found.</p>
        <button onClick={() => navigate('/invoices')} className="mt-4 text-[#8B6914] text-sm underline">Back to Invoices</button>
      </div>
    )
  }

  const paymentStatus = computePaymentStatus(invoice)
  const balanceDue = Math.max(0, (invoice.total ?? 0) - (invoice.amountPaid ?? 0))
  const isOverdue = paymentStatus === 'Overdue'

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] w-full bg-white'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-5">
        <Link to="/invoices" className="text-[#9A9A9A] hover:text-[#111111] transition-colors">Invoices</Link>
        <span className="text-[#9A9A9A]">/</span>
        <span className="font-semibold text-[#111111]">{invoice.invoiceNumber}</span>
      </div>

      {/* Overdue banner */}
      {isOverdue && (
        <div className="mb-4 bg-[#D95F5F]/10 border border-[#D95F5F]/30 rounded-lg px-4 py-3 flex items-center gap-3">
          <span className="text-[#D95F5F] font-semibold text-sm">Overdue</span>
          <span className="text-[#D95F5F] text-sm">This invoice was due {formatDate(invoice.dueDate)} and has not been paid.</span>
        </div>
      )}

      {/* Flash messages */}
      {actionMsg && (
        <div className="mb-4 bg-[#4CAF7D]/10 border border-[#4CAF7D]/30 rounded-lg px-4 py-3 text-sm text-[#4CAF7D]">
          {actionMsg}
        </div>
      )}
      {actionErr && (
        <div className="mb-4 bg-[#D95F5F]/10 border border-[#D95F5F]/30 rounded-lg px-4 py-3 text-sm text-[#D95F5F]">
          {actionErr}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-lg font-bold text-[#8B6914]">{invoice.invoiceNumber}</span>
              <StatusBadge status={paymentStatus} />
            </div>
            {invoice.projectName && (
              <p className="text-xs font-semibold text-[#8B6914] uppercase tracking-wider mt-1">{invoice.projectName}</p>
            )}
            <p className="text-[#111111] font-semibold mt-1 text-lg">{invoice.customerName || '—'}</p>
            {invoice.customerEmail && <p className="text-sm text-[#9A9A9A]">{invoice.customerEmail}</p>}
            {invoice.customerAddress && <p className="text-sm text-[#9A9A9A]">{invoice.customerAddress}</p>}
            <div className="flex flex-wrap gap-4 mt-2 text-xs text-[#9A9A9A]">
              <span>Created: {formatDate(invoice.createdAt)}</span>
              {invoice.sentAt && <span>Sent: {formatDateTime(invoice.sentAt)}</span>}
              {invoice.paymentTerms && <span>Terms: {invoice.paymentTerms}</span>}
              {invoice.dueDate && <span>Due: {formatDate(invoice.dueDate)}</span>}
              {invoice.paidAt && (
                <span className="text-[#4CAF7D] font-semibold">Paid: {formatDate(invoice.paidAt)}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 items-start">
            {!editMode && (
              <button onClick={enterEdit}
                className="text-sm border border-gray-200 text-[#111111] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg transition-colors">
                Edit
              </button>
            )}
            <Suspense fallback={<span className="text-xs text-[#9A9A9A] px-3 py-1.5">Preparing PDF…</span>}>
              <PDFDownloadLink
                document={<InvoicePDF invoice={invoice} logoSrc={invoice.logoChoice === 'custom' && invoice.customLogoUrl ? invoice.customLogoUrl : crkLogoUrl} />}
                fileName={`${invoice.invoiceNumber}.pdf`}
                className="text-sm border border-gray-200 text-[#111111] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg transition-colors"
              >
                {({ loading: pdfLoading }) => pdfLoading ? 'Preparing…' : 'Download PDF'}
              </PDFDownloadLink>
            </Suspense>
            <button onClick={handleSendInvoice} disabled={saving}
              className="text-sm border border-[#4A90B8] text-[#4A90B8] hover:bg-[#4A90B8]/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
              Send Invoice
            </button>
            {paymentStatus !== 'Paid' && (
              <button onClick={handleMarkPaid} disabled={saving}
                className="text-sm border border-[#4CAF7D] text-[#4CAF7D] hover:bg-[#4CAF7D]/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
                Mark as Paid
              </button>
            )}
            {paymentStatus !== 'Paid' && (
              <button onClick={() => setShowPartialModal(true)}
                className="text-sm border border-[#E6A817] text-[#E6A817] hover:bg-[#E6A817]/5 px-3 py-1.5 rounded-lg transition-colors">
                Record Payment
              </button>
            )}
            <button onClick={handleDuplicate} disabled={saving}
              className="text-sm border border-gray-200 text-[#111111] hover:bg-[#F4F4F5] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
              Duplicate
            </button>
          </div>
        </div>

        {/* Linked order */}
        {invoice.linkedOrderId && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1">Linked Order</p>
            <Link to={`/orders/${invoice.linkedOrderId}`} className="text-sm text-[#8B6914] underline hover:text-[#7a5c12]">
              {invoice.linkedOrderNumber || 'View Order'}
            </Link>
          </div>
        )}
      </div>

      {/* Edit mode panel */}
      {editMode && (
        <div className="bg-white rounded-xl border border-[#8B6914]/30 shadow-sm p-5 mb-5">
          <h2 className="text-sm font-semibold text-[#111111] mb-4">Edit Invoice Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Payment Terms</label>
              <select value={editPaymentTerms} onChange={(e) => setEditPaymentTerms(e.target.value)} className={inputCls}>
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
              <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Amount Paid ($)</label>
              <input type="number" min="0" step="0.01" value={editAmountPaid}
                onChange={(e) => setEditAmountPaid(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Payment Date</label>
              <input type="date" value={editPaidAt} onChange={(e) => setEditPaidAt(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Notes (visible on PDF)</label>
              <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Internal Notes (not on PDF)</label>
              <textarea rows={3} value={editInternalNotes} onChange={(e) => setEditInternalNotes(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setEditMode(false)}
              className="text-sm border border-gray-200 text-[#111111] hover:bg-[#F4F4F5] px-4 py-2 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={saveEdit} disabled={saving}
              className="text-sm bg-[#8B6914] hover:bg-[#7a5c12] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
        <h2 className="text-sm font-semibold text-[#111111] mb-4">Line Items</h2>
        {(invoice.lineItems ?? []).length === 0 ? (
          <p className="text-sm text-[#9A9A9A] text-center py-8">No line items.</p>
        ) : (
          <div className="overflow-x-auto">
            {(() => {
              const hasDiscounts = invoice.lineItems.some((i) => (i.discount ?? 0) > 0)
              return (
                <table className="w-full text-sm min-w-[450px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-3 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Description</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-16">Qty</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-28">Unit Price</th>
                      {hasDiscounts && (
                        <th className="text-right py-2 px-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-24">Discount</th>
                      )}
                      <th className="text-right py-2 pl-2 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoice.lineItems.map((item, i) => {
                      const qty = item.quantity ?? 1
                      const base = qty * (item.unitPrice ?? 0)
                      const lineTotal = item.discount
                        ? item.discountType === 'percent'
                          ? base * (1 - item.discount / 100)
                          : Math.max(0, base - item.discount)
                        : base
                      return (
                        <tr key={item.id ?? i}>
                          <td className="py-2 pr-3 text-[#111111]">{item.description}</td>
                          <td className="py-2 px-2 text-right text-[#9A9A9A]">{qty}</td>
                          <td className="py-2 px-2 text-right text-[#9A9A9A]">{formatCurrency(item.unitPrice)}</td>
                          {hasDiscounts && (
                            <td className="py-2 px-2 text-right text-[#4CAF7D]">
                              {(item.discount ?? 0) > 0
                                ? item.discountType === 'percent'
                                  ? `${item.discount}%`
                                  : formatCurrency(item.discount)
                                : '—'}
                            </td>
                          )}
                          <td className="py-2 pl-2 text-right font-semibold text-[#111111]">{formatCurrency(lineTotal)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            })()}
          </div>
        )}

        {/* Totals block */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end">
          <div className="w-72 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#9A9A9A]">Subtotal</span>
              <span className="font-medium text-[#111111]">{formatCurrency(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9A9A9A]">
                Tax ({invoice.taxRate ?? 0}%)
                {invoice.taxExempt ? ' — Exempt' : ''}
              </span>
              <span className="font-medium text-[#111111]">{formatCurrency(invoice.taxAmount)}</span>
            </div>
            {invoice.taxExempt && (invoice.exemptionType || invoice.exemptionCertificate) && (
              <div className="text-xs text-[#4CAF7D] bg-[#4CAF7D]/10 rounded px-2 py-1">
                {invoice.exemptionType && <span>{invoice.exemptionType}</span>}
                {invoice.exemptionCertificate && <span> · Cert #{invoice.exemptionCertificate}</span>}
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-gray-200 pt-2">
              <span className="text-[#111111]">Total</span>
              <span className="text-[#8B6914] text-base">{formatCurrency(invoice.total)}</span>
            </div>
            {(invoice.amountPaid ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-[#9A9A9A]">Amount Paid</span>
                <span className="font-medium text-[#4CAF7D]">({formatCurrency(invoice.amountPaid)})</span>
              </div>
            )}
            <div className={`flex justify-between font-bold pt-1 border-t border-gray-200 ${isOverdue ? 'text-[#D95F5F]' : balanceDue === 0 ? 'text-[#4CAF7D]' : 'text-[#111111]'}`}>
              <span>Balance Due</span>
              <span className="text-base">{formatCurrency(balanceDue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {(invoice.notes || invoice.internalNotes) && !editMode && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          {invoice.notes && (
            <div>
              <p className={labelCls}>Notes</p>
              <p className="text-sm text-[#111111]">{invoice.notes}</p>
            </div>
          )}
          {invoice.internalNotes && (
            <div>
              <p className={labelCls}>Internal Notes</p>
              <p className="text-sm text-[#9A9A9A]">{invoice.internalNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Partial payment modal */}
      {showPartialModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-[#111111] mb-4">Record Partial Payment</h2>
            <div className="space-y-4 mb-4">
              <div>
                <label className={labelCls}>Amount Received ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  className={inputCls}
                  autoFocus
                  placeholder="0.00"
                />
                <p className="text-xs text-[#9A9A9A] mt-1">
                  Balance due: {formatCurrency(balanceDue)}
                </p>
              </div>
              <div>
                <label className={labelCls}>Payment Date</label>
                <input
                  type="date"
                  value={partialDate}
                  onChange={(e) => setPartialDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowPartialModal(false); setPartialAmount(''); setPartialDate('') }}
                className="flex-1 border border-gray-200 text-sm font-medium text-[#111111] hover:bg-[#F4F4F5] py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPartial}
                disabled={saving || !partialAmount}
                className="flex-1 bg-[#8B6914] hover:bg-[#7a5c12] text-white text-sm font-semibold py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
