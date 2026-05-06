import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReps } from '../../../hooks/useReps'
import { formatDate } from '../../../utils/formatters'

const STATUSES = ['Prospect', 'In Onboarding', 'Active Rep', 'Inactive Rep', 'Terminated']
const PIPELINE_STAGES = ['Prospect', 'Contacted', 'In Negotiation', 'Signed', 'Declined']

const statusColor = {
  'Active Rep': 'bg-[#4CAF7D]/10 text-[#4CAF7D]',
  'In Onboarding': 'bg-[#4A90B8]/10 text-[#4A90B8]',
  Prospect: 'bg-[#E6A817]/10 text-[#E6A817]',
  'Inactive Rep': 'bg-gray-100 text-gray-500',
  Terminated: 'bg-[#D95F5F]/10 text-[#D95F5F]',
}

const stageBorderColor = {
  Prospect: 'border-t-[#9A9A9A]',
  Contacted: 'border-t-[#4A90B8]',
  'In Negotiation': 'border-t-[#E6A817]',
  Signed: 'border-t-[#4CAF7D]',
  Declined: 'border-t-[#D95F5F]',
}

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`text-sm leading-none ${n <= (rating ?? 0) ? 'text-[#E6A817]' : 'text-gray-200'}`}>
          ★
        </span>
      ))}
    </div>
  )
}

