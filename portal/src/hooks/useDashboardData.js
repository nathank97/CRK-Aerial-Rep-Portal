import { useState, useEffect } from 'react'
import { query, where, onSnapshot } from 'firebase/firestore'
import { leadsCol, ordersCol, quotesCol, serviceTicketsCol, usersCol } from '../firebase/firestore'
import { useAuth } from '../context/AuthContext'

function getLast6Months() {
  const months = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    months.push({ label: start.toLocaleString('en-US', { month: 'short' }), start, end })
  }
  return months
}

const STAGES = ['New', 'Contacted', 'Pending', 'Demo Scheduled', 'Proposal Sent', 'Won', 'Lost']

const STATUS_COLORS = {
  New: '#4A90B8',
  Contacted: '#E6A817',
  Pending: '#E6A817',
  'Demo Scheduled': '#8B6914',
  'Proposal Sent': '#8B6914',
  Won: '#4CAF7D',
  Lost: '#D95F5F',
}

export function useDashboardData() {
  const { user, isAdmin } = useAuth()
  const [leads, setLeads] = useState([])
  const [orders, setOrders] = useState([])
  const [quotes, setQuotes] = useState([])
  const [serviceTickets, setServiceTickets] = useState([])
  const [dealers, setDealers] = useState([])
  const [loadedCount, setLoadedCount] = useState(0)

  const TOTAL_COLLECTIONS = 5
  const loading = loadedCount < TOTAL_COLLECTIONS

  useEffect(() => {
    if (!user) return
    setLoadedCount(0)
    const mark = () => setLoadedCount((c) => c + 1)

    // Dealers can only read their own docs — filter to avoid permission errors
    const leadsQ = isAdmin ? leadsCol : query(leadsCol, where('assignedDealerId', '==', user.uid))
    const ordersQ = isAdmin ? ordersCol : query(ordersCol, where('dealerId', '==', user.uid))
    const quotesQ = isAdmin ? quotesCol : query(quotesCol, where('dealerId', '==', user.uid))
    const ticketsQ = isAdmin ? serviceTicketsCol : query(serviceTicketsCol, where('dealerId', '==', user.uid))

    const u1 = onSnapshot(leadsQ, (snap) => { setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); mark() })
    const u2 = onSnapshot(ordersQ, (snap) => { setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); mark() })
    const u3 = onSnapshot(quotesQ, (snap) => { setQuotes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); mark() })
    const u4 = onSnapshot(ticketsQ, (snap) => { setServiceTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); mark() })
    const u5 = onSnapshot(query(usersCol, where('role', '==', 'dealer')), (snap) => { setDealers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); mark() })

    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [user, isAdmin])

  // --- KPIs ---
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const totalLeads = leads.length

  const openQuotes = quotes.filter((q) => ['Draft', 'Sent'].includes(q.status)).length

  const revenueMTD = orders
    .filter((o) => {
      const d = o.createdAt?.toDate?.()
      return o.status === 'Delivered' && d && d >= startOfMonth
    })
    .reduce((sum, o) => sum + (o.orderTotal ?? 0), 0)

  const wonLeads = leads.filter((l) => l.status === 'Won').length
  const lostLeads = leads.filter((l) => l.status === 'Lost').length
  const conversionRate =
    wonLeads + lostLeads > 0
      ? Math.round((wonLeads / (wonLeads + lostLeads)) * 1000) / 10
      : 0

  // --- Chart: leads + revenue over last 6 months ---
  const last6 = getLast6Months()
  const chartData = last6.map(({ label, start, end }) => ({
    month: label,
    leads: leads.filter((l) => {
      const d = l.createdAt?.toDate?.()
      return d && d >= start && d < end
    }).length,
    revenue: orders
      .filter((o) => {
        const d = o.createdAt?.toDate?.()
        return d && o.status === 'Delivered' && d >= start && d < end
      })
      .reduce((sum, o) => sum + (o.orderTotal ?? 0), 0),
  }))

  // --- Chart: leads by status (pie) ---
  const leadsByStatus = STAGES.map((s) => ({
    name: s,
    value: leads.filter((l) => l.status === s).length,
    color: STATUS_COLORS[s],
  })).filter((s) => s.value > 0)

  // --- Leaderboard ---
  const leaderboard = dealers
    .map((dealer) => {
      const dl = leads.filter((l) => l.assignedDealerId === dealer.id)
      const won = dl.filter((l) => l.status === 'Won').length
      const lost = dl.filter((l) => l.status === 'Lost').length
      const pipeline = dl.filter((l) => !['Won', 'Lost'].includes(l.status)).length
      const revenue = orders
        .filter((o) => o.dealerId === dealer.id && o.status === 'Delivered')
        .reduce((sum, o) => sum + (o.orderTotal ?? 0), 0)
      const svcClosed = serviceTickets.filter(
        (t) => t.assignedDealerId === dealer.id && t.status === 'Closed'
      ).length
      const winRate =
        won + lost > 0 ? Math.round((won / (won + lost)) * 1000) / 10 : 0
      // Overall score: equal weight across 4 metrics (normalized 0–100)
      const score = Math.round((winRate + Math.min(revenue / 1000, 100) + Math.min(pipeline * 5, 100) + Math.min(svcClosed * 10, 100)) / 4)
      return { id: dealer.id, name: dealer.displayName, winRate, revenue, pipeline, svcClosed, score }
    })
    .sort((a, b) => b.score - a.score)

  return {
    loading,
    kpi: { totalLeads, openQuotes, revenueMTD, conversionRate },
    chartData,
    leadsByStatus,
    leaderboard,
  }
}
