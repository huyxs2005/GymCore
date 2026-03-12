import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Clock3, Dumbbell, MapPin, Phone, ShoppingCart } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import AuthHeaderActions from '../common/AuthHeaderActions'
import NotificationDropdown from '../common/NotificationDropdown'
import { useSession } from '../../features/auth/useSession'
import { adminNav, coachNav, customerNav, receptionNav } from '../../config/navigation'
import { gymPublicInfo } from '../../config/publicInfo'
import { cartApi } from '../../features/product/api/cartApi'

function getWorkspaceLinks(pathname) {
  if (pathname.startsWith('/customer/')) return customerNav
  if (pathname.startsWith('/coach/')) return coachNav
  if (pathname.startsWith('/reception/')) return receptionNav
  if (pathname.startsWith('/admin/')) return adminNav
  return []
}

function getRoleLinks(role) {
  switch (role) {
    case 'CUSTOMER':
      return customerNav
    case 'COACH':
      return coachNav
    case 'RECEPTIONIST':
      return receptionNav
    case 'ADMIN':
      return adminNav
    default:
      return []
  }
}

function shouldUseRoleHeader(pathname) {
  return pathname === '/' || pathname === '/profile' || pathname === '/notifications'
}

function CustomerShopCartButton({ visible, onOpenCart }) {
  const [pulse, setPulse] = useState(false)
  const { user } = useSession()
  const userId = user?.userId ?? null
  const { data } = useQuery({
    queryKey: ['cart', userId],
    queryFn: cartApi.getCart,
    enabled: visible && Boolean(userId),
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

  const items = data?.items || []
  const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)

  return (
    <button
      id="customer-cart-button"
      type="button"
      aria-label="Open cart"
      onClick={onOpenCart}
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
  const navigate = useNavigate()
  const { isAuthenticated, user } = useSession()
  const userRole = String(user?.role || '').toUpperCase()
  const roleLinks = getRoleLinks(userRole)
  const workspaceLinks = getWorkspaceLinks(pathname)
  const headerLinks = workspaceLinks.length > 0 ? workspaceLinks : (isAuthenticated && shouldUseRoleHeader(pathname) ? roleLinks : [])
  const showWorkspaceNav = headerLinks.length > 0
  const showShopCartButton = isAuthenticated && userRole === 'CUSTOMER'
  const desktopNavRef = useRef(null)
  const mobileNavRef = useRef(null)
  const desktopDragRef = useRef({ active: false, startX: 0, scrollLeft: 0 })
  const mobileDragRef = useRef({ active: false, startX: 0, scrollLeft: 0 })

  function jumpToTop() {
    window.scrollTo(0, 0)
  }

  function smoothScrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleRouteClick(targetPath) {
    if (pathname === targetPath) {
      smoothScrollToTop()
      return
    }
    jumpToTop()
  }

  const onDesktopMouseDown = (event) => {
    if (event.button !== 0) return
    const el = desktopNavRef.current
    if (!el) return
    desktopDragRef.current.active = true
    desktopDragRef.current.startX = event.pageX - el.offsetLeft
    desktopDragRef.current.scrollLeft = el.scrollLeft
    event.preventDefault()
  }

  const onDesktopMouseUp = () => {
    desktopDragRef.current.active = false
  }

  const onDesktopMouseLeave = () => {
    desktopDragRef.current.active = false
  }

  const onDesktopMouseMove = (event) => {
    if (!desktopDragRef.current.active) return
    const el = desktopNavRef.current
    if (!el) return
    const x = event.pageX - el.offsetLeft
    const walk = x - desktopDragRef.current.startX
    el.scrollLeft = desktopDragRef.current.scrollLeft - walk
  }

  const onMobileMouseDown = (event) => {
    if (event.button !== 0) return
    const el = mobileNavRef.current
    if (!el) return
    mobileDragRef.current.active = true
    mobileDragRef.current.startX = event.pageX - el.offsetLeft
    mobileDragRef.current.scrollLeft = el.scrollLeft
    event.preventDefault()
  }

  const onMobileMouseUp = () => {
    mobileDragRef.current.active = false
  }

  const onMobileMouseLeave = () => {
    mobileDragRef.current.active = false
  }

  const onMobileMouseMove = (event) => {
    if (!mobileDragRef.current.active) return
    const el = mobileNavRef.current
    if (!el) return
    const x = event.pageX - el.offsetLeft
    const walk = x - mobileDragRef.current.startX
    el.scrollLeft = mobileDragRef.current.scrollLeft - walk
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" onClick={() => handleRouteClick('/')} className="inline-flex items-center gap-2 text-slate-900">
            <span className="rounded-md bg-gym-500 p-1.5 text-white">
              <Dumbbell size={16} />
            </span>
            <span className="text-lg font-bold">GymCore</span>
          </Link>

          <div className="flex items-center gap-3">
            {showWorkspaceNav && (
              <nav
                ref={desktopNavRef}
                className="gc-scrollbar-hidden hidden max-w-[74vw] select-none items-center gap-2 overflow-x-auto whitespace-nowrap text-xs font-medium sm:flex sm:flex-nowrap sm:text-sm"
                onMouseDown={onDesktopMouseDown}
                onMouseUp={onDesktopMouseUp}
                onMouseLeave={onDesktopMouseLeave}
                onMouseMove={onDesktopMouseMove}
                aria-label="Workspace navigation"
              >
                {headerLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => handleRouteClick(link.to)}
                    className={({ isActive }) =>
                      isActive
                        ? 'rounded-md bg-gym-100 px-1.5 py-1 text-gym-900'
                        : 'rounded-md px-1.5 py-1 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900'
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            )}
            {isAuthenticated && <NotificationDropdown />}
            <CustomerShopCartButton
              visible={showShopCartButton}
              onOpenCart={() => {
                if (pathname === '/customer/cart') return
                jumpToTop()
                navigate('/customer/cart')
              }}
            />
            <AuthHeaderActions />
          </div>
        </div>
        {showWorkspaceNav && (
          <div className="mx-auto max-w-7xl px-4 pb-3 sm:hidden sm:px-6">
            <nav
              ref={mobileNavRef}
              className="gc-scrollbar-hidden flex select-none flex-nowrap gap-2 overflow-x-auto whitespace-nowrap text-xs font-medium"
              onMouseDown={onMobileMouseDown}
              onMouseUp={onMobileMouseUp}
              onMouseLeave={onMobileMouseLeave}
              onMouseMove={onMobileMouseMove}
              aria-label="Workspace navigation"
            >
              {headerLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => handleRouteClick(link.to)}
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
              <div className="space-y-2.5 text-sm text-slate-600">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <p className="inline-flex items-center gap-2">
                    <Clock3 size={14} className="text-gym-600" />
                    <span>Open daily: {gymPublicInfo.openingHours}</span>
                  </p>
                  <a href={`tel:${gymPublicInfo.hotline}`} className="inline-flex items-center gap-2 transition hover:text-slate-900">
                    <Phone size={14} className="text-gym-600" />
                    <span>{gymPublicInfo.hotline}</span>
                  </a>
                </div>
                <a href={gymPublicInfo.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-start gap-2 transition hover:text-slate-900">
                  <MapPin size={14} className="mt-0.5 text-gym-600" />
                  <span className="leading-relaxed">{gymPublicInfo.address}</span>
                </a>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Links</h3>
              <div className="flex flex-col gap-2 text-sm text-slate-600">
                <Link to="/" onClick={() => handleRouteClick('/')} className="inline-flex items-center gap-1 transition hover:text-slate-900">
                  Home
                </Link>
                <Link to="/customer/membership" onClick={() => handleRouteClick('/customer/membership')} className="inline-flex items-center gap-1 transition hover:text-slate-900">
                  Membership
                </Link>
                <Link to="/customer/shop" onClick={() => handleRouteClick('/customer/shop')} className="inline-flex items-center gap-1 transition hover:text-slate-900">
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
