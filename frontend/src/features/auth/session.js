const ACCESS_TOKEN_KEY = 'gymcore_access_token'
const AUTH_USER_KEY = 'gymcore_auth_user'
const SESSION_EVENT = 'gymcore_session_change'

function notifySessionChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token) {
  if (!token) {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    notifySessionChange()
    return
  }
  localStorage.setItem(ACCESS_TOKEN_KEY, token)
  notifySessionChange()
}

export function getAuthUser() {
  const raw = localStorage.getItem(AUTH_USER_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(AUTH_USER_KEY)
    return null
  }
}

export function setAuthUser(user) {
  if (!user) {
    localStorage.removeItem(AUTH_USER_KEY)
    notifySessionChange()
    return
  }
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
  notifySessionChange()
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
  notifySessionChange()
}

export function persistSession(data) {
  setAccessToken(data?.accessToken)
  setAuthUser(data?.user || null)
}

export function subscribeSession(callback) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const onCustom = () => callback()
  const onStorage = (event) => {
    if (event.key === ACCESS_TOKEN_KEY || event.key === AUTH_USER_KEY) {
      callback()
    }
  }

  window.addEventListener(SESSION_EVENT, onCustom)
  window.addEventListener('storage', onStorage)

  return () => {
    window.removeEventListener(SESSION_EVENT, onCustom)
    window.removeEventListener('storage', onStorage)
  }
}

export function roleLandingPath(role) {
  switch ((role || '').toUpperCase()) {
    case 'CUSTOMER':
      return '/customer/membership'
    case 'COACH':
      return '/coach/schedule'
    case 'RECEPTIONIST':
      return '/reception/checkin'
    case 'ADMIN':
      return '/admin/dashboard'
    default:
      return '/'
  }
}
