import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { updateDoc, doc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useReps } from '../../../hooks/useReps'
import { db } from '../../../firebase/config'
import { formatDate } from '../../../utils/formatters'

const STAGES = ['Prospect', 'Contacted', 'In Negotiation', 'Signed', 'Declined']

const stageColor = {
  Prospect: 'border-t-[#9A9A9A]',
  Contacted: 'border-t-[#4A90B8]',
  'In Negotiation': 'border-t-[#E6A817]',
  Signed: 'border-t-[#4CAF7D]',
  Declined: 'border-t-[#D95F5F]',
}

const stageBg = {
  Prospect: 'bg-[#F4F4F5]',
  Contacted: 'bg-[#4A90B8]/5',
  'In Negotiation': 'bg-[#E6A817]/5',
  Signed: 'bg-[#4CAF7D]/5',
  Declined: 'bg-[#D95F5F]/5',
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function RepCard({ rep, overlay = false }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rep.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white border border-gray-100 rounded-xl p-3 shadow-sm cursor-grab active:cursor-grabbing ${
        overlay ? 'shadow-lg rotate-1' : 'hover:shadow-md'
      } transition-shadow`}
      onClick={() => !overlay && navigate(`/admin/reps/${rep.id}`)}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-full bg-[#8B6914]/15 flex items-center justify-center text-xs font-bold text-[#8B6914] flex-shrink-0">
          {(rep.firstName ?? '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-[#1A1A1A] truncate">{rep.firstName} {rep.lastName}</p>
          {rep.company && <p className="text-xs text-[#9A9A9A] truncate">{rep.company}</p>}
        </div>
      </div>
      {rep.territoryName && (
        <p className="text-xs text-[#9A9A9A] mt-1">📍 {rep.territoryName}</p>
      )}
      {rep.commissionPercent != null && (
        <p className="text-xs text-[#8B6914] mt-1 font-medium">{rep.commissionPercent}% margin</p>
      )}
      <p className="text-xs text-[#9A9A9A] mt-1">{formatDate(rep.createdAt)}</p>
    </div>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({ stage, reps }) {
  const { setNodeRef } = useSortable({ id: stage })

  return (
    <div ref={setNodeRef} className={`flex flex-col rounded-2xl border border-gray-100 border-t-4 ${stageColor[stage]} ${stageBg[stage]} min-h-[500px] w-72 flex-shrink-0`}>
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#1A1A1A]">{stage}</span>
        <span className="text-xs font-bold text-[#9A9A9A] bg-white rounded-full px-2 py-0.5 border border-gray-200">
          {reps.length}
        </span>
      </div>
      <div className="flex-1 px-3 pb-3 space-y-2">
        <SortableContext items={reps.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {reps.map((rep) => <RepCard key={rep.id} rep={rep} />)}
        </SortableContext>
        {reps.length === 0 && (
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
            <p className="text-xs text-[#9A9A9A]">No prospects</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function RepPipeline() {
  const navigate = useNavigate()
  const { reps, loading } = useReps()
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Only show prospects (non-active/inactive/terminated) in pipeline
  const prospectReps = useMemo(() =>
    reps.filter((r) => ['Prospect', 'In Onboarding'].includes(r.status) ||
      STAGES.includes(r.pipelineStage)),
  [reps])

  const grouped = useMemo(() => {
    const map = {}
    STAGES.forEach((s) => { map[s] = [] })
    prospectReps.forEach((r) => {
      const stage = r.pipelineStage ?? 'Prospect'
      if (map[stage]) map[stage].push(r)
    })
    return map
  }, [prospectReps])

  const activeRep = activeId ? reps.find((r) => r.id === activeId) : null

  async function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over || active.id === over.id) return

    // Find which column we dropped into
    let targetStage = STAGES.find((s) => s === over.id)
    if (!targetStage) {
      // Dropped over a card — find that card's stage
      const targetRep = reps.find((r) => r.id === over.id)
      targetStage = targetRep?.pipelineStage ?? targetRep?.status
    }
    if (!targetStage || !STAGES.includes(targetStage)) return

    const rep = reps.find((r) => r.id === active.id)
    if (!rep || rep.pipelineStage === targetStage) return

    try {
      await updateDoc(doc(db, 'reps', active.id), {
        pipelineStage: targetStage,
        updatedAt: serverTimestamp(),
      })
      // Log stage change in notes
      await addDoc(collection(db, 'reps', active.id, 'notes'), {
        text: `Pipeline stage changed to "${targetStage}"`,
        type: 'General Note',
        createdAt: serverTimestamp(),
      })
    } catch (e) { console.error(e) }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Rep Recruitment Pipeline</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{prospectReps.length} prospect{prospectReps.length !== 1 ? 's' : ''} in pipeline</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/admin/reps')}
            className="border border-gray-200 text-[#1A1A1A] px-4 py-2 rounded-lg text-sm hover:bg-[#F4F4F5] transition-colors">
            List View
          </button>
          <button onClick={() => navigate('/admin/reps/new')}
            className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
            + Add Rep
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4">
          {STAGES.map((s) => (
            <div key={s} className="w-72 flex-shrink-0 bg-[#F4F4F5] rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-3 mb-2 h-20" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <DndContext
            sensors={sensors}
            onDragStart={({ active }) => setActiveId(active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="flex gap-4 min-w-max">
              {STAGES.map((stage) => (
                <Column key={stage} stage={stage} reps={grouped[stage] ?? []} />
              ))}
            </div>
            <DragOverlay>
              {activeRep && <RepCard rep={activeRep} overlay />}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  )
}
