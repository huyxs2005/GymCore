import { useEffect, useState } from 'react'
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
      title="Check-in and Health Tracking"
      subtitle="Manage your check-ins and track your health progress in one place."
      links={customerNav}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-1">
          <article className="gc-card flex flex-col items-center">
            <div className="mb-4 flex items-center gap-2 self-start">
              <CheckCircle2 className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Check-in QR Code</h2>
            </div>
            <div className="relative aspect-square w-full max-w-[240px] overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-2 shadow-inner">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Check-in QR" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                  Generating QR...
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-sm text-slate-600">
              Show this QR code at the front desk when you arrive to check in.
            </p>
          </article>

          <article className="gc-card mt-6">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Current Metrics</h2>
            </div>
            {hasHealthData ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Height</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{currentHealth.heightCm}</p>
                    <p className="text-sm font-semibold text-gym-600">cm</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Weight</p>
                    <p className="mt-2 text-3xl font-black text-slate-900">{currentHealth.weightKg}</p>
                    <p className="text-sm font-semibold text-gym-600">kg</p>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_72%)] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
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
                              fill="#334155"
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
                          stroke="#ffffff"
                          strokeWidth="30"
                          strokeLinecap="round"
                        />

                        <g
                          transform={`rotate(${bmiNeedleAngle} 160 176)`}
                          style={{ transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                        >
                          <path d="M 160 176 L 151 78 L 169 78 Z" fill={bmiLevel.accent} opacity="0.95" />
                        </g>
                        <circle cx="160" cy="176" r="9" fill="#1E293B" />
                        <circle cx="160" cy="176" r="4" fill="#ffffff" />

                        <text x="160" y="135" fill="#9CA3AF" fontSize="11" fontWeight="700" textAnchor="middle">
                          BMI
                        </text>
                        <text x="160" y="160" fill={bmiLevel.accent} fontSize="24" fontWeight="800" textAnchor="middle">
                          {currentBmi == null ? '--' : currentBmi.toFixed(1)}
                        </text>
                      </svg>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Category</p>
                      <p className={`mt-2 text-2xl font-black ${bmiLevel.textClass}`}>{bmiLevel.label}</p>
                      <p className={`mt-1 text-sm font-semibold ${bmiLevel.textClass}`}>{bmiLevel.summary}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Difference</p>
                      <p className={`mt-2 text-base font-bold ${bmiLevel.textClass}`}>{getBmiDifferenceText(currentBmi)}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Interpretation</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{bmiLevel.guidance}</p>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                    {BMI_CLASS_ROWS.map((row) => {
                      const active = isRangeMatch(currentBmi, row.min, row.max)
                      return (
                        <div
                          key={row.label}
                          className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                            active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`text-xs ${active ? 'opacity-100' : 'opacity-0'}`}>{'>'}</span>
                            <span className={active ? 'font-bold' : ''}>{row.label}</span>
                          </div>
                          <span className={active ? 'font-bold' : 'font-medium'}>{describeBmiRange(row.min, row.max)}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Healthy Weight</p>
                      <p className="mt-2 text-lg font-black text-slate-900">
                        {healthyWeightRange ? `${healthyWeightRange.min.toFixed(1)} - ${healthyWeightRange.max.toFixed(1)} kg` : '--'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Updated</p>
                      <p className="mt-2 text-lg font-black text-slate-900">{formatDate(currentHealth.updatedAt)}</p>
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

                <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_72%)] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <div className="mx-auto max-w-[360px]">
                    <div className="relative">
                      <svg viewBox="0 0 320 220" className="w-full overflow-visible">
                        <path d={getGaugeArcPath(118, BMI_GAUGE_MIN, BMI_GAUGE_MAX).path} fill="none" stroke="#E5E7EB" strokeWidth="34" />
                        <path d={getGaugeArcPath(98, BMI_GAUGE_MIN, BMI_GAUGE_MAX).path} fill="none" stroke="#ffffff" strokeWidth="30" strokeLinecap="round" />
                        <circle cx="160" cy="176" r="9" fill="#CBD5E1" />
                        <circle cx="160" cy="176" r="4" fill="#ffffff" />
                        <text x="160" y="135" fill="#9CA3AF" fontSize="11" fontWeight="700" textAnchor="middle">
                          BMI
                        </text>
                        <text x="160" y="160" fill="#94A3B8" fontSize="24" fontWeight="800" textAnchor="middle">
                          --
                        </text>
                      </svg>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Category</p>
                      <p className="mt-2 text-2xl font-black text-slate-500">No data</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">Add your latest body metrics</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Difference</p>
                      <p className="mt-2 text-base font-bold text-slate-400">--</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Interpretation</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Enter height and weight to generate your BMI trend and healthy-weight target.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </article>
        </section>

        <section className="space-y-6 lg:col-span-2">
          <article className="gc-card">
            <div className="mb-4 flex items-center gap-2">
              <UserCog className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Update Body Metrics</h2>
            </div>
            <form onSubmit={handleHealthSubmit} className="flex flex-wrap items-end gap-4">
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Height (cm)</label>
                <div className="relative">
                  <Ruler className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={healthForm.heightCm}
                    onChange={(e) => setHealthForm({ ...healthForm, heightCm: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-gym-500 focus:outline-none"
                    placeholder="170"
                  />
                </div>
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Weight (kg)</label>
                <div className="relative">
                  <Scale className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={healthForm.weightKg}
                    onChange={(e) => setHealthForm({ ...healthForm, weightKg: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-3 text-sm focus:border-gym-500 focus:outline-none"
                    placeholder="65"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submittingHealth}
                className="inline-flex items-center gap-2 rounded-lg bg-gym-600 px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-gym-700 disabled:opacity-50"
              >
                {submittingHealth ? 'Saving...' : <><Plus className="h-4 w-4" /> Save metrics</>}
              </button>
            </form>
          </article>

          <article className="gc-card">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Coach Notes</h2>
            </div>
            <div className="custom-scrollbar max-h-[300px] space-y-4 overflow-y-auto pr-2">
              {coachNotes.length > 0 ? (
                coachNotes.map((note) => (
                  <div key={note.noteId} className="rounded-xl border-l-4 border-gym-500 bg-slate-50 p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <p className="text-sm font-bold text-slate-800">{note.coachName}</p>
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        {formatDate(note.sessionDate)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                      {note.noteContent}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-4 text-sm italic text-slate-500">No coach notes available yet.</p>
              )}
            </div>
          </article>

          <article className="gc-card">
            <div className="mb-4 flex items-center gap-2">
              <History className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Check-in History</h2>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Membership</th>
                    <th className="px-4 py-3">Confirmed by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {checkinHistory.length > 0 ? (
                    checkinHistory.map((item) => (
                      <tr key={item.checkInId} className="transition hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-700">{formatDateTime(item.checkInTime)}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <span className="inline-flex items-center rounded-full bg-gym-50 px-2 py-0.5 text-[10px] font-bold text-gym-700">
                            {item.planName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{item.checkedByName || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-4 py-8 text-center italic text-slate-400">
                        No check-in history yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          {healthHistory.length > 0 && (
            <article className="gc-card">
              <div className="mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-gym-600" />
                <h2 className="text-lg font-bold text-slate-800">Health History</h2>
              </div>
              <div className="space-y-3">
                {healthHistory.map((item, index) => (
                  <div key={`${item.recordedAt}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{formatDateTime(item.recordedAt)}</p>
                      <p className="text-xs text-slate-500">Height {item.heightCm} cm | Weight {item.weightKg} kg</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-500">BMI</p>
                      <p className="text-sm font-bold text-slate-800">{parseBmi(item.bmi)?.toFixed(1) ?? '--'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}
        </section>
      </div>

      {error && (
        <div className="animate-in slide-in-from-right fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-rose-600 p-4 text-white shadow-2xl">
          <p className="text-sm font-bold">{error}</p>
          <button onClick={() => setError('')} className="rounded-lg p-1 hover:bg-white/20">
            <Plus className="h-4 w-4 rotate-45" />
          </button>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CustomerCheckinHealthPage
