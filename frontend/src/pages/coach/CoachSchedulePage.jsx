import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import WeekdayDropdown from '../../components/common/WeekdayDropdown'
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
  const [selectedAvailabilityDay, setSelectedAvailabilityDay] = useState(1)
  const [selectedAvailabilitySummaryDay, setSelectedAvailabilitySummaryDay] = useState(1)
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

  const isFirstAvailabilityView = useRef(true)

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

      await coachApi.updateAvailability({ slots })
      setMessage('Availability updated successfully. Selected slots stay visible so you can keep adjusting them.')
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

  const groupedAvailabilityEntries = useMemo(() => {
    return DAYS.map((day) => ({
      ...day,
      slots: selectedAvailabilityEntries.filter((entry) => entry.dayOfWeek === day.dayOfWeek),
    })).filter((day) => day.slots.length > 0)
  }, [selectedAvailabilityEntries])

  const selectedAvailabilitySummaryGroup = useMemo(() => {
    return groupedAvailabilityEntries.find((day) => day.dayOfWeek === selectedAvailabilitySummaryDay) || groupedAvailabilityEntries[0] || null
  }, [groupedAvailabilityEntries, selectedAvailabilitySummaryDay])

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

  useEffect(() => {
    if (groupedAvailabilityEntries.length === 0) {
      return
    }
    if (!groupedAvailabilityEntries.some((day) => day.dayOfWeek === selectedAvailabilitySummaryDay)) {
      setSelectedAvailabilitySummaryDay(groupedAvailabilityEntries[0].dayOfWeek)
    }
  }, [groupedAvailabilityEntries, selectedAvailabilitySummaryDay])

  return (
    <WorkspaceScaffold
      title="Coach Schedule Workspace"
      subtitle="Manage weekly availability and review booked PT sessions."
      links={coachNav}
    >
      <div className="space-y-6">
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('availability')}
            className={`px-4 py-2 text-sm font-medium transition ${activeTab === 'availability'
              ? 'border-b-2 border-gym-600 text-gym-700'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Update availability
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 text-sm font-medium transition ${activeTab === 'schedule'
              ? 'border-b-2 border-gym-600 text-gym-700'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Booked sessions
          </button>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-medium">Note:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Update availability</strong>: Choose your recurring Monday-Sunday working slots. Those slots appear in the customer booking flow.
            </li>
            <li>
              <strong>Booked sessions</strong>: Review customer sessions in a monthly calendar and open each day to manage its agenda.
            </li>
          </ul>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
            <button onClick={() => setError('')} className="ml-2 font-semibold">
              x
            </button>
          </div>
        )}
        {message && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
            <button onClick={() => setMessage('')} className="ml-2 font-semibold">
              x
            </button>
          </div>
        )}

        {activeTab === 'availability' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Weekly working schedule</h2>
              <p className="mt-1 text-sm text-slate-600">
                Choose the recurring slots when you can take customers. Selected slots become bookable on the customer PT planner.
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                Select a weekday card first, then toggle its available slots.
              </p>

              {loading && timeSlots.length === 0 ? (
                <div className="mt-6 text-center text-sm text-slate-600">Loading time slots...</div>
              ) : timeSlots.length === 0 ? (
                <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  No time slot data is available. Check the API connection or restart the backend.
                </div>
              ) : (
                <div className="mt-6 grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Weekly view</p>
                        <h4 className="text-lg font-bold text-slate-900">Monday to Sunday selector</h4>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 shadow-sm">
                        {selectedAvailabilityEntries.length} slot(s) selected
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {DAYS.map((day) => (
                        <button
                          key={`availability-day-${day.dayOfWeek}`}
                          type="button"
                          onClick={() => setSelectedAvailabilityDay(day.dayOfWeek)}
                          className={`rounded-2xl border px-3 py-3 text-left transition ${selectedAvailabilityDay === day.dayOfWeek
                            ? 'border-gym-600 bg-gym-50 text-gym-900 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-gym-300 hover:bg-slate-50'
                            }`}
                        >
                          <div className="text-sm font-bold">{day.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {availabilityCountByDay.get(day.dayOfWeek) || 0} slot(s) selected
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Selected weekday</p>
                      <h4 className="mt-1 text-lg font-bold text-slate-900">{selectedAvailabilityDayName}</h4>
                      <p className="mt-1 text-sm text-slate-500">Toggle the slots you want customers to see for this day.</p>
                    </div>

                    <div className="mt-4 flex-1 space-y-2">
                      {timeSlots.map((slot) => {
                        const selected = availability[`${selectedAvailabilityDay}-${slot.timeSlotId}`] === true
                        return (
                          <button
                            key={`availability-slot-${selectedAvailabilityDay}-${slot.timeSlotId}`}
                            type="button"
                            onClick={() => toggleSlot(selectedAvailabilityDay, slot.timeSlotId)}
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selected
                              ? 'border-gym-600 bg-gym-600 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-gym-400 hover:bg-gym-50'
                              }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold">Slot {slot.slotIndex}</div>
                                <div className={`text-xs ${selected ? 'text-gym-50/90' : 'text-slate-500'}`}>
                                  {String(slot.startTime || '').slice(0, 5)} - {String(slot.endTime || '').slice(0, 5)}
                                </div>
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${selected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                {selected ? 'Available' : 'Hidden'}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Selected availability</p>
                    <p className="mt-1 text-sm text-slate-600">Review or remove any saved weekday slot before you update your public availability.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAvailability}
                    disabled={loading}
                    className="rounded-lg bg-gym-600 px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-gym-700 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save availability'}
                  </button>
                </div>

                {selectedAvailabilityEntries.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No weekly slots selected yet.</p>
                ) : (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <WeekdayDropdown
                          id="availability-summary-day"
                          label="Weekday"
                          value={selectedAvailabilitySummaryGroup?.dayOfWeek || ''}
                          onChange={(nextValue) => setSelectedAvailabilitySummaryDay(Number(nextValue))}
                          options={groupedAvailabilityEntries.map((day) => ({
                            value: day.dayOfWeek,
                            label: day.name,
                            meta: `${day.slots.length} slot(s) ready to review or remove`,
                            badge: `${day.slots.length} slot${day.slots.length > 1 ? 's' : ''}`,
                          }))}
                          summaryText="Choose a weekday summary to review or clean up."
                        />
                      </div>
                      {selectedAvailabilitySummaryGroup ? (
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {selectedAvailabilitySummaryGroup.slots.length} slot(s) selected for {selectedAvailabilitySummaryGroup.name}
                        </div>
                      ) : null}
                    </div>

                    {selectedAvailabilitySummaryGroup ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {selectedAvailabilitySummaryGroup.slots.map((entry) => (
                          <button
                            key={`selected-${entry.dayOfWeek}-${entry.timeSlotId}`}
                            type="button"
                            onClick={() => toggleSlot(entry.dayOfWeek, entry.timeSlotId)}
                            className="inline-flex w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                            title="Remove availability slot"
                          >
                            <span className="shrink-0">Slot {entry.slotIndex}</span>
                            <span className="min-w-0 flex-1 truncate text-slate-400">{String(entry.startTime || '').slice(0, 5)}-{String(entry.endTime || '').slice(0, 5)}</span>
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
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Booked sessions</h2>
                <p className="mt-0.5 text-sm text-slate-500">Sessions that customers have already booked with you</p>
              </div>
              <button
                onClick={loadMySchedule}
                className="rounded-lg bg-gym-50 px-3 py-1.5 text-sm font-bold text-gym-600 transition-colors hover:text-gym-700"
              >
                Refresh
              </button>
            </div>

            {loading && <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-50" />)}</div>}

            {!loading && mySchedule.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <svg className="h-8 w-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="font-bold text-slate-900">No booked sessions yet</p>
                <p className="mt-1 text-sm text-slate-500">Customers will appear here once they book sessions with you.</p>
              </div>
            )}

            {!loading && mySchedule.length > 0 && (
              <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Monthly view</p>
                      <h4 className="text-lg font-bold text-slate-900">Your booked-session calendar</h4>
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
                        <div key={`schedule-header-${day.dayOfWeek}`} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
                            aria-label={hasSessions ? `${day.value}, ${daySessions.length} booked session${daySessions.length > 1 ? 's' : ''}` : day.value}
                            className={`min-h-24 rounded-2xl border p-2 text-left transition ${hasSessions
                              ? dayAppearance.dayClass
                              : day.isCurrentMonth
                                ? 'border-slate-200 bg-white text-slate-700'
                                : 'border-slate-100 bg-slate-100 text-slate-300'
                              } ${isSelected ? 'ring-2 ring-sky-400 ring-offset-1' : ''} ${hasSessions ? 'cursor-pointer' : 'cursor-default'}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={`text-sm font-semibold ${day.isCurrentMonth ? 'text-slate-800' : 'text-slate-300'}`}>{day.dayNumber}</span>
                              {hasSessions && <span className={`mt-1 h-2.5 w-2.5 rounded-full ${dayAppearance.dotClass}`} />}
                            </div>
                            {hasSessions && (
                              <div className="mt-6">
                                <div className={`inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold ${dayAppearance.countClass}`}>
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
                  <h4 className="mt-2 text-lg font-bold text-slate-900">{formatHumanDate(selectedScheduleDate)}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    Dates with booked sessions are marked with a green signal in the calendar.
                  </p>

                  <div className="mt-4 space-y-3">
                    {selectedScheduleItems.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        No booked sessions selected for this day.
                      </div>
                    )}
                    {selectedScheduleItems.map((session) => {
                      const appearance = getStatusAppearance(session.status)
                      return (
                        <div key={session.ptSessionId} className={`rounded-2xl border p-4 space-y-3 ${appearance.card}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h5 className="font-bold text-slate-900">{session.customerName}</h5>
                              <p className="text-sm text-slate-600">
                                Slot {session.slotIndex} | {String(session.startTime || '').slice(0, 5)} - {String(session.endTime || '').slice(0, 5)}
                              </p>
                            </div>
                            <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${appearance.badge}`}>
                              <span className={`h-2 w-2 rounded-full ${appearance.dot}`} />
                              {appearance.label}
                            </span>
                          </div>

                          <div className="space-y-1 text-xs text-slate-600">
                            {session.customerPhone && <div>Phone: {session.customerPhone}</div>}
                            {session.customerEmail && <div>Email: {session.customerEmail}</div>}
                            {String(session.status || '').toUpperCase() === 'CANCELLED' && session.cancelReason && (
                              <div className="font-medium text-red-700">Cancellation reason: {session.cancelReason}</div>
                            )}
                          </div>

                          {String(session.status || '').toUpperCase() === 'SCHEDULED' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openCancelModal(session)}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => openConfirmAction('complete', session.ptSessionId)}
                                className="rounded-lg bg-gym-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-gym-700"
                              >
                                Complete
                              </button>
                            </div>
                          )}

                          {String(session.status || '').toUpperCase() === 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => openConfirmAction('delete', session.ptSessionId)}
                              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              Delete notice
                            </button>
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
      </div>

      {cancelModal.open && cancelModal.session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-500">Cancel PT session</p>
              <h4 className="text-2xl font-bold text-slate-900">Cancel this customer session?</h4>
              <p className="text-sm leading-relaxed text-slate-600">
                This will notify the customer and mark the session as cancelled for both sides.
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{cancelModal.session.customerName || 'Assigned customer'}</p>
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
                placeholder="Tell the customer why you need to cancel this session."
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
    </WorkspaceScaffold>
  )
}

export default CoachSchedulePage
