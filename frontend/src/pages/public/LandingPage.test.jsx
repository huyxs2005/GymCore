import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LandingPage from './LandingPage'

describe('LandingPage', () => {
  it('renders the image-first hero without a hero CTA', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: /Go to Membership/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Explore Products/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Your fitness journey starts here/i })).toBeInTheDocument()
    expect(screen.getByText(/Step into a gym environment built for strength/i)).toBeInTheDocument()
  })
})
