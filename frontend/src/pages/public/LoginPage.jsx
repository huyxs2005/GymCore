import { Link } from 'react-router-dom'
import { useState } from 'react'
import { authApi } from '../../features/auth/api/authApi'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    await authApi.login({ email, password })
    alert('Login API wired. Replace alert with real auth flow.')
  }

  async function handleGoogleLogin() {
    await authApi.loginWithGoogle({ provider: 'GOOGLE' })
    alert('Google login endpoint wired.')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-bold text-slate-900">Login</h1>
      <p className="mt-2 text-sm text-slate-600">Use this page for Email/Password and Google login integration.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <button type="submit" className="w-full rounded-lg bg-gym-500 px-4 py-2 font-semibold text-white hover:bg-gym-700">
          Login
        </button>
      </form>

      <button
        type="button"
        onClick={handleGoogleLogin}
        className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Continue with Google
      </button>

      <div className="mt-4 flex justify-between text-sm">
        <Link to="/auth/forgot-password" className="text-gym-700 hover:underline">
          Forgot password
        </Link>
        <Link to="/auth/register" className="text-gym-700 hover:underline">
          Create account
        </Link>
      </div>
    </div>
  )
}

export default LoginPage
