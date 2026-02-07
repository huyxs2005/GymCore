import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { authApi } from '../../features/auth/api/authApi'

function ProfilePage() {
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: authApi.getProfile,
  })

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
      <p className="mt-2 text-sm text-slate-600">Starter page for view/edit profile use-case.</p>
      <div className="mt-3 flex gap-3 text-sm">
        <Link to="/auth/change-password" className="font-semibold text-gym-700 hover:underline">
          Change password
        </Link>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {profileQuery.isLoading && <p className="text-sm text-slate-600">Loading profile...</p>}
        {profileQuery.isError && (
          <p className="text-sm text-rose-700">Profile API not ready yet. Continue implementing backend auth/profile.</p>
        )}
        {profileQuery.isSuccess && (
          <pre className="overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
            {JSON.stringify(profileQuery.data, null, 2)}
          </pre>
        )}
      </section>
    </div>
  )
}

export default ProfilePage
