import { collection, doc } from 'firebase/firestore'
import { db } from './config'

// Collection references
export const usersCol = collection(db, 'users')
export const leadsCol = collection(db, 'leads')
export const customersCol = collection(db, 'customers')
export const quotesCol = collection(db, 'quotes')
export const ordersCol = collection(db, 'orders')
export const invoicesCol = collection(db, 'invoices')
export const inventoryCol = collection(db, 'inventory')
export const serviceTicketsCol = collection(db, 'serviceTickets')
export const documentsCol = collection(db, 'documents')
export const catalogCol = collection(db, 'catalog')
export const taxRatesCol = collection(db, 'taxRates')
export const repsCol = collection(db, 'reps')
export const territoriesCol = collection(db, 'territories')
export const globalChatCol = collection(db, 'globalChat')
export const feedbackCol = collection(db, 'feedback')

// Subcollection helpers
export const leadActivityCol = (leadId) =>
  collection(db, 'leads', leadId, 'activity')
export const leadChatCol = (leadId) =>
  collection(db, 'leads', leadId, 'chat')

// Doc refs
export const userDoc = (uid) => doc(db, 'users', uid)
export const leadDoc = (id) => doc(db, 'leads', id)
export const customerDoc = (id) => doc(db, 'customers', id)
export const quoteDoc = (id) => doc(db, 'quotes', id)
export const orderDoc = (id) => doc(db, 'orders', id)
export const invoiceDoc = (id) => doc(db, 'invoices', id)
