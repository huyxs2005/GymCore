import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LandingPage from './LandingPage'

vi.mock('../../features/auth/useSession', () => ({
  useSession: vi.fn(),
}))

const { useSession } = await import('../../features/auth/useSession')

describe('LandingPage', () => {
  it('uses a role-specific CTA for authenticated customers without workspace wording', () => {
    useSession.mockReturnValue({
      isAuthenticated: true,
      user: { role: 'CUSTOMER', fullName: 'Customer Minh' },
    })

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /Go to Membership/i })).toHaveAttribute('href', '/customer/membership')
    expect(screen.queryByRole('link', { name: /Workspace/i })).not.toBeInTheDocument()
  })
})
