import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCoachManagementPage from './AdminCoachManagementPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/coach/api/coachBookingApi', () => ({
  coachBookingApi: {
    adminGetCoaches: vi.fn(),
    adminGetCoachDetail: vi.fn(),
    adminGetCoachPerformance: vi.fn(),
    adminGetCoachStudents: vi.fn(),
    adminUpdateCoachProfile: vi.fn(),
  },
}))

const { coachBookingApi } = await import('../../features/coach/api/coachBookingApi')

describe('AdminCoachManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    coachBookingApi.adminGetCoaches.mockResolvedValue({
      data: {
        items: [
          {
            coachId: 3,
            fullName: 'Coach Alex',
            email: 'coach.alex@gymcore.local',
            phone: '0900000003',
            experienceYears: 5,
            bio: 'Strength and conditioning',
            averageRating: 4.8,
            reviewCount: 7,
            studentCount: 4,
          },
          {
            coachId: 4,
            fullName: 'Coach Taylor',
            email: 'coach.taylor@gymcore.local',
            phone: '0900000005',
            experienceYears: 1,
            bio: 'New mobility coach',
            averageRating: 0,
            reviewCount: 0,
            studentCount: 0,
          },
        ],
      },
    })
    coachBookingApi.adminGetCoachDetail.mockResolvedValue({
      data: {
        coachId: 3,
        fullName: 'Coach Alex',
        email: 'coach.alex@gymcore.local',
        phone: '0900000003',
        avatarUrl: '',
        dateOfBirth: '1998-01-01',
        gender: 'Male',
        experienceYears: 5,
        bio: 'Strength and conditioning',
      },
    })
    coachBookingApi.adminGetCoachPerformance.mockResolvedValue({
      data: {
        averageRating: 4.8,
        totalReviews: 7,
        reviews: [
          {
            coachFeedbackId: 1,
            rating: 5,
            comment: 'Great coach',
            createdAt: '2026-03-07T08:00:00Z',
          },
        ],
      },
    })
    coachBookingApi.adminGetCoachStudents.mockResolvedValue({
      data: {
        items: [
          {
            customerId: 11,
            fullName: 'Customer Minh',
            email: 'customer@gymcore.local',
            completedSessions: 8,
            lastSession: '2026-03-05',
          },
        ],
      },
    })
    coachBookingApi.adminUpdateCoachProfile.mockResolvedValue({
      data: {
        coachId: 3,
        message: 'Profile updated.',
      },
    })
  })

  it('filters the coach list by rating and student load', async () => {
    const user = userEvent.setup()
    render(<AdminCoachManagementPage />)

    expect(await screen.findByText('Coach Alex')).toBeInTheDocument()
    expect(screen.getByText('Coach Taylor')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/Rating filter/i), 'high')
    await user.selectOptions(screen.getByLabelText(/Student filter/i), 'active')

    expect(screen.getByText('Coach Alex')).toBeInTheDocument()
    expect(screen.queryByText('Coach Taylor')).not.toBeInTheDocument()
  })

  it('shows custom validation before submitting coach profile updates', async () => {
    const user = userEvent.setup()
    render(<AdminCoachManagementPage />)

    await user.click((await screen.findAllByRole('button', { name: /Manage/i }))[0])
    await screen.findByDisplayValue('Coach Alex')

    await user.clear(screen.getByDisplayValue('Coach Alex'))
    await user.click(screen.getByRole('button', { name: /Save changes/i }))

    expect(await screen.findByText(/Coach full name is required\./i)).toBeInTheDocument()
    expect(coachBookingApi.adminUpdateCoachProfile).not.toHaveBeenCalled()
  })

  it('submits the expanded coach profile payload after validation passes', async () => {
    const user = userEvent.setup()
    render(<AdminCoachManagementPage />)

    await user.click((await screen.findAllByRole('button', { name: /Manage/i }))[0])
    await screen.findByDisplayValue('Coach Alex')

    const bioField = screen.getByPlaceholderText(/Describe the coach profile/i)
    await user.clear(bioField)
    await user.type(bioField, 'Updated profile bio')
    await user.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => {
      expect(coachBookingApi.adminUpdateCoachProfile).toHaveBeenCalledWith(3, expect.objectContaining({
        fullName: 'Coach Alex',
        phone: '0900000003',
        dateOfBirth: '1998-01-01',
        gender: 'Male',
        experienceYears: 5,
        bio: 'Updated profile bio',
      }))
    })
  })
})
