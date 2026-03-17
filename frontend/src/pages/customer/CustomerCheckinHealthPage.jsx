import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { CheckCircle2, History, Activity, UserCog, ClipboardList, Plus, Scale, Ruler } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { checkinApi } from '../../features/checkin/api/checkinApi'
import { healthApi } from '../../features/health/api/healthApi'

const BMI_GAUGE_MIN = 16
const BMI_GAUGE_MAX = 40
const BMI_SEGMENTS = [
  { label: 'Underweight', min: 16, max: 18.5, color: '#2F9AE0', textClass: 'text-sky-600' },
  { label: 'Normal', min: 18.5, max: 25, color: '#42BE65', textClass: 'text-emerald-600' },
  { label: 'Overweight', min: 25, max: 40, color: '#FF5A4E', textClass: 'text-rose-500' },
]
const BMI_CLASS_ROWS = [
  { label: 'Very Severely Underweight', min: null, max: 16 },
  { label: 'Severely Underweight', min: 16, max: 16.9 },
  { label: 'Underweight', min: 17, max: 18.4 },
  { label: 'Normal', min: 18.5, max: 24.9 },
  { label: 'Overweight', min: 25, max: 29.9 },
  { label: 'Obese Class I', min: 30, max: 34.9 },
  { label: 'Obese Class II', min: 35, max: 39.9 },
  { label: 'Obese Class III', min: 40, max: null },
]

function resolveApiMessage(error, fallback) {
  return error?.response?.data?.message || fallback
}

function formatDateTime(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString('en-GB')
}

function formatDate(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleDateString('en-GB')
}

