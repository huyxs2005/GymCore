import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerCartPage from './CustomerCartPage'

const mockSessionUser = {
  userId: 5,
  fullName: 'Customer Minh',
  email: 'customer@gymcore.local',
  phone: '0900000004',
  role: 'CUSTOMER',
}

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/auth/useSession', () => ({
  useSession: () => ({
    user: mockSessionUser,
    isAuthenticated: true,
  }),
}))

vi.mock('../../features/auth/api/authApi', () => ({
  authApi: {
    getProfile: vi.fn(),
  },
}))

vi.mock('../../features/product/api/cartApi', () => ({
  cartApi: {
    getCart: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

vi.mock('../../features/product/api/orderApi', () => ({
  orderApi: {
    checkout: vi.fn(),
    confirmPaymentReturn: vi.fn(),
  },
}))

vi.mock('../../features/promotion/api/promotionApi', () => ({
  promotionApi: {
    getMyClaims: vi.fn(),
    applyCoupon: vi.fn(),
  },
}))

const { authApi } = await import('../../features/auth/api/authApi')
const { cartApi } = await import('../../features/product/api/cartApi')
const { orderApi } = await import('../../features/product/api/orderApi')
const { promotionApi } = await import('../../features/promotion/api/promotionApi')

function renderPage(path = '/customer/cart') {
  window.history.replaceState({}, document.title, path)

  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/customer/cart" element={<CustomerCartPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CustomerCartPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    window.history.replaceState({}, document.title, '/customer/cart')

    authApi.getProfile.mockResolvedValue({
      user: {
        fullName: 'Customer Minh',
        email: 'customer@gymcore.local',
        phone: '0900000004',
      },
    })
    cartApi.getCart.mockResolvedValue({
      items: [
        {
          productId: 1,
          name: 'Whey Protein',
          price: 2000,
          quantity: 2,
          lineTotal: 4000,
        },
      ],
      subtotal: 4000,
      currency: 'VND',
    })
    cartApi.updateItem.mockResolvedValue({ updated: true })
    cartApi.removeItem.mockResolvedValue({ removed: true })
    orderApi.checkout.mockResolvedValue({ checkoutUrl: 'https://payos.vn/checkout/example' })
    orderApi.confirmPaymentReturn.mockResolvedValue({})
    promotionApi.getMyClaims.mockResolvedValue({
      claims: [
        {
          ClaimID: 11,
          PromoCode: 'WELCOME10',
          ApplyTarget: 'ORDER',
          DiscountPercent: 10,
          DiscountAmount: 0,
          BonusDurationMonths: 0,
          UsedAt: null,
        },
      ],
    })
    promotionApi.applyCoupon.mockResolvedValue({
      estimatedDiscount: 400,
      estimatedFinalAmount: 3600,
    })
    delete window.location
    window.location = { assign: vi.fn() }
  })

  it('renders the dedicated cart page and submits checkout from there', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/Cart items/i)).toBeInTheDocument()
    expect(await screen.findByText(/Whey Protein/i)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Apply coupon/i), 'WELCOME10')
    await waitFor(() => {
      expect(promotionApi.applyCoupon).toHaveBeenCalledWith({
        promoCode: 'WELCOME10',
        target: 'ORDER',
        subtotal: 4000,
      })
    })

    await user.click(screen.getByRole('button', { name: /Checkout with PayOS/i }))
    expect(await screen.findByRole('heading', { name: /Confirm receipt details/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Confirm and pay/i }))

    await waitFor(() => {
      expect(orderApi.checkout.mock.calls[0][0]).toEqual({
        paymentMethod: 'PAYOS',
        promoCode: 'WELCOME10',
        fullName: 'Customer Minh',
        phone: '0900000004',
        email: 'customer@gymcore.local',
      })
      expect(window.location.assign).toHaveBeenCalledWith('https://payos.vn/checkout/example')
    })
  })

  it('shows an empty state when the cart has no items', async () => {
    cartApi.getCart.mockResolvedValueOnce({ items: [], subtotal: 0, currency: 'VND' })

    renderPage()

    expect(await screen.findByText(/Your cart is empty/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Checkout with PayOS/i })).toBeDisabled()
  })
})
