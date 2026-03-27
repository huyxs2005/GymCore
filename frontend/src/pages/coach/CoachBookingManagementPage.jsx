import { useEffect, useState } from 'react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { coachNav } from '../../config/navigation'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'
import { Calendar, Clock, User, Mail, CheckCircle2, XCircle, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react'

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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
    confirmSlots: false,
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
      confirmSlots: false,
    })
  }

  function closeBookingActionModal() {
    setBookingActionModal({
      open: false,
      request: null,
      action: '',
      reason: '',
      confirmSlots: false,
    })
  }

  function formatRequestedSlot(slot) {
    const dayLabel = DAY_LABELS[Math.max(0, Number(slot?.dayOfWeek || 1) - 1)] || `Day ${slot?.dayOfWeek || ''}`
    const slotIndex = Number(slot?.slotIndex || slot?.timeSlotId || 0)
    const start = String(slot?.startTime || '').slice(0, 5)
    const end = String(slot?.endTime || '').slice(0, 5)
    return start && end
      ? `${dayLabel} • Slot ${slotIndex} (${start}-${end})`
      : `${dayLabel} • Slot ${slotIndex}`
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
    if (!isDeny && !bookingActionModal.confirmSlots) {
      setError('Please confirm the customer requested slots before approving.')
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING':
        return <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-500 border border-amber-500/20">Pending</span>
      case 'APPROVED':
        return <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500 border border-emerald-500/20">Approved</span>
      case 'DENIED':
        return <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-500 border border-rose-500/20">Denied</span>
      default:
        return <span className="rounded-full bg-slate-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-500/20">{status}</span>
    }
  }

  const ModalHeader = ({ title, kicker, icon: Icon, colorClass }) => (
    <div className="mb-6">
      <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-${colorClass}-500/10 ring-1 ring-${colorClass}-500/20`}>
        <Icon className={`h-6 w-6 text-${colorClass}-500`} />
      </div>
      <p className="gc-section-kicker">{kicker}</p>
      <h4 className="mt-2 font-display text-2xl font-bold tracking-tight text-white">{title}</h4>
    </div>
  )

  return (
    <WorkspaceScaffold 
      showHeader={false}
    >
      <div className="max-w-6xl space-y-8 pb-12">
        {/* Messages */}
        {(error || message) && (
          <div className={`gc-card-compact flex items-center justify-between border-l-4 ${error ? 'border-l-rose-500 bg-rose-500/5' : 'border-l-emerald-500 bg-emerald-500/5'}`}>
            <div className="flex items-center gap-3">
              {error ? <AlertCircle className="h-5 w-5 text-rose-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              <span className={`text-sm font-medium ${error ? 'text-rose-200' : 'text-emerald-200'}`}>{error || message}</span>
            </div>
            <button 
              onClick={() => { setError(''); setMessage('') }}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-white/5 hover:text-white"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Reschedule Requests */}
        {rescheduleRequests.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div>
                <h3 className="font-display text-xl font-bold tracking-tight text-white">Reschedule Requests</h3>
                <p className="text-sm text-slate-500">Customers requesting changes to existing sessions</p>
              </div>
              <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-black text-slate-950 shadow-glow">
                {rescheduleRequests.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {rescheduleRequests.map((req) => (
                <div key={req.ptSessionId} className="gc-card-compact group border-white/5 bg-white/[0.03] transition duration-300 hover:border-white/10 hover:bg-white/[0.05]">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 group-hover:ring-white/20">
                        <User className="h-5 w-5 text-slate-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white">{req.customerName}</h4>
                        <p className="text-[11px] font-medium text-slate-500">{req.customerEmail}</p>
                      </div>
                    </div>
                    {getStatusBadge('PENDING')}
                  </div>

                  <div className="mb-6 space-y-3">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-white/5 p-4 border border-white/5">
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Current</p>
                        <p className="text-xs font-bold text-slate-300">{req.currentSessionDate}</p>
                        <p className="text-[10px] text-slate-500">Slot {req.currentSlot?.slotIndex || req.currentTimeSlotId}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1">Requested</p>
                        <p className="text-xs font-bold text-white">{req.requestedSessionDate}</p>
                        <p className="text-[10px] text-slate-400">Slot {req.requestedSlot?.slotIndex || req.requestedTimeSlotId}</p>
                      </div>
                    </div>

                    {req.reason && (
                      <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs italic text-slate-400">
                        "{req.reason}"
                      </div>
                    )}

                    <div className="space-y-1">
                      {!req.weeklyAvailable && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>Not in your weekly availability</span>
                        </div>
                      )}
                      {req.hasConflict && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-400">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>Conflicts with another session</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-auto">
                    <button
                      onClick={() => openRescheduleActionModal(req, 'APPROVE')}
                      disabled={loading}
                      className="gc-button-primary flex-1 !min-h-[42px] !py-2 text-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => openRescheduleActionModal(req, 'DENY')}
                      disabled={loading}
                      className="gc-button-secondary flex-1 !min-h-[42px] !py-2 text-sm"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Booking Requests */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div>
              <h3 className="font-display text-xl font-bold tracking-tight text-white">Booking Requests</h3>
              <p className="text-sm text-slate-500">New PT partnership applications</p>
            </div>
            {requests.length > 0 && (
              <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-black text-slate-950 shadow-glow">
                {requests.length}
              </span>
            )}
          </div>

          {!loading && requests.length === 0 && rescheduleRequests.length === 0 && (
            <div className="gc-glass-panel flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                <CheckCircle2 className="h-10 w-10 text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-white font-display">All caught up</h3>
              <p className="mt-2 max-w-xs text-sm text-slate-500">
                There are no pending booking or reschedule requests to process at this moment.
              </p>
              <button 
                onClick={loadRequests} 
                className="mt-6 flex items-center gap-2 text-sm font-bold text-gym-500 transition hover:text-gym-400"
              >
                <RefreshCw className="h-4 w-4" /> Refresh dashboard
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {requests.map((req) => (
              <div key={req.ptRequestId} className="gc-card group border-white/5 bg-white/[0.03] transition duration-300 hover:border-white/10 hover:bg-white/[0.05]">
                <div className="mb-6 flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 group-hover:ring-emerald-500/30">
                      <User className="h-6 w-6 text-slate-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{req.customerName}</h3>
                      <p className="text-xs font-medium text-slate-500">{req.customerEmail}</p>
                    </div>
                  </div>
                  {getStatusBadge(req.status)}
                </div>

                <div className="mb-8 rounded-2xl border border-white/5 bg-white/5 p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">Requested Window</span>
                    <span className="font-bold text-slate-200">{req.startDate} — {req.endDate}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Submitted On</span>
                    <span className="font-medium text-slate-400">{new Date(req.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[10px] font-bold text-amber-500/80 leading-relaxed uppercase tracking-wider">
                      Note: Approval will automatically generate recurring sessions from the following Monday.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-auto">
                  <button
                    onClick={() => openBookingActionModal(req, 'ACCEPT')}
                    disabled={loading}
                    className="gc-button-primary flex-1"
                  >
                    Approve Request
                  </button>
                  <button
                    onClick={() => openBookingActionModal(req, 'DENY')}
                    disabled={loading}
                    className="gc-button-secondary flex-1 border-rose-500/20 text-rose-400 hover:bg-rose-500/5"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Modals */}
      {bookingActionModal.open && bookingActionModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="gc-glass-panel w-full max-w-lg p-8 shadow-2xl overflow-hidden relative">
            <ModalHeader 
              title={bookingActionModal.action === 'ACCEPT' ? 'Confirm Approval' : 'Deny Partnership'}
              kicker="Partnership Action"
              icon={bookingActionModal.action === 'ACCEPT' ? CheckCircle2 : XCircle}
              colorClass={bookingActionModal.action === 'ACCEPT' ? 'emerald' : 'rose'}
            />
            
            <p className="text-sm leading-relaxed text-slate-400">
              You are about to <span className="font-bold text-white">{bookingActionModal.action === 'ACCEPT' ? 'accept' : 'decline'}</span> the training partnership with <span className="font-bold text-white">{bookingActionModal.request.customerName}</span>.
              {bookingActionModal.action === 'ACCEPT' && " Review the customer's requested recurring slots below and confirm them before approval."}
            </p>

            {bookingActionModal.action === 'ACCEPT' && (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Customer requested slots</p>
                  <div className="mt-3 space-y-2">
                    {(bookingActionModal.request?.slots || []).length === 0 ? (
                      <p className="text-sm text-slate-400">No requested slots found on this request.</p>
                    ) : (
                      bookingActionModal.request.slots.map((slot) => (
                        <div key={`approve-slot-${bookingActionModal.request.ptRequestId}-${slot.dayOfWeek}-${slot.timeSlotId}`} className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-200">
                          {formatRequestedSlot(slot)}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={bookingActionModal.confirmSlots}
                    onChange={(e) => setBookingActionModal((prev) => ({ ...prev, confirmSlots: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-transparent text-emerald-500 focus:ring-emerald-500"
                  />
                  <span>I confirm these are the customer&apos;s requested recurring slots for approval.</span>
                </label>
              </div>
            )}

            {bookingActionModal.action === 'DENY' && (
              <div className="mt-6">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Denial Reason
                </label>
                <textarea
                  value={bookingActionModal.reason}
                  onChange={(e) => setBookingActionModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="gc-input min-h-[100px] resize-none"
                  placeholder="Explain why this request is being declined..."
                />
              </div>
            )}

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeBookingActionModal}
                className="gc-button-secondary !px-5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitBookingAction}
                disabled={loading || (bookingActionModal.action === 'ACCEPT' && !bookingActionModal.confirmSlots)}
                className={`${bookingActionModal.action === 'ACCEPT' ? 'gc-button-primary' : 'bg-rose-600 font-semibold text-white hover:bg-rose-700 shadow-lg ring-1 ring-rose-500/50'} rounded-xl px-6 py-2.5 text-sm disabled:opacity-50 transition`}
              >
                {loading ? 'Processing...' : bookingActionModal.action === 'ACCEPT' ? 'Approve Request' : 'Confirm Denial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rescheduleActionModal.open && rescheduleActionModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="gc-glass-panel w-full max-w-lg p-8 shadow-2xl">
            <ModalHeader 
              title={rescheduleActionModal.action === 'APPROVE' ? 'Approve Reschedule' : 'Deny Reschedule'}
              kicker="Session Adjustment"
              icon={RefreshCw}
              colorClass={rescheduleActionModal.action === 'APPROVE' ? 'emerald' : 'rose'}
            />

            <div className="grid grid-cols-2 gap-4 mb-6 rounded-2xl bg-white/5 p-4 border border-white/5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">From</p>
                <p className="text-xs font-bold text-slate-300">{rescheduleActionModal.request.currentSessionDate}</p>
                <p className="text-[10px] text-slate-500 italic">Slot {rescheduleActionModal.request.currentSlot?.slotIndex || rescheduleActionModal.request.currentTimeSlotId}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1">To</p>
                <p className="text-xs font-bold text-white">{rescheduleActionModal.request.requestedSessionDate}</p>
                <p className="text-[10px] text-slate-400 italic">Slot {rescheduleActionModal.request.requestedSlot?.slotIndex || rescheduleActionModal.request.requestedTimeSlotId}</p>
              </div>
            </div>

            {rescheduleActionModal.action === 'DENY' && (
              <div className="mb-6">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Optional Reason
                </label>
                <textarea
                  value={rescheduleActionModal.reason}
                  onChange={(e) => setRescheduleActionModal((prev) => ({ ...prev, reason: e.target.value }))}
                  className="gc-input min-h-[100px] resize-none"
                  placeholder="Explain why you cannot accept this change..."
                />
              </div>
            )}

            <div className="flex justify-end gap-3 mt-8">
              <button
                type="button"
                onClick={closeRescheduleActionModal}
                className="gc-button-secondary !px-5 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRescheduleAction}
                disabled={loading}
                className={`${rescheduleActionModal.action === 'APPROVE' ? 'gc-button-primary' : 'bg-rose-600 font-semibold text-white hover:bg-rose-700 shadow-lg ring-1 ring-rose-500/50'} rounded-xl px-6 py-2.5 text-sm disabled:opacity-50 transition`}
              >
                {loading ? 'Updating...' : rescheduleActionModal.action === 'APPROVE' ? 'Approve Change' : 'Deny Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CoachBookingManagementPage
