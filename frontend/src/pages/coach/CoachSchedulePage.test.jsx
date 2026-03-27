import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

    expect(await screen.findByRole('heading', { name: /weekly timetable/i })).toBeInTheDocument()
    expect(await screen.findByText(/1\/1 visible/i)).toBeInTheDocument()
    await userEvent.setup().click(await screen.findByRole('button', { name: /Customer Minh/i }))
    expect(await screen.findByRole('heading', { name: /10 Mar 2026/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Customer Minh/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Cancelled/i).length).toBeGreaterThan(0)
    expect(screen.getByText((content) => content.includes('Family emergency'))).toBeInTheDocument()
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

    expect(await screen.findByText(/1\/1 visible/i)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Customer Minh/i }))
    expect(await screen.findByRole('heading', { name: /Customer Minh/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Cancel$/i }))
    await user.type(screen.getByLabelText(/Rationale for Termination/i), 'Customer requested a makeup session')
    await user.click(screen.getByRole('button', { name: /Confirm Termination/i }))

    await waitFor(() => {
      expect(coachBookingApi.cancelCoachSession).toHaveBeenCalledWith(15, {
        cancelReason: 'Customer requested a makeup session',
      })
    })

    expect(await screen.findByText(/Session cancelled and the customer was notified/i)).toBeInTheDocument()
  }, 20000)

  it('filters the weekly timetable by selected customers', async () => {
    coachApi.getMyCoachSchedule.mockResolvedValue({
      data: {
        items: [
          {
            ptSessionId: 21,
            customerId: 101,
            customerName: 'Customer Minh',
            customerEmail: 'minh@gymcore.local',
            customerPhone: '0900000004',
            sessionDate: '2026-03-10',
            timeSlotId: 1,
            slotIndex: 1,
            startTime: '07:00:00',
            endTime: '08:30:00',
            status: 'SCHEDULED',
          },
          {
            ptSessionId: 22,
            customerId: 102,
            customerName: 'Customer Lan',
            customerEmail: 'lan@gymcore.local',
            customerPhone: '0900000005',
            sessionDate: '2026-03-11',
            timeSlotId: 1,
            slotIndex: 1,
            startTime: '07:00:00',
            endTime: '08:30:00',
            status: 'SCHEDULED',
          },
        ],
      },
    })

    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/coach/schedule?tab=schedule']}>
        <CoachSchedulePage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/2\/2 visible/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Customer Minh/i)).toBeChecked()
    expect(screen.getByLabelText(/Customer Lan/i)).toBeChecked()
    expect(await screen.findByRole('button', { name: /Customer Minh/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Customer Lan/i })).toBeInTheDocument()

    await user.click(screen.getByLabelText(/Customer Lan/i))

    expect(screen.getByText(/1\/2 visible/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Customer Lan/i })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /Customer Minh/i })).toBeInTheDocument()
  })
})
