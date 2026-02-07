import { useState } from 'react'
import { authApi } from '../../features/auth/api/authApi'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    await authApi.forgotPassword({ email })
    alert('Forgot-password API wired. Continue with reset token flow.')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-bold text-slate-900">Forgot password</h1>
      <p className="mt-2 text-sm text-slate-600">Send reset email via backend `forgot-password` endpoint.</p>

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
        <button type="submit" className="w-full rounded-lg bg-gym-500 px-4 py-2 font-semibold text-white hover:bg-gym-700">
          Send reset email
        </button>
      </form>
    </div>
  )
}

export default ForgotPasswordPage
