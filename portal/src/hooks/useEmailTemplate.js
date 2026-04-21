import { useState, useEffect } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { emailTemplatesDoc } from '../firebase/firestore'

export const DEFAULT_QUOTE_SUBJECT = 'Quote {{quoteNumber}} from CRK Aerial'
export const DEFAULT_QUOTE_BODY = `Hi {{customerName}},

Please find your quote {{quoteNumber}} attached for review.

Project: {{projectName}}
Total: {{total}}

Don't hesitate to reach out with any questions.

{{dealerName}}
CRK Aerial`

export const DEFAULT_ORDER_SUBJECT = 'New Order {{orderNumber}} — Please Process'
export const DEFAULT_ORDER_BODY = `NEW ORDER — {{orderNumber}}

SHIP TO:
{{customerName}}
{{customerAddress}}

ORDERED BY: {{dealerName}}

ITEMS:
{{lineItems}}

ORDER TOTAL: {{total}}

NOTES:
{{notes}}

Please process this order at your earliest convenience and reply to confirm receipt.

{{dealerName}}
CRK Aerial`

export const DEFAULT_INVOICE_SUBJECT = 'Invoice {{invoiceNumber}} from CRK Aerial'
export const DEFAULT_INVOICE_BODY = `Hi {{customerName}},

Please find your invoice {{invoiceNumber}} attached.

Invoice Total: {{total}}
Balance Due: {{balanceDue}}
Payment Terms: {{paymentTerms}}
Due Date: {{dueDate}}

Please remit payment per the terms above. Don't hesitate to reach out with any questions.

{{dealerName}}
CRK Aerial`

export function fillTemplate(template, vars) {
  return Object.entries(vars).reduce(
    (str, [key, val]) => str.replaceAll(`{{${key}}}`, val ?? ''),
    template
  )
}

export function formatOrderLineItems(lineItems = []) {
  if (!lineItems.length) return '(no items)'
  return lineItems
    .map((item) => {
      const qty = item.quantity ?? 1
      const price = ((qty) * (item.unitPrice ?? 0)).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
      return `  ${qty}x ${item.description || 'Item'} — ${price}`
    })
    .join('\n')
}

export function useEmailTemplate() {
  const [template, setTemplate] = useState({
    quoteSubject: DEFAULT_QUOTE_SUBJECT,
    quoteBody: DEFAULT_QUOTE_BODY,
    orderSubject: DEFAULT_ORDER_SUBJECT,
    orderBody: DEFAULT_ORDER_BODY,
    warehouseEmail: '',
    invoiceSubject: DEFAULT_INVOICE_SUBJECT,
    invoiceBody: DEFAULT_INVOICE_BODY,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(emailTemplatesDoc, (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        setTemplate({
          quoteSubject: d.quoteSubject || DEFAULT_QUOTE_SUBJECT,
          quoteBody: d.quoteBody || DEFAULT_QUOTE_BODY,
          orderSubject: d.orderSubject || DEFAULT_ORDER_SUBJECT,
          orderBody: d.orderBody || DEFAULT_ORDER_BODY,
          warehouseEmail: d.warehouseEmail || '',
          invoiceSubject: d.invoiceSubject || DEFAULT_INVOICE_SUBJECT,
          invoiceBody: d.invoiceBody || DEFAULT_INVOICE_BODY,
        })
      }
      setLoading(false)
    })
    return unsub
  }, [])

  return { template, loading }
}
