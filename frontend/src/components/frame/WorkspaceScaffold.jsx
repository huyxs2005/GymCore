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
  '/admin/coach-insights': Activity,
  '/admin/invoices': FileText,
  '/admin/promotions': BadgePercent,
  '/admin/reports': BarChart3,
}

const adminNavGroups = [
  { title: 'Operations', match: ['/admin/dashboard', '/admin/support', '/admin/users', '/admin/memberships', '/admin/coach-management'] },
  { title: 'Catalog', match: ['/admin/goals', '/admin/workouts', '/admin/foods', '/admin/products'] },
  { title: 'Commerce', match: ['/admin/invoices', '/admin/promotions'] },
  { title: 'Reporting', match: ['/admin/coach-insights', '/admin/reports'] },
]

function groupAdminLinks(links) {
  const grouped = adminNavGroups
    .map((group) => ({ ...group, links: links.filter((link) => group.match.includes(link.to)) }))
    .filter((group) => group.links.length > 0)

  const groupedPaths = new Set(grouped.flatMap((group) => group.links.map((link) => link.to)))
  const ungroupedLinks = links.filter((link) => !groupedPaths.has(link.to))

  if (ungroupedLinks.length > 0) grouped.push({ title: 'More', links: ungroupedLinks })
  return grouped
}

function WorkspaceScaffold({
  title,
  subtitle,
  links = [],
  actions = null,
  headerMeta = null,
  variant,
  children,
}) {
  const location = useLocation()
  const inferredVariant = variant || (location.pathname.startsWith('/admin/') && links.length > 0 ? 'admin-rail' : 'workspace')
  const isAdminRail = inferredVariant === 'admin-rail'
  const [isAdminSidebarOpen, setIsAdminSidebarOpen] = useState(true)
  const groupedAdminLinks = isAdminRail ? groupAdminLinks(links) : []

  return (
    <div className="bg-transparent">
      <Toaster position="top-right" reverseOrder={false} />
      {isAdminRail ? (
        <main className="gc-shell-boundary py-8">
          <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside className={`gc-panel sticky top-24 h-fit overflow-hidden p-4 transition-[width] duration-200 ${isAdminSidebarOpen ? 'w-full max-w-[300px]' : 'w-full max-w-[96px]'}`}>
              <div className="space-y-5 border-b border-white/10 px-2 pb-5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`${isAdminSidebarOpen ? 'block' : 'hidden'} min-w-0 space-y-3`}>
                    <p className="gc-page-kicker">Admin Rail</p>
                    <h1 className="font-display text-[1.85rem] font-black tracking-tight text-white">{title}</h1>
                    <p className="text-sm leading-7 text-zinc-400">{subtitle}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={isAdminSidebarOpen ? 'Collapse admin sidebar' : 'Expand admin sidebar'}
                    onClick={() => setIsAdminSidebarOpen((value) => !value)}
                    className="gc-button-icon"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </svg>
                  </button>
                </div>

                {isAdminSidebarOpen ? (
                  <div className="gc-panel-soft space-y-3 px-4 py-4">
                    <p className="gc-page-kicker">Control Room</p>
                    <p className="font-display text-lg font-bold text-white">Dense data, clear next actions, less visual noise.</p>
                    <p className="text-sm leading-7 text-zinc-400">
                      This rail keeps admin workflows grouped by operations, catalog, commerce, and reporting instead of scattered page by page.
                    </p>
                  </div>
                ) : null}
              </div>

              <nav className="space-y-5 px-2 pt-5" aria-label="Admin sidebar">
                {groupedAdminLinks.map((group) => (
                  <div key={group.title} className="space-y-2">
                    {isAdminSidebarOpen ? <p className="px-3 text-[0.68rem] font-black uppercase tracking-[0.22em] text-zinc-500">{group.title}</p> : null}
                    {group.links.map((link) => {
                      const LinkIcon = adminNavIcons[link.to] || FileText
                      return (
                        <NavLink
                          key={link.to}
                          to={link.to}
                          aria-label={!isAdminSidebarOpen ? link.label : undefined}
                          title={!isAdminSidebarOpen ? link.label : undefined}
                          className={({ isActive }) => [
                            'flex min-h-12 items-center rounded-[20px] border px-4 py-3 text-sm font-bold transition-[transform,background-color,color,border-color,box-shadow] duration-200',
                            isActive ? 'border-amber-300/30 bg-gym-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.22)]' : 'border-transparent bg-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white',
                            isAdminSidebarOpen ? 'justify-start gap-3' : 'justify-center',
                          ].join(' ')}
                        >
                          <LinkIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                          {isAdminSidebarOpen ? <span className="min-w-0 truncate">{link.label}</span> : null}
                        </NavLink>
                      )
                    })}
                  </div>
                ))}
              </nav>
            </aside>

            <section className="min-w-0 space-y-6">
              <header className="gc-panel overflow-hidden p-6 sm:p-8">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div className="space-y-4">
                    <p className="gc-page-kicker">Operations Console</p>
                    <h1 className="gc-page-title text-[clamp(2.1rem,4vw,4rem)]">{title}</h1>
                    <p className="gc-page-copy">{subtitle}</p>
                    {headerMeta ? <div className="text-sm text-zinc-400">{headerMeta}</div> : null}
                  </div>
                  {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
                </div>
              </header>
              {children}
            </section>
          </div>
        </main>
      ) : (
        <main className="gc-shell-boundary py-8">
          <section className="space-y-6">
              <header className="gc-panel overflow-hidden p-6 sm:p-8">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <div className="space-y-4">
                    <p className="gc-page-kicker">Workspace</p>
                    <h1 className="gc-page-title text-[clamp(2rem,4vw,3.6rem)]">{title}</h1>
                    <p className="gc-page-copy">{subtitle}</p>
                    {headerMeta ? <div className="text-sm text-zinc-400">{headerMeta}</div> : null}
                  </div>
                  {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
                </div>
            </header>
            {children}
          </section>
        </main>
      )}
    </div>
  )
}

export default WorkspaceScaffold


