import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminGoalsPage from './AdminGoalsPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ title, subtitle, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}))

vi.mock('../../features/content/api/adminGoalApi', () => ({
  adminGoalApi: {
    getGoals: vi.fn(),
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    archiveGoal: vi.fn(),
    restoreGoal: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
  toast: {
    error: vi.fn(),
  },
}))

const { adminGoalApi } = await import('../../features/content/api/adminGoalApi')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/goals']}>
        <AdminGoalsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function buildGoalsResponse() {
  return {
    items: [
      {
        goalId: 1,
        goalCode: 'GAIN_MUSCLE',
        name: 'Gain muscle',
        description: 'Build muscle mass safely.',
        active: true,
        workoutIds: [1],
        foodIds: [10],
        workouts: [{ workoutId: 1, name: 'Strength 101', active: true }],
        foods: [{ foodId: 10, name: 'Chicken Bowl', active: true }],
      },
      {
        goalId: 2,
        goalCode: 'CUTTING',
        name: 'Cutting',
        description: 'Lean down while preserving muscle.',
        active: false,
        workoutIds: [2],
        foodIds: [11],
        workouts: [{ workoutId: 2, name: 'HIIT Sprint', active: true }],
        foods: [{ foodId: 11, name: 'Greek Yogurt', active: true }],
      },
    ],
    workouts: [
      { workoutId: 1, name: 'Strength 101', active: true },
      { workoutId: 2, name: 'HIIT Sprint', active: true },
    ],
    foods: [
      { foodId: 10, name: 'Chicken Bowl', active: true },
      { foodId: 11, name: 'Greek Yogurt', active: true },
    ],
  }
}

describe('AdminGoalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminGoalApi.getGoals.mockResolvedValue(buildGoalsResponse())
    adminGoalApi.createGoal.mockResolvedValue({ goalId: 9 })
    adminGoalApi.updateGoal.mockResolvedValue({ goalId: 1 })
    adminGoalApi.archiveGoal.mockResolvedValue({ archived: true })
    adminGoalApi.restoreGoal.mockResolvedValue({ restored: true })
  })

  it('creates a goal with the normalized admin payload', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Gain muscle')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /New goal/i }))
    await user.type(screen.getByPlaceholderText('GAIN_MUSCLE'), ' FAT_LOSS ')
    await user.type(screen.getByPlaceholderText('Gain muscle'), ' Fat loss ')
    await user.type(screen.getByPlaceholderText(/Explain when this goal should be selected/i), ' Leaning phase ')
    await user.click(screen.getByRole('button', { name: /Create goal/i }))

    await waitFor(() => {
      expect(adminGoalApi.createGoal).toHaveBeenCalledWith({
        goalCode: 'FAT_LOSS',
        name: 'Fat loss',
        description: 'Leaning phase',
        active: true,
        workoutIds: [1],
        foodIds: [10],
      })
    })
  })

  it('archives an active goal from the card action', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Gain muscle')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Archive/i }))
    await user.click((await screen.findAllByRole('button', { name: /^Archive$/i }))[1])

    await waitFor(() => {
      expect(adminGoalApi.archiveGoal).toHaveBeenCalledWith(1, expect.anything())
    })
  })
})
