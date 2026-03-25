import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminUsersPage from './AdminUsersPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/users/api/adminUserApi', () => ({
  adminUserApi: {
    getUsers: vi.fn(),
    createStaff: vi.fn(),
    updateStaff: vi.fn(),
    lockUser: vi.fn(),
    unlockUser: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
  },
}))

const { adminUserApi } = await import('../../features/users/api/adminUserApi')
const { toast } = await import('react-hot-toast')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/users']}>
        <AdminUsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function buildUsersResponse() {
  return {
    data: {
      items: [
        {
          userId: 1,
          fullName: 'Admin GymCore',
          email: 'admin@gymcore.local',
          phone: '0900000001',
          role: 'ADMIN',
          active: true,
          locked: false,
          emailVerified: true,
          createdAt: '2026-03-07T08:00:00Z',
          authMode: 'PASSWORD',
          coachProfile: {},
        },
        {
          userId: 3,
          fullName: 'Coach Alex',
          email: 'coach@gymcore.local',
          phone: '0900000003',
          role: 'COACH',
          active: true,
          locked: false,
          emailVerified: true,
          createdAt: '2026-03-07T08:00:00Z',
          authMode: 'PASSWORD',
          coachProfile: {
            dateOfBirth: '1998-01-01',
            gender: 'Male',
            experienceYears: 5,
            bio: 'Strength coach',
          },
        },
        {
          userId: 4,
          fullName: 'Reception GymCore',
          email: 'reception@gymcore.local',
          phone: '0900000002',
          role: 'RECEPTIONIST',
          active: true,
          locked: true,
          emailVerified: true,
          createdAt: '2026-03-07T08:00:00Z',
          authMode: 'PASSWORD',
          coachProfile: {},
        },
      ],
      summary: {
        totalStaff: 3,
        adminCount: 1,
        coachCount: 1,
        receptionistCount: 1,
        lockedCount: 1,
        filteredCount: 3,
      },
    },
  }
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminUserApi.getUsers.mockResolvedValue(buildUsersResponse())
    adminUserApi.createStaff.mockResolvedValue({
      data: {
        user: {
          userId: 9,
          fullName: 'Reception New',
          email: 'new.reception@gymcore.local',
          phone: '0900000099',
          role: 'RECEPTIONIST',
          active: true,
          locked: false,
          emailVerified: true,
          authMode: 'PASSWORD',
          coachProfile: {},
        },
      },
    })
    adminUserApi.updateStaff.mockResolvedValue({ data: { user: { userId: 3 } } })
    adminUserApi.lockUser.mockResolvedValue({ data: { user: { userId: 3 } } })
    adminUserApi.unlockUser.mockResolvedValue({ data: { user: { userId: 4 } } })
  })

  it('renders staff summary and excludes customer from the role selector', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Admin GymCore')).toBeInTheDocument()
    const summaryCard = screen.getByText('Total staff').closest('div.rounded-3xl')
    expect(summaryCard).not.toBeNull()
    expect(within(summaryCard).getByText('3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /New staff/i }))
    const roleSelect = screen.getByLabelText(/^Role$/i)
    const options = within(roleSelect).getAllByRole('option').map((option) => option.textContent)

    expect(options).toEqual(['Admin', 'Coach', 'Receptionist'])
    expect(options).not.toContain('Customer')
  })

  it('filters staff by search, role, lock state, and active state', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Admin GymCore')).toBeInTheDocument()
    expect(screen.getByText('Coach Alex')).toBeInTheDocument()
    expect(screen.getByText('Reception GymCore')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/Search by name, email, or phone/i), 'coach')
    await user.selectOptions(screen.getByDisplayValue(/All staff roles/i), 'COACH')
    await user.selectOptions(screen.getByDisplayValue(/All lock states/i), 'false')
    await user.selectOptions(screen.getByDisplayValue(/All active states/i), 'true')

    await waitFor(() => {
      expect(adminUserApi.getUsers).toHaveBeenLastCalledWith({
        q: 'coach',
        role: 'COACH',
        locked: 'false',
        active: 'true',
      })
    })
  })

  it('creates a receptionist staff account and submits the expected payload', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /New staff/i }))
    await user.type(screen.getByLabelText(/Full name/i), 'Reception New')
    await user.type(screen.getByLabelText(/Email/i), 'new.reception@gymcore.local')
    await user.type(screen.getByLabelText(/^Phone$/i), '0900000099')
    await user.type(screen.getByLabelText(/Temporary password/i), 'Reception123!')
    await user.type(screen.getByLabelText(/Confirm password/i), 'Reception123!')
    await user.click(screen.getByRole('button', { name: /Create staff/i }))

    await waitFor(() => {
      expect(adminUserApi.createStaff).toHaveBeenCalledWith({
        fullName: 'Reception New',
        email: 'new.reception@gymcore.local',
        phone: '0900000099',
        role: 'RECEPTIONIST',
        password: 'Reception123!',
        confirmPassword: 'Reception123!',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('Staff account created.')
  })

  it('shows custom validation instead of submitting an empty staff form', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /New staff/i }))
    await user.click(screen.getByRole('button', { name: /Create staff/i }))

    expect(await screen.findByText(/Full name is required\./i)).toBeInTheDocument()
    expect(adminUserApi.createStaff).not.toHaveBeenCalled()
  })

  it('shows coach profile fields during edit and submits coach updates', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Coach Alex')
    const editButtons = screen.getAllByRole('button', { name: /^Edit$/i })
    await user.click(editButtons[1])

    expect(screen.getByText('Coach profile')).toBeInTheDocument()
    const bioField = screen.getByLabelText(/^Bio$/i)
    await user.clear(bioField)
    await user.type(bioField, 'Updated coach bio')
    await user.click(screen.getByRole('button', { name: /Save changes/i }))

    await waitFor(() => {
      expect(adminUserApi.updateStaff).toHaveBeenCalledWith(3, expect.objectContaining({
        fullName: 'Coach Alex',
        role: 'COACH',
        bio: 'Updated coach bio',
        experienceYears: 5,
      }))
    })
  })

  it('requires a lock reason before submitting the lock request', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Coach Alex')
    const lockButtons = screen.getAllByRole('button', { name: /^Lock$/i })
    await user.click(lockButtons[1])
    await user.click(screen.getByRole('button', { name: /Confirm lock/i }))

    expect(adminUserApi.lockUser).not.toHaveBeenCalled()
    expect(screen.getByText('Lock reason is required.')).toBeInTheDocument()
  })

  it('unlocks a locked staff account from the table action', async () => {
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Reception GymCore')
    await user.click(screen.getByRole('button', { name: /^Unlock$/i }))
    await user.click(screen.getByRole('button', { name: /Unlock account/i }))

    await waitFor(() => {
      expect(adminUserApi.unlockUser).toHaveBeenCalledWith(4)
    })
  })
})
