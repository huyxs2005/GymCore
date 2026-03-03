import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerMembershipPage from './CustomerMembershipPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/membership/api/membershipApi', () => ({
  membershipApi: {
    getPlans: vi.fn(),
    getCurrentMembership: vi.fn(),
    purchase: vi.fn(),
    renew: vi.fn(),
    upgrade: vi.fn(),
    confirmPaymentReturn: vi.fn(),
  },
}))

vi.mock('../../features/promotion/api/promotionApi', () => ({
  promotionApi: {
    getMyClaims: vi.fn(),
    applyCoupon: vi.fn(),
  },
}))

const { membershipApi } = await import('../../features/membership/api/membershipApi')
const { promotionApi } = await import('../../features/promotion/api/promotionApi')

function renderWithQuery(ui) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('CustomerMembershipPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    membershipApi.getPlans.mockResolvedValue({
      data: {
        plans: [
          {
            planId: 2,
            name: 'Gym Only - 1 Month',
            planType: 'GYM_ONLY',
            price: 2000,
            durationDays: 30,
            allowsCoachBooking: false,
          },
        ],
      },
    })
    membershipApi.getCurrentMembership.mockResolvedValue({
      data: {
        membership: {},
        validForCheckin: false,
        reason: 'Customer does not have a membership.',
      },
    })
    promotionApi.getMyClaims.mockResolvedValue({
      data: {
        claims: [
          {
            ClaimID: 7,
            PromoCode: 'MEMBERBOOST',
            ApplyTarget: 'MEMBERSHIP',
            DiscountPercent: 10,
            DiscountAmount: 0,
            BonusDurationMonths: 1,
            UsedAt: null,
          },
          {
            ClaimID: 8,
            PromoCode: 'WELCOME10',
            ApplyTarget: 'ORDER',
            DiscountPercent: 10,
            DiscountAmount: 0,
            BonusDurationMonths: 0,
            UsedAt: null,
          },
        ],
      },
    })
    promotionApi.applyCoupon.mockResolvedValue({
      data: {
        estimatedDiscount: 200,
        estimatedFinalAmount: 1800,
        bonusDurationMonths: 1,
      },
    })
    membershipApi.purchase.mockResolvedValue({ data: {} })
  })

  it('sends one selected membership coupon into checkout', async () => {
    const user = userEvent.setup()
    renderWithQuery(<CustomerMembershipPage />)

    expect(await screen.findByLabelText(/Apply membership coupon/i)).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: /MEMBERBOOST/i })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Apply membership coupon/i), 'MEMBERBOOST')

    await waitFor(() => {
      expect(promotionApi.applyCoupon).toHaveBeenCalledWith({
        promoCode: 'MEMBERBOOST',
        target: 'MEMBERSHIP',
        subtotal: 2000,
      })
    })

    await user.click(screen.getByRole('button', { name: /^Checkout$/i }))

    await waitFor(() => {
      expect(membershipApi.purchase).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 2,
          paymentMethod: 'PAYOS',
          promoCode: 'MEMBERBOOST',
        }),
      )
    })
  })

  it('filters out order coupons and shows preview error from membership coupon validation', async () => {
    const user = userEvent.setup()
    promotionApi.applyCoupon.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Membership coupon is not valid for this plan.',
        },
      },
    })

    renderWithQuery(<CustomerMembershipPage />)

    expect(await screen.findByRole('option', { name: /MEMBERBOOST/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /WELCOME10/i })).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Apply membership coupon/i), 'MEMBERBOOST')

    expect(await screen.findByText(/Membership coupon is not valid for this plan./i)).toBeInTheDocument()
  })
})
