import { useState, useEffect } from 'react'
import { query, where, orderBy, onSnapshot, doc } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { invoicesCol } from '../firebase/firestore'
import { db } from '../firebase/config'

export function useInvoices() {
  const { user, isAdmin } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = isAdmin
      ? query(invoicesCol, orderBy('createdAt', 'desc'))
      : query(invoicesCol, where('dealerId', '==', user.uid), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user?.uid, isAdmin])

  return { invoices, loading }
}

export function useInvoice(id) {
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'invoices', id), (d) => {
      setInvoice(d.exists() ? { id: d.id, ...d.data() } : null)
      setLoading(false)
    })
    return unsub
  }, [id])
  return { invoice, loading }
}

/** Compute payment status from invoice fields */
export function computePaymentStatus(invoice) {
  if (!invoice) return 'Unpaid'
  const { total = 0, amountPaid = 0, dueDate } = invoice
  if (amountPaid >= total && total > 0) return 'Paid'
  if (amountPaid > 0) return 'Partial'
  if (dueDate) {
    const due = dueDate?.toDate ? dueDate.toDate() : new Date(dueDate)
    if (due < new Date()) return 'Overdue'
  }
  return 'Unpaid'
}
