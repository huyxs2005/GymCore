import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import AppRouter from './AppRouter'
import { clearSession, setAccessToken, setAuthUser } from '../features/auth/session'

vi.mock('../pages/public/LandingPage', () => ({
  default: () => <div>GymCore Platform</div>,
}))

vi.mock('../pages/reception/ReceptionCheckinPage', () => ({
  default: () => <div>Reception Check-in Scanner</div>,
}))

vi.mock('../pages/reception/ReceptionPickupPage', () => ({
  default: () => <div>Reception Pickup Desk</div>,
}))

vi.mock('../pages/reception/ReceptionCustomersPage', () => ({
  default: () => <div>Reception Customer Lookup</div>,
}))

vi.mock('../pages/customer/CustomerProductDetailPage', () => ({
  default: () => <div>Customer Product Detail</div>,
}))

vi.mock('../pages/customer/CustomerCartPage', () => ({
  default: () => <div>Customer Cart Page</div>,
}))

vi.mock('../pages/customer/CustomerKnowledgePage', () => ({
  default: () => <div>Customer Knowledge Hub</div>,
}))

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

vi.mock('../features/product/api/adminInvoiceApi', () => {
  return {
    adminInvoiceApi: {
      getInvoices: vi.fn().mockResolvedValue({ data: { invoices: [] } }),
      getInvoiceDetail: vi.fn(),
    },
  }
})

vi.mock('../features/product/api/orderApi', () => {
  return {
    orderApi: {
      getMyOrders: vi.fn().mockResolvedValue({ data: { orders: [] } }),
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

  it('allows receptionist to open invoice route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 2,
        fullName: 'Receptionist GymCore',
        email: 'reception@gymcore.local',
        role: 'RECEPTIONIST',
      })
    })
    renderAt('/reception/invoices')
    expect(await screen.findByText(/Reception Invoice Center/i)).toBeInTheDocument()
  })

  it('allows receptionist to open pickup route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 2,
        fullName: 'Receptionist GymCore',
        email: 'reception@gymcore.local',
        role: 'RECEPTIONIST',
      })
    })
    renderAt('/reception/pickup')
    expect(await screen.findByText(/Reception Pickup Desk/i)).toBeInTheDocument()
  })

  it('allows receptionist to open customer lookup route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 2,
        fullName: 'Receptionist GymCore',
        email: 'reception@gymcore.local',
        role: 'RECEPTIONIST',
      })
    })
    renderAt('/reception/customers')
    expect(await screen.findByText(/Reception Customer Lookup/i)).toBeInTheDocument()
  })

  it('allows admin to open admin invoice route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 1,
        fullName: 'Admin GymCore',
        email: 'admin@gymcore.local',
        role: 'ADMIN',
      })
    })
    renderAt('/admin/invoices')
    expect((await screen.findAllByText(/Admin Invoice Center/i)).length).toBeGreaterThan(0)
  })

  it('allows customer to open order history route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 5,
        fullName: 'Customer Minh',
        email: 'customer@gymcore.local',
        role: 'CUSTOMER',
      })
    })
    renderAt('/customer/orders')
    expect(await screen.findByText(/Order History/i)).toBeInTheDocument()
  })

  it('allows customer to open product detail route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 5,
        fullName: 'Customer Minh',
        email: 'customer@gymcore.local',
        role: 'CUSTOMER',
      })
    })
    renderAt('/customer/shop/1')
    expect(await screen.findByText(/Customer Product Detail/i)).toBeInTheDocument()
  })

  it('allows customer to open cart route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 5,
        fullName: 'Customer Minh',
        email: 'customer@gymcore.local',
        role: 'CUSTOMER',
      })
    })
    renderAt('/customer/cart')
    expect(await screen.findByText(/Customer Cart Page/i)).toBeInTheDocument()
  })

  it('allows customer to open knowledge route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 5,
        fullName: 'Customer Minh',
        email: 'customer@gymcore.local',
        role: 'CUSTOMER',
      })
    })
    renderAt('/customer/knowledge')
    expect(await screen.findByText(/Customer Knowledge Hub/i)).toBeInTheDocument()
  })
})
