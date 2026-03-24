import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerOrderHistoryPage from './CustomerOrderHistoryPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/auth/useSession', () => ({
  useSession: () => ({
    user: {
      userId: 5,
      fullName: 'Customer Minh',
      email: 'customer@gymcore.local',
      role: 'CUSTOMER',
    },
    isAuthenticated: true,
  }),
}))

vi.mock('../../features/product/api/orderApi', () => ({
  orderApi: {
    getMyOrders: vi.fn(),
  },
}))

vi.mock('../../features/product/api/productApi', () => ({
  productApi: {
    createReview: vi.fn(),
    updateReview: vi.fn(),
    deleteReview: vi.fn(),
  },
}))

const { orderApi } = await import('../../features/product/api/orderApi')
const { productApi } = await import('../../features/product/api/productApi')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CustomerOrderHistoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CustomerOrderHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    orderApi.getMyOrders.mockResolvedValue({
      orders: [
        {
          orderId: 17,
          orderDate: '2026-03-07T10:00:00',
          paidAt: '2026-03-07T10:05:00',
          invoiceCode: 'INV-202603070101-900',
          paymentId: 900,
          paymentMethod: 'PAYOS',
          totalAmount: 3600,
          currency: 'VND',
          status: 'PAID',
          pickedUpAt: null,
          emailSentAt: null,
          emailSendError: 'SMTP down',
          items: [
            {
              productId: 1,
              name: 'Whey Protein',
              quantity: 1,
              unitPrice: 2000,
              thumbnailUrl: 'https://cdn.example/whey.jpg',
              hasReview: false,
            },
          ],
        },
        {
          orderId: 18,
          orderDate: '2026-03-08T10:00:00',
          paidAt: '2026-03-08T10:05:00',
          invoiceCode: 'INV-202603080101-901',
          paymentId: 901,
          paymentMethod: 'PAYOS',
          totalAmount: 2200,
          currency: 'VND',
          status: 'PAID',
          pickedUpAt: '2026-03-08T11:00:00',
          emailSentAt: '2026-03-08T10:06:00',
          emailSendError: null,
          items: [
            {
              productId: 3,
              name: 'BCAA',
              quantity: 1,
              unitPrice: 2200,
              thumbnailUrl: 'https://cdn.example/bcaa.jpg',
              hasReview: false,
            },
            {
              productId: 2,
              name: 'Creatine',
              quantity: 1,
              unitPrice: 1600,
              thumbnailUrl: 'https://cdn.example/creatine.jpg',
              hasReview: true,
              reviewId: 91,
              reviewRating: 5,
              reviewComment: 'Strong results',
            },
          ],
        },
      ],
    })
    productApi.createReview.mockResolvedValue({ created: true })
    productApi.updateReview.mockResolvedValue({ updated: true })
    productApi.deleteReview.mockResolvedValue({ deleted: true })
  })

  it('shows paid orders with pickup and email status details', async () => {
    renderPage()

    expect((await screen.findAllByText(/#17/i)).length).toBeGreaterThan(0)
    expect(screen.getByText('Bring the order ID to the front desk for pickup until the order is marked as collected.')).toBeInTheDocument()
    expect(screen.getAllByText(/Show order ID/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Email issues/i)).toBeInTheDocument()
    expect(screen.getByText(/INV-202603070101-900/i)).toBeInTheDocument()
    expect(screen.getByText(/SMTP down/i)).toBeInTheDocument()
  })

  it('gates reviews until pickup is confirmed', async () => {
    renderPage()

    expect((await screen.findAllByText(/Review unlocks after pickup is confirmed./i)).length).toBeGreaterThan(0)
    const awaitingOrder = screen.getByText(/INV-202603070101-900/i).closest('article')
    expect(awaitingOrder).not.toBeNull()
    expect(within(awaitingOrder).queryByRole('button', { name: /Leave review/i })).not.toBeInTheDocument()
  })

  it('lets the customer leave a review from a picked-up order history item', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click((await screen.findAllByRole('button', { name: /Leave review/i }))[0])
    await user.selectOptions(screen.getByLabelText(/Rating/i), '4')
    await user.type(screen.getByLabelText(/Comment/i), 'Mixes well and feels clean.')
    await user.click(screen.getByRole('button', { name: /Submit review/i }))

    await waitFor(() => {
      expect(productApi.createReview).toHaveBeenCalledWith(3, {
        rating: 4,
        comment: 'Mixes well and feels clean.',
      })
    })
  })

  it('lets the customer edit an existing review from order history', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Edit review/i }))
    expect(screen.getByDisplayValue('Strong results')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(/Rating/i), '3')
    await user.clear(screen.getByLabelText(/Comment/i))
    await user.type(screen.getByLabelText(/Comment/i), 'Taste is fine but recovery feels average.')
    await user.click(screen.getByRole('button', { name: /Update review/i }))

    await waitFor(() => {
      expect(productApi.updateReview).toHaveBeenCalledWith(2, {
        rating: 3,
        comment: 'Taste is fine but recovery feels average.',
      })
    })
  })

  it('lets the customer delete an existing review from order history', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Delete review/i }))
    await user.click(await screen.findByRole('button', { name: /Confirm delete/i }))

    await waitFor(() => {
      expect(productApi.deleteReview.mock.calls[0][0]).toBe(2)
    })
  })

  it('filters orders by pickup state and exposes product deep link', async () => {
    const user = userEvent.setup()
    renderPage()

    const productLinks = await screen.findAllByRole('link', { name: /View product/i })
    expect(productLinks[0]).toHaveAttribute('href', '/customer/shop/1')
    await user.selectOptions(screen.getByRole('combobox'), 'awaiting')
    expect(screen.getByText(/Show order ID/i)).toBeInTheDocument()
  })
})


