import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock3, Dumbbell, MapPin, Phone, ShoppingCart } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import AuthHeaderActions from '../common/AuthHeaderActions'
import AiChatWidget from '../common/AiChatWidget'
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

function getQuickLinks(pathname, role) {
  if (pathname.startsWith('/admin/')) {
    return [
      { to: '/admin/dashboard', label: 'Dashboard' },
      { to: '/admin/support', label: 'Support Console' },
      { to: '/admin/reports', label: 'Reports' },
    ]
  }

  if (pathname.startsWith('/coach/')) {
    return [
      { to: '/coach/schedule', label: 'Schedule' },
      { to: '/coach/booking-requests', label: 'Booking Requests' },
      { to: '/coach/customers', label: 'Customers' },
    ]
  }

  if (pathname.startsWith('/reception/')) {
    return [
      { to: '/reception/checkin', label: 'Check-in Scanner' },
      { to: '/reception/pickup', label: 'Pickup Desk' },
      { to: '/reception/invoices', label: 'Invoices' },
    ]
  }

  if (pathname.startsWith('/customer/') || role === 'CUSTOMER') {
    return [
      { to: '/customer/progress-hub', label: 'Progress Hub' },
      { to: '/customer/membership', label: 'Membership' },
      { to: '/customer/shop', label: 'Product Shop' },
    ]
  }

  return [{ to: '/', label: 'Home' }]
}

function getAiMode(pathname, role) {
  if (pathname.startsWith('/customer/knowledge')) return 'WORKOUTS'
  if (pathname.startsWith('/customer/shop') || pathname.startsWith('/customer/cart') || pathname.startsWith('/customer/orders')) return 'PRODUCTS'
  if (pathname.startsWith('/customer/membership')) return 'MEMBERSHIP'
  if (pathname.startsWith('/customer/coach-booking')) return 'COACH_BOOKING'
  if (pathname.startsWith('/customer/progress-hub')) return 'PROGRESS_HUB'
  if (pathname.startsWith('/admin/')) return 'ADMIN'
  if (pathname.startsWith('/coach/')) return 'COACH'
  if (pathname.startsWith('/reception/')) return 'RECEPTION'
  return role === 'CUSTOMER' ? 'WORKOUTS' : 'GENERAL'
}

function getAiQuickActions(pathname, role) {
  const customerActions = [
    { id: 'ai-membership', label: 'Open membership', route: '/customer/membership', type: 'route' },
    { id: 'ai-progress-hub', label: 'Open progress hub', route: '/customer/progress-hub', type: 'route' },
    { id: 'ai-coach-booking', label: 'Open coach booking', route: '/customer/coach-booking', type: 'route' },
    { id: 'ai-product-shop', label: 'Open product shop', route: '/customer/shop', type: 'route' },
    { id: 'ai-knowledge', label: 'Open workout/food AI', route: '/customer/knowledge', type: 'route' },
  ]

  const coachActions = [
    { id: 'ai-coach-schedule', label: 'Open schedule', route: '/coach/schedule', type: 'route' },
    { id: 'ai-coach-requests', label: 'Open booking requests', route: '/coach/booking-requests', type: 'route' },
    { id: 'ai-coach-customers', label: 'Open customers', route: '/coach/customers', type: 'route' },
  ]

  const receptionActions = [
    { id: 'ai-reception-checkin', label: 'Open check-in', route: '/reception/checkin', type: 'route' },
    { id: 'ai-reception-pickup', label: 'Open pickup desk', route: '/reception/pickup', type: 'route' },
    { id: 'ai-reception-invoices', label: 'Open invoices', route: '/reception/invoices', type: 'route' },
  ]

  const adminActions = [
    { id: 'ai-admin-dashboard', label: 'Open dashboard', route: '/admin/dashboard', type: 'route' },
    { id: 'ai-admin-support', label: 'Open support console', route: '/admin/support', type: 'route' },
    { id: 'ai-admin-reports', label: 'Open reports', route: '/admin/reports', type: 'route' },
  ]

  if (pathname.startsWith('/admin/')) return adminActions
  if (pathname.startsWith('/coach/')) return coachActions
  if (pathname.startsWith('/reception/')) return receptionActions
  if (pathname.startsWith('/customer/') || role === 'CUSTOMER') return customerActions
  return []
}

