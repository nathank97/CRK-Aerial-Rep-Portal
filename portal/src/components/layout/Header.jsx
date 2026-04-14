import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { globalChatCol } from '../../firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import logo from '../../assets/logo.png'

export default function Header({ onMenuClick }) {
  const { user } = useAuth()
  const location = useLocation()
  const [unread, setUnread] = useState(0)
  const lastSeenRef = useRef(localStorage.getItem(`chatSeen_${user?.uid}`) ? new Date(localStorage.getItem(`chatSeen_${user?.uid}`)) : null)

  // Track unread chat messages
  useEffect(() => {
    if (!user) return
    const q = query(globalChatCol, orderBy('timestamp', 'desc'), limit(50))
    const unsub = onSnapshot(q, (snap) => {
      const lastSeen = lastSeenRef.current
      if (!lastSeen) {
        setUnread(0)
        return
      }
      const count = snap.docs.filter((d) => {
        const ts = d.data().timestamp?.toDate?.()
        return ts && ts > lastSeen && d.data().uid !== user.uid
      }).length
      setUnread(count)
    })
    return unsub
  }, [user?.uid])

  // Mark as seen when on chat page
  useEffect(() => {
    if (location.pathname === '/chat') {
      const now = new Date().toISOString()
      localStorage.setItem(`chatSeen_${user?.uid}`, now)
      lastSeenRef.current = new Date(now)
      setUnread(0)
    }
  }, [location.pathname, user?.uid])

  return (
    <header className="h-14 bg-[#111111] border-b border-[#3A3A3A] flex items-center justify-between px-4 shrink-0 lg:hidden">
      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        className="text-[#F0F0F0] p-1 rounded hover:bg-[#1E1E1E] transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Logo centered on mobile */}
      <img src={logo} alt="CRK Aerial" className="h-8 w-auto" />

      {/* Chat icon with badge */}
      <Link to="/chat" className="relative text-[#9A9A9A] hover:text-[#8B6914] transition-colors p-1">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[#D95F5F] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>
    </header>
  )
}
