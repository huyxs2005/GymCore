import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiClient } from '../../api/client'

function normalizeMessages(messages, limit = 12) {
  const safe = Array.isArray(messages) ? messages.filter(Boolean) : []
  const trimmed = safe.slice(-Math.max(1, Number(limit) || 12))
  return trimmed.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').trim(),
  })).filter((m) => m.content.length > 0)
}

function AiChatWidget({ context = {} }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [input, setInput] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [messages, setMessages] = useState(() => [
    { role: 'assistant', content: 'Chào bạn! Mình có thể giúp về workout/food. Bạn cần gì?' },
  ])
  const listRef = useRef(null)

  const safeContext = useMemo(() => {
    return {
      mode: context?.mode || 'WORKOUTS',
      selectedWorkout: context?.selectedWorkout || null,
      selectedFood: context?.selectedFood || null,
    }
  }, [context])

  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
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
        context: safeContext,
      }
      const res = await apiClient.post('/v1/ai/chat', payload)
      const reply = res?.data?.data?.reply || res?.data?.reply || ''
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
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Xin lỗi, mình chưa trả lời được lúc này. Bạn thử lại nhé.' }])
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-6 right-6 z-[120] w-[min(420px,calc(100vw-3rem))] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">AI Chat</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">GymCore assistant</p>
              <p className="mt-1 text-xs text-slate-500">
                {cooldownSecondsLeft > 0 ? `Đang chờ quota: ${cooldownSecondsLeft}s` : 'Kéo để xem lịch sử, Enter để gửi.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close AI chat"
            >
              <X size={18} />
            </button>
          </header>

          <div ref={listRef} className="gc-scrollbar-hidden max-h-[50vh] space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, idx) => (
              <div key={`${m.role}-${idx}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-6 ${
                    m.role === 'user' ? 'bg-gym-600 text-white' : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-600">Đang trả lời...</div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    send()
                  }
                }}
                placeholder={cooldownSecondsLeft > 0 ? 'Vui lòng chờ...' : 'Nhập câu hỏi...'}
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                disabled={pending || cooldownSecondsLeft > 0}
              />
              <button
                type="button"
                onClick={send}
                disabled={pending || cooldownSecondsLeft > 0 || !input.trim()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gym-600 text-white transition hover:bg-gym-700 disabled:cursor-not-allowed disabled:opacity-60"
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
        className="fixed bottom-6 right-6 z-[110] inline-flex h-14 w-14 items-center justify-center rounded-full bg-gym-600 text-white shadow-xl transition hover:bg-gym-700"
        aria-label="Open AI chat"
      >
        <MessageCircle size={22} />
      </button>
    </>
  )
}

export default AiChatWidget

