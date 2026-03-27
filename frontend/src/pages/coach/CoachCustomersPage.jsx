import { useState, useEffect, useCallback } from 'react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { coachNav } from '../../config/navigation'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'
import { User, Star, Activity, ClipboardList, TrendingUp, Phone, Mail, ChevronRight, X, Plus, Edit2, Check, Scale, Calendar, Clock, CheckCircle2, Users, Search, Quote } from 'lucide-react'

function getInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'CU'
}

function CustomerAvatar({ avatarUrl, name, className = 'h-14 w-14 rounded-2xl', iconClassName = 'h-7 w-7 text-slate-400' }) {
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden bg-white/5 ring-1 ring-white/10 ${className}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || 'Customer avatar'}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-sm font-black uppercase tracking-[0.18em] text-slate-200">
          {getInitials(name)}
        </span>
      )}
    </div>
  )
}

function StarDisplay({ rating }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={`text-base ${s <= rating ? 'text-amber-400' : 'text-white/10'}`}>★</span>
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
  const completedSessions = (history?.sessions ?? []).filter((session) => session.status === 'COMPLETED')

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col bg-transparent overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="gc-glass-panel flex flex-col h-full overflow-hidden border-white/10 shadow-2xl">
          <div className="flex items-center gap-4 border-b border-white/5 p-6 bg-white/[0.02]">
            <CustomerAvatar avatarUrl={studentInfo.avatarUrl} name={studentInfo.fullName} />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xl font-bold text-white font-display">{student.fullName}</h3>
              <p className="text-sm font-medium text-slate-500">{student.sessionCount} sessions &bull; {student.email}</p>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 transition-colors hover:bg-white/5 text-slate-500 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-white/5 p-3 bg-white/[0.01]">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${activeTab === t.id ? 'bg-gym-500 text-slate-950 shadow-glow' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}
              >
                {t.icon}
                <span className="tracking-wide uppercase">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {error && <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400">{error}</div>}

            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div>
                  <p className="gc-section-kicker mb-4">Health Profile</p>
                  {Object.keys(h).length === 0 ? (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center">
                      <Scale className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                      <p className="text-sm text-slate-500">No health metrics have been recorded for this customer yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-center transition hover:bg-white/[0.05]">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Height</p>
                        <p className="text-3xl font-black text-white font-display">{h.heightCm}<span className="text-sm font-medium text-slate-500 ml-1">cm</span></p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 text-center transition hover:bg-white/[0.05]">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Weight</p>
                        <p className="text-3xl font-black text-white font-display">{h.weightKg}<span className="text-sm font-medium text-slate-500 ml-1">kg</span></p>
                      </div>
                      <div className={`rounded-2xl border p-5 text-center transition ${bmiInfo?.cls || 'border-white/5 bg-white/[0.03]'}`}>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest opacity-60">BMI</p>
                        <p className="text-3xl font-black font-display">{bmi ?? '--'}</p>
                        {bmiInfo && <p className="mt-1 text-[9px] font-black uppercase tracking-tighter opacity-80">{bmiInfo.label}</p>}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <p className="gc-section-kicker mb-4">Communication</p>
                  <div className="grid grid-cols-2 gap-3">
                    <a href={`tel:${student.phone}`} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-all hover:bg-white/[0.06] hover:border-white/10 group">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 group-hover:bg-gym-500/10 group-hover:ring-gym-500/20">
                        <Phone className="h-5 w-5 text-slate-400 group-hover:text-gym-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone</p>
                        <p className="truncate text-sm font-semibold text-slate-200">{student.phone || 'Not provided'}</p>
                      </div>
                    </a>
                    <a href={`mailto:${student.email}`} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition-all hover:bg-white/[0.06] hover:border-white/10 group">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 group-hover:bg-sky-500/10 group-hover:ring-sky-500/20">
                        <Mail className="h-5 w-5 text-slate-400 group-hover:text-sky-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email</p>
                        <p className="truncate text-sm font-semibold text-slate-200">{student.email}</p>
                      </div>
                    </a>
                  </div>
                </div>

                <div className="rounded-2xl bg-gradient-to-r from-gym-500/10 to-transparent border border-gym-500/20 p-6">
                  <div className="flex items-center gap-5">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gym-500/10 shadow-glow ring-1 ring-gym-500/30">
                      <Activity className="h-8 w-8 text-gym-500" />
                    </div>
                    <div>
                      <p className="text-4xl font-black text-white font-display leading-none">{student.sessionCount}</p>
                      <p className="mt-1 text-sm font-bold text-gym-500 uppercase tracking-widest">Total Partnerships</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-6">
                <div>
                  <p className="gc-section-kicker mb-4">Training Agenda</p>
                  {historyLoading ? (
                    <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}</div>
                  ) : (history?.sessions ?? []).length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-white/10">
                      <Calendar className="mx-auto mb-3 h-10 w-10 text-slate-600 opacity-40" />
                      <p className="text-sm text-slate-500">No training sessions recorded yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(history?.sessions ?? []).map(s => (
                        <div key={s.ptSessionId} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                            <Clock className="h-5 w-5 text-slate-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white font-display">
                              {new Date(s.sessionDate).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                            </p>
                            <p className="text-xs font-semibold text-slate-500">
                              Slot {s.slotIndex} &bull; {s.startTime?.substring(0, 5)} — {s.endTime?.substring(0, 5)}
                            </p>
                          </div>
                          <StatusBadge status={s.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {(history?.healthHistory ?? []).length > 0 && (
                  <div>
                    <p className="gc-section-kicker mb-4">Body Composition Log</p>
                    <div className="space-y-3">
                      {history.healthHistory.map((rec, i) => (
                        <div key={i} className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5">
                            <Scale className="h-4 w-4 text-slate-500" />
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-bold text-slate-200">{rec.weightKg} kg &bull; {rec.heightCm} cm</span>
                            <span className="ml-3 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-white/5">BMI {rec.bmi?.toFixed ? rec.bmi.toFixed(1) : rec.bmi}</span>
                          </div>
                          <span className="text-xs font-medium text-slate-600">{rec.recordedAt ? new Date(rec.recordedAt).toLocaleDateString() : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'progress' && (
              <div className="space-y-8">
                <div>
                  <p className="gc-section-kicker mb-2">Metrics Update</p>
                  <p className="text-xs text-slate-500 mb-6 font-medium">Record the latest height and weight to track customer progress and BMI trends.</p>
                  
                  {progressMsg && (
                    <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400 flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5" />
                      {progressMsg}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Height (cm)</label>
                      <input
                        type="number"
                        min="100" max="250" step="0.1"
                        placeholder="175.5"
                        value={progressForm.heightCm}
                        onChange={e => setProgressForm(f => ({ ...f, heightCm: e.target.value }))}
                        className="gc-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Weight (kg)</label>
                      <input
                        type="number"
                        min="30" max="300" step="0.1"
                        placeholder="72.0"
                        value={progressForm.weightKg}
                        onChange={e => setProgressForm(f => ({ ...f, weightKg: e.target.value }))}
                        className="gc-input"
                      />
                    </div>
                  </div>

                  {progressForm.heightCm && progressForm.weightKg && parseFloat(progressForm.heightCm) > 0 && parseFloat(progressForm.weightKg) > 0 && (
                    <div className="mt-8 flex items-center justify-between rounded-2xl bg-gym-500/10 border border-gym-500/20 p-5 ring-1 ring-gym-500/10">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gym-500/10">
                          <TrendingUp className="h-6 w-6 text-gym-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gym-500 uppercase tracking-widest">Calculated BMI</p>
                          <p className="text-2xl font-black text-white font-display">
                            {(parseFloat(progressForm.weightKg) / Math.pow(parseFloat(progressForm.heightCm) / 100, 2)).toFixed(1)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black uppercase tracking-tighter bg-gym-500 text-slate-950 px-2.5 py-1 rounded-full shadow-glow">Auto-updated</span>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={handleUpdateProgress}
                    disabled={progressLoading}
                    className="gc-button-primary w-full mt-8"
                  >
                    {progressLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                        Saving Metrics...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Check className="h-5 w-5" />
                        Save New Metrics
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-8">
                {noteMsg && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400 flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5" />
                    {noteMsg}
                  </div>
                )}

                <div className="gc-card-compact border-white/10 bg-white/[0.02]">
                  <p className="gc-section-kicker mb-4">New note</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Target Session</label>
                      <select
                        value={noteForm.sessionId}
                        onChange={e => setNoteForm(f => ({ ...f, sessionId: e.target.value }))}
                        className="gc-input"
                      >
                        <option value="" className="bg-slate-900">-- Choose associated session --</option>
                        {historyLoading ? <option disabled>Loading history...</option> : completedSessions.map(s => (
                          <option key={s.ptSessionId} value={s.ptSessionId} className="bg-slate-900">
                            {new Date(s.sessionDate).toLocaleDateString()} | Slot {s.slotIndex} | {s.status}
                          </option>
                        ))}
                      </select>
                      {!historyLoading && completedSessions.length === 0 && (
                        <p className="text-xs font-medium text-slate-500">
                          Only sessions marked as completed in your timetable can be selected for notes.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Note Content</label>
                      <textarea
                        rows={4}
                        placeholder="Summarize performance, diet suggestions, or recovery plans..."
                        value={noteForm.content}
                        onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
                        className="gc-input resize-none py-3"
                      />
                    </div>
                    <button
                      onClick={handleAddNote}
                      disabled={noteLoading}
                      className="gc-button-primary w-full !bg-white !text-slate-950 hover:!bg-slate-200 shadow-none ring-1 ring-white/20"
                    >
                      {noteLoading ? 'Processing...' : (
                        <span className="flex items-center gap-2 justify-center">
                          <Plus className="h-5 w-5" /> Add Note Entry
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="gc-section-kicker mb-4">Historical Archives</p>
                  {historyLoading ? (
                    <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />)}</div>
                  ) : (history?.notes ?? []).length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-white/10">
                      <ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-600 opacity-30" />
                      <p className="text-sm text-slate-500">No notes found for this trainee.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {history.notes.map(n => (
                        <div key={n.noteId} className="group rounded-2xl border border-white/5 bg-white/[0.03] p-5 transition hover:border-white/10 hover:bg-white/[0.05]">
                          {editingNote?.noteId === n.noteId ? (
                            <div className="space-y-4">
                              <textarea
                                rows={4}
                                className="gc-input resize-none py-3"
                                value={editingNote.content}
                                onChange={e => setEditingNote(en => ({ ...en, content: e.target.value }))}
                              />
                              <div className="flex gap-3">
                                <button onClick={handleUpdateNote} disabled={noteLoading} className="gc-button-primary flex-1 text-sm">
                                  {noteLoading ? 'Saving...' : 'Update Entry'}
                                </button>
                                <button onClick={() => setEditingNote(null)} className="gc-button-secondary flex-1 text-sm">
                                  Discard
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm leading-relaxed text-slate-300 font-medium">"{n.noteContent}"</p>
                                  <div className="mt-4 flex items-center gap-3">
                                    <span className="rounded-lg bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500 border border-white/10">Session #{n.ptSessionId}</span>
                                    <span className="text-[10px] font-bold text-slate-600">
                                      {n.updatedAt ? new Date(n.updatedAt).toLocaleDateString() : new Date(n.createdAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => setEditingNote({ noteId: n.noteId, content: n.noteContent })}
                                  className="shrink-0 rounded-xl p-2.5 text-slate-500 transition-all hover:bg-white/5 hover:text-gym-500"
                                  title="Edit note"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                              </div>
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

  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(search.toLowerCase()) || 
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <WorkspaceScaffold
      showHeader={false}
    >
      <div className="max-w-7xl space-y-8 pb-20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex rounded-2xl bg-white/5 p-1.5 ring-1 ring-white/10 backdrop-blur-md">
            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-3 rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'students' ? 'bg-gym-500 text-slate-950 shadow-glow' : 'text-slate-500 hover:text-slate-200'}`}
            >
              <Users className="h-4 w-4" /> Trainees
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`flex items-center gap-3 rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'feedback' ? 'bg-gym-500 text-slate-950 shadow-glow' : 'text-slate-500 hover:text-slate-200'}`}
            >
              <Star className="h-4 w-4" /> Feedback
              {feedbackAvg?.averageRating && (
                <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[9px] font-black text-amber-500 ring-1 ring-amber-500/20">
                  {feedbackAvg.averageRating.toFixed(1)}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'students' && (
            <div className="relative w-full max-w-sm group">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-gym-500" />
              <input
                type="text"
                placeholder="Search dossiers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="gc-input !pl-11 !h-12 !rounded-2xl border-white/5 bg-white/[0.03] transition-all focus:bg-white/[0.06] focus:ring-gym-500/20"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-400 flex items-center gap-3 shadow-2xl">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        {activeTab === 'students' && (
          <div className="space-y-6">
            {loading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 animate-pulse rounded-[2rem] bg-white/[0.02] border border-white/5" />)}
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="gc-glass-panel flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-6 rounded-3xl bg-white/5 p-8 border border-white/5">
                  <User className="h-12 w-12 text-slate-700" />
                </div>
                <h3 className="text-xl font-bold text-white font-display uppercase tracking-tight">Vault Empty</h3>
                <p className="mt-2 max-w-sm text-sm text-slate-500">
                  {search ? `No trainees matching "${search}" were found in your record.` : "Practitioners will appear here once your training partnerships are established."}
                </p>
                {search && <button onClick={() => setSearch('')} className="mt-4 text-xs font-black text-gym-500 uppercase tracking-widest hover:underline">Reset Search</button>}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredStudents.map(student => (
                  <div
                    key={student.customerId}
                    onClick={() => handleSelectStudent(student)}
                    className="gc-card group cursor-pointer border-white/5 bg-white/[0.02] transition-all duration-500 hover:scale-[1.02] hover:border-white/10 hover:bg-white/[0.04] p-0 overflow-hidden flex flex-col"
                  >
                    <div className="p-7 flex-1">
                      <div className="mb-6 flex items-start justify-between">
                        <CustomerAvatar
                          avatarUrl={student.avatarUrl}
                          name={student.fullName}
                          className="h-14 w-14 rounded-2xl transition group-hover:bg-gym-500 group-hover:ring-gym-500"
                        />
                        <ChevronRight className="h-5 w-5 text-slate-600 transition-all group-hover:text-white group-hover:translate-x-1" />
                      </div>
                      
                      <h4 className="truncate text-lg font-black text-white font-display group-hover:text-gym-500 transition-colors uppercase tracking-tight">{student.fullName}</h4>
                      <p className="truncate text-xs font-medium text-slate-500 mt-0.5">{student.email}</p>
                      
                      <div className="mt-8 flex items-center gap-3">
                        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/5 transition group-hover:bg-white/[0.08]">
                          <Activity className="h-3.5 w-3.5 text-gym-500" />
                          <span className="text-[10px] font-bold text-slate-200 uppercase tracking-tight">{student.sessionCount} Sessions</span>
                        </div>
                        {student.phone && (
                          <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 border border-white/5 transition group-hover:bg-white/[0.08]">
                            <Phone className="h-3.5 w-3.5 text-slate-500" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Contact Set</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-auto border-t border-white/5 bg-white/[0.01] px-7 py-4">
                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-400 transition-colors">Trainee Profile Dossier</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {feedbackAvg && (
              <div className="gc-glass-panel relative overflow-hidden p-8 border-white/10">
                <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/5 blur-[100px]" />
                <div className="relative flex flex-col gap-8 md:flex-row md:items-center">
                  <div className="text-center md:text-left">
                    <p className="text-7xl font-black text-white leading-none font-display mb-4">
                      {feedbackAvg.averageRating?.toFixed ? feedbackAvg.averageRating.toFixed(1) : (feedbackAvg.averageRating ?? '0.0')}
                    </p>
                    <div className="flex justify-center md:justify-start mb-2 scale-110 origin-left">
                      <StarDisplay rating={Math.round(feedbackAvg.averageRating ?? 0)} />
                    </div>
                    <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest">{feedbackAvg.totalReviews} Verified Appraisals</p>
                  </div>
                  <div className="hidden h-20 w-px bg-white/10 md:block" />
                  <div className="flex-1">
                    <h3 className="font-display text-2xl font-bold text-white tracking-tight">Satisfaction Quotient</h3>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500">
                      Your standing is calculated from all customer feedback following completed sessions. High ratings 
                      increase your visibility and partnership potential in the GymCore ecosystem.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {feedbackLoading ? (
              <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse rounded-[2rem] bg-white/[0.02] border border-white/5" />)}</div>
            ) : feedback.length === 0 ? (
              <div className="gc-glass-panel flex flex-col items-center justify-center py-20 text-center border-white/5">
                <Star className="mx-auto mb-6 h-12 w-12 text-slate-700 opacity-20" />
                <h3 className="text-xl font-bold text-white font-display uppercase tracking-tight">No Testimonials</h3>
                <p className="mt-2 max-w-sm text-sm text-slate-500">Customers can submit anonymous or identified feedback once a training session is marked as completed.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {feedback.map(fb => (
                  <div key={fb.coachFeedbackId} className="gc-card-compact border-white/5 bg-white/[0.02] transition-all hover:bg-white/[0.04] hover:border-white/10 group">
                    <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 transition group-hover:bg-white/10 group-hover:ring-white/20">
                        <User className="h-6 w-6 text-slate-500 group-hover:text-slate-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                          <div>
                            <h4 className="font-bold text-white font-display text-lg tracking-tight uppercase">{fb.customerName}</h4>
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Client Authenticated</p>
                          </div>
                          <div className="flex flex-col items-end">
                            <StarDisplay rating={fb.rating} />
                            <span className="mt-1 text-[10px] font-bold text-slate-500">{fb.createdAt ? new Date(fb.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                          </div>
                        </div>
                        {fb.comment && (
                          <div className="relative mt-4">
                            <Quote className="absolute -left-2 -top-2 h-8 w-8 text-white/[0.03]" />
                            <p className="relative text-sm italic leading-relaxed text-slate-300">"{fb.comment}"</p>
                          </div>
                        )}
                        <div className="mt-6 flex items-center gap-3">
                          <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-500 ring-1 ring-emerald-500/20">Session #{fb.ptSessionId}</span>
                        </div>
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
