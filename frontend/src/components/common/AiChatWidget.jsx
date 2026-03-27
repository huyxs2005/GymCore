import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiClient } from '../../api/client'
import { aiApi } from '../../features/content/api/aiApi'

/** Lowercase + strip Vietnamese diacritics so "bài tập" matches keywords like "bai tap". */
function normalizeTextForKeywords(text) {
  const lower = String(text || '').trim().toLowerCase()
  if (!lower) return ''
  return lower
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
}

function detectLanguageFromText(text) {
  const sample = String(text || '').trim().toLowerCase()
  if (!sample) return null
  const vietnamesePattern = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/
  if (vietnamesePattern.test(sample)) return 'vi'
  const vietnameseKeywords = ['toi', 'ban', 'giam can', 'tang can', 'bua an', 'tap', 'bai tap', 'huan luyen', 'dinh duong', 'thuc don']
  if (vietnameseKeywords.some((keyword) => sample.includes(keyword))) return 'vi'
  if (/[a-z]/.test(sample)) return 'en'
  return null
}

function detectPreferredLanguage() {
  if (typeof window === 'undefined') return 'en'
  const candidates = [
    window.localStorage?.getItem('gymcore.ai.language'),
    window.navigator?.language,
    ...(Array.isArray(window.navigator?.languages) ? window.navigator.languages : []),
  ]
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim().toLowerCase()
    if (!normalized) continue
    if (normalized.startsWith('vi')) return 'vi'
    if (normalized.startsWith('en')) return 'en'
  }
  return 'en'
}

function getLocalizedCopy(language) {
  const bilingualGreeting = 'Hello. I can help with workouts, meals, and next-step guidance in GymCore. What are you exploring today?\n\nXin chào. Tôi có thể hỗ trợ về bài tập, bữa ăn và hướng dẫn bước tiếp theo trong GymCore. Bạn đang cần gì hôm nay?'
  if (language === 'vi') {
    return {
      greeting: bilingualGreeting,
      fallback: 'Tôi chưa thể trả lời lúc này. Vui lòng thử lại sau ít phút.',
      title: 'Tro ly GymCore',
      hint: 'Cuộn để xem bối cảnh, sau đó nhấn Enter để gửi.',
      placeholder: 'Đặt câu hỏi của bạn...',
      thinking: 'Đang suy nghĩ...',
      chatLabel: 'AI Chat',
    }
  }
  return {
    greeting: bilingualGreeting,
    fallback: 'I cannot answer that right now. Please try again in a moment.',
    title: 'GymCore assistant',
    hint: 'Scroll to review context, then press Enter to send.',
    placeholder: 'Ask your question...',
    thinking: 'Thinking...',
    chatLabel: 'AI Chat',
  }
}

