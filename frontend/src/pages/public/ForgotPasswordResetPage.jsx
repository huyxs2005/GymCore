import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../../features/auth/api/authApi'

function ForgotPasswordResetPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const email = location?.state?.email || ''
  const otp = location?.state?.otp || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canReset = Boolean(email) && Boolean(otp)

  async function handleResetPassword(event) {
    event.preventDefault()
    if (!canReset) {
      return
    }
    try {
      setIsSubmitting(true)
      setErrorMessage('')
      setMessage('')

      await authApi.resetForgotPassword({
        email,
        otp,
        newPassword,
        confirmPassword,
      })

      setMessage('Password reset successful. Please login with your new password.')

      // Small UX win: go back to login after success.
      navigate('/auth/login', { replace: true })
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Password reset failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-bold text-slate-900">Reset password</h1>
      <p className="mt-2 text-sm text-slate-600">Enter your new password.</p>

      {!canReset ? (
        <div className="mt-6 space-y-3 gc-card">
          <p className="text-sm text-slate-700">
            Please verify your OTP first.
          </p>
          <Link
            to="/auth/forgot-password"
            className="inline-flex items-center justify-center rounded-lg bg-gym-500 px-4 py-2 text-sm font-semibold text-white hover:bg-gym-700"
          >
            Back to forgot password
          </Link>
        </div>
      ) : (
        <form onSubmit={handleResetPassword} className="mt-6 space-y-4 gc-card">
          <p className="text-sm text-slate-600">Resetting password for {email}</p>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="gc-input"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="gc-input"
              required
            />
          </label>
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-gym-500 px-4 py-2 font-semibold text-white hover:bg-gym-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
      )}
    </div>
  )
}

export default ForgotPasswordResetPage

