import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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

vi.mock('../../features/membership/api/membershipApi', () => ({
  membershipApi: {
    getCurrentMembership: vi.fn(),
  },
}))

const { coachApi } = await import('../../features/coach/api/coachApi')
const { coachBookingApi } = await import('../../features/coach/api/coachBookingApi')
const { membershipApi } = await import('../../features/membership/api/membershipApi')

function formatDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, amount) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

function getNextMondayOnOrAfter(date) {
  const currentDay = date.getDay()
  const daysUntilMonday = (8 - (currentDay === 0 ? 7 : currentDay)) % 7
  return addDays(date, daysUntilMonday)
}

function getMinimumBookingStartDate(baseDate = new Date()) {
  return getNextMondayOnOrAfter(addDays(baseDate, 7))
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CustomerCoachBookingPage />
    </MemoryRouter>,
  )
}

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
    membershipApi.getCurrentMembership.mockResolvedValue({
      data: {
        membership: {
          status: 'ACTIVE',
          plan: {
            name: 'Gym + Coach - 6 Months',
            planType: 'GYM_PLUS_COACH',
            allowsCoachBooking: true,
          },
        },
        validForCheckin: true,
        reason: null,
      },
    })
  })

  it('previews full matches when customer saves the planner selection and searches', async () => {
    const user = userEvent.setup()
    const minimumBookingStartDate = getMinimumBookingStartDate(new Date())
    const expectedEndDate = formatDateValue(addDays(minimumBookingStartDate, 28))
    renderPage()

    expect(screen.queryByText(/Fully Match/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Partial Match/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Open Schedule Planner/i }))
    expect(screen.getByRole('button', { name: /Monday/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sunday/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Repeat end date for booking/i }))
    expect(screen.getByText(/Pick a date inside your recurring booking window/i)).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /Close/i })[1])

    await user.click(screen.getByRole('button', { name: /Sunday/i }))
    const slotButton = await screen.findByRole('button', { name: /Slot 1/i })
    await user.click(slotButton)
    await user.click(screen.getByRole('button', { name: /Save and Search/i }))

    await waitFor(() => {
      expect(coachBookingApi.matchCoaches).toHaveBeenCalledWith({
        endDate: expectedEndDate,
        slots: [{ dayOfWeek: 7, timeSlotId: 1 }],
      })
    })

    expect(await screen.findByText(/Fully Match/i)).toBeInTheDocument()
    expect(screen.getByText(/Coach Alex/i)).toBeInTheDocument()
  }, 20000)

  it('shows denied request reason in schedule tab', async () => {
    coachBookingApi.getMySchedule.mockResolvedValue({
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
    renderPage()

    await user.click(screen.getByRole('button', { name: /My PT Schedule/i }))

    expect(await screen.findByText(/Denied Requests/i)).toBeInTheDocument()
    expect(screen.getByText(/Already fully booked in selected period/i)).toBeInTheDocument()
  })

  it('shows coaching dates with a green-marked calendar signal in My PT Schedule', async () => {
    coachBookingApi.getMySchedule.mockResolvedValue({
      data: {
        items: [
          {
            ptSessionId: 7,
            coachName: 'Coach Alex',
            sessionDate: '2026-03-16',
            slotIndex: 1,
            startTime: '07:00:00',
            endTime: '08:30:00',
            status: 'SCHEDULED',
          },
        ],
        pendingRequests: [],
        deniedRequests: [],
      },
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /My PT Schedule/i }))

    const sessionDay = await screen.findByRole('button', { name: /2026-03-16, 1 coaching slot/i })
    expect(sessionDay).toBeInTheDocument()

    await user.click(sessionDay)

    expect(await screen.findByText(/Coach Alex/i)).toBeInTheDocument()
    expect(screen.getByText(/Dates with coaching sessions are marked with a green signal in the calendar/i)).toBeInTheDocument()
  })

  it('shows coach cancellation reason on cancelled PT sessions', async () => {
    coachBookingApi.getMySchedule.mockResolvedValue({
      data: {
        items: [
          {
            ptSessionId: 8,
            coachName: 'Coach Alex',
            sessionDate: '2026-03-18',
            timeSlotId: 1,
            slotIndex: 1,
            startTime: '07:00:00',
            endTime: '08:30:00',
            status: 'CANCELLED',
            cancelReason: 'Coach had an emergency meeting',
          },
        ],
        pendingRequests: [],
        deniedRequests: [],
      },
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /My PT Schedule/i }))
    await user.click(await screen.findByRole('button', { name: /2026-03-18, 1 coaching slot/i }))

    expect(await screen.findByText(/Cancellation reason: Coach had an emergency meeting/i)).toBeInTheDocument()
  })

  it('opens a confirmation modal before cancelling a scheduled PT session', async () => {
    coachBookingApi.getMySchedule.mockResolvedValue({
      data: {
        items: [
          {
            ptSessionId: 7,
            coachName: 'Coach Alex',
            sessionDate: '2026-03-16',
            timeSlotId: 1,
            slotIndex: 1,
            startTime: '07:00:00',
            endTime: '08:30:00',
            status: 'SCHEDULED',
          },
        ],
        pendingRequests: [],
        deniedRequests: [],
      },
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /My PT Schedule/i }))
    await user.click(await screen.findByRole('button', { name: /2026-03-16, 1 coaching slot/i }))

    await user.click(await screen.findByRole('button', { name: /^Cancel$/i }))

    expect(await screen.findByText(/Cancel this coaching session\?/i)).toBeInTheDocument()
    expect(screen.getByText(/This will notify the coach/i)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Reason for cancellation/i), 'Family emergency')

    await user.click(screen.getByRole('button', { name: /Confirm cancel/i }))

    await waitFor(() => {
      expect(coachBookingApi.cancelSession).toHaveBeenCalledWith(7, { cancelReason: 'Family emergency' })
    })
  })

  it('opens a reschedule modal and sends the customer request to the coach', async () => {
    coachBookingApi.getMySchedule.mockResolvedValue({
      data: {
        items: [
          {
            ptSessionId: 7,
            coachName: 'Coach Alex',
            sessionDate: '2026-03-16',
            timeSlotId: 1,
            slotIndex: 1,
            startTime: '07:00:00',
            endTime: '08:30:00',
            status: 'SCHEDULED',
          },
        ],
        pendingRequests: [],
        deniedRequests: [],
      },
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /My PT Schedule/i }))
    await user.click(await screen.findByRole('button', { name: /2026-03-16, 1 coaching slot/i }))
    await user.click(await screen.findByRole('button', { name: /^Reschedule$/i }))

    expect(await screen.findByText(/Request a new date and time/i)).toBeInTheDocument()
    expect(screen.getByText(/must approve the new session schedule/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/New date/i), '2026-03-18')
    await user.selectOptions(screen.getByLabelText(/New time slot/i), '2')
    await user.type(screen.getByLabelText(/Reason \(optional\)/i), 'Need a later slot')
    await user.click(screen.getByRole('button', { name: /Send reschedule request/i }))

    await waitFor(() => {
      expect(coachBookingApi.rescheduleSession).toHaveBeenCalledWith(7, {
        sessionDate: '2026-03-18',
        timeSlotId: 2,
        reason: 'Need a later slot',
      })
    })
  })

  it('blocks planner and match preview when the customer does not have an active Gym + Coach membership', async () => {
    membershipApi.getCurrentMembership.mockResolvedValueOnce({
      data: {
        membership: {
          status: 'ACTIVE',
          plan: {
            name: 'Gym Only - 1 Month',
            planType: 'GYM_ONLY',
            allowsCoachBooking: false,
          },
        },
        validForCheckin: true,
        reason: null,
      },
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Open Schedule Planner/i }))

    expect(await screen.findByText(/Coach booking is locked for your current membership/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Buy Gym \+ Coach plan/i })).toHaveAttribute('href', '/customer/membership')

    await user.click(screen.getByRole('button', { name: /Close membership popup/i }))

    await user.click(screen.getByRole('button', { name: /2\) Preview Matches/i }))

    expect(await screen.findByText(/Coach booking is locked for your current membership/i)).toBeInTheDocument()
    expect(coachBookingApi.matchCoaches).not.toHaveBeenCalled()
  })

  it('blocks coach booking when membership is active but not Gym + Coach', async () => {
    membershipApi.getCurrentMembership.mockResolvedValueOnce({
      data: {
        membership: {
          status: 'ACTIVE',
          plan: {
            name: 'Legacy Coach Access',
            planType: 'GYM_ONLY',
            allowsCoachBooking: true,
          },
        },
        validForCheckin: true,
        reason: null,
      },
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Open Schedule Planner/i }))

    expect(await screen.findByText(/Coach booking is locked for your current membership/i)).toBeInTheDocument()
    expect(screen.getByText(/Upgrade to a Gym \+ Coach plan to continue/i)).toBeInTheDocument()
  })

  it('blocks the planner when a PT request is already pending approval', async () => {
    coachBookingApi.getMySchedule.mockResolvedValue({
      data: {
        items: [],
        pendingRequests: [
          {
            ptRequestId: 91,
            coachName: 'Coach Alex',
            startDate: '2026-03-09',
            endDate: '2026-04-06',
          },
        ],
        deniedRequests: [],
      },
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Open Schedule Planner/i }))

    expect(await screen.findByText(/You already have a PT booking in progress/i)).toBeInTheDocument()
    expect(screen.getByText(/pending coach approval/i)).toBeInTheDocument()
    expect(screen.queryByText(/Repeat end date for booking/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Open My PT Schedule/i }))

    expect(await screen.findByText(/Pending Requests/i)).toBeInTheDocument()
    expect(screen.getByText(/Coach Alex/i)).toBeInTheDocument()
  })

  it('blocks match preview when the customer already has an active PT schedule', async () => {
    coachBookingApi.getMySchedule.mockResolvedValueOnce({
      data: {
        items: [
          {
            ptSessionId: 7,
            ptRequestId: 99,
            coachId: 3,
            coachName: 'Coach Alex',
            sessionDate: '2099-03-16',
            dayOfWeek: 1,
            timeSlotId: 1,
            slotIndex: 1,
            startTime: '07:00:00',
            endTime: '08:30:00',
            status: 'SCHEDULED',
          },
        ],
        pendingRequests: [],
        deniedRequests: [],
      },
    })

    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /2\) Preview Matches/i }))

    expect(await screen.findByText(/You already have a PT booking in progress/i)).toBeInTheDocument()
    expect(screen.getByText(/active PT schedule/i)).toBeInTheDocument()
    expect(screen.getByText(/Next session: 2099-03-16/i)).toBeInTheDocument()
    expect(coachBookingApi.matchCoaches).not.toHaveBeenCalled()
  })

  it('groups selected recurring slots by weekday in the planner summary', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Open Schedule Planner/i }))
    await user.click(screen.getByRole('button', { name: /Monday/i }))
    await user.click(await screen.findByRole('button', { name: /Slot 1/i }))
    await user.click(screen.getByRole('button', { name: /Tuesday/i }))
    await user.click(screen.getByRole('button', { name: /Slot 2/i }))

    expect(screen.getAllByText(/Selected recurring slots/i).length).toBeGreaterThanOrEqual(1)
    const summarySelect = screen.getByLabelText('Weekday', { selector: '#customer-summary-day' })
    expect(summarySelect).toHaveTextContent('Monday')
    expect(screen.getAllByText(/1 slot\(s\) selected for Monday/i).length).toBeGreaterThanOrEqual(1)

    await user.click(summarySelect)
    await user.click(screen.getByRole('option', { name: /Tuesday/i }))

    expect(summarySelect).toHaveTextContent('Tuesday')
    expect(screen.getAllByText(/1 slot\(s\) selected for Tuesday/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Slot 2 \(08:30-10:00\)/i).length).toBeGreaterThanOrEqual(1)
  })
})
