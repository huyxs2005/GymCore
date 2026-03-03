import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerShopPage from './CustomerShopPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/product/api/productApi', () => ({
  productApi: {
    getProducts: vi.fn(),
    getProductDetail: vi.fn(),
    createReview: vi.fn(),
  },
}))

vi.mock('../../features/product/api/cartApi', () => ({
  cartApi: {
    getCart: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

vi.mock('../../features/product/api/orderApi', () => ({
  orderApi: {
    getMyOrders: vi.fn(),
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

const { productApi } = await import('../../features/product/api/productApi')
const { cartApi } = await import('../../features/product/api/cartApi')
const { orderApi } = await import('../../features/product/api/orderApi')
const { promotionApi } = await import('../../features/promotion/api/promotionApi')

function renderWithQuery(ui) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('CustomerShopPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    productApi.getProducts.mockResolvedValue({ data: { products: [] } })
    cartApi.getCart.mockResolvedValue({
      data: {
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
      },
    })
    orderApi.getMyOrders.mockResolvedValue({ data: { orders: [] } })
    orderApi.checkout.mockResolvedValue({ data: {} })
    promotionApi.getMyClaims.mockResolvedValue({
      data: {
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
          {
            ClaimID: 12,
            PromoCode: 'SUMMERPLUS1M',
            ApplyTarget: 'MEMBERSHIP',
            DiscountPercent: 5,
            DiscountAmount: 0,
            BonusDurationMonths: 1,
            UsedAt: null,
          },
        ],
      },
    })
    promotionApi.applyCoupon.mockResolvedValue({
      data: {
        estimatedDiscount: 400,
        estimatedFinalAmount: 3600,
      },
    })
  })

  it('checks out directly from the cart card with coupon selection and no modal step', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CustomerShopPage />)

    await act(async () => {
      window.dispatchEvent(new Event('gymcore:open-cart'))
    })

    expect(await screen.findByText(/Your Cart/i)).toBeInTheDocument()
    expect(screen.queryByText(/Checkout Options/i)).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Apply coupon/i), 'WELCOME10')

    await waitFor(() => {
      expect(promotionApi.applyCoupon).toHaveBeenCalledWith({
        promoCode: 'WELCOME10',
        target: 'ORDER',
        subtotal: 4000,
      })
    })

    await user.click(screen.getByRole('button', { name: /Checkout with PayOS/i }))

    await waitFor(() => {
      expect(orderApi.checkout.mock.calls[0][0]).toEqual({
        paymentMethod: 'PAYOS',
        promoCode: 'WELCOME10',
      })
    })

    expect(screen.queryByText(/Confirm Order/i)).not.toBeInTheDocument()
  })

  it('keeps membership-only coupons out of the product coupon selector and explains why', async () => {
    renderWithQuery(<CustomerShopPage />)

    await act(async () => {
      window.dispatchEvent(new Event('gymcore:open-cart'))
    })

    expect(await screen.findByText(/Your Cart/i)).toBeInTheDocument()
    expect(screen.getByText(/1 coupon\(s\) are membership-only and cannot be used for product checkout./i)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /WELCOME10/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /SUMMERPLUS1M/i })).not.toBeInTheDocument()
  })
})
