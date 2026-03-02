import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AccountMenu from './AccountMenu'
import { clearSession, setAccessToken, setAuthUser } from '../../features/auth/session'

describe('AccountMenu', () => {
  beforeEach(() => {
    act(() => clearSession())
  })

  afterEach(() => {
    act(() => clearSession())
  })

  it('shows customer-only account actions only for CUSTOMER', async () => {
    const user = userEvent.setup()
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 1,
        fullName: 'Alex Carter',
        email: 'kironinja2015@gmail.com',
        role: 'CUSTOMER',
        avatarUrl: '',
        avatarSource: 'GOOGLE',
      })
    })

    render(
      <MemoryRouter>
        <AccountMenu />
      </MemoryRouter>,
    )

    const toggle = screen.getByRole('button', { name: /Alex Carter/i })
    await act(async () => {
      await user.click(toggle)
    })

    expect(screen.getByText('View profile')).toBeInTheDocument()
    expect(screen.getByText('Current membership')).toBeInTheDocument()
    expect(screen.getByText('QR code')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()

    // Switch to a staff user and ensure QR is not present.
    act(() => {
      setAuthUser({
        userId: 2,
        fullName: 'Coach Alex',
        email: 'coach@gymcore.local',
        role: 'COACH',
        avatarUrl: '',
        avatarSource: 'GOOGLE',
      })
    })

    // Close and reopen to reflect new role.
    await act(async () => {
      await user.click(toggle)
      await user.click(toggle)
    })

    expect(screen.getByText('View profile')).toBeInTheDocument()
    expect(screen.queryByText('Current membership')).toBeNull()
    expect(screen.queryByText('QR code')).toBeNull()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })
})
