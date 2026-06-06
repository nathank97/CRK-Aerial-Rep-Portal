import { useState, useEffect } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { modelsCol } from '../firebase/firestore'

export function useModels() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(modelsCol, orderBy('name', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setModels(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { models, loading }
}
