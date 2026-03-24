import { Link, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import AuthPageShell from '../../components/auth/AuthPageShell'
import FormField from '../../components/ui/FormField'
import { authApi } from '../../features/auth/api/authApi'
import { persistSession } from '../../features/auth/session'

function LoginPage() {
  const navigate = useNavigate()
  const googleButtonRef = useRef(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAuthSuccess = useCallback((response) => {
    const data = response?.data
    if (!data?.accessToken || !data?.user?.role) {
      throw new Error('Auth response is missing access token or role.')
    }

    persistSession(data)
    navigate('/', { replace: true })
  }, [navigate])

  const handleGoogleCredential = useCallback(async (credentialResponse) => {
    if (!credentialResponse?.credential) return

    try {
      setErrorMessage('')
      const response = await authApi.loginWithGoogle({ idToken: credentialResponse.credential })
      handleAuthSuccess(response)
    } catch (error) {
      const message = error?.response?.data?.message || 'Google login failed. Check the Google configuration and try again.'
      setErrorMessage(message)
    }
  }, [handleAuthSuccess])

  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!googleClientId) return undefined

    let isCancelled = false
    const initializeGoogleButton = () => {
      if (isCancelled || !window.google?.accounts?.id || !googleButtonRef.current) return

      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleCredential,
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 380,
      })
    }

    if (window.google?.accounts?.id) {
      initializeGoogleButton()
      return () => {
        isCancelled = true
      }
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initializeGoogleButton
    document.head.appendChild(script)

    return () => {
      isCancelled = true
    }
  }, [handleGoogleCredential])

  async function handleSubmit(event) {
    event.preventDefault()
    try {
      setIsSubmitting(true)
      setErrorMessage('')
      const response = await authApi.login({ email, password })
      handleAuthSuccess(response)
    } catch (error) {
      const message = error?.response?.data?.message || 'Login failed. Verify your email, password, and account status.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

  return (
    <AuthPageShell
      kicker="Welcome Back"
      title="Enter the workspace & continue your routine."
      description="Sign in with email and password, or use Google if your role supports it."
      asideItems={[
        'Email and Google login stay inside the same session model.',
        'Customer, coach, and receptionist can use Google login.',
        'Admin remains email and password only.',
      ]}
      footer={(
        <p className="text-sm text-slate-500">
          Need a new account?{' '}
          <Link to="/auth/register" className="font-semibold text-gym-300 hover:text-white">
            Create one here
          </Link>
        </p>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField id="login-email" label="Email address" required>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="gc-input"
            placeholder="name@example.com"
            required
          />
        </FormField>

        <FormField id="login-password" label="Password" required>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="gc-input"
            placeholder="Enter your password..."
            required
          />
        </FormField>

        {errorMessage ? (
          <div role="alert" className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        <button type="submit" disabled={isSubmitting} className="gc-button-primary w-full">
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
              Signing in...
            </span>
        ) : 'Login'}
        </button>
      </form>

      <div className="mt-8 space-y-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-[0.7rem] font-bold uppercase tracking-[0.24em] text-slate-500">
            <span className="bg-[rgba(12,18,36,0.96)] px-3">Or continue with</span>
          </div>
        </div>

        {hasGoogleClientId ? (
          <div ref={googleButtonRef} className="flex justify-center overflow-hidden rounded-[20px] border border-white/10 px-2 py-3" />
        ) : (
          <div className="rounded-[20px] border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
            Google authentication is unavailable in this local environment. Use email and password for now.
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-5 text-sm text-slate-500">
          <Link to="/auth/forgot-password" className="font-semibold text-slate-400 hover:text-white">
            Forgot password?
          </Link>
          <p>Access expires safely when the session expires.</p>
        </div>
      </div>
    </AuthPageShell>
  )
}

export default LoginPage


