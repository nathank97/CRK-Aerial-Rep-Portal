import { useState, useEffect } from 'react'
import { query, where, orderBy, onSnapshot, doc } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { customersCol, ordersCol, serviceTicketsCol } from '../firebase/firestore'
import { db } from '../firebase/config'

export function useCustomers() {
  const { user, isAdmin } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = isAdmin
      ? query(customersCol, orderBy('createdAt', 'desc'))
      : query(customersCol, where('assignedDealerId', '==', user.uid), orderBy('createdAt', 'desc'))

    const unsub = onSnapshot(q, (snap) => {
      setCustomers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user?.uid, isAdmin])

  return { customers, loading }
}

export function useCustomer(customerId) {
  const [customer, setCustomer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) return
    const unsub = onSnapshot(doc(db, 'customers', customerId), (d) => {
      setCustomer(d.exists() ? { id: d.id, ...d.data() } : null)
      setLoading(false)
    })
    return unsub
  }, [customerId])

  return { customer, loading }
}

export function useCustomerOrders(customerId) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) return
    const q = query(ordersCol, where('customerId', '==', customerId), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [customerId])

  return { orders, loading }
}

export function useCustomerServiceTickets(customerId) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) return
    const q = query(serviceTicketsCol, where('customerId', '==', customerId), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [customerId])

  return { tickets, loading }
}
