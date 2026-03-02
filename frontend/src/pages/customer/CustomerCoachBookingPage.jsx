import { useEffect, useMemo, useState } from 'react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { coachApi } from '../../features/coach/api/coachApi'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'

const DAYS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 7, label: 'Sun' },
]

function formatDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateValue(value) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function addDays(value, amount) {
  const parsed = parseDateValue(value)
  if (!parsed) return value
  parsed.setDate(parsed.getDate() + amount)
  return formatDateValue(parsed)
}

function toDayOfWeek(value) {
  const parsed = parseDateValue(value)
  if (!parsed) return null
  const day = parsed.getDay()
  return day === 0 ? 7 : day
}

function buildCalendarWeeks(monthCursor) {
  const monthStart = parseDateValue(monthCursor)
  if (!monthStart) return []
  monthStart.setDate(1)
  const weekdayIndex = (monthStart.getDay() + 6) % 7
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - weekdayIndex)

  const weeks = []
  for (let week = 0; week < 6; week += 1) {
    const row = []
    for (let day = 0; day < 7; day += 1) {
      const current = new Date(gridStart)
      current.setDate(gridStart.getDate() + (week * 7 + day))
      row.push({
        date: formatDateValue(current),
        isCurrentMonth: current.getMonth() === monthStart.getMonth(),
      })
    }
    weeks.push(row)
  }
  return weeks
}

function shiftMonth(monthCursor, delta) {
  const base = parseDateValue(monthCursor)
  if (!base) return monthCursor
  base.setDate(1)
  base.setMonth(base.getMonth() + delta)
  return formatDateValue(base)
}

