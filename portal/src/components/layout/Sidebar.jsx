import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAllUsers } from '../../hooks/useUsers'
import { logout } from '../../firebase/auth'
import logo from '../../assets/logo.png'

const ADMIN_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { to: '/leads', label: 'Leads', icon: '◎' },
  { to: '/customers', label: 'Customers', icon: '👤' },
  { to: '/quotes', label: 'Quotes', icon: '📋' },
  { to: '/orders', label: 'Orders', icon: '📦' },
  { to: '/invoices', label: 'Invoices', icon: '🧾' },
  { to: '/inventory', label: 'Inventory', icon: '🏭' },
  { to: '/service', label: 'Service', icon: '🔧' },
  { to: '/documents', label: 'Documents', icon: '📁' },
  { to: '/map', label: 'Map', icon: '🗺️' },
  { to: '/calendar', label: 'Calendar', icon: '📅' },
  { to: '/feedback', label: 'Feedback', icon: '💬' },
]

const ADMIN_ONLY_NAV = [
  { to: '/admin/dealers', label: 'Territory Reps', icon: '🏢' },
  { to: '/admin/rep-management', label: 'Rep Management', icon: '👥' },
  { to: '/admin/catalog', label: 'Catalog', icon: '📂' },
  { to: '/admin/preset-quotes', label: 'Preset Quotes', icon: '📑' },
  { to: '/admin/tax-rates', label: 'Tax Rates', icon: '💲' },
  { to: '/admin/territories', label: 'Territories', icon: '🗾' },
  { to: '/admin/feedback', label: 'Feedback Inbox', icon: '📥' },
  { to: '/admin/email-templates', label: 'Email Templates', icon: '✉️' },
]

const WAREHOUSE_NAV = [
  { to: '/warehouse', label: 'Dashboard', icon: '▦' },
  { to: '/orders', label: 'Orders', icon: '📦' },
  { to: '/inventory', label: 'Inventory', icon: '🏭' },
  { to: '/admin/catalog', label: 'Catalog', icon: '📂' },
]

