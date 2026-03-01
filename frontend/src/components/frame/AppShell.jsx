import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ArrowUpRight, Clock3, Dumbbell, MapPin, Phone, ShoppingCart } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import AuthHeaderActions from '../common/AuthHeaderActions'
import NotificationDropdown from '../common/NotificationDropdown'
import { useSession } from '../../features/auth/useSession'
import { adminNav, coachNav, customerNav, receptionNav } from '../../config/navigation'
import { roleLandingPath } from '../../features/auth/session'
import { gymPublicInfo } from '../../config/publicInfo'
import { cartApi } from '../../features/product/api/cartApi'

function getWorkspaceLinks(pathname) {
  if (pathname.startsWith('/customer/')) return customerNav
  if (pathname.startsWith('/coach/')) return coachNav
  if (pathname.startsWith('/reception/')) return receptionNav
  if (pathname.startsWith('/admin/')) return adminNav
  return []
}

function roleHomeCta(role) {
  switch (role) {
    case 'CUSTOMER':
      return 'Customer'
    case 'COACH':
      return 'Coach'
    case 'RECEPTIONIST':
      return 'Reception'
    case 'ADMIN':
      return 'Admin'
    default:
      return null
  }
}

function CustomerShopCartButton({ visible }) {
  const [pulse, setPulse] = useState(false)
  const { data } = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.getCart,
    enabled: visible,
    refetchInterval: visible ? 30000 : false,
  })

  useEffect(() => {
    if (!visible) return undefined

    const handlePulse = () => {
      setPulse(true)
      window.setTimeout(() => setPulse(false), 220)
    }

    window.addEventListener('gymcore:cart-pulse', handlePulse)
    return () => window.removeEventListener('gymcore:cart-pulse', handlePulse)
  }, [visible])

  if (!visible) return null

  const items = data?.data?.items || []
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)

  return (
    <button
      id="customer-cart-button"
      type="button"
      aria-label="Open cart"
      onClick={() => window.dispatchEvent(new Event('gymcore:toggle-cart'))}
      className={`relative rounded-full p-2 text-slate-600 transition hover:bg-slate-100 focus:outline-none ${pulse ? 'scale-110' : 'scale-100'}`}
    >
      <ShoppingCart size={20} />
      {itemCount > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full border-2 border-white bg-gym-600 px-1 text-[10px] font-bold text-white">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  )
}

function AppShell({ children }) {
  const { pathname } = useLocation()
  const { isAuthenticated, user } = useSession()
  const workspaceLinks = getWorkspaceLinks(pathname)
  const showWorkspaceNav = workspaceLinks.length > 0
  const userRole = String(user?.role || '').toUpperCase()
  const roleDestination = roleLandingPath(userRole)
  const roleLabel = roleHomeCta(userRole)
  const showRoleShortcut = isAuthenticated && !showWorkspaceNav && roleDestination !== '/' && roleLabel
  const showShopCartButton = isAuthenticated && userRole === 'CUSTOMER' && pathname.startsWith('/customer/shop')

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-900">
            <span className="rounded-md bg-gym-500 p-1.5 text-white">
              <Dumbbell size={16} />
            </span>
            <span className="text-lg font-bold">GymCore</span>
          </Link>

          <div className="flex items-center gap-3">
            {showRoleShortcut && (
              <Link
                to={roleDestination}
                className="hidden rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
              >
                Open {roleLabel}
              </Link>
            )}
            {showWorkspaceNav && (
              <nav className="hidden flex-wrap items-center gap-3 text-xs font-medium sm:flex sm:text-sm">
                {workspaceLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={({ isActive }) =>
                      isActive
                        ? 'rounded-md bg-gym-100 px-2 py-1 text-gym-900'
                        : 'rounded-md px-2 py-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900'
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            )}
            {isAuthenticated && <NotificationDropdown />}
            <CustomerShopCartButton visible={showShopCartButton} />
            <AuthHeaderActions />
          </div>
        </div>
        {showWorkspaceNav && (
          <div className="mx-auto max-w-7xl px-4 pb-3 sm:hidden sm:px-6">
            <nav className="flex flex-wrap gap-2 text-xs font-medium">
              {workspaceLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    isActive
                      ? 'rounded-md bg-gym-100 px-2 py-1 text-gym-900'
                      : 'rounded-md px-2 py-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900'
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-gradient-to-b from-white to-slate-50 px-4 pb-6 pt-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-3">
            <section className="space-y-3">
              <div className="inline-flex items-center gap-2 text-slate-900">
                <span className="rounded-md bg-gym-500 p-1.5 text-white">
                  <Dumbbell size={14} />
                </span>
                <span className="text-base font-bold">GymCore</span>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-slate-600">
                Modern fitness management with membership, coach booking, and seamless PayOS checkout.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</h3>
              <div className="space-y-2 text-sm text-slate-600">
                <p className="inline-flex items-center gap-2">
                  <Clock3 size={14} className="text-gym-600" />
                  <span>Open daily: {gymPublicInfo.openingHours}</span>
                </p>
                <a href={`tel:${gymPublicInfo.hotline}`} className="inline-flex items-center gap-2 transition hover:text-slate-900">
                  <Phone size={14} className="text-gym-600" />
                  <span>{gymPublicInfo.hotline}</span>
                </a>
                <a href={gymPublicInfo.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-start gap-2 transition hover:text-slate-900">
                  <MapPin size={14} className="mt-0.5 text-gym-600" />
                  <span className="leading-relaxed">{gymPublicInfo.address}</span>
                </a>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Links</h3>
              <div className="flex flex-col gap-2 text-sm text-slate-600">
                <Link to="/" className="inline-flex items-center gap-1 transition hover:text-slate-900">
                  Home
                </Link>
                <Link to="/customer/membership" className="inline-flex items-center gap-1 transition hover:text-slate-900">
                  Membership
                </Link>
                <Link to="/customer/shop" className="inline-flex items-center gap-1 transition hover:text-slate-900">
                  Product Shop
                </Link>
                <a
                  href={gymPublicInfo.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 transition hover:text-slate-900"
                >
                  Find us on map
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </section>
          </div>

          <div className="mt-8 flex flex-col items-start justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center">
            <p>© {new Date().getFullYear()} GymCore. All rights reserved.</p>
            <p>Pickup at gym front desk for all product orders.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AppShell
