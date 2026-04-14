export function SkeletonCard({ className = '' }) {
  return (
    <div className={`animate-pulse bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      <div className="p-5 space-y-3">
        <div className="h-3 bg-gray-100 rounded w-1/3" />
        <div className="h-8 bg-gray-100 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="animate-pulse flex gap-4 py-3 px-4 border-b border-gray-100">
      <div className="h-4 bg-gray-100 rounded flex-1" />
      <div className="h-4 bg-gray-100 rounded w-24" />
      <div className="h-4 bg-gray-100 rounded w-20" />
      <div className="h-4 bg-gray-100 rounded w-16" />
    </div>
  )
}

export function SkeletonText({ className = '' }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />
}

export function SkeletonChart({ className = '' }) {
  return (
    <div className={`animate-pulse bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      <div className="p-5">
        <div className="h-4 bg-gray-100 rounded w-1/4 mb-4" />
        <div className="h-48 bg-gray-50 rounded-lg flex items-end gap-2 px-4 pb-4">
          {[60, 80, 45, 90, 55, 70].map((h, i) => (
            <div key={i} className="flex-1 bg-gray-100 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
