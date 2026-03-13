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

function getPtStatusLabel(ptContext) {
  return Boolean(ptContext?.hasActivePt) ? 'PT active' : 'PT not active'
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
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_38%),linear-gradient(135deg,_#0f172a,_#1e293b_55%,_#14532d)] p-6 text-white shadow-xl">
          <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">Customer follow-up</p>
              <div>
                <h2 className="text-3xl font-black tracking-tight">One place for your current progress and PT follow-up</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
                  Review your latest body snapshot, recent coach signal, and PT schedule context without switching
                  between separate health and booking pages.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/customer/coach-booking"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-emerald-50"
                >
                  Open PT dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/customer/checkin-health"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/20"
                >
                  Check-in utilities
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <article className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-emerald-200">
                  <HeartPulse className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.22em]">Current snapshot</span>
                </div>
                <p className="mt-3 text-2xl font-black">{formatMetric(currentSnapshot?.bmi, 'BMI')}</p>
                <p className="mt-1 text-sm text-slate-200">
                  {formatMetric(currentSnapshot?.weightKg, 'kg')} at {formatMetric(currentSnapshot?.heightCm, 'cm')}
                </p>
              </article>

              <article className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-emerald-200">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.22em]">PT status</span>
                </div>
                <p className="mt-3 text-2xl font-black">{getPtStatusLabel(ptContext)}</p>
                <p className="mt-1 text-sm text-slate-200">{followUp?.nextSessionDate || nextSession?.sessionDate || 'No session scheduled yet'}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="gc-card">
            <div className="flex items-center gap-2 text-gym-700">
              <Activity className="h-5 w-5" />
              <h3 className="text-sm font-bold uppercase tracking-[0.16em]">Latest coaching signal</h3>
            </div>
            <p className="mt-4 text-lg font-black text-slate-900">{getSignalLabel(latestSignal)}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{latestSignal?.summary || 'No coaching signal recorded yet.'}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {formatDateTime(latestSignal?.recordedAt)}
            </p>
          </article>

          <article className="gc-card">
            <div className="flex items-center gap-2 text-gym-700">
              <Dumbbell className="h-5 w-5" />
              <h3 className="text-sm font-bold uppercase tracking-[0.16em]">PT context</h3>
            </div>
            <p className="mt-4 text-lg font-black text-slate-900">{coach?.coachName || nextSession?.coachName || 'No active coach assigned'}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Status: <span className="font-semibold text-slate-800">{ptContext?.currentPtStatus || 'NONE'}</span>
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Next session: <span className="font-semibold text-slate-800">{nextSession?.sessionDate || 'Not scheduled'}</span>
            </p>
          </article>

          <article className="gc-card">
            <div className="flex items-center gap-2 text-gym-700">
              <LineChart className="h-5 w-5" />
              <h3 className="text-sm font-bold uppercase tracking-[0.16em]">Progress summary</h3>
            </div>
            <p className="mt-4 text-3xl font-black text-slate-900">{formatCount(followUp?.historyCount)}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Health records tracked in your progress history.</p>
            <p className="mt-3 text-sm font-semibold text-slate-800">
              {formatCount(ptContext?.completedSessions)} completed / {formatCount(ptContext?.remainingSessions)} remaining PT sessions
            </p>
          </article>

          <article className="gc-card">
            <div className="flex items-center gap-2 text-gym-700">
              <ClipboardList className="h-5 w-5" />
              <h3 className="text-sm font-bold uppercase tracking-[0.16em]">Recommended focus</h3>
            </div>
            <p className="mt-4 text-lg font-black text-slate-900">{getRecommendedFocusLabel(followUp?.recommendedFocus)}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This hub is read-only so your coach remains the source of truth for progress updates and session notes.
            </p>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.4fr,1fr]">
          <div className="space-y-6">
            <article className="gc-card">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-gym-600" />
                <h3 className="text-lg font-bold text-slate-900">Current body snapshot</h3>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Height</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{formatMetric(currentSnapshot?.heightCm, 'cm')}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Weight</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{formatMetric(currentSnapshot?.weightKg, 'kg')}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">BMI</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{formatMetric(currentSnapshot?.bmi, '')}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-500">Updated {formatDate(currentSnapshot?.updatedAt)}</p>
            </article>

            <article className="gc-card">
              <div className="flex items-center gap-2">
                <NotebookPen className="h-5 w-5 text-gym-600" />
                <h3 className="text-lg font-bold text-slate-900">Recent coach notes</h3>
              </div>
              <div className="mt-4 space-y-3">
                {recentCoachNotes.length > 0 ? (
                  recentCoachNotes.slice(0, 4).map((note) => (
                    <div key={note.noteId || `${note.sessionDate}-${note.coachName}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{note.coachName || 'Coach update'}</p>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {formatDate(note.sessionDate || note.recordedAt)}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{note.noteContent || note.summary || 'No note content.'}</p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    No coach notes available yet.
                  </p>
                )}
              </div>
            </article>

            <article className="gc-card">
              <div className="flex items-center gap-2">
                <LineChart className="h-5 w-5 text-gym-600" />
                <h3 className="text-lg font-bold text-slate-900">Health history</h3>
              </div>
              <div className="mt-4 space-y-3">
                {healthHistory.length > 0 ? (
                  healthHistory.slice(0, 5).map((item, index) => (
                    <div key={`${item.recordedAt || item.updatedAt}-${index}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="font-semibold text-slate-900">{formatDateTime(item.recordedAt || item.updatedAt)}</p>
                        <p className="text-sm text-slate-600">
                          {formatMetric(item.heightCm, 'cm')} | {formatMetric(item.weightKg, 'kg')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">BMI</p>
                        <p className="text-lg font-black text-slate-900">{formatMetric(item.bmi, '')}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    No health history recorded yet.
                  </p>
                )}
              </div>
            </article>
          </div>

          <div className="space-y-6">
            <article className="gc-card">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-gym-600" />
                <h3 className="text-lg font-bold text-slate-900">PT follow-up</h3>
              </div>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Coach</p>
                  <p className="mt-2 text-lg font-black text-slate-900">{coach?.coachName || nextSession?.coachName || 'Not assigned'}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Next session</p>
                  <p className="mt-2 text-lg font-black text-slate-900">{nextSession?.sessionDate || 'No next session'}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {nextSession?.startTime ? `${String(nextSession.startTime).slice(0, 5)}-${String(nextSession.endTime || '').slice(0, 5)}` : 'Use the PT dashboard for schedule details.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Read model</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Status <span className="font-semibold text-slate-900">{ptContext?.currentPtStatus || 'NONE'}</span> with{' '}
                    <span className="font-semibold text-slate-900">{formatCount(ptContext?.remainingSessions)}</span> scheduled PT sessions remaining.
                  </p>
                </div>
              </div>
            </article>

            <article className="gc-card">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-gym-600" />
                <h3 className="text-lg font-bold text-slate-900">Check-in utility</h3>
              </div>
              <div className="mt-4 space-y-4">
                <div className="flex justify-center rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Check-in QR" className="h-40 w-40 object-contain" />
                  ) : (
                    <div className="flex h-40 w-40 items-center justify-center text-sm text-slate-400">QR unavailable</div>
                  )}
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  Your QR and recent gym arrivals still live here, but they are now secondary to progress follow-up.
                </p>
                <Link
                  to="/customer/checkin-health"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Open full check-in page
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>

            <article className="gc-card">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-gym-600" />
                <h3 className="text-lg font-bold text-slate-900">Recent check-ins</h3>
              </div>
              <div className="mt-4 space-y-3">
                {checkinHistory.length > 0 ? (
                  checkinHistory.slice(0, 4).map((item) => (
                    <div key={item.checkInId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="font-semibold text-slate-900">{formatDateTime(item.checkInTime)}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.planName || 'Membership plan unavailable'}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                        Confirmed by {item.checkedByName || 'Front desk'}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    No check-in history yet.
                  </p>
                )}
              </div>
            </article>
          </div>
        </section>
      </div>

      {error && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-2xl">
          {error}
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CustomerProgressHubPage
