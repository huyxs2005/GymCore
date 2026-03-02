import { useState, useEffect, useCallback } from 'react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { coachNav } from '../../config/navigation'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'
import { User, Star, Activity, ClipboardList, TrendingUp, Phone, Mail, ChevronRight, X, Plus, Edit2, Check, Scale, Calendar, Clock } from 'lucide-react'

function StarDisplay({ rating }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-base ${s <= rating ? 'text-yellow-400' : 'text-slate-200'}`}>★</span>
      ))}
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    SCHEDULED: { label: 'Upcoming', cls: 'bg-blue-100 text-blue-700' },
    COMPLETED: { label: 'Completed', cls: 'bg-green-100 text-green-700' },
    CANCELLED: { label: 'Cancelled', cls: 'bg-red-100 text-red-700' },
  }
  const cfg = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' }
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${cfg.cls}`}>{cfg.label}</span>
}

function getBmiLabel(value) {
  if (!value) return null
  if (value < 18.5) return { label: 'Low', cls: 'text-blue-700 bg-blue-50' }
  if (value < 25) return { label: 'Optimal', cls: 'text-green-700 bg-green-50' }
  if (value < 30) return { label: 'High', cls: 'text-orange-700 bg-orange-50' }
  return { label: 'Very high', cls: 'text-red-700 bg-red-50' }
}

