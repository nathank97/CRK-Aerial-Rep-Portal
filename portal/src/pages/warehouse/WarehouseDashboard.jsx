import { useState, useEffect } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { inventoryCol, ordersCol } from '../../firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../../components/common/StatusBadge'
import { formatDate } from '../../utils/formatters'

export default function WarehouseDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [inventory, setInventory] = useState([])
  const [pendingOrders, setPendingOrders] = useState([])
  const [loadingInv, setLoadingInv] = useState(true)
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(inventoryCol, (snap) => {
      setInventory(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoadingInv(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    const q = query(ordersCol, where('sentToWarehouse', '==', true))
    const unsub = onSnapshot(q, (snap) => {
      setPendingOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoadingOrders(false)
    })
    return unsub
  }, [])

  const negativeStock = inventory.filter((item) => (item.quantityOnHand ?? 0) < 0)
  const lowStock = inventory.filter(
    (item) => (item.quantityOnHand ?? 0) >= 0 && (item.quantityOnHand ?? 0) <= 2
  )

  const kpis = [
    { label: 'Pending Orders', value: loadingOrders ? '—' : pendingOrders.length, color: 'text-[#8B6914]', bg: 'bg-[#8B6914]/10' },
    { label: 'Negative Stock', value: loadingInv ? '—' : negativeStock.length, color: negativeStock.length > 0 ? 'text-[#D95F5F]' : 'text-[#6DBE7A]', bg: negativeStock.length > 0 ? 'bg-[#D95F5F]/10' : 'bg-[#6DBE7A]/10' },
    { label: 'Low Stock Items', value: loadingInv ? '—' : lowStock.length, color: lowStock.length > 0 ? 'text-[#F0A500]' : 'text-[#6DBE7A]', bg: lowStock.length > 0 ? 'bg-[#F0A500]/10' : 'bg-[#6DBE7A]/10' },
    { label: 'Total SKUs', value: loadingInv ? '—' : inventory.length, color: 'text-[#9A9A9A]', bg: 'bg-[#F4F4F5]' },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Warehouse Dashboard</h1>
        <p className="text-sm text-[#9A9A9A] mt-0.5">Welcome back, {profile?.displayName}</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm`}>
            <p className="text-xs text-[#9A9A9A] font-medium">{k.label}</p>
            <p className={`text-3xl font-bold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Pending Orders Queue */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-[#111111]">Pending Fulfillment Queue</h2>
          <button
            onClick={() => navigate('/orders')}
            className="text-xs text-[#8B6914] hover:underline font-medium"
          >
            View all orders →
          </button>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loadingOrders ? (
            <div className="py-10 text-center text-[#9A9A9A] text-sm animate-pulse">Loading…</div>
          ) : pendingOrders.length === 0 ? (
            <div className="py-10 text-center text-[#9A9A9A] text-sm">
              No orders pending fulfillment.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F4F4F5]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Order #</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Customer</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingOrders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/orders/${o.id}`)}
                    className="hover:bg-[#F4F4F5] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-[#8B6914]">{o.orderNumber}</td>
                    <td className="py-3 px-4 font-medium text-[#111111]">{o.customerName || '—'}</td>
                    <td className="py-3 px-4"><StatusBadge status={o.status ?? 'Processing'} /></td>
                    <td className="py-3 px-4 text-[#9A9A9A]">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Negative Stock Alerts */}
      {!loadingInv && negativeStock.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-[#D95F5F]">Negative Stock Alerts</h2>
            <button
              onClick={() => navigate('/inventory')}
              className="text-xs text-[#8B6914] hover:underline font-medium"
            >
              View inventory →
            </button>
          </div>
          <div className="bg-white rounded-xl border border-[#D95F5F]/30 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-[#D95F5F]/5">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Model</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">SKU / Serial</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Location</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">On Hand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {negativeStock.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F4F4F5] cursor-pointer transition-colors" onClick={() => navigate('/inventory')}>
                    <td className="py-3 px-4 font-medium text-[#111111]">{item.model || '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-[#9A9A9A]">{item.sku || item.serialNumber || '—'}</td>
                    <td className="py-3 px-4 text-[#9A9A9A]">{item.locationName || '—'}</td>
                    <td className="py-3 px-4 text-right font-bold text-[#D95F5F]">{item.quantityOnHand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Low Stock */}
      {!loadingInv && lowStock.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-[#F0A500]">Low Stock</h2>
            <button
              onClick={() => navigate('/inventory')}
              className="text-xs text-[#8B6914] hover:underline font-medium"
            >
              View inventory →
            </button>
          </div>
          <div className="bg-white rounded-xl border border-[#F0A500]/30 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-[#F0A500]/5">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Model</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">SKU / Serial</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">Location</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">On Hand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lowStock.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F4F4F5] cursor-pointer transition-colors" onClick={() => navigate('/inventory')}>
                    <td className="py-3 px-4 font-medium text-[#111111]">{item.model || '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-[#9A9A9A]">{item.sku || item.serialNumber || '—'}</td>
                    <td className="py-3 px-4 text-[#9A9A9A]">{item.locationName || '—'}</td>
                    <td className="py-3 px-4 text-right font-bold text-[#F0A500]">{item.quantityOnHand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
