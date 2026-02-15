import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthHeaderActions from './AuthHeaderActions'
import { clearSession, persistSession } from '../../features/auth/session'

function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('AuthHeaderActions', () => {
  beforeEach(() => {
    clearSession()
  })

  it('shows Login/Register when not authenticated', () => {
    renderWithRouter(<AuthHeaderActions />)
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.getByText('Register')).toBeInTheDocument()
  })

  it('shows account menu when authenticated', () => {
    persistSession({
      accessToken: 'token',
      user: { fullName: 'Trần Minh Huy', email: 'kironinja2015@gmail.com', role: 'CUSTOMER' },
    })

    renderWithRouter(<AuthHeaderActions />)
    expect(screen.getByText('Trần Minh Huy')).toBeInTheDocument()
    expect(screen.queryByText('Login')).toBeNull()
    expect(screen.queryByText('Register')).toBeNull()
  })
})

