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
        className="gc-button-secondary min-h-10 px-4 py-2 text-sm"
      >
        Login
      </Link>
      <Link
        to="/auth/register"
        className="gc-button-primary min-h-10 px-4 py-2 text-sm"
      >
        Register
      </Link>
    </div>
  )
}

export default AuthHeaderActions



