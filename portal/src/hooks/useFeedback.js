import { useState, useEffect } from 'react'
import { query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { feedbackCol, feedbackCommentsCol } from '../firebase/firestore'

export function useAllFeedback() {
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(feedbackCol, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setFeedback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { feedback, loading }
}

export function useMyFeedback() {
  const { user } = useAuth()
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user) return
    // No orderBy here — avoids the need for a composite index.
    // Sort client-side after the snapshot arrives.
    const q = query(feedbackCol, where('submittedByUid', '==', user.uid))
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const at = a.createdAt?.toDate?.() ?? new Date(0)
            const bt = b.createdAt?.toDate?.() ?? new Date(0)
            return bt - at
          })
        setFeedback(items)
        setLoading(false)
      },
      (err) => {
        console.error('useMyFeedback error:', err)
        setError(err.message)
        setLoading(false)
      }
    )
    return unsub
  }, [user?.uid])

  return { feedback, loading, error }
}

export function useTicketComments(ticketId) {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ticketId) return
    const q = query(feedbackCommentsCol(ticketId), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [ticketId])

  return { comments, loading }
}
