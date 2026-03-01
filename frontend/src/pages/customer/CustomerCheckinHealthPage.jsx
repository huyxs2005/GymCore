import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CheckCircle2, History, Activity, UserCog, ClipboardList, Plus, Scale, Ruler } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { checkinApi } from '../../features/checkin/api/checkinApi'
import { healthApi } from '../../features/health/api/healthApi'

function resolveApiMessage(error, fallback) {
  return error?.response?.data?.message || fallback
}

function formatDateTimeVn(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString('vi-VN')
}

function formatDateVn(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleDateString('vi-VN')
}

function parseBmi(value) {
  const parsed = Number.parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function getBmiLevel(bmi) {
  if (bmi == null) return { label: 'No data', textClass: 'text-slate-500' }
  if (bmi < 18.5) return { label: 'Low', textClass: 'text-slate-500' }
  if (bmi < 25) return { label: 'Optimal', textClass: 'text-emerald-600' }
  return { label: 'High', textClass: 'text-rose-600' }
}

function getBmiNeedleAngle(bmi) {
  if (bmi == null) return -150
  const min = 12
  const max = 35
  const clamped = Math.min(max, Math.max(min, bmi))
  const progress = (clamped - min) / (max - min)
  return -150 + progress * 300
}

function CustomerCheckinHealthPage() {
  const [qrToken, setQrToken] = useState(null)
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
  const currentBmi = parseBmi(currentHealth?.bmi)
  const bmiLevel = getBmiLevel(currentBmi)
  const bmiNeedleAngle = getBmiNeedleAngle(currentBmi)

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

      setQrToken(qrRes.data?.qrCodeToken)
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
      // Refresh history
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
      title="Check-in & Health Tracking"
      subtitle="Quáº£n lÃ½ viá»‡c check-in vÃ  theo dÃµi tiáº¿n trÃ¬nh sá»©c khá»e cá»§a báº¡n."
      links={customerNav}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* QR Code Section */}
        <section className="lg:col-span-1">
          <article className="flex flex-col items-center gc-card">
            <div className="flex items-center gap-2 self-start mb-4">
              <CheckCircle2 className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">MÃ£ QR Check-in</h2>
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
              Sá»­ dá»¥ng mÃ£ nÃ y táº¡i quáº§y lá»… tÃ¢n Ä‘á»ƒ thá»±c hiá»‡n check-in khi Ä‘áº¿n táº­p.
            </p>
          </article>

          {/* Current Stats */}
          <article className="mt-6 gc-card">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Chá»‰ sá»‘ hiá»‡n táº¡i</h2>
            </div>
            {currentHealth ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="relative h-52 w-52">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background:
                          'conic-gradient(from 210deg, #9CA3AF 0deg 100deg, #22C55E 100deg 210deg, #EF4444 210deg 300deg, transparent 300deg 360deg)',
                      }}
                    />
                    <div className="absolute inset-[18px] rounded-full bg-white shadow-inner" />
                    <div
                      className="absolute left-1/2 top-1/2 h-[72px] w-1 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-slate-700 transition-transform duration-300"
                      style={{ transform: `translate(-50%, -100%) rotate(${bmiNeedleAngle}deg)` }}
                    />
                    <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-800" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-7">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">BMI</p>
                      <p className="mt-1 text-3xl font-black text-slate-900">
                        {currentBmi == null ? '--' : currentBmi.toFixed(1)}
                      </p>
                      <p className={`mt-1 text-xs font-bold uppercase ${bmiLevel.textClass}`}>{bmiLevel.label}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cáº­p nháº­t</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {formatDateVn(currentHealth.updatedAt)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">BMI Range</p>
                    <p className={`mt-1 text-sm font-bold ${bmiLevel.textClass}`}>{bmiLevel.label}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Chiá»u cao</p>
                    <p className="mt-1 text-lg font-bold text-slate-800">{currentHealth.heightCm} cm</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">CÃ¢n náº·ng</p>
                    <p className="mt-1 text-lg font-bold text-slate-800">{currentHealth.weightKg} kg</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">ChÆ°a cÃ³ dá»¯ liá»‡u sá»©c khá»e.</p>
            )}
          </article>
        </section>

        {/* Main Section */}
        <section className="lg:col-span-2 space-y-6">
          {/* Health Form */}
          <article className="gc-card">
            <div className="flex items-center gap-2 mb-4">
              <UserCog className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Cáº­p nháº­t chá»‰ sá»‘ cÆ¡ thá»ƒ</h2>
            </div>
            <form onSubmit={handleHealthSubmit} className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Chiá»u cao (cm)</label>
                <div className="relative">
                  <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">CÃ¢n náº·ng (kg)</label>
                <div className="relative">
                  <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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
                {submittingHealth ? 'Äang lÆ°u...' : <><Plus className="h-4 w-4" /> LÆ°u chá»‰ sá»‘</>}
              </button>
            </form>
          </article>

          {/* Coach Notes */}
          <article className="gc-card">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Ghi chÃº tá»« PT</h2>
            </div>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {coachNotes.length > 0 ? (
                coachNotes.map((note) => (
                  <div key={note.noteId} className="rounded-xl bg-slate-50 p-4 border-l-4 border-gym-500">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-bold text-slate-800">{note.coachName}</p>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {formatDateVn(note.sessionDate)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {note.noteContent}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic py-4">ChÆ°a cÃ³ ghi chÃº nÃ o tá»« huáº¥n luyá»‡n viÃªn.</p>
              )}
            </div>
          </article>

          {/* Check-in History */}
          <article className="gc-card">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Lá»‹ch sá»­ Check-in</h2>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Thá»i gian</th>
                    <th className="px-4 py-3">GÃ³i táº­p</th>
                    <th className="px-4 py-3">NgÆ°á»i xÃ¡c nháº­n</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {checkinHistory.length > 0 ? (
                    checkinHistory.map((item) => (
                      <tr key={item.checkInId} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {formatDateTimeVn(item.checkInTime)}
                        </td>
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
                      <td colSpan="3" className="px-4 py-8 text-center text-slate-400 italic">
                        ChÆ°a cÃ³ lá»‹ch sá»­ check-in.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>

      {error && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-rose-600 p-4 text-white shadow-2xl animate-in slide-in-from-right">
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
