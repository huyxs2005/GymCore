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

describe('NotificationDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    notificationApi.getNotifications.mockResolvedValue({
      data: {
        unreadCount: 1,
        notifications: [
          {
            notificationId: 11,
            title: 'Session cancelled by customer',
            message: 'Customer Minh cancelled the PT session on 2026-03-10 at 07:00-08:30.',
            linkUrl: '/coach/schedule',
            createdAt: '2026-03-02T10:15:00Z',
            isRead: false,
            type: 'PT_SESSION_CANCELLED_BY_CUSTOMER',
          },
        ],
      },
    })
    notificationApi.markAsRead.mockResolvedValue({ data: { success: true } })
    notificationApi.markAllAsRead.mockResolvedValue({ data: { success: true } })
  })

  it('renders alerts dropdown and marks a notification as read', async () => {
    const user = userEvent.setup()
    renderDropdown()

    await user.click(screen.getByRole('button', { name: /open notifications/i }))

    expect(await screen.findByText('Alerts')).toBeInTheDocument()
    expect(screen.getByText(/Customer Minh cancelled the PT session/i)).toBeInTheDocument()
    expect(notificationApi.getNotifications).toHaveBeenCalledWith({ unreadOnly: true })

    await user.click(screen.getAllByRole('button', { name: /Mark read/i })[0])

    await waitFor(() => {
      expect(notificationApi.markAsRead).toHaveBeenCalledWith(11)
    })
  })

  it('opens coach PT notifications in the booked sessions tab', async () => {
    const user = userEvent.setup()
    renderDropdown()

    await user.click(screen.getByRole('button', { name: /open notifications/i }))
    await user.click((await screen.findAllByRole('button', { name: /Open/i }))[1])

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

  it('navigates to notifications and jumps to the top when show all is pressed from another page', async () => {
    const user = userEvent.setup()
    renderDropdown(['/customer/shop'])

    await user.click(screen.getByRole('button', { name: /open notifications/i }))
    await user.click(screen.getByRole('button', { name: /show all/i }))

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/notifications')
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('smooth-scrolls to the top when show all is pressed on the notifications page', async () => {
    const user = userEvent.setup()
    renderDropdown(['/notifications'])

    await user.click(screen.getByRole('button', { name: /open notifications/i }))
    await user.click(screen.getByRole('button', { name: /show all/i }))

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/notifications')
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})
