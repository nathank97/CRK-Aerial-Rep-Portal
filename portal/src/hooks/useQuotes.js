import { useState, useEffect } from 'react'
import { query, where, orderBy, onSnapshot, doc } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { quotesCol } from '../firebase/firestore'
import { db } from '../firebase/config'

export function useQuotes() {
  const { user, isAdmin } = useAuth()
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = isAdmin
      ? query(quotesCol, orderBy('createdAt', 'desc'))
      : query(quotesCol, where('dealerId', '==', user.uid), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setQuotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user?.uid, isAdmin])

  return { quotes, loading }
}

export function useQuote(id) {
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'quotes', id), (d) => {
      setQuote(d.exists() ? { id: d.id, ...d.data() } : null)
      setLoading(false)
    })
    return unsub
  }, [id])
  return { quote, loading }
}

export function useRepQuotes(repId) {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!repId) { setLoading(false); return }
    const q = query(quotesCol, where('repId', '==', repId), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setQuotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [repId])
  return { quotes, loading }
}
