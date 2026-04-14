import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

// Fetch the tax rate for a given US state abbreviation from the admin-managed table
export const getTaxRate = async (stateAbbr) => {
  if (!stateAbbr) return 0
  const snap = await getDoc(doc(db, 'taxRates', stateAbbr.toUpperCase()))
  if (snap.exists()) return snap.data().rate ?? 0
  return 0
}
