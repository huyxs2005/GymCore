import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import CustomerKnowledgePage from './CustomerKnowledgePage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

describe('CustomerKnowledgePage', () => {
  it('renders the knowledge and AI starter module details', () => {
    render(
      <MemoryRouter initialEntries={['/customer/knowledge']}>
        <CustomerKnowledgePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Knowledge & AI module')).toBeInTheDocument()
    expect(screen.getByText('AI bot scope is recommendations for workouts + foods only.')).toBeInTheDocument()
    expect(screen.getByText('GET /api/v1/workouts/categories')).toBeInTheDocument()
    expect(screen.getByText('POST /api/v1/ai/recommendations')).toBeInTheDocument()
  })
})
