import { useState, useEffect, useCallback } from 'react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { coachNav } from '../../config/navigation'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'
import { User, Star, Activity, ClipboardList, TrendingUp, Phone, Mail, ChevronRight, X, Plus, Edit2, Check, Scale, Calendar, Clock } from 'lucide-react'

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarDisplay({ rating }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} className={`text-base ${s <= rating ? 'text-yellow-400' : 'text-slate-200'}`}>★</span>
      ))}
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    SCHEDULED: { label: 'Sắp tới', cls: 'bg-blue-100 text-blue-700' },
    COMPLETED: { label: 'Đã tập', cls: 'bg-green-100 text-green-700' },
    CANCELLED: { label: 'Đã hủy', cls: 'bg-red-100 text-red-700' },
  }
  const cfg = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' }
  return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${cfg.cls}`}>{cfg.label}</span>
}

// ─── Student Detail Modal ─────────────────────────────────────────────────────

function StudentDetailModal({ student, onClose }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [studentInfo, setStudentInfo] = useState(student)
  const [history, setHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const [progressForm, setProgressForm] = useState({ heightCm: '', weightKg: '' })
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [noteForm, setNoteForm] = useState({ sessionId: '', content: '' })
  const [editingNote, setEditingNote] = useState(null) // { noteId, content }
  const [noteLoading, setNoteLoading] = useState(false)
  const [noteMsg, setNoteMsg] = useState('')
  const [error, setError] = useState('')

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true)
      const res = await coachBookingApi.getCoachCustomerHistory(student.customerId)
      const raw = res?.data ?? res
      setHistory(raw)
    } catch (e) {
      setError(e?.response?.data?.message || 'Không tải được lịch sử')
    } finally {
      setHistoryLoading(false)
    }
  }, [student.customerId, historyKey])

  const refreshDetail = useCallback(async () => {
    try {
      const res = await coachBookingApi.getCoachCustomerDetail(student.customerId)
      setStudentInfo(res?.data ?? res)
    } catch (e) {
      console.error('Failed to refresh detail', e)
    }
  }, [student.customerId])

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'notes') loadHistory()
  }, [activeTab, loadHistory])

  async function handleUpdateProgress() {
    const hCm = parseFloat(progressForm.heightCm)
    const wKg = parseFloat(progressForm.weightKg)
    if (!hCm || !wKg || hCm <= 0 || wKg <= 0) {
      setError('Vui lòng nhập chiều cao và cân nặng hợp lệ')
      return
    }
    try {
      setProgressLoading(true)
      setError('')
      await coachBookingApi.updateCustomerProgress(student.customerId, { heightCm: hCm, weightKg: wKg })
      setProgressMsg('Đã cập nhật tiến trình thành công!')
      setProgressForm({ heightCm: '', weightKg: '' })
      await refreshDetail() // Fetch updated health stats immediately
      setTimeout(() => setProgressMsg(''), 4000)
    } catch (e) {
      setError(e?.response?.data?.message || 'Cập nhật thất bại')
    } finally {
      setProgressLoading(false)
    }
  }

  async function handleAddNote() {
    if (!noteForm.sessionId || !noteForm.content.trim()) {
      setError('Vui lòng chọn buổi tập và nhập nội dung ghi chú')
      return
    }
    try {
      setNoteLoading(true)
      setError('')
      await coachBookingApi.createSessionNote(parseInt(noteForm.sessionId), { noteContent: noteForm.content })
      setNoteMsg('Đã thêm ghi chú thành công!')
      setNoteForm({ sessionId: '', content: '' })
      setHistory(null)
      setHistoryKey(k => k + 1) // force loadHistory to re-run
      setTimeout(() => setNoteMsg(''), 3000)
    } catch (e) {
      setError(e?.response?.data?.message || 'Thêm ghi chú thất bại')
    } finally {
      setNoteLoading(false)
    }
  }

  async function handleUpdateNote() {
    if (!editingNote?.content?.trim()) {
      setError('Nội dung ghi chú không được để trống')
      return
    }
    try {
      setNoteLoading(true)
      setError('')
      await coachBookingApi.updateSessionNote(editingNote.noteId, { noteContent: editingNote.content })
      setNoteMsg('Đã cập nhật ghi chú!')
      setEditingNote(null)
      setHistory(null)
      setHistoryKey(k => k + 1) // force loadHistory to re-run
      setTimeout(() => setNoteMsg(''), 3000)
    } catch (e) {
      setError(e?.response?.data?.message || 'Cập nhật thất bại')
    } finally {
      setNoteLoading(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'history', label: 'Lịch sử tập', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'progress', label: 'Cập nhật tiến trình', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'notes', label: 'Ghi chú', icon: <ClipboardList className="w-3.5 h-3.5" /> },
  ]

  const h = studentInfo.health ?? {}
  const bmi = h.bmi ? parseFloat(h.bmi).toFixed(1) : null
  const getBmiLabel = (b) => {
    if (!b) return null
    if (b < 18.5) return { label: 'Gầy', cls: 'text-blue-700 bg-blue-50' }
    if (b < 25) return { label: 'Bình thường', cls: 'text-green-700 bg-green-50' }
    if (b < 30) return { label: 'Thừa cân', cls: 'text-orange-700 bg-orange-50' }
    return { label: 'Béo phì', cls: 'text-red-700 bg-red-50' }
  }
  const bmiInfo = getBmiLabel(bmi ? parseFloat(bmi) : null)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-4 p-6 border-b border-slate-100">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gym-100 to-gym-200 flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-gym-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-slate-900 truncate">{student.fullName}</h3>
            <p className="text-sm text-slate-500">{student.sessionCount} buổi tập · {student.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 border-b border-slate-100 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-gym-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm">{error}</div>}

          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Health stats */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Thể trạng hiện tại</h4>
                {Object.keys(h).length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-6 text-center">
                    <Scale className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Chưa có dữ liệu sức khỏe. Hãy cập nhật tiến trình.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 rounded-2xl p-4 text-center">
                      <p className="text-xs font-bold text-blue-400 uppercase mb-1">Chiều cao</p>
                      <p className="text-2xl font-black text-blue-700">{h.heightCm}<span className="text-sm font-semibold"> cm</span></p>
                    </div>
                    <div className="bg-purple-50 rounded-2xl p-4 text-center">
                      <p className="text-xs font-bold text-purple-400 uppercase mb-1">Cân nặng</p>
                      <p className="text-2xl font-black text-purple-700">{h.weightKg}<span className="text-sm font-semibold"> kg</span></p>
                    </div>
                    <div className={`rounded-2xl p-4 text-center ${bmiInfo?.cls ?? 'bg-slate-50'}`}>
                      <p className="text-xs font-bold uppercase mb-1 opacity-60">BMI</p>
                      <p className="text-2xl font-black">{bmi ?? '—'}</p>
                      {bmiInfo && <p className="text-[10px] font-bold mt-0.5">{bmiInfo.label}</p>}
                    </div>
                  </div>
                )}
              </div>
              {/* Contact */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Liên hệ</h4>
                <div className="space-y-2">
                  <a href={`tel:${student.phone}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><Phone className="w-4 h-4 text-blue-600" /></div>
                    <span className="text-sm font-medium text-slate-700">{student.phone || '—'}</span>
                  </a>
                  <a href={`mailto:${student.email}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-purple-50 transition-colors">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center"><Mail className="w-4 h-4 text-purple-600" /></div>
                    <span className="text-sm font-medium text-slate-700">{student.email || '—'}</span>
                  </a>
                </div>
              </div>
              {/* Stats */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Thống kê</h4>
                <div className="bg-gym-50 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-gym-100 rounded-2xl flex items-center justify-center"><Activity className="w-6 h-6 text-gym-600" /></div>
                  <div>
                    <p className="text-3xl font-black text-gym-700">{student.sessionCount}</p>
                    <p className="text-xs font-bold text-gym-500">buổi tập với bạn</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Lịch sử buổi tập</h4>
              {historyLoading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />)}</div>
              ) : (history?.sessions ?? []).length === 0 ? (
                <div className="text-center py-10 text-slate-400"><Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">Chưa có lịch sử tập</p></div>
              ) : (
                <div className="space-y-2">
                  {(history?.sessions ?? []).map(s => (
                    <div key={s.ptSessionId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">{new Date(s.sessionDate).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                        <p className="text-xs text-slate-600 font-medium whitespace-nowrap">Slot {s.slotIndex}: {s.startTime?.substring(0, 5)} – {s.endTime?.substring(0, 5)}</p>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                  ))}
                </div>
              )}
              {/* Health history */}
              {(history?.healthHistory ?? []).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-6 mb-3">Lịch sử tiến trình</h4>
                  <div className="space-y-2">
                    {history.healthHistory.map((rec, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <Scale className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm font-semibold text-slate-700">{rec.weightKg} kg · {rec.heightCm} cm</span>
                        <span className="text-xs text-slate-400 ml-auto">BMI {rec.bmi?.toFixed ? rec.bmi.toFixed(1) : rec.bmi}</span>
                        <span className="text-xs text-slate-400">{rec.recordedAt ? new Date(rec.recordedAt).toLocaleDateString('vi-VN') : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress update */}
          {activeTab === 'progress' && (
            <div className="space-y-5">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Cập nhật chỉ số sức khỏe</h4>
              {progressMsg && <div className="p-3 bg-green-50 border border-green-100 text-green-700 rounded-xl text-sm">{progressMsg}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Chiều cao (cm) *</label>
                  <input
                    type="number"
                    min="100" max="250" step="0.1"
                    placeholder="Ví dụ: 170"
                    value={progressForm.heightCm}
                    onChange={e => setProgressForm(f => ({ ...f, heightCm: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gym-300 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1.5 block">Cân nặng (kg) *</label>
                  <input
                    type="number"
                    min="30" max="300" step="0.1"
                    placeholder="Ví dụ: 65"
                    value={progressForm.weightKg}
                    onChange={e => setProgressForm(f => ({ ...f, weightKg: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gym-300 focus:border-transparent"
                  />
                </div>
              </div>
              {progressForm.heightCm && progressForm.weightKg && parseFloat(progressForm.heightCm) > 0 && parseFloat(progressForm.weightKg) > 0 && (
                <div className="bg-gym-50 rounded-xl p-4 flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-gym-600" />
                  <div>
                    <p className="text-xs font-bold text-gym-600">BMI dự kiến</p>
                    <p className="text-lg font-black text-gym-700">
                      {(parseFloat(progressForm.weightKg) / Math.pow(parseFloat(progressForm.heightCm) / 100, 2)).toFixed(1)}
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={handleUpdateProgress}
                disabled={progressLoading}
                className="w-full py-3 bg-gym-600 text-white rounded-xl font-bold hover:bg-gym-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {progressLoading ? 'Đang lưu...' : <><Check className="w-4 h-4" /> Lưu tiến trình</>}
              </button>
            </div>
          )}

          {/* Notes */}
          {activeTab === 'notes' && (
            <div className="space-y-5">
              {noteMsg && <div className="p-3 bg-green-50 border border-green-100 text-green-700 rounded-xl text-sm">{noteMsg}</div>}

              {/* Add new note */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Thêm ghi chú mới</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">Chọn buổi tập</label>
                    <select
                      value={noteForm.sessionId}
                      onChange={e => setNoteForm(f => ({ ...f, sessionId: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gym-300"
                    >
                      <option value="">-- Chọn buổi tập --</option>
                      {historyLoading ? <option disabled>Đang tải...</option> : (history?.sessions ?? []).map(s => (
                        <option key={s.ptSessionId} value={s.ptSessionId}>
                          {new Date(s.sessionDate).toLocaleDateString('vi-VN')} · Slot {s.slotIndex} · {s.status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Nhập ghi chú, chế độ ăn, bài tập, nhận xét..."
                    value={noteForm.content}
                    onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gym-300"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={noteLoading}
                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> {noteLoading ? 'Đang lưu...' : 'Thêm ghi chú'}
                  </button>
                </div>
              </div>

              {/* Existing notes */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Ghi chú đã có</h4>
                {historyLoading ? (
                  <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />)}</div>
                ) : (history?.notes ?? []).length === 0 ? (
                  <div className="text-center py-8 text-slate-400"><ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">Chưa có ghi chú</p></div>
                ) : (
                  <div className="space-y-3">
                    {history.notes.map(n => (
                      <div key={n.noteId} className="bg-white rounded-xl border border-slate-200 p-4">
                        {editingNote?.noteId === n.noteId ? (
                          <div className="space-y-2">
                            <textarea
                              rows={3}
                              className="w-full border border-gym-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gym-300"
                              value={editingNote.content}
                              onChange={e => setEditingNote(en => ({ ...en, content: e.target.value }))}
                            />
                            <div className="flex gap-2">
                              <button onClick={handleUpdateNote} disabled={noteLoading} className="flex-1 py-1.5 bg-gym-600 text-white text-xs font-bold rounded-lg hover:bg-gym-700 disabled:opacity-50">
                                {noteLoading ? 'Đang lưu...' : '✓ Lưu'}
                              </button>
                              <button onClick={() => setEditingNote(null)} className="flex-1 py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50">
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm text-slate-700 leading-relaxed flex-1">{n.noteContent}</p>
                              <button
                                onClick={() => setEditingNote({ noteId: n.noteId, content: n.noteContent })}
                                className="p-1.5 text-slate-400 hover:text-gym-600 hover:bg-gym-50 rounded-lg transition-colors shrink-0"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-tight">
                              Buổi #{n.ptSessionId} · {n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('vi-VN') : new Date(n.createdAt).toLocaleDateString('vi-VN')}
                            </p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function CoachCustomersPage() {
  const [activeTab, setActiveTab] = useState('students')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentDetail, setStudentDetail] = useState(null)
  const [feedback, setFeedback] = useState([])
  const [feedbackAvg, setFeedbackAvg] = useState(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  useEffect(() => {
    loadStudents()
  }, [])

  useEffect(() => {
    if (activeTab === 'feedback') loadFeedback()
  }, [activeTab])

  async function loadStudents() {
    try {
      setError('')
      setLoading(true)
      const res = await coachBookingApi.getCoachCustomers()
      const raw = res?.data ?? res
      setStudents(Array.isArray(raw?.items) ? raw.items : [])
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Không tải được danh sách học viên.')
      setStudents([])
    } finally {
      setLoading(false)
    }
  }

  async function loadFeedback() {
    try {
      setFeedbackLoading(true)
      const [fbRes, avgRes] = await Promise.all([
        coachBookingApi.getCoachFeedback(),
        coachBookingApi.getCoachFeedbackAverage(),
      ])
      const fbRaw = fbRes?.data ?? fbRes
      const avgRaw = avgRes?.data ?? avgRes
      setFeedback(Array.isArray(fbRaw?.items) ? fbRaw.items : [])
      setFeedbackAvg(avgRaw)
    } catch (e) {
      setError(e?.response?.data?.message || 'Không tải được đánh giá')
    } finally {
      setFeedbackLoading(false)
    }
  }

  async function handleSelectStudent(student) {
    try {
      const res = await coachBookingApi.getCoachCustomerDetail(student.customerId)
      const raw = res?.data ?? res
      setStudentDetail(raw)
      setSelectedStudent(student)
    } catch (e) {
      setStudentDetail(student) // fallback to list data
      setSelectedStudent(student)
    }
  }

  return (
    <WorkspaceScaffold
      title="Quản lý Học viên"
      subtitle="Theo dõi tiến trình, ghi chú và đánh giá của từng học viên"
      links={coachNav}
    >
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'students' ? 'bg-white text-gym-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <User className="w-4 h-4" /> Học viên
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'feedback' ? 'bg-white text-gym-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            <Star className="w-4 h-4" /> Đánh giá
            {feedbackAvg && <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-1.5 py-0.5 rounded-full">{feedbackAvg.averageRating?.toFixed ? feedbackAvg.averageRating.toFixed(1) : feedbackAvg.averageRating}★</span>}
          </button>
        </div>

        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}

        {/* Students Tab */}
        {activeTab === 'students' && (
          <>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse" />)}</div>
            ) : students.length === 0 ? (
              <div className="bg-slate-50 rounded-3xl p-16 text-center border-2 border-dashed border-slate-200">
                <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900">Chưa có học viên nào</h3>
                <p className="text-slate-500 text-sm mt-1">Học viên sẽ xuất hiện khi bạn có buổi tập đã xác nhận.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {students.map(student => (
                  <button
                    key={student.customerId}
                    onClick={() => handleSelectStudent(student)}
                    className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-lg hover:border-gym-200 transition-all duration-300 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 truncate">{student.fullName}</h4>
                        <p className="text-xs text-slate-500 truncate">{student.email}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-gym-500 transition-colors shrink-0" />
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gym-50 rounded-full">
                        <Activity className="w-3 h-3 text-gym-600" />
                        <span className="text-xs font-bold text-gym-700">{student.sessionCount} buổi tập</span>
                      </div>
                      {student.phone && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500 font-medium">{student.phone}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <div className="space-y-6">
            {/* Average Rating Banner */}
            {feedbackAvg && (
              <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-amber-50 rounded-3xl p-6 border border-yellow-100">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-5xl font-black text-yellow-500">
                      {feedbackAvg.averageRating?.toFixed ? feedbackAvg.averageRating.toFixed(1) : (feedbackAvg.averageRating ?? 0)}
                    </p>
                    <StarDisplay rating={Math.round(feedbackAvg.averageRating ?? 0)} />
                    <p className="text-xs text-slate-500 mt-1">{feedbackAvg.totalReviews} đánh giá</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Điểm đánh giá trung bình</h3>
                    <p className="text-sm text-slate-500 mt-1">Tổng hợp phản hồi từ tất cả học viên của bạn.</p>
                  </div>
                </div>
              </div>
            )}

            {feedbackLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-50 rounded-2xl animate-pulse" />)}</div>
            ) : feedback.length === 0 ? (
              <div className="bg-slate-50 rounded-3xl p-16 text-center border-2 border-dashed border-slate-200">
                <Star className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900">Chưa có đánh giá nào</h3>
                <p className="text-slate-500 text-sm mt-1">Học viên có thể đánh giá sau khi hoàn thành buổi tập.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedback.map(fb => (
                  <div key={fb.coachFeedbackId} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-slate-900">{fb.customerName}</h4>
                          <StarDisplay rating={fb.rating} />
                        </div>
                        {fb.comment && <p className="text-sm text-slate-600 mt-2 leading-relaxed">"{fb.comment}"</p>}
                        <p className="text-[11px] text-slate-400 mt-2">
                          Buổi #{fb.ptSessionId} · {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && studentDetail && (
        <StudentDetailModal
          student={studentDetail}
          onClose={() => { setSelectedStudent(null); setStudentDetail(null) }}
        />
      )}
    </WorkspaceScaffold>
  )
}

export default CoachCustomersPage
