import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminDashboardPage from './AdminDashboardPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/admin/api/adminApi', () => ({
  adminApi: {
    getDashboardSummary: vi.fn(),
  },
}))

const { adminApi } = await import('../../features/admin/api/adminApi')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <AdminDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.getDashboardSummary.mockResolvedValue({
      data: {
        customerMetrics: { totalCustomers: 12, activeCustomers: 8 },
        membershipMetrics: { activeMemberships: 9, scheduledMemberships: 2, expiringSoonMemberships: 3 },
        staffMetrics: { totalCoaches: 4, totalReceptionists: 2, totalAdmins: 1, lockedStaffAccounts: 1 },
        ptMetrics: { pendingPtRequests: 2, activePtArrangements: 5, sessionsScheduledToday: 4 },
        commerceMetrics: {
          awaitingPickupOrders: 3,
          pickedUpToday: 1,
          invoiceEmailFailures: 1,
          pickupTrackingAvailable: true,
          invoiceEmailTrackingAvailable: true,
        },
        promotionMetrics: { activeCoupons: 2, activePromotionPosts: 1 },
        recentPayments: [
          { paymentId: 1, customerName: 'Customer Minh', paymentTarget: 'ORDER', amount: 2000, paidAt: '2026-03-07T08:30:00Z' },
        ],
        awaitingPickupOrders: [
          { invoiceId: 10, invoiceCode: 'INV-010', orderId: 55, totalAmount: 1800, paidAt: '2026-03-07T08:30:00Z' },
        ],
        pendingPtRequests: [
          { ptRequestId: 30, customerName: 'Customer Minh', coachName: 'Coach Alex', createdAt: '2026-03-07T09:00:00Z' },
        ],
      },
    })
  })

  it('renders operational cards and removes revenue-reporting copy from the dashboard', async () => {
    renderPage()

    expect(await screen.findByText('INV-010')).toBeInTheDocument()
    expect(screen.getByText('Operations snapshot')).toBeInTheDocument()
    expect(screen.getByText('Latest payments')).toBeInTheDocument()
    expect(screen.getByText('Pickup desk queue')).toBeInTheDocument()
    expect(screen.getByText('PT requests waiting')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open revenue reports/i })).toHaveAttribute('href', '/admin/reports')

    const customerCard = screen.getByText('Total customers').closest('article')
    expect(customerCard).not.toBeNull()
    expect(within(customerCard).getByText('12')).toBeInTheDocument()

    expect(screen.queryByText('Money flow')).not.toBeInTheDocument()
    expect(screen.queryByText('Operational watchlist')).not.toBeInTheDocument()
    expect(screen.queryByText('Invoice mail failures')).not.toBeInTheDocument()
    expect(screen.queryByText('Memberships expiring soon')).not.toBeInTheDocument()
  })

  it('shows a schema note when pickup tracking is unavailable', async () => {
    adminApi.getDashboardSummary.mockResolvedValueOnce({
      data: {
        customerMetrics: { totalCustomers: 12, activeCustomers: 8 },
        staffMetrics: { totalCoaches: 4, totalReceptionists: 2, totalAdmins: 1, lockedStaffAccounts: 1 },
        ptMetrics: { pendingPtRequests: 2, sessionsScheduledToday: 4 },
        commerceMetrics: {
          awaitingPickupOrders: 0,
          pickedUpToday: 0,
          pickupTrackingAvailable: false,
        },
        promotionMetrics: { activeCoupons: 2, activePromotionPosts: 1 },
        recentPayments: [],
        awaitingPickupOrders: [],
        pendingPtRequests: [],
      },
    })

    renderPage()

    expect(await screen.findByText('Pickup tracking is unavailable')).toBeInTheDocument()
    expect(screen.getByText(/Apply the missing invoice pickup columns from `docs\/alter.txt`/i)).toBeInTheDocument()
    expect(screen.getByText(/Pickup tracking unavailable on current DB schema/i)).toBeInTheDocument()
  })
})