function stripMarkdownArtifacts(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`{1,3}([^`]+)`{1,3}/g, '$1')
    .replace(/^[ \t]*[-*][ \t]+/gm, '• ')
    .replace(/^[ \t]*\d+\.[ \t]+/gm, '• ')
    .trim()
}

function normalizeMessages(messages, limit = 12) {
  const safe = Array.isArray(messages) ? messages.filter(Boolean) : []
  const trimmed = safe.slice(-Math.max(1, Number(limit) || 12))
  return trimmed
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || '').trim(),
    }))
    .filter((message) => message.content.length > 0)
}

/**
 * Split assistant text into plain segments and workout spans (by action labels).
 * Longer labels first; case-insensitive; left-to-right non-overlapping.
 */
export function buildWorkoutLinkChunks(content, actions) {
  const text = String(content ?? '')
  const workoutActions = (Array.isArray(actions) ? actions : []).filter(
    (a) =>
      a?.type === 'open_workout_detail' &&
      Number.isFinite(Number(a.workoutId)) &&
      Number(a.workoutId) > 0 &&
      String(a.label || '').trim().length > 0,
  )
  if (!text || workoutActions.length === 0) return [{ type: 'text', value: text }]

  const sorted = [...workoutActions].sort((a, b) => String(b.label).length - String(a.label).length)
  const lowerContent = text.toLowerCase()
  const chunks = []
  let i = 0

  while (i < text.length) {
    let bestIdx = -1
    let bestAction = null
    let bestLen = 0

    for (const action of sorted) {
      const label = String(action.label)
      const idx = lowerContent.indexOf(label.toLowerCase(), i)
      if (idx === -1) continue
      if (bestIdx === -1 || idx < bestIdx || (idx === bestIdx && label.length > bestLen)) {
        bestIdx = idx
        bestAction = action
        bestLen = label.length
      }
    }

    if (bestIdx === -1) {
      chunks.push({ type: 'text', value: text.slice(i) })
      break
    }

    if (bestIdx > i) {
      chunks.push({ type: 'text', value: text.slice(i, bestIdx) })
    }

    chunks.push({
      type: 'workout',
      value: text.slice(bestIdx, bestIdx + bestLen),
      action: bestAction,
    })
    i = bestIdx + bestLen
  }

  return chunks
}

function normalizeWorkoutActions(workouts) {
  const safe = Array.isArray(workouts) ? workouts : []
  return safe
    .map((workout) => {
      const workoutId = Number(workout?.workoutId)
      const name = String(workout?.name || '').trim()
      if (!Number.isFinite(workoutId) || workoutId <= 0 || !name) return null
      return {
        id: `open-workout-${workoutId}`,
        label: name,
        type: 'open_workout_detail',
        workoutId,
        route: `/customer/knowledge?workoutId=${workoutId}`,
      }
    })
    .filter(Boolean)
}

function normalizeFoodActions(foods) {
  const safe = Array.isArray(foods) ? foods : []
  return safe
    .map((food) => {
      const foodId = Number(food?.foodId)
      const name = String(food?.name || '').trim()
      if (!Number.isFinite(foodId) || foodId <= 0 || !name) return null
      return {
        id: `open-food-${foodId}`,
        label: name,
        type: 'open_food_detail',
        foodId,
        route: `/customer/knowledge?foodId=${foodId}`,
      }
    })
    .filter(Boolean)
}

function isFoodIntent(text) {
  const normalized = normalizeTextForKeywords(text)
  if (!normalized) return false
  const foodKeywords = [
    'mon an',
    'thuc an',
    'bua an',
    'do an',
    'mon nuoc',
    'food',
    'meal',
    'meals',
    'dish',
    'dishes',
    'recipe',
    'snack',
    'breakfast',
    'lunch',
    'dinner',
    'nutrition',
    'diet',
    'calories',
    'macro',
    'protein bowl',
    'oatmeal',
  ]
  return foodKeywords.some((keyword) => normalized.includes(keyword))
}

function isWorkoutIntent(text) {
  const normalized = normalizeTextForKeywords(text)
  if (!normalized) return false
  const workoutKeywords = [
    'workout',
    'exercise',
    'training',
    'split',
    'routine',
    'program',
    'gym',
    'tap',
    'bai tap',
    'buoi tap',
    'lich tap',
    'cardio',
    'strength',
    'hiit',
    'van dong',
    'the duc',
    'tap luyen',
  ]
  return workoutKeywords.some((keyword) => normalized.includes(keyword))
}

function AiChatWidget({ context = {}, onAction }) {
  const [preferredLanguage, setPreferredLanguage] = useState(() => detectPreferredLanguage())
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [input, setInput] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const localizedCopy = useMemo(() => getLocalizedCopy(preferredLanguage), [preferredLanguage])
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      content: getLocalizedCopy(detectPreferredLanguage()).greeting,
      actions: [],
    },
  ])
  const listRef = useRef(null)

  const safeContext = useMemo(() => ({
    mode: context?.mode || 'WORKOUTS',
    selectedWorkout: context?.selectedWorkout || null,
    selectedFood: context?.selectedFood || null,
    preferredLanguage,
  }), [context, preferredLanguage])

  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length || prev[0]?.role !== 'assistant') return prev
      if (prev[0].content === localizedCopy.greeting) return prev
      return [{ ...prev[0], content: localizedCopy.greeting }, ...prev.slice(1)]
    })
  }, [localizedCopy.greeting])

  useEffect(() => {
    if (!open) return
    const element = listRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
  }, [messages, open])

  const cooldownSecondsLeft = useMemo(() => {
    const deltaMs = cooldownUntil - Date.now()
    if (deltaMs <= 0) return 0
    return Math.ceil(deltaMs / 1000)
  }, [cooldownUntil])

  const triggerAction = (action) => {
    if (!action) return
    if (typeof onAction === 'function') {
      onAction(action)
      return
    }
    const route = String(action?.route || '').trim()
    if (route && typeof window !== 'undefined') {
      window.location.assign(route)
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || pending) return
    if (cooldownUntil && Date.now() < cooldownUntil) return
    const inferredLanguage = detectLanguageFromText(text) || preferredLanguage
    setPreferredLanguage(inferredLanguage)
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem('gymcore.ai.language', inferredLanguage)
    }

    setInput('')
    setPending(true)
    setMessages((prev) => [...prev, { role: 'user', content: text }])

    try {
      if (safeContext.mode === 'WORKOUTS' && isWorkoutIntent(text)) {
        const data = await aiApi.askWorkoutAssistant({
          question: text,
          limitWorkouts: 4,
        })
        const reply = String(data?.answer || '').trim()
        if (!reply) {
          throw new Error('Empty workout assistant reply.')
        }
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: stripMarkdownArtifacts(reply),
            actions: normalizeWorkoutActions(data?.workouts),
          },
        ])
      } else if (isFoodIntent(text)) {
        const data = await aiApi.askFoodAssistant({
          question: text,
          limitFoods: 4,
        })
        const reply = String(data?.answer || '').trim()
        if (!reply) {
          throw new Error('Empty food assistant reply.')
        }
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: stripMarkdownArtifacts(reply),
            actions: normalizeFoodActions(data?.foods),
          },
        ])
      } else {
        const payload = {
          messages: normalizeMessages([...messages, { role: 'user', content: text }], 12),
          context: {
            ...safeContext,
            preferredLanguage: inferredLanguage,
          },
        }
        const response = await apiClient.post('/v1/ai/chat', payload)
        const reply = response?.data?.data?.reply || response?.data?.reply || ''
        if (!String(reply).trim()) {
          throw new Error('Empty AI reply.')
        }
        setMessages((prev) => [...prev, { role: 'assistant', content: stripMarkdownArtifacts(String(reply).trim()), actions: [] }])
      }
    } catch (error) {
      const status = error?.response?.status
      const message = error?.response?.data?.message || error?.message || 'AI chat failed.'
      if (status === 429) {
        const match = String(message).match(/retry in\s+(\d+)s/i)
        const seconds = match ? Number(match[1]) : 20
        if (Number.isFinite(seconds) && seconds > 0) {
          setCooldownUntil(Date.now() + seconds * 1000)
        }
      }
      toast.error(message)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: localizedCopy.fallback, actions: [] },
      ])
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-6 right-6 z-[120] w-[min(420px,calc(100vw-3rem))] overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(18,18,26,0.94)] shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <header className="flex items-start justify-between gap-3 border-b border-white/10 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(18,18,26,0.94)_48%)] px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{localizedCopy.chatLabel}</p>
              <p className="mt-1 font-display text-sm font-semibold tracking-tight text-slate-50">{localizedCopy.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {cooldownSecondsLeft > 0 ? `Cooling down: ${cooldownSecondsLeft}s` : localizedCopy.hint}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-50"
              aria-label="Close AI chat"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={listRef} className="gc-scrollbar-hidden max-h-[50vh] space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] space-y-2">
                  <div
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-6 ${
                      message.role === 'user' ? 'bg-gym-500 text-slate-950 shadow-glow' : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    {message.role === 'assistant' &&
                    Array.isArray(message.actions) &&
                    message.actions.some((a) => a?.type === 'open_workout_detail') ? (
                      buildWorkoutLinkChunks(message.content, message.actions).map((chunk, chunkIndex) =>
                        chunk.type === 'workout' ? (
                          <button
                            key={`w-${chunkIndex}-${chunk.action.workoutId}`}
                            type="button"
                            onClick={() => triggerAction(chunk.action)}
                            className="inline cursor-pointer border-0 bg-transparent p-0 align-baseline font-normal text-inherit no-underline shadow-none hover:text-inherit focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50"
                          >
                            {chunk.value}
                          </button>
                        ) : (
                          <span key={`t-${chunkIndex}`}>{chunk.value}</span>
                        ),
                      )
                    ) : (
                      message.content
                    )}
                  </div>
                  {message.role === 'assistant' && Array.isArray(message.actions) && message.actions.length ? (
                    <div className="flex flex-wrap gap-2">
                      {message.actions.map((action) => (
                        <button
                          key={action.id || action.label}
                          type="button"
                          onClick={() => triggerAction(action)}
                          className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-500">{localizedCopy.thinking}</div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-md">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
                placeholder={cooldownSecondsLeft > 0 ? 'Please wait...' : localizedCopy.placeholder}
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                disabled={pending || cooldownSecondsLeft > 0}
              />
              <button
                type="button"
                onClick={send}
                disabled={pending || cooldownSecondsLeft > 0 || !input.trim()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gym-500 text-slate-950 shadow-glow transition hover:brightness-110 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[110] inline-flex h-14 w-14 items-center justify-center rounded-full bg-gym-500 text-slate-950 shadow-glow transition hover:brightness-110 hover:shadow-glow-lg"
        aria-label="Open AI chat"
      >
        <MessageCircle size={22} />
      </button>
    </>
  )
}

export default AiChatWidget
