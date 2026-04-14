import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { useInvoices } from '../../hooks/useInvoices'
import { useLeads } from '../../hooks/useLeads'
import { useCalendarEvents } from '../../hooks/useCalendarEvents'
import { useAuth } from '../../context/AuthContext'
import { eventsCol } from '../../firebase/firestore'
import { db } from '../../firebase/config'
import { formatCurrency } from '../../utils/formatters'

// ─── helpers ───────────────────────────────────────────────

function toDateStr(val) {
  if (!val) return null
  try {
    const d = val?.toDate ? val.toDate() : new Date(val)
    if (isNaN(d)) return null
    // Use local date to avoid UTC-offset day-shift issues
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch { return null }
}

function todayStr() {
  return toDateStr(new Date())
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ─── event type config ─────────────────────────────────────

const TYPE_CFG = {
  invoice:         { dot: 'bg-[#E6A817]', badge: 'bg-[#E6A817]/10 text-[#E6A817] border border-[#E6A817]/25', label: 'Invoice Due' },
  invoice_overdue: { dot: 'bg-[#D95F5F]', badge: 'bg-[#D95F5F]/10 text-[#D95F5F] border border-[#D95F5F]/25', label: 'Overdue' },
  followup:        { dot: 'bg-[#4A90B8]', badge: 'bg-[#4A90B8]/10 text-[#4A90B8] border border-[#4A90B8]/25', label: 'Follow-up' },
  demo:            { dot: 'bg-[#8B6914]', badge: 'bg-[#8B6914]/10 text-[#8B6914] border border-[#8B6914]/25', label: 'Demo' },
  event:           { dot: 'bg-[#6B5AE0]', badge: 'bg-[#6B5AE0]/10 text-[#6B5AE0] border border-[#6B5AE0]/25', label: 'Event' },
}

const EVENT_TYPES = ['Trade Show', 'Demo', 'Meeting', 'Other']

// ─── add-event modal ───────────────────────────────────────

function AddEventModal({ initialDate, onClose, onAdded }) {
  const { user, profile } = useAuth()
  const [form, setForm] = useState({
    title: '',
    date: initialDate ?? todayStr(),
    type: 'Trade Show',
    location: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (f, v) => setForm((p) => ({ ...p, [f]: v }))
  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] bg-white'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  async function save() {
    if (!form.title.trim()) { setError('Title is required.'); return }
    if (!form.date) { setError('Date is required.'); return }
    setSaving(true)
    try {
      await addDoc(eventsCol, {
        title: form.title.trim(),
        date: new Date(form.date),
        type: form.type,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
        createdByUid: user.uid,
        createdByName: profile?.displayName ?? user.email,
        createdAt: serverTimestamp(),
      })
      onAdded?.()
      onClose()
    } catch (e) {
      console.error(e)
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#1A1A1A]">Add Calendar Event</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Title *</label>
            <input value={form.title} onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Farm Progress Show" className={inputCls} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date *</label>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}>
                {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <input value={form.location} onChange={(e) => set('location', e.target.value)}
              placeholder="City, venue, etc." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)}
              rows={2} className={inputCls} placeholder="Optional details…" />
          </div>
          {error && <p className="text-sm text-[#D95F5F]">{error}</p>}
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Event'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── event item card (used in agenda panel) ────────────────

function EventItem({ item, onDelete, isAdmin }) {
  const cfg = TYPE_CFG[item.type] ?? TYPE_CFG.event
  return (
    <div className="flex items-start gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-sm group">
      <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.badge}`}>
            {cfg.label}
          </span>
          {item.eventType && item.type === 'event' && (
            <span className="text-[10px] text-[#9A9A9A]">{item.eventType}</span>
          )}
        </div>
        {item.link ? (
          <Link to={item.link} className="text-sm font-medium text-[#1A1A1A] hover:text-[#8B6914] transition-colors truncate block">
            {item.title}
          </Link>
        ) : (
          <p className="text-sm font-medium text-[#1A1A1A] truncate">{item.title}</p>
        )}
        {item.subtitle && (
          <p className="text-xs text-[#9A9A9A] truncate">{item.subtitle}</p>
        )}
        {item.notes && (
          <p className="text-xs text-[#9A9A9A] mt-1 italic truncate">{item.notes}</p>
        )}
      </div>
      {item.type === 'event' && (isAdmin || item.ownedByCurrentUser) && (
        <button
          onClick={() => onDelete(item.rawId)}
          className="text-[#9A9A9A] hover:text-[#D95F5F] text-lg leading-none opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          title="Delete event"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ─── main page ─────────────────────────────────────────────

export default function CalendarPage() {
  const { user, isAdmin } = useAuth()
  const { invoices } = useInvoices()
  const { leads } = useLeads()
  const { events: customEvents } = useCalendarEvents()

  const today = todayStr()

  // Calendar nav
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addModalDate, setAddModalDate] = useState(null)

  const prevMonth = () => setViewDate((v) => {
    const d = new Date(v.year, v.month - 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const nextMonth = () => setViewDate((v) => {
    const d = new Date(v.year, v.month + 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const goToday = () => {
    const d = new Date()
    setViewDate({ year: d.getFullYear(), month: d.getMonth() })
    setSelectedDate(today)
  }

  // ─── aggregate all calendar items ───────────────────────

  const allItems = useMemo(() => {
    const items = []

    // Invoices with due dates (unpaid only)
    for (const inv of invoices) {
      if (!inv.dueDate || inv.paymentStatus === 'Paid') continue
      const dateStr = toDateStr(inv.dueDate)
      if (!dateStr) continue
      const isOverdue = dateStr < today && inv.paymentStatus !== 'Paid'
      items.push({
        id: `inv-${inv.id}`,
        type: isOverdue ? 'invoice_overdue' : 'invoice',
        title: `${inv.invoiceNumber} — ${inv.customerName || 'Unknown'}`,
        subtitle: formatCurrency(inv.balanceDue ?? inv.total),
        date: dateStr,
        link: `/invoices/${inv.id}`,
      })
    }

    // Lead follow-ups
    for (const lead of leads) {
      if (!lead.nextFollowUp || ['Won', 'Lost'].includes(lead.status)) continue
      const dateStr = toDateStr(lead.nextFollowUp)
      if (!dateStr) continue
      items.push({
        id: `followup-${lead.id}`,
        type: 'followup',
        title: `Follow-up: ${lead.firstName} ${lead.lastName}`,
        subtitle: lead.company || lead.status,
        date: dateStr,
        link: `/leads/${lead.id}`,
      })
    }

    // Lead demos
    for (const lead of leads) {
      if (!lead.demoDate || ['Won', 'Lost'].includes(lead.status)) continue
      const dateStr = toDateStr(lead.demoDate)
      if (!dateStr) continue
      items.push({
        id: `demo-${lead.id}`,
        type: 'demo',
        title: `Demo: ${lead.firstName} ${lead.lastName}`,
        subtitle: lead.company || '',
        date: dateStr,
        link: `/leads/${lead.id}`,
      })
    }

    // Custom events
    for (const ev of customEvents) {
      if (!ev.date) continue
      const dateStr = toDateStr(ev.date)
      if (!dateStr) continue
      items.push({
        id: `event-${ev.id}`,
        rawId: ev.id,
        type: 'event',
        title: ev.title,
        subtitle: ev.location || '',
        notes: ev.notes || '',
        date: dateStr,
        eventType: ev.type,
        ownedByCurrentUser: ev.createdByUid === user?.uid,
      })
    }

    return items.sort((a, b) => a.date.localeCompare(b.date))
  }, [invoices, leads, customEvents, today, user?.uid])

  const byDate = useMemo(() => {
    const map = {}
    for (const item of allItems) {
      if (!map[item.date]) map[item.date] = []
      map[item.date].push(item)
    }
    return map
  }, [allItems])

  // ─── upcoming items (next 60 days) ──────────────────────

  const upcomingItems = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + 60)
    const cutoffStr = toDateStr(cutoff)
    return allItems.filter((i) => i.date >= today && i.date <= cutoffStr)
  }, [allItems, today])

  // ─── panel items (selected day or upcoming) ─────────────

  const panelItems = selectedDate ? (byDate[selectedDate] ?? []) : upcomingItems

  // ─── month grid cells ───────────────────────────────────

  const cells = useMemo(() => {
    const { year, month } = viewDate
    const firstDay = new Date(year, month, 1).getDay() // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const result = []
    // leading empty cells
    for (let i = 0; i < firstDay; i++) result.push(null)
    // days
    for (let d = 1; d <= daysInMonth; d++) {
      const m = String(month + 1).padStart(2, '0')
      const dd = String(d).padStart(2, '0')
      result.push(`${year}-${m}-${dd}`)
    }
    // trailing empty cells to complete the last row
    while (result.length % 7 !== 0) result.push(null)
    return result
  }, [viewDate])

  async function deleteEvent(rawId) {
    if (!window.confirm('Delete this event?')) return
    try {
      await deleteDoc(doc(db, 'events', rawId))
    } catch (e) {
      console.error(e)
    }
  }

  // ─── render ─────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Calendar</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">Invoice due dates, lead follow-ups, demos, and events</p>
        </div>
        <button
          onClick={() => { setAddModalDate(null); setShowAddModal(true) }}
          className="px-4 py-2 bg-[#8B6914] text-white rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors"
        >
          + Add Event
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Month grid ── */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <button onClick={prevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F4F4F5] text-[#9A9A9A] hover:text-[#1A1A1A] transition-colors">
                ←
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-[#1A1A1A]">
                  {MONTH_NAMES[viewDate.month]} {viewDate.year}
                </h2>
                <button onClick={goToday}
                  className="text-xs text-[#8B6914] border border-[#8B6914]/30 hover:bg-[#8B6914]/5 px-2.5 py-1 rounded-lg transition-colors font-medium">
                  Today
                </button>
              </div>
              <button onClick={nextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F4F4F5] text-[#9A9A9A] hover:text-[#1A1A1A] transition-colors">
                →
              </button>
            </div>

            {/* DOW headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DOW.map((d) => (
                <div key={d} className="py-2 text-center text-[10px] font-semibold text-[#9A9A9A] uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {cells.map((dateStr, i) => {
                if (!dateStr) {
                  return <div key={`empty-${i}`} className="border-b border-r border-gray-50 min-h-[80px]" />
                }
                const dayEvents = byDate[dateStr] ?? []
                const isToday = dateStr === today
                const isSelected = dateStr === selectedDate
                const isPast = dateStr < today
                const isCurrentMonth = dateStr.startsWith(
                  `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}`
                )
                const dayNum = parseInt(dateStr.split('-')[2], 10)

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                    className={`
                      min-h-[80px] p-2 text-left border-b border-r border-gray-50 transition-colors
                      ${isSelected ? 'bg-[#8B6914]/8 ring-2 ring-inset ring-[#8B6914]/30' : 'hover:bg-[#F4F4F5]'}
                      ${isPast && !isToday ? 'opacity-60' : ''}
                    `}
                  >
                    {/* Day number */}
                    <span className={`
                      inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mb-1
                      ${isToday ? 'bg-[#8B6914] text-white' : 'text-[#1A1A1A]'}
                    `}>
                      {dayNum}
                    </span>

                    {/* Event dots */}
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const cfg = TYPE_CFG[ev.type] ?? TYPE_CFG.event
                        return (
                          <div key={ev.id} className="flex items-center gap-1 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                            <span className="text-[10px] text-[#1A1A1A] truncate leading-tight">
                              {ev.title}
                            </span>
                          </div>
                        )
                      })}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-[#9A9A9A]">+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 px-1">
            {Object.entries(TYPE_CFG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className="text-xs text-[#9A9A9A]">{cfg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Agenda panel ── */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                {selectedDate ? (
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A1A]">
                      {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, {
                        weekday: 'long', month: 'long', day: 'numeric',
                      })}
                    </p>
                    <p className="text-xs text-[#9A9A9A]">{panelItems.length} event{panelItems.length !== 1 ? 's' : ''}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A1A]">Upcoming (60 days)</p>
                    <p className="text-xs text-[#9A9A9A]">{upcomingItems.length} event{upcomingItems.length !== 1 ? 's' : ''}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedDate && (
                  <>
                    <button
                      onClick={() => { setAddModalDate(selectedDate); setShowAddModal(true) }}
                      className="text-xs text-[#8B6914] border border-[#8B6914]/30 px-2 py-1 rounded-lg hover:bg-[#8B6914]/5 transition-colors"
                    >
                      + Add
                    </button>
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="text-xs text-[#9A9A9A] hover:text-[#1A1A1A] transition-colors"
                    >
                      Clear ×
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Event list */}
            <div className="flex-1 overflow-y-auto max-h-[520px]">
              {panelItems.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-[#9A9A9A]">
                    {selectedDate ? 'Nothing scheduled for this day.' : 'No upcoming events in the next 60 days.'}
                  </p>
                  {selectedDate && (
                    <button
                      onClick={() => { setAddModalDate(selectedDate); setShowAddModal(true) }}
                      className="mt-3 text-sm text-[#8B6914] hover:underline"
                    >
                      + Add an event
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {/* Group by date when showing upcoming */}
                  {selectedDate ? (
                    panelItems.map((item) => (
                      <EventItem key={item.id} item={item} onDelete={deleteEvent} isAdmin={isAdmin} />
                    ))
                  ) : (
                    (() => {
                      const groups = []
                      let lastDate = null
                      for (const item of panelItems) {
                        if (item.date !== lastDate) {
                          lastDate = item.date
                          const d = new Date(item.date + 'T12:00:00')
                          const isItemToday = item.date === today
                          const label = isItemToday
                            ? 'Today'
                            : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
                          groups.push(
                            <p key={`hdr-${item.date}`} className={`text-xs font-semibold uppercase tracking-wider mt-3 mb-1.5 first:mt-0 px-1 ${
                              isItemToday ? 'text-[#8B6914]' : 'text-[#9A9A9A]'
                            }`}>
                              {label}
                            </p>
                          )
                        }
                        groups.push(
                          <EventItem key={item.id} item={item} onDelete={deleteEvent} isAdmin={isAdmin} />
                        )
                      }
                      return groups
                    })()
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddEventModal
          initialDate={addModalDate ?? todayStr()}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {}}
        />
      )}
    </div>
  )
}
