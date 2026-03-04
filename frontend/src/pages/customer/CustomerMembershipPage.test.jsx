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
            planId: 1,
            name: 'Day Pass',
            planType: 'DAY_PASS',
            price: 1000,
            durationDays: 1,
            allowsCoachBooking: false,
          },
          {
            planId: 2,
            name: 'Gym Only - 1 Month',
            planType: 'GYM_ONLY',
            price: 2000,
            durationDays: 30,
            allowsCoachBooking: false,
          },
          {
            planId: 3,
            name: 'Gym + Coach - 1 Month',
            planType: 'GYM_PLUS_COACH',
            price: 3000,
            durationDays: 30,
            allowsCoachBooking: true,
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

    await user.click(screen.getByRole('button', { name: /Gym Only Standard membership for consistent self-training/i }))

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

  it('shows a queued membership card when the next paid plan is scheduled', async () => {
    membershipApi.getCurrentMembership.mockResolvedValueOnce({
      data: {
        membership: {
          status: 'ACTIVE',
          startDate: '2026-03-01',
          endDate: '2026-03-30',
          plan: {
            name: 'Gym Only - 1 Month',
            planType: 'GYM_ONLY',
            price: 2000,
            durationDays: 30,
            allowsCoachBooking: false,
          },
        },
        queuedMembership: {
          status: 'SCHEDULED',
          startDate: '2026-03-31',
          endDate: '2026-04-29',
          plan: {
            name: 'Gym + Coach - 1 Month',
            planType: 'GYM_PLUS_COACH',
            price: 3000,
            durationDays: 30,
            allowsCoachBooking: true,
          },
        },
        validForCheckin: true,
        reason: null,
      },
    })

    renderWithQuery(<CustomerMembershipPage />)

    expect(await screen.findByText('Queued next membership')).toBeInTheDocument()
    expect(screen.getAllByText('Gym + Coach - 1 Month').length).toBeGreaterThan(0)
    expect(screen.getByText(/This plan will appear as active/i)).toBeInTheDocument()
  })

  it('renders three membership type cards with benefits and allows selecting duration from the card', async () => {
    const user = userEvent.setup()

    renderWithQuery(<CustomerMembershipPage />)

    await screen.findByText('Gym + Coach - 1 Month')

    expect(screen.getByRole('button', { name: /Day Pass Quick access for a single training day/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gym Only Standard membership for consistent self-training/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gym \+ Coach Premium plan with personal training booking access/i })).toBeInTheDocument()
    expect(screen.getByText('One-day front desk check-in access')).toBeInTheDocument()
    expect(screen.getByText('Full gym floor access for the selected duration')).toBeInTheDocument()
    expect(screen.getByText('Unlocks coach matching and PT booking requests')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Gym \+ Coach Premium plan with personal training booking access/i }))
    await user.selectOptions(document.getElementById('membership-duration-GYM_PLUS_COACH'), '3')

    await user.click(screen.getByRole('button', { name: /^Checkout$/i }))

    await waitFor(() => {
      expect(membershipApi.purchase).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 3,
          paymentMethod: 'PAYOS',
        }),
      )
    })
  })
})
