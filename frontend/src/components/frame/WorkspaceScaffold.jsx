import { Link, NavLink } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'

function WorkspaceScaffold({ title, subtitle, children, links }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-900">
            <span className="rounded-md bg-gym-500 p-1.5 text-white">
              <Dumbbell size={16} />
            </span>
            <span className="font-bold">GymCore</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-xs font-medium sm:text-sm">
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
