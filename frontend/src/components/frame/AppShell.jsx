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
  const isLandingPage = pathname === '/'
  const userRole = String(user?.role || '').toUpperCase()
  const roleDestination = roleLandingPath(userRole)
  const roleLabel = roleHomeCta(userRole)
  const showRoleShortcut = isAuthenticated && !showWorkspaceNav && roleDestination !== '/' && roleLabel
  const showShopCartButton = isAuthenticated && userRole === 'CUSTOMER' && pathname.startsWith('/customer/shop')

  const publicNav = [
    { label: 'Programs', to: '#programs' },
    { label: 'Trainers', to: '#trainers' },
    { label: 'Schedule', to: '#schedule' },
    { label: 'Pricing', to: '#pricing' },
    { label: 'Contact', to: '#footer' },
  ]

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <header className="sticky top-0 z-50 border-b border-gym-dark-50 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-gym-500">
              <Dumbbell size={28} strokeWidth={2.5} />
            </span>
            <span className="text-2xl font-black tracking-tight text-gym-dark-900">GymCore</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-8 lg:flex">
            {isLandingPage ? (
              publicNav.map((link) => (
                <a
                  key={link.label}
                  href={link.to}
                  className="text-sm font-bold text-gym-dark-700 transition hover:text-gym-500"
                >
                  {link.label}
                </a>
              ))
            ) : (
              showWorkspaceNav &&
              workspaceLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `text-sm font-bold transition ${isActive ? 'text-gym-500' : 'text-gym-dark-700 hover:text-gym-500'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))
            )}
          </nav>

          <div className="flex items-center gap-4">
            {showRoleShortcut && (
              <Link to={roleDestination} className="btn-secondary hidden py-2 lg:flex">
                Open {roleLabel}
              </Link>
            )}
            {isAuthenticated && <NotificationDropdown />}
            <CustomerShopCartButton visible={showShopCartButton} />

            {isAuthenticated ? (
              <AuthHeaderActions />
            ) : (
              <Link to="/auth/login" className="btn-primary py-2 px-6">
                Join Now
              </Link>
            )}

            {/* Mobile Nav Toggle (Simplified for now) */}
            <button className="flex lg:hidden text-gym-dark-900">
              <span className="sr-only">Menu</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer id="footer" className="bg-gym-dark-900 text-white selection:bg-gym-500/30">
        <div className="mx-auto max-w-7xl px-6 py-20 pb-10">
          <div className="grid gap-12 lg:grid-cols-4">
            <div className="space-y-6 lg:col-span-1">
              <Link to="/" className="flex items-center gap-2">
                <span className="text-gym-500">
                  <Dumbbell size={24} strokeWidth={2.5} />
                </span>
                <span className="text-xl font-black tracking-tight text-white">GymCore</span>
              </Link>
              <p className="text-gym-dark-300 leading-relaxed">
                Experience the ultimate fitness journey with state-of-the-art facilities and expert guidance.
              </p>
              <div className="flex gap-4">
                {/* Social placeholders */}
                {['fb', 'tw', 'ig', 'li'].map((s) => (
                  <button key={s} className="w-10 h-10 rounded-full bg-gym-dark-800 flex items-center justify-center hover:bg-gym-500 transition-colors">
                    <span className="sr-only">{s}</span>
                    <div className="w-4 h-4 rounded-sm bg-current" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6">Explore</h3>
              <ul className="space-y-4 text-gym-dark-300 font-bold">
                <li><Link to="/" className="hover:text-gym-500 transition">Programs</Link></li>
                <li><Link to="/" className="hover:text-gym-500 transition">Trainers</Link></li>
                <li><Link to="/customer/membership" className="hover:text-gym-500 transition">Membership</Link></li>
                <li><Link to="/customer/shop" className="hover:text-gym-500 transition">Shop</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6">Contact Us</h3>
              <ul className="space-y-4">
                <li className="flex gap-3 items-start group">
                  <MapPin className="text-gym-500 mt-1 shrink-0" size={18} />
                  <span className="text-gym-dark-300 group-hover:text-white transition">{gymPublicInfo.address}</span>
                </li>
                <li className="flex gap-3 items-center group">
                  <Phone className="text-gym-500 shrink-0" size={18} />
                  <span className="text-gym-dark-300 group-hover:text-white transition">{gymPublicInfo.hotline}</span>
                </li>
                <li className="flex gap-3 items-center group">
                  <Clock3 className="text-gym-500 shrink-0" size={18} />
                  <span className="text-gym-dark-300 group-hover:text-white transition">Daily: {gymPublicInfo.openingHours}</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-white mb-6">Newsletter</h3>
              <p className="text-gym-dark-300 mb-4 text-sm font-bold">Subscribe for tips and offers.</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  className="bg-gym-dark-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-gym-500 w-full"
                />
                <button className="bg-gym-500 p-3 rounded-xl hover:bg-gym-600 transition">
                  <ArrowUpRight size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-gym-dark-800 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-gym-dark-400 font-bold">
            <p>© {new Date().getFullYear()} GymCore Fitness. All rights reserved.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-white transition">Privacy Policy</a>
              <a href="#" className="hover:text-white transition">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}


export default AppShell
