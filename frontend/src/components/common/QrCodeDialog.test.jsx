import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import QrCodeDialog from './QrCodeDialog'

vi.mock('../../features/auth/api/authApi', () => {
  return {
    authApi: {
      getMyQrToken: vi.fn(),
    },
  }
})

vi.mock('qrcode', () => {
  return {
    toDataURL: vi.fn(async () => 'data:image/png;base64,QR'),
  }
})

const { authApi } = await import('../../features/auth/api/authApi')

describe('QrCodeDialog', () => {
  beforeEach(() => {
    authApi.getMyQrToken.mockReset()
  })

  it('loads and displays QR image when opened', async () => {
    const user = userEvent.setup()
    authApi.getMyQrToken.mockResolvedValue({ success: true, data: { qrCodeToken: 'QR_TOKEN_123' } })

    render(<QrCodeDialog open onClose={vi.fn()} />)

    expect(await screen.findByText(/Your Check-in QR/i)).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: /QR code/i })).toHaveAttribute('src', 'data:image/png;base64,QR')

    // Close button exists and works.
    await user.click(screen.getByRole('button', { name: /Close/i }))
  })

  it('shows an error if the API fails', async () => {
    authApi.getMyQrToken.mockRejectedValue({ response: { data: { message: 'Unauthorized' } } })
    render(<QrCodeDialog open onClose={vi.fn()} />)
    expect(await screen.findByText('Unauthorized')).toBeInTheDocument()
  })
})

