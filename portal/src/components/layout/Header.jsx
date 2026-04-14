import { useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../../assets/logo.png'

export default function Header({ onMenuClick }) {
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

      {/* Chat icon */}
      <Link to="/chat" className="text-[#9A9A9A] hover:text-[#8B6914] transition-colors p-1">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </Link>
    </header>
  )
}
