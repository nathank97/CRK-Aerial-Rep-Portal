import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '../common/StatusBadge'
import { formatCurrency, formatDate } from '../../utils/formatters'

export default function KanbanCard({ lead }) {
  const navigate = useNavigate()
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-gray-200 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing select-none transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-[#8B6914]/30' : 'hover:shadow-md'
      }`}
      {...listeners}
      {...attributes}
    >
      <div
        className="group"
        onPointerUp={(e) => {
          // Only navigate if it wasn't a drag (transform stayed near 0)
          if (!transform || (Math.abs(transform.x) < 5 && Math.abs(transform.y) < 5)) {
            navigate(`/leads/${lead.id}`)
          }
        }}
      >
        <p className="font-semibold text-[#1A1A1A] text-sm leading-tight truncate group-hover:text-[#8B6914] transition-colors">
          {lead.firstName} {lead.lastName}
        </p>
        {lead.company && (
          <p className="text-[#9A9A9A] text-xs truncate mt-0.5">{lead.company}</p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          {lead.budget ? (
            <span className="text-xs text-[#4CAF7D] font-medium">{formatCurrency(lead.budget)}</span>
          ) : (
            <span />
          )}
          <span className="text-[#9A9A9A] text-xs">{formatDate(lead.updatedAt ?? lead.createdAt)}</span>
        </div>
        {lead.assignedDealerName && (
          <p className="text-[#9A9A9A] text-xs mt-1.5 truncate">👤 {lead.assignedDealerName}</p>
        )}
      </div>
    </div>
  )
}