export default function RepManagementHub() {
  const navigate = useNavigate()
  const { reps, loading } = useReps()
  const [activeTab, setActiveTab] = useState('performance')

  const activeReps = useMemo(
    () => reps.filter((r) => ['Active Rep', 'In Onboarding'].includes(r.status)),
    [reps]
  )

  const inactiveReps = useMemo(
    () => reps.filter((r) => ['Inactive Rep', 'Terminated'].includes(r.status)),
    [reps]
  )

  const prospectReps = useMemo(
    () => reps.filter((r) => r.status === 'Prospect' || PIPELINE_STAGES.includes(r.pipelineStage)),
    [reps]
  )

  const pipelineGrouped = useMemo(() => {
    const map = {}
    PIPELINE_STAGES.forEach((s) => { map[s] = [] })
    prospectReps.forEach((r) => {
      const stage = r.pipelineStage ?? 'Prospect'
      if (map[stage]) map[stage].push(r)
    })
    return map
  }, [prospectReps])

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Rep Management</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{loading ? '…' : reps.length} rep{reps.length !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/admin/reps')}
            className="border border-gray-200 text-[#1A1A1A] px-4 py-2 rounded-lg text-sm hover:bg-[#F4F4F5] transition-colors"
          >
            Full List
          </button>
          <button
            onClick={() => navigate('/admin/reps/new')}
            className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors"
          >
            + Add Rep
          </button>
        </div>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {STATUSES.map((s) => {
          const count = reps.filter((r) => r.status === s).length
          return (
            <div key={s} className="rounded-xl border border-gray-100 bg-white shadow-sm p-3">
              <p className="text-xl font-bold text-[#1A1A1A]">{loading ? '…' : count}</p>
              <p className="text-xs text-[#9A9A9A] mt-0.5">{s}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100 mb-5">
        {[
          { key: 'performance', label: 'Performance Overview' },
          { key: 'pipeline', label: 'Recruitment Pipeline' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? 'border-[#8B6914] text-[#8B6914]'
                : 'border-transparent text-[#9A9A9A] hover:text-[#1A1A1A]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Performance Overview ────────────────────────────────────────────── */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Active & Onboarding */}
          <div>
            <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3">
              Active &amp; Onboarding
              <span className="ml-2 text-xs font-normal text-[#9A9A9A]">({activeReps.length})</span>
            </h2>

            {loading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
              </div>
            ) : activeReps.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-xl p-10 text-center">
                <p className="text-[#9A9A9A] text-sm">No active or onboarding reps yet.</p>
                <button
                  onClick={() => navigate('/admin/reps/new')}
                  className="mt-3 text-[#8B6914] hover:underline text-sm font-medium"
                >
                  Add your first rep →
                </button>
              </div>
            ) : (
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-[#F4F4F5]">
                      {['Rep', 'Status', 'Territory', 'Commission', 'Rating', 'Last Review', 'Review Notes', ''].map((h) => (
                        <th
                          key={h}
                          className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {activeReps.map((rep) => (
                      <tr
                        key={rep.id}
                        onClick={() => navigate(`/admin/reps/${rep.id}`)}
                        className="hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#8B6914]/15 flex items-center justify-center text-xs font-bold text-[#8B6914] shrink-0">
                              {(rep.firstName ?? '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-[#1A1A1A]">
                                {rep.firstName} {rep.lastName}
                              </p>
                              {rep.company && <p className="text-xs text-[#9A9A9A]">{rep.company}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[rep.status] ?? 'bg-gray-100 text-gray-500'}`}
                          >
                            {rep.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-[#9A9A9A]">{rep.territoryName || '—'}</td>
                        <td className="py-3 px-4">
                          {rep.commissionPercent != null ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#8B6914]/10 text-[#8B6914]">
                              {rep.commissionPercent}%
                            </span>
                          ) : (
                            <span className="text-[#9A9A9A] text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {rep.performanceRating ? (
                            <StarRating rating={rep.performanceRating} />
                          ) : (
                            <span className="text-xs text-[#9A9A9A]">Not rated</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#9A9A9A] whitespace-nowrap">
                          {formatDate(rep.lastReviewDate) || '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#9A9A9A] max-w-[180px]">
                          {rep.reviewNotes ? (
                            <p className="truncate">{rep.reviewNotes}</p>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/reps/${rep.id}`) }}
                            className="text-xs text-[#8B6914] hover:underline font-medium whitespace-nowrap"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Inactive & Terminated */}
          {!loading && inactiveReps.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-[#9A9A9A] mb-3">
                Inactive &amp; Terminated
                <span className="ml-2 text-xs font-normal">({inactiveReps.length})</span>
              </h2>
              <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <tbody className="divide-y divide-gray-50">
                    {inactiveReps.map((rep) => (
                      <tr
                        key={rep.id}
                        onClick={() => navigate(`/admin/reps/${rep.id}`)}
                        className="hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                              {(rep.firstName ?? '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-[#9A9A9A]">
                                {rep.firstName} {rep.lastName}
                              </p>
                              {rep.company && <p className="text-xs text-[#BEBEBE]">{rep.company}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[rep.status] ?? 'bg-gray-100 text-gray-500'}`}
                          >
                            {rep.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-[#9A9A9A]">{rep.territoryName || '—'}</td>
                        <td className="py-3 px-4 text-xs text-[#9A9A9A] whitespace-nowrap">
                          {formatDate(rep.lastReviewDate) || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/admin/reps/${rep.id}`) }}
                            className="text-xs text-[#9A9A9A] hover:underline font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recruitment Pipeline ────────────────────────────────────────────── */}
      {activeTab === 'pipeline' && (
        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <p className="text-sm text-[#9A9A9A]">
              {loading ? '…' : prospectReps.length} potential rep{prospectReps.length !== 1 ? 's' : ''} being developed
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/admin/reps/pipeline')}
                className="border border-gray-200 text-[#1A1A1A] px-4 py-2 rounded-lg text-sm hover:bg-[#F4F4F5] transition-colors"
              >
                Kanban View
              </button>
              <button
                onClick={() => navigate('/admin/reps/new')}
                className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors"
              >
                + Add Prospect
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-pulse">
              {PIPELINE_STAGES.map((s) => <div key={s} className="h-48 bg-gray-100 rounded-xl" />)}
            </div>
          ) : prospectReps.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-10 text-center">
              <p className="text-[#9A9A9A] text-sm">No prospects in the pipeline yet.</p>
              <button
                onClick={() => navigate('/admin/reps/new')}
                className="mt-3 text-[#8B6914] hover:underline text-sm font-medium"
              >
                Add your first prospect →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {PIPELINE_STAGES.map((stage) => {
                const stageReps = pipelineGrouped[stage] ?? []
                return (
                  <div
                    key={stage}
                    className={`bg-white border border-gray-100 border-t-4 ${stageBorderColor[stage]} rounded-xl shadow-sm overflow-hidden`}
                  >
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1A1A1A]">{stage}</span>
                      <span className="text-xs font-bold text-[#9A9A9A] bg-[#F4F4F5] rounded-full px-2 py-0.5">
                        {stageReps.length}
                      </span>
                    </div>
                    <div className="p-3 space-y-2 min-h-[120px]">
                      {stageReps.length === 0 ? (
                        <p className="text-xs text-[#9A9A9A] text-center pt-4">None</p>
                      ) : (
                        stageReps.map((rep) => (
                          <div
                            key={rep.id}
                            onClick={() => navigate(`/admin/reps/${rep.id}`)}
                            className="p-3 border border-gray-100 rounded-lg hover:border-[#8B6914]/30 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-6 h-6 rounded-full bg-[#8B6914]/15 flex items-center justify-center text-[10px] font-bold text-[#8B6914] shrink-0">
                                {(rep.firstName ?? '?')[0].toUpperCase()}
                              </div>
                              <p className="text-xs font-semibold text-[#1A1A1A] truncate">
                                {rep.firstName} {rep.lastName}
                              </p>
                            </div>
                            {rep.company && (
                              <p className="text-[10px] text-[#9A9A9A] truncate">{rep.company}</p>
                            )}
                            {rep.territoryName && (
                              <p className="text-[10px] text-[#9A9A9A] mt-0.5 truncate">
                                📍 {rep.territoryName}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="mt-4 text-xs text-[#9A9A9A] text-center">
            Drag and drop prospects between stages in{' '}
            <button
              onClick={() => navigate('/admin/reps/pipeline')}
              className="text-[#8B6914] hover:underline font-medium"
            >
              Kanban View
            </button>
            .
          </p>
        </div>
      )}
    </div>
  )
}
