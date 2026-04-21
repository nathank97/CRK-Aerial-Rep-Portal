import { useState, useEffect } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { presetQuotesCol } from '../firebase/firestore'

export function usePresetQuotes() {
  const [presets, setPresets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(
      query(presetQuotesCol, orderBy('createdAt', 'desc')),
      (snap) => {
        setPresets(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }
    )
    return unsub
  }, [])

  return { presets, loading }
}
