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

vi.mock('../pages/admin/AdminSupportConsolePage', () => ({
  default: () => <div>Admin Support Console</div>,
}))

vi.mock('../pages/admin/AdminGoalsPage', () => ({
  default: () => <div>Admin Goals</div>,
}))

vi.mock('../pages/admin/AdminInvoicesPage', () => ({
  default: () => {
    const rawUser = globalThis.localStorage?.getItem('gymcore_auth_user')
    const user = rawUser ? JSON.parse(rawUser) : null
    return <div>{user?.role === 'ADMIN' ? 'Admin Invoice Center' : 'Reception Invoice Center'}</div>
  },
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

vi.mock('../pages/customer/CustomerProgressHubPage', () => ({
  default: () => <div>Customer Progress Hub</div>,
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

function installLocalStorageMock() {
  const store = new Map()
  const mock = {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(String(key), String(value))
    }),
    removeItem: vi.fn((key) => {
      store.delete(String(key))
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
  }

  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true,
  })
}

describe('AppRouter role guards', () => {
  beforeEach(() => {
    installLocalStorageMock()
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

  it('allows admin to open the support console route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 1,
        fullName: 'Admin GymCore',
        email: 'admin@gymcore.local',
        role: 'ADMIN',
      })
    })
    renderAt('/admin/support')
    expect(await screen.findByText(/Admin Support Console/i)).toBeInTheDocument()
  })

  it('redirects receptionist away from the admin support route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 2,
        fullName: 'Receptionist GymCore',
        email: 'reception@gymcore.local',
        role: 'RECEPTIONIST',
      })
    })
    renderAt('/admin/support')
    expect(await screen.findByText(/GymCore Platform/i)).toBeInTheDocument()
  })

  it('allows admin to open the admin goals route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 1,
        fullName: 'Admin GymCore',
        email: 'admin@gymcore.local',
        role: 'ADMIN',
      })
    })
    renderAt('/admin/goals')
    expect(await screen.findByText(/Admin Goals/i)).toBeInTheDocument()
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

  it('allows customer to open the progress hub route', async () => {
    act(() => {
      setAccessToken('token')
      setAuthUser({
        userId: 5,
        fullName: 'Customer Minh',
        email: 'customer@gymcore.local',
        role: 'CUSTOMER',
      })
    })
    renderAt('/customer/progress-hub')
    expect(await screen.findByText(/Customer Progress Hub/i)).toBeInTheDocument()
  })
})
