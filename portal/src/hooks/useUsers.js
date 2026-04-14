import { useState, useEffect } from 'react'
import { query, where, onSnapshot } from 'firebase/firestore'
import { usersCol } from '../firebase/firestore'

export function useDealers() {
  const [dealers, setDealers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(usersCol, where('role', '==', 'dealer'))
    const unsub = onSnapshot(q, (snap) => {
      setDealers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { dealers, loading }
}

export function useAllUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(usersCol, (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  return { users, loading }
}
