import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import { auth, db } from './config'

export const loginWithEmail = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)

export const logout = () => signOut(auth)

export const resetPassword = (email) => sendPasswordResetEmail(auth, email)

// Admin creates dealer accounts without logging out the current admin session.
// We use a secondary Firebase app instance so createUserWithEmailAndPassword
// doesn't affect the primary auth session.
export const createDealerAccount = async ({ email, tempPassword, displayName, marginPercent }) => {
  // Get the primary app's config to spin up a secondary instance
  const firebaseConfig = {
    apiKey: "AIzaSyBgh4DelRBgPigdyZaYSigUXoxzOVMbp94",
    authDomain: "crk-aerial-rep-portal.firebaseapp.com",
    projectId: "crk-aerial-rep-portal",
    storageBucket: "crk-aerial-rep-portal.firebasestorage.app",
    messagingSenderId: "148287925625",
    appId: "1:148287925625:web:f8f84e611e141694d013a8",
  }

  // Use a secondary app so the admin session stays intact
  const secondaryApp = initializeApp(firebaseConfig, `dealer-create-${Date.now()}`)
  const secondaryAuth = getAuth(secondaryApp)

  try {
    const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword)
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

    // Send password reset so dealer sets their own password via email
    await sendPasswordResetEmail(auth, email)

    return user
  } finally {
    // Clean up the secondary app
    await secondaryAuth.signOut()
  }
}
