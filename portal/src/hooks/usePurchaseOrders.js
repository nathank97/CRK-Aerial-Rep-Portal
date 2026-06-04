import { useState, useEffect } from 'react'
import { onSnapshot, query, orderBy } from 'firebase/firestore'
import { purchaseOrdersCol } from '../firebase/firestore'

export function usePurchaseOrders() {
  const [pos, setPos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(purchaseOrdersCol, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setPos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { pos, loading }
}
