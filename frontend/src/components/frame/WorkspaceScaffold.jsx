import { useState } from 'react'
import {
  Activity,
  BarChart3,
  BadgePercent,
  Boxes,
  Dumbbell,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  ShieldCheck,
  Target,
  Tags,
  UtensilsCrossed,
  UserSquare2,
  Users,
} from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import { NavLink, useLocation } from 'react-router-dom'

const adminNavIcons = {
  '/admin/dashboard': LayoutDashboard,
  '/admin/support': LifeBuoy,
  '/admin/users': Users,
  '/admin/memberships': ShieldCheck,
  '/admin/coach-management': UserSquare2,
  '/admin/products': Boxes,
  '/admin/goals': Target,
  '/admin/workouts': Dumbbell,
  '/admin/foods': UtensilsCrossed,
  '/admin/food-categories': Tags,
  '/admin/coach-insights': Activity,
  '/admin/invoices': FileText,
  '/admin/promotions': BadgePercent,
  '/admin/reports': BarChart3,
}

const adminNavGroups = [
  {
    title: 'Operations',
    match: ['/admin/dashboard', '/admin/support', '/admin/users', '/admin/memberships', '/admin/coach-management'],
  },
  {
    title: 'Catalog',
    match: ['/admin/goals', '/admin/workouts', '/admin/foods', '/admin/food-categories', '/admin/products'],
  },
  {
    title: 'Commerce',
    match: ['/admin/invoices', '/admin/promotions'],
  },
  {
    title: 'Reporting',
    match: ['/admin/coach-insights', '/admin/reports'],
  },
]

function groupAdminLinks(links) {
  const grouped = adminNavGroups
    .map((group) => ({
      ...group,
      links: links.filter((link) => group.match.includes(link.to)),
    }))
    .filter((group) => group.links.length > 0)

  const groupedPaths = new Set(grouped.flatMap((group) => group.links.map((link) => link.to)))
  const ungroupedLinks = links.filter((link) => !groupedPaths.has(link.to))

  if (ungroupedLinks.length > 0) {
    grouped.push({
      title: 'More',
      links: ungroupedLinks,
    })
  }

  return grouped
}

function WorkspaceScaffold({ title, subtitle, links = [], children }) {
  const location = useLocation()
  const isAdminShell = location.pathname.startsWith('/admin/') && links.length > 0
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState(true)
  const groupedAdminLinks = isAdminShell ? groupAdminLinks(links) : []

  return (
    <div className="bg-transparent">
      <Toaster position="top-right" reverseOrder={false} />
      {isAdminShell ? (
        <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.08),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.1),_transparent_20%),linear-gradient(180deg,_rgba(10,10,15,0.12),_rgba(10,10,15,0))] py-8 pr-4 sm:pr-6">
          <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
            <aside
              className={`sticky top-24 h-fit overflow-hidden rounded-r-[32px] border border-l-0 border-white/10 bg-[rgba(18,18,26,0.88)] shadow-[0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl transition-all duration-200 ${
                isAdminSidebarOpen ? 'w-[280px]' : 'w-[88px]'
              }`}
            >
              <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_42%),linear-gradient(180deg,rgba(26,26,36,0.95),rgba(18,18,26,0.92))] px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`${isAdminSidebarOpen ? 'block' : 'hidden'} min-w-0`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">Admin</p>
                    <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-slate-50">{title}</h1>
                    <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={isAdminSidebarOpen ? 'Collapse admin sidebar' : 'Expand admin sidebar'}
                    onClick={() => setIsAdminSidebarOpen((value) => !value)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-gym-300 hover:bg-gym-50 hover:text-gym-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  >
                    <span className="sr-only">{isAdminSidebarOpen ? 'Collapse admin sidebar' : 'Expand admin sidebar'}</span>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </svg>
                  </button>
                </div>
                {isAdminSidebarOpen ? (
                  <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 shadow-ambient-sm backdrop-blur-md">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Workspace mode</p>
                    <p className="mt-2 font-display text-sm font-semibold tracking-tight text-slate-50">Operations-first admin console</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Move between support, staff, catalog, and reporting without losing the current admin context.
                    </p>
                  </div>
                ) : null}
              </div>

              <nav className="space-y-4 px-3 pb-4 pt-4" aria-label="Admin sidebar">
                {groupedAdminLinks.map((group) => (
                  <div key={group.title} className="space-y-1">
                    {isAdminSidebarOpen ? (
                      <p className="px-4 pt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        {group.title}
                      </p>
                    ) : null}
                    {group.links.map((link) => {
                      const LinkIcon = adminNavIcons[link.to] || FileText

                      return (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          aria-label={!isAdminSidebarOpen ? link.label : undefined}
                          title={!isAdminSidebarOpen ? link.label : undefined}
                          className={({ isActive }) =>
                            `flex min-h-12 items-center rounded-2xl px-4 py-3 text-sm font-semibold transition duration-200 ${
                              isActive
                                ? 'border border-gym-300 bg-gym-500 text-slate-950 shadow-glow'
                                : 'border border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-50'
                            } ${isAdminSidebarOpen ? 'justify-start gap-3' : 'justify-center'}`
                          }
                        >
                          <LinkIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          {isAdminSidebarOpen ? <span>{link.label}</span> : null}
                        </NavLink>
                      )
                    })}
                  </div>
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
          <section className="mb-6 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(26,26,36,0.9),rgba(18,18,26,0.82))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <p className="gc-section-kicker">Workspace</p>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-slate-50">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">{subtitle}</p>
          </section>
          {children}
        </main>
      )}
    </div>
  )
}

export default WorkspaceScaffold
