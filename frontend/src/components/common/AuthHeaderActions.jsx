import { Link } from 'react-router-dom'
import AccountMenu from './AccountMenu'
import { useSession } from '../../features/auth/useSession'

function AuthHeaderActions() {
  const { isAuthenticated } = useSession()

  if (isAuthenticated) {
    return <AccountMenu />
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        to="/auth/login"
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 shadow-ambient-sm backdrop-blur-md transition hover:border-white/30 hover:bg-white hover:text-[#0ea773]"
      >
        Login
      </Link>
      <Link
        to="/auth/register"
        className="rounded-xl bg-gym-500 px-3 py-2 text-sm font-semibold text-slate-950 shadow-glow transition hover:brightness-110 hover:shadow-glow-lg"
      >
        Register
      </Link>
    </div>
  )
}

export default AuthHeaderActions

