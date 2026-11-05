import { useState, useEffect } from 'react'
import { query, where, orderBy, onSnapshot, doc } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { serviceTicketsCol } from '../firebase/firestore'
import { db } from '../firebase/config'

export function useServiceTickets() {
  const { user, profile, isAdmin } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = isAdmin
      ? query(serviceTicketsCol, orderBy('createdAt', 'desc'))
      : query(serviceTicketsCol, where('dealerId', '==', profile?.id ?? user.uid), orderBy('createdAt', 'desc'))

    const unsub = onSnapshot(q, (snap) => {
      setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, (err) => {
      console.error('[useServiceTickets.js] query failed:', err)
      setLoading(false)
    })
    return unsub
  }, [user?.uid, profile?.id, isAdmin])

  return { tickets, loading }
}

export function useServiceTicket(ticketId) {
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticketId) return
    const unsub = onSnapshot(doc(db, 'serviceTickets', ticketId), (d) => {
      setTicket(d.exists() ? { id: d.id, ...d.data() } : null)
      setLoading(false)
    }, (err) => {
      console.error('[useServiceTickets.js] query failed:', err)
      setLoading(false)
    })
    return unsub
  }, [ticketId])

  return { ticket, loading }
}
