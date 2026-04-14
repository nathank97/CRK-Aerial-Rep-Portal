import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginWithEmail } from '../firebase/auth'
import logo from '../assets/logo.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await loginWithEmail(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={logo} alt="CRK Aerial" className="h-28 w-auto" />
        </div>

        <div className="bg-[#1E1E1E] rounded-xl border border-[#3A3A3A] p-8">
          <h1 className="text-[#F0F0F0] text-xl font-bold mb-1 text-center">Rep Portal</h1>
          <p className="text-[#9A9A9A] text-sm text-center mb-6">Sign in to your account</p>

          {error && (
            <div className="bg-[#D95F5F]/10 border border-[#D95F5F] text-[#D95F5F] text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[#9A9A9A] text-xs font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#2E2E2E] border border-[#3A3A3A] rounded-lg px-3 py-2.5 text-[#F0F0F0] text-sm placeholder-[#9A9A9A] focus:outline-none focus:border-[#8B6914] transition-colors"
                placeholder="you@crkaerial.com"
              />
            </div>

            <div>
              <label className="block text-[#9A9A9A] text-xs font-medium mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#2E2E2E] border border-[#3A3A3A] rounded-lg px-3 py-2.5 text-[#F0F0F0] text-sm placeholder-[#9A9A9A] focus:outline-none focus:border-[#8B6914] transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#8B6914] hover:bg-[#7a5c11] disabled:opacity-60 text-white font-semibold text-sm rounded-lg py-2.5 mt-2 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-[#9A9A9A] text-xs text-center mt-6">
          CRK Aerial · 32686 460th Ave. Hancock, MN 56244
        </p>
      </div>
    </div>
  )
}
