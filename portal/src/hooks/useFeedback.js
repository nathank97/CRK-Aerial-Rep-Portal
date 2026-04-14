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

  useEffect(() => {
    if (!user) return
    const q = query(feedbackCol, where('submittedByUid', '==', user.uid), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setFeedback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user?.uid])

  return { feedback, loading }
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
