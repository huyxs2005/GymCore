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
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('match')} className={`px-4 py-2 rounded-xl font-semibold ${activeTab === 'match' ? 'bg-gym-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Match Coaches</button>
          <button onClick={() => setActiveTab('schedule')} className={`px-4 py-2 rounded-xl font-semibold ${activeTab === 'schedule' ? 'bg-gym-600 text-white' : 'bg-slate-100 text-slate-700'}`}>My PT Schedule</button>
          <button onClick={() => setActiveTab('feedback')} className={`px-4 py-2 rounded-xl font-semibold ${activeTab === 'feedback' ? 'bg-gym-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Feedback Coach</button>
        </div>

        {(error || message) && (
          <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            <span>{error || message}</span>
            <button onClick={() => { setError(''); setMessage('') }} className="font-bold">x</button>
          </div>
        )}

        {activeTab === 'match' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">1) Set Desired PT Schedule</h3>
                  <p className="text-sm text-slate-600">Pick exact date slots in a calendar popup, then preview matched coaches.</p>
                </div>
                <button
                  onClick={openPlannerModal}
                  className="px-4 py-2 rounded-xl bg-gym-600 text-white text-sm font-semibold hover:bg-gym-700"
                >
                  Open Schedule Planner
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <div className="flex flex-wrap gap-5 text-xs text-slate-600">
                  <span>Start: <strong className="text-slate-800">{form.startDate || '-'}</strong></span>
                  <span>End: <strong className="text-slate-800">{form.endDate || '-'}</strong></span>
                  <span>Selected date-slots: <strong className="text-slate-800">{requestedDateSlots.length}</strong></span>
                  <span>Unique weekly slots: <strong className="text-slate-800">{weeklySlots.length}</strong></span>
                </div>
                {requestedDateSlots.length === 0 && (
                  <p className="text-sm text-slate-500">No slots selected yet.</p>
                )}
                {requestedDateSlots.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {requestedDateSlots
                      .slice()
                      .sort((a, b) => a.date.localeCompare(b.date) || a.timeSlotId - b.timeSlotId)
                      .slice(0, 10)
                      .map((item) => (
                        <span key={`${item.date}-${item.timeSlotId}`} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
                          {item.date} · {formatSlotLabel(item.timeSlotId)}
                        </span>
                      ))}
                    {requestedDateSlots.length > 10 && (
                      <span className="text-xs text-slate-500 self-center">+{requestedDateSlots.length - 10} more</span>
                    )}
                  </div>
                )}
              </div>

              <button onClick={previewMatches} disabled={loading} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-700 disabled:opacity-50">
                {loading ? 'Loading...' : '2) Preview Matches'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4">
                <h4 className="text-lg font-bold text-emerald-800">Fully Match</h4>
                <p className="text-sm text-emerald-700">Coaches whose requested slots are all available in your selected period.</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {matches.fullMatches.length === 0 && <p className="text-sm text-slate-600">No fully matched coach yet.</p>}
                  {matches.fullMatches.map((coach) => (
                    <CoachCard key={`full-${coach.coachId}`} coach={coach} onReview={openCoachReview} />
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <h4 className="text-lg font-bold text-amber-800">Partial Match</h4>
                <p className="text-sm text-amber-700">Coaches with overlap but some requested slots already occupied or unavailable.</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {matches.partialMatches.length === 0 && <p className="text-sm text-slate-600">No partial matched coach yet.</p>}
                  {matches.partialMatches.map((coach) => (
                    <CoachCard key={`partial-${coach.coachId}`} coach={coach} onReview={openCoachReview} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-slate-900">My PT Schedule</h3>

            {scheduleData.pendingRequests.length > 0 && (
              <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <h4 className="font-bold text-amber-800 mb-2">Pending Requests</h4>
                <div className="space-y-2">
                  {scheduleData.pendingRequests.map((r) => (
                    <div key={r.ptRequestId} className="bg-white rounded-xl border border-amber-200 px-3 py-2 text-sm">
                      {r.coachName}: {r.startDate} to {r.endDate}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {scheduleData.deniedRequests.length > 0 && (
              <section className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <h4 className="font-bold text-red-800 mb-2">Denied Requests</h4>
                <div className="space-y-2">
                  {scheduleData.deniedRequests.map((r) => (
                    <div key={r.ptRequestId} className="bg-white rounded-xl border border-red-200 px-3 py-2 text-sm">
                      <div className="font-semibold text-slate-800">{r.coachName}: {r.startDate} to {r.endDate}</div>
                      <div className="text-red-700">Reason: {r.denyReason || 'No reason provided'}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scheduleData.items.map((s) => (
                <div key={s.ptSessionId} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900">{s.coachName}</h4>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">{s.status}</span>
                  </div>
                  <div className="text-sm text-slate-600">{s.sessionDate} | Slot {s.slotIndex} | {String(s.startTime || '').slice(0, 5)} - {String(s.endTime || '').slice(0, 5)}</div>
                  {s.reschedule?.status === 'PENDING' && <div className="text-xs text-amber-700">Reschedule pending coach approval</div>}
                  {s.reschedule?.status === 'DENIED' && <div className="text-xs text-red-700">Reschedule denied: {s.reschedule.note || 'No reason provided'}</div>}
                  <div className="flex gap-2">
                    {String(s.status || '').toUpperCase() === 'SCHEDULED' && (
                      <>
                        <button onClick={() => cancelSession(s.ptSessionId)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200">Cancel</button>
                        <button onClick={() => setRescheduleModal({ open: true, session: s, sessionDate: '', timeSlotId: '', reason: '' })} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200">Reschedule</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!loading && scheduleData.items.length === 0 && (
                <div className="text-sm text-slate-500">No PT sessions yet.</div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900">Feedback Coach</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedSessions.map((s) => (
                <div key={s.ptSessionId} className="bg-white border border-slate-200 rounded-2xl p-4">
                  <div className="font-semibold text-slate-900">{s.coachName}</div>
                  <div className="text-sm text-slate-600">{s.sessionDate} | Slot {s.slotIndex}</div>
                  <button onClick={() => setFeedbackModal({ open: true, session: s, rating: 0, comment: '' })} className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gym-600 text-white">Rate this session</button>
                </div>
              ))}
              {!loading && completedSessions.length === 0 && <div className="text-sm text-slate-500">No completed sessions to rate.</div>}
            </div>
          </div>
        )}
      </div>

      {plannerModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl bg-white rounded-2xl p-4 md:p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-lg font-bold text-slate-900">Set Desired PT Schedule</h4>
              <button
                onClick={() => setPlannerModal({ open: false, focusDate: '', monthCursor: '' })}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-slate-600">Start
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
                    className="mt-1 w-36 border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                  />
                </label>
                <label className="text-xs text-slate-600">End
                  <input
                    aria-label="End date"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setPlannerRange({ endDate: e.target.value })}
                    className="mt-1 w-36 border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPlannerModal((prev) => ({ ...prev, monthCursor: shiftMonth(prev.monthCursor, -1) }))}
                  className="px-2 py-1 rounded-md border border-slate-300 text-slate-600"
                >
                  ‹
                </button>
                <span className="text-sm font-semibold text-slate-700 min-w-32 text-center">{toMonthTitle(plannerModal.monthCursor)}</span>
                <button
                  onClick={() => setPlannerModal((prev) => ({ ...prev, monthCursor: shiftMonth(prev.monthCursor, 1) }))}
                  className="px-2 py-1 rounded-md border border-slate-300 text-slate-600"
                >
                  ›
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 border border-slate-200 rounded-xl p-3">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map((day) => (
                    <div key={day.id} className="text-[11px] font-semibold text-slate-500 text-center py-1">{day.label}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarWeeks.flat().map((cell) => {
                    const isInRange = isDateInSelectedRange(cell.date)
                    const isFocused = plannerModal.focusDate === cell.date
                    const selectedCount = requestedDateSlots.filter((item) => item.date === cell.date).length
                    return (
                      <button
                        key={cell.date}
                        onClick={() => selectCalendarDate(cell.date)}
                        disabled={!isInRange}
                        className={`h-14 rounded-lg border text-left px-2 py-1 transition ${
                          !cell.isCurrentMonth
                            ? 'bg-slate-50 text-slate-400 border-slate-100'
                            : 'bg-white text-slate-700 border-slate-200'
                        } ${isInRange ? 'hover:border-gym-400' : 'opacity-45 cursor-not-allowed'} ${isFocused ? 'border-gym-600 ring-1 ring-gym-600/30' : ''}`}
                      >
                        <div className="text-xs font-semibold">{Number(cell.date.slice(8, 10))}</div>
                        {selectedCount > 0 && (
                          <div className="mt-1 inline-flex items-center justify-center min-w-5 px-1 text-[10px] font-semibold rounded-full bg-gym-100 text-gym-700">
                            {selectedCount}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3 space-y-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Selected date</p>
                  <p className="text-sm font-bold text-slate-900">{plannerModal.focusDate || '-'}</p>
                </div>

                {plannerModal.focusDate && isDateInSelectedRange(plannerModal.focusDate) ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Available slots</p>
                    <div className="max-h-72 overflow-y-auto space-y-2">
                      {timeSlots.map((slot) => {
                        const selected = isDateSlotSelected(plannerModal.focusDate, slot.timeSlotId)
                        return (
                          <button
                            key={`planner-slot-${slot.timeSlotId}`}
                            onClick={() => toggleDateSlot(plannerModal.focusDate, slot.timeSlotId)}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-xs ${
                              selected
                                ? 'bg-gym-600 text-white border-gym-600'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-gym-400'
                            }`}
                          >
                            <div className="font-semibold">Slot {slot.slotIndex}</div>
                            <div>{String(slot.startTime || '').slice(0, 5)} - {String(slot.endTime || '').slice(0, 5)}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Choose a date inside the selected range to pick slots.</p>
                )}
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
              <p className="text-xs font-semibold text-slate-600 mb-2">Selected date-slots</p>
              {requestedDateSlots.length === 0 ? (
                <p className="text-sm text-slate-500">No slots selected.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {requestedDateSlots
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date) || a.timeSlotId - b.timeSlotId)
                    .map((item) => (
                      <button
                        key={`picked-${item.date}-${item.timeSlotId}`}
                        onClick={() => removeRequestedDateSlot(item.date, item.timeSlotId)}
                        className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-red-300 hover:text-red-700"
                        title="Remove slot"
                      >
                        {item.date} · {formatSlotLabel(item.timeSlotId)}
                        <span className="font-bold">×</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {coachReviewModal.open && coachReviewModal.coach && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-bold text-slate-900">Coach Match Review</h4>
                <p className="text-sm text-slate-600">{coachReviewModal.coach.fullName} · {coachReviewModal.coach.email}</p>
              </div>
              <button
                onClick={() => setCoachReviewModal({ open: false, coach: null })}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{coachReviewModal.coach.matchedSlots}/{coachReviewModal.coach.requestedSlots}</span> requested weekly slots are available.
            </div>

            <div className="space-y-2">
              {coachReviewRows.length === 0 && <p className="text-sm text-slate-500">No selected slots to review.</p>}
              {coachReviewRows.map((row) => (
                <div
                  key={`review-${row.date}-${row.timeSlotId}`}
                  className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${row.unavailable ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}
                >
                  <div>
                    <div className={`text-sm font-semibold ${row.unavailable ? 'text-red-800' : 'text-emerald-800'}`}>
                      {row.date} · {formatSlotLabel(row.timeSlotId)}
                    </div>
                    <div className={`text-xs ${row.unavailable ? 'text-red-700' : 'text-emerald-700'}`}>
                      {row.unavailable ? getUnavailableReason(row.reason) : 'Matched'}
                    </div>
                  </div>
                  {row.unavailable ? (
                    <button
                      onClick={() => removeRequestedDateSlot(row.date, row.timeSlotId)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-700 bg-white"
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700">OK</span>
                  )}
                </div>
              ))}
            </div>

            <div className={`rounded-lg px-3 py-2 text-sm ${unresolvedReviewCount > 0 ? 'bg-red-500/10 text-red-700' : 'bg-emerald-500/10 text-emerald-700'}`}>
              {unresolvedReviewCount > 0
                ? `${unresolvedReviewCount} unmatched slot(s) must be removed before requesting this coach.`
                : 'All selected slots match this coach.'}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCoachReviewModal({ open: false, coach: null })}
                className="px-4 py-2 rounded-xl border border-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => requestCoach(coachReviewModal.coach.coachId)}
                disabled={loading || unresolvedReviewCount > 0 || requestedDateSlots.length === 0}
                className="px-4 py-2 rounded-xl bg-gym-600 text-white disabled:opacity-50"
              >
                Confirm Booking Request
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-3">
            <h4 className="text-lg font-bold text-slate-900">Reschedule Request</h4>
            <label className="text-sm font-semibold text-slate-700">New date
              <input type="date" value={rescheduleModal.sessionDate} onChange={(e) => setRescheduleModal((prev) => ({ ...prev, sessionDate: e.target.value }))} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" />
            </label>
            <label className="text-sm font-semibold text-slate-700">New time slot
              <select value={rescheduleModal.timeSlotId} onChange={(e) => setRescheduleModal((prev) => ({ ...prev, timeSlotId: e.target.value }))} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2">
                <option value="">Select slot</option>
                {timeSlots.map((slot) => (
                  <option key={slot.timeSlotId} value={slot.timeSlotId}>
                    Slot {slot.slotIndex} ({String(slot.startTime || '').slice(0, 5)} - {String(slot.endTime || '').slice(0, 5)})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">Reason (optional)
              <textarea value={rescheduleModal.reason} onChange={(e) => setRescheduleModal((prev) => ({ ...prev, reason: e.target.value }))} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" rows={3} />
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRescheduleModal({ open: false, session: null, sessionDate: '', timeSlotId: '', reason: '' })} className="px-4 py-2 rounded-xl border border-slate-300">Close</button>
              <button onClick={submitReschedule} className="px-4 py-2 rounded-xl bg-gym-600 text-white">Send Request</button>
            </div>
          </div>
        </div>
      )}

      {feedbackModal.open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 space-y-3">
            <h4 className="text-lg font-bold text-slate-900">Rate Session</h4>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setFeedbackModal((prev) => ({ ...prev, rating: star }))} className={`text-2xl ${star <= feedbackModal.rating ? 'text-amber-500' : 'text-slate-300'}`}>★</button>
              ))}
            </div>
            <textarea value={feedbackModal.comment} onChange={(e) => setFeedbackModal((prev) => ({ ...prev, comment: e.target.value }))} rows={4} className="w-full border border-slate-300 rounded-xl px-3 py-2" placeholder="Optional comment" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setFeedbackModal({ open: false, session: null, rating: 0, comment: '' })} className="px-4 py-2 rounded-xl border border-slate-300">Close</button>
              <button onClick={submitFeedback} className="px-4 py-2 rounded-xl bg-gym-600 text-white">Submit</button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

function CoachCard({ coach, onReview }) {
  const unavailableSlots = Array.isArray(coach.unavailableSlots) ? coach.unavailableSlots : []
  const bookedCount = unavailableSlots.filter((s) => s.reason === 'BOOKED_IN_RANGE').length
  const weeklyUnavailableCount = unavailableSlots.filter((s) => s.reason === 'NO_WEEKLY_AVAILABILITY').length
  const isFullMatch = String(coach.matchType || '').toUpperCase() === 'FULL'

  return (
    <article className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="font-bold text-slate-900">{coach.fullName}</h5>
          <p className="text-xs text-slate-500">{coach.email}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isFullMatch ? 'bg-emerald-500/15 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {coach.matchedSlots}/{coach.requestedSlots} slots
        </span>
      </div>
      <p className="text-sm text-slate-600">{coach.bio || 'No bio'}</p>
      <div className="text-xs text-slate-600">
        {bookedCount > 0 && <div>{bookedCount} slot(s) already booked in selected range.</div>}
        {weeklyUnavailableCount > 0 && <div>{weeklyUnavailableCount} slot(s) not in coach weekly availability.</div>}
      </div>
      <button onClick={() => onReview(coach)} className="w-full mt-2 px-3 py-2 rounded-lg bg-gym-600 text-white text-sm font-semibold hover:bg-gym-700">
        Review Calendar Match
      </button>
    </article>
  )
}

export default CustomerCoachBookingPage
