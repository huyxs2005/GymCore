import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CoachSchedulePage from './CoachSchedulePage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/coach/api/coachApi', () => ({
  coachApi: {
    getTimeSlots: vi.fn(),
    getMyCoachSchedule: vi.fn(),
    getMyAvailability: vi.fn(),
    updateAvailability: vi.fn(),
  },
}))

vi.mock('../../features/coach/api/coachBookingApi', () => ({
  coachBookingApi: {
    cancelCoachSession: vi.fn(),
    completeSession: vi.fn(),
    deleteSession: vi.fn(),
  },
}))

const { coachApi } = await import('../../features/coach/api/coachApi')
const { coachBookingApi } = await import('../../features/coach/api/coachBookingApi')

describe('CoachSchedulePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
    coachApi.getTimeSlots.mockResolvedValue({
      data: {
        items: [{ timeSlotId: 1, slotIndex: 1, startTime: '07:00', endTime: '08:30' }],
      },
    })
    coachApi.getMyAvailability.mockResolvedValue({ data: { weeklyAvailability: [] } })
    coachApi.updateAvailability.mockResolvedValue({ data: { ok: true } })
  })

  it('shows the customer cancellation reason on cancelled coach sessions', async () => {
    coachApi.getMyCoachSchedule.mockResolvedValue({
      data: {
        items: [
          {
            ptSessionId: 11,
            customerName: 'Customer Minh',
            customerEmail: 'customer@gymcore.local',
            customerPhone: '0900000004',
            sessionDate: '2026-03-10',
            timeSlotId: 1,
            slotIndex: 1,
            startTime: '07:00:00',
            endTime: '08:30:00',
            status: 'CANCELLED',
            cancelReason: 'Family emergency',
          },
        ],
      },
    })

    render(
      <MemoryRouter initialEntries={['/coach/schedule?tab=schedule']}>
        <CoachSchedulePage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Customer Minh/i)).toBeInTheDocument()
    expect(screen.getByText(/Cancellation reason: Family emergency/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Booked sessions/i }).className).toContain('border-gym-600')
    const cancelledDayButton = screen.getByRole('button', { name: /2026-03-10, 1 booked session/i })
    expect(cancelledDayButton).toBeInTheDocument()
    expect(cancelledDayButton.className).toContain('ring-sky-400')
    const redSignal = within(cancelledDayButton).getByText('', { selector: 'span.bg-red-500' })
    expect(redSignal).toBeInTheDocument()
  })

  it('submits the coach cancellation reason through the custom modal', async () => {
    coachApi.getMyCoachSchedule.mockResolvedValue({
      data: {
        items: [
          {
            ptSessionId: 15,
            customerName: 'Customer Minh',
            customerEmail: 'customer@gymcore.local',
            customerPhone: '0900000004',
            sessionDate: '2026-03-12',
            timeSlotId: 1,
            slotIndex: 1,
            startTime: '07:00:00',
            endTime: '08:30:00',
            status: 'SCHEDULED',
          },
        ],
      },
    })
    coachBookingApi.cancelCoachSession.mockResolvedValue({ data: { status: 'CANCELLED' } })

    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/coach/schedule?tab=schedule']}>
        <CoachSchedulePage />
      </MemoryRouter>,
    )

    await user.click(await screen.findByRole('button', { name: /2026-03-12, 1 booked session/i }))
    await user.click(await screen.findByRole('button', { name: /^Cancel$/i }))
    await user.type(screen.getByLabelText(/Reason for cancellation/i), 'Customer requested a makeup session')
    await user.click(screen.getByRole('button', { name: /Confirm cancel/i }))

    await waitFor(() => {
      expect(coachBookingApi.cancelCoachSession).toHaveBeenCalledWith(15, {
        cancelReason: 'Customer requested a makeup session',
      })
    })

    expect(await screen.findByText(/Session cancelled and the customer was notified/i)).toBeInTheDocument()
  }, 20000)

  it('groups selected availability by weekday instead of one flat slot list', async () => {
    coachApi.getMyAvailability.mockResolvedValue({
      data: {
        weeklyAvailability: [
          { dayOfWeek: 1, timeSlotId: 1 },
          { dayOfWeek: 2, timeSlotId: 1 },
        ],
      },
    })

    render(
      <MemoryRouter initialEntries={['/coach/schedule']}>
        <CoachSchedulePage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Selected availability/i)).toBeInTheDocument()
    const weekdaySelect = screen.getByLabelText(/Weekday/i)
    expect(weekdaySelect).toHaveTextContent('Monday')
    expect(screen.getByText(/1 slot\(s\) selected for Monday/i)).toBeInTheDocument()
  })
})


