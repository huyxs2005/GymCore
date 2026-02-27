import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomerCoachBookingPage from './CustomerCoachBookingPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/coach/api/coachApi', () => ({
  coachApi: {
    getTimeSlots: vi.fn(),
  },
}))

vi.mock('../../features/coach/api/coachBookingApi', () => ({
  coachBookingApi: {
    matchCoaches: vi.fn(),
    createRequest: vi.fn(),
    getMySchedule: vi.fn(),
    cancelSession: vi.fn(),
    rescheduleSession: vi.fn(),
    submitFeedback: vi.fn(),
  },
}))

const { coachApi } = await import('../../features/coach/api/coachApi')
const { coachBookingApi } = await import('../../features/coach/api/coachBookingApi')

describe('CustomerCoachBookingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    coachApi.getTimeSlots.mockResolvedValue({
      data: {
        items: [
          { timeSlotId: 1, slotIndex: 1, startTime: '07:00:00', endTime: '08:30:00' },
          { timeSlotId: 2, slotIndex: 2, startTime: '08:30:00', endTime: '10:00:00' },
        ],
      },
    })
    coachBookingApi.matchCoaches.mockResolvedValue({
      data: {
        fullMatches: [
          {
            coachId: 3,
            fullName: 'Coach Alex',
            email: 'coach@gymcore.local',
            bio: 'Strength coach',
            matchedSlots: 1,
            requestedSlots: 1,
            unavailableSlots: [],
          },
        ],
        partialMatches: [],
      },
    })
    coachBookingApi.getMySchedule.mockResolvedValue({
      data: { items: [], pendingRequests: [], deniedRequests: [] },
    })
    coachBookingApi.createRequest.mockResolvedValue({ data: { ok: true } })
  })

  it('previews full matches after customer chooses desired slot and date range', async () => {
    const user = userEvent.setup()
    render(<CustomerCoachBookingPage />)

    await user.type(screen.getByLabelText(/Start date/i), '2026-03-01')
    await user.type(screen.getByLabelText(/End date/i), '2026-03-31')

    const slotButtons = await screen.findAllByRole('button', { name: /Slot 1/i })
    await user.click(slotButtons[0])
    await user.click(screen.getByRole('button', { name: /Preview Matches/i }))

    await waitFor(() => {
      expect(coachBookingApi.matchCoaches).toHaveBeenCalledWith({
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        slots: [{ dayOfWeek: 1, timeSlotId: 1 }],
      })
    })

    expect(await screen.findByText(/Fully Match/i)).toBeInTheDocument()
    expect(screen.getByText(/Coach Alex/i)).toBeInTheDocument()
  })

  it('shows denied request reason in schedule tab', async () => {
    coachBookingApi.getMySchedule.mockResolvedValueOnce({
      data: {
        items: [],
        pendingRequests: [],
        deniedRequests: [
          {
            ptRequestId: 99,
            coachName: 'Coach Alex',
            startDate: '2026-03-01',
            endDate: '2026-03-31',
            denyReason: 'Already fully booked in selected period',
          },
        ],
      },
    })

    const user = userEvent.setup()
    render(<CustomerCoachBookingPage />)

    await user.click(screen.getByRole('button', { name: /My PT Schedule/i }))

    expect(await screen.findByText(/Denied Requests/i)).toBeInTheDocument()
    expect(screen.getByText(/Already fully booked in selected period/i)).toBeInTheDocument()
  })
})
