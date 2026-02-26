import { Link } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'
import AuthHeaderActions from '../common/AuthHeaderActions'

function AppShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-slate-900">
            <span className="rounded-md bg-gym-500 p-1.5 text-white">
              <Dumbbell size={16} />
            </span>
            <span className="text-lg font-bold">GymCore</span>
          </Link>
          <AuthHeaderActions />
        </div>
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
