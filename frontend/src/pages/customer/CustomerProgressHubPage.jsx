import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  HeartPulse,
  LineChart,
  NotebookPen,
} from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { checkinApi } from '../../features/checkin/api/checkinApi'
import { healthApi } from '../../features/health/api/healthApi'

function resolveApiMessage(error, fallback) {
  return error?.response?.data?.message || fallback
}

function formatDate(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleDateString('en-GB')
}

function formatDateTime(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString('en-GB')
}

function formatMetric(value, unit, digits = 1) {
  const parsed = Number.parseFloat(String(value ?? ''))
  if (!Number.isFinite(parsed)) return '--'
  return `${parsed.toFixed(digits)} ${unit}`.trim()
}

function formatCount(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? String(parsed) : '0'
}

function getCurrentSnapshot(hub) {
  return hub?.currentSnapshot || hub?.currentHealth || {}
}

function getCoachNotes(hub) {
  return hub?.recentCoachNotes?.items || hub?.coachNotes?.items || []
}

function getHealthHistory(hub) {
  return hub?.healthHistory?.items || []
}

function getLatestSignal(hub) {
  return hub?.latestCoachingSignal || hub?.latestSignals?.mostRecent || {}
}

function getSignalLabel(signal) {
  const sourceType = String(signal?.sourceType || '').toUpperCase()
  if (sourceType === 'COACH_NOTE') return 'Latest coach note'
  if (sourceType === 'HEALTH_SNAPSHOT') return 'Latest progress update'
  return 'Latest coaching signal'
}

function getSignalSummaryLabel(signal) {
  const sourceType = String(signal?.sourceType || '').toUpperCase()
  if (sourceType === 'COACH_NOTE') return 'Coach-note signal'
  if (sourceType === 'HEALTH_SNAPSHOT') return 'Progress signal'
  return 'Latest coaching signal'
}

function getPtStatusLabel(ptContext) {
  return ptContext?.hasActivePt ? 'PT active' : 'PT not active'
}

