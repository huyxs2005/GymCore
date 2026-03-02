import { useState, useEffect, useRef } from 'react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { coachNav } from '../../config/navigation'
import { coachApi } from '../../features/coach/api/coachApi'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'

function CoachSchedulePage() {
  const [activeTab, setActiveTab] = useState('availability')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [mySchedule, setMySchedule] = useState([])

  const defaultTimeSlots = [
    { timeSlotId: 1, slotIndex: 1, startTime: '07:00', endTime: '08:30' },
    { timeSlotId: 2, slotIndex: 2, startTime: '08:30', endTime: '10:00' },
    { timeSlotId: 3, slotIndex: 3, startTime: '10:00', endTime: '11:30' },
    { timeSlotId: 4, slotIndex: 4, startTime: '11:30', endTime: '13:00' },
    { timeSlotId: 5, slotIndex: 5, startTime: '13:00', endTime: '14:30' },
    { timeSlotId: 6, slotIndex: 6, startTime: '14:30', endTime: '16:00' },
    { timeSlotId: 7, slotIndex: 7, startTime: '16:00', endTime: '17:30' },
    { timeSlotId: 8, slotIndex: 8, startTime: '17:30', endTime: '19:00' },
  ]

  const [timeSlots, setTimeSlots] = useState(defaultTimeSlots)
  const [availability, setAvailability] = useState({})

  useEffect(() => {
    loadTimeSlots()
  }, [])

  const isFirstAvailabilityView = useRef(true)
  useEffect(() => {
    if (activeTab !== 'availability') return
    if (isFirstAvailabilityView.current) {
      isFirstAvailabilityView.current = false
      return
    }
    loadMyAvailability()
  }, [activeTab])

  const daysOfWeek = [
    { dayOfWeek: 1, name: 'Monday' },
    { dayOfWeek: 2, name: 'Tuesday' },
    { dayOfWeek: 3, name: 'Wednesday' },
    { dayOfWeek: 4, name: 'Thursday' },
    { dayOfWeek: 5, name: 'Friday' },
    { dayOfWeek: 6, name: 'Saturday' },
    { dayOfWeek: 7, name: 'Sunday' },
  ]

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
        const d = av.dayOfWeek ?? av.DayOfWeek
        const t = av.timeSlotId ?? av.timeSlotID ?? av.TimeSlotID
        if (d != null && t != null) next[`${d}-${t}`] = true
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
        setError('')
      } else {
        setError('')
      }
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
      setMySchedule(response.data?.items || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load schedule.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCompleteSession(sessionId) {
    if (!window.confirm('Mark this session as completed?')) return
    try {
      setLoading(true)
      await coachBookingApi.completeSession(sessionId)
      setMySchedule(prev => prev.map(s => s.ptSessionId === sessionId ? { ...s, status: 'COMPLETED' } : s))
      setMessage('Session marked as completed.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not complete the session.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteSession(sessionId) {
    if (!window.confirm('Delete this cancelled session notice?')) return
    try {
      setLoading(true)
      await coachBookingApi.deleteSession(sessionId)
      setMySchedule(prev => prev.filter(s => s.ptSessionId !== sessionId))
      setMessage('Cancelled session notice deleted.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not delete the session.')
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
      daysOfWeek.forEach((day) => {
        timeSlots.forEach((slot) => {
          const key = `${day.dayOfWeek}-${slot.timeSlotId}`
          const isChecked = availability[key] === true
          slots.push({
            dayOfWeek: day.dayOfWeek,
            timeSlotId: slot.timeSlotId,
            isAvailable: isChecked,
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
              <strong>Update availability</strong>: Select the slots when you are available to train customers each week. Those slots appear in the booking flow.
            </li>
            <li>
              <strong>Booked sessions</strong>: Shows customer sessions already assigned to you.
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
                Select the time slots when you can take customers. Selected slots will be visible on the customer booking page.
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                After selecting your slots, click <strong>Save availability</strong>.
              </p>

              {loading && timeSlots.length === 0 ? (
                <div className="mt-6 text-center text-sm text-slate-600">Loading time slots...</div>
              ) : timeSlots.length === 0 ? (
                <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  No time slot data is available. Check the API connection or restart the backend.
                </div>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Day</th>
                        {timeSlots.map((slot) => (
                          <th key={slot.timeSlotId} className="px-3 py-3 text-center text-xs font-medium text-slate-600">
                            Slot {slot.slotIndex}
                            <br />
                            <span className="text-xs text-slate-500">{slot.startTime}-{slot.endTime}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {daysOfWeek.map((day) => (
                        <tr key={day.dayOfWeek} className="border-b border-slate-100">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{day.name}</td>
                          {timeSlots.map((slot) => {
                            const key = `${day.dayOfWeek}-${slot.timeSlotId}`
                            const isChecked = availability[key] === true
                            return (
                              <td key={slot.timeSlotId} className="px-3 py-3 text-center">
                                <label className="flex cursor-pointer items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleSlot(day.dayOfWeek, slot.timeSlotId)}
                                    className="h-5 w-5 rounded border-slate-300 text-gym-600 focus:ring-gym-500"
                                  />
                                </label>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border-2 border-dashed border-gym-300 bg-gym-50 px-4 py-4">
                <span className="text-sm font-medium text-slate-700">Finished selecting slots? Save your availability on the right.</span>
                <button
                  type="button"
                  onClick={handleSaveAvailability}
                  disabled={loading}
                  className="rounded-lg bg-gym-600 px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-gym-700 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save availability'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Booked sessions</h2>
                <p className="mt-0.5 text-sm text-slate-500">Sessions that customers have already booked with you</p>
              </div>
              <button onClick={loadMySchedule} className="rounded-lg bg-gym-50 px-3 py-1.5 text-sm font-bold text-gym-600 transition-colors hover:text-gym-700">Refresh</button>
            </div>

            {loading && <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-50" />)}</div>}

            {!loading && mySchedule.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <svg className="h-8 w-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="font-bold text-slate-900">No booked sessions yet</p>
                <p className="mt-1 text-sm text-slate-500">Customers will appear here once they book sessions with you.</p>
              </div>
            )}

            {!loading && mySchedule.length > 0 && (() => {
              const grouped = {}
              mySchedule.forEach(s => {
                const d = s.sessionDate
                if (!grouped[d]) grouped[d] = []
                grouped[d].push(s)
              })
              const sortedDates = Object.keys(grouped).sort()
              return (
                <div className="space-y-5">
                  {sortedDates.map(date => (
                    <div key={date}>
                      <div className="mb-2 flex items-center gap-3">
                        <div className="rounded-xl bg-gym-600 px-3 py-1.5 text-xs font-black text-white">
                          {new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="h-px flex-1 bg-slate-100" />
                        <span className="text-xs font-medium text-slate-400">{grouped[date].length} session(s)</span>
                      </div>
                      <div className="space-y-2">
                        {grouped[date].map(session => {
                          const statusMap = {
                            SCHEDULED: { label: 'Upcoming', dot: 'bg-blue-500', card: 'border-blue-100 bg-blue-50/30', badge: 'bg-blue-100 text-blue-700' },
                            COMPLETED: { label: 'Completed', dot: 'bg-green-500', card: 'border-green-100 bg-green-50/30', badge: 'bg-green-100 text-green-700' },
                            CANCELLED: { label: 'Cancelled', dot: 'bg-red-400', card: 'border-red-100 bg-red-50/20 opacity-60', badge: 'bg-red-100 text-red-600' },
                          }
                          const sc = statusMap[session.status] ?? { label: session.status, dot: 'bg-slate-400', card: 'border-slate-100', badge: 'bg-slate-100 text-slate-600' }
                          return (
                            <div key={session.ptSessionId} className={`flex items-center gap-4 rounded-xl border px-4 py-3 transition-all ${sc.card}`}>
                              <div className="w-24 shrink-0 text-center">
                                <p className="text-sm font-black text-slate-800">{session.startTime?.substring(0, 5)}</p>
                                <p className="text-[10px] font-medium text-slate-400">{session.endTime?.substring(0, 5)} | Slot {session.slotIndex}</p>
                              </div>
                              <div className={`h-2 w-2 shrink-0 rounded-full ${sc.dot}`} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-bold text-slate-900">{session.customerName}</p>
                                <div className="mt-0.5 flex flex-wrap gap-3">
                                  {session.customerPhone && <span className="text-xs text-slate-500">Phone: {session.customerPhone}</span>}
                                  {session.customerEmail && <span className="truncate text-xs text-slate-500">Email: {session.customerEmail}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${sc.badge}`}>{sc.label}</span>
                                {session.status === 'SCHEDULED' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCompleteSession(session.ptSessionId)
                                    }}
                                    className="rounded-lg bg-gym-600 px-3 py-1.5 text-[10px] font-bold text-white shadow-sm transition-colors hover:bg-gym-700"
                                  >
                                    Complete
                                  </button>
                                )}
                                {session.status === 'CANCELLED' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteSession(session.ptSessionId)
                                    }}
                                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                    title="Delete this notice"
                                  >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </WorkspaceScaffold>
  )
}

export default CoachSchedulePage
