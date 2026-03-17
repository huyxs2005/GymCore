import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import WeekdayDropdown from '../../components/common/WeekdayDropdown'
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

function formatDateTimeLabel(value) {
  if (!value) return 'No update yet'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return String(value)
  }
  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildCoachBookingMembershipGate(response) {
  const payload = response?.data ?? response ?? {}
  const membership = payload?.membership ?? {}
  const plan = membership?.plan ?? {}
  const status = String(membership?.status || '').toUpperCase()
  const planType = String(plan?.planType || '').toUpperCase()
  const allowsCoachBooking = Boolean(plan?.allowsCoachBooking)
  const eligible = status === 'ACTIVE' && allowsCoachBooking && planType === 'GYM_PLUS_COACH'

  let reason = payload?.reason || ''
  if (!eligible) {
    if (!membership || Object.keys(membership).length === 0) {
      reason = 'You need an active Gym + Coach membership before you can book a coach.'
    } else if (status !== 'ACTIVE') {
      reason = 'Your membership is not active yet. Coach booking becomes available only when your Gym + Coach plan is active.'
    } else if (!allowsCoachBooking || planType !== 'GYM_PLUS_COACH') {
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
  const bookingSectionRef = useRef(null)

  const [form, setForm] = useState({
    endDate: '',
  })
  const [requestedWeeklySlots, setRequestedWeeklySlots] = useState([])
  const [plannerModal, setPlannerModal] = useState({
    open: false,
    focusDay: 1,
  })
  const [selectedWeeklySummaryDay, setSelectedWeeklySummaryDay] = useState(1)
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
    activePhase: null,
    dashboard: {},
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
  const [seriesModal, setSeriesModal] = useState({
    open: false,
    focusDay: 1,
    cutoverDate: '',
    slots: [],
  })
  const [cancelModal, setCancelModal] = useState({
    open: false,
    session: null,
    reason: '',
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
        activePhase: payload?.activePhase ?? null,
        dashboard: payload?.dashboard ?? {},
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

  const groupedWeeklySlots = useMemo(() => {
    return DAYS.map((day) => ({
      ...day,
      slots: weeklySlots.filter((item) => item.dayOfWeek === day.id),
    })).filter((day) => day.slots.length > 0)
  }, [weeklySlots])

  const selectedWeeklySummaryGroup = useMemo(() => {
    return groupedWeeklySlots.find((day) => day.id === selectedWeeklySummaryDay) || groupedWeeklySlots[0] || null
  }, [groupedWeeklySlots, selectedWeeklySummaryDay])

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
      detail: 'You can open the planner and run a real coach match preview for your recurring PT schedule.',
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

  function openSeriesModal() {
    const templateSlots = Array.isArray(scheduleData.activePhase?.templateSlots)
      ? scheduleData.activePhase.templateSlots.map((slot) => ({
          dayOfWeek: Number(slot.dayOfWeek),
          timeSlotId: Number(slot.timeSlotId),
        }))
      : []
    const nextSessionDate = scheduleData.dashboard?.nextSession?.sessionDate
    setSeriesModal({
      open: true,
      focusDay: templateSlots[0]?.dayOfWeek || 1,
      cutoverDate: nextSessionDate || formatDateValue(addDays(new Date(), 1)),
      slots: templateSlots,
    })
  }

  function closeSeriesModal() {
    setSeriesModal({
      open: false,
      focusDay: 1,
      cutoverDate: '',
      slots: [],
    })
  }

  function isSeriesSlotSelected(dayOfWeek, timeSlotId) {
    return seriesModal.slots.some((slot) => slot.dayOfWeek === dayOfWeek && slot.timeSlotId === timeSlotId)
  }

  function toggleSeriesSlot(dayOfWeek, timeSlotId) {
    setSeriesModal((prev) => {
      const exists = prev.slots.some((slot) => slot.dayOfWeek === dayOfWeek && slot.timeSlotId === timeSlotId)
      if (exists) {
        return {
          ...prev,
          slots: prev.slots.filter((slot) => !(slot.dayOfWeek === dayOfWeek && slot.timeSlotId === timeSlotId)),
        }
      }
      return {
        ...prev,
        slots: [...prev.slots, { dayOfWeek, timeSlotId }],
      }
    })
  }

  async function submitSeriesChange() {
    if (!seriesModal.cutoverDate || seriesModal.slots.length === 0) {
      setError('Please choose a future cutover date and at least one recurring slot.')
      return
    }
    try {
      setLoading(true)
      const response = await coachBookingApi.rescheduleSeries({
        cutoverDate: seriesModal.cutoverDate,
        slots: seriesModal.slots
          .slice()
          .sort((left, right) => {
            if (left.dayOfWeek !== right.dayOfWeek) return left.dayOfWeek - right.dayOfWeek
            return left.timeSlotId - right.timeSlotId
          }),
      })
      closeSeriesModal()
      setMessage(response?.data?.message || response?.message || 'Recurring PT series updated successfully.')
      await loadMySchedule()
    } catch (err) {
      setError(err?.response?.data?.message || 'Cannot update the recurring PT plan')
    } finally {
      setLoading(false)
    }
  }

  async function handleReplacementDecision(sessionId, decision) {
    try {
      setLoading(true)
      const response = await coachBookingApi.respondToReplacementOffer(sessionId, { decision })
      setMessage(response?.data?.message || response?.message || 'Replacement coach decision saved successfully.')
      await loadMySchedule()
    } catch (err) {
      setError(err?.response?.data?.message || 'Cannot save replacement coach decision')
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

  function openCancelModal(session) {
    setCancelModal({
      open: true,
      session,
      reason: '',
    })
  }

  function closeCancelModal() {
    setCancelModal({
      open: false,
      session: null,
      reason: '',
    })
  }

  function openRescheduleModal(session) {
    setRescheduleModal({
      open: true,
      session,
      sessionDate: '',
      timeSlotId: '',
      reason: '',
    })
  }

  function closeRescheduleModal() {
    setRescheduleModal({
      open: false,
      session: null,
      sessionDate: '',
      timeSlotId: '',
      reason: '',
    })
  }

  async function confirmCancelSession() {
    const sessionId = cancelModal.session?.ptSessionId
    if (!sessionId) return
    try {
      setLoading(true)
      await coachBookingApi.cancelSession(sessionId, {
        cancelReason: cancelModal.reason.trim() || 'Cancelled by customer',
      })
      closeCancelModal()
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
      closeRescheduleModal()
      setMessage('PT session updated immediately.')
      await loadMySchedule()
    } catch (err) {
      setError(err?.response?.data?.message || 'Cannot update this PT session')
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
  const activePhase = scheduleData.activePhase
  const ptDashboard = scheduleData.dashboard ?? {}
  const weeklyDashboardSchedule = Array.isArray(ptDashboard.weeklySchedule) ? ptDashboard.weeklySchedule : []
  const nextSession = ptDashboard.nextSession ?? {}
  const latestNote = ptDashboard.latestNote ?? {}
  const latestProgress = ptDashboard.latestProgress ?? {}
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
  const groupedSeriesSlots = useMemo(() => {
    return DAYS.map((day) => ({
      ...day,
      slots: seriesModal.slots
        .filter((slot) => slot.dayOfWeek === day.id)
        .sort((left, right) => left.timeSlotId - right.timeSlotId),
    })).filter((day) => day.slots.length > 0)
  }, [seriesModal.slots])
  const dashboardTemplateSlots = useMemo(() => {
    return Array.isArray(activePhase?.templateSlots)
      ? activePhase.templateSlots.slice().sort((left, right) => {
          if (left.dayOfWeek !== right.dayOfWeek) return left.dayOfWeek - right.dayOfWeek
          return Number(left.timeSlotId || 0) - Number(right.timeSlotId || 0)
        })
      : []
  }, [activePhase])
  const coachPreviewCount = matches.fullMatches.length + matches.partialMatches.length
  const plannerStatusSummary = useMemo(
    () => [
      {
        id: 'window',
        label: 'Booking window',
        value: form.endDate || minimumBookingStartValue,
        detail: form.endDate ? 'Recurring plan end date selected' : 'Earliest eligible PT start is applied as the baseline',
      },
      {
        id: 'slots',
        label: 'Recurring slots',
        value: weeklySlots.length,
        detail: weeklySlots.length ? `${selectedSlotsByDay.size} weekday(s) currently selected` : 'Open the planner to build your recurring week',
      },
      {
        id: 'preview',
        label: 'Coach preview',
        value: coachPreviewCount,
        detail: hasPreviewedMatches ? 'Real PT match preview ready below' : 'Run Preview Matches after saving your recurring plan',
      },
    ],
    [coachPreviewCount, form.endDate, hasPreviewedMatches, minimumBookingStartValue, selectedSlotsByDay.size, weeklySlots.length],
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

  useEffect(() => {
    if (groupedWeeklySlots.length === 0) {
      return
    }
    if (!groupedWeeklySlots.some((day) => day.id === selectedWeeklySummaryDay)) {
      setSelectedWeeklySummaryDay(groupedWeeklySlots[0].id)
    }
  }, [groupedWeeklySlots, selectedWeeklySummaryDay])

  return (
    <WorkspaceScaffold title="Coach Booking" subtitle="Pick recurring weekday slots first, then request matched coaches." links={customerNav}>
      <div className="space-y-6 pb-10">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_38%),linear-gradient(135deg,_rgba(10,10,15,0.98),_rgba(18,18,26,0.94)_55%,_rgba(38,25,6,0.92))] p-6 text-white shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">PT Dashboard</p>
              <h3 className="text-3xl font-bold">{
                activePhase ? 'Active PT phase' : 'Plan your next coaching phase'
              }</h3>
              {activePhase ? (
                <p className="text-sm leading-relaxed text-slate-200">
                  Primary coach <strong className="text-white">{activePhase.coachName}</strong> • {activePhase.startDate} to {activePhase.endDate}
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-slate-200">
                  Review membership eligibility, keep your weekly PT context visible, and jump straight into booking when you are ready.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {activePhase ? (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('schedule')}
                    className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Open My PT Schedule
                  </button>
                  <button
                    type="button"
                    onClick={openSeriesModal}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                  >
                    Change recurring plan
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('match')
                    bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  Book PT Plan
                </button>
              )}
            </div>
          </div>

          {activePhase ? (
            <div className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Next session</p>
                  <p className="mt-2 text-lg font-bold text-white">{nextSession.sessionDate || 'No future session'}</p>
                  <p className="mt-1 text-sm text-slate-200">
                    {nextSession.timeSlotId ? formatSlotLabel(nextSession.timeSlotId) : 'Wait for a confirmed schedule.'}
                  </p>
                  <p className="mt-2 text-xs text-slate-300">{nextSession.coachName || activePhase.coachName || 'Primary coach'}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Latest coach note</p>
                  <p className="mt-2 text-sm font-semibold text-white">{latestNote.noteContent || 'No coaching note recorded yet.'}</p>
                  <p className="mt-2 text-xs text-slate-300">{formatDateTimeLabel(latestNote.updatedAt || latestNote.createdAt)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Latest progress</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {latestProgress.weightKg ? `${latestProgress.weightKg} kg` : 'No progress update recorded yet.'}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    {latestProgress.heightCm ? `${latestProgress.heightCm} cm` : 'Height pending'} • {latestProgress.bmi ? `BMI ${latestProgress.bmi}` : 'BMI pending'}
                  </p>
                  <p className="mt-2 text-xs text-slate-300">{formatDateTimeLabel(latestProgress.recordedAt)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">This week</p>
                    <p className="mt-1 text-lg font-bold text-white">
                      {ptDashboard.completedSessions || 0} completed / {ptDashboard.remainingSessions || 0} remaining PT sessions
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                    {activePhase.bookingMode || 'REQUEST'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  {weeklyDashboardSchedule.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/20 bg-black/10 p-4 text-sm text-slate-300">
                      No PT sessions are scheduled for the current week yet.
                    </div>
                  )}
                  {weeklyDashboardSchedule.map((session) => (
                    <div key={`dashboard-session-${session.ptSessionId}`} className="rounded-2xl border border-white/10 bg-black/10 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{getDayMeta(session.dayOfWeek)?.label || session.sessionDate}</p>
                          <p className="mt-1 text-xs text-slate-300">{session.sessionDate} • {formatSlotLabel(session.timeSlotId)}</p>
                        </div>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200">{session.status}</span>
                      </div>
                      {session.replacementOffer?.status === 'PENDING_CUSTOMER' && (
                        <div className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4">
                          <p className="text-sm font-bold text-amber-100">Replacement coach offer</p>
                          <p className="mt-1 text-sm text-amber-50">
                            {session.replacementOffer.replacementCoachName} can cover this exception session for {session.replacementOffer.originalCoachName}.
                          </p>
                          {session.replacementOffer.note ? (
                            <p className="mt-2 text-xs text-amber-100/90">Note: {session.replacementOffer.note}</p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleReplacementDecision(session.ptSessionId, 'ACCEPT')}
                              disabled={loading}
                              className="rounded-full bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                            >
                              Accept replacement
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReplacementDecision(session.ptSessionId, 'DECLINE')}
                              disabled={loading}
                              className="rounded-full border border-amber-100/30 bg-transparent px-3 py-1.5 text-xs font-semibold text-amber-50 transition hover:bg-white/10 disabled:opacity-50"
                            >
                              Decline replacement
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {dashboardTemplateSlots.length > 0 && (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Recurring template</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {dashboardTemplateSlots.map((slot) => (
                        <span key={`template-slot-${slot.dayOfWeek}-${slot.timeSlotId}`} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100">
                          {getDayMeta(slot.dayOfWeek)?.label || `Day ${slot.dayOfWeek}`} • {formatSlotLabel(slot.timeSlotId)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Membership</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {membershipGate.eligible ? 'Gym + Coach active' : (membershipGate.reason || 'Needs Gym + Coach plan')}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Current PT state</p>
                <p className="mt-2 text-sm font-semibold text-white">{ptBookingGateSummary.title}</p>
                <p className="mt-1 text-xs text-slate-300">{ptBookingGateSummary.detail}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Next step</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {membershipGate.eligible && !ptBookingGate.blocked
                    ? 'Open the planner and run a real coach match preview.'
                    : 'Resolve the blocker, then book your recurring PT plan.'}
                </p>
              </div>
            </div>
          )}
        </section>

        <section ref={bookingSectionRef} className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-ambient-sm backdrop-blur-md">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex border-b border-white/10 pb-2">
              <nav className="-mb-[9px] flex space-x-6" aria-label="Tabs">
                <button onClick={() => setActiveTab('match')} className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-bold transition-colors ${activeTab === 'match' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:border-white/20 hover:text-slate-200'}`}>Match Coaches</button>
                <button onClick={() => setActiveTab('schedule')} className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-bold transition-colors ${activeTab === 'schedule' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:border-white/20 hover:text-slate-200'}`}>My PT Schedule</button>
                <button onClick={() => setActiveTab('feedback')} className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-bold transition-colors ${activeTab === 'feedback' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:border-white/20 hover:text-slate-200'}`}>Feedback Coach</button>
              </nav>
            </div>
            <div className="grid gap-3 md:grid-cols-3 xl:min-w-[52rem]">
              {plannerStatusSummary.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-lg font-bold text-white">{item.value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {(error || message) && (
          <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
            <span>{error || message}</span>
            <button onClick={() => { setError(''); setMessage('') }} className="font-bold">x</button>
          </div>
        )}

        {activeTab === 'match' && (
          <div className="space-y-6 mt-6">
            <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="gc-card bg-white/5 border-white/10 shadow-ambient-sm rounded-[2rem] p-6 space-y-4 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black text-white">Your desired PT schedule</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      Pick your preferred weekly breakdown, then we will match you with available coaches.
                    </p>
                  </div>
                  {ptBookingGate.blocked ? (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-sm backdrop-blur-sm">
                      <p className="font-bold">{ptBookingGateSummary.badge}</p>
                      <p className="mt-1 text-xs font-semibold text-amber-200/80">{ptBookingGate.reason}</p>
                    </div>
                  ) : (
                    <button
                      onClick={openPlannerModal}
                      className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow hover:bg-emerald-400 transition"
                    >
                      {weeklySlots.length > 0 ? 'Edit desired schedule' : 'Setup desired schedule'}
                    </button>
                  )}
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 space-y-2">
                  <div className="flex flex-wrap gap-5 text-xs text-slate-300">
                    <span>Earliest possible start: <strong className="text-white">{minimumBookingStartValue}</strong></span>
                    <span>Repeat end date: <strong className="text-white">{form.endDate || '-'}</strong></span>
                    <span>Selected recurring slots: <strong className="text-white">{weeklySlots.length}</strong></span>
                    <span>Selected weekdays: <strong className="text-white">{selectedSlotsByDay.size}</strong></span>
                  </div>
                  <p className="text-sm text-slate-400">
                    The booking preview follows the live PT rule: coaches can take up to 1 week to approve, and approved schedules begin on the next eligible Monday.
                  </p>
                  {weeklySlots.length === 0 && (
                    <p className="text-sm text-slate-500">No recurring slots selected yet.</p>
                  )}
                  {weeklySlots.length > 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 mt-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <WeekdayDropdown
                            id="customer-summary-day"
                            label="Weekday"
                            value={selectedWeeklySummaryGroup?.id || ''}
                            onChange={(nextValue) => setSelectedWeeklySummaryDay(Number(nextValue))}
                            options={groupedWeeklySlots.map((day) => ({
                              value: day.id,
                              label: day.label,
                              meta: `${day.slots.length} recurring slot(s) selected`,
                              badge: `${day.slots.length} slot${day.slots.length > 1 ? 's' : ''}`,
                            }))}
                            summaryText="Browse each weekday without expanding all selected slots."
                          />
                        </div>
                        {selectedWeeklySummaryGroup ? (
                          <div className="rounded-full bg-white/10 border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                            {selectedWeeklySummaryGroup.slots.length} slot(s) selected for {selectedWeeklySummaryGroup.label}
                          </div>
                        ) : null}
                      </div>
                      {selectedWeeklySummaryGroup ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {selectedWeeklySummaryGroup.slots.map((item) => (
                            <span key={`${item.dayOfWeek}-${item.timeSlotId}`} className="inline-flex w-full items-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-slate-200">
                              {formatSlotLabel(item.timeSlotId)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>

                <button onClick={previewMatches} disabled={loading} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-900 font-bold hover:bg-white shadow-sm disabled:opacity-50 transition">
                  {loading ? 'Loading...' : '2) Preview Matches'}
                </button>
              </div>

      <aside className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,_rgba(26,26,36,0.94),_rgba(18,18,26,0.84))] p-5 shadow-ambient-sm backdrop-blur-md">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Booking guide</p>
                <h4 className="mt-3 text-xl font-bold text-slate-900">What happens next</h4>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Step 1</p>
                    <p className="mt-1 text-sm text-slate-600">Open the planner, pick weekdays, and set the recurring slots you want the coach to cover each week.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Step 2</p>
                    <p className="mt-1 text-sm text-slate-600">Preview coach matches to see which coaches fully or partially fit the exact recurring template you saved.</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Step 3</p>
                    <p className="mt-1 text-sm text-slate-600">Review a coach calendar match, remove any unresolved conflicts, and then send the booking request.</p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">Current blocker check</p>
                  <p className="mt-2 text-sm text-amber-800">{membershipGate.eligible ? ptBookingGateSummary.detail : membershipGate.reason}</p>
                </div>
              </aside>
            </div>

            {hasPreviewedMatches && (
              <div className="space-y-6 mt-6">
                <h3 className="text-xl font-black text-white border-b border-white/10 pb-3">Available Coaches</h3>
                {matches.fullMatches.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-400">100% Match</h4>
                    <p className="text-sm text-slate-400">These coaches can cover every requested recurring slot through your selected booking end date.</p>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {matches.fullMatches.map((coach) => (
                        <CoachCard key={`full-${coach.coachId}`} coach={coach} onReview={openCoachReview} />
                      ))}
                    </div>
                  </div>
                )}
                {matches.partialMatches.length > 0 && (
                  <div className="space-y-4 mt-8">
                    <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-amber-500">Partial Match</h4>
                    <p className="text-sm leading-6 text-slate-400">These coaches fit part of the schedule, but some requested slots still conflict with weekly availability or existing bookings.</p>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {matches.partialMatches.map((coach) => (
                        <CoachCard key={`partial-${coach.coachId}`} coach={coach} onReview={openCoachReview} />
                      ))}
                    </div>
                  </div>
                )}
                {matches.fullMatches.length === 0 && matches.partialMatches.length === 0 && (
                  <div className="rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md p-8 text-center text-slate-400 shadow-ambient-sm">
                    <p className="text-lg font-bold text-white">No coaches match right now</p>
                    <p className="mt-2 font-medium">Try adjusting your times or end date.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white border-b border-white/10 pb-3">My PT Schedule</h3>

            {scheduleData.pendingRequests.length > 0 && (
              <section className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 backdrop-blur-sm">
                <h4 className="font-bold text-amber-500 mb-2">Pending Requests</h4>
                <div className="space-y-2">
                  {scheduleData.pendingRequests.map((r) => (
                    <div key={r.ptRequestId} className="bg-white/5 rounded-xl border border-amber-500/30 px-3 py-2 text-sm shadow-sm backdrop-blur-md">
                      <div className="font-semibold text-white">{r.coachName}</div>
                      <div className="text-slate-300">Window: {r.startDate} to {r.endDate}</div>
                      <div className="text-xs text-amber-300/80 mt-1">If approved, this recurring PT plan starts from the next eligible Monday.</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {scheduleData.deniedRequests.length > 0 && (
              <section className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 backdrop-blur-sm">
                <h4 className="font-bold text-rose-400 mb-2">Denied Requests</h4>
                <div className="space-y-2">
                  {scheduleData.deniedRequests.map((r) => (
                    <div key={r.ptRequestId} className="bg-white/5 rounded-xl border border-red-500/30 px-3 py-2 text-sm shadow-sm backdrop-blur-md">
                      <div className="font-semibold text-white">{r.coachName}: {r.startDate} to {r.endDate}</div>
                      <div className="text-rose-300 mt-1">Reason: {r.denyReason || 'No reason provided'}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!loading && scheduleData.items.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-white/20 bg-white/5 p-12 text-center text-sm text-slate-400 backdrop-blur-sm">
                No PT sessions yet.
              </div>
            ) : (
              <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                <div className="gc-card bg-white/5 border-white/10 rounded-[2rem] p-6 shadow-ambient-sm backdrop-blur-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Monthly view</p>
                      <h4 className="text-xl font-black text-white mt-1">Your coaching calendar</h4>
                    </div>
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/10 backdrop-blur-sm">
                      <button
                        type="button"
                        onClick={() => setScheduleMonthCursor((prev) => shiftMonth(prev, -1))}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                      >
                        Prev
                      </button>
                      <div className="min-w-[140px] text-center text-sm font-black text-white px-2">
                        {parseDateValue(scheduleMonthCursor)?.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setScheduleMonthCursor((prev) => shiftMonth(prev, 1))}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-3 backdrop-blur-sm">
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
                                ? 'border-emerald-500 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.3)] text-emerald-100'
                                : hasSessions
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400 hover:bg-emerald-500/20'
                                  : day.isCurrentMonth
                                    ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                                    : 'border-white/5 bg-transparent text-slate-600'
                            } ${hasSessions ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={`text-sm font-semibold ${day.isCurrentMonth ? (isSelected ? 'text-emerald-100' : 'text-slate-200') : 'text-slate-600'}`}>{day.dayNumber}</span>
                              {hasSessions && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
                            </div>
                            {hasSessions && (
                              <div className="mt-6">
                                <div className="inline-flex items-center gap-1 rounded-full bg-black/30 border border-emerald-500/30 px-2 py-1 text-[11px] font-bold text-emerald-300">
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

                <div className="gc-card bg-white/5 border-white/10 rounded-[2rem] p-6 shadow-ambient-sm backdrop-blur-md">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Selected date</p>
                  <h4 className="mt-2 text-xl font-bold text-white">
                    {selectedScheduleDate ? formatHumanDate(selectedScheduleDate) : 'Pick a green-marked day'}
                  </h4>
                  <p className="mt-1 text-sm text-slate-400">
                    Dates with coaching sessions are marked with a green signal in the calendar.
                  </p>

                  <div className="mt-4 space-y-3">
                    {selectedScheduleItems.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-white/20 bg-black/20 p-4 text-sm text-slate-400">
                        No coaching sessions selected for this day.
                      </div>
                    )}
                    {selectedScheduleItems.map((s) => {
                      const appearance = getSessionStatusAppearance(s.status)
                      return (
                        <div key={s.ptSessionId} className={`rounded-2xl border p-4 space-y-3 ${appearance.card}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h5 className="font-bold text-white">{s.coachName}</h5>
                              <p className="text-sm text-slate-300">
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
                          {String(s.status || '').toUpperCase() === 'CANCELLED' && s.cancelReason && (
                            <div className="text-xs text-red-700">Cancellation reason: {s.cancelReason}</div>
                          )}
                          {s.replacementOffer?.status === 'PENDING_CUSTOMER' && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                              <p className="text-sm font-bold text-amber-900">Replacement coach offer</p>
                              <p className="mt-1 text-sm text-amber-800">
                                {s.replacementOffer.replacementCoachName} can cover this session for {s.replacementOffer.originalCoachName}.
                              </p>
                              {s.replacementOffer.note ? (
                                <p className="mt-2 text-xs text-amber-700">Note: {s.replacementOffer.note}</p>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleReplacementDecision(s.ptSessionId, 'ACCEPT')}
                                  disabled={loading}
                                  className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                  Accept replacement
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReplacementDecision(s.ptSessionId, 'DECLINE')}
                                  disabled={loading}
                                  className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                                >
                                  Decline replacement
                                </button>
                              </div>
                            </div>
                          )}
                          {String(s.status || '').toUpperCase() === 'SCHEDULED' && (
                            <div className="flex gap-2">
                              <button onClick={() => openCancelModal(s)} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200">Cancel</button>
                              <button
                                onClick={() => openRescheduleModal(s)}
                                disabled={s.replacementOffer?.status === 'PENDING_CUSTOMER'}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Reschedule
                              </button>
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
          <div className="space-y-6">
            <h3 className="text-xl font-black text-white border-b border-white/10 pb-3">Feedback Coach</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedSessions.map((s) => (
                <div key={s.ptSessionId} className="gc-card bg-white/5 border-white/10 rounded-[2rem] p-5 shadow-ambient-sm backdrop-blur-md flex flex-col justify-between">
                  <div>
                    <div className="font-black text-white text-lg mb-1">{s.coachName}</div>
                    <div className="text-sm font-medium text-slate-300">{formatHumanDate(s.sessionDate)} | Slot {s.slotIndex}</div>
                  </div>
                  <button onClick={() => setFeedbackModal({ open: true, session: s, rating: 0, comment: '' })} className="mt-5 w-full px-4 py-2.5 text-sm font-bold rounded-2xl bg-emerald-500 text-slate-950 shadow hover:bg-emerald-400 transition">Rate this session</button>
                </div>
              ))}
              {!loading && completedSessions.length === 0 && <div className="col-span-full rounded-[2rem] border border-dashed border-white/20 bg-white/5 p-12 text-center text-sm text-slate-400 backdrop-blur-sm">No completed sessions to rate.</div>}
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
                  <div className="mt-1 text-[11px] leading-relaxed text-slate-500">Earliest eligible start date when the coach uses the full 1-week approval window.</div>
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
                    Once approved, the recurring PT plan starts from the next eligible Monday and continues until this end date.
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
                    Choose weekdays and recurring time slots first. The match preview and the final booking request both use this exact schedule template.
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
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <WeekdayDropdown
                          id="planner-summary-day"
                          label="Weekday"
                          value={selectedWeeklySummaryGroup?.id || ''}
                          onChange={(nextValue) => setSelectedWeeklySummaryDay(Number(nextValue))}
                          options={groupedWeeklySlots.map((day) => ({
                            value: day.id,
                            label: day.label,
                            meta: `${day.slots.length} slot(s) ready to keep or remove`,
                            badge: `${day.slots.length} slot${day.slots.length > 1 ? 's' : ''}`,
                          }))}
                          summaryText="Switch weekdays and remove slots directly from this planner summary."
                        />
                      </div>
                      {selectedWeeklySummaryGroup ? (
                        <span className="text-[11px] font-semibold text-slate-500">
                          {selectedWeeklySummaryGroup.slots.length} slot(s) selected for {selectedWeeklySummaryGroup.label}
                        </span>
                      ) : null}
                    </div>
                    {selectedWeeklySummaryGroup ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {selectedWeeklySummaryGroup.slots.map((item) => (
                          <button
                            key={`picked-${item.dayOfWeek}-${item.timeSlotId}`}
                            onClick={() => removeRequestedWeeklySlot(item.dayOfWeek, item.timeSlotId)}
                            className="inline-flex w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                            title="Remove slot"
                          >
                            <span className="min-w-0 flex-1 truncate">{formatSlotLabel(item.timeSlotId)}</span>
                            <span className="shrink-0 font-bold">x</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Reschedule PT session</p>
              <h4 className="text-2xl font-bold text-slate-900">Update this session now</h4>
              <p className="text-sm leading-relaxed text-slate-600">
                This will move the PT session immediately if the new slot still respects the cutoff and coach availability rules.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{rescheduleModal.session?.coachName || 'Assigned coach'}</p>
              <p className="mt-1 text-xs text-slate-500">
                Current session: {rescheduleModal.session?.sessionDate || '-'} | {formatSlotLabel(rescheduleModal.session?.timeSlotId)}
              </p>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                New date
                <input
                  type="date"
                  value={rescheduleModal.sessionDate}
                  onChange={(e) => setRescheduleModal((prev) => ({ ...prev, sessionDate: e.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-700"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                New time slot
                <select
                  value={rescheduleModal.timeSlotId}
                  onChange={(e) => setRescheduleModal((prev) => ({ ...prev, timeSlotId: e.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-700"
                >
                  <option value="">Select slot</option>
                  {timeSlots.map((slot) => (
                    <option key={slot.timeSlotId} value={slot.timeSlotId}>
                      Slot {slot.slotIndex} ({String(slot.startTime || '').slice(0, 5)} - {String(slot.endTime || '').slice(0, 5)})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Reason (optional)
              <textarea
                value={rescheduleModal.reason}
                onChange={(e) => setRescheduleModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="mt-1.5 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-700"
                rows={3}
                placeholder="Tell the coach why you need to move this session."
              />
            </label>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeRescheduleModal}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep current session
              </button>
              <button
                type="button"
                onClick={submitReschedule}
                disabled={loading}
                className="rounded-full bg-gym-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gym-700 disabled:opacity-50"
              >
                Update session now
              </button>
            </div>
          </div>
        </div>
      )}

      {seriesModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gym-600">Recurring PT change</p>
                <h4 className="text-2xl font-bold text-slate-900">Change recurring plan</h4>
                <p className="text-sm leading-relaxed text-slate-600">
                  Pick the future date when the new weekly template starts, then adjust the recurring slots that should continue through the active PT phase.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSeriesModal}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[0.88fr_1.12fr]">
              <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Apply new template from
                  <input
                    type="date"
                    value={seriesModal.cutoverDate}
                    onChange={(event) => setSeriesModal((prev) => ({ ...prev, cutoverDate: event.target.value }))}
                    className="mt-1.5 w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-700"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {DAYS.map((day) => (
                    <button
                      key={`series-day-${day.id}`}
                      type="button"
                      onClick={() => setSeriesModal((prev) => ({ ...prev, focusDay: day.id }))}
                      className={`rounded-2xl border px-3 py-3 text-left transition ${
                        seriesModal.focusDay === day.id
                          ? 'border-gym-600 bg-gym-50 text-gym-900 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-gym-300 hover:bg-white'
                      }`}
                    >
                      <div className="text-sm font-bold">{day.label}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {seriesModal.slots.filter((slot) => slot.dayOfWeek === day.id).length} slot(s)
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected weekday</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{getDayMeta(seriesModal.focusDay)?.label || '-'}</p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {timeSlots.map((slot) => {
                    const selected = isSeriesSlotSelected(seriesModal.focusDay, slot.timeSlotId)
                    return (
                      <button
                        key={`series-slot-${seriesModal.focusDay}-${slot.timeSlotId}`}
                        type="button"
                        onClick={() => toggleSeriesSlot(seriesModal.focusDay, slot.timeSlotId)}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          selected
                            ? 'border-gym-600 bg-gym-600 text-white shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-gym-300 hover:bg-gym-50'
                        }`}
                      >
                        <div className="text-sm font-bold">Slot {slot.slotIndex}</div>
                        <div className={`mt-1 text-xs ${selected ? 'text-white/85' : 'text-slate-500'}`}>
                          {String(slot.startTime || '').slice(0, 5)} - {String(slot.endTime || '').slice(0, 5)}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">New recurring template</p>
                  {groupedSeriesSlots.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No recurring slots selected yet.</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {groupedSeriesSlots.flatMap((day) =>
                        day.slots.map((slot) => (
                          <span key={`series-preview-${day.id}-${slot.timeSlotId}`} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                            {day.label} • {formatSlotLabel(slot.timeSlotId)}
                          </span>
                        )),
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeSeriesModal}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep current template
              </button>
              <button
                type="button"
                onClick={submitSeriesChange}
                disabled={loading}
                className="rounded-full bg-gym-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gym-700 disabled:opacity-50"
              >
                Save future series
              </button>
            </div>
          </div>
        </div>
      )}

      {feedbackModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl bg-white p-5">
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

      {cancelModal.open && cancelModal.session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">Cancel PT session</p>
              <h4 className="text-2xl font-bold text-slate-900">Cancel this coaching session?</h4>
              <p className="text-sm leading-relaxed text-slate-600">
                This will notify the coach and mark the session as cancelled for both sides.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{cancelModal.session.coachName || 'Assigned coach'}</p>
              <p className="mt-1 text-xs text-slate-500">
                {cancelModal.session.sessionDate || '-'} | {formatSlotLabel(cancelModal.session.timeSlotId)}
              </p>
            </div>

            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Reason for cancellation
              <textarea
                value={cancelModal.reason}
                onChange={(e) => setCancelModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="mt-1.5 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-700"
                rows={3}
                placeholder="Tell the coach why you need to cancel this session."
              />
            </label>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCancelModal}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep session
              </button>
              <button
                type="button"
                onClick={confirmCancelSession}
                disabled={loading}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirm cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {ptBookingBlockedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4">
          <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4">
          <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
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
    <article className={`gc-card rounded-[2rem] border p-5 space-y-3 shadow-sm flex flex-col justify-between ${isFullMatch ? 'border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)]' : 'border-amber-200 bg-[linear-gradient(180deg,#fffbeb,#fef3c7)]'}`}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h5 className="font-black text-slate-900 text-lg flex items-center gap-2">
              {coach.fullName}
              {isFullMatch ? (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Perfect Match</span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Partial Match</span>
              )}
            </h5>
            <p className="text-xs font-semibold text-slate-500 mt-1">{coach.email}</p>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isFullMatch ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
            {coach.matchedSlots}/{coach.requestedSlots} slots
          </span>
        </div>
      <p className="text-sm leading-6 text-slate-600 line-clamp-3">{coach.bio || 'No bio available for this coach.'}</p>
      <div className="text-[11px] font-semibold text-slate-600 space-y-1 mt-2">
        {bookedCount > 0 && <div className="text-amber-700">• {bookedCount} slot(s) already booked in this range</div>}
        {weeklyUnavailableCount > 0 && <div className="text-amber-700">• {weeklyUnavailableCount} slot(s) not in coach weekly availability</div>}
      </div>
      </div>
      <button onClick={() => onReview(coach)} className={`w-full mt-5 px-4 py-2.5 rounded-2xl text-white text-sm font-bold shadow transition ${isFullMatch ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200' : 'bg-amber-600 hover:bg-amber-500 shadow-amber-200'}`}>
        Review & Request
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
    <div className="absolute left-1/2 top-2 z-30 w-[min(26rem,calc(100vw-3rem))] -translate-x-1/2 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
      <div className="bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.16),_transparent_38%),linear-gradient(135deg,_rgba(10,10,15,0.98),_rgba(18,18,26,0.94)_55%,_rgba(38,25,6,0.92))] px-5 py-5 text-white">
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

