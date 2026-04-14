import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config'

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)

export const logout = () => signOut(auth)

export const resetPassword = (email) => sendPasswordResetEmail(auth, email)

// Admin creates dealer accounts — creates Firebase Auth user + Firestore profile
export const createDealerAccount = async ({ email, tempPassword, displayName, marginPercent }) => {
  // Create the auth user
  const { user } = await createUserWithEmailAndPassword(auth, email, tempPassword)
  await updateProfile(user, { displayName })

  // Write dealer profile to Firestore
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email,
    displayName,
    role: 'dealer',
    marginPercent: marginPercent ?? 0,
    dashboardVisibility: {
      kpiLeads: true,
      kpiCustomers: true,
      kpiQuotes: true,
      kpiOrders: true,
      kpiServiceTickets: true,
      kpiInventory: true,
      kpiPipelineValue: true,
      kpiRevenueClosed: true,
      chartLeadsByStatus: true,
      chartLeadsByDealer: true,
      chartWonVsLost: true,
      chartLeadsOverTime: true,
      chartRevenueOverTime: true,
      chartTopModels: true,
      chartInventoryLevels: true,
      chartServiceTickets: true,
      leaderboard: true,
    },
    moduleAccess: {
      quotesOrders: true,
      inventory: true,
      service: true,
      documents: true,
      map: true,
    },
    createdAt: serverTimestamp(),
  })

  // Send password reset so dealer sets their own password
  await sendPasswordResetEmail(auth, email)

  return user
}
