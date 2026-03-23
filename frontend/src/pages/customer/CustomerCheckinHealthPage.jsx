import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { CheckCircle2, History, Activity, UserCog, ClipboardList, Plus, Scale, Ruler } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { checkinApi } from '../../features/checkin/api/checkinApi'
import { healthApi } from '../../features/health/api/healthApi'
import { getBmiLevel } from '../../features/health/utils/bmi'

const BMI_GAUGE_MIN = 16
const BMI_GAUGE_MAX = 40
const BMI_SEGMENTS = [
  { label: 'Underweight', min: 16, max: 18.5, color: '#38BDF8', textClass: 'text-sky-400' },
  { label: 'Normal', min: 18.5, max: 25, color: '#34D399', textClass: 'text-emerald-400' },
  { label: 'Overweight', min: 25, max: 40, color: '#FB7185', textClass: 'text-rose-400' },
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
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gym-500">Action and logging workspace</p>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">Capture check-ins and body metrics without losing sight of the bigger progress story.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
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
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">
                Raw history access
              </span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-ambient-sm backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current BMI</p>
              <p className="mt-2 text-lg font-black text-white">{currentBmi == null ? '--' : currentBmi.toFixed(1)}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-ambient-sm backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current category</p>
              <p className={`mt-2 text-lg font-black ${bmiLevel.textClass}`}>{currentBmi == null ? 'Awaiting metrics' : bmiLevel.label}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-ambient-sm backdrop-blur-md">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Check-in records</p>
              <p className="mt-2 text-lg font-black text-white">{checkinHistory.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mb-6 flex flex-col gap-3 rounded-[2rem] border border-gym-500/20 bg-gym-500/10 p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gym-400">Progress-first destination</p>
          <h2 className="mt-2 text-xl font-black text-slate-100">Use Progress Hub for the full health and PT follow-up story.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This page keeps your QR, check-in history, and manual metric entry available while the new hub becomes the main place to review progress.
          </p>
        </div>
        <Link
          to="/customer/progress-hub"
          className="inline-flex items-center justify-center rounded-full bg-gym-600 px-5 py-3 text-sm font-bold text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition hover:bg-gym-500"
        >
          Open Progress Hub
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <article className="gc-glass-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Use this page for</p>
          <p className="mt-3 text-lg font-black text-slate-100">Scan, record, verify</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Show your QR at arrival, add fresh body metrics, and inspect the raw records behind your follow-up view.
          </p>
        </article>
        <article className="gc-glass-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Progress Hub is for</p>
          <p className="mt-3 text-lg font-black text-slate-100">Overview and next actions</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Use the hub when you want the combined story: latest snapshot, PT context, coach notes, and follow-up focus.
          </p>
        </article>
        <article className="gc-glass-panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">PT dashboard is for</p>
          <p className="mt-3 text-lg font-black text-slate-100">Booking and schedule changes</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            When you need coach matches, request status, or future PT sessions, switch to the dedicated PT workspace.
          </p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-1">
          <article className="gc-card flex flex-col items-center" style={{ background: 'linear-gradient(180deg, #ffffff, #f8fafc)' }}>
            <div className="mb-4 flex items-center gap-2 self-start">
              <CheckCircle2 className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800" style={{ color: '#1e293b' }}>Check-in QR Code</h2>
            </div>
            <div className="relative aspect-square w-full max-w-[240px] overflow-hidden rounded-xl border border-slate-100 p-2 shadow-inner" style={{ backgroundColor: '#f8fafc' }}>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Check-in QR" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs" style={{ color: '#94a3b8' }}>
                  Generating QR...
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-sm" style={{ color: '#475569' }}>
              Show this QR code at the front desk when you arrive to check in.
            </p>
          </article>

          <article className="gc-glass-panel mt-6 p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gym-500/10 text-gym-500 border border-gym-500/20">
                <Activity size={20} strokeWidth={2.5} />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Current Metrics</h2>
            </div>
            
            {hasHealthData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/5 bg-black/20 px-5 py-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Height</p>
                    <div className="mt-2 flex items-baseline justify-center gap-1">
                      <p className="text-3xl font-black text-slate-100">{currentHealth.heightCm}</p>
                      <p className="text-sm font-bold text-gym-500">cm</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/20 px-5 py-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Weight</p>
                    <div className="mt-2 flex items-baseline justify-center gap-1">
                      <p className="text-3xl font-black text-slate-100">{currentHealth.weightKg}</p>
                      <p className="text-sm font-bold text-gym-500">kg</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-black/30 px-5 py-6">
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
                              fill="#94A3B8"
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

                        {/* Background track for gauge */}
                        <path
                          d={getGaugeArcPath(98, BMI_GAUGE_MIN, BMI_GAUGE_MAX).path}
                          fill="none"
                          stroke="#ffffff08"
                          strokeWidth="30"
                          strokeLinecap="round"
                        />
                        <path
                          d={getGaugeArcPath(98, BMI_GAUGE_MIN, BMI_GAUGE_MAX).path}
                          fill="none"
                          stroke="#ffffff0a"
                          strokeWidth="28"
                          strokeLinecap="round"
                        />

                        {/* Needle */}
                        <g
                          transform={`rotate(${bmiNeedleAngle} 160 176)`}
                          style={{ transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                        >
                          <path d="M 160 176 L 151 78 L 169 78 Z" fill={bmiLevel.accent} opacity="1" />
                        </g>

                        {/* Needle joint */}
                        <circle cx="160" cy="176" r="10" fill="#1E293B" />
                        <circle cx="160" cy="176" r="4" fill="#ffffff" />

                        <text x="160" y="135" fill="#64748b" fontSize="11" fontWeight="700" textAnchor="middle">
                          BMI
                        </text>
                        <text x="160" y="160" fill={bmiLevel.accent} fontSize="24" fontWeight="800" textAnchor="middle">
                          {currentBmi == null ? '--' : currentBmi.toFixed(1)}
                        </text>
                      </svg>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Category</p>
                      <p className={`mt-2 text-2xl font-black ${bmiLevel.textClass}`}>{bmiLevel.label}</p>
                      <p className={`mt-1 text-xs font-bold ${bmiLevel.textClass} opacity-80`}>{bmiLevel.summary}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Difference</p>
                      <p className={`mt-2 text-base font-bold ${bmiLevel.textClass}`}>{getBmiDifferenceText(currentBmi)}</p>
                    </div>
                  </div>

                  <div className={`mt-5 rounded-2xl border px-5 py-4 ${bmiLevel.bgClass} ${bmiLevel.borderClass}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${bmiLevel.textClass}`}>Interpretation</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{bmiLevel.guidance}</p>
                  </div>

                  <div className="mt-5 space-y-2 border-t border-white/10 pt-5">
                    {BMI_CLASS_ROWS.map((row) => {
                      const active = isRangeMatch(currentBmi, row.min, row.max)
                      return (
                        <div
                          key={row.label}
                          className={`flex items-center justify-between rounded-xl px-4 py-2 text-[13px] transition-colors ${
                            active ? `bg-white/10 ${bmiLevel.textClass} border border-white/5` : 'text-slate-500 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] ${active ? 'opacity-100' : 'opacity-0'}`}>▸</span>
                            <span className={active ? 'font-bold' : 'font-medium'}>{row.label}</span>
                          </div>
                          <span className={active ? 'font-bold' : 'font-medium'}>{describeBmiRange(row.min, row.max)}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/5 bg-black/20 px-5 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Target Weight</p>
                      <p className="mt-2 text-lg font-black text-emerald-400">
                        {healthyWeightRange ? `${healthyWeightRange.min.toFixed(1)} - ${healthyWeightRange.max.toFixed(1)} kg` : '--'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/20 px-5 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Last Synced</p>
                      <p className="mt-2 text-base font-bold text-slate-200">{formatDate(currentHealth.updatedAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/5 bg-black/20 px-5 py-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Height</p>
                    <div className="mt-2 flex items-baseline justify-center gap-1">
                      <p className="text-3xl font-black text-slate-600">--</p>
                      <p className="text-sm font-bold text-slate-600">cm</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-black/20 px-5 py-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Weight</p>
                    <div className="mt-2 flex items-baseline justify-center gap-1">
                      <p className="text-3xl font-black text-slate-600">--</p>
                      <p className="text-sm font-bold text-slate-600">kg</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-white/10 bg-black/30 px-5 py-6">
                  <div className="mx-auto max-w-[360px]">
                    <div className="relative opacity-60 grayscale filter">
                      <svg viewBox="0 0 320 220" className="w-full overflow-visible">
                        <path d={getGaugeArcPath(98, BMI_GAUGE_MIN, BMI_GAUGE_MAX).path} fill="none" stroke="#ffffff0a" strokeWidth="30" strokeLinecap="round" />
                        <circle cx="160" cy="176" r="10" fill="#1E293B" />
                        <circle cx="160" cy="176" r="4" fill="#ffffff" />
                        <text x="160" y="135" fill="#64748b" fontSize="11" fontWeight="700" textAnchor="middle">
                          BMI
                        </text>
                        <text x="160" y="160" fill="#94A3B8" fontSize="24" fontWeight="800" textAnchor="middle">
                          --
                        </text>
                      </svg>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Category</p>
                      <p className="mt-2 text-2xl font-black text-slate-500">No data</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">Add your latest status</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Difference</p>
                      <p className="mt-2 text-base font-bold text-slate-500">--</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/5 bg-white/5 px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Interpretation</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                      Enter height and weight to generate your BMI trend and healthy-weight target bounds.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </article>
        </section>

        <section className="space-y-6 lg:col-span-2">
          <article className="gc-glass-panel p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gym-500/10 text-gym-500 border border-gym-500/20">
                <UserCog size={20} strokeWidth={2.5} />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Update Body Metrics</h2>
            </div>
            <form onSubmit={handleHealthSubmit} className="flex flex-wrap items-end gap-5">
              <div className="min-w-[140px] flex-1">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Height (cm)</label>
                <div className="relative">
                  <Ruler className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={healthForm.heightCm}
                    onChange={(e) => setHealthForm({ ...healthForm, heightCm: e.target.value })}
                    className="gc-input w-full pl-10 text-sm"
                    placeholder="170.0"
                  />
                </div>
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-slate-400">Weight (kg)</label>
                <div className="relative">
                  <Scale className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={healthForm.weightKg}
                    onChange={(e) => setHealthForm({ ...healthForm, weightKg: e.target.value })}
                    className="gc-input w-full pl-10 text-sm"
                    placeholder="65.0"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submittingHealth}
                className="gc-button-primary"
              >
                {submittingHealth ? 'Saving Engine...' : <><Plus className="mr-2 h-4 w-4" /> Commit Data</>}
              </button>
            </form>
          </article>

          <article className="gc-glass-panel p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gym-500/10 text-gym-500 border border-gym-500/20">
                <ClipboardList size={20} strokeWidth={2.5} />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Coach Logbook</h2>
            </div>
            <div className="gc-scrollbar-hidden max-h-[320px] space-y-4 overflow-y-auto pr-2">
              {coachNotes.length > 0 ? (
                coachNotes.map((note) => (
                  <div key={note.noteId} className="rounded-[1.25rem] border border-white/5 bg-white/5 p-5 transition hover:bg-white/10 hover:border-white/10">
                    <div className="mb-3 flex items-start justify-between border-b border-white/5 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400 border border-emerald-500/20">
                          {note.coachName?.charAt(0) || 'C'}
                        </div>
                        <p className="text-sm font-bold text-slate-200">{note.coachName}</p>
                      </div>
                      <span className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {formatDate(note.sessionDate)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-300">
                      {note.noteContent}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/5 p-8 text-center">
                  <p className="text-sm font-medium text-slate-500">No coach evaluations or logbook entries recorded yet.</p>
                </div>
              )}
            </div>
          </article>

          <article className="gc-glass-panel p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gym-500/10 text-gym-500 border border-gym-500/20">
                <History size={20} strokeWidth={2.5} />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Access History</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-black/40 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Timestamp</th>
                    <th className="px-5 py-4">Active Plan Context</th>
                    <th className="px-5 py-4">Verifier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {checkinHistory.length > 0 ? (
                    checkinHistory.map((item) => (
                      <tr key={item.checkInId} className="transition-colors hover:bg-white/5">
                        <td className="px-5 py-4 text-[13px] font-medium text-slate-300">{formatDateTime(item.checkInTime)}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                            {item.planName}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[13px] text-slate-400">{item.checkedByName || 'System Auto'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-5 py-10 text-center text-[13px] font-medium text-slate-500">
                        Awaiting your first check-in log.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          {healthHistory.length > 0 && (
            <article className="gc-glass-panel p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gym-500/10 text-gym-500 border border-gym-500/20">
                  <History size={20} strokeWidth={2.5} />
                </div>
                <h2 className="text-lg font-bold text-slate-100">Health History Log</h2>
              </div>
              <div className="space-y-4">
                {healthHistory.map((item, index) => {
                  const itemBmi = parseBmi(item.bmi);
                  const itemBmiLevel = getBmiLevel(itemBmi);
                  return (
                    <div key={`${item.recordedAt}-${index}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
                      <div>
                        <p className="text-sm font-bold text-slate-200">{formatDateTime(item.recordedAt)}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                          <span>H: {item.heightCm} <span className="lowercase">cm</span></span>
                          <span className="text-slate-700">•</span>
                          <span>W: {item.weightKg} <span className="lowercase">kg</span></span>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div className="flex flex-col items-end">
                           <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Record BMI</p>
                           <p className={`mt-0.5 text-base font-black ${itemBmiLevel.textClass}`}>{itemBmi?.toFixed(1) ?? '--'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          )}
        </section>
      </div>

      {error && (
        <div className="animate-in slide-in-from-right fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-[1.25rem] border border-rose-500/20 bg-[#12121a] p-4 text-white shadow-2xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/20 text-rose-500">
            <Plus className="h-4 w-4 rotate-45" strokeWidth={3} />
          </div>
          <p className="pr-4 text-sm font-bold text-slate-200">{error}</p>
          <button onClick={() => setError('')} className="rounded-lg bg-white/5 p-1.5 hover:bg-white/10 text-slate-400 hover:text-white transition">
            <Plus className="h-4 w-4 rotate-45" strokeWidth={3} />
          </button>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CustomerCheckinHealthPage
