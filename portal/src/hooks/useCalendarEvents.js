import { useState, useEffect } from 'react'
import { query, orderBy, onSnapshot } from 'firebase/firestore'
import { eventsCol } from '../firebase/firestore'

export function useCalendarEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(eventsCol, orderBy('date', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { events, loading }
}
