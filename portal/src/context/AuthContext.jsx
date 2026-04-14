import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // Firebase Auth user
  const [profile, setProfile] = useState(null) // Firestore user doc
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubProfile = () => {}

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        // Subscribe to their Firestore profile for real-time permission updates
        unsubProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
          if (snap.exists()) {
            setProfile({ id: snap.id, ...snap.data() })
          }
          setLoading(false)
        })
      } else {
        setUser(null)
        setProfile(null)
        unsubProfile()
        setLoading(false)
      }
    })

    return () => {
      unsubAuth()
      unsubProfile()
    }
  }, [])

  const isAdmin = profile?.role === 'admin'
  const isDealer = profile?.role === 'dealer'

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isDealer }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
