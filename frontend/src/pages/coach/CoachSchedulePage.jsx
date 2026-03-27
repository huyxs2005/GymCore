import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Zap, RefreshCw, AlertCircle, X, Info, Activity, CheckCircle2 } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { coachNav } from '../../config/navigation'
import { coachApi } from '../../features/coach/api/coachApi'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'
import { broadcastMutationSync } from '../../features/dataSync/mutationSync'

const DAYS = [
  { dayOfWeek: 1, name: 'Monday', shortLabel: 'Mon' },
  { dayOfWeek: 2, name: 'Tuesday', shortLabel: 'Tue' },
  { dayOfWeek: 3, name: 'Wednesday', shortLabel: 'Wed' },
  { dayOfWeek: 4, name: 'Thursday', shortLabel: 'Thu' },
  { dayOfWeek: 5, name: 'Friday', shortLabel: 'Fri' },
  { dayOfWeek: 6, name: 'Saturday', shortLabel: 'Sat' },
  { dayOfWeek: 7, name: 'Sunday', shortLabel: 'Sun' },
]

const DEFAULT_TIME_SLOTS = [
  { timeSlotId: 1, slotIndex: 1, startTime: '07:00', endTime: '08:30' },
  { timeSlotId: 2, slotIndex: 2, startTime: '08:30', endTime: '10:00' },
  { timeSlotId: 3, slotIndex: 3, startTime: '10:00', endTime: '11:30' },
  { timeSlotId: 4, slotIndex: 4, startTime: '11:30', endTime: '13:00' },
  { timeSlotId: 5, slotIndex: 5, startTime: '13:00', endTime: '14:30' },
  { timeSlotId: 6, slotIndex: 6, startTime: '14:30', endTime: '16:00' },
  { timeSlotId: 7, slotIndex: 7, startTime: '16:00', endTime: '17:30' },
  { timeSlotId: 8, slotIndex: 8, startTime: '17:30', endTime: '19:00' },
]

function getCoachScheduleTab(search) {
  return new URLSearchParams(search).get('tab') === 'schedule' ? 'schedule' : 'availability'
}

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

function getWeekStart(date) {
  const source = new Date(date)
  const day = source.getDay()
  const offset = day === 0 ? -6 : 1 - day
  return addDays(source, offset)
}

function buildWeekDays(weekCursor) {
  const weekStart = parseDateValue(weekCursor)
  if (!weekStart) return []
  return DAYS.map((day, index) => {
    const current = addDays(weekStart, index)
    return {
      ...day,
      value: formatDateValue(current),
      dateLabel: current.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
    }
  })
}

function shiftWeek(weekCursor, delta) {
  const current = parseDateValue(weekCursor)
  if (!current) return weekCursor
  return formatDateValue(addDays(current, delta * 7))
}

function formatWeekRangeLabel(weekCursor) {
  const weekStart = parseDateValue(weekCursor)
  if (!weekStart) return ''
  const weekEnd = addDays(weekStart, 6)
  return `${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} to ${weekEnd.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}`
}

