import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { logout } from '../../firebase/auth'
import logo from '../../assets/logo.png'

const navItem = ({ to, label, icon }) => ({ to, label, icon })

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
  { to: '/admin/dealers', label: 'Dealers', icon: '🏢' },
  { to: '/admin/catalog', label: 'Catalog', icon: '📂' },
  { to: '/admin/tax-rates', label: 'Tax Rates', icon: '💲' },
  { to: '/admin/reps', label: 'Rep Manager', icon: '🎯' },
  { to: '/admin/territories', label: 'Territories', icon: '🗾' },
  { to: '/admin/feedback', label: 'Feedback Inbox', icon: '📥' },
]

export default function Sidebar({ onClose }) {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const dealerNav = ADMIN_NAV.filter((item) => {
    const access = profile?.moduleAccess
    if (!access) return true
    if (item.to === '/quotes' || item.to === '/orders') return access.quotesOrders !== false
    if (item.to === '/inventory') return access.inventory !== false
    if (item.to === '/service') return access.service !== false
    if (item.to === '/documents') return access.documents !== false
    if (item.to === '/map') return access.map !== false
    if (item.to === '/feedback') return true // always visible
    return true
  })

  const navItems = isAdmin ? ADMIN_NAV : dealerNav

  return (
    <aside className="flex flex-col h-full bg-[#111111] w-64 shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#3A3A3A]">
        <img src={logo} alt="CRK Aerial" className="h-14 w-auto" />
        <p className="text-[#9A9A9A] text-xs mt-2">Rep Portal</p>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
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
        ))}

        {/* Admin-only section */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-[#3A3A3A] text-[10px] uppercase tracking-widest font-semibold">Admin</p>
            </div>
            {ADMIN_ONLY_NAV.map(({ to, label, icon }) => (
              <NavLink
                key={to}
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
            ))}
          </>
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
            <p className="text-[#9A9A9A] text-xs truncate">{profile?.role === 'admin' ? 'Admin' : 'Dealer'}</p>
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
  )
}
