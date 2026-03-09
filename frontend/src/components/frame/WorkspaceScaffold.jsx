import { useState } from 'react'
import {
  BarChart3,
  BadgePercent,
  Boxes,
  Dumbbell,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  UtensilsCrossed,
  UserSquare2,
  Users,
} from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { NavLink, useLocation } from 'react-router-dom'

const adminNavIcons = {
  '/admin/dashboard': LayoutDashboard,
  '/admin/users': Users,
  '/admin/memberships': ShieldCheck,
  '/admin/coach-management': UserSquare2,
  '/admin/products': Boxes,
  '/admin/workouts': Dumbbell,
  '/admin/foods': UtensilsCrossed,
  '/admin/invoices': FileText,
  '/admin/promotions': BadgePercent,
  '/admin/reports': BarChart3,
}

function WorkspaceScaffold({ title, subtitle, links = [], children }) {
  const location = useLocation()
  const isAdminShell = location.pathname.startsWith('/admin/') && links.length > 0
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState(true)

  return (
    <div className="bg-slate-50">
      <Toaster position="top-right" reverseOrder={false} />
      {isAdminShell ? (
        <main className="w-full py-8 pr-4 sm:pr-6">
          <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
            <aside
              className={`sticky top-24 h-fit overflow-hidden border-y border-r border-slate-200 bg-white shadow-sm transition-all duration-200 ${
                isAdminSidebarOpen ? 'w-[280px]' : 'w-[88px]'
              }`}
            >
              <div className="flex items-start justify-between gap-3 px-5 py-5">
                <div className={`${isAdminSidebarOpen ? 'block' : 'hidden'} min-w-0`}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Admin</p>
                  <h1 className="mt-3 text-2xl font-bold text-slate-900">{title}</h1>
                  <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
                </div>
                <button
                  type="button"
                  aria-label={isAdminSidebarOpen ? 'Collapse admin sidebar' : 'Expand admin sidebar'}
                  onClick={() => setIsAdminSidebarOpen((value) => !value)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:border-gym-200 hover:bg-gym-50 hover:text-gym-700"
                >
                  <span className="sr-only">{isAdminSidebarOpen ? 'Collapse admin sidebar' : 'Expand admin sidebar'}</span>
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </svg>
                </button>
              </div>

              <nav className="space-y-1 px-3 pb-4" aria-label="Admin sidebar">
                {links.map((link) => (
                  (() => {
                    const LinkIcon = adminNavIcons[link.to] || FileText

                    return (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        aria-label={!isAdminSidebarOpen ? link.label : undefined}
                        title={!isAdminSidebarOpen ? link.label : undefined}
                        className={({ isActive }) =>
                          `flex min-h-12 items-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                            isActive
                              ? 'bg-gym-600 text-white shadow-sm'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                          } ${isAdminSidebarOpen ? 'justify-start gap-3' : 'justify-center'}`
                        }
                      >
                        <LinkIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        {isAdminSidebarOpen ? <span>{link.label}</span> : null}
                      </NavLink>
                    )
                  })()
                ))}
              </nav>
            </aside>

            <section className="space-y-6 pl-0">
              {children}
            </section>
          </div>
        </main>
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <section className="mb-6 rounded-2xl border border-gym-100 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          </section>
          {children}
        </main>
      )}
    </div>
  )
}

export default WorkspaceScaffold