function NavItem({ to, label, icon, onClose }) {
  return (
    <NavLink
      to={to}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-[#8B6914]/20 text-[#8B6914] font-semibold'
            : 'text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[#1E1E1E]'
        }`
      }
    >
      <span className="text-base w-5 text-center">{icon}</span>
      {label}
    </NavLink>
  )
}

function ViewSwitcherModal({ onClose }) {
  const { realProfile, startImpersonating, impersonating, stopImpersonating } = useAuth()
  const { users } = useAllUsers()
  const navigate = useNavigate()

  const dealers = users.filter((u) => u.role === 'dealer')
  const warehouseManagers = users.filter((u) => u.role === 'warehouse_manager')

  function handleSelect(targetUser) {
    startImpersonating(targetUser)
    navigate(targetUser.role === 'warehouse_manager' ? '/warehouse' : '/dashboard')
    onClose()
  }

  function handleExitImpersonation() {
    stopImpersonating()
    navigate('/dashboard')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#1A1A1A] rounded-xl shadow-2xl w-full max-w-sm border border-[#3A3A3A] max-h-[80vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#3A3A3A] flex items-center justify-between shrink-0">
          <h2 className="text-base font-semibold text-[#F0F0F0]">Switch View</h2>
          <button onClick={onClose} className="text-[#9A9A9A] hover:text-[#F0F0F0] text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
          {/* Admin view */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#3A3A3A] font-semibold px-1 mb-1">Admin</p>
            <button
              onClick={handleExitImpersonation}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                !impersonating
                  ? 'bg-[#8B6914]/20 text-[#8B6914] font-semibold'
                  : 'text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[#2A2A2A]'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-[#8B6914] flex items-center justify-center text-white text-xs font-bold shrink-0">
                {realProfile?.displayName?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{realProfile?.displayName ?? 'Admin'}</p>
                <p className="text-xs text-[#9A9A9A]">Admin</p>
              </div>
              {!impersonating && <span className="ml-auto text-xs text-[#8B6914]">Active</span>}
            </button>
          </div>

          {warehouseManagers.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#3A3A3A] font-semibold px-1 mb-1">Warehouse Managers</p>
              {warehouseManagers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelect(u)}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    impersonating && u.id === users.find((x) => x.id === u.id)?.id
                      ? 'bg-[#8B6914]/20 text-[#8B6914] font-semibold'
                      : 'text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[#2A2A2A]'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-[#2A4A6A] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {u.displayName?.[0]?.toUpperCase() ?? 'W'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.displayName}</p>
                    <p className="text-xs text-[#9A9A9A]">Warehouse Manager</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {dealers.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#3A3A3A] font-semibold px-1 mb-1">Territory Reps</p>
              {dealers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleSelect(u)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[#2A2A2A] transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-[#3A3A3A] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {u.displayName?.[0]?.toUpperCase() ?? 'R'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.displayName}</p>
                    <p className="text-xs text-[#9A9A9A]">Territory Rep</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#3A3A3A] shrink-0">
          <button onClick={onClose} className="w-full text-sm text-[#9A9A9A] hover:text-[#F0F0F0] transition-colors py-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ onClose }) {
  const { profile, realProfile, isAdmin, isWarehouseManager, isRealAdmin, impersonating, stopImpersonating } = useAuth()
  const navigate = useNavigate()
  const [showSwitcher, setShowSwitcher] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const handleExitImpersonation = () => {
    stopImpersonating()
    navigate('/dashboard')
    onClose?.()
  }

  // Build nav list based on active role
  let navItems = []
  let adminSection = false

  if (isWarehouseManager) {
    navItems = WAREHOUSE_NAV
  } else if (isAdmin) {
    navItems = ADMIN_NAV
    adminSection = true
  } else {
    navItems = ADMIN_NAV.filter((item) => {
      const access = profile?.moduleAccess
      if (!access) return true
      if (item.to === '/quotes' || item.to === '/orders') return access.quotesOrders !== false
      if (item.to === '/inventory') return access.inventory !== false
      if (item.to === '/service') return access.service !== false
      if (item.to === '/documents') return access.documents !== false
      if (item.to === '/map') return access.map !== false
      if (item.to === '/feedback') return true
      return true
    })
  }

  const roleLabel =
    profile?.role === 'admin' ? 'Admin' :
    profile?.role === 'warehouse_manager' ? 'Warehouse Manager' :
    'Territory Rep'

  return (
    <>
      {showSwitcher && <ViewSwitcherModal onClose={() => setShowSwitcher(false)} />}

      <aside className="flex flex-col h-full bg-[#111111] w-64 shrink-0">
        {/* Impersonation banner */}
        {isRealAdmin && impersonating && (
          <div className="bg-[#8B6914]/20 border-b border-[#8B6914]/30 px-4 py-2 flex items-center justify-between gap-2">
            <p className="text-[#8B6914] text-xs font-semibold truncate">
              Viewing as: {profile?.displayName}
            </p>
            <button
              onClick={handleExitImpersonation}
              className="text-[#8B6914] text-xs font-semibold shrink-0 hover:text-[#F0C040] transition-colors"
            >
              Exit
            </button>
          </div>
        )}

        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#3A3A3A]">
          <img src={logo} alt="CRK Aerial" className="h-14 w-auto" />
          <p className="text-[#9A9A9A] text-xs mt-2">Rep Portal</p>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
          {navItems.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} onClose={onClose} />
          ))}

          {/* Admin-only section */}
          {adminSection && (
            <>
              <div className="pt-4 pb-1 px-3">
                <p className="text-[#3A3A3A] text-[10px] uppercase tracking-widest font-semibold">Admin</p>
              </div>
              {ADMIN_ONLY_NAV.map(({ to, label, icon }) => (
                <NavItem key={to} to={to} label={label} icon={icon} onClose={onClose} />
              ))}
            </>
          )}

          {/* View As — only real admins see this */}
          {isRealAdmin && (
            <div className="pt-4">
              <div className="pb-1 px-3">
                <p className="text-[#3A3A3A] text-[10px] uppercase tracking-widest font-semibold">View As</p>
              </div>
              <button
                onClick={() => setShowSwitcher(true)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#9A9A9A] hover:text-[#F0F0F0] hover:bg-[#1E1E1E] transition-colors"
              >
                <span className="text-base w-5 text-center">👁</span>
                Switch View
              </button>
            </div>
          )}
        </nav>

        {/* User + logout */}
        <div className="px-4 py-4 border-t border-[#3A3A3A]">
          <NavLink
            to="/profile"
            onClick={onClose}
            className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-full bg-[#8B6914] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {profile?.displayName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-[#F0F0F0] text-sm font-medium truncate">{profile?.displayName ?? 'User'}</p>
              <p className="text-[#9A9A9A] text-xs truncate">{roleLabel}</p>
            </div>
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full text-left text-[#9A9A9A] hover:text-[#D95F5F] text-sm transition-colors px-1"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}
