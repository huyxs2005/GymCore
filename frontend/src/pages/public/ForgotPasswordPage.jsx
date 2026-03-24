import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthPageShell from '../../components/auth/AuthPageShell'
import FormField from '../../components/ui/FormField'
import { authApi } from '../../features/auth/api/authApi'

function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [step, setStep] = useState('request')

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined
    const timer = setTimeout(() => setCooldownSeconds((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldownSeconds])

  async function handleRequestOtp(event) {
    event.preventDefault()
    try {
      setIsSubmitting(true)
      setErrorMessage('')
      setMessage('')
      const response = await authApi.forgotPassword({ email })
      const data = response?.data || {}
      setStep('verify')
      setCooldownSeconds(Number(data.resendCooldownSeconds || 5))
      setMessage('OTP sent to your email.')
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Could not send OTP. Check the email and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendOtp() {
    if (cooldownSeconds > 0 || isResending) return

    try {
      setIsResending(true)
      setErrorMessage('')
      setMessage('')

      const startedAtMs = Date.now()
      setCooldownSeconds(5)

      const response = await authApi.resendForgotPasswordOtp({ email })
      const data = response?.data || {}
      const apiCooldown = Number(data.resendCooldownSeconds || 5)
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
      const remainingSeconds = Math.max(0, apiCooldown - elapsedSeconds)
      setCooldownSeconds((prev) => Math.max(prev, remainingSeconds))
      setMessage('A new OTP has been sent.')
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Could not resend OTP.')
    } finally {
      setIsResending(false)
    }
  }

  async function handleVerifyOtp(event) {
    event.preventDefault()
    try {
      setIsSubmitting(true)
      setErrorMessage('')
      setMessage('')
      await authApi.verifyForgotPasswordOtp({ email, otp })
      navigate('/auth/forgot-password/reset', {
        replace: true,
        state: { email, otp },
      })
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'OTP verification failed. Check the code and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthPageShell
      kicker="Password Recovery"
      title="Verify the OTP first, then reset the password."
      description="This follows the documented two-step forgot-password flow: request and verify OTP here, then continue to the reset screen."
      asideItems={[
        'Request OTP on this page.',
        'Verify OTP on this page.',
        'Set the new password only after OTP succeeds.',
      ]}
    >
      {step === 'request' ? (
        <form onSubmit={handleRequestOtp} className="space-y-5">
          <FormField id="forgot-email" label="Email address" required>
            <input id="forgot-email" type="email" autoComplete="email" inputMode="email" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} className="gc-input" placeholder="name@example.com" required />
          </FormField>
          {errorMessage ? <div role="alert" className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-200">{errorMessage}</div> : null}
          {message ? <div aria-live="polite" className="rounded-[20px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">{message}</div> : null}
          <button type="submit" disabled={isSubmitting} className="gc-button-primary w-full">
            {isSubmitting ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-300">
            Enter the 6-digit OTP sent to <span className="font-semibold text-white">{email}</span>.
          </div>
          <FormField id="forgot-otp" label="OTP" required>
            <input id="forgot-otp" aria-label="OTP" inputMode="numeric" autoComplete="one-time-code" spellCheck={false} value={otp} onChange={(event) => setOtp(event.target.value)} className="gc-input" maxLength={6} placeholder="123456" required />
          </FormField>
          {errorMessage ? <div role="alert" className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-200">{errorMessage}</div> : null}
          {message ? <div aria-live="polite" className="rounded-[20px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">{message}</div> : null}
          <button type="submit" disabled={isSubmitting} className="gc-button-primary w-full">
            {isSubmitting ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button type="button" onClick={handleResendOtp} disabled={cooldownSeconds > 0 || isResending} className="gc-button-secondary w-full">
            {cooldownSeconds > 0 ? `Resend OTP (${cooldownSeconds}s)` : 'Resend OTP'}
          </button>
        </form>
      ) : null}
    </AuthPageShell>
  )
}

export default ForgotPasswordPage


