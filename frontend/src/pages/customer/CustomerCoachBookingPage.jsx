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

function CustomerCoachBookingPage() {
  const [activeTab, setActiveTab] = useState('match')
  const [timeSlots, setTimeSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    slots: [],
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

  function toggleSlot(dayOfWeek, timeSlotId) {
    const exists = form.slots.some((s) => s.dayOfWeek === dayOfWeek && s.timeSlotId === timeSlotId)
    if (exists) {
      setForm((prev) => ({
        ...prev,
        slots: prev.slots.filter((s) => !(s.dayOfWeek === dayOfWeek && s.timeSlotId === timeSlotId)),
      }))
      return
    }
    setForm((prev) => ({
      ...prev,
      slots: [...prev.slots, { dayOfWeek, timeSlotId }],
    }))
  }

  function isSelected(dayOfWeek, timeSlotId) {
    return form.slots.some((s) => s.dayOfWeek === dayOfWeek && s.timeSlotId === timeSlotId)
  }

  async function previewMatches() {
    if (!form.startDate || !form.endDate || form.slots.length === 0) {
      setError('Please choose start date, end date, and at least one desired weekly slot.')
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
        slots: form.slots,
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
    if (!form.startDate || !form.endDate || form.slots.length === 0) {
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
        slots: form.slots,
      })
      setMessage('Booking request sent. Coach will approve or deny your request.')
      setActiveTab('schedule')
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
              <h3 className="text-lg font-bold text-slate-900">1) Set Desired PT Schedule</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm font-semibold text-slate-700">Start date
                  <input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" />
                </label>
                <label className="text-sm font-semibold text-slate-700">End date
                  <input type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2" />
                </label>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">Desired weekly recurring slots ({form.slots.length} selected)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {DAYS.map((day) => (
                    <div key={day.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{day.label}</p>
                      <div className="space-y-2">
                        {timeSlots.map((slot) => (
                          <button
                            key={`${day.id}-${slot.timeSlotId}`}
                            onClick={() => toggleSlot(day.id, slot.timeSlotId)}
                            className={`w-full text-left px-3 py-2 rounded-lg border ${isSelected(day.id, slot.timeSlotId) ? 'bg-gym-600 text-white border-gym-600' : 'bg-white text-slate-700 border-slate-200 hover:border-gym-400'}`}
                          >
                            <span className="text-xs font-semibold block">Slot {slot.slotIndex}</span>
                            <span className="text-xs">{String(slot.startTime || '').slice(0, 5)} - {String(slot.endTime || '').slice(0, 5)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={previewMatches} disabled={loading} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-700 disabled:opacity-50">
                {loading ? 'Loading...' : '2) Preview Matches'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <h4 className="text-lg font-bold text-emerald-800">Fully Match</h4>
                <p className="text-sm text-emerald-700">Coaches whose requested slots are all available in your selected period.</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {matches.fullMatches.length === 0 && <p className="text-sm text-slate-600">No fully matched coach yet.</p>}
                  {matches.fullMatches.map((coach) => (
                    <CoachCard key={`full-${coach.coachId}`} coach={coach} onRequest={requestCoach} />
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <h4 className="text-lg font-bold text-amber-800">Partial Match</h4>
                <p className="text-sm text-amber-700">Coaches with overlap but some requested slots already occupied or unavailable.</p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {matches.partialMatches.length === 0 && <p className="text-sm text-slate-600">No partial matched coach yet.</p>}
                  {matches.partialMatches.map((coach) => (
                    <CoachCard key={`partial-${coach.coachId}`} coach={coach} onRequest={requestCoach} />
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

function CoachCard({ coach, onRequest }) {
  const unavailableSlots = Array.isArray(coach.unavailableSlots) ? coach.unavailableSlots : []
  const bookedCount = unavailableSlots.filter((s) => s.reason === 'BOOKED_IN_RANGE').length
  const weeklyUnavailableCount = unavailableSlots.filter((s) => s.reason === 'NO_WEEKLY_AVAILABILITY').length

  return (
    <article className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="font-bold text-slate-900">{coach.fullName}</h5>
          <p className="text-xs text-slate-500">{coach.email}</p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700">
          {coach.matchedSlots}/{coach.requestedSlots} slots
        </span>
      </div>
      <p className="text-sm text-slate-600">{coach.bio || 'No bio'}</p>
      <div className="text-xs text-slate-600">
        {bookedCount > 0 && <div>{bookedCount} slot(s) already booked in selected range.</div>}
        {weeklyUnavailableCount > 0 && <div>{weeklyUnavailableCount} slot(s) not in coach weekly availability.</div>}
      </div>
      <button onClick={() => onRequest(coach.coachId)} className="w-full mt-2 px-3 py-2 rounded-lg bg-gym-600 text-white text-sm font-semibold hover:bg-gym-700">
        Request This Coach
      </button>
    </article>
  )
}

export default CustomerCoachBookingPage
