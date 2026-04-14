import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config'

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)

export const logout = () => signOut(auth)

export const resetPassword = (email) => sendPasswordResetEmail(auth, email)

// Admin creates dealer accounts via Firebase Auth REST API so the admin
// session is never interrupted (avoids createUserWithEmailAndPassword
// which signs in as the new user on the primary auth instance).
export const createDealerAccount = async ({ email, tempPassword, displayName, marginPercent, pricingTier }) => {
  const API_KEY = 'AIzaSyBgh4DelRBgPigdyZaYSigUXoxzOVMbp94'

  // Create the user via REST — does not affect current auth session
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: tempPassword, returnSecureToken: true }),
    }
  )
  const data = await res.json()
  if (!res.ok) {
    const msg = data?.error?.message ?? 'Failed to create account.'
    throw new Error(
      msg === 'EMAIL_EXISTS' ? 'An account with that email already exists.' : msg
    )
  }

  const uid = data.localId

  // Write dealer profile to Firestore (using admin's authenticated db connection)
  await setDoc(doc(db, 'users', uid), {
    uid,
    email,
    displayName,
    role: 'dealer',
    marginPercent: marginPercent ?? 0,
    pricingTier: pricingTier ?? 'margin',
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

  // Send password-reset email so dealer can set their own password.
  // After setting their password, Firebase redirects them to the portal login.
  await sendPasswordResetEmail(auth, email, {
    url: 'https://portal-umber-phi.vercel.app/',
  })

  return { uid, email, displayName }
}
