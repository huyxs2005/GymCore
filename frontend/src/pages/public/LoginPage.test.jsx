import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoginPage from './LoginPage'
import { clearSession, getAccessToken, getAuthUser } from '../../features/auth/session'

vi.mock('../../features/auth/api/authApi', () => {
  return {
    authApi: {
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
    },
  }
})

const { authApi } = await import('../../features/auth/api/authApi')

function renderAtLogin() {
  return render(
    <MemoryRouter initialEntries={['/auth/login']}>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/customer/membership" element={<div>Customer Membership</div>} />
        <Route path="/coach/schedule" element={<div>Coach Schedule</div>} />
        <Route path="/reception/checkin" element={<div>Reception Checkin</div>} />
        <Route path="/admin/dashboard" element={<div>Admin Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  const originalClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  beforeEach(() => {
    act(() => clearSession())
    authApi.login.mockReset()
    authApi.loginWithGoogle.mockReset()
  })

  afterEach(() => {
    // Restore env and google stub between tests.
    import.meta.env.VITE_GOOGLE_CLIENT_ID = originalClientId
    delete window.google
    act(() => clearSession())
  })

  it('logs in with email/password and navigates to landingPath, persisting session', async () => {
    const user = userEvent.setup()
    authApi.login.mockResolvedValue({
      success: true,
      data: {
        accessToken: 'ACCESS',
        landingPath: '/customer/membership',
        user: { userId: 1, fullName: 'Alex Carter', email: 'a@b.com', role: 'CUSTOMER' },
      },
    })

    renderAtLogin()

    await user.type(screen.getByLabelText(/Email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/Password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /^Login$/i }))

    expect(await screen.findByText('Customer Membership')).toBeInTheDocument()
    expect(getAccessToken()).toBe('ACCESS')
    expect(getAuthUser()?.email).toBe('a@b.com')
  })

  it('shows backend error message when login fails', async () => {
    const user = userEvent.setup()
    authApi.login.mockRejectedValue({ response: { data: { message: 'Invalid email or password.' } } })

    renderAtLogin()

    await user.type(screen.getByLabelText(/Email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/Password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /^Login$/i }))

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
  })

  it('initializes Google button when client id exists and navigates on Google login success', async () => {
    const user = userEvent.setup()
    import.meta.env.VITE_GOOGLE_CLIENT_ID = 'google-client-id'

    let capturedCallback = null
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn((args) => {
            capturedCallback = args?.callback
          }),
          renderButton: vi.fn(),
        },
      },
    }

    authApi.loginWithGoogle.mockResolvedValue({
      success: true,
      data: {
        accessToken: 'ACCESS',
        landingPath: '/coach/schedule',
        user: { userId: 2, fullName: 'Coach Alex', email: 'coach@gymcore.local', role: 'COACH' },
      },
    })

    renderAtLogin()

    expect(window.google.accounts.id.initialize).toHaveBeenCalled()
    expect(window.google.accounts.id.renderButton).toHaveBeenCalled()

    // Simulate Google returning the credential.
    expect(typeof capturedCallback).toBe('function')
    await act(async () => {
      await capturedCallback({ credential: 'ID_TOKEN' })
    })

    expect(await screen.findByText('Coach Schedule')).toBeInTheDocument()
    expect(getAccessToken()).toBe('ACCESS')

    // Close any open timers/microtasks.
    await user.pointer([])
  })
})
