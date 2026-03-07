import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppShell from './AppShell'

const mockSessionState = {
  isAuthenticated: true,
  user: { userId: 1, role: 'CUSTOMER', fullName: 'Customer A' },
}

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

function renderShell(pathname, client = null) {
  function LocationProbe() {
    const location = useLocation()
    return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
  }

  const queryClient = client || new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
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
    mockSessionState.isAuthenticated = true
    mockSessionState.user = { userId: 1, role: 'CUSTOMER', fullName: 'Customer A' }
    useSession.mockImplementation(() => mockSessionState)
    cartApi.getCart.mockResolvedValue({
      items: [{ productId: 1, quantity: 2 }],
    })
  })

  it('navigates to the dedicated cart page when clicked from the shop page', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    renderShell('/customer/shop')
    const cartButton = await screen.findByRole('button', { name: /open cart/i })
    await user.click(cartButton)

    expect(scrollSpy).toHaveBeenCalledWith(0, 0)
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/customer/cart')
    scrollSpy.mockRestore()
  })

  it('navigates to the dedicated cart page when clicked outside the shop page', async () => {
    const user = userEvent.setup()
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    renderShell('/customer/membership')
    const cartButton = await screen.findByRole('button', { name: /open cart/i })
    await user.click(cartButton)

    expect(scrollSpy).toHaveBeenCalledWith(0, 0)
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/customer/cart')
    scrollSpy.mockRestore()
  })

  it('does not show customer cart button for non-customer users', () => {
    mockSessionState.user = { userId: 9, role: 'COACH', fullName: 'Coach A' }

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

  it('shows full customer navigation on the landing page and removes the old workspace shortcut', () => {
    renderShell('/')

    const headerNav = screen.getAllByRole('navigation')[0]
    expect(within(headerNav).getByRole('link', { name: /^Membership$/i })).toBeInTheDocument()
    expect(within(headerNav).getByRole('link', { name: /^Check-in & Health$/i })).toBeInTheDocument()
    expect(within(headerNav).getByRole('link', { name: /^Coach Booking$/i })).toBeInTheDocument()
    expect(within(headerNav).getByRole('link', { name: /^Product Shop$/i })).toBeInTheDocument()
    expect(within(headerNav).getByRole('link', { name: /^Promotions$/i })).toBeInTheDocument()
    expect(within(headerNav).getByRole('link', { name: /^Workout\/Food\/AI$/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Open Customer/i })).not.toBeInTheDocument()
  })

  it('shows customer role navigation on shared profile and notifications pages', () => {
    const { unmount } = renderShell('/profile')

    let headerNav = screen.getAllByRole('navigation')[0]
    expect(within(headerNav).getByRole('link', { name: /^Membership$/i })).toBeInTheDocument()
    expect(within(headerNav).getByRole('link', { name: /^Coach Booking$/i })).toBeInTheDocument()

    unmount()

    renderShell('/notifications')
    headerNav = screen.getAllByRole('navigation')[0]
    expect(within(headerNav).getByRole('link', { name: /^Membership$/i })).toBeInTheDocument()
    expect(within(headerNav).getByRole('link', { name: /^Product Shop$/i })).toBeInTheDocument()
  })

  it('does not reuse another customer cart badge when the session user changes', async () => {
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    let resolveSecondCart
    cartApi.getCart
      .mockResolvedValueOnce({
        items: [{ productId: 1, quantity: 2 }],
      })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveSecondCart = resolve
      }))

    const firstRender = renderShell('/customer/shop', client)
    expect(await screen.findByText('2')).toBeInTheDocument()
    firstRender.unmount()

    mockSessionState.user = { userId: 2, role: 'CUSTOMER', fullName: 'Customer B' }
    renderShell('/customer/shop', client)

    expect(screen.queryByText('2')).not.toBeInTheDocument()

    resolveSecondCart({
      items: [],
    })

    expect(await screen.findByRole('button', { name: /open cart/i })).toBeInTheDocument()
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })
})
