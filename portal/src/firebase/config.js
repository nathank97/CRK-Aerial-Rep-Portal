import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyBgh4DelRBgPigdyZaYSigUXoxzOVMbp94",
  authDomain: "crk-aerial-rep-portal.firebaseapp.com",
  projectId: "crk-aerial-rep-portal",
  storageBucket: "crk-aerial-rep-portal.firebasestorage.app",
  messagingSenderId: "148287925625",
  appId: "1:148287925625:web:f8f84e611e141694d013a8",
  measurementId: "G-PNNDNG6972"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
