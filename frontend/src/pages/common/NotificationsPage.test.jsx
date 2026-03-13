import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationsPage from './NotificationsPage'

vi.mock('../../features/notification/api/notificationApi', () => ({
  notificationApi: {
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAsUnread: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}))

const { notificationApi } = await import('../../features/notification/api/notificationApi')

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
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function buildNotification(overrides) {
  return {
    notificationId: 101,
    title: 'Membership expires soon',
    message: 'Your Gym + Coach - 1 Month membership expires in 3 days.',
    linkUrl: '/customer/current-membership',
    createdAt: '2026-03-02T07:15:00Z',
    isRead: false,
    type: 'MEMBERSHIP_EXPIRES_COUNTDOWN',
    reminder: {
      bucket: 'ACTIONABLE',
      category: 'MEMBERSHIP',
      destination: {
        label: 'View membership',
      },
    },
    ...overrides,
  }
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const membershipReminder = buildNotification({})
    const promotionReminder = buildNotification({
      notificationId: 102,
      title: 'New promotion available',
      message: 'Summer Plus Promo is now live.',
      linkUrl: '/customer/promotions',
      createdAt: '2026-03-02T06:00:00Z',
      type: 'PROMOTION_POST_PUBLISHED',
      reminder: {
        bucket: 'ACTIONABLE',
        category: 'PROMOTION',
        destination: {
          label: 'Open promotions',
        },
      },
    })
    const paidOrderHistory = buildNotification({
      notificationId: 103,
      title: 'Order paid',
      message: 'Your order payment was confirmed.',
      linkUrl: '/customer/orders',
      createdAt: '2026-03-01T07:15:00Z',
      isRead: true,
      type: 'ORDER_PAYMENT_SUCCESS',
      reminder: {
        bucket: 'HISTORY',
        category: 'COMMERCE',
        destination: {
          label: 'Open commerce',
        },
      },
    })

    notificationApi.getNotifications.mockResolvedValue({
      data: {
        unreadCount: 2,
        notifications: [membershipReminder, promotionReminder, paidOrderHistory],
        reminderCenter: {
          actionable: [membershipReminder, promotionReminder],
          history: [paidOrderHistory],
          counts: {
            total: 3,
            actionable: 2,
            history: 1,
          },
        },
      },
    })
    notificationApi.markAsRead.mockResolvedValue({ data: { success: true } })
    notificationApi.markAsUnread.mockResolvedValue({ data: { success: true } })
    notificationApi.markAllAsRead.mockResolvedValue({ data: { success: true } })
  })

  it('renders a reminder center with action-first sections and direct next actions', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Reminder Center')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Act now' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByText(/Membership expires in 3 days/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View membership' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open promotions' })).toBeInTheDocument()
    expect(screen.getByText(/Your order payment was confirmed/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Mark Read$/i }))

    await waitFor(() => {
      expect(notificationApi.markAllAsRead).toHaveBeenCalled()
    })
  })

  it('filters down to actionable reminders without rendering history cards', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/Membership expires soon/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Actionable reminders/i }))

    expect(screen.getByText(/Membership expires soon/i)).toBeInTheDocument()
    expect(screen.getByText(/New promotion available/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'History' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Order paid/i)).not.toBeInTheDocument()
  })

  it('marks a history notification as unread from the list', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/Order paid/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Mark Order paid as unread/i }))

    await waitFor(() => {
      expect(notificationApi.markAsUnread).toHaveBeenCalledWith(103)
    })
  })

  it('marks an actionable reminder as read from the left toggle button', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/Membership expires soon/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Mark Membership expires soon as read/i }))

    await waitFor(() => {
      expect(notificationApi.markAsRead).toHaveBeenCalledWith(101)
    })
  })
})
