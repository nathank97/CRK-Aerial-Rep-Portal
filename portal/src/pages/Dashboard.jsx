import { useDashboardData } from '../hooks/useDashboardData'
import { useAuth } from '../context/AuthContext'
import KPICard from '../components/dashboard/KPICard'
import LeaderboardTable from '../components/dashboard/LeaderboardTable'
import LeadsRevenueChart from '../components/dashboard/charts/LeadsRevenueChart'
import LeadsByStatusChart from '../components/dashboard/charts/LeadsByStatusChart'
import { SkeletonCard } from '../components/common/SkeletonCard'
import { formatCurrency } from '../utils/formatters'

export default function Dashboard() {
  const { profile } = useAuth()
  const { loading, kpi, chartData, leadsByStatus, leaderboard } = useDashboardData()

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const vis = profile?.dashboardVisibility ?? {}
  const show = (key) => profile?.role === 'admin' || vis[key] !== false

  return (
    <div className="p-4 sm:p-6 max-w-screen-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Dashboard</h1>
        <p className="text-[#9A9A9A] text-sm mt-0.5">{today}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            {show('kpiLeads') && (
              <KPICard label="Total Leads" value={kpi.totalLeads.toLocaleString()} sub="all time" icon="◎" color="blue" />
            )}
            {show('kpiQuotes') && (
              <KPICard label="Open Quotes" value={kpi.openQuotes.toLocaleString()} sub="draft + sent" icon="📋" color="amber" />
            )}
            {show('kpiRevenueClosed') && (
              <KPICard label="Revenue MTD" value={formatCurrency(kpi.revenueMTD)} sub="delivered orders this month" icon="💰" color="green" />
            )}
            <KPICard label="Conversion Rate" value={`${kpi.conversionRate}%`} sub="won ÷ (won + lost)" icon="🎯" color="bronze" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {show('chartLeadsOverTime') && <LeadsRevenueChart data={chartData} loading={loading} />}
        </div>
        <div>
          {show('chartLeadsByStatus') && <LeadsByStatusChart data={leadsByStatus} loading={loading} />}
        </div>
      </div>

      {/* Leaderboard */}
      {show('leaderboard') && (
        <LeaderboardTable rows={leaderboard} loading={loading} />
      )}
    </div>
  )
}
