import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AiChatWidget, { buildWorkoutLinkChunks } from './AiChatWidget'

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

vi.mock('../../features/content/api/aiApi', () => ({
  aiApi: {
    askWorkoutAssistant: vi.fn(),
    askFoodAssistant: vi.fn(),
  },
}))

const { apiClient } = await import('../../api/client')
const { aiApi } = await import('../../features/content/api/aiApi')

describe('buildWorkoutLinkChunks', () => {
  it('matches longer workout names first and is case-insensitive', () => {
    const actions = [
      { type: 'open_workout_detail', workoutId: 1, label: 'demo' },
      { type: 'open_workout_detail', workoutId: 2, label: 'demo (beginer)' },
      { type: 'open_workout_detail', workoutId: 3, label: 'Push-up' },
    ]
    const chunks = buildWorkoutLinkChunks('- DEMO (beginer)\n- Push-up', actions)
    const workouts = chunks.filter((c) => c.type === 'workout')
    expect(workouts.map((c) => c.value)).toEqual(['DEMO (beginer)', 'Push-up'])
    expect(workouts[0].action.workoutId).toBe(2)
  })
})

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
    aiApi.askWorkoutAssistant.mockResolvedValue({
      answer: 'Nen uu tien cac bai sau:\n- Burpee\n- Push-up',
      workouts: [
        { workoutId: 1, name: 'Burpee' },
        { workoutId: 2, name: 'Push-up' },
      ],
    })
    aiApi.askFoodAssistant.mockResolvedValue({
      answer: 'Duoi day la mot so mon an ban co the tham khao:\n- Chicken\n- Oatmeal',
      foods: [
        { foodId: 1, name: 'Chicken' },
        { foodId: 2, name: 'Oatmeal' },
      ],
    })
  })

  it('does not render quick-action shortcut pills', async () => {
    const user = userEvent.setup()

    render(
      <AiChatWidget
        context={{ mode: 'WORKOUTS' }}
        quickActions={[{ id: 'qa-1', label: 'Open membership', route: '/customer/membership', type: 'route' }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Open AI chat' }))
    expect(screen.queryByRole('button', { name: 'Open membership' })).not.toBeInTheDocument()
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

  it('treats Vietnamese diacritics in workout questions as workout intent', async () => {
    const user = userEvent.setup()

    render(<AiChatWidget context={{ mode: 'WORKOUTS' }} />)

    await user.click(screen.getByRole('button', { name: 'Open AI chat' }))
    await user.type(screen.getByRole('textbox'), 'hãy gợi ý các bài tập tốt cho sức khỏe')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(aiApi.askWorkoutAssistant).toHaveBeenCalledWith(
        expect.objectContaining({
          question: 'hãy gợi ý các bài tập tốt cho sức khỏe',
          limitWorkouts: 4,
        }),
      )
    })
    expect(apiClient.post).not.toHaveBeenCalledWith('/v1/ai/chat', expect.any(Object))
  })

  it('uses workout assistant in workout mode and renders workout action chips', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()

    render(<AiChatWidget context={{ mode: 'WORKOUTS' }} onAction={onAction} />)

    await user.click(screen.getByRole('button', { name: 'Open AI chat' }))
    await user.type(screen.getByRole('textbox'), 'goi y buoi tap')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(aiApi.askWorkoutAssistant).toHaveBeenCalledWith({
        question: 'goi y buoi tap',
        limitWorkouts: 4,
      })
    })
    const burpeeButtons = screen.getAllByRole('button', { name: 'Burpee' })
    expect(burpeeButtons.length).toBeGreaterThanOrEqual(1)
    await user.click(burpeeButtons[0])
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'open_workout_detail', workoutId: 1 }),
    )

    await user.click(screen.getAllByRole('button', { name: 'Push-up' })[0])
    expect(onAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'open_workout_detail', workoutId: 2 }),
    )
  })

  it('uses food assistant for food intent and renders food chips', async () => {
    const user = userEvent.setup()
    const onAction = vi.fn()

    render(<AiChatWidget context={{ mode: 'WORKOUTS' }} onAction={onAction} />)

    await user.click(screen.getByRole('button', { name: 'Open AI chat' }))
    await user.type(screen.getByRole('textbox'), 'hay goi y mon an cho toi')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(aiApi.askFoodAssistant).toHaveBeenCalledWith({
        question: 'hay goi y mon an cho toi',
        limitFoods: 4,
      })
    })
    expect(aiApi.askWorkoutAssistant).not.toHaveBeenCalled()
    expect(apiClient.post).not.toHaveBeenCalledWith('/v1/ai/chat', expect.any(Object))

    const oatmealButtons = screen.getAllByRole('button', { name: 'Oatmeal' })
    expect(oatmealButtons.length).toBeGreaterThanOrEqual(1)
    await user.click(oatmealButtons[0])
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'open_food_detail', foodId: 2 }),
    )
  })

  it('uses general chat for greeting in workout mode', async () => {
    const user = userEvent.setup()

    render(<AiChatWidget context={{ mode: 'WORKOUTS' }} />)

    await user.click(screen.getByRole('button', { name: 'Open AI chat' }))
    await user.type(screen.getByRole('textbox'), 'xin chao')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => {
      expect(aiApi.askWorkoutAssistant).not.toHaveBeenCalled()
      expect(apiClient.post).toHaveBeenCalledWith('/v1/ai/chat', expect.any(Object))
    })
  })
})
