import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RegisterPage from './RegisterPage'

vi.mock('../../features/auth/api/authApi', () => {
  return {
    authApi: {
      register: vi.fn(),
      verifyRegisterOtp: vi.fn(),
      resendRegisterOtp: vi.fn(),
    },
  }
})

const { authApi } = await import('../../features/auth/api/authApi')

function renderAtRegister() {
  return render(
    <MemoryRouter initialEntries={['/auth/register']}>
      <Routes>
        <Route path="/auth/register" element={<RegisterPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function createDeferred() {
  /** @type {{ promise: Promise<any>, resolve: (v:any)=>void, reject:(e:any)=>void }} */
  const deferred = {}
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve
    deferred.reject = reject
  })
  return deferred
}

async function advanceCountdown(seconds) {
  for (let i = 0; i < seconds; i += 1) {
    // The component schedules the next tick from a useEffect, so we need to step timers 1s at a time.
    // Advancing all at once won't reliably re-run effects between ticks under fake timers.
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
  }
}

describe('RegisterPage - Resend OTP Cooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    authApi.register.mockReset()
    authApi.verifyRegisterOtp.mockReset()
    authApi.resendRegisterOtp.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts a 5s countdown immediately on resend click and re-enables after 5 seconds', async () => {
    authApi.register.mockResolvedValue({ success: true, data: { resendCooldownSeconds: 5 } })

    renderAtRegister()

    fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: 'Alex Carter' } })
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText(/^Phone$/i), { target: { value: '0901234567' } })
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /^Register$/i }))

    await act(async () => {
      await Promise.resolve()
    })

    // In verify step, initial cooldown starts from backend response.
    const resendBtn = screen.getByRole('button', { name: /Resend OTP/i })
    expect(resendBtn).toBeDisabled()
    expect(resendBtn).toHaveTextContent(/Resend OTP \(5s\)/i)

    await advanceCountdown(5)
    expect(resendBtn).toBeEnabled()
    expect(resendBtn).toHaveTextContent(/^Resend OTP$/i)

    // Now click resend. UI should start countdown immediately (even before API resolves).
    const deferred = createDeferred()
    authApi.resendRegisterOtp.mockReturnValue(deferred.promise)

    fireEvent.click(resendBtn)
    expect(resendBtn).toBeDisabled()
    expect(resendBtn).toHaveTextContent(/Resend OTP \(5s\)/i)

    await advanceCountdown(1)
    expect(resendBtn).toHaveTextContent(/Resend OTP \(4s\)/i)

    deferred.resolve({ success: true, data: { resendCooldownSeconds: 5 } })
    await act(async () => {
      await deferred.promise
    })

    await advanceCountdown(4)
    expect(resendBtn).toBeEnabled()
    expect(resendBtn).toHaveTextContent(/^Resend OTP$/i)
  })
})
