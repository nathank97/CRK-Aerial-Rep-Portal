import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// Leads
import LeadList from './pages/leads/LeadList'
import LeadNew from './pages/leads/LeadNew'
import LeadDetail from './pages/leads/LeadDetail'

// Customers
import CustomerList from './pages/customers/CustomerList'
import CustomerNew from './pages/customers/CustomerNew'
import CustomerDetail from './pages/customers/CustomerDetail'

// Quotes
import QuoteList from './pages/quotes/QuoteList'
import QuoteNew from './pages/quotes/QuoteNew'
import QuoteDetail from './pages/quotes/QuoteDetail'

// Orders
import OrderList from './pages/orders/OrderList'
import OrderDetail from './pages/orders/OrderDetail'

// Invoices
import InvoiceList from './pages/invoices/InvoiceList'
import InvoiceNew from './pages/invoices/InvoiceNew'
import InvoiceDetail from './pages/invoices/InvoiceDetail'

// Inventory
import InventoryDealer from './pages/inventory/InventoryDealer'
import InventoryMaster from './pages/inventory/InventoryMaster'

// Service
import ServiceList from './pages/service/ServiceList'
import ServiceNew from './pages/service/ServiceNew'
import ServiceDetail from './pages/service/ServiceDetail'

// Other
import DocumentLibrary from './pages/documents/DocumentLibrary'
import MapPage from './pages/map/MapPage'
import ChatPage from './pages/chat/ChatPage'
import ProfilePage from './pages/profile/ProfilePage'
import CalendarPage from './pages/calendar/CalendarPage'

// Admin
import FeedbackPage from './pages/feedback/FeedbackPage'
import FeedbackAdmin from './pages/admin/FeedbackAdmin'
import DealerManagement from './pages/admin/DealerManagement'
import Catalog from './pages/admin/Catalog'
import TaxRates from './pages/admin/TaxRates'
import RepList from './pages/admin/reps/RepList'
import RepNew from './pages/admin/reps/RepNew'
import RepDetail from './pages/admin/reps/RepDetail'
import RepPipeline from './pages/admin/reps/RepPipeline'
import TerritoryList from './pages/admin/territories/TerritoryList'
import TerritoryMap from './pages/admin/territories/TerritoryMap'

// Route guards
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-[#111111]" />
  if (!user) return <Navigate to="/" replace />
  return children
}

function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-[#111111]" />
  if (!isAdmin) return <Navigate to="/dashboard" replace />
  return children
}

function RequireModule({ module, children }) {
  const { profile, isAdmin, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-[#111111]" />
  if (isAdmin) return children
  if (profile?.moduleAccess?.[module] === false) return <Navigate to="/dashboard" replace />
  return children
}

export const router = createBrowserRouter([
  { path: '/', element: <Login /> },
  {
    element: <RequireAuth><AppLayout /></RequireAuth>,
    children: [
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/leads', element: <LeadList /> },
      { path: '/leads/new', element: <LeadNew /> },
      { path: '/leads/:id', element: <LeadDetail /> },
      { path: '/customers', element: <CustomerList /> },
      { path: '/customers/new', element: <CustomerNew /> },
      { path: '/customers/:id', element: <CustomerDetail /> },
      {
        path: '/quotes',
        element: <RequireModule module="quotesOrders"><QuoteList /></RequireModule>,
      },
      {
        path: '/quotes/new',
        element: <RequireModule module="quotesOrders"><QuoteNew /></RequireModule>,
      },
      {
        path: '/quotes/:id',
        element: <RequireModule module="quotesOrders"><QuoteDetail /></RequireModule>,
      },
      {
        path: '/orders',
        element: <RequireModule module="quotesOrders"><OrderList /></RequireModule>,
      },
      {
        path: '/orders/:id',
        element: <RequireModule module="quotesOrders"><OrderDetail /></RequireModule>,
      },
      {
        path: '/invoices',
        element: <RequireModule module="quotesOrders"><InvoiceList /></RequireModule>,
      },
      {
        path: '/invoices/new',
        element: <RequireModule module="quotesOrders"><InvoiceNew /></RequireModule>,
      },
      {
        path: '/invoices/:id',
        element: <RequireModule module="quotesOrders"><InvoiceDetail /></RequireModule>,
      },
      {
        path: '/inventory',
        element: <RequireModule module="inventory"><InventoryDealer /></RequireModule>,
      },
      {
        path: '/inventory/master',
        element: <RequireAdmin><InventoryMaster /></RequireAdmin>,
      },
      {
        path: '/service',
        element: <RequireModule module="service"><ServiceList /></RequireModule>,
      },
      {
        path: '/service/new',
        element: <RequireModule module="service"><ServiceNew /></RequireModule>,
      },
      {
        path: '/service/:id',
        element: <RequireModule module="service"><ServiceDetail /></RequireModule>,
      },
      {
        path: '/documents',
        element: <RequireModule module="documents"><DocumentLibrary /></RequireModule>,
      },
      {
        path: '/map',
        element: <RequireModule module="map"><MapPage /></RequireModule>,
      },
      { path: '/chat', element: <ChatPage /> },
      { path: '/calendar', element: <CalendarPage /> },
      { path: '/feedback', element: <FeedbackPage /> },
      { path: '/profile', element: <ProfilePage /> },

      // Admin routes
      {
        path: '/admin/feedback',
        element: <RequireAdmin><FeedbackAdmin /></RequireAdmin>,
      },
      {
        path: '/admin/dealers',
        element: <RequireAdmin><DealerManagement /></RequireAdmin>,
      },
      {
        path: '/admin/catalog',
        element: <RequireAdmin><Catalog /></RequireAdmin>,
      },
      {
        path: '/admin/tax-rates',
        element: <RequireAdmin><TaxRates /></RequireAdmin>,
      },
      {
        path: '/admin/reps',
        element: <RequireAdmin><RepList /></RequireAdmin>,
      },
      {
        path: '/admin/reps/new',
        element: <RequireAdmin><RepNew /></RequireAdmin>,
      },
      {
        path: '/admin/reps/pipeline',
        element: <RequireAdmin><RepPipeline /></RequireAdmin>,
      },
      {
        path: '/admin/reps/:id',
        element: <RequireAdmin><RepDetail /></RequireAdmin>,
      },
      {
        path: '/admin/territories',
        element: <RequireAdmin><TerritoryList /></RequireAdmin>,
      },
      {
        path: '/admin/territories/map',
        element: <RequireAdmin><TerritoryMap /></RequireAdmin>,
      },
    ],
  },
])