function parseBmi(value) {
  const parsed = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function getBmiLevel(bmi) {
  if (bmi == null) {
    return {
      label: 'No data',
      textClass: 'text-slate-500',
      accent: '#94A3B8',
      summary: 'Add your latest body metrics',
      guidance: 'Enter height and weight to generate your BMI trend and healthy-weight target.',
    }
  }
  if (bmi < 18.5) {
    return {
      label: 'Underweight',
      textClass: 'text-sky-600',
      accent: '#2F9AE0',
      summary: 'Needs gain',
      guidance: 'You are below the normal BMI range. A gradual weight gain plan would move you toward the healthy zone.',
    }
  }
  if (bmi < 25) {
    return {
      label: 'Normal',
      textClass: 'text-emerald-600',
      accent: '#42BE65',
      summary: 'Healthy',
      guidance: 'Your BMI is inside the normal range. Maintain this zone with steady training and nutrition.',
    }
  }
  return {
    label: 'Overweight',
    textClass: 'text-rose-500',
    accent: '#FF5A4E',
    summary: 'Needs reduction',
    guidance: 'You are above the normal BMI range. Reducing body weight would move you back toward the healthy zone.',
  }
}

function getBmiNeedleAngle(bmi) {
  if (bmi == null) return -150
  const clamped = Math.min(BMI_GAUGE_MAX, Math.max(BMI_GAUGE_MIN, bmi))
  const progress = (clamped - BMI_GAUGE_MIN) / (BMI_GAUGE_MAX - BMI_GAUGE_MIN)
  return -90 + progress * 180
}

function getGaugePoint(cx, cy, radius, angleDegrees) {
  const radians = (Math.PI / 180) * angleDegrees
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function getGaugeAngle(value) {
  const progress = (value - BMI_GAUGE_MIN) / (BMI_GAUGE_MAX - BMI_GAUGE_MIN)
  return 180 + progress * 180
}

function getGaugeArcPath(radius, startValue, endValue) {
  const startAngle = getGaugeAngle(startValue)
  const endAngle = getGaugeAngle(endValue)
  const start = getGaugePoint(160, 176, radius, startAngle)
  const end = getGaugePoint(160, 176, radius, endAngle)

  return {
    path: `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`,
    startAngle,
    endAngle,
  }
}

function describeBmiRange(min, max) {
  if (min == null) return `< ${max.toFixed(1)}`
  if (max == null) return `>= ${min.toFixed(1)}`
  return `${min.toFixed(1)} - ${max.toFixed(1)}`
}

function isRangeMatch(bmi, min, max) {
  if (bmi == null) return false
  if (min == null) return bmi < max
  if (max == null) return bmi >= min
  return bmi >= min && bmi <= max
}

function getBmiDifferenceText(bmi) {
  if (bmi == null) return '--'
  if (bmi < 18.5) return `+${(18.5 - bmi).toFixed(1)} to normal`
  if (bmi <= 24.9) return 'Within target'
  return `-${(bmi - 24.9).toFixed(1)} to normal`
}

function getHealthyWeightRange(heightCm) {
  const heightMeters = Number.parseFloat(heightCm) / 100
  if (!Number.isFinite(heightMeters) || heightMeters <= 0) return null
  return {
    min: 18.5 * heightMeters * heightMeters,
    max: 24.9 * heightMeters * heightMeters,
  }
}

function hasCurrentHealthData(currentHealth) {
  if (!currentHealth || typeof currentHealth !== 'object') return false
  return (
    Number.isFinite(Number.parseFloat(String(currentHealth.heightCm ?? ''))) ||
    Number.isFinite(Number.parseFloat(String(currentHealth.weightKg ?? ''))) ||
    Number.isFinite(Number.parseFloat(String(currentHealth.bmi ?? '')))
  )
}

function CustomerCheckinHealthPage() {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [checkinHistory, setCheckinHistory] = useState([])
  const [currentHealth, setCurrentHealth] = useState(null)
  const [healthHistory, setHealthHistory] = useState([])
  const [coachNotes, setCoachNotes] = useState([])

  const [loading, setLoading] = useState(true)
  const [submittingHealth, setSubmittingHealth] = useState(false)
  const [error, setError] = useState('')

  const [healthForm, setHealthForm] = useState({
    heightCm: '',
    weightKg: '',
  })
  const hasHealthData = hasCurrentHealthData(currentHealth)
  const currentBmi = parseBmi(currentHealth?.bmi)
  const bmiLevel = getBmiLevel(currentBmi)
  const bmiNeedleAngle = getBmiNeedleAngle(currentBmi)
  const healthyWeightRange = getHealthyWeightRange(currentHealth?.heightCm)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [qrRes, checkinRes, healthCurrRes, healthHistRes, notesRes] = await Promise.all([
        checkinApi.getQrToken(),
        checkinApi.getHistory(),
        healthApi.getCurrent(),
        healthApi.getHistory(),
        checkinApi.getCoachNotes(),
      ])

      setCheckinHistory(checkinRes.data?.items || [])
      setCurrentHealth(healthCurrRes.data || null)
      setHealthHistory(healthHistRes.data?.items || [])
      setCoachNotes(notesRes.data?.items || [])

      if (qrRes.data?.qrCodeToken) {
        QRCode.toDataURL(qrRes.data.qrCodeToken, { width: 400, margin: 2 }, (err, url) => {
          if (!err) setQrDataUrl(url)
        })
      }
    } catch (err) {
      setError(resolveApiMessage(err, 'Failed to load data.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleHealthSubmit(e) {
    e.preventDefault()
    setSubmittingHealth(true)
    setError('')
    try {
      const res = await healthApi.createRecord({
        heightCm: parseFloat(healthForm.heightCm),
        weightKg: parseFloat(healthForm.weightKg),
      })
      setCurrentHealth(res.data)
      setHealthForm({ heightCm: '', weightKg: '' })
      const histRes = await healthApi.getHistory()
      setHealthHistory(histRes.data?.items || [])
    } catch (err) {
      setError(resolveApiMessage(err, 'Failed to save health record.'))
    } finally {
      setSubmittingHealth(false)
    }
  }

  if (loading) {
    return (
      <WorkspaceScaffold title="Loading..." links={customerNav}>
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gym-500 border-t-transparent"></div>
        </div>
      </WorkspaceScaffold>
    )
  }

  return (
    <WorkspaceScaffold
      title="Check-in & Health Log"
      subtitle="Use this page for check-in QR, manual body metrics, and raw history. Progress Hub remains the main overview for follow-up."
      links={customerNav}
    >
      <section className="mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.14),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.1),_transparent_30%),linear-gradient(135deg,_rgba(18,18,26,0.98),_rgba(10,10,15,0.94)_45%,_rgba(24,26,38,0.94))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
        <div className="grid gap-5 lg:grid-cols-[1.6fr,1fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400/80">Action and logging workspace</p>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white leading-tight">Capture check-ins and body metrics without losing sight of the bigger progress story.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                This page is built for actions you perform yourself: showing your QR, entering new measurements, and reviewing raw attendance and metric history.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                Manual metric entry
              </span>
              <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-400">
                QR check-in ready
              </span>
              <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                Raw history access
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-ambient-sm backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current BMI</p>
              <p className="mt-2 text-2xl font-black text-white">{currentBmi == null ? '--' : currentBmi.toFixed(1)}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-ambient-sm backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current category</p>
              <p className={`mt-2 text-xl font-black ${bmiLevel.textClass.replace('text-emerald-600', 'text-emerald-400').replace('text-sky-600', 'text-sky-400').replace('text-rose-500', 'text-rose-400')}`}>{currentBmi == null ? 'Awaiting metrics' : bmiLevel.label}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-ambient-sm backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Check-in records</p>
              <p className="mt-2 text-2xl font-black text-white">{checkinHistory.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6 flex flex-col gap-3 rounded-[2rem] border border-white/10 bg-gradient-to-r from-emerald-900/20 to-sky-900/10 p-5 shadow-ambient-sm backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Progress-first destination</p>
          <h2 className="mt-2 text-xl font-black text-white">Use Progress Hub for the full health and PT follow-up story.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            This page keeps your QR, check-in history, and manual metric entry available while the new hub becomes the main place to review progress.
          </p>
        </div>
        <Link
          to="/customer/progress-hub"
          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        >
          Open Progress Hub
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-ambient-sm backdrop-blur-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/70">Use this page for</p>
          <p className="mt-3 text-lg font-black text-white">Scan, record, verify</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Show your QR at arrival, add fresh body metrics, and inspect the raw records behind your follow-up view.
          </p>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-ambient-sm backdrop-blur-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/70">Progress Hub is for</p>
          <p className="mt-3 text-lg font-black text-white">Overview and next actions</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Use the hub when you want the combined story: latest snapshot, PT context, coach notes, and follow-up focus.
          </p>
        </article>
        <article className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-ambient-sm backdrop-blur-md">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400/70">PT dashboard is for</p>
          <p className="mt-3 text-lg font-black text-white">Booking and schedule changes</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            When you need coach matches, request status, or future PT sessions, switch to the dedicated PT workspace.
          </p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-1">
          <article className="rounded-[2.5rem] border border-white/10 bg-white/5 p-6 shadow-ambient-md backdrop-blur-xl flex flex-col items-center">
            <div className="mb-6 flex items-center gap-3 self-start">
              <div className="rounded-xl bg-emerald-500/10 p-2 border border-emerald-500/20">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-black text-white">Check-in QR Code</h2>
            </div>
            <div className="relative aspect-square w-full max-w-[240px] overflow-hidden rounded-[2rem] border border-white/10 bg-white p-4 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Check-in QR" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                   <div className="animate-pulse">Generating QR...</div>
                </div>
              )}
            </div>
            <p className="mt-6 text-center text-sm leading-relaxed text-slate-300 px-4">
              Show this QR code at the front desk when you arrive to check in.
            </p>
          </article>

          <article className="rounded-[2.5rem] border border-white/10 bg-white/5 p-6 shadow-ambient-md backdrop-blur-xl mt-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2 border border-emerald-500/20">
                <Activity className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-black text-white">Current Metrics</h2>
            </div>
            {hasHealthData ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Height</p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">{currentHealth.heightCm}</span>
                      <span className="text-sm font-bold text-emerald-400">cm</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Weight</p>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white">{currentHealth.weightKg}</span>
                      <span className="text-sm font-bold text-emerald-400">kg</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-white/10 bg-black/10 px-4 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="mx-auto max-w-[360px]">
                    <div className="relative">
                      <svg viewBox="0 0 320 220" className="w-full overflow-visible">
                        {BMI_SEGMENTS.map((segment) => {
                          const { path, startAngle, endAngle } = getGaugeArcPath(118, segment.min, segment.max)
                          const labelAngle = (startAngle + endAngle) / 2
                          const labelPoint = getGaugePoint(160, 176, 92, labelAngle)
                          return (
                            <g key={segment.label}>
                              <path
                                d={path}
                                fill="none"
                                stroke={segment.color}
                                strokeWidth="34"
                                strokeLinecap="butt"
                                opacity="0.8"
                              />
                              <text
                                x={labelPoint.x}
                                y={labelPoint.y}
                                fill="#ffffff"
                                fontSize="9"
                                fontWeight="700"
                                textAnchor="middle"
                                transform={`rotate(${labelAngle - 270} ${labelPoint.x} ${labelPoint.y})`}
                              >
                                {segment.label}
                              </text>
                            </g>
                          )
                        })}

                        {[16, 18.5, 25, 40].map((mark) => {
                          const angle = getGaugeAngle(mark)
                          const point = getGaugePoint(160, 176, 72, angle)
                          return (
                            <text
                              key={mark}
                              x={point.x}
                              y={point.y}
                              fill="#94a3b8"
                              fontSize="7"
                              fontWeight="700"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(${angle - 270} ${point.x} ${point.y})`}
                            >
                              {mark.toFixed(1)}
                            </text>
                          )
                        })}

                        <path
                          d={getGaugeArcPath(98, BMI_GAUGE_MIN, BMI_GAUGE_MAX).path}
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="30"
                          strokeLinecap="round"
                        />

                        <g
                          transform={`rotate(${bmiNeedleAngle} 160 176)`}
                          style={{ transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                        >
                          <path d="M 160 176 L 151 78 L 169 78 Z" fill={bmiLevel.accent} opacity="0.95" />
                        </g>
                        <circle cx="160" cy="176" r="10" fill="#0f172a" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                        <circle cx="160" cy="176" r="4" fill="#ffffff" />

                        <text x="160" y="135" fill="#94a3b8" fontSize="11" fontWeight="700" textAnchor="middle">
                          BMI
                        </text>
                        <text x="160" y="162" fill="white" fontSize="28" fontBold="900" textAnchor="middle" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))' }}>
                          {currentBmi == null ? '--' : currentBmi.toFixed(1)}
                        </text>
                      </svg>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Category</p>
                      <p className={`mt-2 text-xl font-black ${bmiLevel.textClass.replace('emerald-600', 'emerald-400').replace('sky-600', 'sky-400').replace('rose-500', 'rose-400')}`}>{bmiLevel.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Difference</p>
                      <p className={`mt-2 text-sm font-bold ${bmiLevel.textClass.replace('emerald-600', 'emerald-400').replace('sky-600', 'sky-400').replace('rose-500', 'rose-400')}`}>{getBmiDifferenceText(currentBmi)}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Interpretation</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-300">{bmiLevel.guidance}</p>
                  </div>

                  <div className="mt-4 space-y-1.5 border-t border-white/10 pt-4">
                    {BMI_CLASS_ROWS.map((row) => {
                      const active = isRangeMatch(currentBmi, row.min, row.max)
                      return (
                        <div
                          key={row.label}
                          className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-[11px] transition ${
                            active ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-slate-400 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                             {active && <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                            <span>{row.label}</span>
                          </div>
                          <span>{describeBmiRange(row.min, row.max)}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-black/20 border border-white/5 px-4 py-3 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Healthy Weight</p>
                      <p className="mt-2 text-sm font-black text-white">
                        {healthyWeightRange ? `${healthyWeightRange.min.toFixed(1)} - ${healthyWeightRange.max.toFixed(1)} kg` : '--'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/20 border border-white/5 px-4 py-3 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Updated</p>
                      <p className="mt-2 text-sm font-black text-white">{formatDate(currentHealth.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Height</p>
                    <p className="mt-2 text-3xl font-black text-slate-400">--</p>
                    <p className="text-sm font-semibold text-slate-400">cm</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Weight</p>
                    <p className="mt-2 text-3xl font-black text-slate-400">--</p>
                    <p className="text-sm font-semibold text-slate-400">kg</p>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-white/10 bg-black/10 px-4 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="mx-auto max-w-[360px]">
                    <div className="relative">
                      <svg viewBox="0 0 320 220" className="w-full overflow-visible">
                        <path d={getGaugeArcPath(118, BMI_GAUGE_MIN, BMI_GAUGE_MAX).path} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="34" />
                        <path d={getGaugeArcPath(98, BMI_GAUGE_MIN, BMI_GAUGE_MAX).path} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="30" strokeLinecap="round" />
                        <circle cx="160" cy="176" r="10" fill="#1e293b" />
                        <circle cx="160" cy="176" r="4" fill="#334155" />
                        <text x="160" y="135" fill="#475569" fontSize="11" fontWeight="700" textAnchor="middle">
                          BMI
                        </text>
                        <text x="160" y="162" fill="#475569" fontSize="28" fontWeight="900" textAnchor="middle">
                          --
                        </text>
                      </svg>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Category</p>
                      <p className="mt-2 text-xl font-black text-slate-600">No data</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Difference</p>
                      <p className="mt-2 text-sm font-bold text-slate-600">--</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Interpretation</p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Enter height and weight to generate your BMI trend and healthy-weight target.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </article>
        </section>

        <section className="space-y-6 lg:col-span-2">
          <article className="rounded-[2.5rem] border border-white/10 bg-white/5 p-6 shadow-ambient-md backdrop-blur-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2 border border-emerald-500/20">
                <UserCog className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-black text-white">Update Body Metrics</h2>
            </div>
            <form onSubmit={handleHealthSubmit} className="flex flex-wrap items-end gap-4">
              <div className="min-w-[140px] flex-1">
                <label className="mb-2 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Height (cm)</label>
                <div className="relative">
                  <Ruler className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={healthForm.heightCm}
                    onChange={(e) => setHealthForm({ ...healthForm, heightCm: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                    placeholder="170"
                  />
                </div>
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-2 block text-xs font-semibold text-slate-400 uppercase tracking-wider">Weight (kg)</label>
                <div className="relative">
                  <Scale className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={healthForm.weightKg}
                    onChange={(e) => setHealthForm({ ...healthForm, weightKg: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                    placeholder="65"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submittingHealth}
                className="inline-flex h-[46px] items-center gap-2 rounded-xl bg-emerald-500 px-8 text-sm font-bold text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {submittingHealth ? 'Saving...' : <><Plus className="h-4 w-4" /> Save metrics</>}
              </button>
            </form>
          </article>

          <article className="rounded-[2.5rem] border border-white/10 bg-white/5 p-6 shadow-ambient-md backdrop-blur-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2 border border-emerald-500/20">
                <ClipboardList className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-black text-white">Coach Notes</h2>
            </div>
            <div className="custom-scrollbar max-h-[300px] space-y-4 overflow-y-auto pr-2">
              {coachNotes.length > 0 ? (
                coachNotes.map((note) => (
                  <div key={note.noteId} className="rounded-2xl border-l-[6px] border-emerald-500 bg-black/30 p-5 shadow-inner">
                    <div className="mb-3 flex items-start justify-between">
                      <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{note.coachName}</p>
                      <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-white/5">
                        {formatDate(note.sessionDate)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-300">
                      {note.noteContent}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center bg-black/10 rounded-2xl border border-dashed border-white/10">
                  <p className="text-sm italic text-slate-500">No coach notes available yet.</p>
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[2.5rem] border border-white/10 bg-white/5 p-6 shadow-ambient-md backdrop-blur-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/10 p-2 border border-emerald-500/20">
                <History className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-black text-white">Check-in History</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Time</th>
                    <th className="px-5 py-4">Membership</th>
                    <th className="px-5 py-4">Confirmed by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {checkinHistory.length > 0 ? (
                    checkinHistory.map((item) => (
                      <tr key={item.checkInId} className="transition-colors hover:bg-white/5">
                        <td className="px-5 py-4 font-bold text-slate-200">{formatDateTime(item.checkInTime)}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                            {item.planName}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-400 text-xs">{item.checkedByName || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-5 py-10 text-center italic text-slate-500 bg-white/5">
                        No check-in history yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          {healthHistory.length > 0 && (
            <article className="rounded-[2.5rem] border border-white/10 bg-white/5 p-6 shadow-ambient-md backdrop-blur-xl">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-2 border border-emerald-500/20">
                  <History className="h-6 w-6 text-emerald-400" />
                </div>
                <h2 className="text-xl font-black text-white">Health History</h2>
              </div>
              <div className="space-y-4">
                {healthHistory.map((item, index) => (
                  <div key={`${item.recordedAt}-${index}`} className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/30 p-5 group transition-all hover:border-emerald-500/30">
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{formatDateTime(item.recordedAt)}</p>
                      <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Height {item.heightCm} cm | Weight {item.weightKg} kg</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">BMI Score</p>
                      <p className="text-lg font-black text-emerald-400">{parseBmi(item.bmi)?.toFixed(1) ?? '--'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}
        </section>
      </div>

      {error && (
        <div className="animate-in slide-in-from-right fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-[1.5rem] border border-rose-500/20 bg-rose-950/40 p-5 text-white shadow-2xl backdrop-blur-xl">
          <div className="rounded-lg bg-rose-500/20 p-2">
             <Activity className="h-5 w-5 text-rose-400" />
          </div>
          <p className="text-sm font-bold tracking-tight">{error}</p>
          <button onClick={() => setError('')} className="ml-2 rounded-lg p-1.5 hover:bg-white/10 transition-colors">
            <Plus className="h-4 w-4 rotate-45" />
          </button>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CustomerCheckinHealthPage
