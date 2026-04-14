import { useState, useMemo } from 'react'
import { updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { useAllUsers } from '../../hooks/useUsers'
import { createDealerAccount } from '../../firebase/auth'
import { db } from '../../firebase/config'
import { formatDate } from '../../utils/formatters'

// ─── Constants ──────────────────────────────────────────────────────────────

const DASHBOARD_WIDGETS = [
  { key: 'kpiLeads', label: 'KPI: Total Leads' },
  { key: 'kpiCustomers', label: 'KPI: Total Customers' },
  { key: 'kpiQuotes', label: 'KPI: Open Quotes' },
  { key: 'kpiOrders', label: 'KPI: Total Orders' },
  { key: 'kpiServiceTickets', label: 'KPI: Open Service Tickets' },
  { key: 'kpiInventory', label: 'KPI: Inventory Units' },
  { key: 'kpiPipelineValue', label: 'KPI: Pipeline Value' },
  { key: 'kpiRevenueClosed', label: 'KPI: Revenue Closed' },
  { key: 'chartLeadsByStatus', label: 'Chart: Leads by Status' },
  { key: 'chartLeadsByDealer', label: 'Chart: Leads by Dealer' },
  { key: 'chartWonVsLost', label: 'Chart: Won vs Lost' },
  { key: 'chartLeadsOverTime', label: 'Chart: Leads Over Time' },
  { key: 'chartRevenueOverTime', label: 'Chart: Revenue Over Time' },
  { key: 'chartTopModels', label: 'Chart: Top Drone Models' },
  { key: 'chartInventoryLevels', label: 'Chart: Inventory Levels' },
  { key: 'chartServiceTickets', label: 'Chart: Service Tickets' },
  { key: 'leaderboard', label: 'Dealer Leaderboard' },
]

const MODULE_ACCESS = [
  { key: 'quotesOrders', label: 'Quotes & Orders' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'service', label: 'Service & Repair' },
  { key: 'documents', label: 'Documents' },
  { key: 'map', label: 'Customer Map' },
]

const DEFAULT_DASHBOARD_VISIBILITY = Object.fromEntries(DASHBOARD_WIDGETS.map((w) => [w.key, true]))
const DEFAULT_MODULE_ACCESS = Object.fromEntries(MODULE_ACCESS.map((m) => [m.key, true]))

// ─── Sub-components ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-[#8B6914]' : 'bg-gray-200'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  )
}

// ─── New Dealer Modal ────────────────────────────────────────────────────────

