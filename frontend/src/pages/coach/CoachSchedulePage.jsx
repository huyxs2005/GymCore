import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Zap, RefreshCw, AlertCircle, X, Info, Activity, CheckCircle2 } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { coachNav } from '../../config/navigation'
import { coachApi } from '../../features/coach/api/coachApi'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'

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
  const [scheduleMonthCursor, setScheduleMonthCursor] = useState('')
  const [selectedScheduleDate, setSelectedScheduleDate] = useState('')
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

  const sessionsByDate = useMemo(() => {
    const grouped = new Map()
    mySchedule.forEach((session) => {
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
  }, [mySchedule])

  const scheduleCalendarDays = useMemo(() => buildMonthGrid(scheduleMonthCursor), [scheduleMonthCursor])
  const selectedScheduleItems = useMemo(
    () => (selectedScheduleDate ? sessionsByDate.get(selectedScheduleDate) || [] : []),
    [selectedScheduleDate, sessionsByDate],
  )

  useEffect(() => {
    const firstSessionDate = mySchedule
      .map((session) => session.sessionDate)
      .filter(Boolean)
      .sort()[0]

    if (firstSessionDate) {
      const firstDate = parseDateValue(firstSessionDate)
      if (firstDate) {
        const firstMonth = formatDateValue(new Date(firstDate.getFullYear(), firstDate.getMonth(), 1))
        setScheduleMonthCursor((prev) => prev || firstMonth)
      }
      setSelectedScheduleDate((prev) => (prev && sessionsByDate.has(prev) ? prev : firstSessionDate))
      return
    }

    const currentMonth = formatDateValue(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    setScheduleMonthCursor((prev) => prev || currentMonth)
    setSelectedScheduleDate('')
  }, [mySchedule, sessionsByDate])

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
              <section className="grid gap-8 xl:grid-cols-[1.4fr_0.6fr]">
                <div className="gc-glass-panel border-white/10 bg-white/[0.01] p-6 shadow-2xl">
                  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-lg font-black text-white font-display uppercase tracking-tight">Weekly timetable</h4>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-black/40 p-1.5 ring-1 ring-white/10">
                      <button
                        type="button"
                        onClick={() => setScheduleMonthCursor((prev) => shiftMonth(prev, -1))}
                        className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white transition-all"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <div className="min-w-[120px] text-center text-xs font-black uppercase tracking-widest text-white">
                        {parseDateValue(scheduleMonthCursor)?.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setScheduleMonthCursor((prev) => shiftMonth(prev, 1))}
                        className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white transition-all"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-white/5 bg-black/20 p-4">
                    <div className="grid grid-cols-7 gap-2">
                      {DAYS.map((day) => (
                        <div key={`schedule-header-${day.dayOfWeek}`} className="pb-3 text-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
                          {day.shortLabel}
                        </div>
                      ))}
                      {scheduleCalendarDays.map((day) => {
                        const daySessions = sessionsByDate.get(day.value) || []
                        const hasSessions = daySessions.length > 0
                        const isSelected = selectedScheduleDate === day.value
                        const dayAppearance = hasSessions ? getDayScheduleAppearance(daySessions) : null
                        
                        return (
                          <button
                            key={`schedule-day-${day.value}`}
                            type="button"
                            onClick={() => hasSessions && setSelectedScheduleDate(day.value)}
                            className={`group relative flex min-h-[100px] flex-col rounded-2xl border p-3 transition-all duration-300 ${hasSessions
                              ? `${dayAppearance?.dayClass || 'border-emerald-500/20 bg-emerald-500/5 text-white shadow-glow-sm hover:border-emerald-500/40'} text-white`
                              : day.isCurrentMonth
                                ? 'border-white/5 bg-white/[0.02] text-slate-500 hover:border-white/10'
                                : 'border-transparent bg-transparent text-slate-500'
                              } ${isSelected ? `${dayAppearance?.dotClass?.includes('red') ? 'ring-2 ring-red-500' : 'ring-2 ring-gym-500'} ring-offset-4 ring-offset-[#0a0a0f]` : ''}`}
                          >
                            <div className="flex items-start justify-between">
                              <span className={`text-xs font-black ${day.isCurrentMonth ? (hasSessions ? 'text-white' : 'text-slate-400') : 'text-slate-400'}`}>{day.dayNumber}</span>
                              {hasSessions && (
                                <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${dayAppearance?.dotClass || 'bg-emerald-500 shadow-glow'}`} />
                              )}
                            </div>
                            
                            {hasSessions && (
                              <div className="mt-auto">
                                <div className="flex flex-col gap-1">
                                   <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                                      <div className={`h-full ${dayAppearance?.countClass?.includes('red') ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, daySessions.length * 20)}%` }} />
                                   </div>
                                   <p className={`text-[9px] font-black uppercase tracking-tighter ${dayAppearance?.countClass || 'text-emerald-700'}`}>
                                      {daySessions.length} {daySessions.length === 1 ? 'Slot' : 'Slots'}
                                   </p>
                                </div>
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="gc-glass-panel border-white/10 bg-white/[0.03] p-7 ring-1 ring-white/5">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gym-500 mb-1">Focal Point</p>
                    <h4 className="font-display text-xl font-black text-white uppercase tracking-tight">{formatHumanDate(selectedScheduleDate)}</h4>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed">Detailed operational status for the selected coordinate.</p>

                    <div className="mt-8 space-y-4">
                      {selectedScheduleItems.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 rounded-[2rem] border border-dashed border-white/5 bg-white/[0.01]">
                          <Zap className="h-8 w-8 text-slate-800 mb-3" />
                          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest text-center">No active connections <br/> for this date.</p>
                        </div>
                      )}
                      {selectedScheduleItems.map((session) => {
                        const appearance = getStatusAppearance(session.status)
                        const isScheduled = String(session.status || '').toUpperCase() === 'SCHEDULED'
                        const isCancelled = String(session.status || '').toUpperCase() === 'CANCELLED'
                        
                        return (
                          <div key={session.ptSessionId} className="gc-card-compact group border-white/5 bg-white/[0.03] transition-all hover:bg-white/[0.05] hover:border-white/10">
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
                              <span className={`flex items-center gap-2 rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ring-1 ${appearance.badge.replace('bg-', 'bg-').replace('text-', 'text-')}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${appearance.dot}`} />
                                {appearance.label}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 rounded-xl bg-black/20 p-3 mb-5 group-hover:bg-black/30 transition-colors">
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
                                  onClick={() => openCancelModal(session)}
                                  className="flex-1 rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                                >
                                  Decommission
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openConfirmAction('complete', session.ptSessionId)}
                                  className="flex-1 rounded-xl bg-gym-500 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-950 shadow-glow hover:scale-[1.02] transition-all active:scale-95"
                                >
                                  Commit Complete
                                </button>
                              </div>
                            )}

                            {isCancelled && (
                              <button
                                type="button"
                                onClick={() => openConfirmAction('delete', session.ptSessionId)}
                                className="w-full rounded-xl border border-dashed border-white/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 hover:border-white/20 transition-all"
                              >
                                Purge Record
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

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
                onClick={handleCancelSession}
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

