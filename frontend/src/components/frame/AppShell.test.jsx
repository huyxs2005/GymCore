import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
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
  function LocationProbe() {
    const location = useLocation()
    return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
  }

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
          <LocationProbe />
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

  it('toggles the cart drawer when clicked from the shop page', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    window.addEventListener('gymcore:toggle-cart', onToggle)

    renderShell('/customer/shop')
    const cartButton = await screen.findByRole('button', { name: /open cart/i })
    await user.click(cartButton)

    expect(onToggle).toHaveBeenCalledTimes(1)
    window.removeEventListener('gymcore:toggle-cart', onToggle)
  })

  it('navigates to the shop with openCart=1 when clicked outside the shop page', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    renderShell('/customer/membership')
    const cartButton = await screen.findByRole('button', { name: /open cart/i })
    await user.click(cartButton)

    expect(scrollSpy).toHaveBeenCalledWith(0, 0)
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/customer/shop?openCart=1')
    scrollSpy.mockRestore()
  })

  it('does not show customer cart button for non-customer users', () => {
    useSession.mockReturnValue({
      isAuthenticated: true,
      user: { role: 'COACH', fullName: 'Coach A' },
    })

    renderShell('/coach/schedule')
    expect(screen.queryByRole('button', { name: /open cart/i })).not.toBeInTheDocument()
  })

  it('jumps to top immediately when footer quick link is clicked', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    renderShell('/customer/shop')
    const footer = screen.getByText(/Quick Links/i).closest('section')
    await user.click(within(footer).getByRole('link', { name: /^membership$/i }))

    expect(scrollSpy).toHaveBeenCalledWith(0, 0)
    scrollSpy.mockRestore()
  })

  it('jumps to top immediately when the GymCore logo is clicked', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    renderShell('/customer/shop')
    await user.click(screen.getByRole('link', { name: /gymcore/i }))

    expect(scrollSpy).toHaveBeenCalledWith(0, 0)
    scrollSpy.mockRestore()
  })

  it('smooth-scrolls to top when the user clicks the active workspace nav link', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    renderShell('/customer/shop')
    const headerNav = screen.getAllByRole('navigation')[0]
    await user.click(within(headerNav).getByRole('link', { name: /^Product Shop$/i }))

    expect(scrollSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    scrollSpy.mockRestore()
  })
})
