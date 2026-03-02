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
    <div className="mx-auto max-w-xl px-6 py-24">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-gym-dark-900 tracking-tight mb-4">Create Account</h1>
        <p className="text-gym-dark-400 font-bold text-lg">Join GymCore and start your transformation</p>
      </div>

      {step === 'register' ? (
        <form onSubmit={handleStartRegistration} className="space-y-6 gc-card p-10">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Full Name</span>
              <input
                name="fullName"
                value={registerForm.fullName}
                onChange={handleRegisterChange}
                className="gc-input"
                placeholder="John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Phone Number</span>
              <input
                name="phone"
                value={registerForm.phone}
                onChange={handleRegisterChange}
                className="gc-input"
                placeholder="0901234567"
              />
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Email Address</span>
            <input
              type="email"
              name="email"
              value={registerForm.email}
              onChange={handleRegisterChange}
              className="gc-input"
              placeholder="name@example.com"
              required
            />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Password</span>
              <input
                type="password"
                name="password"
                value={registerForm.password}
                onChange={handleRegisterChange}
                className="gc-input"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Confirm Password</span>
              <input
                type="password"
                name="confirmPassword"
                value={registerForm.confirmPassword}
                onChange={handleRegisterChange}
                className="gc-input"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          {errorMessage ? <p className="text-sm font-bold text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">{errorMessage}</p> : null}
          {message ? <p className="text-sm font-bold text-emerald-700 bg-emerald-50 p-4 rounded-xl border border-emerald-100">{message}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full py-4 text-lg"
          >
            {isSubmitting ? 'Sending OTP...' : 'Create Account'}
          </button>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form onSubmit={handleVerifyOtp} className="space-y-6 gc-card p-10">
          <div className="text-center">
            <p className="text-gym-dark-400 font-bold mb-6 text-sm">Enter the 6-digit OTP sent to <span className="text-gym-dark-900">{registerForm.email}</span></p>
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
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Registration complete. Please login with your email and password.
        </div>
      ) : null}

      <p className="mt-10 text-center text-gym-dark-400 font-bold">
        Already have an account?{' '}
        <Link to="/auth/login" className="text-gym-500 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}

export default RegisterPage
