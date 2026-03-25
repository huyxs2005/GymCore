import { useSyncExternalStore } from 'react'
import { getAccessToken, getAuthUser, subscribeSession } from './session'

let lastToken = null
let lastUserJson = null
let lastSnapshot = { accessToken: null, user: null }

function getSnapshot() {
  const accessToken = getAccessToken()
  const user = getAuthUser()

  // useSyncExternalStore compares snapshots with Object.is(). Returning a new object every
  // time (even with identical values) can cause infinite update loops in React 19.
  const userJson = user ? JSON.stringify(user) : null
  if (accessToken === lastToken && userJson === lastUserJson) {
    return lastSnapshot
  }

  lastToken = accessToken
  lastUserJson = userJson
  lastSnapshot = { accessToken, user }
  return lastSnapshot
}

export function useSession() {
  const state = useSyncExternalStore(subscribeSession, getSnapshot, getSnapshot)
  return {
    accessToken: state.accessToken,
    user: state.user,
    isAuthenticated: Boolean(state.accessToken && state.user),
  }
}