function getOverflowState(element) {
  if (!element) {
    return { left: false, right: false }
  }

  const maxScroll = element.scrollWidth - element.clientWidth
  if (maxScroll <= 2) {
    return { left: false, right: false }
  }

  return {
    left: element.scrollLeft > 4,
    right: element.scrollLeft < maxScroll - 4,
  }
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
      className={`relative rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 shadow-ambient-sm backdrop-blur-md transition duration-200 hover:border-white/15 hover:bg-white/10 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${pulse ? 'scale-110 shadow-glow' : 'scale-100'}`}
    >
      <ShoppingCart size={20} />
      {itemCount > 0 && (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full border border-slate-950 bg-gym-500 px-1 text-[10px] font-bold text-slate-950 shadow-glow">
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
  const [desktopOverflow, setDesktopOverflow] = useState({ left: false, right: false })
  const [mobileOverflow, setMobileOverflow] = useState({ left: false, right: false })
  const quickLinks = getQuickLinks(pathname, userRole)
  const aiQuickActions = getAiQuickActions(pathname, userRole)
  const showAiChatWidget = isAuthenticated

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
    setDesktopOverflow(getOverflowState(el))
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
    setMobileOverflow(getOverflowState(el))
  }

  useEffect(() => {
    if (!showWorkspaceNav) {
      return undefined
    }

    const desktopEl = desktopNavRef.current
    const mobileEl = mobileNavRef.current
    const syncDesktop = () => setDesktopOverflow(getOverflowState(desktopNavRef.current))
    const syncMobile = () => setMobileOverflow(getOverflowState(mobileNavRef.current))

    const frame = window.requestAnimationFrame(() => {
      desktopEl?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
      mobileEl?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
      syncDesktop()
      syncMobile()
    })

    desktopEl?.addEventListener('scroll', syncDesktop, { passive: true })
    mobileEl?.addEventListener('scroll', syncMobile, { passive: true })
    window.addEventListener('resize', syncDesktop)
    window.addEventListener('resize', syncMobile)

    return () => {
      window.cancelAnimationFrame(frame)
      desktopEl?.removeEventListener('scroll', syncDesktop)
      mobileEl?.removeEventListener('scroll', syncMobile)
      window.removeEventListener('resize', syncDesktop)
      window.removeEventListener('resize', syncMobile)
    }
  }, [pathname, showWorkspaceNav])

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-slate-50">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(10,10,15,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" onClick={() => handleRouteClick('/')} className="inline-flex items-center gap-3 text-slate-50">
            <span className="rounded-xl bg-gym-500 p-2 text-slate-950 shadow-glow">
              <Dumbbell size={16} />
            </span>
            <span>
              <span className="block font-display text-lg font-bold tracking-tight">GymCore</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300">Atmospheric fitness workspace</span>
            </span>
          </Link>

          {showWorkspaceNav ? (
            <div className="relative hidden min-w-0 flex-1 sm:block">
              {desktopOverflow.left ? (
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-10 items-center justify-start pl-1 text-slate-500" style={{ background: 'linear-gradient(90deg, rgba(10,10,15,0.96) 0%, rgba(10,10,15,0.76) 60%, rgba(10,10,15,0) 100%)' }}>
                  <ChevronLeft size={16} />
                </div>
              ) : null}
              {desktopOverflow.right ? (
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end pr-1 text-slate-500" style={{ background: 'linear-gradient(270deg, rgba(10,10,15,0.96) 0%, rgba(10,10,15,0.76) 60%, rgba(10,10,15,0) 100%)' }}>
                  <ChevronRight size={16} />
                </div>
              ) : null}
              <nav
                ref={desktopNavRef}
                className="gc-scrollbar-hidden flex min-w-0 select-none items-center gap-1 overflow-x-auto px-2 whitespace-nowrap text-xs font-medium sm:text-sm"
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
                        ? 'rounded-full px-3 py-2 text-sm font-semibold text-gym-500'
                        : 'rounded-full px-3 py-2 text-sm text-slate-200 transition hover:!text-emerald-400'
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          ) : (
            <div className="hidden flex-1 sm:block" />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-3">
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
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-3 sm:hidden sm:px-6">
            <div className="relative">
              {mobileOverflow.left ? (
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-8 items-center justify-start pl-1 text-slate-500" style={{ background: 'linear-gradient(90deg, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.72) 60%, rgba(10,10,15,0) 100%)' }}>
                  <ChevronLeft size={14} />
                </div>
              ) : null}
              {mobileOverflow.right ? (
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-8 items-center justify-end pr-1 text-slate-500" style={{ background: 'linear-gradient(270deg, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.72) 60%, rgba(10,10,15,0) 100%)' }}>
                  <ChevronRight size={14} />
                </div>
              ) : null}
              <nav
                ref={mobileNavRef}
                className="gc-scrollbar-hidden flex select-none flex-nowrap gap-2 overflow-x-auto px-1 whitespace-nowrap text-xs font-medium"
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
                        ? 'rounded-full px-3 py-2 text-gym-500'
                        : 'rounded-full px-3 py-2 text-slate-200 transition hover:!text-emerald-400'
                  }
                >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {showAiChatWidget ? (
        <AiChatWidget
          context={{ mode: getAiMode(pathname, userRole) }}
          quickActions={aiQuickActions}
          onAction={(action) => {
            const route = String(action?.route || '').trim()
            if (!route) return
            if (pathname === route) {
              smoothScrollToTop()
              return
            }
            jumpToTop()
            navigate(route)
          }}
        />
      ) : null}

      <footer className="border-t border-white/10 bg-[linear-gradient(180deg,rgba(18,18,26,0.45),rgba(10,10,15,0.94))] px-4 pb-6 pt-12 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr_0.95fr] lg:gap-14">
            <section className="space-y-4">
              <div className="inline-flex items-center gap-3 text-slate-50">
                <span className="rounded-xl bg-gym-500 p-2 text-slate-950 shadow-glow">
                  <Dumbbell size={14} />
                </span>
                <span className="font-display text-xl font-bold tracking-tight">GymCore</span>
              </div>
              <p className="max-w-md text-base leading-8 text-slate-200">
                A customer-first fitness space for training, memberships, coaching support, and everyday routines that are easier to keep going.
              </p>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-slate-100">Visit Us</h3>
              <div className="space-y-4 text-base text-slate-200">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  <p className="inline-flex items-center gap-2.5">
                    <Clock3 size={14} className="text-gym-600" />
                    <span>Open daily: {gymPublicInfo.openingHours}</span>
                  </p>
                  <p className="inline-flex items-center gap-2.5">
                    <Phone size={14} className="text-gym-600" />
                    <span>{gymPublicInfo.hotline}</span>
                  </p>
                </div>
                <a
                  href={gymPublicInfo.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-2.5 text-slate-200 transition duration-200 hover:text-gym-500"
                >
                  <MapPin size={14} className="mt-0.5 text-gym-600" />
                  <span className="leading-relaxed">{gymPublicInfo.address}</span>
                </a>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-slate-100">Explore</h3>
              <div className="flex flex-col gap-3 text-base text-slate-200">
                <Link
                  to="/"
                  onClick={() => handleRouteClick('/')}
                  className="inline-flex items-center gap-1 text-slate-200 transition duration-200 hover:text-gym-500"
                >
                  Home
                </Link>
                {quickLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => handleRouteClick(link.to)}
                    className="inline-flex items-center gap-1 text-slate-200 transition duration-200 hover:text-gym-500"
                  >
                    {link.label}
                  </Link>
                ))}
                <a
                  href={gymPublicInfo.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-slate-200 transition duration-200 hover:text-gym-500"
                >
                  Find us on map
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </section>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-5 text-sm text-slate-200 sm:flex-row sm:items-center">
            <p>&copy; {new Date().getFullYear()} GymCore. All rights reserved.</p>
            <p>Pickup at gym front desk for all product orders.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AppShell
