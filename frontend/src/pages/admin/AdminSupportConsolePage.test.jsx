import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSupportConsolePage from './AdminSupportConsolePage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ title, subtitle, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}))

vi.mock('../../features/admin/api/adminSupportApi', () => ({
  adminSupportApi: {
    searchCustomers: vi.fn(),
    getCustomerDetail: vi.fn(),
  },
}))

const { adminSupportApi } = await import('../../features/admin/api/adminSupportApi')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/support']}>
        <AdminSupportConsolePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminSupportConsolePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminSupportApi.searchCustomers.mockResolvedValue({
      items: [
        {
          customerId: 11,
          fullName: 'Customer Minh',
          email: 'customer@gymcore.local',
          phone: '0900000004',
          locked: false,
          planName: 'Gym Plus Coach',
          membershipStatus: 'ACTIVE',
          nextSessionDate: '2026-03-14',
          replacementStatus: 'PENDING_CUSTOMER',
          lastNotificationAt: '2026-03-13T08:00:00',
        },
      ],
    })
    adminSupportApi.getCustomerDetail.mockResolvedValue({
      account: {
        customerId: 11,
        fullName: 'Customer Minh',
        email: 'customer@gymcore.local',
        phone: '0900000004',
        locked: false,
        active: true,
        createdAt: '2026-03-01T08:00:00',
        lockReason: null,
      },
      memberships: {
        current: {
          planName: 'Gym Plus Coach',
          status: 'ACTIVE',
          endDate: '2026-06-01',
        },
        history: [
          {
            customerMembershipId: 77,
            planName: 'Gym Plus Coach',
            status: 'ACTIVE',
            startDate: '2026-03-01',
            endDate: '2026-06-01',
          },
        ],
      },
      pt: {
        currentPhase: {
          coachName: 'Coach Alex',
          status: 'ACTIVE',
        },
        requests: [
          {
            ptRequestId: 12,
            status: 'APPROVED',
            coachName: 'Coach Alex',
            startDate: '2026-03-01',
            endDate: '2026-06-01',
          },
        ],
        upcomingSessions: [
          {
            ptSessionId: 18,
            sessionDate: '2026-03-14',
            coachName: 'Coach Alex',
            slotIndex: 2,
            startTime: '18:00:00',
            endTime: '19:00:00',
            replacementStatus: 'PENDING_CUSTOMER',
            replacementCoachName: 'Coach Taylor',
          },
        ],
      },
      orders: {
        count: 1,
        items: [
          {
            orderId: 51,
            status: 'PAID',
            invoiceCode: 'INV-51',
            paidAt: '2026-03-12T10:15:00',
          },
        ],
      },
      pickup: {
        count: 1,
      },
      invoiceEmail: {
        failureCount: 1,
        items: [
          {
            invoiceId: 51,
            invoiceCode: 'INV-51',
            recipientEmail: 'customer@gymcore.local',
            emailSentAt: null,
            emailSendError: 'SMTP down',
          },
        ],
      },
      notifications: {
        items: [
          {
            notificationId: 90,
            title: 'Replacement coach offer',
            message: 'Coach Taylor is available for your next PT session.',
            createdAt: '2026-03-13T09:00:00',
            read: false,
          },
        ],
      },
      alerts: [
        {
          id: 'replacement-pending',
          message: 'Customer still needs to accept the replacement coach offer.',
          route: '/admin/coach-management',
        },
      ],
      links: {
        users: '/admin/users',
        memberships: '/admin/memberships',
        coachManagement: '/admin/coach-management',
        invoices: '/admin/invoices',
        pickup: '/reception/pickup',
        notifications: '/notifications',
      },
    })
  })

  it('renders support search results and the consolidated customer detail view', async () => {
    renderPage()

    expect(await screen.findByText('Customer Minh')).toBeInTheDocument()
    expect(await screen.findByText('Support alerts')).toBeInTheDocument()
    expect(screen.getByText(/Customer still needs to accept the replacement coach offer/i)).toBeInTheDocument()
    expect(screen.getByText(/Order #51/i)).toBeInTheDocument()
    expect(screen.getAllByText(/INV-51/i).length).toBeGreaterThan(1)
  })

  it('re-runs the customer search with the entered query', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Customer Minh')
    await user.type(screen.getByPlaceholderText(/Search by customer name, email, or phone/i), 'minh')

    await waitFor(() => {
      expect(adminSupportApi.searchCustomers).toHaveBeenLastCalledWith('minh')
    })
  })
})
