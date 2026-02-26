import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import AppRouter from './AppRouter'
import { clearSession, setAccessToken, setAuthUser } from '../features/auth/session'

vi.mock('../features/checkin/api/receptionCheckinApi', () => {
  return {
    receptionCheckinApi: {
      scan: vi.fn(),
      validateMembership: vi.fn().mockResolvedValue({ success: true, data: {} }),
      getHistory: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    },
  }
})

vi.mock('../features/users/api/receptionCustomerApi', () => {
  return {
    receptionCustomerApi: {
      searchCustomers: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
      getMembership: vi.fn(),
    },
  }
})

function renderAt(path) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AppRouter role guards', () => {
  beforeEach(() => {
    act(() => clearSession())
  })

  it('redirects guest from receptionist route to default page', async () => {
    renderAt('/reception/checkin')
    expect(await screen.findByText(/GymCore Platform/i)).toBeInTheDocument()
  })

  it('redirects customer from receptionist route to default page', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 5,
        fullName: 'Customer Minh',
        email: 'customer@gymcore.local',
        role: 'CUSTOMER',
      })
    })
    renderAt('/reception/checkin')
    expect(await screen.findByText(/GymCore Platform/i)).toBeInTheDocument()
  })

  it('allows receptionist to open receptionist route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 2,
        fullName: 'Receptionist GymCore',
        email: 'reception@gymcore.local',
        role: 'RECEPTIONIST',
      })
    })
    renderAt('/reception/checkin')
    expect(await screen.findByText(/Reception Check-in Scanner/i)).toBeInTheDocument()
  })
})
