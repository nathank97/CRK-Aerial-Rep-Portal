import { useState, useEffect } from 'react'
import { query, where, orderBy, onSnapshot, doc } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { leadsCol, leadActivityCol, leadChatCol } from '../firebase/firestore'
import { db } from '../firebase/config'

export function useLeads() {
  const { user } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    // All authenticated users see all leads
    const q = query(leadsCol, orderBy('createdAt', 'desc'))

    const unsub = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [user?.uid, isAdmin])

  return { leads, loading }
}

export function useLead(leadId) {
  const [lead, setLead] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leadId) return
    const unsub = onSnapshot(doc(db, 'leads', leadId), (d) => {
      setLead(d.exists() ? { id: d.id, ...d.data() } : null)
      setLoading(false)
    })
    return unsub
  }, [leadId])

  return { lead, loading }
}

export function useLeadsByDealer(dealerId) {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!dealerId) { setLoading(false); return }
    const q = query(leadsCol, where('assignedDealerId', '==', dealerId), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [dealerId])
  return { leads, loading }
}

export function useLeadActivity(leadId) {
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leadId) return
    const q = query(leadActivityCol(leadId), orderBy('timestamp', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setActivity(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [leadId])

  return { activity, loading }
}

export function useLeadChat(leadId) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leadId) return
    const q = query(leadChatCol(leadId), orderBy('timestamp', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [leadId])

  return { messages, loading }
}
