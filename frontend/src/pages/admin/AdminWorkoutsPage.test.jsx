import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminWorkoutsPage from './AdminWorkoutsPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ title, subtitle, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}))

vi.mock('../../features/content/api/adminWorkoutApi', () => ({
  adminWorkoutApi: {
    getWorkouts: vi.fn(),
    createWorkout: vi.fn(),
    updateWorkout: vi.fn(),
    archiveWorkout: vi.fn(),
    restoreWorkout: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
  toast: {
    error: vi.fn(),
  },
}))

const { adminWorkoutApi } = await import('../../features/content/api/adminWorkoutApi')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/workouts']}>
        <AdminWorkoutsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function buildWorkoutsResponse() {
  return {
    items: [
      {
        workoutId: 1,
        name: 'Push-up',
        description: 'Upper body bodyweight',
        instructions: 'Keep body straight.',
        imageUrl: 'https://example.com/pushup.jpg',
        videoUrl: 'https://youtube.com/watch?v=push',
        difficulty: 'Beginner',
        active: true,
        categories: [{ workoutCategoryId: 10, name: 'Calisthenics', active: true }],
      },
      {
        workoutId: 2,
        name: 'Burpee',
        description: 'Conditioning exercise',
        instructions: 'Squat, kick back, jump.',
        imageUrl: '',
        videoUrl: '',
        difficulty: 'Intermediate',
        active: false,
        categories: [{ workoutCategoryId: 11, name: 'HIIT', active: true }],
      },
    ],
    categories: [
      { workoutCategoryId: 10, name: 'Calisthenics', active: true },
      { workoutCategoryId: 11, name: 'HIIT', active: true },
    ],
  }
}

describe('AdminWorkoutsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminWorkoutApi.getWorkouts.mockResolvedValue(buildWorkoutsResponse())
    adminWorkoutApi.createWorkout.mockResolvedValue({ workoutId: 9 })
    adminWorkoutApi.updateWorkout.mockResolvedValue({ workoutId: 1 })
    adminWorkoutApi.archiveWorkout.mockResolvedValue({ workoutId: 1, active: false })
    adminWorkoutApi.restoreWorkout.mockResolvedValue({ workoutId: 2, active: true })
  })

  it('creates a workout with normalized payload and category selection', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Push-up')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /New workout/i }))
    await user.type(screen.getByPlaceholderText('Push-up'), ' Mountain Climber ')
    await user.type(screen.getByPlaceholderText('Short overview for customers...'), ' Cardio bodyweight drill ')
    await user.type(screen.getByPlaceholderText('Step-by-step instructions...'), ' Drive knees toward chest quickly ')
    await user.type(screen.getByPlaceholderText('https://...'), ' https://example.com/mountain.jpg ')
    await user.type(screen.getByPlaceholderText('https://www.youtube.com/watch?v=...'), ' https://youtube.com/watch?v=mountain ')
    await user.type(screen.getByPlaceholderText('Beginner / Intermediate / Advanced'), ' Advanced ')
    await user.click(screen.getByRole('button', { name: 'HIIT' }))
    await user.click(screen.getByRole('button', { name: /Save workout/i }))

    await waitFor(() => {
      expect(adminWorkoutApi.createWorkout).toHaveBeenCalledWith({
        name: 'Mountain Climber',
        description: 'Cardio bodyweight drill',
        instructions: 'Drive knees toward chest quickly',
        imageUrl: 'https://example.com/mountain.jpg',
        videoUrl: 'https://youtube.com/watch?v=mountain',
        difficulty: 'Advanced',
        categoryIds: [10, 11],
        active: true,
      })
    })
  })

  it('shows custom validation when instructions are missing', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Push-up')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /New workout/i }))
    await user.type(screen.getByPlaceholderText('Push-up'), ' Squat Jump ')
    await user.click(screen.getByRole('button', { name: /Save workout/i }))

    expect(await screen.findByText('Workout instructions are required.')).toBeInTheDocument()
    expect(adminWorkoutApi.createWorkout).not.toHaveBeenCalled()
  })

  it('archives an active workout from the card action', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Push-up')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Archive/i }))
    await user.click((await screen.findAllByRole('button', { name: /^Archive$/i }))[1])

    await waitFor(() => {
      expect(adminWorkoutApi.archiveWorkout).toHaveBeenCalledWith(1, expect.anything())
    })
  })
})
