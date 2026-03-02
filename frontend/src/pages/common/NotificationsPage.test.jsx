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

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notificationApi.getNotifications.mockResolvedValue({
      data: {
        unreadCount: 1,
        notifications: [
          {
            notificationId: 101,
            title: 'Membership payment successful',
            message: 'Your Gym + Coach - 1 Month membership payment was confirmed.',
            linkUrl: '/customer/current-membership',
            createdAt: '2026-03-02T07:15:00Z',
            isRead: false,
            type: 'MEMBERSHIP_PAYMENT_SUCCESS',
          },
          {
            notificationId: 102,
            title: 'New promotion available',
            message: 'Summer Plus Promo is now live.',
            linkUrl: '/customer/promotions',
            createdAt: '2026-03-01T07:15:00Z',
            isRead: true,
            type: 'PROMOTION_POST_PUBLISHED',
          },
        ],
      },
    })
    notificationApi.markAsRead.mockResolvedValue({ data: { success: true } })
    notificationApi.markAsUnread.mockResolvedValue({ data: { success: true } })
    notificationApi.markAllAsRead.mockResolvedValue({ data: { success: true } })
  })

  it('filters unread notifications and toggles read state', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Notifications')).toBeInTheDocument()
    expect(await screen.findByText(/Your Gym \+ Coach - 1 Month membership payment was confirmed/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Unread$/i }))

    expect(screen.getByText(/Your Gym \+ Coach - 1 Month membership payment was confirmed/i)).toBeInTheDocument()
    expect(screen.queryByText(/New promotion available/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mark Membership payment successful as read/i })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /^Mark Read$/i })[0])

    await waitFor(() => {
      expect(notificationApi.markAllAsRead).toHaveBeenCalled()
    })
  })

  it('marks a read notification as unread from the list', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/New promotion available/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Mark New promotion available as unread/i }))

    await waitFor(() => {
      expect(notificationApi.markAsUnread).toHaveBeenCalledWith(102)
    })
  })

  it('marks an unread notification as read from the left toggle button', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(/Membership payment successful/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Mark Membership payment successful as read/i }))

    await waitFor(() => {
      expect(notificationApi.markAsRead).toHaveBeenCalledWith(101)
    })
  })
})
