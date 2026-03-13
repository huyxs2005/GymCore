import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AiChatWidget from './AiChatWidget'

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
  },
}))

vi.mock('../../api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}))

const { apiClient } = await import('../../api/client')

describe('AiChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.post.mockResolvedValue({
      data: {
        data: {
          reply: 'Tap squat va theo doi phuc hoi.',
        },
      },
    })
  })

  it('shows quick actions and forwards the selected action', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()

    render(
      <AiChatWidget
        context={{ mode: 'WORKOUTS' }}
        quickActions={[
          { id: 'progress', label: 'Review latest progress signals', route: '/customer/progress-hub', type: 'route' },
        ]}
        onAction={onAction}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Open AI chat' }))
    expect(await screen.findByText('Quick actions')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Review latest progress signals' }))
    expect(onAction).toHaveBeenCalledWith({
      id: 'progress',
      label: 'Review latest progress signals',
      route: '/customer/progress-hub',
      type: 'route',
    })
  })

  it('posts normalized chat context when sending a message', async () => {
    const user = userEvent.setup()

    render(
      <AiChatWidget
        context={{
          mode: 'FOODS',
          selectedFood: { foodId: 21, name: 'Chicken Rice Bowl' },
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Open AI chat' }))
    await user.type(screen.getByRole('textbox'), 'Goi y bua sau tap')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/v1/ai/chat', {
        messages: [
          { role: 'assistant', content: expect.any(String) },
          { role: 'user', content: 'Goi y bua sau tap' },
        ],
        context: {
          mode: 'FOODS',
          selectedWorkout: null,
          selectedFood: { foodId: 21, name: 'Chicken Rice Bowl' },
        },
      })
    })

    expect(await screen.findByText('Tap squat va theo doi phuc hoi.')).toBeInTheDocument()
  })
})
