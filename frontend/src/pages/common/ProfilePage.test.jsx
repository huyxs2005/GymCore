import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ProfilePage from './ProfilePage'
import { clearSession, setAccessToken, setAuthUser } from '../../features/auth/session'

vi.mock('../../components/profile/AvatarCropDialog', () => {
  return {
    default: () => null,
  }
})

vi.mock('../../features/auth/api/authApi', () => {
  return {
    authApi: {
      getProfile: vi.fn(),
      updateProfile: vi.fn(),
    },
  }
})

const { authApi } = await import('../../features/auth/api/authApi')

function renderWithQuery(ui) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    act(() => clearSession())
    authApi.getProfile.mockReset()
    authApi.updateProfile.mockReset()
  })

  it('does not show the old Raw API payload debug section', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 1,
        fullName: 'Alex Carter',
        email: 'kironinja2015@gmail.com',
        phone: '',
        role: 'CUSTOMER',
        avatarUrl: '',
        avatarSource: 'GOOGLE',
      })
    })

    authApi.getProfile.mockResolvedValue({
      success: true,
      data: { user: { fullName: 'Alex Carter', email: 'kironinja2015@gmail.com', role: 'CUSTOMER' } },
    })

    renderWithQuery(<ProfilePage />)

    expect(await screen.findByText('My Profile')).toBeInTheDocument()
    expect(screen.getByText(/Choose image/i)).toBeInTheDocument()
    expect(screen.queryByText(/Raw API payload/i)).not.toBeInTheDocument()
  })

  it('hides Date of birth and Gender for ADMIN and RECEPTIONIST', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 99,
        fullName: 'Admin GymCore',
        email: 'admin@gymcore.local',
        phone: '',
        role: 'ADMIN',
        avatarUrl: '',
        avatarSource: 'CUSTOM',
      })
    })

    authApi.getProfile.mockResolvedValue({
      success: true,
      data: { user: { fullName: 'Admin GymCore', email: 'admin@gymcore.local', role: 'ADMIN', phone: '' } },
    })

    renderWithQuery(<ProfilePage />)

    expect(await screen.findByText('My Profile')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Date of birth/i)).toBeNull()
    expect(screen.queryByLabelText(/Gender/i)).toBeNull()
  })

  it('sanitizes phone input to digits only (keeps optional +) and blocks save when invalid', async () => {
    const user = userEvent.setup()

    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 1,
        fullName: 'Alex Carter',
        email: 'kironinja2015@gmail.com',
        phone: '',
        role: 'CUSTOMER',
        avatarUrl: '',
        avatarSource: 'GOOGLE',
      })
    })

    authApi.getProfile.mockResolvedValue({
      success: true,
      data: { user: { fullName: 'Alex Carter', email: 'kironinja2015@gmail.com', role: 'CUSTOMER' } },
    })

    renderWithQuery(<ProfilePage />)

    const phone = await screen.findByLabelText(/Phone/i)
    await user.clear(phone)
    await user.type(phone, 'abc-09 0567.5437xyz')

    // Should keep only digits.
    expect(phone).toHaveValue('0905675437')

    // Make it invalid (too short) and ensure save blocks.
    await user.clear(phone)
    await user.type(phone, 'abc123')
    expect(phone).toHaveValue('123')

    const save = screen.getByRole('button', { name: /Save changes/i })
    await user.click(save)

    const errors = await screen.findAllByText(/Phone number is invalid/i)
    expect(errors.length).toBeGreaterThan(0)
    expect(authApi.updateProfile).not.toHaveBeenCalled()
  })

  it('treats spaces-only phone as empty and allows save (phone sent as null)', async () => {
    const user = userEvent.setup()

    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 1,
        fullName: 'Alex Carter',
        email: 'kironinja2015@gmail.com',
        phone: '',
        role: 'CUSTOMER',
        avatarUrl: '',
        avatarSource: 'GOOGLE',
      })
    })

    authApi.getProfile.mockResolvedValue({
      success: true,
      data: { user: { fullName: 'Alex Carter', email: 'kironinja2015@gmail.com', role: 'CUSTOMER', phone: '' } },
    })

    authApi.updateProfile.mockResolvedValue({
      success: true,
      data: { user: { fullName: 'Alex Carter', email: 'kironinja2015@gmail.com', role: 'CUSTOMER', phone: '' } },
    })

    renderWithQuery(<ProfilePage />)

    const phone = await screen.findByLabelText(/Phone/i)
    await user.clear(phone)
    await user.type(phone, '        ')
    expect(phone).toHaveValue('')

    const save = screen.getByRole('button', { name: /Save changes/i })
    await user.click(save)

    expect(authApi.updateProfile).toHaveBeenCalledTimes(1)
    expect(authApi.updateProfile).toHaveBeenCalledWith({
      fullName: 'Alex Carter',
      phone: null,
      dateOfBirth: null,
      gender: null,
    })
  })

  it('blocks save when user pastes a very long phone number', async () => {
    const user = userEvent.setup()

    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 1,
        fullName: 'Alex Carter',
        email: 'kironinja2015@gmail.com',
        phone: '',
        role: 'CUSTOMER',
        avatarUrl: '',
        avatarSource: 'GOOGLE',
      })
    })

    authApi.getProfile.mockResolvedValue({
      success: true,
      data: { user: { fullName: 'Alex Carter', email: 'kironinja2015@gmail.com', role: 'CUSTOMER' } },
    })

    renderWithQuery(<ProfilePage />)

    const phone = await screen.findByLabelText(/Phone/i)
    await user.clear(phone)
    const longDigits = '1234567890123456789012345678901234567890'
    await user.paste(longDigits)
    expect(phone).toHaveValue(longDigits)

    const save = screen.getByRole('button', { name: /Save changes/i })
    await user.click(save)

    const errors = await screen.findAllByText(/Phone number is invalid/i)
    expect(errors.length).toBeGreaterThan(0)
    expect(authApi.updateProfile).not.toHaveBeenCalled()
  })

  it('converts fullwidth digits phone to ASCII digits and allows save', async () => {
    const user = userEvent.setup()

    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 1,
        fullName: 'Alex Carter',
        email: 'kironinja2015@gmail.com',
        phone: '',
        role: 'CUSTOMER',
        avatarUrl: '',
        avatarSource: 'GOOGLE',
      })
    })

    authApi.getProfile.mockResolvedValue({
      success: true,
      data: { user: { fullName: 'Alex Carter', email: 'kironinja2015@gmail.com', role: 'CUSTOMER', phone: '' } },
    })

    authApi.updateProfile.mockResolvedValue({
      success: true,
      data: { user: { fullName: 'Alex Carter', email: 'kironinja2015@gmail.com', role: 'CUSTOMER', phone: '0905675437' } },
    })

    renderWithQuery(<ProfilePage />)

    const phone = await screen.findByLabelText(/Phone/i)
    await user.clear(phone)
    await user.type(phone, '\uFF10\uFF19\uFF10\uFF15\uFF16\uFF17\uFF15\uFF14\uFF13\uFF17')
    expect(phone).toHaveValue('0905675437')

    const save = screen.getByRole('button', { name: /Save changes/i })
    await user.click(save)

    expect(authApi.updateProfile).toHaveBeenCalledTimes(1)
    expect(authApi.updateProfile).toHaveBeenCalledWith({
      fullName: 'Alex Carter',
      phone: '0905675437',
      dateOfBirth: null,
      gender: null,
    })
  })

  it('blocks save when phone is plus-only', async () => {
    const user = userEvent.setup()

    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 1,
        fullName: 'Alex Carter',
        email: 'kironinja2015@gmail.com',
        phone: '',
        role: 'CUSTOMER',
        avatarUrl: '',
        avatarSource: 'GOOGLE',
      })
    })

    authApi.getProfile.mockResolvedValue({
      success: true,
      data: { user: { fullName: 'Alex Carter', email: 'kironinja2015@gmail.com', role: 'CUSTOMER', phone: '' } },
    })

    renderWithQuery(<ProfilePage />)

    const phone = await screen.findByLabelText(/Phone/i)
    await user.clear(phone)
    await user.type(phone, '+')
    expect(phone).toHaveValue('+')

    await user.click(screen.getByRole('button', { name: /Save changes/i }))
    const errors = await screen.findAllByText(/Phone number is invalid/i)
    expect(errors.length).toBeGreaterThan(0)
    expect(authApi.updateProfile).not.toHaveBeenCalled()
  })
})
