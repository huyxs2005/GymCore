import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearSession, getAccessToken, getAuthUser, setAccessToken, setAuthUser, subscribeSession } from './session'

describe('auth session', () => {
  beforeEach(() => {
    clearSession()
  })

  it('stores and loads access token', () => {
    expect(getAccessToken()).toBeNull()
    setAccessToken('abc')
    expect(getAccessToken()).toBe('abc')
  })

  it('stores and loads auth user', () => {
    expect(getAuthUser()).toBeNull()
    setAuthUser({ fullName: 'Nguyễn Văn Minh', email: 'a@gymcore.local' })
    expect(getAuthUser()?.fullName).toBe('Nguyễn Văn Minh')
  })

  it('notifies subscribers when session changes', () => {
    const cb = vi.fn()
    const unsubscribe = subscribeSession(cb)
    setAccessToken('token')
    setAuthUser({ fullName: 'User', email: 'u@gymcore.local' })
    unsubscribe()
    expect(cb).toHaveBeenCalled()
  })
})

