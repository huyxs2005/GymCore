import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthPageShell from '../../components/auth/AuthPageShell'
import FormField from '../../components/ui/FormField'
import { authApi } from '../../features/auth/api/authApi'

function ForgotPasswordResetPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = location?.state?.email || ''
  const otp = location?.state?.otp || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canReset = Boolean(email) && Boolean(otp)

  async function handleResetPassword(event) {
    event.preventDefault()
    if (!canReset) return

    try {
      setIsSubmitting(true)
      setErrorMessage('')
      await authApi.resetForgotPassword({
        email,
        otp,
        newPassword,
        confirmPassword,
      })
      navigate('/auth/login', { replace: true })
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Password reset failed. Check the form and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPageShell
      kicker="Reset Password"
      title="Reset password"
      description="This page should only be reached after the OTP has been verified on the previous screen."
      asideItems={[
        'OTP is validated before this screen opens.',
        'Reset uses the verified email and OTP pair from the previous step.',
      ]}
    >
      {!canReset ? (
        <div className="space-y-4 rounded-[20px] border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-7 text-amber-100">
          <p>Please verify your OTP first before opening the reset password step.</p>
          <Link to="/auth/forgot-password" className="gc-button-primary inline-flex">
            Back to forgot password
          </Link>
        </div>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-5">
          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-300">
            Resetting password for <span className="font-semibold text-white">{email}</span>.
          </div>

          <FormField id="reset-new-password" label="New password" hint="Use the same password policy as registration." required>
            <input id="reset-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="gc-input" required />
          </FormField>

          <FormField id="reset-confirm-password" label="Confirm password" required>
            <input id="reset-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="gc-input" required />
          </FormField>

          {errorMessage ? <div role="alert" className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-200">{errorMessage}</div> : null}

          <button type="submit" disabled={isSubmitting} className="gc-button-primary w-full">
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      )}
    </AuthPageShell>
  )
}

export default ForgotPasswordResetPage


