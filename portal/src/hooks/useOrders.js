import { useState, useEffect } from 'react'
import { query, where, orderBy, onSnapshot, doc } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { ordersCol } from '../firebase/firestore'
import { db } from '../firebase/config'

export function useOrders() {
  const { user, profile, isAdmin } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const dealerId = profile?.id
    const q = isAdmin
      ? query(ordersCol, orderBy('createdAt', 'desc'))
      : query(ordersCol, where('dealerId', '==', dealerId), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user?.uid, profile?.id, isAdmin])

  return { orders, loading }
}

export function useOrder(id) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'orders', id), (d) => {
      setOrder(d.exists() ? { id: d.id, ...d.data() } : null)
      setLoading(false)
    })
    return unsub
  }, [id])
  return { order, loading }
}