function getRecommendedFocusLabel(value) {
  const normalized = String(value || '')
  if (!normalized) return 'No next step recorded'
  return normalized
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function CustomerProgressHubPage() {
  const [hub, setHub] = useState({})
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [checkinHistory, setCheckinHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      setError('')
      try {
        const [hubResponse, utilityResponse] = await Promise.all([
          healthApi.getProgressHub(),
          checkinApi.getUtilitySnapshot(),
        ])
        const hubData = hubResponse?.data || {}
        const qrToken = utilityResponse?.qr?.data?.qrCodeToken

        setHub(hubData)
        setCheckinHistory(utilityResponse?.history?.data?.items || [])

        if (qrToken) {
          QRCode.toDataURL(qrToken, { width: 240, margin: 2 }, (qrError, url) => {
            if (!qrError) {
              setQrDataUrl(url)
            }
          })
        } else {
          setQrDataUrl('')
        }
      } catch (loadError) {
        setError(resolveApiMessage(loadError, 'Failed to load your progress hub.'))
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  const currentSnapshot = getCurrentSnapshot(hub)
  const healthHistory = getHealthHistory(hub)
  const recentCoachNotes = getCoachNotes(hub)
  const ptContext = hub?.ptContext || {}
  const coach = ptContext?.coach || {}
  const nextSession = ptContext?.nextSession || {}
  const latestSignal = getLatestSignal(hub)
  const followUp = hub?.followUp || {}

  if (loading) {
    return (
      <WorkspaceScaffold title="Loading progress hub..." links={customerNav}>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gym-500 border-t-transparent" />
        </div>
      </WorkspaceScaffold>
    )
  }

  return (
    <WorkspaceScaffold
      title="Progress Hub"
      subtitle="Track your latest health progress, PT context, and coach guidance from one destination."
      links={customerNav}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_38%),linear-gradient(135deg,_rgba(10,10,15,0.98),_rgba(18,18,26,0.94)_55%,_rgba(38,25,6,0.92))] p-6 text-white shadow-ambient backdrop-blur-xl">
          <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gym-400">Customer follow-up</p>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-white">One place for your current progress and PT follow-up</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                  Review your latest body snapshot, recent coach signal, and PT schedule context without switching
                  between separate health and booking pages.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/customer/coach-booking"
                  className="inline-flex items-center gap-2 rounded-full bg-gym-600 px-5 py-2.5 text-sm font-bold text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition hover:bg-gym-500"
                >
                  Open PT dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/customer/checkin-health"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10 hover:border-white/30"
                >
                  Check-in utilities
                </Link>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
                  Read-only overview
                </span>
                <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
                  Coach-led follow-up
                </span>
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Live PT context
                </span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <article className="rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-md shadow-ambient-sm">
                <div className="flex items-center gap-2 text-rose-400">
                  <HeartPulse size={16} strokeWidth={2.5} />
                  <span className="text-xs font-bold uppercase tracking-[0.22em]">Current snapshot</span>
                </div>
                <p className="mt-4 text-3xl font-black text-white">{formatMetric(currentSnapshot?.bmi, 'BMI')}</p>
                <p className="mt-1 text-sm font-medium text-slate-400">
                  {formatMetric(currentSnapshot?.weightKg, 'kg')} at {formatMetric(currentSnapshot?.heightCm, 'cm')}
                </p>
              </article>

              <article className="rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-md shadow-ambient-sm">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CalendarDays size={16} strokeWidth={2.5} />
                  <span className="text-xs font-bold uppercase tracking-[0.22em]">PT status</span>
                </div>
                <p className="mt-4 text-3xl font-black text-white">{getPtStatusLabel(ptContext)}</p>
                <p className="mt-1 text-sm font-medium text-slate-400">{followUp?.nextSessionDate || nextSession?.sessionDate || 'No session scheduled yet'}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="gc-glass-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Today at a glance</p>
              <h3 className="mt-2 text-xl font-black text-white">Your latest signal, body snapshot, and PT status are already linked here.</h3>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400/80">Latest focus</p>
              <p className="mt-1 font-bold text-emerald-400">{followUp?.recommendedFocus ? `Next: ${getRecommendedFocusLabel(followUp?.recommendedFocus)}` : 'No next focus recorded yet'}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.5rem] border border-white/5 bg-white/5 p-5 transition hover:bg-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Latest snapshot</p>
              <p className="mt-3 text-2xl font-black text-white">{formatMetric(currentSnapshot?.weightKg, 'kg')}</p>
              <p className="mt-1 text-sm font-medium text-slate-400">{formatMetric(currentSnapshot?.heightCm, 'cm')} and {formatMetric(currentSnapshot?.bmi, 'BMI')}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/5 bg-white/5 p-5 transition hover:bg-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Latest coach signal</p>
              <p className="mt-3 text-lg font-black text-white">{getSignalSummaryLabel(latestSignal)}</p>
              <p className="mt-1 text-sm font-medium text-slate-400">{formatDateTime(latestSignal?.recordedAt)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/5 bg-white/5 p-5 transition hover:bg-white/10">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">PT follow-up</p>
              <p className="mt-3 text-lg font-black text-white">{coach?.coachName || nextSession?.coachName || 'No active coach assigned'}</p>
              <p className="mt-1 text-sm font-medium text-slate-400">{followUp?.nextSessionDate || nextSession?.sessionDate || 'No session scheduled yet'}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <article className="gc-glass-panel p-6 shadow-ambient hover:-translate-y-1 transition-transform">
            <div className="flex items-center gap-3 text-gym-500">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gym-500/10 border border-gym-500/20">
                <Activity size={20} strokeWidth={2.5} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-[0.16em]">Latest coaching signal</h3>
            </div>
            <p className="mt-5 text-xl font-black text-white">{getSignalLabel(latestSignal)}</p>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-400">{latestSignal?.summary || 'No coaching signal recorded yet.'}</p>
            <div className="mt-5 flex items-center border-t border-white/10 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {formatDateTime(latestSignal?.recordedAt)}
              </p>
            </div>
          </article>

          <article className="gc-glass-panel p-6 shadow-ambient hover:-translate-y-1 transition-transform">
            <div className="flex items-center gap-3 text-gym-500">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gym-500/10 border border-gym-500/20">
                <Dumbbell size={20} strokeWidth={2.5} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-[0.16em]">PT context</h3>
            </div>
            <p className="mt-5 text-xl font-black text-white">{coach?.coachName || nextSession?.coachName || 'No active coach assigned'}</p>
            <div className="mt-3 space-y-1.5 border-t border-white/10 pt-4">
              <p className="flex justify-between text-[13px] text-slate-400">
                <span>Status:</span> <span className="font-bold text-white">{ptContext?.currentPtStatus || 'NONE'}</span>
              </p>
              <p className="flex justify-between text-[13px] text-slate-400">
                <span>Next session:</span> <span className="font-bold text-white max-w-[120px] truncate text-right">{nextSession?.sessionDate || 'Not scheduled'}</span>
              </p>
            </div>
          </article>

          <article className="gc-glass-panel p-6 shadow-ambient hover:-translate-y-1 transition-transform">
            <div className="flex items-center gap-3 text-gym-500">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gym-500/10 border border-gym-500/20">
                <LineChart size={20} strokeWidth={2.5} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-[0.16em]">Progress summary</h3>
            </div>
            <p className="mt-5 text-4xl font-black text-white">{formatCount(followUp?.historyCount)}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-400">Recorded tracking history elements.</p>
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-[11px] font-bold text-slate-300">
                <span className="text-emerald-400">{formatCount(ptContext?.completedSessions)} done</span> / <span className="text-gym-500">{formatCount(ptContext?.remainingSessions)} left</span>
              </p>
            </div>
          </article>

          <article className="gc-glass-panel p-6 shadow-ambient hover:-translate-y-1 transition-transform border border-gym-500/20 bg-gym-500/5">
            <div className="flex items-center gap-3 text-gym-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gym-500/10 border border-gym-500/20">
                <ClipboardList size={20} strokeWidth={2.5} />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-[0.16em]">Recommended focus</h3>
            </div>
            <p className="mt-5 text-xl font-black text-gym-400">{getRecommendedFocusLabel(followUp?.recommendedFocus)}</p>
            <p className="mt-3 text-[13px] leading-relaxed text-slate-400">
              This hub is read-only. Your coach stays the source of truth for updates.
            </p>
          </article>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <article className="gc-glass-panel relative overflow-hidden p-6 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent group hover:border-emerald-500/40 transition-colors">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-[50px] group-hover:bg-emerald-500/30 transition-all"></div>
            <div className="relative">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={16} strokeWidth={2.5} />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Today on GymCore</h3>
              </div>
              <p className="mt-4 text-xl font-black text-white">Open your action page</p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                Record a new metric, show your QR, or inspect raw history.
              </p>
              <Link
                to="/customer/checkin-health"
                className="mt-6 inline-flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-bold text-emerald-400 transition hover:bg-emerald-500/20"
              >
                Open check-in & health
                <ArrowRight size={16} />
              </Link>
            </div>
          </article>

          <article className="gc-glass-panel relative overflow-hidden p-6 border-gym-500/20 bg-gradient-to-br from-gym-500/10 to-transparent group hover:border-gym-500/40 transition-colors">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gym-500/20 blur-[50px] group-hover:bg-gym-500/30 transition-all"></div>
            <div className="relative">
              <div className="flex items-center gap-2 text-gym-400">
                <Dumbbell size={16} strokeWidth={2.5} />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">PT workflow</h3>
              </div>
              <p className="mt-4 text-xl font-black text-white">Manage & follow status</p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                Preview matches, request trainers, or review status.
              </p>
              <Link
                to="/customer/coach-booking"
                className="mt-6 inline-flex w-full items-center justify-between rounded-xl border border-gym-500/30 bg-gym-500/10 px-5 py-3 text-sm font-bold text-gym-400 transition hover:bg-gym-500/20"
              >
                Manage PT dashboard
                <ArrowRight size={16} />
              </Link>
            </div>
          </article>

          <article className="gc-glass-panel relative overflow-hidden p-6 border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-transparent group hover:border-sky-500/40 transition-colors">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-500/20 blur-[50px] group-hover:bg-sky-500/30 transition-all"></div>
            <div className="relative">
               <div className="flex items-center gap-2 text-sky-400">
                <NotebookPen size={16} strokeWidth={2.5} />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Knowledge & AI</h3>
              </div>
              <p className="mt-4 text-xl font-black text-white">Smart recommendations</p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                Review tailored workouts, foods, and AI goals.
              </p>
              <Link
                to="/customer/knowledge"
                className="mt-6 inline-flex w-full items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 px-5 py-3 text-sm font-bold text-sky-400 transition hover:bg-sky-500/20"
              >
                Open knowledge AI
                <ArrowRight size={16} />
              </Link>
            </div>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
          <div className="space-y-6">
            <article className="gc-glass-panel p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    <HeartPulse size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-bold text-white">Current body snapshot</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/5 bg-black/20 px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Height</p>
                  <p className="mt-2 text-2xl font-black text-white">{formatMetric(currentSnapshot?.heightCm, 'cm')}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/20 px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Weight</p>
                  <p className="mt-2 text-2xl font-black text-white">{formatMetric(currentSnapshot?.weightKg, 'kg')}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/20 px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">BMI</p>
                  <p className="mt-2 text-2xl font-black text-white">{formatMetric(currentSnapshot?.bmi, '')}</p>
                </div>
              </div>
              <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="text-[11px] font-medium text-slate-500">Last updated metrics: <span className="text-slate-300 font-bold">{formatDate(currentSnapshot?.updatedAt)}</span></p>
              </div>
            </article>

            <article className="gc-glass-panel p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
                  <NotebookPen size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-bold text-white">Recent coach notes</h3>
              </div>
              <div className="space-y-4">
                {recentCoachNotes.length > 0 ? (
                  recentCoachNotes.slice(0, 4).map((note) => (
                    <div key={note.noteId || `${note.sessionDate}-${note.coachName}`} className="rounded-[1.25rem] border border-white/5 bg-white/5 p-5">
                      <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/20 text-xs font-bold text-sky-400 border border-sky-500/20">
                              {note.coachName?.charAt(0) || 'C'}
                            </div>
                            <p className="font-bold text-slate-200">{note.coachName || 'Coach update'}</p>
                        </div>
                        <span className="rounded-md bg-black/40 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 border border-white/10">
                          {formatDate(note.sessionDate || note.recordedAt)}
                        </span>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-300">
                          {note.noteContent || note.summary || 'No note content.'}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/20 p-8 text-center text-[13px] text-slate-500">
                    No coach notes available yet in your history.
                  </div>
                )}
              </div>
            </article>

            <article className="gc-glass-panel p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <LineChart size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-bold text-white">Health history context</h3>
              </div>
              <div className="space-y-3">
                {healthHistory.length > 0 ? (
                  healthHistory.slice(0, 5).map((item, index) => (
                    <div key={`${item.recordedAt || item.updatedAt}-${index}`} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-5 py-4 hover:bg-white/10 transition-colors">
                      <div>
                        <p className="font-bold text-slate-200">{formatDateTime(item.recordedAt || item.updatedAt)}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                          H: {formatMetric(item.heightCm, 'cm')} <span className="mx-1 text-slate-600">•</span> W: {formatMetric(item.weightKg, 'kg')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">BMI</p>
                        <p className="mt-0.5 text-lg font-black text-white">{formatMetric(item.bmi, '')}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-black/20 p-8 text-center text-[13px] text-slate-500">
                    No health history snapshot logged yet.
                  </div>
                )}
              </div>
            </article>
          </div>

          <div className="space-y-6">
            <article className="gc-glass-panel p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gym-500/10 text-gym-500 border border-gym-500/20">
                  <CalendarDays size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-bold text-white">PT follow-up details</h3>
              </div>
              <div className="space-y-4">
                <div className="rounded-[1.25rem] border border-white/5 bg-white/5 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Assigned Coach</p>
                  <p className="mt-2 text-xl font-black text-white">{coach?.coachName || nextSession?.coachName || 'Not assigned'}</p>
                </div>
                <div className="rounded-[1.25rem] border border-white/5 bg-white/5 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Upcoming session</p>
                  <p className="mt-2 text-xl font-black text-white">{nextSession?.sessionDate || 'No schedule set'}</p>
                  <p className="mt-1.5 text-[13px] text-gym-400 font-bold">
                    {nextSession?.startTime ? `${String(nextSession.startTime).slice(0, 5)} - ${String(nextSession.endTime || '').slice(0, 5)}` : 'Wait for scheduling.'}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/5 bg-white/5 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Model overview</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
                    Status <span className="font-black text-white">{ptContext?.currentPtStatus || 'NONE'}</span> with{' '}
                    <span className="font-black text-gym-400">{formatCount(ptContext?.remainingSessions)}</span> scheduled PT sessions left.
                  </p>
                </div>
              </div>
            </article>

            <article className="gc-glass-panel flex flex-col items-center justify-center p-6 text-center">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-white">QR & Check-in</h3>
                <p className="mt-2 text-[13px] text-slate-400 leading-relaxed">
                  Your QR is available for scanner verification.
                </p>
              </div>
              <div className="relative aspect-square w-[160px] overflow-hidden rounded-2xl border border-slate-200 p-2 shadow-inner" style={{ backgroundColor: '#ffffff' }}>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Check-in QR" className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-bold" style={{ color: '#94a3b8' }}>
                       Generating...
                    </div>
                  )}
              </div>
              <Link
                to="/customer/checkin-health"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 hover:border-white/20"
              >
                Access Full Check-in Utility
              </Link>
            </article>

            <article className="gc-glass-panel p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/20 text-slate-300 border border-slate-500/20">
                  <ClipboardList size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-lg font-bold text-white">Recent arrivals</h3>
              </div>
              <div className="space-y-3">
                {checkinHistory.length > 0 ? (
                  checkinHistory.slice(0, 4).map((item) => (
                    <div key={item.checkInId} className="rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 transition">
                      <p className="font-bold text-slate-200 text-[13px]">{formatDateTime(item.checkInTime)}</p>
                      <div className="mt-2 flex items-center justify-between">
                         <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500/80">{item.planName || 'Plan unspecified'}</p>
                         <p className="text-[10px] uppercase font-bold text-slate-500">
                           {item.checkedByName || 'Scanner Auto'}
                         </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-center text-[13px] text-slate-500">
                    No check-in trace found.
                  </div>
                )}
              </div>
            </article>
          </div>
        </section>
      </div>

      {error && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-rose-500/20 bg-[#12121a] px-6 py-4 text-sm font-bold text-slate-200 shadow-2xl">
          {error}
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CustomerProgressHubPage
