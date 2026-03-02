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
    <div className="mx-auto max-w-xl px-6 py-24">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-gym-dark-900 tracking-tight mb-4">Set New Password</h1>
        <p className="text-gym-dark-400 font-bold text-lg">Choose a strong password to secure your account</p>
      </div>

      {!canReset ? (
        <div className="gc-card p-10 text-center space-y-6">
          <p className="text-gym-dark-400 font-bold">
            Please verify your OTP first before resetting your password.
          </p>
          <Link
            to="/auth/forgot-password"
            className="btn-primary inline-block"
          >
            Back to Verification
          </Link>
        </div>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-6 gc-card p-10">
          <div className="text-center">
            <p className="text-gym-dark-400 font-bold mb-6 text-sm">Resetting password for <span className="text-gym-dark-900">{email}</span></p>
          </div>
          <div className="space-y-2">
            <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">New Password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="gc-input"
              placeholder="••••••••"
              required
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Confirm New Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="gc-input"
              placeholder="••••••••"
              required
            />
          </div>
          {errorMessage ? <p className="text-sm font-bold text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">{errorMessage}</p> : null}
          {message ? <p className="text-sm font-bold text-emerald-700 bg-emerald-50 p-4 rounded-xl border border-emerald-100">{message}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-4 text-lg"
          >
            {isSubmitting ? 'Resetting...' : 'Update Password'}
          </button>
        </form>
      )}
    </div>
  )
}

export default ForgotPasswordResetPage

