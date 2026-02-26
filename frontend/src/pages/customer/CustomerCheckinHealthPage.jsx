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
      subtitle="Quản lý việc check-in và theo dõi tiến trình sức khỏe của bạn."
      links={customerNav}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* QR Code Section */}
        <section className="lg:col-span-1">
          <article className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 self-start mb-4">
              <CheckCircle2 className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Mã QR Check-in</h2>
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
              Sử dụng mã này tại quầy lễ tân để thực hiện check-in khi đến tập.
            </p>
          </article>

          {/* Current Stats */}
          <article className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Chỉ số hiện tại</h2>
            </div>
            {currentHealth ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">BMI</p>
                  <p className="mt-1 text-2xl font-bold text-gym-600">{currentHealth.bmi}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cập nhật</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {formatDateVn(currentHealth.updatedAt)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Chiều cao</p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{currentHealth.heightCm} cm</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cân nặng</p>
                  <p className="mt-1 text-lg font-bold text-slate-800">{currentHealth.weightKg} kg</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Chưa có dữ liệu sức khỏe.</p>
            )}
          </article>
        </section>

        {/* Main Section */}
        <section className="lg:col-span-2 space-y-6">
          {/* Health Form */}
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <UserCog className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Cập nhật chỉ số cơ thể</h2>
            </div>
            <form onSubmit={handleHealthSubmit} className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Chiều cao (cm)</label>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Cân nặng (kg)</label>
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
                {submittingHealth ? 'Đang lưu...' : <><Plus className="h-4 w-4" /> Lưu chỉ số</>}
              </button>
            </form>
          </article>

          {/* Coach Notes */}
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Ghi chú từ PT</h2>
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
                <p className="text-sm text-slate-500 italic py-4">Chưa có ghi chú nào từ huấn luyện viên.</p>
              )}
            </div>
          </article>

          {/* Check-in History */}
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-gym-600" />
              <h2 className="text-lg font-bold text-slate-800">Lịch sử Check-in</h2>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Gói tập</th>
                    <th className="px-4 py-3">Người xác nhận</th>
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
                        Chưa có lịch sử check-in.
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
