import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, CreditCard, LogOut, Package, QrCode, User } from 'lucide-react'
import { authApi } from '../../features/auth/api/authApi'
import { clearSession } from '../../features/auth/session'
import { useSession } from '../../features/auth/useSession'
import QrCodeDialog from './QrCodeDialog'

function fallbackInitials(name) {
  const normalized = (name || '').trim()
  if (!normalized) return 'U'
  const parts = normalized.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] || 'U'
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ''
  return (first + last).toUpperCase()
}

function normalizeAvatarUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  const base = import.meta.env.VITE_BACKEND_PUBLIC_URL || 'http://localhost:8080'
  return base.replace(/\/+$/, '') + url
}

function AccountMenu({ className = '' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated } = useSession()
  const [open, setOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  const avatarUrl = useMemo(() => normalizeAvatarUrl(user?.avatarUrl), [user?.avatarUrl])
  const initials = useMemo(() => fallbackInitials(user?.fullName), [user?.fullName])
  const isCustomer = useMemo(() => (user?.role || '').toUpperCase() === 'CUSTOMER', [user?.role])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      const target = event.target
      if (!target) return
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  async function handleLogout() {
    try {
      await authApi.logout()
    } catch {
      // Best effort. Session is client-side too.
    } finally {
      clearSession()
      setOpen(false)
      navigate('/', { replace: true })
    }
  }

  function jumpToTop() {
    window.scrollTo(0, 0)
  }

  function smoothScrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleMenuNavigation(targetPath) {
    setOpen(false)
    if (location.pathname === targetPath) {
      smoothScrollToTop()
      return
    }
    jumpToTop()
    navigate(targetPath)
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 text-sm font-medium text-slate-100 shadow-ambient-sm backdrop-blur-md transition hover:border-white/15 hover:bg-white/10"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-8 w-8 rounded-full border border-white/10 object-cover"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.src = ''
            }}
          />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gym-500 text-xs font-bold text-slate-950 shadow-glow">
            {initials}
          </span>
        )}
        <span className="max-w-[160px] truncate">{user?.fullName || user?.email}</span>
      </button>

      {open ? (
        <div
          ref={menuRef}
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-3xl border border-white/10 bg-[rgba(18,18,26,0.92)] shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-50">{user?.fullName || 'Account'}</p>
            <p className="truncate text-xs text-zinc-500">{user?.email}</p>
          </div>
          <div className="p-2">
            <button
              type="button"
              onClick={() => handleMenuNavigation('/profile')}
              className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5 hover:text-slate-50"
            >
              <User size={16} />
              View profile
            </button>
            <button
              type="button"
              onClick={() => handleMenuNavigation('/notifications')}
              className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5 hover:text-slate-50"
            >
              <Bell size={16} />
              Notifications
            </button>
            {isCustomer ? (
              <>
                <button
                  type="button"
                  onClick={() => handleMenuNavigation('/customer/current-membership')}
                  className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5 hover:text-slate-50"
                >
                  <CreditCard size={16} />
                  Current membership
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuNavigation('/customer/orders')}
                  className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5 hover:text-slate-50"
                >
                  <Package size={16} />
                  Order history
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setQrOpen(true)
                  }}
                  className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5 hover:text-slate-50"
                >
                  <QrCode size={16} />
                  QR code
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-white/5"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      ) : null}

      {isCustomer ? (
        <QrCodeDialog
          open={qrOpen}
          onClose={() => {
            setQrOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

export default AccountMenu




