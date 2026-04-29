import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const IMPERSONATE_KEY = 'crk_impersonate_v1'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [realProfile, setRealProfile] = useState(null)
  const [impersonatedProfile, setImpersonatedProfile] = useState(null)
  const [impersonating, setImpersonating] = useState(() => {
    try { return JSON.parse(localStorage.getItem(IMPERSONATE_KEY)) ?? null } catch { return null }
  })
  const [loading, setLoading] = useState(true)
  const impersonateUnsubRef = useRef(() => {})

  // Subscribe to real user profile
  useEffect(() => {
    let unsubProfile = () => {}

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        unsubProfile = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              setRealProfile({ id: snap.id, ...snap.data() })
            } else {
              setRealProfile(null)
              signOut(auth)
            }
            setLoading(false)
          },
          () => { setLoading(false) }
        )
        setTimeout(() => setLoading(false), 5000)
      } else {
        setUser(null)
        setRealProfile(null)
        setImpersonating(null)
        setImpersonatedProfile(null)
        localStorage.removeItem(IMPERSONATE_KEY)
        unsubProfile()
        setLoading(false)
      }
    })

    return () => { unsubAuth(); unsubProfile() }
  }, [])

  // Subscribe to impersonated user profile in real-time
  useEffect(() => {
    impersonateUnsubRef.current()
    impersonateUnsubRef.current = () => {}

    if (!impersonating?.uid) {
      setImpersonatedProfile(null)
      return
    }

    const unsub = onSnapshot(
      doc(db, 'users', impersonating.uid),
      (snap) => {
        if (snap.exists()) {
          setImpersonatedProfile({ id: snap.id, ...snap.data() })
        } else {
          // Target user deleted — exit impersonation
          setImpersonating(null)
          setImpersonatedProfile(null)
          localStorage.removeItem(IMPERSONATE_KEY)
        }
      },
      () => {
        setImpersonating(null)
        setImpersonatedProfile(null)
        localStorage.removeItem(IMPERSONATE_KEY)
      }
    )

    impersonateUnsubRef.current = unsub
    return () => unsub()
  }, [impersonating?.uid])

  function startImpersonating(targetUser) {
    const val = { uid: targetUser.id ?? targetUser.uid }
    localStorage.setItem(IMPERSONATE_KEY, JSON.stringify(val))
    setImpersonating(val)
  }

  function stopImpersonating() {
    localStorage.removeItem(IMPERSONATE_KEY)
    setImpersonating(null)
    setImpersonatedProfile(null)
  }

  const isRealAdmin = realProfile?.role === 'admin'
  const activeProfile = (isRealAdmin && impersonating && impersonatedProfile)
    ? impersonatedProfile
    : realProfile

  const isAdmin = activeProfile?.role === 'admin'
  const isDealer = activeProfile?.role === 'dealer'
  const isWarehouseManager = activeProfile?.role === 'warehouse_manager'

  return (
    <AuthContext.Provider value={{
      user,
      profile: activeProfile,
      realProfile,
      loading,
      isAdmin,
      isDealer,
      isWarehouseManager,
      isRealAdmin,
      impersonating: isRealAdmin && !!impersonating && !!impersonatedProfile,
      startImpersonating,
      stopImpersonating,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
