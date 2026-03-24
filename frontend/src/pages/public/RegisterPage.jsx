import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AuthPageShell from '../../components/auth/AuthPageShell'
import FormField from '../../components/ui/FormField'
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
    if (cooldownSeconds <= 0) return undefined
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
      setErrorMessage(error?.response?.data?.message || 'Registration failed. Check the form and try again.')
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
      setMessage('Account verified successfully. You can now sign in.')
      setStep('done')
    } catch (error) {
      setErrorMessage(error?.response?.data?.message || 'OTP verification failed. Check the code and try again.')
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
    <AuthPageShell
      kicker="Create Account"
      title="Start with a verified account, then move into the gym workflow."
      description="Registration uses the documented OTP flow: create account details first, verify by email second."
      asideItems={[
        'OTP expires after 2 minutes.',
        'Resend cooldown is 5 seconds.',
        'Resending invalidates the previous OTP.',
      ]}
      footer={(
        <p className="text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/auth/login" className="font-semibold text-gym-300 hover:text-white">
            Sign in
          </Link>
        </p>
      )}
    >
      {step === 'register' ? (
        <form onSubmit={handleStartRegistration} className="space-y-5">
          <FormField id="register-full-name" label="Full name" required>
            <input id="register-full-name" name="fullName" autoComplete="name" value={registerForm.fullName} onChange={handleRegisterChange} className="gc-input" required />
          </FormField>

          <FormField id="register-email" label="Email address" required>
            <input id="register-email" type="email" name="email" autoComplete="email" inputMode="email" spellCheck={false} value={registerForm.email} onChange={handleRegisterChange} className="gc-input" placeholder="name@example.com" required />
          </FormField>

          <FormField id="register-phone" label="Phone" hint="Phone uniqueness is normalized by the system.">
            <input id="register-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" value={registerForm.phone} onChange={handleRegisterChange} className="gc-input" placeholder="0901234567" />
          </FormField>

          <FormField id="register-password" label="Password" hint="Minimum 8 chars with uppercase, number, and special character." required>
            <input id="register-password" aria-label="Password" type="password" name="password" autoComplete="new-password" value={registerForm.password} onChange={handleRegisterChange} className="gc-input" required />
          </FormField>

          <FormField id="register-confirm-password" label="Confirm password" required>
            <input id="register-confirm-password" type="password" name="confirmPassword" autoComplete="new-password" value={registerForm.confirmPassword} onChange={handleRegisterChange} className="gc-input" required />
          </FormField>

          {errorMessage ? <div role="alert" className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-200">{errorMessage}</div> : null}
          {message ? <div aria-live="polite" className="rounded-[20px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-100">{message}</div> : null}

          <button type="submit" disabled={isSubmitting} className="gc-button-primary w-full">
            {isSubmitting ? 'Sending OTP...' : 'Register'}
          </button>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form onSubmit={handleVerifyOtp} className="space-y-5">
          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-300">
            Enter the 6-digit OTP sent to <span className="font-semibold text-white">{registerForm.email}</span>.
          </div>

          <FormField id="register-otp" label="OTP code" required>
            <input id="register-otp" name="otp" inputMode="numeric" autoComplete="one-time-code" spellCheck={false} value={otp} onChange={(event) => setOtp(event.target.value)} className="gc-input" maxLength={6} placeholder="123456" required />
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

      {step === 'done' ? (
        <div className="rounded-[20px] border border-emerald-400/20 bg-emerald-400/10 px-5 py-4 text-sm leading-7 text-emerald-100">
          Registration is complete. Move to login and continue with your verified account.
        </div>
      ) : null}
    </AuthPageShell>
  )
}

export default RegisterPage


