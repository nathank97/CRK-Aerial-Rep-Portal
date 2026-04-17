import { useState, useRef } from 'react'
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { updateDoc, doc } from 'firebase/firestore'
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { useAuth } from '../../context/AuthContext'
import { auth, db, storage } from '../../firebase/config'
import { formatDate } from '../../utils/formatters'

export default function ProfilePage() {
  const { user, profile, isAdmin, isDealer } = useAuth()

  // Chat notification preference
  const [chatNotifPref, setChatNotifPref] = useState(profile?.chatNotificationPref ?? 'mentions')
  const [savingNotif, setSavingNotif] = useState(false)
  const [notifSaved, setNotifSaved] = useState(false)

  // Display name
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState('')

  // Business logo
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoProgress, setLogoProgress] = useState(0)
  const [logoError, setLogoError] = useState('')
  const [logoSaved, setLogoSaved] = useState(false)
  const logoFileRef = useRef(null)

  // Password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#8B6914]'
  const labelCls = 'block text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-1'

  async function saveName() {
    if (!displayName.trim()) { setNameError('Name cannot be empty.'); return }
    setSavingName(true)
    setNameError('')
    try {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() })
      await updateDoc(doc(db, 'users', user.uid), { displayName: displayName.trim() })
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 3000)
    } catch (e) {
      setNameError(e.message ?? 'Failed to update name.')
    } finally {
      setSavingName(false)
    }
  }

  async function savePassword() {
    setPasswordError('')
    if (!currentPassword) { setPasswordError('Current password is required.'); return }
    if (newPassword.length < 6) { setPasswordError('New password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match.'); return }
    setSavingPassword(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSaved(true)
      setTimeout(() => setPasswordSaved(false), 3000)
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setPasswordError('Current password is incorrect.')
      } else {
        setPasswordError(e.message ?? 'Failed to change password.')
      }
    } finally {
      setSavingPassword(false)
    }
  }

  async function uploadLogo(file) {
    if (!file) return
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
    if (!allowed.includes(file.type)) {
      setLogoError('Please upload a PNG, JPG, SVG, or WebP image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo must be under 2 MB.')
      return
    }
    setLogoError('')
    setLogoUploading(true)
    setLogoProgress(0)
    try {
      const path = `logos/${user.uid}/logo`
      const sRef = storageRef(storage, path)
      const task = uploadBytesResumable(sRef, file)
      await new Promise((resolve, reject) => {
        task.on('state_changed',
          (snap) => setLogoProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          resolve,
        )
      })
      const url = await getDownloadURL(sRef)
      await updateDoc(doc(db, 'users', user.uid), { logoUrl: url })
      setLogoSaved(true)
      setTimeout(() => setLogoSaved(false), 3000)
    } catch (e) {
      console.error(e)
      setLogoError('Upload failed. Please try again.')
    } finally {
      setLogoUploading(false)
      setLogoProgress(0)
      if (logoFileRef.current) logoFileRef.current.value = ''
    }
  }

  async function removeLogo() {
    if (!window.confirm('Remove your business logo?')) return
    try {
      const sRef = storageRef(storage, `logos/${user.uid}/logo`)
      await deleteObject(sRef).catch(() => {}) // ignore if file doesn't exist
      await updateDoc(doc(db, 'users', user.uid), { logoUrl: null })
    } catch (e) {
      console.error(e)
    }
  }

  async function saveNotifPref() {
    setSavingNotif(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { chatNotificationPref: chatNotifPref })
      setNotifSaved(true)
      setTimeout(() => setNotifSaved(false), 3000)
    } finally { setSavingNotif(false) }
  }

  const roleLabel = isAdmin ? 'Admin' : isDealer ? 'Dealer' : 'User'
  const roleColor = isAdmin ? 'bg-[#4A90B8]/10 text-[#4A90B8]' : 'bg-[#8B6914]/10 text-[#8B6914]'

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">My Profile</h1>
        <p className="text-sm text-[#9A9A9A] mt-0.5">Manage your account settings</p>
      </div>

      {/* Account Overview */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 mb-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-[#8B6914]/15 flex items-center justify-center text-2xl font-bold text-[#8B6914]">
            {(profile?.displayName ?? user?.email ?? '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-[#1A1A1A] text-lg">{profile?.displayName ?? '—'}</p>
            <p className="text-sm text-[#9A9A9A]">{user?.email}</p>
            <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${roleColor}`}>
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-gray-50">
          <div>
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-0.5">Member Since</p>
            <p className="text-sm text-[#1A1A1A]">{formatDate(profile?.createdAt)}</p>
          </div>
          {isDealer && profile?.marginPercent != null && (
            <div>
              <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-0.5">Your Margin</p>
              <p className="text-sm text-[#1A1A1A]">
                Dealer prices are MSRP minus your assigned margin.
              </p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-[#9A9A9A] uppercase tracking-wider mb-0.5">User ID</p>
            <p className="text-xs font-mono text-[#9A9A9A] truncate">{user?.uid}</p>
          </div>
        </div>
      </div>

      {/* Update Display Name */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 mb-5">
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Display Name</h2>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Name</label>
            <input value={displayName} onChange={(e) => { setDisplayName(e.target.value); setNameError(''); setNameSaved(false) }}
              className={inputCls} placeholder="Your name" />
          </div>
          {nameError && <p className="text-sm text-[#D95F5F]">{nameError}</p>}
          {nameSaved && <p className="text-sm text-[#4CAF7D]">Name updated successfully.</p>}
          <button onClick={saveName} disabled={savingName}
            className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {savingName ? 'Saving…' : 'Save Name'}
          </button>
        </div>
      </div>

      {/* Business Logo */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 mb-5">
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-1">Business Logo</h2>
        <p className="text-xs text-[#9A9A9A] mb-4">
          Used on quotes and invoices when you select "My Business" branding. PNG, JPG, SVG or WebP — max 2 MB.
        </p>
        <div className="flex items-start gap-5">
          {/* Preview */}
          <div className="w-28 h-16 rounded-lg border border-gray-200 bg-[#F4F4F5] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {profile?.logoUrl
              ? <img src={profile.logoUrl} alt="Your logo" className="w-full h-full object-contain p-1" />
              : <span className="text-xs text-[#9A9A9A] text-center leading-tight px-2">No logo uploaded</span>
            }
          </div>
          {/* Controls */}
          <div className="flex-1 space-y-3">
            <input
              ref={logoFileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              onChange={(e) => uploadLogo(e.target.files?.[0])}
              className="hidden"
            />
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => logoFileRef.current?.click()}
                disabled={logoUploading}
                className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50"
              >
                {logoUploading ? `Uploading… ${logoProgress}%` : profile?.logoUrl ? 'Replace Logo' : 'Upload Logo'}
              </button>
              {profile?.logoUrl && (
                <button
                  onClick={removeLogo}
                  className="border border-[#D95F5F]/40 text-[#D95F5F] px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#D95F5F]/5 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            {logoUploading && (
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-48">
                <div className="h-full bg-[#8B6914] rounded-full transition-all" style={{ width: `${logoProgress}%` }} />
              </div>
            )}
            {logoError && <p className="text-sm text-[#D95F5F]">{logoError}</p>}
            {logoSaved && <p className="text-sm text-[#4CAF7D]">Logo saved successfully.</p>}
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 mb-5">
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Change Password</h2>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Current Password</label>
            <input type="password" value={currentPassword} onChange={(e) => { setCurrentPassword(e.target.value); setPasswordError('') }}
              className={inputCls} placeholder="Enter current password" />
          </div>
          <div>
            <label className={labelCls}>New Password</label>
            <input type="password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
              className={inputCls} placeholder="Min. 6 characters" />
          </div>
          <div>
            <label className={labelCls}>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError('') }}
              className={inputCls} placeholder="Repeat new password" />
          </div>
          {passwordError && <p className="text-sm text-[#D95F5F]">{passwordError}</p>}
          {passwordSaved && <p className="text-sm text-[#4CAF7D]">Password changed successfully.</p>}
          <button onClick={savePassword} disabled={savingPassword}
            className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
            {savingPassword ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </div>

      {/* Chat Notification Preferences */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 mb-5">
        <h2 className="text-base font-semibold text-[#1A1A1A] mb-1">Chat Notifications</h2>
        <p className="text-xs text-[#9A9A9A] mb-4">How often would you like email notifications for global chat messages?</p>
        <div className="space-y-2 mb-4">
          {[
            { value: 'every', label: 'Every message', desc: 'Email on each new message' },
            { value: 'daily', label: 'Daily digest', desc: 'One summary email per day' },
            { value: 'weekly', label: 'Weekly digest', desc: 'One summary email per week' },
            { value: 'mentions', label: 'Mentions only', desc: 'Only when @mentioned (default)' },
            { value: 'off', label: 'Off', desc: 'No email notifications' },
          ].map(({ value, label, desc }) => (
            <label key={value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              chatNotifPref === value ? 'border-[#8B6914] bg-[#8B6914]/5' : 'border-gray-100 hover:border-gray-200'
            }`}>
              <input type="radio" name="chatNotifPref" value={value} checked={chatNotifPref === value}
                onChange={() => { setChatNotifPref(value); setNotifSaved(false) }}
                className="accent-[#8B6914]" />
              <div>
                <p className="text-sm font-medium text-[#1A1A1A]">{label}</p>
                <p className="text-xs text-[#9A9A9A]">{desc}</p>
              </div>
            </label>
          ))}
        </div>
        {notifSaved && <p className="text-sm text-[#4CAF7D] mb-2">Preferences saved.</p>}
        <button onClick={saveNotifPref} disabled={savingNotif}
          className="bg-[#8B6914] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#7a5c12] transition-colors disabled:opacity-50">
          {savingNotif ? 'Saving…' : 'Save Preference'}
        </button>
      </div>

      {/* Module Access (dealer only) */}
      {isDealer && profile?.moduleAccess && (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-[#1A1A1A] mb-4">Your Module Access</h2>
          <p className="text-xs text-[#9A9A9A] mb-3">Contact your admin to change module permissions.</p>
          <div className="space-y-2">
            {[
              { key: 'quotesOrders', label: 'Quotes & Orders' },
              { key: 'inventory', label: 'Inventory' },
              { key: 'service', label: 'Service & Repair' },
              { key: 'documents', label: 'Documents' },
              { key: 'map', label: 'Customer Map' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-[#1A1A1A]">{label}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  profile.moduleAccess[key] !== false
                    ? 'bg-[#4CAF7D]/10 text-[#4CAF7D]'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {profile.moduleAccess[key] !== false ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
