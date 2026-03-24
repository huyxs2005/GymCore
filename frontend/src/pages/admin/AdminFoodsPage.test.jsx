import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminFoodsPage from './AdminFoodsPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ title, subtitle, children }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}))

vi.mock('../../features/content/api/adminFoodApi', () => ({
  adminFoodApi: {
    getFoods: vi.fn(),
    createFood: vi.fn(),
    updateFood: vi.fn(),
    archiveFood: vi.fn(),
    restoreFood: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  Toaster: () => null,
  toast: {
    error: vi.fn(),
  },
}))

const { adminFoodApi } = await import('../../features/content/api/adminFoodApi')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/foods']}>
        <AdminFoodsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function buildFoodsResponse() {
  return {
    items: [
      {
        foodId: 1,
        name: 'Chicken Breast',
        description: 'Lean protein source',
        recipe: 'Grill it.',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        imageUrl: 'https://example.com/chicken.jpg',
        active: true,
        categories: [{ foodCategoryId: 10, name: 'Protein', active: true }],
      },
      {
        foodId: 2,
        name: 'Oatmeal',
        description: 'Complex carbs',
        recipe: 'Cook with water.',
        calories: 150,
        protein: 5,
        carbs: 27,
        fat: 3,
        imageUrl: '',
        active: false,
        categories: [{ foodCategoryId: 11, name: 'Carbs', active: true }],
      },
    ],
    categories: [
      { foodCategoryId: 10, name: 'Protein', active: true },
      { foodCategoryId: 11, name: 'Carbs', active: true },
    ],
  }
}

describe('AdminFoodsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminFoodApi.getFoods.mockResolvedValue(buildFoodsResponse())
    adminFoodApi.createFood.mockResolvedValue({ foodId: 9 })
    adminFoodApi.updateFood.mockResolvedValue({ foodId: 1 })
    adminFoodApi.archiveFood.mockResolvedValue({ foodId: 1, active: false })
    adminFoodApi.restoreFood.mockResolvedValue({ foodId: 2, active: true })
  })

  it('creates a food with normalized payload and selected categories', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Chicken Breast')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /New food/i }))
    await user.type(screen.getByPlaceholderText('Chicken Breast'), ' Greek Yogurt ')
    await user.type(screen.getByPlaceholderText('Short overview...'), ' High protein snack ')
    await user.type(screen.getByPlaceholderText('Step-by-step recipe...'), ' Chill and serve ')
    await user.type(screen.getByPlaceholderText('165'), '120')
    await user.type(screen.getByPlaceholderText('31'), '12.5')
    await user.type(screen.getByPlaceholderText('0'), '9')
    await user.type(screen.getByPlaceholderText('3.6'), '0.5')
    await user.type(screen.getByPlaceholderText('https://...'), ' https://example.com/yogurt.jpg ')
    await user.click(screen.getByRole('button', { name: 'Carbs' }))
    await user.click(screen.getByRole('button', { name: /Save food/i }))

    await waitFor(() => {
      expect(adminFoodApi.createFood).toHaveBeenCalledWith({
        name: 'Greek Yogurt',
        description: 'High protein snack',
        recipe: 'Chill and serve',
        calories: 120,
        protein: 12.5,
        carbs: 9,
        fat: 0.5,
        imageUrl: 'https://example.com/yogurt.jpg',
        categoryIds: [10, 11],
        active: true,
      })
    })
  })

  it('shows custom validation for invalid macros before submit', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Chicken Breast')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /New food/i }))
    await user.type(screen.getByPlaceholderText('Chicken Breast'), ' Berry Smoothie ')
    await user.type(screen.getByPlaceholderText('165'), '-10')
    await user.click(screen.getByRole('button', { name: /Save food/i }))

    expect(await screen.findByText('Calories must be a non-negative number.')).toBeInTheDocument()
    expect(adminFoodApi.createFood).not.toHaveBeenCalled()
  })

  it('restores an archived food from the card action', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('Oatmeal')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Restore/i }))
    await user.click((await screen.findAllByRole('button', { name: /^Restore$/i }))[1])

    await waitFor(() => {
      expect(adminFoodApi.restoreFood).toHaveBeenCalledWith(2, expect.anything())
    })
  })
})


