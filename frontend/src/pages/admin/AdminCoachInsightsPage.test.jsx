import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import AdminCoachInsightsPage from './AdminCoachInsightsPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

describe('AdminCoachInsightsPage', () => {
  it('renders the coach insights starter module details', () => {
    render(
      <MemoryRouter initialEntries={['/admin/coach-insights']}>
        <AdminCoachInsightsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Coach oversight module')).toBeInTheDocument()
    expect(screen.getByText('Admin-only module for coach performance and customer satisfaction visibility.')).toBeInTheDocument()
    expect(screen.getByText('GET /api/v1/admin/coaches/students')).toBeInTheDocument()
    expect(screen.getByText('GET /api/v1/admin/coaches/feedback')).toBeInTheDocument()
  })
})
