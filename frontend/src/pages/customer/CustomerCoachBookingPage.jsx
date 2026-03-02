import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { coachApi } from '../../features/coach/api/coachApi'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'
import { membershipApi } from '../../features/membership/api/membershipApi'

const DAYS = [
  { id: 1, label: 'Monday', shortLabel: 'Mon' },
  { id: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { id: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { id: 4, label: 'Thursday', shortLabel: 'Thu' },
  { id: 5, label: 'Friday', shortLabel: 'Fri' },
  { id: 6, label: 'Saturday', shortLabel: 'Sat' },
  { id: 7, label: 'Sunday', shortLabel: 'Sun' },
]

function formatDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateValue(value) {
  if (!value) return null
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function addDays(date, amount) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

function getNextMondayOnOrAfter(date) {
  const currentDay = date.getDay()
  const daysUntilMonday = (8 - (currentDay === 0 ? 7 : currentDay)) % 7
  return addDays(date, daysUntilMonday)
}

function getMinimumBookingStartDate(baseDate = new Date()) {
  return getNextMondayOnOrAfter(addDays(baseDate, 7))
}

function getDayMeta(dayOfWeek) {
  return DAYS.find((day) => day.id === dayOfWeek) || null
}

function buildMonthGrid(monthCursor) {
  const monthStart = parseDateValue(monthCursor)
  if (!monthStart) return []
  const first = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1)
  const startOffset = (first.getDay() + 6) % 7
  const gridStart = addDays(first, -startOffset)

  return Array.from({ length: 35 }, (_, index) => {
    const current = addDays(gridStart, index)
    return {
      value: formatDateValue(current),
      dayNumber: current.getDate(),
      isCurrentMonth: current.getMonth() === first.getMonth(),
    }
  })
}

function shiftMonth(monthCursor, delta) {
  const current = parseDateValue(monthCursor)
  if (!current) return monthCursor
  return formatDateValue(new Date(current.getFullYear(), current.getMonth() + delta, 1))
}

function formatHumanDate(value) {
  const parsed = parseDateValue(value)
  if (!parsed) return 'Select date'
  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function buildCoachBookingMembershipGate(response) {
  const payload = response?.data ?? response ?? {}
  const membership = payload?.membership ?? {}
  const plan = membership?.plan ?? {}
  const status = String(membership?.status || '').toUpperCase()
  const allowsCoachBooking = Boolean(plan?.allowsCoachBooking)
  const eligible = status === 'ACTIVE' && allowsCoachBooking

  let reason = payload?.reason || ''
  if (!eligible) {
    if (!membership || Object.keys(membership).length === 0) {
      reason = 'You need an active Gym + Coach membership before you can book a coach.'
    } else if (status !== 'ACTIVE') {
      reason = 'Your membership is not active yet. Coach booking becomes available only when your Gym + Coach plan is active.'
    } else if (!allowsCoachBooking) {
      reason = 'Your current membership does not include coach booking. Upgrade to a Gym + Coach plan to continue.'
    }
  }

  return {
    eligible,
    membership,
    reason,
  }
}

function buildPtBookingGate(schedule) {
  const pendingRequests = Array.isArray(schedule?.pendingRequests) ? schedule.pendingRequests : []
  const items = Array.isArray(schedule?.items) ? schedule.items : []
  const todayValue = formatDateValue(new Date())

  if (pendingRequests.length > 0) {
    return {
      loaded: true,
      blocked: true,
      type: 'PENDING',
      reason: 'You already have a PT request pending coach approval. Please wait for the coach response before booking again.',
      pendingRequest: pendingRequests[0],
      activeSession: null,
    }
  }

  const futureSessions = items
    .filter((item) => String(item.status || '').toUpperCase() === 'SCHEDULED' && item.sessionDate && item.sessionDate >= todayValue)
    .sort((left, right) => {
      if (left.sessionDate !== right.sessionDate) {
        return String(left.sessionDate).localeCompare(String(right.sessionDate))
      }
      return Number(left.timeSlotId || 0) - Number(right.timeSlotId || 0)
    })

  if (futureSessions.length > 0) {
    return {
      loaded: true,
      blocked: true,
      type: 'ACTIVE',
      reason: 'You already have an active PT schedule. You cannot book another coach until your current PT arrangement ends.',
      pendingRequest: null,
      activeSession: futureSessions[0],
    }
  }

  return {
    loaded: true,
    blocked: false,
    type: '',
    reason: '',
    pendingRequest: null,
    activeSession: null,
  }
}

function CustomerCoachBookingPage() {
  const [activeTab, setActiveTab] = useState('match')
  const [timeSlots, setTimeSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    endDate: '',
  })
  const [requestedWeeklySlots, setRequestedWeeklySlots] = useState([])
  const [plannerModal, setPlannerModal] = useState({
    open: false,
    focusDay: 1,
  })
  const [datePicker, setDatePicker] = useState({
    field: '',
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
  const [hasPreviewedMatches, setHasPreviewedMatches] = useState(false)

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
  const [membershipGate, setMembershipGate] = useState({
    loading: true,
    eligible: false,
    membership: {},
    reason: '',
  })
  const [membershipBlockedModal, setMembershipBlockedModal] = useState(false)
  const [ptBookingGate, setPtBookingGate] = useState({
    loaded: false,
    blocked: false,
    type: '',
    reason: '',
    pendingRequest: null,
    activeSession: null,
  })
  const [ptBookingBlockedModal, setPtBookingBlockedModal] = useState(false)
  const [scheduleMonthCursor, setScheduleMonthCursor] = useState('')
  const [selectedScheduleDate, setSelectedScheduleDate] = useState('')
  const minimumBookingStartDate = useMemo(() => getMinimumBookingStartDate(new Date()), [])
  const minimumBookingStartValue = useMemo(() => formatDateValue(minimumBookingStartDate), [minimumBookingStartDate])

  useEffect(() => {
    void loadTimeSlots()
    void loadMembershipGate()
    void loadMySchedule({ silent: true })
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

  async function loadMySchedule(options = {}) {
    const { silent = false } = options
    try {
      if (!silent) {
        setLoading(true)
      }
      const response = await coachBookingApi.getMySchedule()
      const payload = response?.data ?? response
      const nextSchedule = {
        items: Array.isArray(payload?.items) ? payload.items : [],
        pendingRequests: Array.isArray(payload?.pendingRequests) ? payload.pendingRequests : [],
        deniedRequests: Array.isArray(payload?.deniedRequests) ? payload.deniedRequests : [],
      }
      setScheduleData(nextSchedule)
      setPtBookingGate(buildPtBookingGate(nextSchedule))
    } catch (err) {
      setPtBookingGate({
        loaded: true,
        blocked: false,
        type: '',
        reason: '',
        pendingRequest: null,
        activeSession: null,
      })
      if (!silent) {
        setError(err?.response?.data?.message || 'Cannot load your PT schedule')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const timeSlotById = useMemo(() => {
    const map = new Map()
    timeSlots.forEach((slot) => {
      map.set(slot.timeSlotId, slot)
    })
    return map
  }, [timeSlots])

  const weeklySlots = useMemo(
    () =>
      requestedWeeklySlots.slice().sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
        return a.timeSlotId - b.timeSlotId
      }),
    [requestedWeeklySlots],
  )

  const selectedSlotsByDay = useMemo(() => {
    const counts = new Map()
    weeklySlots.forEach((item) => {
      counts.set(item.dayOfWeek, (counts.get(item.dayOfWeek) || 0) + 1)
    })
    return counts
  }, [weeklySlots])

  const coachReviewRows = useMemo(() => {
    if (!coachReviewModal.coach) return []
    const unavailable = Array.isArray(coachReviewModal.coach.unavailableSlots) ? coachReviewModal.coach.unavailableSlots : []
    return weeklySlots.map((item) => {
      const blocked = unavailable.find((slot) => slot.dayOfWeek === item.dayOfWeek && slot.timeSlotId === item.timeSlotId)
      return {
        ...item,
        dayLabel: getDayMeta(item.dayOfWeek)?.label || `Day ${item.dayOfWeek}`,
        unavailable: Boolean(blocked),
        reason: blocked?.reason || null,
      }
    }).sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek
      return a.timeSlotId - b.timeSlotId
    })
  }, [coachReviewModal.coach, weeklySlots])

  const unresolvedReviewCount = useMemo(
    () => coachReviewRows.filter((item) => item.unavailable).length,
    [coachReviewRows],
  )
  const datePickerDays = useMemo(() => buildMonthGrid(datePicker.monthCursor), [datePicker.monthCursor])
  const currentMembershipPlan = membershipGate.membership?.plan ?? {}

  function requireCoachBookingMembership() {
    if (membershipGate.loading) {
      setError('Checking your membership status. Please wait a moment.')
      return false
    }
    if (!membershipGate.eligible) {
      setMembershipBlockedModal(true)
      return false
    }
    return true
  }

  function requireNoExistingPtBooking() {
    if (!ptBookingGate.loaded) {
      setError('Checking your current PT booking status. Please wait a moment.')
      return false
    }
    if (!ptBookingGate.blocked) {
      return true
    }
    setPtBookingBlockedModal(true)
    return false
  }

  function openPlannerModal() {
    if (!requireCoachBookingMembership()) {
      return
    }
    if (!requireNoExistingPtBooking()) {
      return
    }
    if (!form.endDate) {
      setForm((prev) => ({
        ...prev,
        endDate: formatDateValue(addDays(minimumBookingStartDate, 28)),
      }))
    }

    setPlannerModal({
      open: true,
      focusDay: weeklySlots[0]?.dayOfWeek || 1,
    })
  }

  function closePlannerModal() {
    closeDatePicker()
    setPlannerModal({ open: false, focusDay: 1 })
  }

  function openDatePicker(field) {
    const baseDate = parseDateValue(form[field]) || minimumBookingStartDate
    setDatePicker({
      field,
      monthCursor: formatDateValue(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)),
    })
  }

  function closeDatePicker() {
    setDatePicker({ field: '', monthCursor: '' })
  }

  function setPlannerRange(patch) {
    setHasPreviewedMatches(false)
    setForm((prev) => {
      const next = { ...prev, ...patch }
      if (next.endDate && next.endDate < minimumBookingStartValue) {
        return { ...next, endDate: minimumBookingStartValue }
      }
      return next
    })
  }

  function pickPlannerDate(field, value) {
    setPlannerRange({ [field]: value })
    closeDatePicker()
  }

  function selectPlannerDay(dayOfWeek) {
    setPlannerModal((prev) => ({ ...prev, focusDay: dayOfWeek }))
  }

  function isWeeklySlotSelected(dayOfWeek, timeSlotId) {
    return requestedWeeklySlots.some((slot) => slot.dayOfWeek === dayOfWeek && slot.timeSlotId === timeSlotId)
  }

  function toggleWeeklySlot(dayOfWeek, timeSlotId) {
    setHasPreviewedMatches(false)
    const exists = requestedWeeklySlots.some((slot) => slot.dayOfWeek === dayOfWeek && slot.timeSlotId === timeSlotId)
    if (exists) {
      setRequestedWeeklySlots((prev) => prev.filter((slot) => !(slot.dayOfWeek === dayOfWeek && slot.timeSlotId === timeSlotId)))
      return
    }
    setRequestedWeeklySlots((prev) => [...prev, { dayOfWeek, timeSlotId }])
  }

  function removeRequestedWeeklySlot(dayOfWeek, timeSlotId) {
    setHasPreviewedMatches(false)
    setRequestedWeeklySlots((prev) => prev.filter((slot) => !(slot.dayOfWeek === dayOfWeek && slot.timeSlotId === timeSlotId)))
  }

  const formatSlotLabel = useCallback((timeSlotId) => {
    const slot = timeSlotById.get(timeSlotId)
    if (!slot) return `Slot ${timeSlotId}`
    return `Slot ${slot.slotIndex} (${String(slot.startTime || '').slice(0, 5)}-${String(slot.endTime || '').slice(0, 5)})`
  }, [timeSlotById])

  const ptBookingGateSummary = useMemo(() => {
    if (ptBookingGate.type === 'PENDING' && ptBookingGate.pendingRequest) {
      return {
        title: ptBookingGate.pendingRequest.coachName || 'Pending PT request',
        detail: `Request window: ${ptBookingGate.pendingRequest.startDate || '-'} to ${ptBookingGate.pendingRequest.endDate || '-'}`,
        badge: 'Pending approval',
      }
    }
    if (ptBookingGate.type === 'ACTIVE' && ptBookingGate.activeSession) {
      return {
        title: ptBookingGate.activeSession.coachName || 'Active PT schedule',
        detail: `Next session: ${ptBookingGate.activeSession.sessionDate || '-'} | ${formatSlotLabel(ptBookingGate.activeSession.timeSlotId)}`,
        badge: 'Current PT active',
      }
    }
    return {
      title: 'No blocking PT request',
      detail: 'You can open the planner and preview coach matches.',
      badge: 'Available',
    }
  }, [ptBookingGate, formatSlotLabel])

  function getUnavailableReason(reason) {
    if (reason === 'BOOKED_IN_RANGE') return 'Already booked in selected date range'
    if (reason === 'NO_WEEKLY_AVAILABILITY') return 'Not in coach weekly availability'
    return 'Unavailable'
  }

  function getSessionStatusAppearance(status) {
    const normalized = String(status || '').toUpperCase()
    if (normalized === 'SCHEDULED') {
      return {
        badge: 'bg-emerald-500/15 text-emerald-700',
        card: 'border-emerald-200 bg-emerald-50/60',
        dot: 'bg-emerald-500',
      }
    }
    if (normalized === 'COMPLETED') {
      return {
        badge: 'bg-sky-500/15 text-sky-700',
        card: 'border-sky-200 bg-sky-50/60',
        dot: 'bg-sky-500',
      }
    }
    if (normalized === 'CANCELLED') {
      return {
        badge: 'bg-red-500/15 text-red-700',
        card: 'border-red-200 bg-red-50/50',
        dot: 'bg-red-500',
      }
    }
    return {
      badge: 'bg-slate-100 text-slate-700',
      card: 'border-slate-200 bg-white',
      dot: 'bg-slate-400',
    }
  }

  async function loadMembershipGate() {
    try {
      const response = await membershipApi.getCurrentMembership()
      const nextState = buildCoachBookingMembershipGate(response)
      setMembershipGate({
        loading: false,
        ...nextState,
      })
    } catch {
      setMembershipGate({
        loading: false,
        eligible: false,
        membership: {},
        reason: 'Cannot verify your membership right now. Please try again or open the membership page first.',
      })
    }
  }

  function openCoachReview(coach) {
    if (!form.endDate || weeklySlots.length === 0) {
      setError('Please set desired schedule first.')
      return
    }
    setCoachReviewModal({
      open: true,
      coach,
    })
  }

  async function previewMatches() {
    if (!requireCoachBookingMembership()) {
      return
    }
    if (!requireNoExistingPtBooking()) {
      return
    }
    if (!form.endDate || weeklySlots.length === 0) {
      setError('Please set the booking end date and pick at least one recurring slot in the planner.')
      return
    }
    if (form.endDate < minimumBookingStartValue) {
      setError('The booking end date must be on or after the earliest possible coaching start date.')
      return
    }

    try {
      setLoading(true)
      setError('')
      const response = await coachBookingApi.matchCoaches({
        endDate: form.endDate,
        slots: weeklySlots,
      })
      const payload = response?.data ?? response
      setMatches({
        fullMatches: Array.isArray(payload?.fullMatches) ? payload.fullMatches : [],
        partialMatches: Array.isArray(payload?.partialMatches) ? payload.partialMatches : [],
      })
      setHasPreviewedMatches(true)
    } catch (err) {
      setError(err?.response?.data?.message || 'Cannot preview coach matches')
    } finally {
      setLoading(false)
    }
  }

  async function savePlannerAndSearch() {
    if (!form.endDate || weeklySlots.length === 0) {
      setError('Please set the booking end date and pick at least one recurring slot in the planner.')
      return
    }

    closePlannerModal()
    await previewMatches()
  }

  async function requestCoach(coachId) {
    if (!requireNoExistingPtBooking()) {
      return
    }
    if (!form.endDate || weeklySlots.length === 0) {
      setError('Please set desired schedule first.')
      return
    }
    try {
      setLoading(true)
      setError('')
      await coachBookingApi.createRequest({
        coachId,
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
  const sessionsByDate = useMemo(() => {
    const grouped = new Map()
    scheduleData.items.forEach((session) => {
      const date = session.sessionDate
      if (!date) return
      const existing = grouped.get(date) || []
      existing.push(session)
      grouped.set(date, existing)
    })
    return grouped
  }, [scheduleData.items])
  const scheduleCalendarDays = useMemo(() => buildMonthGrid(scheduleMonthCursor), [scheduleMonthCursor])
  const selectedScheduleItems = useMemo(
    () => (selectedScheduleDate ? sessionsByDate.get(selectedScheduleDate) || [] : []),
    [selectedScheduleDate, sessionsByDate],
  )

  useEffect(() => {
    const firstSessionDate = scheduleData.items
      .map((item) => item.sessionDate)
      .filter(Boolean)
      .sort()[0]

    if (firstSessionDate) {
      const firstDate = parseDateValue(firstSessionDate)
      if (firstDate) {
        const firstMonth = formatDateValue(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1))
        setScheduleMonthCursor((prev) => prev || firstMonth)
      }
      setSelectedScheduleDate((prev) => prev || firstSessionDate)
      return
    }

    const currentMonth = formatDateValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    setScheduleMonthCursor((prev) => prev || currentMonth)
    setSelectedScheduleDate('')
  }, [scheduleData.items])

  return (
    <WorkspaceScaffold title="Coach Booking" subtitle="Pick recurring weekday slots first, then request matched coaches." links={customerNav}>
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
                  <p className="text-sm text-slate-600">Pick recurring weekday slots in the planner, then preview matched coaches.</p>
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
                  <span>Earliest possible start: <strong className="text-slate-800">{minimumBookingStartValue}</strong></span>
                  <span>Repeat end date: <strong className="text-slate-800">{form.endDate || '-'}</strong></span>
                  <span>Selected recurring slots: <strong className="text-slate-800">{weeklySlots.length}</strong></span>
                  <span>Selected weekdays: <strong className="text-slate-800">{selectedSlotsByDay.size}</strong></span>
                </div>
                <p className="text-sm text-slate-600">
                  Coaches have up to 1 week to approve. After approval, sessions start on the next Monday.
                </p>
                {weeklySlots.length === 0 && (
                  <p className="text-sm text-slate-500">No slots selected yet.</p>
                )}
                {weeklySlots.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {weeklySlots
                      .slice(0, 10)
                      .map((item) => (
                        <span key={`${item.dayOfWeek}-${item.timeSlotId}`} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700">
                          {getDayMeta(item.dayOfWeek)?.label || `Day ${item.dayOfWeek}`} | {formatSlotLabel(item.timeSlotId)}
                        </span>
                      ))}
                    {weeklySlots.length > 10 && (
                      <span className="text-xs text-slate-500 self-center">+{weeklySlots.length - 10} more</span>
                    )}
                  </div>
                )}
              </div>

              <button onClick={previewMatches} disabled={loading} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-700 disabled:opacity-50">
                {loading ? 'Loading...' : '2) Preview Matches'}
              </button>
            </div>

            {hasPreviewedMatches && (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4">
                  <h4 className="text-lg font-bold text-emerald-800">Fully Match</h4>
                  <p className="text-sm text-emerald-700">Coaches whose requested slots are all available through your selected booking end date.</p>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {matches.fullMatches.length === 0 && <p className="text-sm text-slate-600">No fully matched coach yet.</p>}
                    {matches.fullMatches.map((coach) => (
                      <CoachCard key={`full-${coach.coachId}`} coach={coach} onReview={openCoachReview} />
                    ))}
                  </div>
                </div>

                <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-4">
                  <h4 className="text-lg font-bold text-red-800">Partial Match</h4>
                  <p className="text-sm text-red-700">Coaches with overlap but some requested slots already occupied or unavailable before your selected booking end date.</p>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {matches.partialMatches.length === 0 && <p className="text-sm text-slate-600">No partial matched coach yet.</p>}
                    {matches.partialMatches.map((coach) => (
                      <CoachCard key={`partial-${coach.coachId}`} coach={coach} onReview={openCoachReview} />
                    ))}
                  </div>
                </div>
              </div>
            )}
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
                      <div className="font-semibold text-slate-800">{r.coachName}</div>
                      <div className="text-slate-600">Window: {r.startDate} to {r.endDate}</div>
                      <div className="text-xs text-amber-700">Sessions begin on the next Monday after coach approval.</div>
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

            {!loading && scheduleData.items.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center text-sm text-slate-500">
                No PT sessions yet.
              </div>
            ) : (
              <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Monthly view</p>
                      <h4 className="text-lg font-bold text-slate-900">Your coaching calendar</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setScheduleMonthCursor((prev) => shiftMonth(prev, -1))}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-gym-300 hover:bg-gym-50 hover:text-gym-700"
                      >
                        Prev
                      </button>
                      <div className="min-w-32 text-center text-sm font-bold text-slate-800">
                        {parseDateValue(scheduleMonthCursor)?.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setScheduleMonthCursor((prev) => shiftMonth(prev, 1))}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-gym-300 hover:bg-gym-50 hover:text-gym-700"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3">
                    <div className="grid grid-cols-7 gap-1">
                      {DAYS.map((day) => (
                        <div key={`schedule-header-${day.id}`} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {day.shortLabel}
                        </div>
                      ))}
                      {scheduleCalendarDays.map((day) => {
                        const daySessions = sessionsByDate.get(day.value) || []
                        const hasSessions = daySessions.length > 0
                        const isSelected = selectedScheduleDate === day.value
                        return (
                          <button
                            key={`schedule-day-${day.value}`}
                            type="button"
                            onClick={() => hasSessions && setSelectedScheduleDate(day.value)}
                            aria-label={hasSessions ? `${day.value}, ${daySessions.length} coaching slot${daySessions.length > 1 ? 's' : ''}` : day.value}
                            className={`min-h-24 rounded-2xl border p-2 text-left transition ${
                              isSelected
                                ? 'border-gym-600 bg-gym-50 shadow-sm'
                                : hasSessions
                                  ? 'border-emerald-200 bg-emerald-50/70 hover:border-gym-400 hover:bg-gym-50'
                                  : day.isCurrentMonth
                                    ? 'border-slate-200 bg-white text-slate-700'
                                    : 'border-slate-100 bg-slate-100 text-slate-300'
                            } ${hasSessions ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={`text-sm font-semibold ${day.isCurrentMonth ? 'text-slate-800' : 'text-slate-300'}`}>{day.dayNumber}</span>
                              {hasSessions && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.14)]" />}
                            </div>
                            {hasSessions && (
                              <div className="mt-6">
                                <div className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                  <span>{daySessions.length}</span>
                                  <span>{daySessions.length === 1 ? 'slot' : 'slots'}</span>
                                </div>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Selected date</p>
                  <h4 className="mt-2 text-lg font-bold text-slate-900">
                    {selectedScheduleDate ? formatHumanDate(selectedScheduleDate) : 'Pick a green-marked day'}
                  </h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Dates with coaching sessions are marked with a green signal in the calendar.
                  </p>

                  <div className="mt-4 space-y-3">
                    {selectedScheduleItems.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        No coaching sessions selected for this day.
                      </div>
                    )}
                    {selectedScheduleItems.map((s) => {
                      const appearance = getSessionStatusAppearance(s.status)
                      return (
                        <div key={s.ptSessionId} className={`rounded-2xl border p-4 space-y-3 ${appearance.card}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h5 className="font-bold text-slate-900">{s.coachName}</h5>
                              <p className="text-sm text-slate-600">
                                Slot {s.slotIndex} | {String(s.startTime || '').slice(0, 5)} - {String(s.endTime || '').slice(0, 5)}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${appearance.badge}`}>
                              <span className={`h-2 w-2 rounded-full ${appearance.dot}`} />
                              {s.status}
                            </span>
                          </div>
                          {s.reschedule?.status === 'PENDING' && <div className="text-xs text-amber-700">Reschedule pending coach approval</div>}
                          {s.reschedule?.status === 'DENIED' && <div className="text-xs text-red-700">Reschedule denied: {s.reschedule.note || 'No reason provided'}</div>}
                          {String(s.status || '').toUpperCase() === 'SCHEDULED' && (
                            <div className="flex gap-2">
                              <button onClick={() => cancelSession(s.ptSessionId)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200">Cancel</button>
                              <button onClick={() => setRescheduleModal({ open: true, session: s, sessionDate: '', timeSlotId: '', reason: '' })} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200">Reschedule</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </section>
            )}
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
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-visible rounded-2xl bg-white p-3 md:p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-lg font-bold text-slate-900">Set Desired PT Schedule</h4>
              <button
                onClick={closePlannerModal}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
              <div className="relative z-10 grid gap-3 xl:grid-cols-[0.72fr_0.92fr_1fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approval rule</p>
                    <div className="mt-1.5 text-sm font-semibold text-slate-900">{minimumBookingStartValue}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-500">Earliest possible start if the coach uses the full 1-week approval window.</div>
                  </div>
                </div>
                <div className="relative rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Repeat end date for booking</p>
                  <button
                    type="button"
                    aria-label="Repeat end date for booking"
                    onClick={() => openDatePicker('endDate')}
                    className="mt-2 flex w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-left transition hover:border-gym-400 hover:bg-gym-50"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{formatHumanDate(form.endDate)}</div>
                      <div className="text-[11px] text-slate-500">Choose when the recurring booking should stop</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">Edit</span>
                  </button>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    After approval, sessions start on the next Monday and continue until this end date.
                  </p>
                  {datePicker.field === 'endDate' && (
                    <DatePickerPopover
                      title="Repeat end date"
                      monthCursor={datePicker.monthCursor}
                      selectedValue={form.endDate}
                      minValue={minimumBookingStartValue}
                      onShiftMonth={(delta) => setDatePicker((prev) => ({ ...prev, monthCursor: shiftMonth(prev.monthCursor, delta) }))}
                      onSelect={(value) => pickPlannerDate('endDate', value)}
                      onClose={closeDatePicker}
                      days={datePickerDays}
                    />
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Planner guide</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    Choose a weekday from Monday to Sunday, then pick recurring time slots. Approved coaching always starts from the next Monday.
                  </p>
                </div>
              </div>

              <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-[1.7fr_0.9fr]">
                <div className="min-h-0 rounded-xl border border-slate-200 p-3">
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {DAYS.map((day) => (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => selectPlannerDay(day.id)}
                        className={`rounded-2xl border px-3 py-3 text-left transition ${
                          plannerModal.focusDay === day.id
                            ? 'border-gym-600 bg-gym-50 text-gym-900 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-gym-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-sm font-bold">{day.label}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {selectedSlotsByDay.get(day.id) || 0} slot(s) selected
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Selected weekday</p>
                    <p className="text-sm font-bold text-slate-900">{getDayMeta(plannerModal.focusDay)?.label || '-'}</p>
                  </div>

                  <div className="mt-3 min-h-0 flex-1 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Pick recurring slots</p>
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {timeSlots.map((slot) => {
                        const selected = isWeeklySlotSelected(plannerModal.focusDay, slot.timeSlotId)
                        return (
                          <button
                            key={`planner-slot-${plannerModal.focusDay}-${slot.timeSlotId}`}
                            onClick={() => toggleWeeklySlot(plannerModal.focusDay, slot.timeSlotId)}
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
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-600">Selected recurring slots</p>
                    <p className="mt-1 text-[11px] text-slate-500">Remove any slot directly from the list below.</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={closePlannerModal}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={savePlannerAndSearch}
                      disabled={loading || weeklySlots.length === 0}
                      className="px-4 py-2 rounded-xl bg-gym-600 text-sm font-semibold text-white hover:bg-gym-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? 'Searching...' : 'Save and Search'}
                    </button>
                  </div>
                </div>
                {weeklySlots.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No slots selected.</p>
                ) : (
                  <div className="mt-3 flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
                    {weeklySlots
                      .map((item) => (
                        <button
                          key={`picked-${item.dayOfWeek}-${item.timeSlotId}`}
                          onClick={() => removeRequestedWeeklySlot(item.dayOfWeek, item.timeSlotId)}
                          className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-red-300 hover:text-red-700"
                          title="Remove slot"
                        >
                          {getDayMeta(item.dayOfWeek)?.label || `Day ${item.dayOfWeek}`} | {formatSlotLabel(item.timeSlotId)}
                          <span className="font-bold">x</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
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
                <p className="text-sm text-slate-600">{coachReviewModal.coach.fullName}  |  {coachReviewModal.coach.email}</p>
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
                  key={`review-${row.dayOfWeek}-${row.timeSlotId}`}
                  className={`rounded-xl border p-3 flex items-center justify-between gap-3 ${row.unavailable ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}
                >
                  <div>
                    <div className={`text-sm font-semibold ${row.unavailable ? 'text-red-800' : 'text-emerald-800'}`}>
                      {row.dayLabel} | {formatSlotLabel(row.timeSlotId)}
                    </div>
                    <div className={`text-xs ${row.unavailable ? 'text-red-700' : 'text-emerald-700'}`}>
                      {row.unavailable ? getUnavailableReason(row.reason) : 'Matched'}
                    </div>
                  </div>
                  {row.unavailable ? (
                    <button
                      onClick={() => removeRequestedWeeklySlot(row.dayOfWeek, row.timeSlotId)}
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
                disabled={loading || unresolvedReviewCount > 0 || weeklySlots.length === 0}
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

      {ptBookingBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close PT booking popup"
              onClick={() => setPtBookingBlockedModal(false)}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={20} />
            </button>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">PT booking unavailable</p>
              <h4 className="text-2xl font-bold text-slate-900">You already have a PT booking in progress.</h4>
              <p className="text-sm leading-relaxed text-slate-600">
                {ptBookingGate.reason || 'You cannot start another PT booking while a request is pending or your current PT schedule is still active.'}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current PT status</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{ptBookingGateSummary.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{ptBookingGateSummary.detail}</p>
                </div>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  {ptBookingGateSummary.badge}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setPtBookingBlockedModal(false)
                  setActiveTab('schedule')
                }}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open My PT Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {membershipBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              aria-label="Close membership popup"
              onClick={() => setMembershipBlockedModal(false)}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={20} />
            </button>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">Membership required</p>
              <h4 className="text-2xl font-bold text-slate-900">Coach booking is locked for your current membership.</h4>
              <p className="text-sm leading-relaxed text-slate-600">
                {membershipGate.reason || 'You need an active Gym + Coach membership before using the schedule planner or previewing coach matches.'}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current membership</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{currentMembershipPlan?.name || 'No active Gym + Coach membership'}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Status: <span className="font-semibold text-slate-700">{membershipGate.membership?.status || 'NONE'}</span>
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${membershipGate.eligible ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {membershipGate.eligible ? 'Eligible' : 'Not eligible'}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <Link
                to="/customer/current-membership"
                onClick={() => setMembershipBlockedModal(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                View my membership
              </Link>
              <Link
                to="/customer/membership"
                onClick={() => setMembershipBlockedModal(false)}
                className="rounded-full bg-gym-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gym-700"
              >
                Buy Gym + Coach plan
              </Link>
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
    <article className={`rounded-xl border p-4 space-y-2 ${isFullMatch ? 'border-emerald-200 bg-white' : 'border-red-200 bg-red-50/35'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="font-bold text-slate-900">{coach.fullName}</h5>
          <p className="text-xs text-slate-500">{coach.email}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isFullMatch ? 'bg-emerald-500/15 text-emerald-700' : 'bg-red-500/15 text-red-700'}`}>
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

function DatePickerPopover({ title, monthCursor, selectedValue, minValue, onShiftMonth, onSelect, onClose, days }) {
  const monthDate = parseDateValue(monthCursor)
  const monthTitle = monthDate
    ? monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : ''
  const selectedLabel = formatHumanDate(selectedValue)

  return (
    <div className="absolute left-1/2 top-2 z-30 w-[min(26rem,calc(100vw-3rem))] -translate-x-1/2 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <div className="bg-[radial-gradient(circle_at_top_left,_rgba(22,163,74,0.14),_transparent_55%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.94))] px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="text-xs text-slate-200">Pick a date inside your recurring booking window.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Close
          </button>
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">Selected</span>
          <span className="text-sm font-semibold">{selectedLabel}</span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onShiftMonth(-1)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-gym-300 hover:bg-gym-50 hover:text-gym-700"
          >
            Prev
          </button>
          <div className="text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Month</div>
            <div className="text-sm font-bold text-slate-800">{monthTitle}</div>
          </div>
          <button
            type="button"
            onClick={() => onShiftMonth(1)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-gym-300 hover:bg-gym-50 hover:text-gym-700"
          >
            Next
          </button>
        </div>

        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((day) => (
              <div key={`header-${day.id}`} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {day.shortLabel}
              </div>
            ))}
            {days.map((day) => {
              const isDisabled = Boolean(minValue) && day.value < minValue
              const isSelected = selectedValue === day.value
              return (
                <button
                  key={day.value}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => onSelect(day.value)}
                  className={`aspect-square rounded-2xl border text-sm font-semibold transition ${
                    isSelected
                      ? 'border-gym-600 bg-gym-600 text-white shadow-sm shadow-gym-600/30'
                      : day.isCurrentMonth
                        ? 'border-slate-200 bg-white text-slate-700 hover:border-gym-300 hover:bg-gym-50'
                        : 'border-slate-100 bg-slate-100 text-slate-300'
                  } ${isDisabled ? 'cursor-not-allowed opacity-35' : ''}`}
                >
                  {day.dayNumber}
                </button>
              )
            })}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          {minValue ? `Dates before ${formatHumanDate(minValue)} are disabled.` : 'You can choose any day to start the recurring booking.'}
        </p>
      </div>
    </div>
  )
}

export default CustomerCoachBookingPage

