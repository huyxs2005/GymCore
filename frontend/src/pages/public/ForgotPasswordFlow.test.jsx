import { describe, expect, it, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ForgotPasswordPage from './ForgotPasswordPage'
import ForgotPasswordResetPage from './ForgotPasswordResetPage'

vi.mock('../../features/auth/api/authApi', () => {
  return {
    authApi: {
      forgotPassword: vi.fn(),
      resendForgotPasswordOtp: vi.fn(),
      verifyForgotPasswordOtp: vi.fn(),
      resetForgotPassword: vi.fn(),
    },
  }
})

const { authApi } = await import('../../features/auth/api/authApi')

function renderFlowAtForgotPassword() {
  return render(
    <MemoryRouter initialEntries={['/auth/forgot-password']}>
      <Routes>
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/forgot-password/reset" element={<ForgotPasswordResetPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Forgot password flow', () => {
  beforeEach(() => {
    authApi.forgotPassword.mockReset()
    authApi.verifyForgotPasswordOtp.mockReset()
  })

  it('does not show new password fields until OTP is verified, then redirects to reset page', async () => {
    authApi.forgotPassword.mockResolvedValue({ success: true, data: { resendCooldownSeconds: 5 } })
    authApi.verifyForgotPasswordOtp.mockResolvedValue({ success: true, data: { verified: true } })

    renderFlowAtForgotPassword()

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /^Send OTP$/i }))

    await act(async () => {
      await Promise.resolve()
    })

    // Still on verify step: only OTP is visible, no password inputs.
    expect(screen.getByLabelText(/^OTP$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/New password/i)).toBeNull()
    expect(screen.queryByLabelText(/Confirm password/i)).toBeNull()

    fireEvent.change(screen.getByLabelText(/^OTP$/i), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /^Verify OTP$/i }))

    await act(async () => {
      await Promise.resolve()
    })

    // Redirected to reset page, now password inputs exist.
    expect(await screen.findByRole('heading', { name: /Reset password/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/New password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Confirm password/i)).toBeInTheDocument()
  })
})
