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
    { id: 'ai-knowledge', label: 'Open workout and food AI', route: '/customer/knowledge', type: 'route' },
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
  if (!element) return { left: false, right: false }
  const maxScroll = element.scrollWidth - element.clientWidth
  if (maxScroll <= 2) return { left: false, right: false }
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
    <button id="customer-cart-button" type="button" aria-label="Open cart" onClick={onOpenCart} className={`gc-button-icon relative ${pulse ? 'scale-110' : ''}`}>
      <ShoppingCart size={20} />
      {itemCount > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-gym-500 px-1 text-[10px] font-black text-slate-950">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      ) : null}
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
  const quickLinks = getQuickLinks(pathname, userRole)
  const aiQuickActions = getAiQuickActions(pathname, userRole)
  const showAiChatWidget = isAuthenticated

  const desktopNavRef = useRef(null)
  const mobileNavRef = useRef(null)
  const desktopDragRef = useRef({ active: false, startX: 0, scrollLeft: 0 })
  const mobileDragRef = useRef({ active: false, startX: 0, scrollLeft: 0 })
  const [desktopOverflow, setDesktopOverflow] = useState({ left: false, right: false })
  const [mobileOverflow, setMobileOverflow] = useState({ left: false, right: false })

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

  const desktopPointerDown = (event) => {
    if (event.button !== 0) return
    const el = desktopNavRef.current
    if (!el) return
    desktopDragRef.current.active = true
    desktopDragRef.current.startX = event.pageX - el.offsetLeft
    desktopDragRef.current.scrollLeft = el.scrollLeft
    event.preventDefault()
  }

  const desktopPointerMove = (event) => {
    if (!desktopDragRef.current.active) return
    const el = desktopNavRef.current
    if (!el) return
    const x = event.pageX - el.offsetLeft
    const walk = x - desktopDragRef.current.startX
    el.scrollLeft = desktopDragRef.current.scrollLeft - walk
    setDesktopOverflow(getOverflowState(el))
  }

  const mobilePointerDown = (event) => {
    if (event.button !== 0) return
    const el = mobileNavRef.current
    if (!el) return
    mobileDragRef.current.active = true
    mobileDragRef.current.startX = event.pageX - el.offsetLeft
    mobileDragRef.current.scrollLeft = el.scrollLeft
    event.preventDefault()
  }

  const mobilePointerMove = (event) => {
    if (!mobileDragRef.current.active) return
    const el = mobileNavRef.current
    if (!el) return
    const x = event.pageX - el.offsetLeft
    const walk = x - mobileDragRef.current.startX
    el.scrollLeft = mobileDragRef.current.scrollLeft - walk
    setMobileOverflow(getOverflowState(el))
  }

  useEffect(() => {
    desktopDragRef.current.active = false
    mobileDragRef.current.active = false
  }, [pathname])

  useEffect(() => {
    if (!showWorkspaceNav) return undefined

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
    <div className="flex min-h-screen flex-col bg-transparent text-zinc-50">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[rgba(10,10,15,0.82)] backdrop-blur-xl">
        <div className="gc-shell-boundary py-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Link to="/" onClick={() => handleRouteClick('/')} className="group inline-flex min-w-0 items-center gap-4">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-gradient-to-br from-gym-400 to-gym-600 text-slate-950 shadow-[0_0_24px_rgba(245,158,11,0.22)]">
                  <Dumbbell size={22} strokeWidth={2.5} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-xl font-black tracking-tight text-white">GymCore</span>
                  <span className="block truncate text-[0.68rem] font-bold uppercase tracking-[0.28em] text-zinc-500">Minimalist Dark Workspace</span>
                </span>
              </Link>

              <div className="ml-auto flex shrink-0 items-center gap-3">
                {isAuthenticated ? <NotificationDropdown /> : null}
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

            {showWorkspaceNav ? (
              <div className="space-y-3">
                <div className="hidden items-center justify-between gap-4 sm:flex">
                  <div className="min-w-0 space-y-1">
                    <p className="gc-page-kicker">Workspace Navigation</p>
                    <p className="text-sm text-zinc-500">Stay inside the same role flow while moving between related tasks.</p>
                  </div>
                  <div className="flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    <span className="h-2 w-2 rounded-full bg-gym-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]" />
                    {userRole || 'Guest'}
                  </div>
                </div>

                <div className="relative hidden sm:block">
                  {desktopOverflow.left ? <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-14 items-center justify-start bg-[linear-gradient(90deg,rgba(10,10,15,0.98),rgba(10,10,15,0.2))] pl-2 text-zinc-500"><ChevronLeft size={16} /></div> : null}
                  {desktopOverflow.right ? <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-14 items-center justify-end bg-[linear-gradient(270deg,rgba(10,10,15,0.98),rgba(10,10,15,0.2))] pr-2 text-zinc-500"><ChevronRight size={16} /></div> : null}
                  <nav
                    ref={desktopNavRef}
                    aria-label="Workspace navigation"
                    className="gc-scrollbar-hidden flex min-w-0 select-none gap-2 overflow-x-auto rounded-[20px] border border-white/10 bg-white/[0.025] p-2 backdrop-blur-md"
                    onMouseDown={desktopPointerDown}
                    onMouseMove={desktopPointerMove}
                    onMouseUp={() => { desktopDragRef.current.active = false }}
                    onMouseLeave={() => { desktopDragRef.current.active = false }}
                  >
                    {headerLinks.map((link) => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        onClick={() => handleRouteClick(link.to)}
                        className={({ isActive }) => [
                          'inline-flex min-h-11 items-center rounded-full px-4 py-2 text-[0.74rem] font-black uppercase tracking-[0.18em] transition-[transform,background-color,color,box-shadow] duration-200',
                          isActive ? 'bg-gym-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.28)]' : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white',
                        ].join(' ')}
                      >
                        {link.label}
                      </NavLink>
                    ))}
                  </nav>
                </div>

                <div className="relative sm:hidden">
                  {mobileOverflow.left ? <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-10 items-center justify-start bg-[linear-gradient(90deg,rgba(10,10,15,0.96),rgba(10,10,15,0.1))] pl-1 text-zinc-500"><ChevronLeft size={14} /></div> : null}
                  {mobileOverflow.right ? <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end bg-[linear-gradient(270deg,rgba(10,10,15,0.96),rgba(10,10,15,0.1))] pr-1 text-zinc-500"><ChevronRight size={14} /></div> : null}
                  <nav
                    ref={mobileNavRef}
                    aria-label="Workspace navigation"
                    className="gc-scrollbar-hidden flex select-none gap-2 overflow-x-auto rounded-[18px] border border-white/10 bg-white/[0.025] p-2 backdrop-blur-md"
                    onMouseDown={mobilePointerDown}
                    onMouseMove={mobilePointerMove}
                    onMouseUp={() => { mobileDragRef.current.active = false }}
                    onMouseLeave={() => { mobileDragRef.current.active = false }}
                  >
                    {headerLinks.map((link) => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        onClick={() => handleRouteClick(link.to)}
                        className={({ isActive }) => [
                          'inline-flex min-h-10 items-center rounded-full px-4 py-2 text-[0.7rem] font-black uppercase tracking-[0.18em] transition-[transform,background-color,color,box-shadow] duration-200',
                          isActive ? 'bg-gym-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.28)]' : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white',
                        ].join(' ')}
                      >
                        {link.label}
                      </NavLink>
                    ))}
                  </nav>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1 scroll-mt-28">{children}</main>

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

      <footer className="border-t border-white/10 bg-[rgba(10,10,15,0.94)]">
        <div className="gc-shell-boundary py-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr_0.9fr]">
            <section className="space-y-4">
              <p className="gc-page-kicker">GymCore</p>
              <h2 className="max-w-sm font-display text-3xl font-black leading-none text-white">Training, coaching, checkout, and member routines in one place.</h2>
              <p className="max-w-md text-sm leading-7 text-zinc-400">
                GymCore is designed around real gym operations: PayOS checkout, front-desk pickup, recurring PT support, check-in QR, and role-based workspaces.
              </p>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-[0.22em] text-zinc-300">Visit Us</h3>
              <div className="space-y-4 text-sm text-zinc-400">
                <p className="inline-flex items-center gap-2.5"><Clock3 size={14} className="text-gym-400" /><span>Open Daily: {gymPublicInfo.openingHours}</span></p>
                <p className="inline-flex items-center gap-2.5"><Phone size={14} className="text-gym-400" /><span>{gymPublicInfo.hotline}</span></p>
                <a href={gymPublicInfo.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-start gap-2.5 transition-[color,transform] duration-200 hover:text-white">
                  <MapPin size={14} className="mt-0.5 text-gym-400" />
                  <span className="leading-6">{gymPublicInfo.address}</span>
                </a>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-black uppercase tracking-[0.22em] text-zinc-300">Explore</h3>
              <div className="flex flex-col gap-3 text-sm text-zinc-400">
                <Link to="/" onClick={() => handleRouteClick('/')} className="transition-[color,transform] duration-200 hover:text-white">Home</Link>
                {quickLinks.map((link) => (
                  <Link key={link.to} to={link.to} onClick={() => handleRouteClick(link.to)} className="transition-[color,transform] duration-200 hover:text-white">
                    {link.label}
                  </Link>
                ))}
                <a href={gymPublicInfo.mapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 transition-[color,transform] duration-200 hover:text-white">
                  Open map
                  <ArrowUpRight size={13} />
                </a>
              </div>
            </section>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs font-medium uppercase tracking-[0.16em] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p>Pickup at gym front desk for product orders.</p>
            <p>&copy; {new Date().getFullYear()} GymCore.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AppShell


