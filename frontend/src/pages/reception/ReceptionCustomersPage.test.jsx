import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ReceptionCustomersPage from './ReceptionCustomersPage'

vi.mock('../../components/frame/WorkspaceScaffold', () => ({
  default: ({ children }) => <div>{children}</div>,
}))

describe('ReceptionCustomersPage', () => {
  it('renders the reception customer lookup starter module', () => {
    render(
      <MemoryRouter initialEntries={['/reception/customers']}>
        <ReceptionCustomersPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Reception customer tools')).toBeInTheDocument()
    expect(screen.getByText('Fast lookup workflow for front desk operations.')).toBeInTheDocument()
    expect(screen.getByText('GET /api/v1/reception/customers/search')).toBeInTheDocument()
    expect(screen.getByText('GET /api/v1/reception/customers/{customerId}/membership')).toBeInTheDocument()
  })
})
