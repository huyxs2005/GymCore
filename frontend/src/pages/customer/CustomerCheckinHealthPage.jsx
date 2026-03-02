import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CheckCircle2, History, Activity, UserCog, ClipboardList, Plus, Scale, Ruler, Sparkles, Clock } from 'lucide-react'
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
  if (bmi == null) return { label: 'Incomplete', textClass: 'text-gym-dark-400' }
  if (bmi < 18.5) return { label: 'Underweight', textClass: 'text-amber-500' }
  if (bmi < 25) return { label: 'High Performance', textClass: 'text-gym-500' }
  return { label: 'High Mass', textClass: 'text-red-500' }
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
        QRCode.toDataURL(qrRes.data.qrCodeToken, {
          width: 600,
          margin: 1,
          color: {
            dark: '#111827',
            light: '#FFFFFF'
          }
        }, (err, url) => {
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
      <WorkspaceScaffold title="Syncing Metrics..." links={customerNav}>
        <div className="flex h-96 items-center justify-center">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-gym-500 border-t-transparent"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2 w-2 bg-gym-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </WorkspaceScaffold>
    )
  }

  return (
    <WorkspaceScaffold
      title="Biometrics & Access"
      subtitle="Monitor your physiological progress and manage facility entry credentials."
      links={customerNav}
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Sidebar: Access & Stats */}
        <div className="lg:col-span-4 space-y-8">
          {/* Access Key Card */}
          <article className="gc-card bg-gym-dark-900 border-gym-dark-900 text-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gym-500/10 -mr-16 -mt-16 rounded-full blur-3xl group-hover:bg-gym-500/20 transition-all duration-700"></div>

            <div className="relative flex flex-col items-center">
              <div className="flex items-center gap-3 self-start mb-8">
                <div className="w-10 h-10 rounded-xl bg-gym-500/20 text-gym-500 flex items-center justify-center">
                  <Activity size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-gym-500 italic">Facility Access</h2>
                  <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest">Digital Identification Key</p>
                </div>
              </div>

              <div className="relative p-4 bg-white rounded-[32px] shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:rotate-1">
                <div className="w-48 h-48 sm:w-56 sm:h-56">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Secure Access QR" className="w-full h-full object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-black uppercase text-gym-dark-200">
                      Syncing Key...
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-2 -left-2 -right-2 h-4 bg-gym-500/30 blur-xl rounded-full opacity-50"></div>
              </div>

              <div className="mt-10 w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gym-dark-400">Security Note</p>
                <p className="mt-1 text-xs font-bold text-gym-dark-100 italic">Scan at tactical terminals for instant deployment.</p>
              </div>
            </div>
          </article>

          {/* Biometric Analysis */}
          <article className="gc-card border-2 border-gym-dark-50">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-1.5 h-6 bg-gym-500 rounded-full"></div>
              <h2 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight">Biometric Output</h2>
            </div>

            {currentHealth ? (
              <div className="space-y-8">
                <div className="flex justify-center flex-col items-center">
                  <div className="relative h-48 w-48">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <path
                        d="M 20 80 A 40 40 0 1 1 80 80"
                        fill="none"
                        stroke="#F3F4F6"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 20 80 A 40 40 0 1 1 80 80"
                        fill="none"
                        stroke="url(#bmiGradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray="188"
                        strokeDashoffset={188 - (Math.min(100, (currentBmi - 12) / (35 - 12) * 100) / 100 * 188)}
                        className="transition-all duration-1000 ease-out"
                      />
                      <defs>
                        <linearGradient id="bmiGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#F59E0B" />
                          <stop offset="50%" stopColor="#F97316" />
                          <stop offset="100%" stopColor="#EF4444" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gym-dark-300">Body Mass Index</p>
                      <p className="text-5xl font-black text-gym-dark-900 tracking-tighter">
                        {currentBmi == null ? '--' : currentBmi.toFixed(1)}
                      </p>
                      <p className={`mt-2 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-gym-dark-900 ${bmiLevel.textClass}`}>
                        {bmiLevel.label}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-gym-dark-50/50 border border-gym-dark-100/50 group transition-colors hover:border-gym-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Ruler size={14} className="text-gym-dark-400 group-hover:text-gym-500" />
                      <span className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest">Height</span>
                    </div>
                    <p className="text-xl font-black text-gym-dark-900">{currentHealth.heightCm} <span className="text-xs text-gym-dark-400">CM</span></p>
                  </div>
                  <div className="p-4 rounded-2xl bg-gym-dark-50/50 border border-gym-dark-100/50 group transition-colors hover:border-gym-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Scale size={14} className="text-gym-dark-400 group-hover:text-gym-500" />
                      <span className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest">Weight</span>
                    </div>
                    <p className="text-xl font-black text-gym-dark-900">{currentHealth.weightKg} <span className="text-xs text-gym-dark-400">KG</span></p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gym-dark-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gym-500/20 text-gym-500 flex items-center justify-center">
                      <Clock size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gym-dark-300">Last Sync</span>
                  </div>
                  <span className="text-xs font-black text-gym-500 uppercase">{formatDateVn(currentHealth.updatedAt)}</span>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center bg-gym-dark-50/30 rounded-3xl border-2 border-dashed border-gym-dark-100">
                <p className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest italic">No Biometric Signature</p>
                <p className="text-xs font-bold text-gym-dark-300 mt-2">Initialize your data below.</p>
              </div>
            )}
          </article>
        </div>

        {/* Main: Dashboard Content */}
        <div className="lg:col-span-8 space-y-8">
          {/* Form: Biometric Calibration */}
          <article className="gc-card border-l-8 border-gym-dark-900">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <UserCog className="h-6 w-6 text-gym-500" />
                <div>
                  <h2 className="text-xl font-black text-gym-dark-900 uppercase tracking-tight">Biometric Calibration</h2>
                  <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest">Update your tactical specifications</p>
                </div>
              </div>
              <div className="hidden sm:block">
                <Sparkles size={24} className="text-gym-dark-100" />
              </div>
            </div>

            <form onSubmit={handleHealthSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Vertical Reach (cm)</label>
                <div className="relative">
                  <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gym-dark-300" />
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={healthForm.heightCm}
                    onChange={(e) => setHealthForm({ ...healthForm, heightCm: e.target.value })}
                    className="gc-input"
                    placeholder="175.5"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Tactical Mass (kg)</label>
                <div className="relative">
                  <Scale className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gym-dark-300" />
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={healthForm.weightKg}
                    onChange={(e) => setHealthForm({ ...healthForm, weightKg: e.target.value })}
                    className="gc-input"
                    placeholder="82.4"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submittingHealth}
                className="btn-primary w-full py-4 text-xs shadow-xl shadow-gym-500/20 active:scale-95"
              >
                {submittingHealth ? 'CALIBRATING...' : 'SAVE BIOMETRICS'}
              </button>
            </form>
          </article>

          {/* Coach Performance Notes */}
          <article className="gc-card-compact border-2 border-gym-dark-50 bg-white shadow-xl shadow-gym-dark-900/5">
            <div className="flex items-center gap-3 mb-8 px-2">
              <ClipboardList className="h-6 w-6 text-gym-500" />
              <div>
                <h2 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight">Technical Directives</h2>
                <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest">Intelligence from your Personal Trainer</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto px-2 custom-scrollbar">
              {coachNotes.length > 0 ? (
                coachNotes.map((note) => (
                  <div key={note.noteId} className="p-6 rounded-[32px] bg-gym-dark-50/50 border-2 border-gym-dark-100/50 hover:border-gym-500/30 hover:bg-white hover:shadow-xl transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gym-dark-900 text-gym-500 flex items-center justify-center font-black shadow-lg">
                          {note.coachName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-gym-dark-900 uppercase tracking-tight">{note.coachName}</p>
                          <p className="text-[9px] font-bold text-gym-500 uppercase tracking-tighter">Strategic Lead</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-gym-dark-100 shadow-sm">
                        {formatDateVn(note.sessionDate)}
                      </span>
                    </div>
                    <div className="bg-white/50 p-4 rounded-2xl border border-gym-dark-50 relative group-hover:bg-white transition-colors">
                      <p className="text-xs font-medium text-gym-dark-700 leading-relaxed italic">
                        "{note.noteContent}"
                      </p>
                      <div className="absolute -top-3 -left-2 text-gym-500 opacity-20 group-hover:opacity-40 transition-opacity">
                        <ClipboardList size={32} />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center bg-gym-dark-50/30 rounded-[40px] border-2 border-dashed border-gym-dark-100">
                  <ClipboardList className="mx-auto text-gym-dark-200 mb-4" size={48} />
                  <p className="text-xs font-black text-gym-dark-400 uppercase tracking-widest">No Tactical Feedback</p>
                  <p className="text-[10px] font-bold text-gym-dark-300 mt-1">Complete Personal Training sessions to receive analytics.</p>
                </div>
              )}
            </div>
          </article>

          {/* Deployment History (Table) */}
          <article className="gc-card-compact border-2 border-gym-dark-50 overflow-hidden">
            <div className="flex items-center justify-between mb-8 px-4 pt-4">
              <div className="flex items-center gap-3">
                <History className="h-6 w-6 text-gym-500" />
                <h2 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight">Deployment Logs</h2>
              </div>
              <div className="text-[10px] font-black text-gym-dark-400 uppercase tracking-wider bg-gym-dark-50 px-4 py-2 rounded-full border border-gym-dark-100">
                {checkinHistory.length} EVENTS LOGGED
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-gym-dark-900 text-gym-500 text-[10px] font-black uppercase tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-5">Timestamp</th>
                    <th className="px-8 py-5">Assigned Plan</th>
                    <th className="px-8 py-5">Authentication Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gym-dark-50">
                  {checkinHistory.length > 0 ? (
                    checkinHistory.map((item) => (
                      <tr key={item.checkInId} className="hover:bg-gym-50/50 transition-colors group">
                        <td className="px-8 py-5 font-black text-gym-dark-900 text-sm italic group-hover:text-gym-500 transition-colors">
                          {formatDateTimeVn(item.checkInTime)}
                        </td>
                        <td className="px-8 py-5">
                          <span className="inline-flex items-center rounded-xl bg-gym-dark-900 px-4 py-1.5 text-[10px] font-black text-gym-500 uppercase tracking-widest border border-gym-dark-800 shadow-sm">
                            {item.planName}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-xs font-bold text-gym-dark-400 uppercase tracking-tight group-hover:text-gym-dark-900 transition-colors">
                          {item.checkedByName || 'SYSTEM_AUTO'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-8 py-20 text-center">
                        <History className="mx-auto text-gym-dark-100 mb-4" size={48} />
                        <p className="text-xs font-black text-gym-dark-300 uppercase tracking-widest italic">Encrypted History Null</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-10 right-10 z-[150] flex items-center gap-6 rounded-[32px] bg-red-900 border-2 border-red-500/30 p-6 text-white shadow-[0_20px_50px_rgba(0,0,0,0.4)] animate-in slide-in-from-bottom duration-500">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400">System Warning</p>
            <p className="text-sm font-black text-white">{error}</p>
          </div>
          <button onClick={() => setError('')} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-colors">
            <Plus className="h-5 w-5 rotate-45" />
          </button>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CustomerCheckinHealthPage
