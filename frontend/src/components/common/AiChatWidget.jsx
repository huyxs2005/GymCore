import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiClient } from '../../api/client'

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

function normalizeAvailableActions(actions) {
  return (Array.isArray(actions) ? actions : [])
    .filter((action) => action?.label && action?.route)
    .map((action) => ({
      id: action.id || action.route,
      label: String(action.label).trim(),
      route: String(action.route).trim(),
      type: action.type || 'route',
    }))
    .filter((action) => action.label && action.route)
}

function AiChatWidget({ context = {}, quickActions = [], onAction }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [input, setInput] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      content: 'Hello. I can help with workouts, meals, and next-step guidance. What are you exploring today?',
    },
  ])
  const listRef = useRef(null)

  const safeContext = useMemo(() => ({
    mode: context?.mode || 'WORKOUTS',
    selectedWorkout: context?.selectedWorkout || null,
    selectedFood: context?.selectedFood || null,
  }), [context])

  const visibleQuickActions = useMemo(() => normalizeAvailableActions(quickActions), [quickActions])

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

  const send = async () => {
    const text = input.trim()
    if (!text || pending) return
    if (cooldownUntil && Date.now() < cooldownUntil) return

    setInput('')
    setPending(true)
    setMessages((prev) => [...prev, { role: 'user', content: text }])

    try {
      const payload = {
        messages: normalizeMessages([...messages, { role: 'user', content: text }], 12),
        context: {
          ...safeContext,
          availableActions: visibleQuickActions,
        },
      }
      const response = await apiClient.post('/v1/ai/chat', payload)
      const reply = response?.data?.data?.reply || response?.data?.reply || ''
      if (!String(reply).trim()) {
        throw new Error('Empty AI reply.')
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: String(reply).trim() }])
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
        { role: 'assistant', content: 'I cannot answer that right now. Please try again in a moment.' },
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">AI Chat</p>
              <p className="mt-1 font-display text-sm font-semibold tracking-tight text-slate-50">GymCore assistant</p>
              <p className="mt-1 text-xs text-slate-500">
                {cooldownSecondsLeft > 0 ? `Cooling down: ${cooldownSecondsLeft}s` : 'Scroll to review context, then press Enter to send.'}
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
            {visibleQuickActions.length ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-3 shadow-ambient-sm backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Quick actions</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {visibleQuickActions.map((action) => (
                    <button
                      key={action.id || action.route}
                      type="button"
                      onClick={() => onAction?.(action)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gym-300 hover:bg-gym-50 hover:text-gym-700"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-6 ${
                    message.role === 'user' ? 'bg-gym-500 text-slate-950 shadow-glow' : 'bg-slate-100 text-slate-100'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-400">Thinking...</div>
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
                placeholder={cooldownSecondsLeft > 0 ? 'Please wait...' : 'Ask your question...'}
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
