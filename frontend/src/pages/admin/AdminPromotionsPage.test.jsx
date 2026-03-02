import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminPromotionsPage from './AdminPromotionsPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/promotion/api/adminPromotionApi', () => ({
  adminPromotionApi: {
    getCoupons: vi.fn(),
    createCoupon: vi.fn(),
    updateCoupon: vi.fn(),
    deleteCoupon: vi.fn(),
    getPosts: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
    getRevenueReport: vi.fn(),
    exportRevenuePdf: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
  },
}))

const { adminPromotionApi } = await import('../../features/promotion/api/adminPromotionApi')

function renderWithQuery(ui) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('AdminPromotionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminPromotionApi.getCoupons.mockResolvedValue({
      data: {
        coupons: [
          {
            PromotionID: 1,
            PromoCode: 'SUMMERPLUS1M',
            DiscountPercent: 5,
            DiscountAmount: null,
            ApplyTarget: 'MEMBERSHIP',
            BonusDurationMonths: 1,
            ValidFrom: '2026-03-01T00:00:00',
            ValidTo: '2026-04-01T00:00:00',
            IsActive: true,
          },
        ],
      },
    })
    adminPromotionApi.getPosts.mockResolvedValue({ data: { posts: [] } })
    adminPromotionApi.createCoupon.mockResolvedValue({ data: { success: true } })
  })

  it('renders target-aware coupon benefit formatting in the table', async () => {
    renderWithQuery(<AdminPromotionsPage />)

    expect(await screen.findByText('SUMMERPLUS1M')).toBeInTheDocument()
    expect(screen.getByText(/MEMBERSHIP: 5% off \+ \+1 membership month/i)).toBeInTheDocument()
  })

  it('submits apply target and bonus months when creating a membership coupon', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /New Coupon/i }))

    await user.type(screen.getByLabelText(/Coupon Code/i), 'MEMBERBOOST')
    await user.type(screen.getByLabelText(/Description/i), 'Membership boost')
    await user.selectOptions(screen.getByLabelText(/Apply Target/i), 'MEMBERSHIP')
    await user.type(screen.getByLabelText(/Discount \(%\)/i), '10')
    await user.clear(screen.getByLabelText(/Bonus Membership Months/i))
    await user.type(screen.getByLabelText(/Bonus Membership Months/i), '2')
    await user.type(screen.getByLabelText(/Valid From/i), '2026-03-01')
    await user.type(screen.getByLabelText(/Valid To/i), '2026-04-01')

    const modal = screen.getByRole('heading', { name: /New Coupon/i }).closest('div[class*="bg-white"]') ?? document.body
    await user.click(within(modal).getByRole('button', { name: /^Create Coupon$/i }))

    await waitFor(() => {
      expect(adminPromotionApi.createCoupon).toHaveBeenCalledWith(
        expect.objectContaining({
          promoCode: 'MEMBERBOOST',
          description: 'Membership boost',
          applyTarget: 'MEMBERSHIP',
          discountPercent: 10,
          discountAmount: null,
          bonusDurationMonths: 2,
          validFrom: '2026-03-01',
          validTo: '2026-04-01',
          isActive: 1,
        }),
      )
    })
  })
})
