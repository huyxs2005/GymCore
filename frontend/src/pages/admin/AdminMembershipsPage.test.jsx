import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AdminMembershipsPage from './AdminMembershipsPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/membership/api/adminMembershipApi', () => ({
  adminMembershipApi: {
    getPlans: vi.fn(),
    createPlan: vi.fn(),
    updatePlan: vi.fn(),
  },
}))

const { adminMembershipApi } = await import('../../features/membership/api/adminMembershipApi')

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminMembershipsPage />
    </QueryClientProvider>,
  )
}

function getFormField(labelText, selector = 'input') {
  const form = getPlanForm()
  const label = within(form).getByText(labelText, { selector: 'label' })
  return label.parentElement.querySelector(selector)
}

function getPlanForm() {
  const formHeading = screen.getByRole('heading', {
    name: /create membership plan|update membership plan/i,
  })
  return formHeading.closest('form')
}

describe('AdminMembershipsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminMembershipApi.getPlans.mockResolvedValue({ data: { plans: [] } })
    adminMembershipApi.createPlan.mockResolvedValue({ data: { plan: { planId: 101 } } })
    adminMembershipApi.updatePlan.mockResolvedValue({ data: { plan: { planId: 101 } } })
  })

  it('normalizes DAY_PASS payload before create', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /New plan/i }))

    const nameInput = getFormField('Plan name')
    const typeSelect = getFormField('Plan type', 'select')
    const priceInput = getFormField('Price (VND)')
    const durationInput = getFormField('Duration (days)')

    await user.clear(nameInput)
    await user.type(nameInput, 'Day Pass Special')
    await user.selectOptions(typeSelect, 'DAY_PASS')
    await user.clear(priceInput)
    await user.type(priceInput, '80000')

    expect(durationInput).toBeDisabled()
    expect(durationInput).toHaveValue(1)

    fireEvent.submit(getPlanForm())

    await waitFor(() => {
      expect(adminMembershipApi.createPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Day Pass Special',
          planType: 'DAY_PASS',
          price: 80000,
          durationDays: 1,
          allowsCoachBooking: false,
          active: true,
        }),
      )
    })
  })

  it('shows backend error when create fails', async () => {
    adminMembershipApi.createPlan.mockRejectedValue({
      response: { data: { message: 'Plan code already exists.' } },
    })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /New plan/i }))
    await user.clear(getFormField('Plan name'))
    await user.type(getFormField('Plan name'), 'Bad Plan')
    await user.clear(getFormField('Price (VND)'))
    await user.type(getFormField('Price (VND)'), '80000')
    fireEvent.submit(getPlanForm())

    expect(await screen.findByText(/Plan code already exists/i)).toBeInTheDocument()
  })
})