function StudentDetailModal({ student, onClose }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [studentInfo, setStudentInfo] = useState(student)
  const [history, setHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [progressForm, setProgressForm] = useState({ heightCm: '', weightKg: '' })
  const [progressLoading, setProgressLoading] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [noteForm, setNoteForm] = useState({ sessionId: '', content: '' })
  const [editingNote, setEditingNote] = useState(null)
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
      setError(e?.response?.data?.message || 'Could not load history')
    } finally {
      setHistoryLoading(false)
    }
  }, [student.customerId])

  const refreshDetail = useCallback(async () => {
    try {
      const res = await coachBookingApi.getCoachCustomerDetail(student.customerId)
      setStudentInfo(res?.data ?? res)
    } catch (e) {
      console.error('Failed to refresh customer detail', e)
    }
  }, [student.customerId])

  useEffect(() => {
    if (activeTab === 'history' || activeTab === 'notes') loadHistory()
  }, [activeTab, loadHistory])

  async function handleUpdateProgress() {
    const hCm = parseFloat(progressForm.heightCm)
    const wKg = parseFloat(progressForm.weightKg)
    if (!hCm || !wKg || hCm <= 0 || wKg <= 0) {
      setError('Please enter valid height and weight values')
      return
    }
    try {
      setProgressLoading(true)
      setError('')
      await coachBookingApi.updateCustomerProgress(student.customerId, { heightCm: hCm, weightKg: wKg })
      setProgressMsg('Progress updated successfully!')
      setProgressForm({ heightCm: '', weightKg: '' })
      await refreshDetail()
      setTimeout(() => setProgressMsg(''), 4000)
    } catch (e) {
      setError(e?.response?.data?.message || 'Update failed')
    } finally {
      setProgressLoading(false)
    }
  }

  async function handleAddNote() {
    if (!noteForm.sessionId || !noteForm.content.trim()) {
      setError('Please choose a session and enter note content')
      return
    }
    try {
      setNoteLoading(true)
      setError('')
      await coachBookingApi.createSessionNote(parseInt(noteForm.sessionId), { noteContent: noteForm.content })
      setNoteMsg('Note added successfully!')
      setNoteForm({ sessionId: '', content: '' })
      await loadHistory()
      setTimeout(() => setNoteMsg(''), 3000)
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to add note')
    } finally {
      setNoteLoading(false)
    }
  }

  async function handleUpdateNote() {
    if (!editingNote?.content?.trim()) {
      setError('Note content cannot be empty')
      return
    }
    try {
      setNoteLoading(true)
      setError('')
      await coachBookingApi.updateSessionNote(editingNote.noteId, { noteContent: editingNote.content })
      setNoteMsg('Note updated successfully!')
      setEditingNote(null)
      await loadHistory()
      setTimeout(() => setNoteMsg(''), 3000)
    } catch (e) {
      setError(e?.response?.data?.message || 'Update failed')
    } finally {
      setNoteLoading(false)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <User className="h-3.5 w-3.5" /> },
    { id: 'history', label: 'History', icon: <Calendar className="h-3.5 w-3.5" /> },
    { id: 'progress', label: 'Progress', icon: <TrendingUp className="h-3.5 w-3.5" /> },
    { id: 'notes', label: 'Notes', icon: <ClipboardList className="h-3.5 w-3.5" /> },
  ]

  const h = studentInfo.health ?? {}
  const bmi = h.bmi ? parseFloat(h.bmi).toFixed(1) : null
  const bmiInfo = getBmiLabel(bmi ? parseFloat(bmi) : null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4 border-b border-slate-100 p-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gym-100 to-gym-200">
            <User className="h-7 w-7 text-gym-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-bold text-slate-900">{student.fullName}</h3>
            <p className="text-sm text-slate-500">{student.sessionCount} sessions | {student.email}</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 transition-colors hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-3">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-all ${activeTab === t.id ? 'bg-gym-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Current condition</h4>
                {Object.keys(h).length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center">
                    <Scale className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-500">No health data yet. Update progress to add the first record.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-blue-50 p-4 text-center">
                      <p className="mb-1 text-xs font-bold uppercase text-blue-400">Height</p>
                      <p className="text-2xl font-black text-blue-700">{h.heightCm}<span className="text-sm font-semibold"> cm</span></p>
                    </div>
                    <div className="rounded-2xl bg-purple-50 p-4 text-center">
                      <p className="mb-1 text-xs font-bold uppercase text-purple-400">Weight</p>
                      <p className="text-2xl font-black text-purple-700">{h.weightKg}<span className="text-sm font-semibold"> kg</span></p>
                    </div>
                    <div className={`rounded-2xl p-4 text-center ${bmiInfo?.cls ?? 'bg-slate-50'}`}>
                      <p className="mb-1 text-xs font-bold uppercase opacity-60">BMI</p>
                      <p className="text-2xl font-black">{bmi ?? '-'}</p>
                      {bmiInfo && <p className="mt-0.5 text-[10px] font-bold">{bmiInfo.label}</p>}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Contact</h4>
                <div className="space-y-2">
                  <a href={`tel:${student.phone}`} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 transition-colors hover:bg-blue-50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100"><Phone className="h-4 w-4 text-blue-600" /></div>
                    <span className="text-sm font-medium text-slate-700">{student.phone || '-'}</span>
                  </a>
                  <a href={`mailto:${student.email}`} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 transition-colors hover:bg-purple-50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100"><Mail className="h-4 w-4 text-purple-600" /></div>
                    <span className="text-sm font-medium text-slate-700">{student.email || '-'}</span>
                  </a>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Stats</h4>
                <div className="flex items-center gap-4 rounded-2xl bg-gym-50 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gym-100"><Activity className="h-6 w-6 text-gym-600" /></div>
                  <div>
                    <p className="text-3xl font-black text-gym-700">{student.sessionCount}</p>
                    <p className="text-xs font-bold text-gym-500">sessions with you</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Session history</h4>
              {historyLoading ? (
                <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-50" />)}</div>
              ) : (history?.sessions ?? []).length === 0 ? (
                <div className="py-10 text-center text-slate-400"><Calendar className="mx-auto mb-2 h-8 w-8 opacity-40" /><p className="text-sm">No training history yet</p></div>
              ) : (
                <div className="space-y-2">
                  {(history?.sessions ?? []).map(s => (
                    <div key={s.ptSessionId} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
                        <Clock className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">{new Date(s.sessionDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                        <p className="whitespace-nowrap text-xs font-medium text-slate-600">Slot {s.slotIndex}: {s.startTime?.substring(0, 5)} - {s.endTime?.substring(0, 5)}</p>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                  ))}
                </div>
              )}

              {(history?.healthHistory ?? []).length > 0 && (
                <div>
                  <h4 className="mb-3 mt-6 text-xs font-bold uppercase tracking-widest text-slate-400">Progress history</h4>
                  <div className="space-y-2">
                    {history.healthHistory.map((rec, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <Scale className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-700">{rec.weightKg} kg | {rec.heightCm} cm</span>
                        <span className="ml-auto text-xs text-slate-400">BMI {rec.bmi?.toFixed ? rec.bmi.toFixed(1) : rec.bmi}</span>
                        <span className="text-xs text-slate-400">{rec.recordedAt ? new Date(rec.recordedAt).toLocaleDateString('en-GB') : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="space-y-5">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Update health metrics</h4>
              {progressMsg && <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">{progressMsg}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">Height (cm) *</label>
                  <input
                    type="number"
                    min="100" max="250" step="0.1"
                    placeholder="Example: 170"
                    value={progressForm.heightCm}
                    onChange={e => setProgressForm(f => ({ ...f, heightCm: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gym-300"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-600">Weight (kg) *</label>
                  <input
                    type="number"
                    min="30" max="300" step="0.1"
                    placeholder="Example: 65"
                    value={progressForm.weightKg}
                    onChange={e => setProgressForm(f => ({ ...f, weightKg: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gym-300"
                  />
                </div>
              </div>
              {progressForm.heightCm && progressForm.weightKg && parseFloat(progressForm.heightCm) > 0 && parseFloat(progressForm.weightKg) > 0 && (
                <div className="flex items-center gap-3 rounded-xl bg-gym-50 p-4">
                  <TrendingUp className="h-5 w-5 text-gym-600" />
                  <div>
                    <p className="text-xs font-bold text-gym-600">Estimated BMI</p>
                    <p className="text-lg font-black text-gym-700">
                      {(parseFloat(progressForm.weightKg) / Math.pow(parseFloat(progressForm.heightCm) / 100, 2)).toFixed(1)}
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={handleUpdateProgress}
                disabled={progressLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gym-600 py-3 font-bold text-white transition-colors hover:bg-gym-700 disabled:opacity-50"
              >
                {progressLoading ? 'Saving...' : <><Check className="h-4 w-4" /> Save progress</>}
              </button>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-5">
              {noteMsg && <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">{noteMsg}</div>}

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Add a new note</h4>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-600">Select session</label>
                    <select
                      value={noteForm.sessionId}
                      onChange={e => setNoteForm(f => ({ ...f, sessionId: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gym-300"
                    >
                      <option value="">-- Select session --</option>
                      {historyLoading ? <option disabled>Loading...</option> : (history?.sessions ?? []).map(s => (
                        <option key={s.ptSessionId} value={s.ptSessionId}>
                          {new Date(s.sessionDate).toLocaleDateString('en-GB')} | Slot {s.slotIndex} | {s.status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Enter notes, meal guidance, workout details, or comments..."
                    value={noteForm.content}
                    onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gym-300"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={noteLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> {noteLoading ? 'Saving...' : 'Add note'}
                  </button>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Existing notes</h4>
                {historyLoading ? (
                  <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-50" />)}</div>
                ) : (history?.notes ?? []).length === 0 ? (
                  <div className="py-8 text-center text-slate-400"><ClipboardList className="mx-auto mb-2 h-8 w-8 opacity-40" /><p className="text-sm">No notes yet</p></div>
                ) : (
                  <div className="space-y-3">
                    {history.notes.map(n => (
                      <div key={n.noteId} className="rounded-xl border border-slate-200 bg-white p-4">
                        {editingNote?.noteId === n.noteId ? (
                          <div className="space-y-2">
                            <textarea
                              rows={3}
                              className="w-full resize-none rounded-lg border border-gym-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gym-300"
                              value={editingNote.content}
                              onChange={e => setEditingNote(en => ({ ...en, content: e.target.value }))}
                            />
                            <div className="flex gap-2">
                              <button onClick={handleUpdateNote} disabled={noteLoading} className="flex-1 rounded-lg bg-gym-600 py-1.5 text-xs font-bold text-white hover:bg-gym-700 disabled:opacity-50">
                                {noteLoading ? 'Saving...' : 'Save'}
                              </button>
                              <button onClick={() => setEditingNote(null)} className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <p className="flex-1 text-sm leading-relaxed text-slate-700">{n.noteContent}</p>
                              <button
                                onClick={() => setEditingNote({ noteId: n.noteId, content: n.noteContent })}
                                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-gym-50 hover:text-gym-600"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <p className="mt-2 text-[10px] font-bold uppercase tracking-tight text-slate-500">
                              Session #{n.ptSessionId} | {n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('en-GB') : new Date(n.createdAt).toLocaleDateString('en-GB')}
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
      setError(e?.response?.data?.message || e?.message || 'Could not load customers.')
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
      setError(e?.response?.data?.message || 'Could not load feedback')
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
    } catch {
      setStudentDetail(student)
      setSelectedStudent(student)
    }
  }

  return (
    <WorkspaceScaffold
      title="Customer Management"
      subtitle="Track progress, notes, and feedback for each customer"
      links={coachNav}
    >
      <div className="space-y-6">
        <div className="flex w-fit rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${activeTab === 'students' ? 'bg-white text-gym-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <User className="h-4 w-4" /> Customers
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${activeTab === 'feedback' ? 'bg-white text-gym-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Star className="h-4 w-4" /> Feedback
            {feedbackAvg && <span className="rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-black text-yellow-700">{feedbackAvg.averageRating?.toFixed ? feedbackAvg.averageRating.toFixed(1) : feedbackAvg.averageRating}/5</span>}
          </button>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {activeTab === 'students' && (
          <>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-50" />)}</div>
            ) : students.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center">
                <User className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <h3 className="text-lg font-bold text-slate-900">No customers yet</h3>
                <p className="mt-1 text-sm text-slate-500">Customers will appear here once you have confirmed PT sessions.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {students.map(student => (
                  <button
                    key={student.customerId}
                    onClick={() => handleSelectStudent(student)}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:border-gym-200 hover:shadow-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
                        <User className="h-6 w-6 text-slate-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-bold text-slate-900">{student.fullName}</h4>
                        <p className="truncate text-xs text-slate-500">{student.email}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-gym-500" />
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-full bg-gym-50 px-3 py-1.5">
                        <Activity className="h-3 w-3 text-gym-600" />
                        <span className="text-xs font-bold text-gym-700">{student.sessionCount} sessions</span>
                      </div>
                      {student.phone && (
                        <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span className="text-xs font-medium text-slate-500">{student.phone}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'feedback' && (
          <div className="space-y-6">
            {feedbackAvg && (
              <div className="rounded-3xl border border-yellow-100 bg-gradient-to-r from-yellow-50 via-orange-50 to-amber-50 p-6">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-5xl font-black text-yellow-500">
                      {feedbackAvg.averageRating?.toFixed ? feedbackAvg.averageRating.toFixed(1) : (feedbackAvg.averageRating ?? 0)}
                    </p>
                    <StarDisplay rating={Math.round(feedbackAvg.averageRating ?? 0)} />
                    <p className="mt-1 text-xs text-slate-500">{feedbackAvg.totalReviews} reviews</p>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Average rating</h3>
                    <p className="mt-1 text-sm text-slate-500">A combined view of feedback from all of your customers.</p>
                  </div>
                </div>
              </div>
            )}

            {feedbackLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-50" />)}</div>
            ) : feedback.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center">
                <Star className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <h3 className="text-lg font-bold text-slate-900">No feedback yet</h3>
                <p className="mt-1 text-sm text-slate-500">Customers can submit feedback after completed sessions.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedback.map(fb => (
                  <div key={fb.coachFeedbackId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                        <User className="h-5 w-5 text-slate-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-slate-900">{fb.customerName}</h4>
                          <StarDisplay rating={fb.rating} />
                        </div>
                        {fb.comment && <p className="mt-2 text-sm leading-relaxed text-slate-600">"{fb.comment}"</p>}
                        <p className="mt-2 text-[11px] text-slate-400">
                          Session #{fb.ptSessionId} | {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
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
