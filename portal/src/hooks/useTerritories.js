import { useState, useEffect } from 'react'
import { onSnapshot, doc, orderBy, query } from 'firebase/firestore'
import { territoriesCol } from '../firebase/firestore'
import { db } from '../firebase/config'

export function useTerritories() {
  const [territories, setTerritories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(territoriesCol, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setTerritories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { territories, loading }
}

export function useTerritory(territoryId) {
  const [territory, setTerritory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!territoryId) return
    const unsub = onSnapshot(doc(db, 'territories', territoryId), (d) => {
      setTerritory(d.exists() ? { id: d.id, ...d.data() } : null)
      setLoading(false)
    })
    return unsub
  }, [territoryId])

  return { territory, loading }
}
