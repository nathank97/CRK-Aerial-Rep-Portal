import { doc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Atomically increments a counter doc and returns the formatted document number.
 * Counter docs live at: counters/{type}  →  { count: N }
 */
async function nextNumber(type, prefix) {
  const counterRef = doc(db, 'counters', type)
  const count = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef)
    const next = (snap.exists() ? snap.data().count : 0) + 1
    tx.set(counterRef, { count: next })
    return next
  })
  return `${prefix}-${String(count).padStart(4, '0')}`
}

export const nextQuoteNumber = () => nextNumber('quotes', 'QT')
export const nextOrderNumber = () => nextNumber('orders', 'ORD')
export const nextInvoiceNumber = () => nextNumber('invoices', 'INV')
export const nextTicketNumber = () => nextNumber('tickets', 'SVC')
