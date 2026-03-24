import { Link } from 'react-router-dom'
import AuthPageShell from '../components/auth/AuthPageShell'

function NotFoundPage() {
  return (
    <AuthPageShell
      kicker="404"
      title="The page you are looking for does not exist."
      description="This route is outside the current workspace map. The page may have moved, the URL may be wrong, or the current role might not expose that path."
      asideItems={[
        'Role guards redirect unauthorized users to the home route.',
        'Use the workspace navigation to stay inside supported routes.',
      ]}
    >
      <div className="space-y-5 text-sm leading-7 text-slate-300">
        <p>Return to the main entry point and continue from the correct workspace route.</p>
        <Link to="/" className="gc-button-primary inline-flex">
          Back to home
        </Link>
      </div>
    </AuthPageShell>
  )
}

export default NotFoundPage


