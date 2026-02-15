import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ForgotPasswordPage from './ForgotPasswordPage'

vi.mock('../../features/auth/api/authApi', () => {
  return {
    authApi: {
      forgotPassword: vi.fn(),
      resendForgotPasswordOtp: vi.fn(),
      verifyForgotPasswordOtp: vi.fn(),
    },
  }
})

const { authApi } = await import('../../features/auth/api/authApi')

function renderAtForgotPassword() {
  return render(
    <MemoryRouter initialEntries={['/auth/forgot-password']}>
      <Routes>
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
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
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
  }
}

describe('ForgotPasswordPage - Resend OTP Cooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    authApi.forgotPassword.mockReset()
    authApi.resendForgotPasswordOtp.mockReset()
    authApi.verifyForgotPasswordOtp.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts a 5s countdown immediately on resend click and re-enables after 5 seconds', async () => {
    authApi.forgotPassword.mockResolvedValue({ success: true, data: { resendCooldownSeconds: 5 } })

    renderAtForgotPassword()

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /^Send OTP$/i }))

    await act(async () => {
      await Promise.resolve()
    })

    const resendBtn = screen.getByRole('button', { name: /Resend OTP/i })
    expect(resendBtn).toBeDisabled()
    expect(resendBtn).toHaveTextContent(/Resend OTP \(5s\)/i)

    await advanceCountdown(5)
    expect(resendBtn).toBeEnabled()
    expect(resendBtn).toHaveTextContent(/^Resend OTP$/i)

    const deferred = createDeferred()
    authApi.resendForgotPasswordOtp.mockReturnValue(deferred.promise)

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
