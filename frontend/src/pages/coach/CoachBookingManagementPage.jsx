import { useState, useEffect } from 'react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { coachNav } from '../../config/navigation'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'

function CoachBookingManagementPage() {
  const [requests, setRequests] = useState([])
  const [rescheduleRequests, setRescheduleRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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
    } catch (err) {
      setError('Cannot load booking requests')
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(requestId, action) {
    if (!confirm(`Confirm ${action === 'ACCEPT' ? 'approve' : 'deny'} this booking request?`)) return
    try {
      setLoading(true)
      let body = {}
      if (action === 'DENY') {
        const reason = prompt('Reason for denial (shown to customer):', '')
        if (reason === null) {
          setLoading(false)
          return
        }
        if (!String(reason).trim()) {
          setError('Deny reason is required.')
          setLoading(false)
          return
        }
        body = { reason: String(reason).trim() }
      }
      await coachBookingApi.actionRequest(requestId, action, body)
      setMessage(action === 'ACCEPT' ? 'Booking request approved and sessions generated.' : 'Booking request denied.')
      loadRequests()
    } catch (err) {
      setError(err?.response?.data?.message || 'Booking request action failed')
      loadRequests()
    } finally {
      setLoading(false)
    }
  }

  async function handleRescheduleAction(sessionId, action) {
    if (!confirm(`Confirm ${action === 'APPROVE' ? 'approve' : 'deny'} this reschedule request?`)) return
    try {
      setLoading(true)
      if (action === 'APPROVE') {
        await coachBookingApi.approveRescheduleRequest(sessionId)
        setMessage('Reschedule request approved.')
      } else {
        await coachBookingApi.denyRescheduleRequest(sessionId)
        setMessage('Reschedule request denied.')
      }
      loadRequests()
    } catch (err) {
      setError(err?.response?.data?.message || 'Reschedule action failed')
      loadRequests()
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
                      {!req.weeklyAvailable && <p className="text-red-600 text-xs font-semibold">Requested slot is not in your weekly availability.</p>}
                      {req.hasConflict && <p className="text-red-600 text-xs font-semibold">Requested slot conflicts with another session.</p>}
                    </div>
                  </div>
                  <div className="px-5 pb-5 flex gap-3">
                    <button
                      onClick={() => handleRescheduleAction(req.ptSessionId, 'APPROVE')}
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-xl bg-gym-500 text-white font-bold hover:bg-gym-600 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRescheduleAction(req.ptSessionId, 'DENY')}
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
                    <span className="text-slate-500">Period:</span>
                    <span className="font-semibold text-slate-800">{req.startDate} to {req.endDate}</span>
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
                    onClick={() => handleAction(req.ptRequestId, 'ACCEPT')}
                    disabled={loading}
                    className="flex-1 py-3 bg-gym-500 text-white rounded-xl font-bold hover:bg-gym-600 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleAction(req.ptRequestId, 'DENY')}
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
    </WorkspaceScaffold>
  )
}

export default CoachBookingManagementPage
