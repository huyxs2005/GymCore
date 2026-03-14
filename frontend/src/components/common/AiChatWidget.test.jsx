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

  it('does not render the quick actions section', async () => {
    const user = userEvent.setup()

    render(<AiChatWidget context={{ mode: 'WORKOUTS' }} />)

    await user.click(screen.getByRole('button', { name: 'Open AI chat' }))
    expect(screen.queryByText(/Quick actions/i)).not.toBeInTheDocument()
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
          preferredLanguage: 'vi',
        },
      })
    })

    expect(await screen.findByText('Tap squat va theo doi phuc hoi.')).toBeInTheDocument()
  })

  it('uses browser language for the greeting and strips markdown artifacts from replies', async () => {
    const user = userEvent.setup()
    const originalLanguage = window.localStorage.getItem('gymcore.ai.language')

    window.localStorage.removeItem('gymcore.ai.language')
    Object.defineProperty(window.navigator, 'language', {
      configurable: true,
      value: 'vi-VN',
    })
    Object.defineProperty(window.navigator, 'languages', {
      configurable: true,
      value: ['vi-VN'],
    })
    apiClient.post.mockResolvedValueOnce({
      data: {
        data: {
          reply: '**Uc ga** giup no lau va giau protein.',
        },
      },
    })

    render(<AiChatWidget context={{ mode: 'FOODS' }} />)

    await user.click(screen.getByRole('button', { name: 'Open AI chat' }))
    expect(screen.getByText(/Hello\. I can help with workouts/i)).toBeInTheDocument()
    expect(screen.getByText(/Xin chào\. Tôi có thể hỗ trợ/i)).toBeInTheDocument()

    await user.type(screen.getByRole('textbox'), 'giam can')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/v1/ai/chat', expect.objectContaining({
        context: expect.objectContaining({
          preferredLanguage: 'vi',
        }),
      }))
    })

    expect(await screen.findByText('Uc ga giup no lau va giau protein.')).toBeInTheDocument()
    expect(screen.queryByText(/\*\*Uc ga\*\*/)).not.toBeInTheDocument()

    if (originalLanguage == null) {
      window.localStorage.removeItem('gymcore.ai.language')
    } else {
      window.localStorage.setItem('gymcore.ai.language', originalLanguage)
    }
  })
})
