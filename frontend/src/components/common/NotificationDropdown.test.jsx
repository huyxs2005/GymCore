import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationDropdown from './NotificationDropdown'

vi.mock('../../features/notification/api/notificationApi', () => ({
  notificationApi: {
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}))

const { notificationApi } = await import('../../features/notification/api/notificationApi')

function renderDropdown(initialEntries = ['/']) {
  function LocationProbe() {
    const location = useLocation()
    return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>
  }

  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>
        <NotificationDropdown />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function buildNotification(overrides) {
  return {
    notificationId: 11,
    title: 'Session cancelled by customer',
    message: 'Customer Minh cancelled the PT session on 2026-03-10 at 07:00-08:30.',
    linkUrl: '/coach/schedule',
    createdAt: '2026-03-02T10:15:00Z',
    isRead: false,
    type: 'PT_SESSION_CANCELLED_BY_CUSTOMER',
    reminder: {
      bucket: 'ACTIONABLE',
      category: 'PT',
      destination: {
        label: 'Open coach schedule',
      },
    },
    ...overrides,
  }
}

describe('NotificationDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    const actionableNotification = buildNotification({})
    const historyNotification = buildNotification({
      notificationId: 12,
      title: 'Coupon added to your wallet',
      message: 'Your promotion claim was saved successfully.',
      linkUrl: '/customer/promotions',
      createdAt: '2026-03-01T10:15:00Z',
      isRead: true,
      type: 'COUPON_CLAIMED',
      reminder: {
        bucket: 'HISTORY',
        category: 'PROMOTION',
        destination: {
          label: 'Open promotions',
        },
      },
    })

    notificationApi.getNotifications.mockResolvedValue({
      data: {
        unreadCount: 1,
        notifications: [actionableNotification, historyNotification],
        reminderCenter: {
          actionable: [actionableNotification],
          history: [historyNotification],
          counts: {
            total: 2,
            actionable: 1,
            history: 1,
          },
        },
      },
    })
    notificationApi.markAsRead.mockResolvedValue({ data: { success: true } })
    notificationApi.markAllAsRead.mockResolvedValue({ data: { success: true } })
  })

  it('renders reminder-center sections and keeps history visibly quieter', async () => {
    const user = userEvent.setup()
    renderDropdown()

    await user.click(screen.getByRole('button', { name: /open notifications/i }))

    expect(await screen.findByText('Reminder Center')).toBeInTheDocument()
    expect(screen.getByText('Act now')).toBeInTheDocument()
    expect(screen.getByText('Recent history')).toBeInTheDocument()
    expect(notificationApi.getNotifications).toHaveBeenCalledWith()
    expect(screen.getByTestId('dropdown-notification-11')).toHaveAttribute('data-notification-tone', 'primary')
    expect(screen.getByTestId('dropdown-notification-12')).toHaveAttribute('data-notification-tone', 'muted')
  })

  it('keeps read history actions accessible from the muted section', async () => {
    const user = userEvent.setup()
    renderDropdown()

    await user.click(screen.getByRole('button', { name: /open notifications/i }))
    await user.click(screen.getByRole('button', { name: 'Open promotions' }))

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/customer/promotions')
  })

  it('marks an actionable reminder as read from the dropdown', async () => {
    const user = userEvent.setup()
    renderDropdown()

    await user.click(screen.getByRole('button', { name: /open notifications/i }))
    await user.click(screen.getAllByRole('button', { name: /Mark read/i })[0])

    await waitFor(() => {
      expect(notificationApi.markAsRead).toHaveBeenCalledWith(11)
    })
  })

  it('opens coach reminders with the reminder-center action label', async () => {
    const user = userEvent.setup()
    renderDropdown()

    await user.click(screen.getByRole('button', { name: /open notifications/i }))
    await user.click(screen.getByRole('button', { name: 'Open coach schedule' }))

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/coach/schedule?tab=schedule')
  })

  it('marks all notifications as read from the footer action', async () => {
    const user = userEvent.setup()
    renderDropdown()

    await user.click(screen.getByRole('button', { name: /open notifications/i }))
    await user.click(screen.getAllByRole('button', { name: /mark read/i })[1])

    await waitFor(() => {
      expect(notificationApi.markAllAsRead).toHaveBeenCalled()
    })
  })

  it('navigates to notifications and jumps to the top from another page', async () => {
    const user = userEvent.setup()
    renderDropdown(['/customer/shop'])

    await user.click(screen.getByRole('button', { name: /open notifications/i }))
    await user.click(screen.getByRole('button', { name: /open reminder center/i }))

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/notifications')
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('smooth-scrolls to the top when reminder center is opened from the notifications page', async () => {
    const user = userEvent.setup()
    renderDropdown(['/notifications'])

    await user.click(screen.getByRole('button', { name: /open notifications/i }))
    await user.click(screen.getByRole('button', { name: /open reminder center/i }))

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/notifications')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})


