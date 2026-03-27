import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerKnowledgePage from './CustomerKnowledgePage'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/content/api/workoutApi', () => ({
  workoutApi: {
    getWorkouts: vi.fn(),
    getWorkoutDetail: vi.fn(),
  },
}))

vi.mock('../../features/content/api/foodApi', () => ({
  foodApi: {
    getFoods: vi.fn(),
    getFoodDetail: vi.fn(),
  },
}))

vi.mock('../../features/content/api/aiApi', () => ({
  aiApi: {
    getFitnessGoals: vi.fn(),
    getCustomerGoals: vi.fn(),
    updateCustomerGoals: vi.fn(),
    getRecommendations: vi.fn(),
    getWeeklyPlan: vi.fn(),
    askWorkoutAssistant: vi.fn(),
    getPersonalizedFoodRecommendations: vi.fn(),
  },
}))

const { workoutApi } = await import('../../features/content/api/workoutApi')
const { foodApi } = await import('../../features/content/api/foodApi')
const { aiApi } = await import('../../features/content/api/aiApi')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/customer/knowledge']}>
        <CustomerKnowledgePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CustomerKnowledgePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    workoutApi.getWorkouts.mockResolvedValue({
      items: [
        {
          workoutId: 11,
          name: 'Barbell Back Squat',
          description: 'Heavy lower-body strength work.',
          difficulty: 'Intermediate',
          categories: [{ workoutCategoryId: 1, name: 'Strength' }],
        },
      ],
      categories: [{ workoutCategoryId: 1, name: 'Strength' }],
    })
    workoutApi.getWorkoutDetail.mockResolvedValue({
      workoutId: 11,
      name: 'Barbell Back Squat',
      description: 'Heavy lower-body strength work.',
      instructions: 'Brace, squat, and drive through the floor.',
      categories: [{ workoutCategoryId: 1, name: 'Strength' }],
    })

    foodApi.getFoods.mockResolvedValue({
      items: [
        {
          foodId: 21,
          name: 'Chicken Rice Bowl',
          description: 'High-protein meal.',
          calories: 520,
          protein: 42,
          carbs: 48,
          fat: 12,
          categories: [{ foodCategoryId: 1, name: 'Meal Prep' }],
        },
      ],
      categories: [{ foodCategoryId: 1, name: 'Meal Prep' }],
    })
    foodApi.getFoodDetail.mockResolvedValue({
      foodId: 21,
      name: 'Chicken Rice Bowl',
      description: 'High-protein meal.',
      recipe: 'Cook chicken and rice, then portion with vegetables.',
      calories: 520,
      protein: 42,
      carbs: 48,
      fat: 12,
      categories: [{ foodCategoryId: 1, name: 'Meal Prep' }],
    })
    aiApi.getFitnessGoals.mockResolvedValue({
      items: [{ goalId: 9, goalCode: 'GAIN_MUSCLE', name: 'Gain muscle' }],
    })
    aiApi.getCustomerGoals.mockResolvedValue({
      items: [{ goalId: 9, goalCode: 'GAIN_MUSCLE', name: 'Gain muscle' }],
      goalCodes: ['GAIN_MUSCLE'],
    })
    aiApi.updateCustomerGoals.mockResolvedValue({ ok: true })
    aiApi.getPersonalizedFoodRecommendations.mockResolvedValue({ foods: [], followUpQuestions: [] })
    aiApi.askWorkoutAssistant.mockResolvedValue({
      answer: 'Prioritize the squat this week.',
      workouts: [
        {
          workoutId: 11,
          name: 'Barbell Back Squat',
          action: {
            id: 'view-top-workout',
            label: 'Open detail',
            route: '/customer/knowledge/workouts/11',
            type: 'route',
            workoutId: 11,
          },
        },
      ],
    })
    aiApi.getRecommendations.mockResolvedValue({
      source: 'PROFILE',
      goalCodes: ['GAIN_MUSCLE'],
      summary: {
        headline: 'This week leans toward strength and protein support.',
        rationale: 'Using saved goals, recent health/progress signals, latest coach note.',
        focus: 'Strength and protein support',
        safetyNote: 'Suggestions stay guidance-level and should not replace coach programming or medical advice.',
      },
      contextMeta: {
        usedSignals: ['goals', 'health', 'progress'],
      },
      contextHighlights: [
        { type: 'goal', label: 'Goal focus', value: 'GAIN_MUSCLE' },
        { type: 'progress', label: 'Progress context', value: 'Weight trend is stable.' },
      ],
      sections: [
        {
          id: 'workout-focus',
          title: 'Workout focus',
          itemType: 'workout',
          description: 'Recommended training ideas grounded in current goals and recent signals.',
          items: [
            {
              workoutId: 11,
              name: 'Barbell Back Squat',
              difficulty: 'Intermediate',
              reasons: ['Matches muscle-gain goal.'],
              action: {
                id: 'view-top-workout',
                label: 'Open detail',
                route: '/customer/knowledge/workouts/11',
                type: 'route',
                workoutId: 11,
              },
            },
          ],
        },
        {
          id: 'food-focus',
          title: 'Food emphasis',
          itemType: 'food',
          description: 'Nutrition ideas that complement the same context without replacing meal planning.',
          items: [
            {
              foodId: 21,
              name: 'Chicken Rice Bowl',
              calories: 520,
              reasons: ['High protein for muscle-gain context.'],
              action: {
                id: 'view-top-food',
                label: 'Open detail',
                route: '/customer/knowledge/foods/21',
                type: 'route',
                foodId: 21,
              },
            },
          ],
        },
      ],
      nextActions: [
        {
          id: 'view-top-workout',
          label: 'Open detail',
          route: '/customer/knowledge/workouts/11',
          type: 'route',
          workoutId: 11,
        },
        {
          id: 'review-progress-hub',
          label: 'Review latest progress signals',
          route: '/customer/progress-hub',
          type: 'route',
        },
      ],
      workouts: [{ workoutId: 11, name: 'Barbell Back Squat' }],
      foods: [{ foodId: 21, name: 'Chicken Rice Bowl' }],
    })
    aiApi.getWeeklyPlan.mockResolvedValue({
      contractVersion: 'ai-weekly-plan.v1',
      summary: {
        headline: 'A guidance-level weekly plan centered on strength and protein support.',
        coachNote: 'Use this as a weekly direction setter.',
      },
      contextMeta: {
        usedSignals: ['goals', 'health', 'progress'],
      },
      sections: [
        {
          id: 'workout-focus',
          title: 'Workout focus',
          intent: 'Strength and protein support',
          guidance: 'Prioritize 2 to 3 sessions built around the top suggested movements.',
          items: [
            {
              workoutId: 11,
              name: 'Barbell Back Squat',
              reasons: ['Matches muscle-gain goal.'],
            },
          ],
        },
        {
          id: 'food-emphasis',
          title: 'Food emphasis',
          intent: 'Support training with protein-forward meals.',
          guidance: 'Repeat a few easy-to-execute meals this week.',
          items: [
            {
              foodId: 21,
              name: 'Chicken Rice Bowl',
              reasons: ['High protein for muscle-gain context.'],
            },
          ],
        },
        {
          id: 'recovery-cues',
          title: 'Recovery cues',
          intent: 'Keep recovery aligned with the latest visible signals.',
          guidance: 'Leave room for at least one lighter day.',
          items: [{ id: 'recovery-day', label: 'Recovery day', detail: 'Keep one day mobility-first.' }],
        },
      ],
      nextActions: [
        {
          id: 'review-progress-hub',
          label: 'Review latest progress signals',
          route: '/customer/progress-hub',
          type: 'route',
        },
      ],
      scopeGuardrails: {
        level: 'guidance-only',
        coachDisclaimer: 'This weekly plan does not replace a coach.',
        medicalDisclaimer: 'This weekly plan does not replace medical advice.',
      },
    })
  })

  it('renders the knowledge and AI page shell', async () => {
    renderPage()

    expect(await screen.findByText('Knowledge & AI')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Workouts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Foods' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save my goals' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ask workout assistant' })).not.toBeInTheDocument()
  })

  it('does not show recommendation and weekly-plan sections before explicit requests', async () => {
    renderPage()

    expect(await screen.findByText('Saved fitness goals')).toBeInTheDocument()
    expect(screen.queryByText('Recommendation brief')).not.toBeInTheDocument()
    expect(screen.queryByText('Mini weekly plan')).not.toBeInTheDocument()
  })

  it('opens workout details inline from the workout catalog', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: /Barbell Back Squat/i }))
    expect(await screen.findByText('Brace, squat, and drive through the floor.')).toBeInTheDocument()
  })

  it('opens pending workout detail from session storage', async () => {
    const user = userEvent.setup()
    window.sessionStorage.setItem('gymcore.knowledge.openWorkoutId', '11')
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/customer/knowledge']}>
          <CustomerKnowledgePage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Workouts' }))
    expect(await screen.findByText('Brace, squat, and drive through the floor.')).toBeInTheDocument()
  })

})
