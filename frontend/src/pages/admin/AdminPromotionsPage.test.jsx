import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    uploadBanner: vi.fn(),
    deleteUploadedBanner: vi.fn(),
    getRevenueReport: vi.fn(),
    exportRevenuePdf: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const { adminPromotionApi } = await import('../../features/promotion/api/adminPromotionApi')
const { toast } = await import('react-hot-toast')

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
    window.sessionStorage.clear()
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
          {
            PromotionID: 2,
            PromoCode: 'WELCOME10',
            DiscountPercent: 10,
            DiscountAmount: null,
            ApplyTarget: 'ORDER',
            BonusDurationMonths: 0,
            ValidFrom: '2026-03-01T00:00:00',
            ValidTo: '2026-04-01T00:00:00',
            IsActive: false,
          },
          {
            PromotionID: 3,
            PromoCode: 'FLEXBOOST2M',
            DiscountPercent: null,
            DiscountAmount: 250,
            ApplyTarget: 'MEMBERSHIP',
            BonusDurationMonths: 2,
            ValidFrom: '2026-05-01T00:00:00',
            ValidTo: '2026-06-01T00:00:00',
            IsActive: true,
          },
          {
            PromotionID: 4,
            PromoCode: 'HIDDENINACTIVE',
            DiscountPercent: 15,
            DiscountAmount: null,
            ApplyTarget: 'ORDER',
            BonusDurationMonths: 0,
            ValidFrom: '2026-03-01T00:00:00',
            ValidTo: '2026-04-01T00:00:00',
            IsActive: false,
          },
        ],
      },
    })
    adminPromotionApi.getPosts.mockResolvedValue({
      data: {
        posts: [
          {
            PromotionPostID: 11,
            Title: 'Summer Plus Promo',
            Content: 'Membership push',
            BannerUrl: '',
            PromotionID: 1,
            PromoCode: 'SUMMERPLUS1M',
            StartAt: '2026-03-01T00:00:00',
            EndAt: '2026-04-01T00:00:00',
            IsActive: true,
            IsImportant: true,
          },
          {
            PromotionPostID: 12,
            Title: 'Welcome Promo',
            Content: 'Order coupon launch',
            BannerUrl: '',
            PromotionID: 2,
            PromoCode: 'WELCOME10',
            StartAt: '2026-03-01T00:00:00',
            EndAt: '2026-04-01T00:00:00',
            IsActive: false,
            IsImportant: false,
          },
        ],
      },
    })
    adminPromotionApi.createCoupon.mockResolvedValue({ data: { success: true } })
    adminPromotionApi.createPost.mockResolvedValue({ data: { success: true } })
    adminPromotionApi.uploadBanner.mockResolvedValue({ imageUrl: '/uploads/promotions/banners/summer.png' })
    adminPromotionApi.deleteUploadedBanner.mockResolvedValue({ deleted: true })
  })

  it('renders target-aware coupon benefit formatting in the table', async () => {
    renderWithQuery(<AdminPromotionsPage />)

    expect(await screen.findByText('SUMMERPLUS1M')).toBeInTheDocument()
    expect(screen.getAllByText('Membership').length).toBeGreaterThan(0)
    expect(screen.getByText(/5% off \+ \+1 membership month/i)).toBeInTheDocument()
  })

  it('filters the coupon table by target and status', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    expect(await screen.findByText('SUMMERPLUS1M')).toBeInTheDocument()
    expect(screen.getByText('WELCOME10')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Coupon target filter/i), 'ORDER')
    await user.selectOptions(screen.getByLabelText(/Coupon status filter/i), 'inactive')

    expect(screen.getByText('WELCOME10')).toBeInTheDocument()
    expect(screen.queryByText('SUMMERPLUS1M')).not.toBeInTheDocument()
  })

  it('filters the post table by target and status', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /Marketing Posts/i }))
    await user.selectOptions(screen.getByLabelText(/Post target filter/i), 'MEMBERSHIP')
    await user.selectOptions(screen.getByLabelText(/Post status filter/i), 'active')

    expect(screen.getByText('Summer Plus Promo')).toBeInTheDocument()
    expect(screen.queryByText('Welcome Promo')).not.toBeInTheDocument()
  })

  it('submits apply target and bonus months when creating a membership coupon', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /Create Coupon/i }))
    const modal = screen.getByRole('dialog', { name: /New Coupon/i })

    fireEvent.change(screen.getByLabelText(/Coupon Code/i), { target: { value: 'MEMBERBOOST' } })
    fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: 'Membership boost' } })
    await user.click(within(modal).getByRole('button', { name: /Membership use for plan discounts/i }))
    await user.click(within(modal).getByRole('button', { name: /Percent off use a percentage discount/i }))
    fireEvent.change(screen.getByLabelText(/Discount \(%\)/i), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(/Bonus Membership Months/i), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/Valid From/i), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText(/Valid To/i), { target: { value: '2026-04-01' } })

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
  }, 10000)

  it('uses one discount mode at a time and requires a fixed discount value when that mode is selected', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /Create Coupon/i }))
    const modal = screen.getByRole('dialog', { name: /New Coupon/i })

    expect(screen.getByLabelText(/Discount \(%\)/i)).toBeEnabled()
    expect(screen.getByLabelText(/Discount \(VND\)/i)).toBeDisabled()

    await user.click(within(modal).getByRole('button', { name: /Fixed VND off use a flat VND discount/i }))

    expect(screen.getByLabelText(/Discount \(%\)/i)).toBeDisabled()
    expect(screen.getByLabelText(/Discount \(VND\)/i)).toBeEnabled()

    fireEvent.change(screen.getByLabelText(/Coupon Code/i), { target: { value: 'EMPTYBENEFIT' } })
    fireEvent.change(screen.getByLabelText(/Valid From/i), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText(/Valid To/i), { target: { value: '2026-04-01' } })

    await user.click(within(modal).getByRole('button', { name: /^Create Coupon$/i }))

    expect(await screen.findByText(/Discount amount is required\./i)).toBeInTheDocument()
    expect(adminPromotionApi.createCoupon).not.toHaveBeenCalled()
  })

  it('shows custom validation instead of browser required tooltips for empty coupon submit', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /Create Coupon/i }))
    const modal = screen.getByRole('dialog', { name: /New Coupon/i })

    await user.click(within(modal).getByRole('button', { name: /^Create Coupon$/i }))

    expect(await screen.findByText(/Coupon code is required\./i)).toBeInTheDocument()
    expect(adminPromotionApi.createCoupon).not.toHaveBeenCalled()
  })

  it('rejects discount percent above 100 before submit', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /Create Coupon/i }))
    const modal = screen.getByRole('dialog', { name: /New Coupon/i })

    fireEvent.change(screen.getByLabelText(/Coupon Code/i), { target: { value: 'OVER100' } })
    fireEvent.change(screen.getByLabelText(/Valid From/i), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText(/Valid To/i), { target: { value: '2026-04-01' } })
    fireEvent.change(screen.getByLabelText(/Discount \(%\)/i), { target: { value: '101' } })

    await user.click(within(modal).getByRole('button', { name: /^Create Coupon$/i }))

    expect(await screen.findByText(/Discount percent must be at most 100\./i)).toBeInTheDocument()
    expect(adminPromotionApi.createCoupon).not.toHaveBeenCalled()
  })

  it('rejects absurd fixed discount values and keeps the preview neutral', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /Create Coupon/i }))
    const modal = screen.getByRole('dialog', { name: /New Coupon/i })

    await user.click(within(modal).getByRole('button', { name: /Fixed VND off use a flat VND discount/i }))
    fireEvent.change(screen.getByLabelText(/Coupon Code/i), { target: { value: 'HUGEAMOUNT' } })
    fireEvent.change(screen.getByLabelText(/Valid From/i), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText(/Valid To/i), { target: { value: '2026-04-01' } })
    fireEvent.change(screen.getByLabelText(/Discount \(VND\)/i), { target: { value: '234242343242' } })

    expect(screen.getByText(/No benefit selected yet/i)).toBeInTheDocument()

    await user.click(within(modal).getByRole('button', { name: /^Create Coupon$/i }))

    expect(await screen.findByText(/Discount amount must be at most 9,999,999,999\.99 VND\./i)).toBeInTheDocument()
    expect(adminPromotionApi.createCoupon).not.toHaveBeenCalled()
  })

  it('rejects malformed membership bonus months', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /Create Coupon/i }))
    const modal = screen.getByRole('dialog', { name: /New Coupon/i })

    await user.click(within(modal).getByRole('button', { name: /Membership use for plan discounts/i }))
    await user.click(within(modal).getByRole('button', { name: /No discount useful for bonus-month-only membership coupons/i }))
    fireEvent.change(screen.getByLabelText(/Coupon Code/i), { target: { value: 'BADMONTHS' } })
    fireEvent.change(screen.getByLabelText(/Valid From/i), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText(/Valid To/i), { target: { value: '2026-04-01' } })
    fireEvent.change(screen.getByLabelText(/Bonus Membership Months/i), { target: { value: '012321312323424e' } })

    await user.click(within(modal).getByRole('button', { name: /^Create Coupon$/i }))

    expect(await screen.findByText(/Bonus membership months must be a whole number\./i)).toBeInTheDocument()
    expect(adminPromotionApi.createCoupon).not.toHaveBeenCalled()
  })

  it('uploads a banner file and uses the stored banner URL when publishing a post', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /Marketing Posts/i }))
    await user.click(await screen.findByRole('button', { name: /Create Post/i }))
    const modal = screen.getByRole('dialog', { name: /New Marketing Post/i })

    await user.type(within(modal).getByLabelText(/Post Title/i), 'Summer Blast')
    await user.type(within(modal).getByLabelText(/Content/i), 'Claim the coupon before it expires.')

    const fileInput = modal.querySelector('input[type="file"]')
    const file = new File(['banner'], 'summer.png', { type: 'image/png' })
    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(adminPromotionApi.uploadBanner).toHaveBeenCalled()
    })

    await user.click(within(modal).getByRole('button', { name: /Selected coupon/i }))
    await user.click(await screen.findByRole('button', { name: /FLEXBOOST2M/i }))

    expect(within(modal).getByLabelText(/Start At/i)).toHaveValue('2026-05-01')
    expect(within(modal).getByLabelText(/End At/i)).toHaveValue('2026-06-01')
    await user.click(within(modal).getByRole('button', { name: /Mark as important broadcast/i }))

    await user.click(within(modal).getByRole('button', { name: /Publish Post/i }))

    await waitFor(() => {
      expect(adminPromotionApi.createPost).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Summer Blast',
        content: 'Claim the coupon before it expires.',
        bannerUrl: '/uploads/promotions/banners/summer.png',
        promotionId: 3,
        startAt: '2026-05-01',
        endAt: '2026-06-01',
        isImportant: 1,
      }))
    })
  })

  it('sends ordinary marketing posts as page-only by default', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /Marketing Posts/i }))
    await user.click(await screen.findByRole('button', { name: /Create Post/i }))
    const modal = screen.getByRole('dialog', { name: /New Marketing Post/i })

    await user.type(within(modal).getByLabelText(/Post Title/i), 'Quiet Promo')
    await user.type(within(modal).getByLabelText(/Content/i), 'Visible in promotions only.')

    const fileInput = modal.querySelector('input[type="file"]')
    const file = new File(['banner'], 'quiet.png', { type: 'image/png' })
    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(adminPromotionApi.uploadBanner).toHaveBeenCalled()
    })

    await user.click(within(modal).getByRole('button', { name: /Selected coupon/i }))
    await user.click(await screen.findByRole('button', { name: /FLEXBOOST2M/i }))

    expect(within(modal).getByText(/Standard posts stay in the Promotions page without sending a notification blast\./i)).toBeInTheDocument()

    await user.click(within(modal).getByRole('button', { name: /Publish Post/i }))

    await waitFor(() => {
      expect(adminPromotionApi.createPost).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Quiet Promo',
        isImportant: 0,
      }))
    })
  })

  it('hides inactive coupons from the marketing post picker', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /Marketing Posts/i }))
    await user.click(await screen.findByRole('button', { name: /Create Post/i }))
    const modal = screen.getByRole('dialog', { name: /New Marketing Post/i })

    await user.click(within(modal).getByRole('button', { name: /Selected coupon/i }))

    expect(screen.queryByRole('button', { name: /HIDDENINACTIVE/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /FLEXBOOST2M/i })).toBeInTheDocument()
  })

  it('blocks oversized post banners before the upload request is sent', async () => {
    const user = userEvent.setup()
    renderWithQuery(<AdminPromotionsPage />)

    await user.click(await screen.findByRole('button', { name: /Marketing Posts/i }))
    await user.click(await screen.findByRole('button', { name: /Create Post/i }))
    const modal = screen.getByRole('dialog', { name: /New Marketing Post/i })

    const fileInput = modal.querySelector('input[type="file"]')
    const file = new File([new Uint8Array((5 * 1024 * 1024) + 1)], 'huge-banner.png', { type: 'image/png' })
    await user.upload(fileInput, file)

    expect(adminPromotionApi.uploadBanner).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Promotion banner file is too large. Maximum size is 5 MB.')
  })
})

