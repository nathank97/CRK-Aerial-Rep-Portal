import { useState, useEffect } from 'react'
import { query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { inventoryCol } from '../firebase/firestore'

export function useInventory() {
  const { user, isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = isAdmin
      ? query(inventoryCol, orderBy('modelName', 'asc'))
      : query(inventoryCol, where('dealerId', '==', user.uid), orderBy('modelName', 'asc'))

    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user?.uid, isAdmin])

  return { items, loading }
}
