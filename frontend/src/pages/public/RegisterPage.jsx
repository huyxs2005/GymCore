import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { authApi } from '../../features/auth/api/authApi'

function RegisterPage() {
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  })
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('register')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return undefined
    }
    const timer = setTimeout(() => setCooldownSeconds((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldownSeconds])

  function handleRegisterChange(event) {
    setRegisterForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }))
  }

  async function handleStartRegistration(event) {
    event.preventDefault()
    try {
      setIsSubmitting(true)
      setErrorMessage('')
      setMessage('')

      const response = await authApi.register(registerForm)
      const data = response?.data || {}
      setStep('verify')
      setCooldownSeconds(Number(data.resendCooldownSeconds || 5))
      setMessage('OTP sent to your email. Enter it to complete registration.')
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'Registration failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleVerifyOtp(event) {
    event.preventDefault()
    try {
      setIsSubmitting(true)
      setErrorMessage('')
      setMessage('')

      await authApi.verifyRegisterOtp({
        email: registerForm.email,
        otp,
      })
      setMessage('Account verified successfully. You can now login.')
      setStep('done')
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'OTP verification failed.')
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

      const response = await authApi.resendRegisterOtp({ email: registerForm.email })
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

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
      <p className="mt-2 text-sm text-slate-600">Register with email/password, then verify OTP from Gmail.</p>

      {step === 'register' ? (
        <form
          onSubmit={handleStartRegistration}
          className="mt-6 space-y-4 gc-card"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">Full name</span>
            <input
              name="fullName"
              value={registerForm.fullName}
              onChange={handleRegisterChange}
              className="gc-input"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">Email</span>
            <input
              type="email"
              name="email"
              value={registerForm.email}
              onChange={handleRegisterChange}
              className="gc-input"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">Phone</span>
            <input
              name="phone"
              value={registerForm.phone}
              onChange={handleRegisterChange}
              className="gc-input"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">Password</span>
            <input
              type="password"
              name="password"
              value={registerForm.password}
              onChange={handleRegisterChange}
              className="gc-input"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">Confirm password</span>
            <input
              type="password"
              name="confirmPassword"
              value={registerForm.confirmPassword}
              onChange={handleRegisterChange}
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
            {isSubmitting ? 'Sending OTP...' : 'Register'}
          </button>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form
          onSubmit={handleVerifyOtp}
          className="mt-6 space-y-4 gc-card"
        >
          <p className="text-sm text-slate-600">Enter the 6-digit OTP sent to {registerForm.email}.</p>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-700">OTP</span>
            <input
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              className="gc-input"
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
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Registration complete. Please login with your email and password.
        </div>
      ) : null}

      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{' '}
        <Link to="/auth/login" className="font-semibold text-gym-700 hover:underline">
          Login
        </Link>
      </p>
    </div>
  )
}

export default RegisterPage
