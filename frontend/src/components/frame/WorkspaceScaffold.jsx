import { Link, NavLink } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import AuthHeaderActions from '../common/AuthHeaderActions'
import NotificationDropdown from '../common/NotificationDropdown'
import { Toaster } from 'react-hot-toast'

function WorkspaceScaffold({ title, subtitle, children, links = [] }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" reverseOrder={false} />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-900">
            <span className="rounded-md bg-gym-500 p-1.5 text-white">
              <Dumbbell size={16} />
            </span>
            <span className="font-bold">GymCore</span>
          </Link>
          <div className="flex items-center gap-3">
            <nav className="hidden flex-wrap items-center gap-3 text-xs font-medium sm:flex sm:text-sm">
              {links.map((link) => (
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
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <AuthHeaderActions />
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-3 sm:hidden sm:px-6">
          <nav className="flex flex-wrap gap-2 text-xs font-medium">
            {links.map((link) => (
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
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="mb-6 rounded-2xl border border-gym-100 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </section>
        {children}
      </main>
    </div>
  )
}

export default WorkspaceScaffold
