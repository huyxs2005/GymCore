import { useState, useEffect, useCallback } from 'react'
import {
  User,
  Star,
  Activity,
  ClipboardList,
  TrendingUp,
  Phone,
  Mail,
  ChevronRight,
  X,
  Plus,
  Edit2,
  Check,
  Scale,
  Calendar,
  Clock,
  CheckCircle2,
  Users,
  Search,
  Quote,
  AlertCircle,
} from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { coachNav } from '../../config/navigation'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'
import { formatDate, formatDateTime } from '../../utils/formatters'

function StarDisplay({ rating }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((starValue) => (
        <Star
          key={starValue}
          aria-hidden="true"
          className={starValue <= rating ? 'h-4 w-4 fill-amber-400 text-amber-400' : 'h-4 w-4 fill-transparent text-white/15'}
          strokeWidth={1.6}
        />
      ))}
    </span>
  )
}

function StatusBadge({ status }) {
  const map = {
    SCHEDULED: { label: 'Upcoming', cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    COMPLETED: { label: 'Completed', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    CANCELLED: { label: 'Cancelled', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  }
  const cfg = map[status] ?? { label: status, cls: 'bg-white/5 text-slate-400 border-white/10' }

  return <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${cfg.cls}`}>{cfg.label}</span>
}

function getBmiLabel(value) {
  if (!value) return null
  if (value < 18.5) return { label: 'Low', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20' }
  if (value < 25) return { label: 'Optimal', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
  if (value < 30) return { label: 'High', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
  return { label: 'Very high', cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20' }
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
      await coachBookingApi.createSessionNote(parseInt(noteForm.sessionId, 10), { noteContent: noteForm.content })
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

  const health = studentInfo.health ?? {}
  const bmi = health.bmi ? parseFloat(health.bmi).toFixed(1) : null
  const bmiInfo = getBmiLabel(bmi ? parseFloat(bmi) : null)
  const sessionHistory = history?.sessions ?? []
  const healthHistory = history?.healthHistory ?? []
  const notes = history?.notes ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-customer-modal-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden bg-transparent overscroll-contain"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="gc-glass-panel flex h-full flex-col overflow-hidden border-white/10 shadow-2xl">
          <div className="flex items-center gap-4 border-b border-white/5 bg-white/[0.02] p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
              <User className="h-7 w-7 text-slate-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 id="coach-customer-modal-title" className="truncate font-display text-xl font-bold text-white">
                {student.fullName}
              </h3>
              <p className="text-sm font-medium text-slate-500">{student.sessionCount} sessions &bull; {student.email}</p>
            </div>
            <button type="button" aria-label="Close trainee detail" onClick={onClose} className="gc-button-icon text-slate-500 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div role="tablist" aria-label="Trainee detail sections" className="flex gap-1 overflow-x-auto border-b border-white/5 bg-white/[0.01] p-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`coach-customer-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`coach-customer-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-[transform,opacity,box-shadow,background-color,border-color,color] ${
                  activeTab === tab.id ? 'bg-gym-500 text-slate-950 shadow-glow' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span className="tracking-wide uppercase">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            {error ? (
              <div aria-live="polite" className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">
                {error}
              </div>
            ) : null}

            {activeTab === 'overview' ? (
              <section id="coach-customer-panel-overview" role="tabpanel" aria-labelledby="coach-customer-tab-overview" className="space-y-8">
                <div>
                  <p className="gc-section-kicker mb-4">Health Profile</p>
                  {Object.keys(health).length === 0 ? (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center">
                      <Scale className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                      <p className="text-sm text-slate-500">No health metrics have been recorded for this customer yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="gc-card-compact border-white/5 bg-white/[0.03] text-center">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Height</p>
                        <p className="font-display text-3xl font-black text-white">
                          {health.heightCm}
                          <span className="ml-1 text-sm font-medium text-slate-500">cm</span>
                        </p>
                      </div>
                      <div className="gc-card-compact border-white/5 bg-white/[0.03] text-center">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Weight</p>
                        <p className="font-display text-3xl font-black text-white">
                          {health.weightKg}
                          <span className="ml-1 text-sm font-medium text-slate-500">kg</span>
                        </p>
                      </div>
                      <div className={`gc-card-compact border text-center ${bmiInfo?.cls || 'border-white/5 bg-white/[0.03] text-white'}`}>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest opacity-60">BMI</p>
                        <p className="font-display text-3xl font-black">{bmi ?? '--'}</p>
                        {bmiInfo ? <p className="mt-1 text-[9px] font-black uppercase tracking-tighter opacity-80">{bmiInfo.label}</p> : null}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <p className="gc-section-kicker mb-4">Communication</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <a
                      href={`tel:${student.phone}`}
                      className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-[transform,opacity,box-shadow,background-color,border-color,color] hover:border-white/10 hover:bg-white/[0.06]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                        <Phone className="h-5 w-5 text-gym-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Phone</p>
                        <p className="truncate text-sm font-semibold text-slate-200">{student.phone || 'Not provided'}</p>
                      </div>
                    </a>
                    <a
                      href={`mailto:${student.email}`}
                      className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-[transform,opacity,box-shadow,background-color,border-color,color] hover:border-white/10 hover:bg-white/[0.06]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                        <Mail className="h-5 w-5 text-sky-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Email</p>
                        <p className="truncate text-sm font-semibold text-slate-200">{student.email}</p>
                      </div>
                    </a>
                  </div>
                </div>

                <div className="rounded-2xl border border-gym-500/20 bg-gradient-to-r from-gym-500/10 to-transparent p-6">
                  <div className="flex items-center gap-5">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gym-500/10 shadow-glow ring-1 ring-gym-500/30">
                      <Activity className="h-8 w-8 text-gym-500" />
                    </div>
                    <div>
                      <p className="font-display text-4xl font-black leading-none text-white">{student.sessionCount}</p>
                      <p className="mt-1 text-sm font-bold uppercase tracking-widest text-gym-500">Total Partnerships</p>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {activeTab === 'history' ? (
              <section id="coach-customer-panel-history" role="tabpanel" aria-labelledby="coach-customer-tab-history" className="space-y-6">
                <div>
                  <p className="gc-section-kicker mb-4">Training Agenda</p>
                  {historyLoading ? (
                    <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}</div>
                  ) : sessionHistory.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
                      <Calendar className="mx-auto mb-3 h-10 w-10 text-slate-400 opacity-40" />
                      <p className="text-sm text-slate-500">No training sessions recorded yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessionHistory.map((session) => (
                        <div
                          key={session.ptSessionId}
                          className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-[transform,opacity,box-shadow,background-color,border-color,color] hover:bg-white/[0.06]"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                            <Clock className="h-5 w-5 text-slate-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-display text-sm font-bold text-white">
                              {formatDateTime(session.sessionDate, undefined, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                            <p className="text-xs font-semibold text-slate-500">
                              Slot {session.slotIndex} &bull; {session.startTime?.substring(0, 5)} - {session.endTime?.substring(0, 5)}
                            </p>
                          </div>
                          <StatusBadge status={session.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {healthHistory.length > 0 ? (
                  <div>
                    <p className="gc-section-kicker mb-4">Body Composition Log</p>
                    <div className="space-y-3">
                      {healthHistory.map((record, index) => (
                        <div key={index} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                            <Scale className="h-4 w-4 text-slate-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-bold text-slate-200">{record.weightKg} kg &bull; {record.heightCm} cm</span>
                            <span className="ml-3 rounded-full border border-white/5 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              BMI {record.bmi?.toFixed ? record.bmi.toFixed(1) : record.bmi}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-slate-400">{record.recordedAt ? formatDate(record.recordedAt) : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeTab === 'progress' ? (
              <section id="coach-customer-panel-progress" role="tabpanel" aria-labelledby="coach-customer-tab-progress" className="space-y-8">
                <div>
                  <p className="gc-section-kicker mb-2">Metrics Update</p>
                  <p className="mb-6 text-xs font-medium text-slate-500">Record the latest height and weight to track customer progress and BMI trends.</p>

                  {progressMsg ? (
                    <div aria-live="polite" className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" />
                      {progressMsg}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="coach-customer-height" className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Height (cm)
                      </label>
                      <input
                        id="coach-customer-height"
                        name="height_cm"
                        type="number"
                        inputMode="decimal"
                        autoComplete="off"
                        min="100"
                        max="250"
                        step="0.1"
                        placeholder="175.5"
                        value={progressForm.heightCm}
                        onChange={(event) => setProgressForm((form) => ({ ...form, heightCm: event.target.value }))}
                        className="gc-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="coach-customer-weight" className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Weight (kg)
                      </label>
                      <input
                        id="coach-customer-weight"
                        name="weight_kg"
                        type="number"
                        inputMode="decimal"
                        autoComplete="off"
                        min="30"
                        max="300"
                        step="0.1"
                        placeholder="72.0"
                        value={progressForm.weightKg}
                        onChange={(event) => setProgressForm((form) => ({ ...form, weightKg: event.target.value }))}
                        className="gc-input"
                      />
                    </div>
                  </div>

                  {progressForm.heightCm && progressForm.weightKg && parseFloat(progressForm.heightCm) > 0 && parseFloat(progressForm.weightKg) > 0 ? (
                    <div className="mt-8 flex items-center justify-between rounded-2xl border border-gym-500/20 bg-gym-500/10 p-5 ring-1 ring-gym-500/10">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gym-500/10">
                          <TrendingUp className="h-6 w-6 text-gym-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gym-500">Calculated BMI</p>
                          <p className="font-display text-2xl font-black text-white">
                            {(parseFloat(progressForm.weightKg) / Math.pow(parseFloat(progressForm.heightCm) / 100, 2)).toFixed(1)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-gym-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-tighter text-slate-950 shadow-glow">
                          Auto-updated
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <button type="button" onClick={handleUpdateProgress} disabled={progressLoading} className="gc-button-primary mt-8 w-full">
                    {progressLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                        Saving Metrics…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Check className="h-5 w-5" />
                        Save New Metrics
                      </span>
                    )}
                  </button>
                </div>
              </section>
            ) : null}

            {activeTab === 'notes' ? (
              <section id="coach-customer-panel-notes" role="tabpanel" aria-labelledby="coach-customer-tab-notes" className="space-y-8">
                {noteMsg ? (
                  <div aria-live="polite" className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    {noteMsg}
                  </div>
                ) : null}

                <div className="gc-card-compact border-white/10 bg-white/[0.02]">
                  <p className="gc-section-kicker mb-4">Chronicle New Note</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="coach-customer-session" className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Target Session
                      </label>
                      <select
                        id="coach-customer-session"
                        name="session_id"
                        value={noteForm.sessionId}
                        onChange={(event) => setNoteForm((form) => ({ ...form, sessionId: event.target.value }))}
                        className="gc-input"
                      >
                        <option value="" className="bg-[rgba(18,18,26,0.92)]">-- Choose associated session --</option>
                        {historyLoading ? (
                          <option disabled>Loading history…</option>
                        ) : (
                          sessionHistory.map((session) => (
                            <option key={session.ptSessionId} value={session.ptSessionId} className="bg-[rgba(18,18,26,0.92)]">
                              {formatDate(session.sessionDate)} | Slot {session.slotIndex} | {session.status}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="coach-customer-note" className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        Note Content
                      </label>
                      <textarea
                        id="coach-customer-note"
                        name="session_note"
                        autoComplete="off"
                        rows={4}
                        placeholder="Summarize performance, diet suggestions, or recovery plans…"
                        value={noteForm.content}
                        onChange={(event) => setNoteForm((form) => ({ ...form, content: event.target.value }))}
                        className="gc-textarea"
                      />
                    </div>

                    <button type="button" onClick={handleAddNote} disabled={noteLoading} className="gc-button-primary w-full">
                      {noteLoading ? (
                        'Processing…'
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Plus className="h-5 w-5" />
                          Add Note Entry
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="gc-section-kicker mb-4">Historical Archives</p>
                  {historyLoading ? (
                    <div className="space-y-3">{[1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-white/5" />)}</div>
                  ) : notes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
                      <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-400 opacity-30" />
                      <p className="text-sm text-slate-500">No notes found for this trainee.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {notes.map((note) => (
                        <div key={note.noteId} className="group rounded-2xl border border-white/5 bg-white/[0.03] p-5 transition-[transform,opacity,box-shadow,background-color,border-color,color] hover:border-white/10 hover:bg-white/[0.05]">
                          {editingNote?.noteId === note.noteId ? (
                            <div className="space-y-4">
                              <textarea
                                name={`session_note_edit_${note.noteId}`}
                                autoComplete="off"
                                rows={4}
                                className="gc-textarea"
                                value={editingNote.content}
                                onChange={(event) => setEditingNote((entry) => ({ ...entry, content: event.target.value }))}
                              />
                              <div className="flex gap-3">
                                <button type="button" onClick={handleUpdateNote} disabled={noteLoading} className="gc-button-primary flex-1 text-sm">
                                  {noteLoading ? 'Saving…' : 'Update Entry'}
                                </button>
                                <button type="button" onClick={() => setEditingNote(null)} className="gc-button-secondary flex-1 text-sm">
                                  Discard
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-medium leading-relaxed text-slate-300">&ldquo;{note.noteContent}&rdquo;</p>
                                <div className="mt-4 flex items-center gap-3">
                                  <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    Session #{note.ptSessionId}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">{note.updatedAt ? formatDate(note.updatedAt) : formatDate(note.createdAt)}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                aria-label={`Edit note ${note.noteId}`}
                                onClick={() => setEditingNote({ noteId: note.noteId, content: note.noteContent })}
                                className="shrink-0 rounded-xl p-2.5 text-slate-500 transition-[transform,opacity,box-shadow,background-color,border-color,color] hover:bg-white/5 hover:text-gym-500"
                                title="Edit note"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ) : null}
          </div>
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
  const [search, setSearch] = useState('')

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
      const [feedbackRes, averageRes] = await Promise.all([
        coachBookingApi.getCoachFeedback(),
        coachBookingApi.getCoachFeedbackAverage(),
      ])
      const feedbackRaw = feedbackRes?.data ?? feedbackRes
      const averageRaw = averageRes?.data ?? averageRes
      setFeedback(Array.isArray(feedbackRaw?.items) ? feedbackRaw.items : [])
      setFeedbackAvg(averageRaw)
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

  const filteredStudents = students.filter((student) =>
    student.fullName.toLowerCase().includes(search.toLowerCase()) ||
    student.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <WorkspaceScaffold
      title="Training Ecosystem"
      subtitle="Comprehensive intelligence on your trainee base, satisfaction metrics, and performance history."
      links={coachNav}
      headerMeta={
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold text-zinc-300">
            {students.length} trainees
          </span>
          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
            {feedbackAvg?.averageRating?.toFixed ? feedbackAvg.averageRating.toFixed(1) : '0.0'} coach rating
          </span>
        </div>
      }
    >
      <div className="max-w-7xl space-y-8 pb-20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Coach customer views" className="flex rounded-2xl bg-white/5 p-1.5 ring-1 ring-white/10 backdrop-blur-md">
            <button
              type="button"
              role="tab"
              id="coach-customer-view-students"
              aria-selected={activeTab === 'students'}
              aria-controls="coach-customer-view-panel-students"
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-3 rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-[transform,opacity,box-shadow,background-color,border-color,color] ${
                activeTab === 'students' ? 'bg-gym-500 text-slate-950 shadow-glow' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <Users className="h-4 w-4" />
              Trainees
            </button>
            <button
              type="button"
              role="tab"
              id="coach-customer-view-feedback"
              aria-selected={activeTab === 'feedback'}
              aria-controls="coach-customer-view-panel-feedback"
              onClick={() => setActiveTab('feedback')}
              className={`flex items-center gap-3 rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-[transform,opacity,box-shadow,background-color,border-color,color] ${
                activeTab === 'feedback' ? 'bg-gym-500 text-slate-950 shadow-glow' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <Star className="h-4 w-4" />
              Feedback
              {feedbackAvg?.averageRating ? (
                <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[9px] font-black text-amber-500 ring-1 ring-amber-500/20">
                  {feedbackAvg.averageRating.toFixed(1)}
                </span>
              ) : null}
            </button>
          </div>

          {activeTab === 'students' ? (
            <div className="group relative w-full max-w-sm">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-gym-500" />
              <input
                type="text"
                name="coach-customer-search"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search dossiers…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="gc-input !h-12 !rounded-2xl !pl-11 border-white/5 bg-white/[0.03] transition-[transform,opacity,box-shadow,background-color,border-color,color] focus:bg-white/[0.06] focus:ring-gym-500/20"
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <div aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400 shadow-2xl">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        {activeTab === 'students' ? (
          <section id="coach-customer-view-panel-students" role="tabpanel" aria-labelledby="coach-customer-view-students" className="space-y-6">
            {loading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-48 animate-pulse rounded-[2rem] border border-white/5 bg-white/[0.02]" />)}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="gc-glass-panel flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-6 rounded-3xl border border-white/5 bg-white/5 p-8">
                  <User className="h-12 w-12 text-slate-200" />
                </div>
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-white">Vault Empty</h3>
                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  {search ? `No trainees matching "${search}" were found in your record.` : 'Practitioners will appear here once your training partnerships are established.'}
                </p>
                {search ? (
                  <button type="button" onClick={() => setSearch('')} className="gc-button-ghost mt-4 text-xs font-black uppercase tracking-widest text-gym-500 hover:underline">
                    Reset Search
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredStudents.map((student) => (
                  <button
                    key={student.customerId}
                    type="button"
                    onClick={() => handleSelectStudent(student)}
                    className="gc-card group flex cursor-pointer flex-col overflow-hidden border-white/5 bg-white/[0.02] p-0 text-left transition-[transform,opacity,box-shadow,background-color,border-color,color] duration-500 hover:scale-[1.02] hover:border-white/10 hover:bg-white/[0.04]"
                  >
                    <div className="flex-1 p-7">
                      <div className="mb-6 flex items-start justify-between">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 transition-[transform,opacity,box-shadow,background-color,border-color,color] group-hover:bg-gym-500 group-hover:ring-gym-500">
                          <User className="h-7 w-7 text-slate-400 group-hover:text-slate-50" />
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400 transition-[transform,opacity,box-shadow,background-color,border-color,color] group-hover:translate-x-1 group-hover:text-white" />
                      </div>

                      <h4 className="truncate font-display text-lg font-black uppercase tracking-tight text-white transition-colors group-hover:text-gym-500">
                        {student.fullName}
                      </h4>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{student.email}</p>

                      <div className="mt-8 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 transition-[transform,opacity,box-shadow,background-color,border-color,color] group-hover:bg-white/[0.08]">
                          <Activity className="h-3.5 w-3.5 text-gym-500" />
                          <span className="text-[10px] font-bold uppercase tracking-tight text-slate-200">{student.sessionCount} Sessions</span>
                        </div>
                        {student.phone ? (
                          <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 transition-[transform,opacity,box-shadow,background-color,border-color,color] group-hover:bg-white/[0.08]">
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            <span className="text-[10px] font-bold uppercase tracking-tight text-slate-400">Contact Set</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-auto border-t border-white/5 bg-white/[0.01] px-7 py-4">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 transition-colors group-hover:text-slate-300">
                        Trainee Profile Dossier
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === 'feedback' ? (
          <section id="coach-customer-view-panel-feedback" role="tabpanel" aria-labelledby="coach-customer-view-feedback" className="animate-in slide-in-from-bottom-4 space-y-8 fade-in duration-500">
            {feedbackAvg ? (
              <div className="gc-glass-panel relative overflow-hidden border-white/10 p-8">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/5 blur-[100px]" />
                <div className="relative flex flex-col gap-8 md:flex-row md:items-center">
                  <div className="text-center md:text-left">
                    <p className="mb-4 font-display text-7xl font-black leading-none text-white">
                      {feedbackAvg.averageRating?.toFixed ? feedbackAvg.averageRating.toFixed(1) : (feedbackAvg.averageRating ?? '0.0')}
                    </p>
                    <div className="mb-2 flex origin-left justify-center md:justify-start md:scale-110">
                      <StarDisplay rating={Math.round(feedbackAvg.averageRating ?? 0)} />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-amber-500">{feedbackAvg.totalReviews} Verified Appraisals</p>
                  </div>
                  <div className="hidden h-20 w-px bg-white/10 md:block" />
                  <div className="flex-1">
                    <h3 className="font-display text-2xl font-bold tracking-tight text-white">Satisfaction Quotient</h3>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
                      Your standing is calculated from all customer feedback following completed sessions. High ratings increase your visibility and partnership potential in the GymCore ecosystem.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {feedbackLoading ? (
              <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-[2rem] border border-white/5 bg-white/[0.02]" />)}</div>
            ) : feedback.length === 0 ? (
              <div className="gc-glass-panel flex flex-col items-center justify-center border-white/5 py-20 text-center">
                <Star className="mx-auto mb-6 h-12 w-12 text-slate-200 opacity-20" />
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-white">No Testimonials</h3>
                <p className="mt-2 max-w-sm text-sm text-slate-500">Customers can submit anonymous or identified feedback once a training session is marked as completed.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {feedback.map((entry) => (
                  <div
                    key={entry.coachFeedbackId}
                    className="gc-card-compact group border-white/5 bg-white/[0.02] transition-[transform,opacity,box-shadow,background-color,border-color,color] hover:border-white/10 hover:bg-white/[0.04]"
                  >
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 transition-[transform,opacity,box-shadow,background-color,border-color,color] group-hover:bg-white/10 group-hover:ring-white/20">
                        <User className="h-6 w-6 text-slate-500 group-hover:text-slate-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <h4 className="font-display text-lg font-bold uppercase tracking-tight text-white">{entry.customerName}</h4>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Client Authenticated</p>
                          </div>
                          <div className="flex flex-col items-end">
                            <StarDisplay rating={entry.rating} />
                            <span className="mt-1 text-[10px] font-bold text-slate-500">{entry.createdAt ? formatDate(entry.createdAt) : ''}</span>
                          </div>
                        </div>
                        {entry.comment ? (
                          <div className="relative mt-4">
                            <Quote className="absolute -left-2 -top-2 h-8 w-8 text-white/[0.03]" />
                            <p className="relative break-words text-sm italic leading-relaxed text-slate-300">&ldquo;{entry.comment}&rdquo;</p>
                          </div>
                        ) : null}
                        <div className="mt-6 flex items-center gap-3">
                          <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-500 ring-1 ring-emerald-500/20">
                            Session #{entry.ptSessionId}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>

      {selectedStudent && studentDetail ? (
        <StudentDetailModal
          student={studentDetail}
          onClose={() => {
            setSelectedStudent(null)
            setStudentDetail(null)
          }}
        />
      ) : null}
    </WorkspaceScaffold>
  )
}

export default CoachCustomersPage
