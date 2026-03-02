import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../../features/auth/api/authApi'
import { Check } from 'lucide-react'

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
    <div className="mx-auto max-w-xl px-6 py-24">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-gym-dark-900 tracking-tight mb-4">Reset Password</h1>
        <p className="text-gym-dark-400 font-bold text-lg">We'll help you get back into your account</p>
      </div>

      {step === 'request' ? (
        <form onSubmit={handleRequestOtp} className="space-y-6 gc-card p-10">
          <div className="space-y-2">
            <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="gc-input"
              placeholder="name@example.com"
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
            {isSubmitting ? 'Sending OTP...' : 'Send Reset OTP'}
          </button>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form onSubmit={handleVerifyOtp} className="space-y-6 gc-card p-10">
          <div className="text-center">
            <p className="text-gym-dark-400 font-bold mb-6 text-sm">Enter the 6-digit OTP sent to <span className="text-gym-dark-900">{email}</span></p>
          </div>
          <div className="space-y-2">
            <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">OTP Code</span>
            <input
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              className="gc-input text-center text-3xl tracking-[0.5em] font-black"
              maxLength={6}
              placeholder="000000"
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
            {isSubmitting ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={cooldownSeconds > 0 || isResending}
            className="w-full py-3 rounded-xl font-black text-gym-dark-400 hover:text-gym-dark-900 transition-colors disabled:opacity-50"
          >
            {cooldownSeconds > 0 ? `Resend OTP in ${cooldownSeconds}s` : 'Resend OTP'}
          </button>
        </form>
      ) : null}

      {step === 'done' ? (
        <div className="gc-card p-10 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} strokeWidth={3} />
          </div>
          <p className="text-emerald-800 font-bold">{message}</p>
        </div>
      ) : null}

      <div className="mt-10 text-center">
        <Link to="/auth/login" className="text-gym-dark-400 font-black hover:text-gym-500 transition-colors">
          Return to Sign In
        </Link>
      </div>
    </div>

  )
}

export default ForgotPasswordPage
