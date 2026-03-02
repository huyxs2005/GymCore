import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppShell from './AppShell'

vi.mock('../../features/auth/useSession', () => ({
  useSession: vi.fn(),
}))

vi.mock('../common/AuthHeaderActions', () => ({
  default: () => <div data-testid="auth-actions" />,
}))

vi.mock('../common/NotificationDropdown', () => ({
  default: () => <div data-testid="notif" />,
}))

vi.mock('../../features/product/api/cartApi', () => ({
  cartApi: {
    getCart: vi.fn(),
  },
}))

const { useSession } = await import('../../features/auth/useSession')
const { cartApi } = await import('../../features/product/api/cartApi')

function renderShell(pathname) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[pathname]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AppShell cart button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSession.mockReturnValue({
      isAuthenticated: true,
      user: { role: 'CUSTOMER', fullName: 'Customer A' },
    })
    cartApi.getCart.mockResolvedValue({
      data: {
        items: [{ productId: 1, quantity: 2 }],
      },
    })
  })

  it('shows customer cart button on /customer/shop and toggles cart event when clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    window.addEventListener('gymcore:toggle-cart', onToggle)

    renderShell('/customer/shop')
    const cartButton = await screen.findByRole('button', { name: /open cart/i })
    await user.click(cartButton)

    expect(onToggle).toHaveBeenCalledTimes(1)
    window.removeEventListener('gymcore:toggle-cart', onToggle)
  })

  it('does not show customer cart button outside shop route', () => {
    renderShell('/customer/membership')
    expect(screen.queryByRole('button', { name: /open cart/i })).not.toBeInTheDocument()
  })
})

