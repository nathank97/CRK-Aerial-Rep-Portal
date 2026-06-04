import { useState, useEffect } from 'react'
import { onSnapshot, query, orderBy } from 'firebase/firestore'
import { purchaseOrdersCol } from '../firebase/firestore'

export function usePurchaseOrders() {
  const [pos, setPos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(purchaseOrdersCol, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('usePurchaseOrders error:', err)
        setError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  return { pos, loading, error }
}