function NewDealerModal({ onClose, onCreated }) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [marginPercent, setMarginPercent] = useState('20')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  async function handleCreate() {
    if (!displayName.trim()) { setError('Display name is required.'); return }
    if (!email.trim()) { setError('Email is required.'); return }
    if (!tempPassword.trim() || tempPassword.length < 6) { setError('Temporary password must be at least 6 characters.'); return }
    setSaving(true)
    setError('')
    try {
      await createDealerAccount({
        email: email.trim(),
        tempPassword: tempPassword.trim(),
        displayName: displayName.trim(),
        marginPercent: parseFloat(marginPercent) || 0,
      })
      onCreated()
    } catch (e) {
      console.error(e)
      setError(e.message ?? 'Failed to create dealer account.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Create Dealer Account</h2>
          <p className="text-xs text-[#9A9A9A] mt-0.5">A password reset email will be sent after creation.</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Display Name *</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="John Smith" />
          </div>
          <div>
            <label className={labelCls}>Email Address *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="dealer@example.com" />
          </div>
          <div>
            <label className={labelCls}>Temporary Password *</label>
            <input type="password" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} className={inputCls} placeholder="Min. 6 characters" />
          </div>
          <div>
            <label className={labelCls}>Margin % (dealer discount from MSRP)</label>
            <div className="relative">
              <input type="number" min="0" max="100" step="0.5" value={marginPercent}
                onChange={(e) => setMarginPercent(e.target.value)} className={inputCls + ' pr-8'} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#9A9A9A]">%</span>
            </div>
            <p className="text-xs text-[#9A9A9A] mt-1">Dealer Price = MSRP × (1 − Margin%). Example: 20% → $2,000 MSRP = $1,600 dealer price.</p>
          </div>
          {error && <p className="text-sm text-[#D95F5F]">{error}</p>}
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Dealer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Dealer Detail Panel ─────────────────────────────────────────────────────

function DealerPanel({ dealer, onClose }) {
  const [marginPercent, setMarginPercent] = useState(dealer.marginPercent ?? 0)
  const [dashVis, setDashVis] = useState(dealer.dashboardVisibility ?? DEFAULT_DASHBOARD_VISIBILITY)
  const [modAccess, setModAccess] = useState(dealer.moduleAccess ?? DEFAULT_MODULE_ACCESS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggleWidget(key) {
    setDashVis((v) => ({ ...v, [key]: !v[key] }))
    setSaved(false)
  }

  function toggleModule(key) {
    setModAccess((m) => ({ ...m, [key]: !m[key] }))
    setSaved(false)
  }

  function setAllWidgets(val) {
    setDashVis(Object.fromEntries(DASHBOARD_WIDGETS.map((w) => [w.key, val])))
    setSaved(false)
  }

  function setAllModules(val) {
    setModAccess(Object.fromEntries(MODULE_ACCESS.map((m) => [m.key, val])))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', dealer.id), {
        marginPercent: parseFloat(marginPercent) || 0,
        dashboardVisibility: dashVis,
        moduleAccess: modAccess,
        updatedAt: serverTimestamp(),
      })
      setSaved(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#1A1A1A]">{dealer.displayName}</h2>
            <p className="text-xs text-[#9A9A9A] mt-0.5">{dealer.email} · Joined {formatDate(dealer.createdAt)}</p>
          </div>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#1A1A1A] text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {/* Margin */}
          <div>
            <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Pricing Margin</h3>
            <div className="flex items-center gap-3">
              <div className="relative w-36">
                <input type="number" min="0" max="100" step="0.5" value={marginPercent}
                  onChange={(e) => { setMarginPercent(e.target.value); setSaved(false) }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:border-[#8B6914]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#9A9A9A]">%</span>
              </div>
              <p className="text-xs text-[#9A9A9A]">Dealer Price = MSRP × (1 − {marginPercent || 0}%)</p>
            </div>
          </div>

          {/* Module Access */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Module Access</h3>
              <div className="flex gap-3 text-xs">
                <button onClick={() => setAllModules(true)} className="text-[#8B6914] hover:underline">Enable all</button>
                <button onClick={() => setAllModules(false)} className="text-[#9A9A9A] hover:underline">Disable all</button>
              </div>
            </div>
            <div className="space-y-2">
              {MODULE_ACCESS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-[#1A1A1A]">{label}</span>
                  <Toggle checked={modAccess[key] ?? true} onChange={() => toggleModule(key)} />
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard Visibility */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Dashboard Widgets</h3>
              <div className="flex gap-3 text-xs">
                <button onClick={() => setAllWidgets(true)} className="text-[#8B6914] hover:underline">Show all</button>
                <button onClick={() => setAllWidgets(false)} className="text-[#9A9A9A] hover:underline">Hide all</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {DASHBOARD_WIDGETS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-[#1A1A1A]">{label}</span>
                  <Toggle checked={dashVis[key] ?? true} onChange={() => toggleWidget(key)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors">
            Close
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-[#8B6914] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DealerManagement() {
  const { users, loading } = useAllUsers()
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedDealer, setSelectedDealer] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'users', deleteTarget.id))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const dealers = useMemo(() =>
    users.filter((u) => u.role === 'dealer')
      .filter((u) => !search || u.displayName?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''))
  , [users, search])

  const admins = useMemo(() => users.filter((u) => u.role === 'admin'), [users])

  return (
    <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Dealer Management</h1>
          <p className="text-sm text-[#9A9A9A] mt-0.5">{dealers.length} dealer{dealers.length !== 1 ? 's' : ''} · {admins.length} admin{admins.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowNewModal(true)}
          className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors">
          + Add Dealer
        </button>
      </div>

      {/* Search */}
      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search dealers by name or email…"
        className="w-full max-w-sm border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914] mb-5 bg-white" />

      {/* Dealers Table */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-[#F4F4F5]">
              {['Dealer', 'Email', 'Margin %', 'Modules', 'Joined', 'Actions'].map((h) => (
                <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="py-3 px-4"><div className="h-4 bg-gray-100 rounded w-3/4" /></td>
                  ))}
                </tr>
              ))
            ) : dealers.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-[#9A9A9A] text-sm">No dealers yet. Create the first one above.</td></tr>
            ) : dealers.map((dealer) => {
              const mods = dealer.moduleAccess ?? DEFAULT_MODULE_ACCESS
              const enabledCount = MODULE_ACCESS.filter((m) => mods[m.key] !== false).length
              return (
                <tr key={dealer.id} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#8B6914]/15 flex items-center justify-center text-xs font-bold text-[#8B6914]">
                        {(dealer.displayName ?? '?')[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-[#1A1A1A]">{dealer.displayName ?? '—'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#9A9A9A]">{dealer.email}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#8B6914]/10 text-[#8B6914]">
                      {dealer.marginPercent ?? 0}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#9A9A9A] text-xs">{enabledCount}/{MODULE_ACCESS.length} enabled</td>
                  <td className="py-3 px-4 text-xs text-[#9A9A9A]">{formatDate(dealer.createdAt)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setSelectedDealer(dealer)}
                        className="text-xs text-[#8B6914] hover:underline font-medium">
                        Edit
                      </button>
                      <button onClick={() => setDeleteTarget(dealer)}
                        className="text-xs text-[#D95F5F] hover:underline font-medium">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Admins section */}
      <div>
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-3">Admins</h2>
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#F4F4F5]">
                {['Name', 'Email', 'Joined'].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {admins.map((a) => (
                <tr key={a.id}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#4A90B8]/15 flex items-center justify-center text-xs font-bold text-[#4A90B8]">
                        {(a.displayName ?? '?')[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-[#1A1A1A]">{a.displayName ?? '—'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#9A9A9A]">{a.email}</td>
                  <td className="py-3 px-4 text-xs text-[#9A9A9A]">{formatDate(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showNewModal && (
        <NewDealerModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => setShowNewModal(false)}
        />
      )}
      {selectedDealer && (
        <DealerPanel
          dealer={selectedDealer}
          onClose={() => setSelectedDealer(null)}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">Delete Dealer?</h3>
            <p className="text-sm text-[#9A9A9A] mb-1">
              You are about to remove <span className="font-semibold text-[#1A1A1A]">{deleteTarget.displayName}</span> ({deleteTarget.email}).
            </p>
            <p className="text-sm text-[#9A9A9A] mb-5">
              This removes their portal access immediately. Their leads, quotes, and orders will remain in the system.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 border border-gray-200 text-[#1A1A1A] rounded-lg py-2.5 text-sm hover:bg-[#F4F4F5] transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-[#D95F5F] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#c44f4f] transition-colors disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete Dealer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
