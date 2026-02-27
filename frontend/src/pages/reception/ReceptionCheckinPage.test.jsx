import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ReceptionCheckinPage from './ReceptionCheckinPage'

vi.mock('../../features/checkin/api/receptionCheckinApi', () => {
  return {
    receptionCheckinApi: {
      scan: vi.fn(),
      validateMembership: vi.fn(),
      getHistory: vi.fn(),
    },
  }
})

vi.mock('../../features/users/api/receptionCustomerApi', () => {
  return {
    receptionCustomerApi: {
      searchCustomers: vi.fn(),
      getMembership: vi.fn(),
    },
  }
})

const { receptionCheckinApi } = await import('../../features/checkin/api/receptionCheckinApi')
const { receptionCustomerApi } = await import('../../features/users/api/receptionCustomerApi')

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
        <ReceptionCheckinPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ReceptionCheckinPage', () => {
  beforeEach(() => {
    receptionCheckinApi.scan.mockReset()
    receptionCheckinApi.validateMembership.mockReset()
    receptionCheckinApi.getHistory.mockReset()
    receptionCustomerApi.searchCustomers.mockReset()
    receptionCustomerApi.getMembership.mockReset()

    receptionCheckinApi.getHistory.mockResolvedValue({ success: true, data: { items: [] } })
  })

  it('manual search + select + successful check-in', async () => {
    const user = userEvent.setup()
    receptionCustomerApi.searchCustomers.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            customerId: 5,
            fullName: 'Customer Minh',
            email: 'customer@gymcore.local',
            phone: '0900000004',
          },
        ],
      },
    })
    receptionCheckinApi.validateMembership.mockResolvedValue({
      success: true,
      data: {
        valid: true,
        reason: null,
        membership: {
          customerMembershipId: 11,
          planName: 'Gym + Coach - 6 Months',
          status: 'ACTIVE',
          startDate: '2026-02-17',
          endDate: '2026-08-15',
        },
      },
    })
    receptionCheckinApi.scan.mockResolvedValue({
      success: true,
      data: {
        checkInId: 100,
        checkInTime: '2026-02-17T13:00:00Z',
        customer: { customerId: 5, fullName: 'Customer Minh' },
      },
    })

    renderPage()

    await user.type(screen.getByPlaceholderText(/Type name or phone/i), 'minh')
    await user.click(screen.getByRole('button', { name: /^Search$/i }))
    await user.click(await screen.findByRole('button', { name: /Customer Minh/i }))

    expect(await screen.findByText(/Membership valid for check-in/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Check in selected customer/i }))

    expect(await screen.findByText(/Checked in Customer Minh/i)).toBeInTheDocument()
    expect(receptionCheckinApi.scan).toHaveBeenCalledWith({ customerId: 5 })
  })

  it('shows membership invalid reason on failed check-in', async () => {
    const user = userEvent.setup()
    receptionCustomerApi.searchCustomers.mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            customerId: 9,
            fullName: 'Customer Expired',
            email: 'expired@gymcore.local',
            phone: '0900009999',
          },
        ],
      },
    })
    receptionCheckinApi.validateMembership.mockResolvedValue({
      success: true,
      data: {
        valid: false,
        reason: 'Membership expired on 2026-02-16.',
        membership: {
          customerMembershipId: 20,
          planName: 'Gym Only - 1 Month',
          status: 'EXPIRED',
          startDate: '2026-01-17',
          endDate: '2026-02-16',
        },
      },
    })
    receptionCheckinApi.scan.mockRejectedValue({
      response: { data: { message: 'Membership expired on 2026-02-16.' } },
    })

    renderPage()

    await user.type(screen.getByPlaceholderText(/Type name or phone/i), 'expired')
    await user.click(screen.getByRole('button', { name: /^Search$/i }))
    await user.click(await screen.findByRole('button', { name: /Customer Expired/i }))

    const initialReasons = await screen.findAllByText(/Membership expired on 2026-02-16/i)
    expect(initialReasons.length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Check in selected customer/i }))

    const reasonsAfterCheckin = await screen.findAllByText(/Membership expired on 2026-02-16/i)
    expect(reasonsAfterCheckin.length).toBeGreaterThan(0)
    expect(receptionCheckinApi.scan).toHaveBeenCalledWith({ customerId: 9 })
  })

  it('shows API error when manual search fails', async () => {
    const user = userEvent.setup()
    receptionCustomerApi.searchCustomers.mockRejectedValue({
      response: { data: { message: 'Reception search failed.' } },
    })

    renderPage()

    await user.type(screen.getByPlaceholderText(/Type name or phone/i), 'minh')
    await user.click(screen.getByRole('button', { name: /^Search$/i }))

    expect(await screen.findByText(/Reception search failed\./i)).toBeInTheDocument()
  })

  it('does not show token paste fallback controls', async () => {
    renderPage()
    await screen.findByText(/No check-in records yet/i)

    expect(screen.queryByPlaceholderText(/paste qrCodeToken/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /Check in by token/i })).toBeNull()
  })
})
