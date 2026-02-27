import { Link, NavLink, useLocation } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import AuthHeaderActions from '../common/AuthHeaderActions'
import NotificationDropdown from '../common/NotificationDropdown'
import { useSession } from '../../features/auth/useSession'
import { adminNav, coachNav, customerNav, receptionNav } from '../../config/navigation'

function getWorkspaceLinks(pathname) {
  if (pathname.startsWith('/customer/')) return customerNav
  if (pathname.startsWith('/coach/')) return coachNav
  if (pathname.startsWith('/reception/')) return receptionNav
  if (pathname.startsWith('/admin/')) return adminNav
  return []
}

function AppShell({ children }) {
  const { pathname } = useLocation()
  const { isAuthenticated } = useSession()
  const workspaceLinks = getWorkspaceLinks(pathname)
  const showWorkspaceNav = workspaceLinks.length > 0

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

      <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 text-sm text-slate-600 sm:flex-row sm:items-center">
          <p>GymCore collaborative frame - Spring Boot + React</p>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-slate-900">
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default AppShell
