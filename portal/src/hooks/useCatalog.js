import { useState, useEffect } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { catalogCol } from '../firebase/firestore'

export function useCatalog() {
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(catalogCol, orderBy('name', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setCatalog(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { catalog, loading }
}
