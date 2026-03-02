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
    <div className="mx-auto max-w-xl px-6 py-24">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-gym-dark-900 tracking-tight mb-4">Welcome Back</h1>
        <p className="text-gym-dark-400 font-bold text-lg">Enter your details to access your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 gc-card p-10">
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
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-black uppercase tracking-widest text-gym-dark-400">Password</span>
            <Link to="/auth/forgot-password" size="sm" className="text-xs font-black text-gym-500 hover:text-gym-600">
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="gc-input"
            placeholder="••••••••"
            required
          />
        </div>
        {errorMessage ? <p className="text-sm font-bold text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">{errorMessage}</p> : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full py-4 text-lg"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-8">
        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gym-dark-100"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gym-dark-300 font-black">Or continue with</span></div>
        </div>

        {hasGoogleClientId ? (
          <div ref={googleButtonRef} className="flex justify-center" />
        ) : (
          <p className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 font-bold text-center">
            Google login is currently unavailable
          </p>
        )}
      </div>

      <p className="mt-10 text-center text-gym-dark-400 font-bold">
        Don't have an account?{' '}
        <Link to="/auth/register" className="text-gym-500 hover:underline">
          Sign up for free
        </Link>
      </p>
    </div>
  )
}

export default LoginPage

