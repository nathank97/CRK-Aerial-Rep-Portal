import { useState, useEffect } from 'react'
import { onSnapshot, doc, orderBy, query, collection } from 'firebase/firestore'
import { repsCol } from '../firebase/firestore'
import { db } from '../firebase/config'

export function useReps() {
  const [reps, setReps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(repsCol, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setReps(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { reps, loading }
}

export function useRep(repId) {
  const [rep, setRep] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!repId) return
    const unsub = onSnapshot(doc(db, 'reps', repId), (d) => {
      setRep(d.exists() ? { id: d.id, ...d.data() } : null)
      setLoading(false)
    })
    return unsub
  }, [repId])

  return { rep, loading }
}

export function useRepNotes(repId) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!repId) return
    const q = query(collection(db, 'reps', repId, 'notes'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [repId])

  return { notes, loading }
}
