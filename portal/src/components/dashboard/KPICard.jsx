export default function KPICard({ label, value, sub, icon, color = 'bronze' }) {
  const accent = {
    bronze: 'text-[#8B6914]',
    green: 'text-[#4CAF7D]',
    blue: 'text-[#4A90B8]',
    amber: 'text-[#E6A817]',
  }[color]

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[#9A9A9A] text-xs font-semibold uppercase tracking-wider">{label}</span>
        {icon && (
          <span className={`text-xl ${accent}`}>{icon}</span>
        )}
      </div>
      <div>
        <p className={`text-3xl font-bold ${accent}`}>{value}</p>
        {sub && <p className="text-[#9A9A9A] text-xs mt-1">{sub}</p>}
      </div>
    </div>
  )
}
