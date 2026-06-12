import { Suspense, useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { pdf, PDFDownloadLink } from '@react-pdf/renderer'
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
import { emailService, blobToBase64 } from '../../services/emailService'
import CCModal from '../../components/common/CCModal'
import DeductInventoryModal from '../../components/inventory/DeductInventoryModal'
import { undoInventoryDeduction } from '../../utils/inventoryDeduction'
import LineItemBuilder from '../../components/quotes/LineItemBuilder'

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile, isAdmin } = useAuth()
  const { invoice, loading } = useInvoice(id)

  useEffect(() => {
    if (!loading && invoice && !isAdmin && invoice.dealerId !== profile?.id) {
      navigate('/invoices', { replace: true })
    }
  }, [invoice, loading, isAdmin, profile?.id])
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
  const [editLineItems, setEditLineItems] = useState([])

  // Partial payment modal
  const [showPartialModal, setShowPartialModal] = useState(false)
  const [showCCModal, setShowCCModal] = useState(false)
  const [showDeduct, setShowDeduct] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [editingAmtPaid, setEditingAmtPaid] = useState(false)
  const [amtPaidDraft, setAmtPaidDraft] = useState('')
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

  const calcLineTotal = (item) => {
    const qty = parseFloat(item.quantity) || 0
    const price = parseFloat(item.unitPrice) || 0
    const base = qty * price
    const disc = parseFloat(item.discount) || 0
    if (disc <= 0) return base
    return item.discountType === 'percent' ? base * (1 - disc / 100) : Math.max(0, base - disc)
  }

  const enterEdit = () => {
    setEditPaymentTerms(invoice.paymentTerms ?? 'Net 30')
    setEditDueDate(toDateString(invoice.dueDate))
    setEditNotes(invoice.notes ?? '')
    setEditInternalNotes(invoice.internalNotes ?? '')
    setEditAmountPaid(invoice.amountPaid ?? 0)
    setEditPaidAt(toDateString(invoice.paidAt))
    setEditLineItems((invoice.lineItems ?? []).map(item => ({
      id: item.id ?? crypto.randomUUID(),
      type: item.type ?? 'custom',
      catalogId: item.catalogId ?? null,
      description: item.description ?? '',
      quantity: item.quantity ?? 1,
      unitPrice: item.unitPrice ?? 0,
      discount: item.discount ?? 0,
      discountType: item.discountType ?? 'percent',
      msrp: item.msrp ?? null,
      dealerCost: item.dealerCost ?? null,
    })))
    setEditMode(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const paid = parseFloat(editAmountPaid) || 0
      const dueTs = editDueDate ? new Date(editDueDate) : null
      const paidTs = editPaidAt ? new Date(editPaidAt) : null
      const subtotal = editLineItems.reduce((sum, item) => sum + calcLineTotal(item), 0)
      const taxAmount = invoice.taxExempt ? 0 : subtotal * ((invoice.taxRate ?? 0) / 100)
      const total = subtotal + taxAmount
      const balanceDue = total - paid
      const paymentStatus = computePaymentStatus({ total, amountPaid: paid, dueDate: dueTs })
      await updateDoc(invoiceDoc(id), {
        lineItems: editLineItems.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 1,
          unitPrice: parseFloat(item.unitPrice) || 0,
          discount: parseFloat(item.discount) || 0,
        })),
        subtotal,
        taxAmount,
        total,
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
      flash(invoice.inventoryDeducted ? 'Invoice updated. Inventory was previously deducted — re-deduct if quantities changed.' : 'Invoice updated.')
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

  const handleSaveAmtPaid = async () => {
    const newPaid = Math.min(Math.max(0, parseFloat(amtPaidDraft) || 0), invoice.total ?? 0)
    const newBalance = (invoice.total ?? 0) - newPaid
    const newStatus = computePaymentStatus({ total: invoice.total ?? 0, amountPaid: newPaid, dueDate: invoice.dueDate })
    setSaving(true)
    try {
      await updateDoc(invoiceDoc(id), {
        amountPaid: newPaid,
        balanceDue: newBalance,
        paymentStatus: newStatus,
        status: newStatus,
        ...(newPaid >= (invoice.total ?? 0) ? { paidAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      })
      setEditingAmtPaid(false)
      flash('Amount paid updated.')
    } catch (err) {
      console.error(err)
      flash('Failed to update.', true)
    } finally {
      setSaving(false)
    }
  }

  const handleSendInvoice = () => {
    setShowCCModal(true)
  }

  const handleSendInvoiceConfirm = async (cc) => {
    setShowCCModal(false)
    if (!invoice.customerEmail) {
      flash('No customer email address on file.', true)
      return
    }
    setSaving(true)
    try {
      const vars = {
        invoiceNumber: invoice.invoiceNumber ?? '',
        customerName: invoice.customerName ?? '',
        customerFirstName: (invoice.customerName ?? '').split(' ')[0] || invoice.customerName ?? '',
        total: formatCurrency(invoice.total),
        balanceDue: formatCurrency(invoice.balanceDue ?? invoice.total),
        paymentTerms: invoice.paymentTerms ?? 'Net 30',
        dueDate: formatDate(invoice.dueDate),
        dealerName: invoice.dealerName || profile?.displayName || '',
      }
      const subject = fillTemplate(emailTemplate.invoiceSubject, vars)
      const body = fillTemplate(emailTemplate.invoiceBody, vars)

      const logoSrc = invoice.logoChoice === 'custom' && invoice.customLogoUrl ? invoice.customLogoUrl : crkLogoUrl
      const blob = await pdf(<InvoicePDF invoice={invoice} logoSrc={logoSrc} />).toBlob()
      const pdfBase64 = await blobToBase64(blob)

      await emailService.send({
        to: invoice.customerEmail,
        subject,
        body,
        pdfBase64,
        pdfFilename: `${invoice.invoiceNumber}.pdf`,
        cc,
      })

      await updateDoc(invoiceDoc(id), { sentAt: serverTimestamp(), updatedAt: serverTimestamp() })
      flash('Invoice emailed successfully.')
      // Prompt inventory deduction for standalone invoices (no linked order)
      if (!invoice.linkedOrderId && !invoice.inventoryDeducted && (invoice.lineItems ?? []).length > 0) {
        setShowDeduct(true)
      }
    } catch (err) {
      console.error(err)
      flash('Failed to send invoice. Please try again.', true)
    } finally {
      setSaving(false)
    }
  }

  const handleUndoDeduction = async () => {
    if (!window.confirm('This will reverse all inventory deductions from this invoice and delete any shortfall records that were auto-created. Continue?')) return
    setUndoing(true)
    try {
      await undoInventoryDeduction(
        invoice.inventoryDeductionDetails ?? [],
        invoice.dealerId ?? '',
        { type: 'invoice', id, number: invoice.invoiceNumber, createdBy: profile?.displayName ?? '' }
      )
      await updateDoc(invoiceDoc(id), {
        inventoryDeducted: false,
        inventoryDeductionDetails: [],
        updatedAt: serverTimestamp(),
      })
      flash('Inventory deduction reversed.')
    } catch (err) {
      console.error(err)
      flash('Failed to reverse deduction.', true)
    } finally {
      setUndoing(false)
    }
  }

  const handleInvoiceDeductDone = async (details) => {
    setShowDeduct(false)
    await updateDoc(invoiceDoc(id), {
      inventoryDeducted: true,
      inventoryDeductedAt: serverTimestamp(),
      inventoryDeductionDetails: details,
      updatedAt: serverTimestamp(),
    })
    flash('Inventory deducted successfully.')
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
      {showDeduct && invoice && (
        <DeductInventoryModal
          lineItems={invoice.lineItems ?? []}
          dealerId={invoice.dealerId ?? ''}
          title={`${invoice.inventoryDeducted ? 'Re-deduct' : 'Deduct'} Inventory — ${invoice.invoiceNumber}`}
          alreadyDeducted={!!invoice.inventoryDeducted}
          source={{ type: 'invoice', id, number: invoice.invoiceNumber, createdBy: profile?.displayName ?? '' }}
          onClose={() => setShowDeduct(false)}
          onDone={handleInvoiceDeductDone}
        />
      )}
      {showCCModal && (
        <CCModal
          presets={emailTemplate.ccPresets}
          sending={saving}
          onCancel={() => setShowCCModal(false)}
          onSend={handleSendInvoiceConfirm}
        />
      )}

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
            {!invoice.linkedOrderId && (invoice.lineItems ?? []).length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowDeduct(true)} disabled={saving || undoing}
                  className={`text-sm px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60 font-medium ${
                    invoice.inventoryDeducted
                      ? 'border border-[#8B6914] text-[#8B6914] hover:bg-[#8B6914]/5'
                      : 'bg-[#8B6914] hover:bg-[#7a5c11] text-white'
                  }`}>
                  {invoice.inventoryDeducted ? 'Re-deduct Inventory' : 'Deduct Inventory'}
                </button>
                {invoice.inventoryDeducted && (
                  <>
                    <span className="text-xs font-medium text-[#4CAF7D] bg-[#4CAF7D]/10 px-2 py-1 rounded-lg">
                      ✓ Deducted
                    </span>
                    <button onClick={handleUndoDeduction} disabled={undoing || saving}
                      className="text-xs text-[#D95F5F] hover:underline disabled:opacity-50 font-medium">
                      {undoing ? 'Reversing…' : 'Undo'}
                    </button>
                  </>
                )}
              </div>
            )}
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
          {/* Line Items Editor */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-3">Line Items</h3>
            <LineItemBuilder items={editLineItems} onChange={setEditLineItems} />
            {/* Live totals preview */}
            {(() => {
              const editSubtotal = editLineItems.reduce((sum, item) => sum + calcLineTotal(item), 0)
              const editTaxAmount = invoice.taxExempt ? 0 : editSubtotal * ((invoice.taxRate ?? 0) / 100)
              const editTotal = editSubtotal + editTaxAmount
              return (
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                  <div className="w-64 space-y-1 text-sm">
                    <div className="flex justify-between text-[#9A9A9A]">
                      <span>Subtotal</span>
                      <span>{formatCurrency(editSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[#9A9A9A]">
                      <span>Tax ({invoice.taxRate ?? 0}%){invoice.taxExempt ? ' — Exempt' : ''}</span>
                      <span>{formatCurrency(editTaxAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-gray-200 pt-1.5">
                      <span className="text-[#111111]">New Total</span>
                      <span className="text-[#8B6914]">{formatCurrency(editTotal)}</span>
                    </div>
                  </div>
                </div>
              )
            })()}
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
            <div className="flex justify-between items-center">
              <span className="text-[#9A9A9A]">Amount Paid</span>
              {editingAmtPaid ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-[#9A9A9A]">$</span>
                  <input
                    type="number" min="0" step="0.01"
                    value={amtPaidDraft}
                    onChange={(e) => setAmtPaidDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAmtPaid(); if (e.key === 'Escape') setEditingAmtPaid(false) }}
                    className="w-28 border border-[#8B6914] rounded px-2 py-0.5 text-sm focus:outline-none text-right"
                    autoFocus
                  />
                  <button onClick={handleSaveAmtPaid} disabled={saving}
                    className="text-xs font-semibold text-white bg-[#8B6914] hover:bg-[#7a5c11] px-2 py-0.5 rounded disabled:opacity-50">
                    {saving ? '…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingAmtPaid(false)}
                    className="text-xs text-[#9A9A9A] hover:text-[#1A1A1A]">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className={`font-medium ${(invoice.amountPaid ?? 0) > 0 ? 'text-[#4CAF7D]' : 'text-[#9A9A9A]'}`}>
                    {(invoice.amountPaid ?? 0) > 0 ? `(${formatCurrency(invoice.amountPaid)})` : formatCurrency(0)}
                  </span>
                  <button
                    onClick={() => { setAmtPaidDraft(String(invoice.amountPaid ?? 0)); setEditingAmtPaid(true) }}
                    className="text-[#9A9A9A] hover:text-[#8B6914] transition-colors"
                    title="Edit amount paid">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.536-6.536a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 14H9v-3z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
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
