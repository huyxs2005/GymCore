import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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

vi.mock('../../components/common/AiChatWidget', () => ({
  default: ({ quickActions = [], onAction }) => (
    <div data-testid="ai-chat-widget">
      {quickActions.map((action) => (
        <button key={action.id || action.route} type="button" onClick={() => onAction?.(action)}>
          Widget: {action.label}
        </button>
      ))}
    </div>
  ),
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
    askCoachBookingAssistant: vi.fn(),
    getPersonalizedFoodRecommendations: vi.fn(),
  },
}))

vi.mock('../../features/coach/api/coachApi', () => ({
  coachApi: {
    getTimeSlots: vi.fn(),
  },
}))

const { workoutApi } = await import('../../features/content/api/workoutApi')
const { foodApi } = await import('../../features/content/api/foodApi')
const { aiApi } = await import('../../features/content/api/aiApi')
const { coachApi } = await import('../../features/coach/api/coachApi')

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
    coachApi.getTimeSlots.mockResolvedValue({
      data: {
        items: [
          { timeSlotId: 1, startTime: '06:00:00', endTime: '07:00:00' },
          { timeSlotId: 2, startTime: '18:00:00', endTime: '19:00:00' },
        ],
      },
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
    aiApi.askCoachBookingAssistant.mockResolvedValue({
      answer: 'Booking matcher da duoc chay bang cung luat voi man Coach Booking.',
      matchStatus: 'READY',
      toDate: '2026-04-30',
      fullMatches: [
        {
          coachId: 51,
          fullName: 'Coach Linh',
          matchedSlots: 2,
          requestedSlots: 2,
        },
      ],
      partialMatches: [
        {
          coachId: 52,
          fullName: 'Coach Minh',
          matchedSlots: 1,
          requestedSlots: 2,
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
          id: 'book-coach-support',
          label: 'Get coach support if the week feels overloaded',
          route: '/customer/coach-booking',
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
    expect(screen.getByRole('button', { name: 'Build my weekly plan' })).toBeInTheDocument()
  })

  it('renders weekly-plan and recommendation guidance from the AI contracts', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Recommend from saved goals' }))
    await user.click(screen.getByRole('button', { name: 'Build my weekly plan' }))

    expect(await screen.findByText('Recommendation brief')).toBeInTheDocument()
    expect(await screen.findByText(/This week leans toward strength and protein support/i)).toBeInTheDocument()
    expect(screen.getByText(/Goal focus:/i)).toBeInTheDocument()
    expect(screen.getByText(/Progress context:/i)).toBeInTheDocument()
    expect(screen.getByText('Mini weekly plan')).toBeInTheDocument()
    expect(screen.getByText(/guidance-level weekly plan/i)).toBeInTheDocument()
    expect(screen.getByText('Scope guardrails')).toBeInTheDocument()
    expect(screen.getByText(/This weekly plan does not replace medical advice/i)).toBeInTheDocument()
  })

  it('opens knowledge details inline and routes non-knowledge actions through navigation', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Recommend from saved goals' }))

    await user.click(await screen.findAllByRole('button', { name: 'Open detail' }).then((buttons) => buttons[0]))
    expect(await screen.findByText('Brace, squat, and drive through the floor.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Review latest progress signals' }))
    expect(navigateMock).toHaveBeenCalledWith('/customer/progress-hub')

    await user.click(screen.getByRole('button', { name: 'Build my weekly plan' }))
    await user.click(await screen.findByRole('button', { name: 'Get coach support if the week feels overloaded' }))
    expect(navigateMock).toHaveBeenCalledWith('/customer/coach-booking')
  })

  it('surfaces AI action bridges inside the assistant and widget affordances', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText(/lich tap 4 buoi/i), 'Tao lich tap')
    await user.click(screen.getByRole('button', { name: 'Ask workout assistant' }))

    expect(await screen.findByText(/Prioritize the squat this week/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Barbell Back Squat' }))
    expect(await screen.findByText('Brace, squat, and drive through the floor.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Recommend from saved goals' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Widget: Review latest progress signals' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Widget: Review latest progress signals' }))
    expect(navigateMock).toHaveBeenCalledWith('/customer/progress-hub')
  })

  it('sends structured PT booking inputs to the coach assistant and renders matcher output', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText(/PT buoi toi/i), 'Toi muon lich toi on dinh')
    await user.selectOptions(screen.getByLabelText(/Recurring time slot/i), '2')
    await user.click(screen.getByRole('button', { name: /Add slot/i }))
    await user.click(screen.getByRole('button', { name: 'Ask coach assistant' }))

    await waitFor(() => {
      expect(aiApi.askCoachBookingAssistant.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          question: 'Toi muon lich toi on dinh',
          endDate: expect.any(String),
          slots: [{ dayOfWeek: 1, timeSlotId: 2 }],
        }),
      )
    })

    expect(await screen.findByText(/Booking matcher da duoc chay/i)).toBeInTheDocument()
    expect(screen.getByText('Full matches')).toBeInTheDocument()
    expect(screen.getByText('Coach Linh')).toBeInTheDocument()
  })
})
