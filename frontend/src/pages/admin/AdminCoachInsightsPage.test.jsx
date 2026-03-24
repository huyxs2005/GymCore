import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminCoachInsightsPage from './AdminCoachInsightsPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('../../features/admin/api/adminApi', () => ({
  adminApi: {
    getCoachStudents: vi.fn(),
    getCoachFeedback: vi.fn(),
  },
}))

const { adminApi } = await import('../../features/admin/api/adminApi')

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/coach-insights']}>
        <AdminCoachInsightsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminCoachInsightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.getCoachStudents.mockResolvedValue({
      items: [
        { coachId: 3, coachName: 'Coach Alex', studentCount: 6 },
        { coachId: 4, coachName: 'Coach Taylor', studentCount: 0 },
        { coachId: 5, coachName: 'Coach Linh', studentCount: 2 },
      ],
    })
    adminApi.getCoachFeedback.mockResolvedValue({
      items: [
        { coachId: 3, coachName: 'Coach Alex', averageRating: 3.5, reviewCount: 4 },
        { coachId: 4, coachName: 'Coach Taylor', averageRating: 0, reviewCount: 0 },
        { coachId: 5, coachName: 'Coach Linh', averageRating: 4.9, reviewCount: 8 },
      ],
    })
  })

  it('renders actionable coach insight summaries from student and feedback data', async () => {
    renderPage()

    expect(await screen.findByText('Coach roster and feedback overview')).toBeInTheDocument()
    expect(screen.getByText('Turn student load and feedback into clear coach signals')).toBeInTheDocument()
    expect(screen.getByText('Coaches that deserve a closer look')).toBeInTheDocument()
    expect((await screen.findAllByText('High load, low satisfaction')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Needs students').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Coach Alex').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Coach Linh').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/6 active student/i).length).toBeGreaterThan(0)
  })

  it('filters the coach insight directory by signal and search', async () => {
    const user = userEvent.setup()
    renderPage()

    expect((await screen.findAllByText('High load, low satisfaction')).length).toBeGreaterThan(0)
    const directory = screen.getByText('Coach roster and feedback overview').closest('article')
    expect(directory).not.toBeNull()
    const directoryScope = within(directory)

    await user.click(screen.getByRole('button', { name: /Top performers/i }))
    expect(directoryScope.getAllByText('Coach Linh').length).toBeGreaterThan(0)
    expect(directoryScope.queryByText('Coach Taylor')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^All$/i }))
    await user.clear(screen.getByPlaceholderText(/Search by coach name/i))
    await user.type(screen.getByPlaceholderText(/Search by coach name/i), 'alex')
    expect(directoryScope.getByText('Coach Alex')).toBeInTheDocument()
    expect(directoryScope.queryByText('Coach Linh')).not.toBeInTheDocument()
  })
})


