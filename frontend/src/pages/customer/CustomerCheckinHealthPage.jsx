import { useEffect, useState } from 'react'
import { History, Activity, Plus, Scale, Ruler } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
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

function getBmiIndicatorPercent(bmi) {
  if (bmi == null) return 0
  const clamped = Math.min(BMI_GAUGE_MAX, Math.max(BMI_GAUGE_MIN, bmi))
  const progress = (clamped - BMI_GAUGE_MIN) / (BMI_GAUGE_MAX - BMI_GAUGE_MIN)
  return progress * 100
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
  const [currentHealth, setCurrentHealth] = useState(null)
  const [healthHistory, setHealthHistory] = useState([])

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
  const bmiIndicatorPercent = getBmiIndicatorPercent(currentBmi)
  const healthyWeightRange = getHealthyWeightRange(currentHealth?.heightCm)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [healthCurrRes, healthHistRes] = await Promise.all([
        healthApi.getCurrent(),
        healthApi.getHistory(),
      ])

      setCurrentHealth(healthCurrRes.data || null)
      setHealthHistory(healthHistRes.data?.items || [])
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
      subtitle="Use this page for check-in QR, manual body metrics, and raw history."
      links={customerNav}
      showHeader={false}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="space-y-6">
          <article className="gc-glass-panel p-6">
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
                  <div className="mx-auto max-w-[460px]">
                    <div className="relative px-1 pt-8">
                      <div
                        className="absolute top-0 -translate-x-1/2 transition-[left] duration-500 ease-out"
                        style={{ left: `${bmiIndicatorPercent}%` }}
                      >
                        <div
                          className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent"
                          style={{ borderTopColor: bmiLevel.accent }}
                        />
                      </div>
                      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11121a]">
                        <div className="flex h-20">
                          {BMI_SEGMENTS.map((segment) => (
                            <div
                              key={segment.label}
                              className="h-full"
                              style={{
                                background: `linear-gradient(180deg, ${segment.color}22, ${segment.color}55)`,
                                width: `${((segment.max - segment.min) / (BMI_GAUGE_MAX - BMI_GAUGE_MIN)) * 100}%`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        <span>{BMI_GAUGE_MIN.toFixed(1)}</span>
                        <span>18.5</span>
                        <span>25.0</span>
                        <span>{BMI_GAUGE_MAX.toFixed(1)}</span>
                      </div>
                      <div className="mt-5 flex items-end justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Current BMI</p>
                          <p className="mt-2 text-4xl font-black" style={{ color: bmiLevel.accent }}>
                            {currentBmi == null ? '--' : currentBmi.toFixed(1)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Target zone</p>
                          <p className="mt-2 text-base font-bold text-emerald-400">
                            {healthyWeightRange ? `${healthyWeightRange.min.toFixed(1)} - ${healthyWeightRange.max.toFixed(1)} kg` : '--'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-2 sm:grid-cols-3">
                        {BMI_SEGMENTS.map((segment) => (
                          <div key={segment.label} className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                            <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: segment.color }} />
                            <span className="leading-none text-xs font-bold uppercase tracking-[0.14em] text-slate-300">{segment.label}</span>
                          </div>
                        ))}
                      </div>
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

                  <div className="mt-5 rounded-2xl border border-white/5 bg-black/20 px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Last Synced</p>
                    <p className="mt-2 text-base font-bold text-slate-200">{formatDate(currentHealth.updatedAt)}</p>
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
                  <div className="mx-auto max-w-[460px] opacity-65 grayscale">
                    <div className="relative px-1 pt-8">
                      <div className="absolute left-0 top-0 -translate-x-1/2">
                        <div className="h-0 w-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-slate-500" />
                      </div>
                      <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#11121a]">
                        <div className="flex h-20">
                          {BMI_SEGMENTS.map((segment) => (
                            <div
                              key={segment.label}
                              className="h-full"
                              style={{
                                background: `linear-gradient(180deg, ${segment.color}18, ${segment.color}40)`,
                                width: `${((segment.max - segment.min) / (BMI_GAUGE_MAX - BMI_GAUGE_MIN)) * 100}%`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        <span>{BMI_GAUGE_MIN.toFixed(1)}</span>
                        <span>18.5</span>
                        <span>25.0</span>
                        <span>{BMI_GAUGE_MAX.toFixed(1)}</span>
                      </div>
                      <div className="mt-5">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Current BMI</p>
                        <p className="mt-2 text-4xl font-black text-slate-500">--</p>
                      </div>
                      <div className="mt-5 grid gap-2 sm:grid-cols-3">
                        {BMI_SEGMENTS.map((segment) => (
                          <div key={segment.label} className="flex items-center justify-center gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                            <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ backgroundColor: segment.color }} />
                            <span className="leading-none text-xs font-bold uppercase tracking-[0.14em] text-slate-300">{segment.label}</span>
                          </div>
                        ))}
                      </div>
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

        <section className="space-y-6">
          <article className="gc-glass-panel p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gym-500/10 text-gym-500 border border-gym-500/20">
                <Plus size={20} strokeWidth={2.5} />
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
                  const itemBmi = parseBmi(item.bmi)
                  const itemBmiLevel = getBmiLevel(itemBmi)
                  return (
                    <div key={`${item.recordedAt}-${index}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
                      <div>
                        <p className="text-sm font-bold text-slate-200">{formatDate(item.recordedAt)}</p>
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
                  )
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