function formatHumanDate(value) {
  const parsed = parseDateValue(value)
  if (!parsed) return 'Pick a highlighted date'
  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusAppearance(status) {
  const normalized = String(status || '').toUpperCase()
  if (normalized === 'SCHEDULED') {
    return {
      label: 'Scheduled',
      badge: 'bg-emerald-500/15 text-emerald-700',
      card: 'border-emerald-200 bg-emerald-50/60',
      dot: 'bg-emerald-500',
    }
  }
  if (normalized === 'COMPLETED') {
    return {
      label: 'Completed',
      badge: 'bg-sky-500/15 text-sky-700',
      card: 'border-sky-200 bg-sky-50/60',
      dot: 'bg-sky-500',
    }
  }
  if (normalized === 'CANCELLED') {
    return {
      label: 'Cancelled',
      badge: 'bg-red-500/15 text-red-700',
      card: 'border-red-200 bg-red-50/50',
      dot: 'bg-red-500',
    }
  }
  return {
    label: normalized || 'Unknown',
    badge: 'bg-slate-100 text-slate-700',
    card: 'border-slate-200 bg-white',
    dot: 'bg-slate-400',
  }
}

function getDayScheduleAppearance(sessions) {
  const normalizedStatuses = sessions.map((session) => String(session.status || '').toUpperCase())
  const hasCancelled = normalizedStatuses.includes('CANCELLED')
  const hasActive = normalizedStatuses.some((status) => status === 'SCHEDULED' || status === 'COMPLETED')

  if (hasCancelled && !hasActive) {
    return {
      dayClass: 'border-red-200 bg-red-50/70 hover:border-red-400 hover:bg-red-50',
      countClass: 'text-red-700',
      dotClass: 'bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.14)]',
    }
  }

  return {
    dayClass: 'border-emerald-200 bg-emerald-50/70 hover:border-gym-400 hover:bg-gym-50',
    countClass: 'text-emerald-700',
    dotClass: 'bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.14)]',
  }
}

function CoachSchedulePage() {
  const location = useLocation()
  const [activeTab, setActiveTab] = useState(() => getCoachScheduleTab(location.search))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [mySchedule, setMySchedule] = useState([])
  const [timeSlots, setTimeSlots] = useState(DEFAULT_TIME_SLOTS)
  const [availability, setAvailability] = useState({})
  const [acceptingCustomerRequests, setAcceptingCustomerRequests] = useState(true)
  const [selectedAvailabilityDay, setSelectedAvailabilityDay] = useState(1)
  const [scheduleWeekCursor, setScheduleWeekCursor] = useState('')
  const [selectedScheduleDate, setSelectedScheduleDate] = useState('')
  const [sessionDetailModal, setSessionDetailModal] = useState({
    open: false,
    session: null,
  })
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState([])
  const [hasCustomCustomerFilter, setHasCustomCustomerFilter] = useState(false)
  const [cancelModal, setCancelModal] = useState({
    open: false,
    session: null,
    reason: '',
  })
  const [confirmAction, setConfirmAction] = useState({
    open: false,
    kind: '',
    sessionId: null,
  })
  const [intakeToggleDialog, setIntakeToggleDialog] = useState({
    open: false,
    nextValue: true,
  })

  const isFirstAvailabilityView = useRef(true)
  const messageBannerRef = useRef(null)

  useEffect(() => {
    setActiveTab(getCoachScheduleTab(location.search))
  }, [location.search])

  useEffect(() => {
    loadTimeSlots()
  }, [])

  useEffect(() => {
    if (activeTab !== 'availability') return
    if (isFirstAvailabilityView.current) {
      isFirstAvailabilityView.current = false
      return
    }
    loadMyAvailability()
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'schedule') {
      loadMySchedule()
    } else if (activeTab === 'availability') {
      loadMyAvailability()
    }
  }, [activeTab])

  async function loadMyAvailability() {
    try {
      setError('')
      const res = await coachApi.getMyAvailability()
      const raw = res?.data ?? res
      const list = Array.isArray(raw?.weeklyAvailability)
        ? raw.weeklyAvailability
        : Array.isArray(raw) ? raw : []
      const next = {}
      list.forEach((av) => {
        const dayOfWeek = av.dayOfWeek ?? av.DayOfWeek
        const timeSlotId = av.timeSlotId ?? av.timeSlotID ?? av.TimeSlotID
        if (dayOfWeek != null && timeSlotId != null) {
          next[`${dayOfWeek}-${timeSlotId}`] = true
        }
      })
      setAvailability(next)
      setAcceptingCustomerRequests(raw?.acceptingCustomerRequests !== false)
    } catch (err) {
      console.warn('Could not load saved availability:', err)
      setError(err?.response?.data?.message || 'Could not load saved availability.')
    }
  }

  async function loadTimeSlots() {
    try {
      setLoading(true)
      const response = await coachApi.getTimeSlots()
      const items = response?.data?.items || response?.items || []
      if (items.length > 0) {
        setTimeSlots(items)
      }
      setError('')
    } catch (err) {
      console.error('Error loading time slots:', err)
      console.warn('Using default time slots due to API error')
    } finally {
      setLoading(false)
    }
  }

  async function loadMySchedule() {
    try {
      setLoading(true)
      const response = await coachApi.getMyCoachSchedule()
      setMySchedule(response?.data?.items || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load schedule.')
    } finally {
      setLoading(false)
    }
  }

  function openConfirmAction(kind, sessionId) {
    setConfirmAction({
      open: true,
      kind,
      sessionId,
    })
  }

  function closeConfirmAction() {
    setConfirmAction({
      open: false,
      kind: '',
      sessionId: null,
    })
  }

  function openIntakeToggleDialog(nextValue) {
    setIntakeToggleDialog({
      open: true,
      nextValue,
    })
  }

  function closeIntakeToggleDialog() {
    setIntakeToggleDialog({
      open: false,
      nextValue: acceptingCustomerRequests,
    })
  }

  function confirmIntakeToggle() {
    setAcceptingCustomerRequests(intakeToggleDialog.nextValue)
    setMessage(
      intakeToggleDialog.nextValue
        ? 'You are visible in customer coach matches again. Save availability to publish the change.'
        : 'You are hidden from future customer coach matches. Save availability to publish the change.',
    )
    closeIntakeToggleDialog()
  }

  async function handleCompleteSession(sessionId) {
    try {
      setLoading(true)
      await coachBookingApi.completeSession(sessionId)
      setMySchedule((prev) => prev.map((session) => (
        session.ptSessionId === sessionId ? { ...session, status: 'COMPLETED' } : session
      )))
      setMessage('Session marked as completed.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not complete the session.')
    } finally {
      setLoading(false)
      closeConfirmAction()
    }
  }

  async function handleDeleteSession(sessionId) {
    try {
      setLoading(true)
      await coachBookingApi.deleteSession(sessionId)
      setMySchedule((prev) => prev.filter((session) => session.ptSessionId !== sessionId))
      setMessage('Cancelled session notice deleted.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete the session.')
    } finally {
      setLoading(false)
      closeConfirmAction()
    }
  }

  async function confirmScheduleAction() {
    if (!confirmAction.sessionId) return
    if (confirmAction.kind === 'complete') {
      await handleCompleteSession(confirmAction.sessionId)
      return
    }
    if (confirmAction.kind === 'delete') {
      await handleDeleteSession(confirmAction.sessionId)
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

  function openSessionDetailModal(session, dateValue) {
    setSelectedScheduleDate(dateValue || session?.sessionDate || '')
    setSessionDetailModal({
      open: true,
      session,
    })
  }

  function closeSessionDetailModal() {
    setSessionDetailModal({
      open: false,
      session: null,
    })
  }

  async function confirmCancelSession() {
    const sessionId = cancelModal.session?.ptSessionId
    if (!sessionId) return
    try {
      setLoading(true)
      await coachBookingApi.cancelCoachSession(sessionId, {
        cancelReason: cancelModal.reason.trim() || 'Cancelled by coach',
      })
      setMySchedule((prev) => prev.map((session) => (
        session.ptSessionId === sessionId
          ? {
              ...session,
              status: 'CANCELLED',
              cancelReason: cancelModal.reason.trim() || 'Cancelled by coach',
            }
          : session
      )))
      closeCancelModal()
      setMessage('Session cancelled and the customer was notified.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not cancel the session.')
    } finally {
      setLoading(false)
    }
  }

  function toggleSlot(dayOfWeek, timeSlotId) {
    const key = `${dayOfWeek}-${timeSlotId}`
    setAvailability((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  async function handleSaveAvailability() {
    try {
      setLoading(true)
      setError('')
      const slots = []
      DAYS.forEach((day) => {
        timeSlots.forEach((slot) => {
          const key = `${day.dayOfWeek}-${slot.timeSlotId}`
          slots.push({
            dayOfWeek: day.dayOfWeek,
            timeSlotId: slot.timeSlotId,
            isAvailable: availability[key] === true,
          })
        })
      })

      await coachApi.updateAvailability({
        slots,
        acceptingCustomerRequests,
      })
      broadcastMutationSync({
        scope: 'coach-availability',
      })
      setMessage('Availability updated successfully. Selected slots stay visible so you can keep adjusting them.')
      requestAnimationFrame(() => {
        messageBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      setTimeout(() => setMessage(''), 6000)
    } catch (err) {
      console.error('Error saving availability:', err)
      setError(err?.response?.data?.message || 'Availability update failed. Please try again.')
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

  function formatSlotLabel(timeSlotId) {
    const slot = timeSlotById.get(timeSlotId)
    if (!slot) return `Slot ${timeSlotId}`
    return `Slot ${slot.slotIndex} (${String(slot.startTime || '').slice(0, 5)}-${String(slot.endTime || '').slice(0, 5)})`
  }

  const availabilityCountByDay = useMemo(() => {
    const counts = new Map()
    DAYS.forEach((day) => {
      const total = timeSlots.reduce((count, slot) => {
        return count + (availability[`${day.dayOfWeek}-${slot.timeSlotId}`] ? 1 : 0)
      }, 0)
      counts.set(day.dayOfWeek, total)
    })
    return counts
  }, [availability, timeSlots])

  const selectedAvailabilityEntries = useMemo(() => {
    return DAYS.flatMap((day) => timeSlots
      .filter((slot) => availability[`${day.dayOfWeek}-${slot.timeSlotId}`])
      .map((slot) => ({
        dayOfWeek: day.dayOfWeek,
        dayName: day.name,
        timeSlotId: slot.timeSlotId,
        slotIndex: slot.slotIndex,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })))
  }, [availability, timeSlots])

  const selectedAvailabilityDayName = useMemo(() => {
    return DAYS.find((day) => day.dayOfWeek === selectedAvailabilityDay)?.name || 'Monday'
  }, [selectedAvailabilityDay])

  const customerFilterOptions = useMemo(() => {
    const seen = new Set()
    return mySchedule
      .map((session) => {
        const key = String(
          session.customerId
            || session.customerEmail
            || session.customerPhone
            || session.customerName
            || session.ptSessionId,
        )
        const label = session.customerName || session.customerEmail || `Customer ${key}`
        return { key, label }
      })
      .filter((item) => {
        if (!item.key || seen.has(item.key)) return false
        seen.add(item.key)
        return true
      })
      .sort((left, right) => left.label.localeCompare(right.label))
  }, [mySchedule])

  useEffect(() => {
    const allKeys = customerFilterOptions.map((item) => item.key)
    setSelectedCustomerKeys((prev) => {
      if (!hasCustomCustomerFilter) {
        return allKeys
      }
      return prev.filter((key) => allKeys.includes(key))
    })
  }, [customerFilterOptions, hasCustomCustomerFilter])

  const selectedCustomerKeySet = useMemo(() => new Set(selectedCustomerKeys), [selectedCustomerKeys])
  const areAllCustomersSelected = customerFilterOptions.length > 0
    && selectedCustomerKeys.length === customerFilterOptions.length

  const filteredSchedule = useMemo(() => {
    if (selectedCustomerKeys.length === 0) return []
    return mySchedule.filter((session) => {
      const key = String(
        session.customerId
          || session.customerEmail
          || session.customerPhone
          || session.customerName
          || session.ptSessionId,
      )
      return selectedCustomerKeySet.has(key)
    })
  }, [mySchedule, selectedCustomerKeySet, selectedCustomerKeys.length])

  const sessionsByDate = useMemo(() => {
    const grouped = new Map()
    filteredSchedule.forEach((session) => {
      const date = session.sessionDate
      if (!date) return
      const existing = grouped.get(date) || []
      existing.push(session)
      existing.sort((left, right) => {
        if (left.slotIndex !== right.slotIndex) {
          return Number(left.slotIndex || 0) - Number(right.slotIndex || 0)
        }
        return String(left.startTime || '').localeCompare(String(right.startTime || ''))
      })
      grouped.set(date, existing)
    })
    return grouped
  }, [filteredSchedule])

  const sessionsByDateAndSlot = useMemo(() => {
    const grouped = new Map()
    filteredSchedule.forEach((session) => {
      const date = session.sessionDate
      const timeSlotId = Number(session.timeSlotId || session.slotIndex || 0)
      if (!date || !timeSlotId) return
      const key = `${date}-${timeSlotId}`
      const existing = grouped.get(key) || []
      existing.push(session)
      existing.sort((left, right) => String(left.customerName || '').localeCompare(String(right.customerName || '')))
      grouped.set(key, existing)
    })
    return grouped
  }, [filteredSchedule])

  const scheduleWeekDays = useMemo(() => buildWeekDays(scheduleWeekCursor), [scheduleWeekCursor])

  useEffect(() => {
    const firstSessionDate = filteredSchedule
      .map((session) => session.sessionDate)
      .filter(Boolean)
      .sort()[0]

    if (firstSessionDate) {
      const firstDate = parseDateValue(firstSessionDate)
      if (firstDate) {
        const firstWeek = formatDateValue(getWeekStart(firstDate))
        setScheduleWeekCursor((prev) => {
          if (!prev) return firstWeek
          const visibleDays = buildWeekDays(prev).map((day) => day.value)
          return visibleDays.includes(firstSessionDate) ? prev : firstWeek
        })
      }
      setSelectedScheduleDate((prev) => (prev && sessionsByDate.has(prev) ? prev : firstSessionDate))
      return
    }

    const currentWeek = formatDateValue(getWeekStart(new Date()))
    setScheduleWeekCursor((prev) => prev || currentWeek)
    setSelectedScheduleDate('')
    setSessionDetailModal({
      open: false,
      session: null,
    })
  }, [filteredSchedule, sessionsByDate])

  function handleToggleAllCustomers(nextChecked) {
    setHasCustomCustomerFilter(!nextChecked)
    setSelectedCustomerKeys(nextChecked ? customerFilterOptions.map((item) => item.key) : [])
  }

  function handleToggleCustomerKey(customerKey, nextChecked) {
    setHasCustomCustomerFilter(true)
    setSelectedCustomerKeys((prev) => {
      if (nextChecked) {
        return Array.from(new Set([...prev, customerKey]))
      }
      return prev.filter((key) => key !== customerKey)
    })
  }

  return (
    <WorkspaceScaffold
      title="Performance Calendar"
      subtitle="Strategic management of your professional availability and training engagement pipeline."
      showHeader={false}
    >
        <div className="max-w-7xl space-y-8 pb-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex rounded-2xl bg-white/5 p-1.5 ring-1 ring-white/10 backdrop-blur-md">
            <span
              className={`pointer-events-none absolute top-1.5 h-[calc(100%-12px)] w-[calc(50%-6px)] rounded-xl bg-gym-500 shadow-glow transition-all duration-300 ease-out ${
                activeTab === 'availability' ? 'left-1.5' : 'left-[calc(50%+1.5px)]'
              }`}
            />
            <button
              onClick={() => setActiveTab('availability')}
              className={`relative z-10 flex w-1/2 items-center justify-center gap-3 rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'availability' ? 'text-slate-950' : 'text-slate-500 hover:text-slate-200'}`}
            >
              <Activity className="h-4 w-4" /> Availability
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`relative z-10 flex w-1/2 items-center justify-center gap-3 rounded-xl px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'schedule' ? 'text-slate-950' : 'text-slate-500 hover:text-slate-200'}`}
            >
              <Calendar className="h-4 w-4" /> Timetable
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-400 flex items-center justify-between shadow-2xl animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3 font-medium">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
            <button onClick={() => setError('')} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {message && (
          <div ref={messageBannerRef} className={`rounded-2xl px-5 py-4 text-sm flex items-center justify-between shadow-2xl animate-in fade-in slide-in-from-top-2 ${
            acceptingCustomerRequests
              ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border border-rose-500/20 bg-rose-500/10 text-rose-400'
          }`}>
            <div className="flex items-center gap-3 font-medium">
              {acceptingCustomerRequests ? <CheckCircle2 className="h-5 w-5" /> : <X className="h-5 w-5" />}
              {message}
            </div>
            <button onClick={() => setMessage('')} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {activeTab === 'availability' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="gc-glass-panel border-white/5 bg-white/[0.02] p-8">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-white tracking-tight uppercase">Set your availability</h2>
                </div>
                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <div className="flex items-center gap-2 px-1 py-1">
                    <span className="h-2 w-2 rounded-full bg-gym-500 shadow-glow" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                      {selectedAvailabilityEntries.length} Slots Active
                    </span>
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white">
                    Customer Acceptance
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => openIntakeToggleDialog(!acceptingCustomerRequests)}
                      className={`relative inline-flex h-12 min-w-[240px] items-center rounded-full border p-1.5 transition-all duration-300 ${
                        acceptingCustomerRequests
                          ? 'border-emerald-300/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.3),rgba(52,211,153,0.78))] text-white shadow-[0_0_30px_rgba(74,222,128,0.16)]'
                          : 'border-rose-300/25 bg-[linear-gradient(135deg,rgba(244,63,94,0.34),rgba(251,113,133,0.78))] text-white shadow-[0_0_30px_rgba(244,63,94,0.12)]'
                      }`}
                    >
                      <span
                        className={`absolute top-1.5 h-9 w-[calc(50%-6px)] rounded-full bg-white shadow-[0_10px_22px_rgba(15,23,42,0.18)] transition-all duration-300 ${
                          acceptingCustomerRequests ? 'left-[calc(50%+1.5px)]' : 'left-[6px]'
                        }`}
                      />
                      <span className="relative z-10 grid w-full grid-cols-2 text-xs font-black uppercase tracking-[0.24em]">
                        <span className={`flex items-center justify-center ${acceptingCustomerRequests ? 'text-white/55' : 'text-slate-950'}`}>
                          Pause
                        </span>
                        <span className={`flex items-center justify-center ${acceptingCustomerRequests ? 'text-slate-950 translate-x-1' : 'text-white/55'}`}>
                          Accepting
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {loading && timeSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-gym-500 border-t-transparent" />
                  <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-500">Synchronizing slots...</p>
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-amber-500 mb-4" />
                  <p className="text-sm font-bold text-amber-200 uppercase tracking-tight">Configuration Synchronicity Error</p>
                  <p className="mt-1 text-xs text-amber-500/80 italic">No operational time slots were retrieved from the core engine.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Weekly Cycle Selector</p>
                       <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {DAYS.map((day) => (
                        <button
                          key={`availability-day-${day.dayOfWeek}`}
                          type="button"
                          onClick={() => setSelectedAvailabilityDay(day.dayOfWeek)}
                          className={`group relative min-w-[148px] flex-1 overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 ${selectedAvailabilityDay === day.dayOfWeek
                            ? 'border-gym-500 bg-gym-500/5 text-white shadow-glow-sm'
                            : 'border-white/5 bg-white/[0.03] text-slate-500 hover:border-white/20 hover:bg-white/5'
                            }`}
                        >
                          <div className={`text-xs font-black uppercase tracking-widest ${selectedAvailabilityDay === day.dayOfWeek ? 'text-gym-500' : 'text-slate-600'}`}>{day.shortLabel}</div>
                          <div className="mt-2 text-sm font-bold tracking-tight">{day.name}</div>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-[9px] font-bold opacity-60 tracking-tighter uppercase">{availabilityCountByDay.get(day.dayOfWeek) || 0} Slots</span>
                            {selectedAvailabilityDay === day.dayOfWeek && (
                               <div className="h-1.5 w-1.5 rounded-full bg-gym-500" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-1">
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gym-500 mb-1">Active configuration</p>
                         <h4 className="text-xl font-black text-white font-display uppercase tracking-tight">{selectedAvailabilityDayName}</h4>
                         <p className="mt-1 text-xs text-slate-500 leading-relaxed">Toggle your public calendar visibility.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveAvailability}
                        disabled={loading}
                        className="gc-button-primary !h-11 !px-6 !text-xs !font-black !tracking-[0.16em]"
                      >
                        {loading ? 'Saving...' : 'Save'}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-2 xl:grid-cols-2">
                      {timeSlots.map((slot) => {
                        const selected = availability[`${selectedAvailabilityDay}-${slot.timeSlotId}`] === true
                        return (
                          <button
                            key={`availability-slot-${selectedAvailabilityDay}-${slot.timeSlotId}`}
                            type="button"
                            onClick={() => toggleSlot(selectedAvailabilityDay, slot.timeSlotId)}
                            className={`group w-full rounded-2xl border px-5 py-4 text-left transition-all duration-300 ${selected
                              ? 'border-gym-500 bg-gym-500 text-slate-950 shadow-glow'
                              : 'border-white/5 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:bg-white/[0.06]'
                              }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-4">
                                <div className={`flex h-10 min-w-[74px] items-center justify-center rounded-xl bg-black/10 px-2 font-black text-xs ${selected ? 'text-slate-900 bg-black/5' : 'text-slate-500'}`}>
                                  Slot {slot.slotIndex}
                                </div>
                                <div>
                                  <p className={`text-sm font-black uppercase tracking-tight ${selected ? 'text-slate-900' : 'text-white'}`}>
                                    {String(slot.startTime || '').slice(0, 5)} — {String(slot.endTime || '').slice(0, 5)}
                                  </p>
                                </div>
                              </div>
                              <div className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest ring-1 ${selected ? 'bg-black/10 text-slate-900 ring-black/5' : 'bg-white/5 text-slate-600 ring-white/10'}`}>
                                {selected ? 'Active' : 'Closed'}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              </div>
            </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {loading && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-3xl bg-white/[0.02] border border-white/5" />)}</div>}

            {!loading && mySchedule.length === 0 && (
              <div className="gc-glass-panel flex flex-col items-center justify-center py-24 text-center border-white/5">
                <div className="mb-6 rounded-full bg-white/5 p-8 border border-white/5">
                  <Calendar className="h-12 w-12 text-slate-700" />
                </div>
                <h3 className="text-xl font-bold text-white font-display uppercase tracking-tight">Agenda Clear</h3>
                <p className="mt-2 max-w-sm text-sm text-slate-500">No training sessions have been requested or confirmed for your profile yet.</p>
              </div>
            )}

            {!loading && mySchedule.length > 0 && (
              <section>
                <div className="gc-glass-panel border-white/10 bg-white/[0.01] p-5 shadow-2xl">
                  <div className="mb-5 space-y-4">
                    <div>
                      <h4 className="text-lg font-black text-white font-display uppercase tracking-tight">Weekly timetable</h4>
                      <p className="mt-2 text-sm text-slate-500">Filter by customer, then inspect the week board slot by slot.</p>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/5 bg-white/[0.03] p-3.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white">
                          <input
                            type="checkbox"
                            checked={areAllCustomersSelected}
                            onChange={(event) => handleToggleAllCustomers(event.target.checked)}
                            className="h-4 w-4 rounded border-white/20 bg-transparent text-gym-500 focus:ring-gym-500"
                          />
                          All customers
                        </label>
                        <span className="text-xs uppercase tracking-[0.24em] text-slate-500">
                          {selectedCustomerKeys.length}/{customerFilterOptions.length || 0} visible
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {customerFilterOptions.map((customer) => {
                          const checked = selectedCustomerKeySet.has(customer.key)
                          return (
                            <label
                              key={`schedule-customer-filter-${customer.key}`}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                                checked
                                  ? 'border-gym-500 bg-gym-500/12 text-gym-300'
                                  : 'border-white/10 bg-white/[0.02] text-slate-400'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => handleToggleCustomerKey(customer.key, event.target.checked)}
                                className="h-4 w-4 rounded border-white/20 bg-transparent text-gym-500 focus:ring-gym-500"
                              />
                              <span>{customer.label}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 rounded-2xl bg-black/40 p-1 ring-1 ring-white/10">
                      <button
                        type="button"
                        onClick={() => setScheduleWeekCursor((prev) => shiftWeek(prev, -1))}
                        className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white transition-all"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <div className="min-w-[136px] text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Week</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-widest text-white">{formatWeekRangeLabel(scheduleWeekCursor)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setScheduleWeekCursor((prev) => shiftWeek(prev, 1))}
                        className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white transition-all"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {selectedCustomerKeys.length === 0 ? (
                    <div className="flex min-h-[320px] items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-black/20 text-center">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">No customers selected</p>
                        <p className="mt-2 text-sm text-slate-400">Select at least one customer above to render the weekly timetable.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-[1.75rem] border border-white/5 bg-black/20">
                      <div className="min-w-[780px]">
                        <div className="grid grid-cols-[116px_repeat(7,minmax(0,1fr))]">
                          <div className="border-b border-white/5 bg-[#232434] px-3 py-2.5">
                            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Week</p>
                            <p className="mt-1 text-base font-black text-white">{formatWeekRangeLabel(scheduleWeekCursor)}</p>
                          </div>
                          {scheduleWeekDays.map((day) => {
                            const daySessions = sessionsByDate.get(day.value) || []
                            const isSelected = selectedScheduleDate === day.value
                            return (
                              <button
                                key={`schedule-weekday-${day.value}`}
                                type="button"
                                onClick={() => setSelectedScheduleDate(day.value)}
                                className={`border-b border-l border-white/5 px-3 py-2.5 text-left transition ${
                                  isSelected ? 'bg-[#4b392d]' : 'bg-[#232434] hover:bg-[#2a2c3f]'
                                }`}
                              >
                                <p className="text-base font-black uppercase text-white">{day.shortLabel}</p>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <span className="text-[11px] text-slate-400">{day.dateLabel}</span>
                                  {daySessions.length > 0 ? <span className="h-2 w-2 rounded-full bg-gym-500" /> : null}
                                </div>
                              </button>
                            )
                          })}
                        </div>

                        <div className="grid">
                          {(timeSlots.length > 0 ? timeSlots : DEFAULT_TIME_SLOTS).map((slot) => (
                            <div key={`coach-week-slot-${slot.timeSlotId}`} className="grid grid-cols-[116px_repeat(7,minmax(0,1fr))]">
                              <div className="border-b border-white/5 bg-white/[0.03] px-3 py-3">
                                <p className="text-base font-bold text-white">Slot {slot.slotIndex}</p>
                                <p className="mt-0.5 text-sm text-slate-400">
                                  {String(slot.startTime || '').slice(0, 5)} - {String(slot.endTime || '').slice(0, 5)}
                                </p>
                              </div>
                              {scheduleWeekDays.map((day) => {
                                const cellSessions = sessionsByDateAndSlot.get(`${day.value}-${slot.timeSlotId}`) || []
                                const isSelectedDay = selectedScheduleDate === day.value
                                return (
                                  <div
                                    key={`coach-week-cell-${day.value}-${slot.timeSlotId}`}
                                    className={`min-h-[62px] border-b border-l border-white/5 px-2 py-2 ${
                                      isSelectedDay ? 'bg-white/[0.025]' : 'bg-transparent'
                                    }`}
                                  >
                                    {cellSessions.length > 0 ? (
                                      <div className="space-y-1.5">
                                        {cellSessions.map((session) => {
                                          const appearance = getStatusAppearance(session.status)
                                          return (
                                            <button
                                              key={`coach-week-session-${session.ptSessionId}`}
                                              type="button"
                                              onClick={() => openSessionDetailModal(session, day.value)}
                                              className="w-full rounded-[0.9rem] border border-gym-500/55 bg-gym-500/12 px-2.5 py-2 text-left transition hover:bg-gym-500/18"
                                            >
                                              <div className="flex items-start gap-2">
                                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/35">
                                                  {session.avatarUrl ? (
                                                    <img
                                                      src={session.avatarUrl}
                                                      alt={session.customerName || 'Customer avatar'}
                                                      className="h-full w-full object-cover"
                                                    />
                                                  ) : (
                                                    <User className="h-4 w-4 text-slate-300" />
                                                  )}
                                                </div>
                                                <div className="min-w-0">
                                                  <p className="line-clamp-2 text-sm font-bold leading-tight text-white">{session.customerName || 'Customer'}</p>
                                                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">Customer</p>
                                                </div>
                                              </div>
                                              <p className="mt-0.5 text-[11px] leading-snug text-slate-300">
                                                Slot {session.slotIndex || slot.slotIndex} ({String(session.startTime || slot.startTime || '').slice(0, 5)}-{String(session.endTime || slot.endTime || '').slice(0, 5)})
                                              </p>
                                              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold text-gym-400">
                                                <span className={`h-2 w-2 rounded-full ${appearance.dot}`} />
                                                {appearance.label}
                                              </div>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    ) : (
                                      <div className="flex h-full items-center justify-center text-base text-slate-500">-</div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </section>
            )}
          </div>
        )}
      </div>

      {sessionDetailModal.open && sessionDetailModal.session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/50 animate-in fade-in duration-300">
          <div className="gc-glass-panel relative w-full max-w-md border-white/10 bg-[#12121a]/95 p-7 shadow-[0_0_100px_rgba(0,0,0,0.8)] ring-1 ring-white/5">
            <button
              type="button"
              onClick={closeSessionDetailModal}
              className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/[0.03] p-2 text-slate-500 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {(() => {
              const session = sessionDetailModal.session
              const appearance = getStatusAppearance(session.status)
              const isScheduled = String(session.status || '').toUpperCase() === 'SCHEDULED'
              const isCancelled = String(session.status || '').toUpperCase() === 'CANCELLED'

              return (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gym-500 mb-1">Focal Point</p>
                  <h4 className="font-display text-xl font-black text-white uppercase tracking-tight">{formatHumanDate(session.sessionDate)}</h4>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">Detailed operational status for the selected coordinate.</p>

                  <div className="mt-8 rounded-[2rem] border border-white/5 bg-white/[0.03] p-5">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h5 className="truncate font-display text-lg font-black text-white uppercase tracking-tight">{session.customerName}</h5>
                        <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                          <Clock className="h-3.5 w-3.5 text-gym-500" />
                          <span>{String(session.startTime || '').slice(0, 5)} — {String(session.endTime || '').slice(0, 5)}</span>
                          <span className="text-slate-700">|</span>
                          <span>Vector {session.slotIndex}</span>
                        </div>
                      </div>
                      <span className={`flex items-center gap-2 rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ring-1 ${appearance.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${appearance.dot}`} />
                        {appearance.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 rounded-xl bg-black/20 p-3 mb-5">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-wider mb-0.5">Contact Interface</p>
                        <p className="truncate text-[11px] font-bold text-slate-300">{session.customerPhone || 'UNAVAILABLE'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-wider mb-0.5">Email Node</p>
                        <p className="truncate text-[11px] font-bold text-slate-300">{session.customerEmail || 'UNSET'}</p>
                      </div>
                    </div>

                    {isCancelled && session.cancelReason && (
                      <div className="mb-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-[11px] leading-relaxed text-rose-400 font-medium italic">
                        " {session.cancelReason} "
                      </div>
                    )}

                    {isScheduled && (
                      <div className="flex gap-3 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            closeSessionDetailModal()
                            openCancelModal(session)
                          }}
                          className="flex-1 rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            closeSessionDetailModal()
                            openConfirmAction('complete', session.ptSessionId)
                          }}
                          className="flex-1 rounded-xl bg-gym-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-950 shadow-glow hover:scale-[1.02] transition-all active:scale-95"
                        >
                          Commit Complete
                        </button>
                      </div>
                    )}

                    {isCancelled && (
                      <button
                        type="button"
                        onClick={() => {
                          closeSessionDetailModal()
                          openConfirmAction('delete', session.ptSessionId)
                        }}
                        className="w-full rounded-xl border border-dashed border-white/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 hover:border-white/20 transition-all"
                      >
                        Purge Record
                      </button>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {cancelModal.open && cancelModal.session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in duration-300">
          <div className="gc-glass-panel relative w-full max-w-md border-white/10 bg-[#12121a]/90 p-8 shadow-[0_0_100px_rgba(0,0,0,0.8)] ring-1 ring-white/5">
            <div className="mb-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mb-2">Service Decommission</p>
              <h4 className="font-display text-2xl font-black text-white uppercase tracking-tight">Abort Session?</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                You are about to terminate this training engagement. This action will be logged and mirrored in the member's operational record.
              </p>
            </div>

            <div className="mb-8 rounded-[2rem] border border-white/5 bg-white/[0.03] p-5 ring-1 ring-black/20">
              <div className="flex items-center gap-4">
                 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-500">
                    <User className="h-6 w-6" />
                 </div>
                 <div>
                    <p className="font-black text-white uppercase tracking-tight">{cancelModal.session.customerName || 'Designated Trainee'}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {cancelModal.session.sessionDate || '-'} | {formatSlotLabel(cancelModal.session.timeSlotId)}
                    </p>
                 </div>
              </div>
            </div>

            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Rationale for Termination</span>
              <textarea
                value={cancelModal.reason}
                onChange={(e) => setCancelModal((prev) => ({ ...prev, reason: e.target.value }))}
                className="gc-input !mt-3 !h-32 !rounded-[2rem] resize-none !py-4 border-white/5 bg-white/[0.02] focus:bg-white/[0.05]"
                placeholder="Declare the technical or operational necessity for this cancellation..."
              />
            </label>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={closeCancelModal}
                className="gc-button-secondary flex-1 !rounded-2xl"
              >
                Abort
              </button>
              <button
                type="button"
                onClick={confirmCancelSession}
                disabled={loading}
                className="gc-button-primary flex-1 !bg-rose-500 !text-white hover:!bg-rose-600 !rounded-2xl shadow-glow-rose"
              >
                {loading ? 'Processing...' : 'Confirm Termination'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmAction.open}
        title={confirmAction.kind === 'complete' ? 'Mark this session as completed?' : 'Delete this cancelled session notice?'}
        description={
          confirmAction.kind === 'complete'
            ? 'This will mark the PT session as completed for the coach and customer schedule.'
            : 'This removes the cancelled-session notice from the coach schedule view.'
        }
        confirmLabel={confirmAction.kind === 'complete' ? 'Mark completed' : 'Delete notice'}
        pending={loading}
        onCancel={closeConfirmAction}
        onConfirm={confirmScheduleAction}
      />

      <ConfirmDialog
        open={intakeToggleDialog.open}
        title={intakeToggleDialog.nextValue ? 'Show yourself in customer matches?' : 'Hide yourself from customer matches?'}
        description={
          intakeToggleDialog.nextValue
            ? 'Your coach profile will appear in future customer PT match results again after you save availability.'
            : 'You will stop appearing in future customer PT match results after you save availability. Existing PT sessions and requests are not changed.'
        }
        confirmLabel={intakeToggleDialog.nextValue ? 'Show in matches' : 'Hide from matches'}
        pending={false}
        onCancel={closeIntakeToggleDialog}
        onConfirm={confirmIntakeToggle}
      />
    </WorkspaceScaffold>
  )
}

export default CoachSchedulePage

