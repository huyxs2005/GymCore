import { Link, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { authApi } from '../../features/auth/api/authApi'
import { persistSession } from '../../features/auth/session'

function LoginPage() {
  const navigate = useNavigate()
  const googleButtonRef = useRef(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAuthSuccess = useCallback(
    (response) => {
      const data = response?.data
      if (!data?.accessToken || !data?.user?.role) {
        throw new Error('Auth response is missing access token or role.')
      }

      persistSession(data)
      navigate('/', { replace: true })
    },
    [navigate],
  )

  const handleGoogleCredential = useCallback(
    async (credentialResponse) => {
      if (!credentialResponse?.credential) {
        return
      }
      try {
        setErrorMessage('')
        const response = await authApi.loginWithGoogle({ idToken: credentialResponse.credential })
        handleAuthSuccess(response)
      } catch (error) {
        const message = error?.response?.data?.message || 'Google login failed.'
        setErrorMessage(message)
      }
    },
    [handleAuthSuccess],
  )

  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!googleClientId) {
      return
    }

    let isCancelled = false
    const initializeGoogleButton = () => {
      if (isCancelled || !window.google?.accounts?.id || !googleButtonRef.current) {
        return
      }

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
      const message = error?.response?.data?.message || 'Login failed.'
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasGoogleClientId = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="gc-section-kicker">Welcome Back</p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-white">Login</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to manage your gym workspace</p>
        </div>

        <div className="gc-glass-panel p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="gc-input"
                placeholder="name@example.com"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="gc-input"
                placeholder="••••••••"
                required
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="gc-button-primary w-full"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs font-semibold uppercase tracking-widest">
                <span className="bg-[#12121a] px-3 text-slate-500">Or continue with</span>
              </div>
            </div>

            {hasGoogleClientId ? (
              <div ref={googleButtonRef} className="flex justify-center overflow-hidden rounded-xl border border-white/10 transition hover:border-white/20" />
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-center">
                <p className="text-xs font-medium text-amber-500/80 leading-relaxed">
                  Google authentication is currently unavailable for this workspace.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6 text-sm">
            <Link to="/auth/forgot-password" title="Recover your account password" className="font-medium text-slate-400 transition hover:text-gym-400">
              Forgot password?
            </Link>
            <Link to="/auth/register" title="Create a new gym core account" className="font-bold text-gym-500 transition hover:text-gym-400 hover:underline">
              Create account
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs tracking-wide text-slate-600">
          GymCore Workspace &bull; v2.4.0
        </p>
      </div>
    </div>
  )
}

export default LoginPage