function toMonthTitle(monthCursor) {
  const base = parseDateValue(monthCursor)
  if (!base) return ''
  return base.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function CustomerCoachBookingPage() {
  const [activeTab, setActiveTab] = useState('match')
  const [timeSlots, setTimeSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
  })
  const [requestedDateSlots, setRequestedDateSlots] = useState([])
  const [plannerModal, setPlannerModal] = useState({
    open: false,
    focusDate: '',
    monthCursor: '',
  })
  const [coachReviewModal, setCoachReviewModal] = useState({
    open: false,
    coach: null,
  })

  const [matches, setMatches] = useState({
    fullMatches: [],
    partialMatches: [],
  })

  const [scheduleData, setScheduleData] = useState({
    items: [],
    pendingRequests: [],
    deniedRequests: [],
  })

  const [rescheduleModal, setRescheduleModal] = useState({
    open: false,
    session: null,
    sessionDate: '',
    timeSlotId: '',
    reason: '',
  })

  const [feedbackModal, setFeedbackModal] = useState({
    open: false,
    session: null,
    rating: 0,
    comment: '',
  })

  useEffect(() => {
    void loadTimeSlots()
  }, [])

  useEffect(() => {
    if (activeTab === 'schedule' || activeTab === 'feedback') {
      void loadMySchedule()
    }
  }, [activeTab])

  async function loadTimeSlots() {
    try {
      const response = await coachApi.getTimeSlots()
      const payload = response?.data ?? response
      setTimeSlots(Array.isArray(payload?.items) ? payload.items : [])
    } catch {
      setError('Cannot load time slots')
    }
  }

  async function loadMySchedule() {
    try {
      setLoading(true)
      const response = await coachBookingApi.getMySchedule()
      const payload = response?.data ?? response
      setScheduleData({
        items: Array.isArray(payload?.items) ? payload.items : [],
        pendingRequests: Array.isArray(payload?.pendingRequests) ? payload.pendingRequests : [],
        deniedRequests: Array.isArray(payload?.deniedRequests) ? payload.deniedRequests : [],
      })
    } catch (err) {
      setError(err?.response?.data?.message || 'Cannot load your PT schedule')
    } finally {
      setLoading(false)
    }
  }

  const timeSlotById = useMemo(() => {
    const map = new Map()
    timeSlots.forEach((slot) => {
      map.set(slot.timeSlotId, slot)
    })
    return map
  }, [timeSlots])

  const weeklySlots = useMemo(() => {
    const dedup = new Map()
    requestedDateSlots.forEach((item) => {
      const dayOfWeek = toDayOfWeek(item.date)
      if (!dayOfWeek) return
      const key = `${dayOfWeek}-${item.timeSlotId}`
      if (!dedup.has(key)) {
        dedup.set(key, { dayOfWeek, timeSlotId: item.timeSlotId })
      }
    })
    return Array.from(dedup.values()).sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
      return a.timeSlotId - b.timeSlotId
    })
  }, [requestedDateSlots])

  const calendarWeeks = useMemo(() => buildCalendarWeeks(plannerModal.monthCursor), [plannerModal.monthCursor])

  const coachReviewRows = useMemo(() => {
    if (!coachReviewModal.coach) return []
    const unavailable = Array.isArray(coachReviewModal.coach.unavailableSlots) ? coachReviewModal.coach.unavailableSlots : []
    return requestedDateSlots
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date) || a.timeSlotId - b.timeSlotId)
      .map((item) => {
        const dayOfWeek = toDayOfWeek(item.date)
        const blocked = unavailable.find((slot) => slot.dayOfWeek === dayOfWeek && slot.timeSlotId === item.timeSlotId)
        return {
          ...item,
          unavailable: Boolean(blocked),
          reason: blocked?.reason || null,
        }
      })
  }, [coachReviewModal.coach, requestedDateSlots])

  const unresolvedReviewCount = useMemo(
    () => coachReviewRows.filter((item) => item.unavailable).length,
    [coachReviewRows],
  )

  function openPlannerModal() {
    const today = formatDateValue(new Date())
    const nextMonth = addDays(today, 30)
    const startDate = form.startDate || today
    const endDate = form.endDate || nextMonth

    if (!form.startDate || !form.endDate) {
      setForm((prev) => ({
        ...prev,
        startDate,
        endDate,
      }))
    }

    setPlannerModal({
      open: true,
      focusDate: startDate,
      monthCursor: `${startDate.slice(0, 7)}-01`,
    })
  }

  function isDateInSelectedRange(dateValue) {
    if (!form.startDate || !form.endDate) return false
    return dateValue >= form.startDate && dateValue <= form.endDate
  }

  function setPlannerRange(patch) {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      if (next.startDate && next.endDate && next.startDate > next.endDate) {
        return { ...next, endDate: next.startDate }
      }
      return next
    })
  }

  function selectCalendarDate(dateValue) {
    if (!isDateInSelectedRange(dateValue)) return
    setPlannerModal((prev) => ({ ...prev, focusDate: dateValue }))
  }

  function isDateSlotSelected(dateValue, timeSlotId) {
    return requestedDateSlots.some((slot) => slot.date === dateValue && slot.timeSlotId === timeSlotId)
  }

  function toggleDateSlot(dateValue, timeSlotId) {
    const exists = requestedDateSlots.some((slot) => slot.date === dateValue && slot.timeSlotId === timeSlotId)
    if (exists) {
      setRequestedDateSlots((prev) => prev.filter((slot) => !(slot.date === dateValue && slot.timeSlotId === timeSlotId)))
      return
    }
    setRequestedDateSlots((prev) => [...prev, { date: dateValue, timeSlotId }])
  }

  function removeRequestedDateSlot(dateValue, timeSlotId) {
    setRequestedDateSlots((prev) => prev.filter((slot) => !(slot.date === dateValue && slot.timeSlotId === timeSlotId)))
  }

  function formatSlotLabel(timeSlotId) {
    const slot = timeSlotById.get(timeSlotId)
    if (!slot) return `Slot ${timeSlotId}`
    return `Slot ${slot.slotIndex} (${String(slot.startTime || '').slice(0, 5)}-${String(slot.endTime || '').slice(0, 5)})`
  }

  function getUnavailableReason(reason) {
    if (reason === 'BOOKED_IN_RANGE') return 'Already booked in selected date range'
    if (reason === 'NO_WEEKLY_AVAILABILITY') return 'Not in coach weekly availability'
    return 'Unavailable'
  }

  function openCoachReview(coach) {
    if (!form.startDate || !form.endDate || requestedDateSlots.length === 0) {
      setError('Please set desired schedule first.')
      return
    }
    setCoachReviewModal({
      open: true,
      coach,
    })
  }

  async function previewMatches() {
    if (!form.startDate || !form.endDate || weeklySlots.length === 0) {
      setError('Please set date range and pick at least one slot in planner.')
      return
    }
    if (new Date(form.startDate) > new Date(form.endDate)) {
      setError('Start date must be before or equal to end date.')
      return
    }

    try {
      setLoading(true)
      setError('')
      const response = await coachBookingApi.matchCoaches({
        startDate: form.startDate,
        endDate: form.endDate,
        slots: weeklySlots,
      })
      const payload = response?.data ?? response
      setMatches({
        fullMatches: Array.isArray(payload?.fullMatches) ? payload.fullMatches : [],
        partialMatches: Array.isArray(payload?.partialMatches) ? payload.partialMatches : [],
      })
    } catch (err) {
      setError(err?.response?.data?.message || 'Cannot preview coach matches')
    } finally {
      setLoading(false)
    }
  }

  async function requestCoach(coachId) {
    if (!form.startDate || !form.endDate || weeklySlots.length === 0) {
      setError('Please set desired schedule first.')
      return
    }
    try {
      setLoading(true)
      setError('')
      await coachBookingApi.createRequest({
        coachId,
        startDate: form.startDate,
        endDate: form.endDate,
        slots: weeklySlots,
      })
      setMessage('Booking request sent. Coach will approve or deny your request.')
      setActiveTab('schedule')
      setCoachReviewModal({ open: false, coach: null })
      await loadMySchedule()
    } catch (err) {
      setError(err?.response?.data?.message || 'Cannot create booking request')
    } finally {
      setLoading(false)
    }
  }

  async function cancelSession(sessionId) {
    if (!window.confirm('Cancel this PT session?')) return
    try {
      setLoading(true)
      await coachBookingApi.cancelSession(sessionId, { cancelReason: 'Cancelled by customer' })
      await loadMySchedule()
      setMessage('Session cancelled.')
    } catch (err) {
      setError(err?.response?.data?.message || 'Cannot cancel session')
    } finally {
      setLoading(false)
    }
  }

  async function submitReschedule() {
    if (!rescheduleModal.sessionDate || !rescheduleModal.timeSlotId) {
      setError('Please choose new date and time slot.')
      return
    }
    try {
      setLoading(true)
      await coachBookingApi.rescheduleSession(rescheduleModal.session.ptSessionId, {
        sessionDate: rescheduleModal.sessionDate,
        timeSlotId: Number(rescheduleModal.timeSlotId),
        reason: rescheduleModal.reason || undefined,
      })
      setRescheduleModal({ open: false, session: null, sessionDate: '', timeSlotId: '', reason: '' })
      setMessage('Reschedule request sent to coach.')
      await loadMySchedule()
    } catch (err) {
      setError(err?.response?.data?.message || 'Cannot send reschedule request')
    } finally {
      setLoading(false)
    }
  }

  async function submitFeedback() {
    if (!feedbackModal.session || feedbackModal.rating < 1) {
      setError('Please select a rating.')
      return
    }
    try {
      setLoading(true)
      await coachBookingApi.submitFeedback({
        ptSessionId: feedbackModal.session.ptSessionId,
        rating: feedbackModal.rating,
        comment: feedbackModal.comment || '',
      })
      setFeedbackModal({ open: false, session: null, rating: 0, comment: '' })
      setMessage('Feedback submitted.')
      await loadMySchedule()
    } catch (err) {
      setError(err?.response?.data?.message || 'Cannot submit feedback')
    } finally {
      setLoading(false)
    }
  }

  const completedSessions = useMemo(
    () => scheduleData.items.filter((s) => String(s.status || '').toUpperCase() === 'COMPLETED'),
    [scheduleData.items],
  )

  return (
    <WorkspaceScaffold title="Coach Booking" subtitle="Pick desired weekly slots first, then request matched coaches." links={customerNav}>
      <div className="max-w-7xl mx-auto space-y-6 pb-10">
        <div className="flex flex-wrap gap-4 border-b border-gym-dark-50 pb-2">
          {[
            { id: 'match', label: 'Match Coaches' },
            { id: 'schedule', label: 'My PT Schedule' },
            { id: 'feedback', label: 'Feedback & Reviews' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 ${activeTab === tab.id
                ? 'bg-gym-dark-900 text-gym-500 shadow-xl shadow-gym-dark-900/20'
                : 'bg-white text-gym-dark-400 hover:bg-gym-dark-50'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {(error || message) && (
          <div className={`rounded-2xl px-6 py-4 flex items-center justify-between border-2 animate-in slide-in-from-top-4 duration-300 ${error
            ? 'bg-red-50 border-red-100 text-red-700'
            : 'bg-gym-50 border-gym-100 text-gym-700'
            }`}>
            <span className="text-sm font-black uppercase tracking-tight">{error || message}</span>
            <button onClick={() => { setError(''); setMessage('') }} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/50 hover:bg-white text-lg font-black transition-colors">×</button>
          </div>
        )}

        {activeTab === 'match' && (
          <div className="space-y-6">
            <div className="gc-card-compact border-2 border-gym-dark-100/50 bg-white/80 backdrop-blur-sm shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gym-dark-50 pb-5">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-gym-dark-900 tracking-tight flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-gym-dark-900 text-gym-500 flex items-center justify-center text-sm font-black">1</span>
                    Define Your Training Cycle
                  </h3>
                  <p className="text-xs font-bold text-gym-dark-400">Select your preferred time slots to find the perfect coach.</p>
                </div>
                <button
                  onClick={openPlannerModal}
                  className="btn-primary px-6 py-3 text-xs shadow-lg shadow-gym-500/20"
                >
                  Configure Planner
                </button>
              </div>

              <div className="mt-6 rounded-2xl border-2 border-gym-dark-50 bg-gym-dark-50/30 p-5 space-y-4">
                <div className="flex flex-wrap gap-6 text-[10px] font-black uppercase tracking-widest text-gym-dark-400">
                  <div className="flex flex-col gap-1">
                    <span className="opacity-50">Cycle Start</span>
                    <span className="text-gym-dark-900">{form.startDate || '—'}</span>
                  </div>
                  <div className="flex flex-col gap-1 text-gym-500">
                    <span className="opacity-50">Cycle End</span>
                    <span className="text-gym-dark-900">{form.endDate || '—'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="opacity-50">Total Sessions</span>
                    <span className="text-gym-dark-900">{requestedDateSlots.length}</span>
                  </div>
                </div>

                {requestedDateSlots.length === 0 ? (
                  <p className="text-sm font-bold text-gym-dark-300 italic">No slots drafted yet. Tap the planner to begin.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {requestedDateSlots
                      .slice()
                      .sort((a, b) => a.date.localeCompare(b.date) || a.timeSlotId - b.timeSlotId)
                      .slice(0, 8)
                      .map((item) => (
                        <span key={`${item.date}-${item.timeSlotId}`} className="inline-flex items-center gap-2 text-[10px] font-black px-3 py-1.5 rounded-xl bg-white border border-gym-dark-100 text-gym-dark-700 uppercase tracking-tight shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-gym-500"></span>
                          {item.date.slice(5)} · {String(timeSlotById.get(item.timeSlotId)?.startTime || '').slice(0, 5)}
                        </span>
                      ))}
                    {requestedDateSlots.length > 8 && (
                      <span className="text-[10px] font-black text-gym-dark-300 self-center px-2">+{requestedDateSlots.length - 8} More</span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-gym-dark-50">
                <button onClick={previewMatches} disabled={loading} className="btn-primary w-full py-4 text-sm font-black shadow-2xl">
                  {loading ? 'Optimizing Matches...' : 'Find Compatible Coaches'}
                </button>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-gym-500 rounded-full"></div>
                  <h4 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight">Full Match Compatibility</h4>
                </div>
                {matches.fullMatches.length === 0 && (
                  <p className="text-xs font-bold text-gym-dark-300 bg-gym-dark-50/50 p-8 rounded-3xl border-2 border-dashed border-gym-dark-100 text-center uppercase tracking-widest">
                    No 100% matches found. Try adjusting your slots.
                  </p>
                )}
                <div className="grid gap-4">
                  {matches.fullMatches.map((coach) => (
                    <CoachCard key={`full-${coach.coachId}`} coach={coach} onReview={openCoachReview} isFull />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
                  <h4 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight">High Potential Matches</h4>
                </div>
                {matches.partialMatches.length === 0 && (
                  <p className="text-xs font-bold text-gym-dark-300 bg-gym-dark-50/50 p-8 rounded-3xl border-2 border-dashed border-gym-dark-100 text-center uppercase tracking-widest">
                    No partial matches at this time.
                  </p>
                )}
                <div className="grid gap-4">
                  {matches.partialMatches.map((coach) => (
                    <CoachCard key={`partial-${coach.coachId}`} coach={coach} onReview={openCoachReview} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-gym-500 rounded-full"></div>
              <h3 className="text-2xl font-black text-gym-dark-900 uppercase tracking-tight">Your Training Regimen</h3>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <div className="grid gap-4">
                  {scheduleData.items.length === 0 && !loading && (
                    <div className="gc-card-compact border-2 border-dashed border-gym-dark-100 bg-gym-dark-50/30 flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-gym-dark-200 mb-4 shadow-sm">
                        <Clock size={32} />
                      </div>
                      <p className="text-sm font-black text-gym-dark-400 uppercase tracking-widest">No active sessions</p>
                      <p className="text-xs font-bold text-gym-dark-300 mt-2">Book a coach to start your transformation.</p>
                    </div>
                  )}
                  {scheduleData.items.map((s) => (
                    <article key={s.ptSessionId} className="gc-card-compact border-2 border-gym-dark-50 bg-white group transition-hover hover:border-gym-200 hover:shadow-xl">
                      <div className="flex items-center justify-between gap-4 border-b border-gym-dark-50 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gym-dark-900 text-gym-500 flex items-center justify-center font-black text-sm shadow-lg">
                            {s.coachName.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-gym-dark-900 uppercase tracking-tight">{s.coachName}</h4>
                            <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest">{s.status}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-gym-dark-900">{s.sessionDate}</p>
                          <p className="text-[10px] font-bold text-gym-500 uppercase">{String(s.startTime || '').slice(0, 5)} — {String(s.endTime || '').slice(0, 5)}</p>
                        </div>
                      </div>

                      <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          {s.reschedule?.status === 'PENDING' && (
                            <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                              Reschedule Requested
                            </div>
                          )}
                          {s.reschedule?.status === 'DENIED' && (
                            <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">
                              Reschedule Denied: {s.reschedule.note || 'Contact Coach'}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {String(s.status || '').toUpperCase() === 'SCHEDULED' && (
                            <>
                              <button
                                onClick={() => setRescheduleModal({ open: true, session: s, sessionDate: '', timeSlotId: '', reason: '' })}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border-2 border-gym-dark-100 text-gym-dark-600 hover:bg-gym-dark-900 hover:text-gym-500 hover:border-gym-dark-900 transition-all"
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => cancelSession(s.ptSessionId)}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border-2 border-red-100 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {(scheduleData.pendingRequests.length > 0 || scheduleData.deniedRequests.length > 0) && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-gym-dark-400 uppercase tracking-[0.2em]">Application Status</h4>

                    {scheduleData.pendingRequests.map((r) => (
                      <div key={r.ptRequestId} className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Awaiting Approval</span>
                          <Clock size={14} className="text-amber-500" />
                        </div>
                        <p className="text-sm font-black text-gym-dark-900 uppercase tracking-tight">{r.coachName}</p>
                        <p className="text-[10px] font-bold text-gym-dark-400">{r.startDate} to {r.endDate}</p>
                      </div>
                    ))}

                    {scheduleData.deniedRequests.map((r) => (
                      <div key={r.ptRequestId} className="bg-red-50 border-2 border-red-100 rounded-3xl p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">Request Denied</span>
                          <X size={14} className="text-red-500" />
                        </div>
                        <p className="text-sm font-black text-gym-dark-900 uppercase tracking-tight">{r.coachName}</p>
                        <p className="text-[10px] font-bold text-red-600">"{r.denyReason || 'Availability mismatch'}"</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-gym-500 rounded-full"></div>
              <h3 className="text-2xl font-black text-gym-dark-900 uppercase tracking-tight">Performance Reviews</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedSessions.map((s) => (
                <article key={s.ptSessionId} className="gc-card-compact border-2 border-gym-dark-50 bg-white group transition-hover hover:border-gym-500 hover:shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gym-500/5 -mr-8 -mt-8 rounded-full"></div>

                  <div className="relative space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gym-dark-900 text-gym-500 flex items-center justify-center font-black text-lg shadow-lg">
                        {s.coachName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-gym-dark-900 uppercase tracking-tight">{s.coachName}</h4>
                        <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest">Completed Session</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-gym-dark-50/50 space-y-1">
                      <p className="text-xs font-black text-gym-dark-900">{s.sessionDate}</p>
                      <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-tight">Slot {s.slotIndex} Training</p>
                    </div>

                    <button
                      onClick={() => setFeedbackModal({ open: true, session: s, rating: 0, comment: '' })}
                      className="btn-primary w-full py-3 text-[10px] font-black"
                    >
                      Record Experience
                    </button>
                  </div>
                </article>
              ))}
              {!loading && completedSessions.length === 0 && (
                <div className="col-span-full py-16 text-center bg-gym-dark-50/30 rounded-3xl border-2 border-dashed border-gym-dark-100">
                  <p className="text-sm font-black text-gym-dark-400 uppercase tracking-widest">No sessions to rate</p>
                  <p className="text-xs font-bold text-gym-dark-300 mt-2">Finish your training sessions to unlock reviews.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {plannerModal.open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-12 bg-gym-dark-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-7xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gym-dark-100 animate-in zoom-in-95 duration-300">
            <header className="px-10 py-8 bg-gym-dark-900 text-white flex items-center justify-between">
              <div>
                <h4 className="text-2xl font-black uppercase tracking-tight text-gym-500">Training Planner</h4>
                <p className="text-xs font-bold text-gym-dark-400 mt-1 uppercase tracking-widest">Architect your perfect session cycle</p>
              </div>
              <button
                onClick={() => setPlannerModal({ open: false, focusDate: '', monthCursor: '' })}
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 transition-colors text-2xl font-black"
              >
                ×
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              <div className="grid gap-10 lg:grid-cols-12">
                <div className="lg:col-span-8 space-y-8">
                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gym-dark-400">Launch Date</span>
                        <input
                          aria-label="Start date"
                          type="date"
                          value={form.startDate}
                          onChange={(e) => {
                            const nextStart = e.target.value
                            setPlannerRange({ startDate: nextStart })
                            if (nextStart) {
                              setPlannerModal((prev) => ({
                                ...prev,
                                monthCursor: `${nextStart.slice(0, 7)}-01`,
                                focusDate: nextStart,
                              }))
                            }
                          }}
                          className="gc-input w-full min-w-[160px]"
                        />
                      </div>
                      <div className="w-4 h-0.5 bg-gym-dark-100 mt-6"></div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gym-dark-400">Target End</span>
                        <input
                          aria-label="End date"
                          type="date"
                          value={form.endDate}
                          onChange={(e) => setPlannerRange({ endDate: e.target.value })}
                          className="gc-input w-full min-w-[160px]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-gym-dark-50 p-2 rounded-2xl border border-gym-dark-100">
                      <button
                        onClick={() => setPlannerModal((prev) => ({ ...prev, monthCursor: shiftMonth(prev.monthCursor, -1) }))}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white shadow-sm hover:text-gym-500 transition-colors font-black"
                      >
                        ‹
                      </button>
                      <span className="text-xs font-black uppercase tracking-widest text-gym-dark-900 min-w-[140px] text-center">
                        {toMonthTitle(plannerModal.monthCursor)}
                      </span>
                      <button
                        onClick={() => setPlannerModal((prev) => ({ ...prev, monthCursor: shiftMonth(prev.monthCursor, 1) }))}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white shadow-sm hover:text-gym-500 transition-colors font-black"
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[32px] border-2 border-gym-dark-50 p-1 bg-gym-dark-50/30">
                    <div className="grid grid-cols-7 gap-1 mb-2 px-4 pt-4">
                      {DAYS.map((day) => (
                        <div key={day.id} className="text-[10px] font-black text-gym-dark-300 text-center py-2 uppercase tracking-widest">{day.label}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2 p-4">
                      {calendarWeeks.flat().map((cell) => {
                        const isInRange = isDateInSelectedRange(cell.date)
                        const isFocused = plannerModal.focusDate === cell.date
                        const selectedCount = requestedDateSlots.filter((item) => item.date === cell.date).length
                        return (
                          <button
                            key={cell.date}
                            onClick={() => selectCalendarDate(cell.date)}
                            disabled={!isInRange}
                            className={`h-20 sm:h-24 rounded-2xl border-2 text-left p-3 transition-all relative group ${!cell.isCurrentMonth
                              ? 'bg-transparent text-gym-dark-200 border-transparent opacity-30'
                              : isInRange
                                ? 'bg-white border-gym-dark-50 hover:border-gym-500 hover:shadow-xl'
                                : 'bg-gym-dark-50/50 border-transparent text-gym-dark-200 cursor-not-allowed'
                              } ${isFocused ? 'ring-4 ring-gym-500/20 border-gym-500 z-10' : ''}`}
                          >
                            <span className={`text-sm font-black ${isFocused ? 'text-gym-500' : 'text-gym-dark-900'}`}>
                              {Number(cell.date.slice(8, 10))}
                            </span>
                            {selectedCount > 0 && (
                              <div className="absolute top-3 right-3 w-6 h-6 rounded-lg bg-gym-dark-900 text-gym-500 text-[10px] font-black flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
                                {selectedCount}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                  <div className="gc-card-compact border-2 border-gym-dark-900 bg-gym-dark-900 text-white shadow-2xl">
                    <div className="p-2">
                      <p className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest mb-1">Target Intensity</p>
                      <p className="text-xl font-black text-gym-500">{plannerModal.focusDate || 'Select a date'}</p>
                    </div>

                    <div className="mt-6 space-y-3">
                      {plannerModal.focusDate && isDateInSelectedRange(plannerModal.focusDate) ? (
                        timeSlots.map((slot) => {
                          const selected = isDateSlotSelected(plannerModal.focusDate, slot.timeSlotId)
                          return (
                            <button
                              key={`planner-slot-${slot.timeSlotId}`}
                              onClick={() => toggleDateSlot(plannerModal.focusDate, slot.timeSlotId)}
                              className={`w-full group flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 text-left ${selected
                                ? 'bg-gym-500 border-gym-500 text-gym-dark-900 shadow-xl shadow-gym-500/20'
                                : 'bg-white/5 border-white/10 text-white hover:border-gym-500/50'
                                }`}
                            >
                              <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${selected ? 'text-gym-dark-900' : 'text-gym-dark-400'}`}>Slot {slot.slotIndex}</p>
                                <p className="text-sm font-black">{String(slot.startTime || '').slice(0, 5)} — {String(slot.endTime || '').slice(0, 5)}</p>
                              </div>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? 'bg-gym-dark-900 border-gym-dark-900 text-gym-500' : 'border-white/20'}`}>
                                {selected && <div className="w-2 h-2 rounded-full bg-gym-500"></div>}
                              </div>
                            </button>
                          )
                        })
                      ) : (
                        <div className="py-12 text-center">
                          <Clock className="mx-auto text-gym-dark-600 mb-4" size={40} />
                          <p className="text-xs font-bold text-gym-dark-400">Select an active training date to assign time slots.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest px-1">Planned Sessions ({requestedDateSlots.length})</h5>
                    <div className="max-h-64 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                      {requestedDateSlots
                        .slice()
                        .sort((a, b) => a.date.localeCompare(b.date) || a.timeSlotId - b.timeSlotId)
                        .map((item) => (
                          <button
                            key={`picked-${item.date}-${item.timeSlotId}`}
                            onClick={() => removeRequestedDateSlot(item.date, item.timeSlotId)}
                            className="w-full text-left p-4 rounded-2xl bg-white border border-gym-dark-100 flex items-center justify-between group hover:border-red-500 transition-colors shadow-sm"
                          >
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-black text-gym-dark-900 uppercase">{item.date}</p>
                              <p className="text-xs font-bold text-gym-dark-400 uppercase tracking-widest">{formatSlotLabel(item.timeSlotId)}</p>
                            </div>
                            <span className="text-gym-dark-200 group-hover:text-red-500 transition-colors font-black text-xl">×</span>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <footer className="px-10 py-8 bg-gym-dark-50 border-t border-gym-dark-100 flex justify-end gap-4">
              <button
                onClick={() => setPlannerModal((prev) => ({ ...prev, open: false }))}
                className="px-10 py-4 text-xs font-black uppercase tracking-widest text-gym-dark-600 hover:text-gym-dark-900 transition-colors"
              >
                Draft Strategy
              </button>
              <button
                onClick={() => {
                  setPlannerModal((prev) => ({ ...prev, open: false }))
                  void previewMatches()
                }}
                className="btn-primary px-10 py-4 text-xs shadow-xl shadow-gym-500/20"
              >
                Finalize & Search
              </button>
            </footer>
          </div>
        </div>
      )}

      {coachReviewModal.open && coachReviewModal.coach && (
        <div className="fixed inset-0 z-[100] bg-gym-dark-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="px-8 py-8 border-b border-gym-dark-50 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-gym-dark-900 text-gym-500 flex items-center justify-center text-3xl font-black shadow-xl">
                  {coachReviewModal.coach.fullName.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xl font-black text-gym-dark-900 uppercase tracking-tight">{coachReviewModal.coach.fullName}</h4>
                  <p className="text-xs font-bold text-gym-dark-400 uppercase tracking-widest">{coachReviewModal.coach.email}</p>
                </div>
              </div>
              <button
                onClick={() => setCoachReviewModal({ open: false, coach: null })}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gym-dark-50 text-gym-dark-400 hover:text-gym-dark-900 transition-colors font-black"
              >
                ×
              </button>
            </header>

            <div className="px-8 py-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gym-dark-900 text-white">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gym-dark-400">Match Accuracy</span>
                <span className="text-2xl font-black text-gym-500">{coachReviewModal.coach.matchedSlots} <span className="text-xs text-white/40">/ {coachReviewModal.coach.requestedSlots} SESSIONS</span></span>
              </div>

              <div className="space-y-3">
                {coachReviewRows.map((row) => (
                  <div
                    key={`review-${row.date}-${row.timeSlotId}`}
                    className={`group rounded-2xl border-2 p-5 flex items-center justify-between gap-4 transition-all ${row.unavailable
                      ? 'border-red-50 bg-red-50/30'
                      : 'border-gym-50 bg-gym-50/20'
                      }`}
                  >
                    <div>
                      <p className={`text-xs font-black uppercase tracking-widest ${row.unavailable ? 'text-red-600' : 'text-gym-700'}`}>
                        {row.date}
                      </p>
                      <p className={`text-sm font-black ${row.unavailable ? 'text-gym-dark-900' : 'text-gym-dark-900'}`}>
                        {formatSlotLabel(row.timeSlotId)}
                      </p>
                    </div>

                    {row.unavailable ? (
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-white px-3 py-1.5 rounded-lg border border-red-100 italic">
                          {getUnavailableReason(row.reason)}
                        </span>
                        <button
                          onClick={() => removeRequestedDateSlot(row.date, row.timeSlotId)}
                          className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500 text-white shadow-lg shadow-red-500/20 hover:scale-110 transition-transform"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gym-500 flex items-center justify-center text-gym-dark-900 shadow-lg shadow-gym-500/20">
                        <CheckCircle2 size={16} strokeWidth={3} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <footer className="px-8 py-8 bg-gym-dark-50 border-t border-gym-dark-100 flex flex-col gap-4">
              <div className={`p-4 rounded-2xl text-center text-[10px] font-black uppercase tracking-widest border-2 ${unresolvedReviewCount > 0 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-gym-500/10 border-gym-500/20 text-gym-700'}`}>
                {unresolvedReviewCount > 0
                  ? `Conflict detected: ${unresolvedReviewCount} slot(s) overlap with existing schedules.`
                  : 'Perfect Match: This coach is fully available for your regimen.'}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setCoachReviewModal({ open: false, coach: null })}
                  className="flex-1 py-4 text-xs font-black uppercase tracking-widest text-gym-dark-600 hover:text-gym-dark-900 transition-colors"
                >
                  Adjust Draft
                </button>
                <button
                  onClick={() => requestCoach(coachReviewModal.coach.coachId)}
                  disabled={loading || unresolvedReviewCount > 0 || requestedDateSlots.length === 0}
                  className="btn-primary flex-[2] py-4 text-xs shadow-2xl disabled:opacity-50"
                >
                  Deploy Request
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {rescheduleModal.open && (
        <div className="fixed inset-0 z-[100] bg-gym-dark-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <header className="px-8 py-8 bg-gym-dark-900 text-white flex items-center justify-between">
              <div>
                <h4 className="text-xl font-black uppercase tracking-tight text-gym-500">Reschedule</h4>
                <p className="text-[10px] font-bold text-gym-dark-400 mt-1 uppercase tracking-widest">Pivot your training strategy</p>
              </div>
              <button onClick={() => setRescheduleModal({ open: false, session: null, sessionDate: '', timeSlotId: '', reason: '' })} className="hover:text-gym-500 transition-colors text-2xl font-black">×</button>
            </header>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gym-dark-400 px-1">Tactical Date</label>
                  <input type="date" value={rescheduleModal.sessionDate} onChange={(e) => setRescheduleModal((prev) => ({ ...prev, sessionDate: e.target.value }))} className="gc-input" />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gym-dark-400 px-1">Selected Window</label>
                  <select value={rescheduleModal.timeSlotId} onChange={(e) => setRescheduleModal((prev) => ({ ...prev, timeSlotId: e.target.value }))} className="gc-input">
                    <option value="">Select Target Window</option>
                    {timeSlots.map((slot) => (
                      <option key={slot.timeSlotId} value={slot.timeSlotId}>
                        Slot {slot.slotIndex} ({String(slot.startTime || '').slice(0, 5)} - {String(slot.endTime || '').slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gym-dark-400 px-1">Reason for Pivot</label>
                  <textarea value={rescheduleModal.reason} onChange={(e) => setRescheduleModal((prev) => ({ ...prev, reason: e.target.value }))} className="gc-input min-h-[100px] resize-none" placeholder="Provide context for your coach..." />
                </div>
              </div>

              <button onClick={submitReschedule} className="btn-primary w-full py-4 text-xs font-black shadow-2xl">
                Deploy Update
              </button>
            </div>
          </div>
        </div>
      )}

      {feedbackModal.open && (
        <div className="fixed inset-0 z-[100] bg-gym-dark-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="relative h-48 bg-gym-dark-900 flex flex-col items-center justify-center text-center p-8">
              <div className="absolute top-6 right-6">
                <button onClick={() => setFeedbackModal({ open: false, session: null, rating: 0, comment: '' })} className="text-white/40 hover:text-gym-500 transition-colors text-2xl font-black">×</button>
              </div>
              <div className="w-20 h-20 rounded-3xl bg-gym-500 text-gym-dark-900 flex items-center justify-center text-4xl font-black shadow-2xl mb-4 animate-bounce">
                <Sparkles size={40} />
              </div>
              <h4 className="text-xl font-black uppercase tracking-tight text-white italic">Evaluate Intensity</h4>
            </div>

            <div className="p-8 space-y-8">
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setFeedbackModal((prev) => ({ ...prev, rating: star }))}
                    className={`text-4xl transition-all ${star <= feedbackModal.rating ? 'text-gym-500 scale-125' : 'text-gym-dark-100 hover:text-gym-500/50'}`}
                  >
                    <Star size={36} fill={star <= feedbackModal.rating ? "currentColor" : "none"} strokeWidth={3} />
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-gym-dark-400 px-1">Session Intelligence</label>
                <textarea
                  value={feedbackModal.comment}
                  onChange={(e) => setFeedbackModal((prev) => ({ ...prev, comment: e.target.value }))}
                  className="gc-input min-h-[120px] resize-none"
                  placeholder="Share your breakthrough or challenges..."
                />
              </div>

              <button onClick={submitFeedback} className="btn-primary w-full py-4 text-xs font-black shadow-2xl">
                Broadcast Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

function CoachCard({ coach, onReview, isFull }) {
  const unavailableSlots = Array.isArray(coach.unavailableSlots) ? coach.unavailableSlots : []
  const bookedCount = unavailableSlots.filter((s) => s.reason === 'BOOKED_IN_RANGE').length
  const weeklyUnavailableCount = unavailableSlots.filter((s) => s.reason === 'NO_WEEKLY_AVAILABILITY').length

  return (
    <article className={`gc-card-compact border-2 transition-all duration-500 overflow-hidden group ${isFull
        ? 'border-gym-500/30 bg-white shadow-xl shadow-gym-500/5'
        : 'border-gym-dark-50 bg-white hover:border-gym-dark-200'
      }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg transition-transform group-hover:scale-110 ${isFull ? 'bg-gym-500 text-gym-dark-900' : 'bg-gym-dark-900 text-gym-500'
            }`}>
            {coach.fullName.charAt(0)}
          </div>
          <div>
            <h5 className="font-black text-gym-dark-900 uppercase tracking-tight">{coach.fullName}</h5>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isFull ? 'bg-gym-500/20 text-gym-700' : 'bg-gym-dark-100 text-gym-dark-500'
                }`}>
                {isFull ? 'Optimal Match' : 'High Overlap'}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-gym-dark-900 leading-none">{coach.matchedSlots}<span className="text-[10px] text-gym-dark-300">/{coach.requestedSlots}</span></p>
          <p className="text-[9px] font-bold text-gym-dark-400 uppercase tracking-tighter">Availability</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <p className="text-xs font-medium text-gym-dark-600 line-clamp-2 leading-relaxed">
          {coach.bio || 'Elite fitness professional dedicated to your performance transformation and peak conditioning.'}
        </p>

        {(bookedCount > 0 || weeklyUnavailableCount > 0) && (
          <div className="p-3 rounded-xl bg-gym-dark-50/50 border border-gym-dark-100/50">
            <p className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest flex items-center gap-2">
              <Clock size={12} /> Optimization Notes
            </p>
            <div className="mt-1 space-y-0.5">
              {bookedCount > 0 && <p className="text-[10px] font-bold text-red-500">· {bookedCount} slot(s) reserved by other clients.</p>}
              {weeklyUnavailableCount > 0 && <p className="text-[10px] font-bold text-amber-600">· {weeklyUnavailableCount} slot(s) outside base schedule.</p>}
            </div>
          </div>
        )}

        <button
          onClick={() => onReview(coach)}
          className={`w-full py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg ${isFull
              ? 'bg-gym-dark-900 text-gym-500 hover:bg-black shadow-gym-dark-900/20'
              : 'bg-gym-50 text-gym-700 hover:bg-gym-100 border border-gym-100'
            }`}
        >
          Inspect Regimen Match
        </button>
      </div>
    </article>
  )
}

export default CustomerCoachBookingPage
