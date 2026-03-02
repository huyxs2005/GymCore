import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import CustomerCurrentMembershipPage from './CustomerCurrentMembershipPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: function WorkspaceScaffold({ title, children }) {
    return (
      <div>
        <h1>{title}</h1>
        {children}
      </div>
    )
  },
}))

vi.mock('../../features/membership/api/membershipApi', () => ({
  membershipApi: {
    getCurrentMembership: vi.fn(),
  },
}))

import { membershipApi } from '../../features/membership/api/membershipApi'

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CustomerCurrentMembershipPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CustomerCurrentMembershipPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the focused current-membership dashboard with quick actions', async () => {
    membershipApi.getCurrentMembership.mockResolvedValue({
      data: {
        membership: {
          status: 'ACTIVE',
          startDate: '2026-03-01',
          endDate: '2026-08-28',
          daysRemaining: 179,
          plan: {
            name: 'Gym + Coach - 6 Months',
            planType: 'GYM_PLUS_COACH',
            price: 4500,
            durationDays: 180,
            allowsCoachBooking: true,
          },
          payment: {
            status: 'PAID',
            originalAmount: 4500,
            discountAmount: 225,
            amount: 4275,
            coupon: {
              promoCode: 'SUMMERPLUS1M',
              applyTarget: 'MEMBERSHIP',
              bonusDurationMonths: 1,
            },
          },
        },
        validForCheckin: true,
        reason: null,
      },
    })

    renderPage()

    expect(await screen.findByText('Gym + Coach - 6 Months')).toBeInTheDocument()
    expect(screen.getAllByText('Coach booking').length).toBeGreaterThan(0)
    expect(screen.getByText('Unlocked')).toBeInTheDocument()
    expect(screen.getByText('Manage plans')).toBeInTheDocument()
    expect(screen.getByText('Check-in and health')).toBeInTheDocument()
    expect(screen.getByText('Payment Snapshot')).toBeInTheDocument()
    expect(screen.getByText('Applied coupon')).toBeInTheDocument()
    expect(screen.getByText('SUMMERPLUS1M')).toBeInTheDocument()
    expect(screen.getByText(/225 VND off/i)).toBeInTheDocument()
    expect(screen.getByText(/\+1 bonus month/i)).toBeInTheDocument()
  })

  it('renders an empty-state CTA when the customer has no membership yet', async () => {
    membershipApi.getCurrentMembership.mockResolvedValue({
      data: {
        membership: {},
        validForCheckin: false,
        reason: 'Customer does not have a membership.',
      },
    })

    renderPage()

    expect(await screen.findByText('You are not enrolled in a membership plan yet.')).toBeInTheDocument()
    expect(screen.getByText('Browse membership plans')).toBeInTheDocument()
    expect(screen.getByText('View promotions')).toBeInTheDocument()
  })
})
