import { Link, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { authApi } from '../../features/auth/api/authApi'
import { persistSession, roleLandingPath } from '../../features/auth/session'

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
      const destination = data.landingPath || roleLandingPath(data.user.role)
      navigate(destination, { replace: true })
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
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-2xl font-bold text-slate-900">Login</h1>
      <p className="mt-2 text-sm text-slate-600">Sign in with email/password or Google.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
        <label className="block text-sm">
          <span className="mb-1 block text-slate-700">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </label>
        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-gym-500 px-4 py-2 font-semibold text-white hover:bg-gym-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Signing in...' : 'Login'}
        </button>
      </form>

      <div className="mt-3">
        {hasGoogleClientId ? (
          <div ref={googleButtonRef} className="flex justify-center" />
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Google login is disabled. Set <code>VITE_GOOGLE_CLIENT_ID</code> to enable it.
          </p>
        )}
      </div>

      <div className="mt-4 flex justify-between text-sm">
        <Link to="/auth/forgot-password" className="text-gym-700 hover:underline">
          Forgot password
        </Link>
        <Link to="/auth/register" className="text-gym-700 hover:underline">
          Create account
        </Link>
      </div>
    </div>
  )
}

export default LoginPage
