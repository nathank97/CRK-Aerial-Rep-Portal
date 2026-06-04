import { useState, useEffect } from 'react'
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { inventoryTxCol } from '../firebase/firestore'

export function useInventoryTransactions(maxRows = 500) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(inventoryTxCol, orderBy('createdAt', 'desc'), limit(maxRows))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('useInventoryTransactions:', err)
        setError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [maxRows])

  return { transactions, loading, error }
}
