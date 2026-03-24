import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminReportsPage from './AdminReportsPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../features/admin/api/adminApi', () => ({
  adminApi: {
    getRevenueOverview: vi.fn(),
    exportRevenueExcel: vi.fn(),
  },
}))

const { toast } = await import('react-hot-toast')
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
      <MemoryRouter initialEntries={['/admin/reports']}>
        <AdminReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AdminReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminApi.getRevenueOverview.mockResolvedValue({
      data: {
        range: { preset: '30d', from: '2026-02-07', to: '2026-03-07' },
        tiles: {
          todayRevenue: 1200,
          last7DaysRevenue: 7200,
          monthToDateRevenue: 15000,
          selectedRangeRevenue: 24000,
        },
        split: { memberships: 14000, products: 10000 },
        series: [
          { date: '2026-03-05', membershipRevenue: 2000, productRevenue: 1000, totalRevenue: 3000 },
          { date: '2026-03-06', membershipRevenue: 3500, productRevenue: 1500, totalRevenue: 5000 },
          { date: '2026-03-07', membershipRevenue: 8500, productRevenue: 7500, totalRevenue: 16000 },
        ],
      },
    })
    adminApi.exportRevenueExcel.mockResolvedValue({
      data: new Blob(['xlsx']),
      headers: { 'content-disposition': 'attachment; filename="GymCore_Revenue_2024.xlsx"' },
    })
    window.URL.createObjectURL = vi.fn(() => 'blob:report')
    window.URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the redesigned revenue page and loads the default report', async () => {
    renderPage()

    expect(await screen.findByText('Revenue analysis')).toBeInTheDocument()
    expect(screen.getByText('Report mode')).toBeInTheDocument()
    expect(screen.getByText('Applied filter')).toBeInTheDocument()
    expect(screen.getByText('Revenue movement')).toBeInTheDocument()
    expect(screen.getByText('Revenue composition')).toBeInTheDocument()
    expect(screen.getByText('Revenue by day')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Specific month/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Specific year/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /This month/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /This year/i })).not.toBeInTheDocument()
    expect(adminApi.getRevenueOverview).toHaveBeenCalledWith({ preset: '30d' })
  })

  it('switches to custom range mode and hides unrelated controls', async () => {
    renderPage()

    expect(await screen.findByText('Revenue analysis')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Custom range/i }))

    expect(screen.getByLabelText('Custom range from')).toBeInTheDocument()
    expect(screen.getByLabelText('Custom range to')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Today/i })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Custom range from'), { target: { value: '2026-03-01' } })
    fireEvent.change(screen.getByLabelText('Custom range to'), { target: { value: '2026-03-07' } })
    fireEvent.click(screen.getByLabelText('Apply custom range'))

    await waitFor(() => {
      expect(adminApi.getRevenueOverview).toHaveBeenLastCalledWith({
        preset: 'custom',
        from: '2026-03-01',
        to: '2026-03-07',
      })
    })
  })

  it('applies quick presets and exports Excel for the current applied filter', async () => {
    renderPage()

    expect(await screen.findByText('Revenue analysis')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /7 days/i }))

    await waitFor(() => {
      expect(adminApi.getRevenueOverview).toHaveBeenLastCalledWith({ preset: '7d' })
    })

    fireEvent.click(screen.getByRole('button', { name: /Export Excel/i }))

    await waitFor(() => {
      expect(adminApi.exportRevenueExcel).toHaveBeenCalledWith({ preset: '7d' })
    })
    expect(toast.success).toHaveBeenCalledWith('Revenue export ready: GymCore_Revenue_2024.xlsx')
  })
})


