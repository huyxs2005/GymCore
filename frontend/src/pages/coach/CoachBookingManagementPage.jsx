import { useEffect, useState } from 'react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { coachNav } from '../../config/navigation'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'

function CoachBookingManagementPage() {
  const [requests, setRequests] = useState([])
  const [rescheduleRequests, setRescheduleRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [bookingActionModal, setBookingActionModal] = useState({
    open: false,
    request: null,
    action: '',
    reason: '',
  })
  const [rescheduleActionModal, setRescheduleActionModal] = useState({
    open: false,
    request: null,
    action: '',
    reason: '',
  })

  useEffect(() => {
    loadRequests()
  }, [])

  async function loadRequests() {
    try {
      setLoading(true)
      const [bookingData, rescheduleData] = await Promise.all([
        coachBookingApi.getPendingRequests(),
        coachBookingApi.getRescheduleRequests(),
      ])
      setRequests(bookingData?.data?.items || [])
      setRescheduleRequests(rescheduleData?.data?.items || [])
    } catch {
      setError('Cannot load booking requests')
    } finally {
      setLoading(false)
    }
  }

  function openBookingActionModal(request, action) {
    setBookingActionModal({
      open: true,
      request,
      action,
      reason: '',
    })
  }

  function closeBookingActionModal() {
    setBookingActionModal({
      open: false,
      request: null,
      action: '',
      reason: '',
    })
  }

  function openRescheduleActionModal(request, action) {
    setRescheduleActionModal({
      open: true,
      request,
      action,
      reason: '',
    })
  }

  function closeRescheduleActionModal() {
    setRescheduleActionModal({
      open: false,
      request: null,
      action: '',
      reason: '',
    })
  }

  async function submitBookingAction() {
    const requestId = bookingActionModal.request?.ptRequestId
    if (!requestId) return

    const isDeny = bookingActionModal.action === 'DENY'
    const reason = bookingActionModal.reason.trim()
    if (isDeny && !reason) {
      setError('Deny reason is required.')
      return
    }

    try {
      setLoading(true)
      await coachBookingApi.actionRequest(
        requestId,
        bookingActionModal.action,
        isDeny ? { reason } : {},
      )
      closeBookingActionModal()
      setMessage(bookingActionModal.action === 'ACCEPT'
        ? 'Booking request approved and sessions generated.'
        : 'Booking request denied.')
      await loadRequests()
    } catch (err) {
      setError(err?.response?.data?.message || 'Booking request action failed')
      await loadRequests()
    } finally {
      setLoading(false)
    }
  }

  async function submitRescheduleAction() {
    const sessionId = rescheduleActionModal.request?.ptSessionId
    if (!sessionId) return

    try {
      setLoading(true)
      if (rescheduleActionModal.action === 'APPROVE') {
        await coachBookingApi.approveRescheduleRequest(sessionId)
        setMessage('Reschedule request approved.')
      } else {
        const reason = rescheduleActionModal.reason.trim()
        await coachBookingApi.denyRescheduleRequest(
          sessionId,
          reason ? { reason } : {},
        )
        setMessage('Reschedule request denied.')
      }
      closeRescheduleActionModal()
      await loadRequests()
    } catch (err) {
      setError(err?.response?.data?.message || 'Reschedule action failed')
      await loadRequests()
    } finally {
      setLoading(false)
    }
  }

  const getStatusStyle = (status) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-100 text-amber-700'
      case 'APPROVED':
        return 'bg-green-100 text-green-700'
      case 'DENIED':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-slate-100 text-slate-700'
    }
  }

  if (loading && requests.length === 0 && rescheduleRequests.length === 0) {
    return (
      <WorkspaceScaffold title="Coach Booking Management" subtitle="Approve or deny booking and reschedule requests" links={coachNav}>
        <div className="max-w-6xl mx-auto space-y-6 pb-10">
          <div className="text-center py-10 text-slate-500">Loading...</div>
        </div>
      </WorkspaceScaffold>
    )
  }

  return (
    <WorkspaceScaffold title="Coach Booking Management" subtitle="Approve or deny booking and reschedule requests" links={coachNav}>
      <div className="max-w-6xl mx-auto space-y-6 pb-10">
        {(error || message) && (
          <div className={`p-4 rounded-xl flex items-center justify-between ${error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            <span>{error || message}</span>
            <button onClick={() => { setError(''); setMessage('') }}>x</button>
          </div>
        )}

        {rescheduleRequests.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Reschedule Requests ({rescheduleRequests.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {rescheduleRequests.map((req) => (
                <div key={req.ptSessionId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900">{req.customerName}</h4>
                        <p className="text-xs text-slate-500">{req.customerEmail}</p>
                      </div>
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">PENDING</span>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-2">
                      <p className="text-slate-600">Current: <span className="font-semibold">{req.currentSessionDate}</span> - Slot {req.currentSlot?.slotIndex || req.currentTimeSlotId}</p>
                      <p className="text-slate-900">Requested: <span className="font-semibold">{req.requestedSessionDate}</span> - Slot {req.requestedSlot?.slotIndex || req.requestedTimeSlotId}</p>
                      {req.reason && <p className="text-slate-700">Customer reason: <span className="font-semibold">{req.reason}</span></p>}
                      {!req.weeklyAvailable && <p className="text-red-600 text-xs font-semibold">Requested slot is not in your weekly availability.</p>}
                      {req.hasConflict && <p className="text-red-600 text-xs font-semibold">Requested slot conflicts with another session.</p>}
                    </div>
                  </div>
                  <div className="px-5 pb-5 flex gap-3">
                    <button
                      onClick={() => openRescheduleActionModal(req, 'APPROVE')}
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-xl bg-gym-500 text-white font-bold hover:bg-gym-600 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => openRescheduleActionModal(req, 'DENY')}
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-50"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && requests.length === 0 && rescheduleRequests.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center">
            <h3 className="text-lg font-bold text-slate-800">No pending requests</h3>
            <p className="text-slate-500">There are no booking/reschedule requests to process.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {requests.map((req) => (
            <div key={req.ptRequestId} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 flex-1 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{req.customerName}</h3>
                    <p className="text-sm text-slate-500">{req.customerEmail}</p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusStyle(req.status)}`}>
                    {req.status}
                  </span>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Requested window:</span>
                    <span className="font-semibold text-slate-800">{req.startDate} to {req.endDate}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Approval starts recurring sessions from the next Monday after you approve.
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Submitted:</span>
                    <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-4">
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => openBookingActionModal(req, 'ACCEPT')}
                    disabled={loading}
                    className="flex-1 py-3 bg-gym-500 text-white rounded-xl font-bold hover:bg-gym-600 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => openBookingActionModal(req, 'DENY')}
                    disabled={loading}
                    className="flex-1 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Deny
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {bookingActionModal.open && bookingActionModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${bookingActionModal.action === 'ACCEPT' ? 'text-gym-600' : 'text-rose-500'}`}>
              {bookingActionModal.action === 'ACCEPT' ? 'Approve booking request' : 'Deny booking request'}
            </p>
            <h4 className="mt-2 text-2xl font-bold text-slate-900">
              {bookingActionModal.action === 'ACCEPT' ? 'Confirm this PT booking request?' : 'Deny this PT booking request?'}
            </h4>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {bookingActionModal.request.customerName} requested sessions from {bookingActionModal.request.startDate} to {bookingActionModal.request.endDate}.
            </p>

            {bookingActionModal.action === 'DENY' && (
              <label className="mt-5 block text-sm font-semibold text-slate-700">
                Reason for denial
                <textarea
                  value={bookingActionModal.reason}
                  onChange={(e) => setBookingActionModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-700"
                  rows={3}
                  placeholder="Explain why you cannot take this booking request."
                />
              </label>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeBookingActionModal}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={submitBookingAction}
                disabled={loading}
                className={`rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${bookingActionModal.action === 'ACCEPT' ? 'bg-gym-600 hover:bg-gym-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {bookingActionModal.action === 'ACCEPT' ? 'Approve request' : 'Confirm denial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleActionModal.open && rescheduleActionModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${rescheduleActionModal.action === 'APPROVE' ? 'text-gym-600' : 'text-rose-500'}`}>
              {rescheduleActionModal.action === 'APPROVE' ? 'Approve reschedule request' : 'Deny reschedule request'}
            </p>
            <h4 className="mt-2 text-2xl font-bold text-slate-900">
              {rescheduleActionModal.action === 'APPROVE' ? 'Approve this reschedule request?' : 'Deny this reschedule request?'}
            </h4>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
              <p className="text-slate-600">Customer: <span className="font-semibold text-slate-900">{rescheduleActionModal.request.customerName}</span></p>
              <p className="text-slate-600">Current slot: <span className="font-semibold text-slate-900">{rescheduleActionModal.request.currentSessionDate} - Slot {rescheduleActionModal.request.currentSlot?.slotIndex || rescheduleActionModal.request.currentTimeSlotId}</span></p>
              <p className="text-slate-600">Requested slot: <span className="font-semibold text-slate-900">{rescheduleActionModal.request.requestedSessionDate} - Slot {rescheduleActionModal.request.requestedSlot?.slotIndex || rescheduleActionModal.request.requestedTimeSlotId}</span></p>
              {rescheduleActionModal.request.reason && <p className="text-slate-700">Customer reason: <span className="font-semibold">{rescheduleActionModal.request.reason}</span></p>}
            </div>

            {rescheduleActionModal.action === 'DENY' && (
              <label className="mt-5 block text-sm font-semibold text-slate-700">
                Reason for denial (optional)
                <textarea
                  value={rescheduleActionModal.reason}
                  onChange={(e) => setRescheduleActionModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-700"
                  rows={3}
                  placeholder="Explain why you cannot accept this requested slot."
                />
              </label>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeRescheduleActionModal}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Keep current session
              </button>
              <button
                type="button"
                onClick={submitRescheduleAction}
                disabled={loading}
                className={`rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${rescheduleActionModal.action === 'APPROVE' ? 'bg-gym-600 hover:bg-gym-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {rescheduleActionModal.action === 'APPROVE' ? 'Approve request' : 'Confirm denial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CoachBookingManagementPage
