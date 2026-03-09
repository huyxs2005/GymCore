import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CustomerKnowledgePage from './CustomerKnowledgePage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/content/api/workoutApi', () => ({
  workoutApi: {
    getWorkouts: vi.fn(() => Promise.resolve({ items: [], categories: [] })),
    getWorkoutDetail: vi.fn(() => Promise.resolve({})),
  },
}))

vi.mock('../../features/content/api/foodApi', () => ({
  foodApi: {
    getFoods: vi.fn(() => Promise.resolve({ items: [], categories: [] })),
    getFoodDetail: vi.fn(() => Promise.resolve({})),
  },
}))

vi.mock('../../features/content/api/aiApi', () => ({
  aiApi: {
    getRecommendations: vi.fn(() => Promise.resolve({ workouts: [], foods: [] })),
  },
}))

vi.mock('../../api/client', () => ({
  apiClient: {
    get: vi.fn(() => Promise.resolve({ data: { data: { items: [] } } })),
  },
}))

describe('CustomerKnowledgePage', () => {
  it('renders the knowledge and AI page shell', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/customer/knowledge']}>
          <CustomerKnowledgePage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByText('Knowledge & AI')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Workouts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Foods' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI Recommendations' })).toBeInTheDocument()
  })
})
