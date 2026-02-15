import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
    if (cooldownSeconds <= 0) {
      return undefined
    }
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
      setErrorMessage(error?.response?.data?.message || 'Could not send OTP.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendOtp() {
    if (cooldownSeconds > 0 || isResending) {
      return
    }
    try {
      setIsResending(true)
      setErrorMessage('')
      setMessage('')

      // Start the 5s countdown immediately (even if the network is slow).
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

      // Redirect to the reset-password step only after OTP is verified.
      navigate('/auth/forgot-password/reset', {
        replace: true,
        state: { email, otp },
      })
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'OTP verification failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-bold text-slate-900">Forgot password</h1>
      <p className="mt-2 text-sm text-slate-600">Request OTP, then confirm OTP and set your new password.</p>

      {step === 'request' ? (
        <form onSubmit={handleRequestOtp} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-gym-500 px-4 py-2 font-semibold text-white hover:bg-gym-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Enter the 6-digit OTP sent to {email}.</p>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">OTP</span>
            <input
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              maxLength={6}
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
            {isSubmitting ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={cooldownSeconds > 0 || isResending}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cooldownSeconds > 0 ? `Resend OTP (${cooldownSeconds}s)` : 'Resend OTP'}
          </button>
        </form>
      ) : null}

      {step === 'done' ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</div>
      ) : null}
    </div>
  )
}

export default ForgotPasswordPage
