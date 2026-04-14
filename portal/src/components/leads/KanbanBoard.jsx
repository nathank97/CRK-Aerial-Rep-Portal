import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useState } from 'react'
import { doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { leadActivityCol } from '../../firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { convertLeadToCustomer } from '../../utils/customerUtils'
import KanbanCard from './KanbanCard'
import StatusBadge from '../common/StatusBadge'

const STAGES = ['New', 'Contacted', 'Pending', 'Demo Scheduled', 'Proposal Sent', 'Won', 'Lost']

const STAGE_COLORS = {
  New: 'border-t-[#4A90B8]',
  Contacted: 'border-t-[#E6A817]',
  Pending: 'border-t-[#E6A817]',
  'Demo Scheduled': 'border-t-[#8B6914]',
  'Proposal Sent': 'border-t-[#8B6914]',
  Won: 'border-t-[#4CAF7D]',
  Lost: 'border-t-[#D95F5F]',
}

function KanbanColumn({ status, leads }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-[#F4F4F5] rounded-xl border-t-4 ${STAGE_COLORS[status]} min-h-[400px] transition-colors ${
        isOver ? 'bg-[#8B6914]/5 ring-2 ring-[#8B6914]/20' : ''
      }`}
      style={{ minWidth: '220px' }}
    >
      {/* Column header */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#1A1A1A] uppercase tracking-wider">{status}</span>
        <span className="text-xs text-[#9A9A9A] bg-white border border-gray-200 rounded-full px-2 py-0.5 font-medium">
          {leads.length}
        </span>
      </div>
      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {leads.map((lead) => (
          <KanbanCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && (
          <div className="text-center py-8 text-[#9A9A9A] text-xs">No leads</div>
        )}
      </div>
    </div>
  )
}

export default function KanbanBoard({ leads }) {
  const { profile } = useAuth()
  const [activeId, setActiveId] = useState(null)
  const activeLead = leads.find((l) => l.id === activeId)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null)
    if (!over || active.id === over.id) return
    const lead = active.data.current?.lead
    const newStatus = over.id
    if (!lead || lead.status === newStatus || !STAGES.includes(newStatus)) return

    const prevStatus = lead.status
    await updateDoc(doc(db, 'leads', lead.id), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    })
    // Auto-convert to customer when dropped on Won
    if (newStatus === 'Won') {
      await convertLeadToCustomer({ ...lead, status: 'Won' }, profile)
    }
    // Auto-log the status change
    await addDoc(leadActivityCol(lead.id), {
      type: 'Status Change',
      details: `Status changed from ${prevStatus} to ${newStatus}`,
      previousStatus: prevStatus,
      newStatus,
      createdByName: profile?.displayName ?? 'Unknown',
      createdById: profile?.uid,
      timestamp: serverTimestamp(),
    })
  }

  const leadsByStage = STAGES.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s)
    return acc
  }, {})

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <KanbanColumn key={stage} status={stage} leads={leadsByStage[stage]} />
        ))}
      </div>

      {/* Drag ghost overlay */}
      <DragOverlay>
        {activeLead && (
          <div className="bg-white border-2 border-[#8B6914] rounded-lg p-3 shadow-xl w-56 opacity-95">
            <p className="font-semibold text-[#1A1A1A] text-sm truncate">
              {activeLead.firstName} {activeLead.lastName}
            </p>
            {activeLead.company && (
              <p className="text-[#9A9A9A] text-xs truncate mt-0.5">{activeLead.company}</p>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
