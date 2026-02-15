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
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Login
      </Link>
      <Link
        to="/auth/register"
        className="rounded-lg bg-gym-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gym-700"
      >
        Register
      </Link>
    </div>
  )
}

export default AuthHeaderActions

