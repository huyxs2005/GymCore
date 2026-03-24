import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CoachBookingManagementPage from './CoachBookingManagementPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/coach/api/coachBookingApi', () => ({
  coachBookingApi: {
    getPendingRequests: vi.fn(),
    getRescheduleRequests: vi.fn(),
    actionRequest: vi.fn(),
    approveRescheduleRequest: vi.fn(),
    denyRescheduleRequest: vi.fn(),
  },
}))

const { coachBookingApi } = await import('../../features/coach/api/coachBookingApi')

describe('CoachBookingManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders reschedule requests and approves one through the modal', async () => {
    coachBookingApi.getPendingRequests.mockResolvedValue({ data: { items: [] } })
    coachBookingApi.getRescheduleRequests.mockResolvedValue({
      data: {
        items: [
          {
            ptSessionId: 99,
            customerName: 'Customer Minh',
            customerEmail: 'customer@gymcore.local',
            currentSessionDate: '2026-03-01',
            currentTimeSlotId: 1,
            currentSlot: { slotIndex: 1 },
            requestedSessionDate: '2026-03-02',
            requestedTimeSlotId: 2,
            requestedSlot: { slotIndex: 2 },
            reason: 'Need to attend an exam',
            weeklyAvailable: true,
            hasConflict: false,
          },
        ],
      },
    })
    coachBookingApi.approveRescheduleRequest.mockResolvedValue({ data: { ok: true } })

    const user = userEvent.setup()
    render(<CoachBookingManagementPage />)

    expect(await screen.findByText(/Reschedule Requests/i)).toBeInTheDocument()
    expect(screen.getByText(/Need to attend an exam/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Approve$/i }))

    expect(screen.getByText(/Approve this reschedule request/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Approve request/i }))

    await waitFor(() => {
      expect(coachBookingApi.approveRescheduleRequest).toHaveBeenCalledWith(99)
    })
  })

  it('renders loading error when API fails', async () => {
    coachBookingApi.getPendingRequests.mockRejectedValue(new Error('network'))
    coachBookingApi.getRescheduleRequests.mockRejectedValue(new Error('network'))

    render(<CoachBookingManagementPage />)

    expect(await screen.findByText(/Cannot load booking requests/i)).toBeInTheDocument()
  })

  it('requires a deny reason for booking requests', async () => {
    coachBookingApi.getPendingRequests.mockResolvedValue({
      data: {
        items: [
          {
            ptRequestId: 25,
            customerName: 'Customer Minh',
            customerEmail: 'customer@gymcore.local',
            startDate: '2026-03-10',
            endDate: '2026-04-10',
            status: 'PENDING',
            createdAt: '2026-03-01T10:00:00Z',
          },
        ],
      },
    })
    coachBookingApi.getRescheduleRequests.mockResolvedValue({ data: { items: [] } })

    const user = userEvent.setup()
    render(<CoachBookingManagementPage />)

    await user.click(await screen.findByRole('button', { name: /^Deny$/i }))
    await user.click(screen.getByRole('button', { name: /Confirm denial/i }))

    expect(await screen.findByText(/Deny reason is required/i)).toBeInTheDocument()
    expect(coachBookingApi.actionRequest).not.toHaveBeenCalled()
  })

  it('denies a reschedule request with a coach reason', async () => {
    coachBookingApi.getPendingRequests.mockResolvedValue({ data: { items: [] } })
    coachBookingApi.getRescheduleRequests.mockResolvedValue({
      data: {
        items: [
          {
            ptSessionId: 88,
            customerName: 'Customer Minh',
            customerEmail: 'customer@gymcore.local',
            currentSessionDate: '2026-03-01',
            currentTimeSlotId: 1,
            currentSlot: { slotIndex: 1 },
            requestedSessionDate: '2026-03-04',
            requestedTimeSlotId: 2,
            requestedSlot: { slotIndex: 2 },
            weeklyAvailable: false,
            hasConflict: true,
          },
        ],
      },
    })
    coachBookingApi.denyRescheduleRequest.mockResolvedValue({ data: { ok: true } })

    const user = userEvent.setup()
    render(<CoachBookingManagementPage />)

    await user.click(await screen.findByRole('button', { name: /^Deny$/i }))
    await user.type(screen.getByLabelText(/Reason for denial/i), 'I already have another student in that slot')
    await user.click(screen.getByRole('button', { name: /Confirm denial/i }))

    await waitFor(() => {
      expect(coachBookingApi.denyRescheduleRequest).toHaveBeenCalledWith(88, {
        reason: 'I already have another student in that slot',
      })
    })
  })
})


