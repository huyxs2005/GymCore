import { useState, useEffect, useMemo } from 'react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { coachApi } from '../../features/coach/api/coachApi'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'

function CustomerCoachBookingPage() {
  const [activeTab, setActiveTab] = useState('coaches')
  const [coaches, setCoaches] = useState([])
  const [selectedCoach, setSelectedCoach] = useState(null)
  const [coachSchedule, setCoachSchedule] = useState(null)
  const [mySchedule, setMySchedule] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showBookingModal, setShowBookingModal] = useState(false)

  // Feedback state
  const [feedbackSession, setFeedbackSession] = useState(null) // session being rated
  const [feedbackForm, setFeedbackForm] = useState({ rating: 0, comment: '' })
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [submittedSessions, setSubmittedSessions] = useState(new Set())

  // Combined Form State
  const [bookingForm, setBookingForm] = useState({
    coachId: '',
    startDate: '',
    endDate: '',
    slots: [], // Array of { dayOfWeek, timeSlotId }
  })

  useEffect(() => {
    if (activeTab === 'coaches') {
      loadCoaches()
    } else if (activeTab === 'schedule') {
      loadMySchedule()
    } else if (activeTab === 'feedback') {
      loadMySchedule()
    }
  }, [activeTab])

  async function loadCoaches() {
    try {
      setLoading(true)
      const response = await coachApi.getCoaches()
      const raw = response?.data ?? response
      setCoaches(Array.isArray(raw?.items) ? raw.items : [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được danh sách PT')
    } finally {
      setLoading(false)
    }
  }

  async function loadCoachSchedule(coachId) {
    try {
      setLoading(true)
      setError('')
      const [detailResponse, scheduleResponse] = await Promise.all([
        coachApi.getCoachById(coachId),
        coachApi.getCoachSchedule(coachId),
      ])
      const coachData = detailResponse?.data ?? detailResponse
      const scheduleData = scheduleResponse?.data ?? scheduleResponse

      setSelectedCoach(coachData)
      setCoachSchedule(scheduleData)
      setBookingForm({
        coachId: coachId,
        startDate: '',
        endDate: '',
        slots: [],
      })
      setShowBookingModal(true)
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được lịch PT')
    } finally {
      setLoading(false)
    }
  }

  async function loadMySchedule() {
    try {
      setLoading(true)
      const response = await coachBookingApi.getMySchedule()
      const raw = response?.data ?? response
      setMySchedule(Array.isArray(raw?.items) ? raw.items : [])
      setPendingRequests(Array.isArray(raw?.pendingRequests) ? raw.pendingRequests : [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được lịch tập')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmBooking() {
    if (!bookingForm.startDate || !bookingForm.endDate || bookingForm.slots.length === 0) {
      setError('Vui lòng chọn ngày và ít nhất một khung giờ tập theo tuần')
      return
    }

    try {
      setLoading(true)
      setError('')
      const payload = {
        coachId: bookingForm.coachId,
        startDate: bookingForm.startDate,
        endDate: bookingForm.endDate,
        slots: bookingForm.slots,
      }
      await coachBookingApi.createRequest(payload)
      setMessage('Đặt lịch thành công! Bạn có thể xem chi tiết tại "Lịch của tôi"')
      setShowBookingModal(false)
      setActiveTab('schedule')
      setTimeout(() => setMessage(''), 5000)
    } catch (err) {
      setError(err?.response?.data?.message || 'Đặt lịch thất bại. Vui lòng kiểm tra lại membership hoặc thời gian chọn.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancelSession(sessionId) {
    if (!confirm('Bạn có chắc muốn hủy buổi tập này?')) return
    try {
      setLoading(true)
      await coachBookingApi.cancelSession(sessionId, { cancelReason: 'Hủy bởi khách hàng' })
      // Optimistic update
      setMySchedule(prev => prev.filter(s => s.ptSessionId !== sessionId))
      setMessage('Đã hủy buổi tập thành công')
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setError(err?.response?.data?.message || 'Hủy lịch thất bại')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteMySession(sessionId) {
    if (!confirm('Bạn có chắc muốn xóa thông báo hủy lịch này?')) return
    try {
      setLoading(true)
      await coachBookingApi.deleteMySession(sessionId)
      setMySchedule(prev => prev.filter(s => s.ptSessionId !== sessionId))
      setMessage('Đã xóa thông báo thành công')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err?.response?.data?.message || 'Xóa lịch thất bại')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitFeedback() {
    if (!feedbackSession || feedbackForm.rating === 0) {
      setError('Vui lòng chọn số sao đánh giá')
      return
    }
    try {
      setFeedbackLoading(true)
      setError('')
      await coachBookingApi.submitFeedback({
        ptSessionId: feedbackSession.ptSessionId,
        rating: feedbackForm.rating,
        comment: feedbackForm.comment,
      })
      setSubmittedSessions(prev => new Set(prev).add(feedbackSession.ptSessionId))
      setMessage('Đã gửi đánh giá thành công! Cảm ơn bạn.')
      setFeedbackSession(null)
      setFeedbackForm({ rating: 0, comment: '' })
      setTimeout(() => setMessage(''), 4000)
    } catch (err) {
      setError(err?.response?.data?.message || 'Gửi đánh giá thất bại. Có thể bạn đã đánh giá buổi này rồi.')
    } finally {
      setFeedbackLoading(false)
    }
  }

  const daysOfWeek = [
    { id: 1, name: 'Thứ 2' },
    { id: 2, name: 'Thứ 3' },
    { id: 3, name: 'Thứ 4' },
    { id: 4, name: 'Thứ 5' },
    { id: 5, name: 'Thứ 6' },
    { id: 6, name: 'Thứ 7' },
    { id: 7, name: 'Chủ nhật' },
  ]

  const toggleSlot = (dayOfWeek, timeSlotId) => {
    const isSelected = bookingForm.slots.some(s => s.dayOfWeek === dayOfWeek && s.timeSlotId === timeSlotId)
    if (isSelected) {
      setBookingForm({
        ...bookingForm,
        slots: bookingForm.slots.filter(s => !(s.dayOfWeek === dayOfWeek && s.timeSlotId === timeSlotId))
      })
    } else {
      setBookingForm({
        ...bookingForm,
        slots: [...bookingForm.slots, { dayOfWeek, timeSlotId }]
      })
    }
  }

  const groupedAvailability = useMemo(() => {
    if (!coachSchedule?.weeklyAvailability) return {}
    const grouped = {}
    coachSchedule.weeklyAvailability.forEach(av => {
      if (!grouped[av.dayOfWeek]) grouped[av.dayOfWeek] = []
      grouped[av.dayOfWeek].push(av)
    })
    return grouped
  }, [coachSchedule])

  return (
    <WorkspaceScaffold title="Huấn Luyện Viên Cá Nhân" subtitle="Đội ngũ PT chuyên nghiệp sẵn sàng đồng hành cùng bạn" links={customerNav}>
      <div className="max-w-7xl mx-auto space-y-8 pb-10">

        {/* Modern Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('coaches')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'coaches'
              ? 'bg-white text-gym-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            Đội ngũ PT
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'schedule'
              ? 'bg-white text-gym-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            Lịch tập của tôi
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === 'feedback'
              ? 'bg-white text-gym-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            ⭐ Đánh giá PT
          </button>
        </div>

        {/* Alerts */}
        {(error || message) && (
          <div className={`p-4 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 ${error ? 'bg-red-50 text-red-800 border border-red-100' : 'bg-green-50 text-green-800 border border-green-100'
            }`}>
            <span className="text-sm font-medium">{error || message}</span>
            <button onClick={() => { setError(''); setMessage(''); }} className="hover:opacity-60 text-lg">×</button>
          </div>
        )}

        {/* Tab: Coaches */}
        {activeTab === 'coaches' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading && !showBookingModal && [1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-slate-50 rounded-2xl animate-pulse border border-slate-100" />
            ))}
            {!loading && coaches.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400">Chưa có thông tin huấn luyện viên</div>
            )}
            {coaches.map((coach) => (
              <div key={coach.coachId} className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className="aspect-[4/3] bg-slate-100 relative">
                  {coach.avatarUrl ? (
                    <img src={coach.avatarUrl} alt={coach.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur rounded-full text-xs font-bold text-gym-700 shadow-sm">
                    {coach.experienceYears} năm EXP
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-gym-600 transition-colors">{coach.fullName}</h3>
                    {coach.averageRating > 0 && (
                      <div className="flex items-center gap-1 text-sm font-bold text-amber-500">
                        ⭐ <span>{coach.averageRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed h-10">
                    {coach.bio || 'Huấn luyện viên chuyên nghiệp với nhiều năm kinh nghiệm trong lĩnh vực thể hình và sức khỏe.'}
                  </p>
                  <button
                    onClick={() => loadCoachSchedule(coach.coachId)}
                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-gym-600 transition-all duration-200 transform hover:-translate-y-0.5"
                  >
                    Xem lịch & Đặt ngay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Redesigned Booking Modal */}
        {showBookingModal && selectedCoach && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col md:flex-row">

              {/* Sidebar Info */}
              <div className="md:w-72 bg-slate-50 p-8 border-r border-slate-100 shrink-0">
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="mb-8 text-slate-400 hover:text-slate-900 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                  ← Quay lại
                </button>
                <div className="space-y-6">
                  <div className="w-24 h-24 bg-slate-200 rounded-2xl overflow-hidden mx-auto shadow-inner">
                    {selectedCoach.avatarUrl && <img src={selectedCoach.avatarUrl} className="w-full h-full object-cover" />}
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-slate-900">{selectedCoach.fullName}</h2>
                    <p className="text-sm text-slate-500 mt-1">Huấn luyện viên</p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Kinh nghiệm</span>
                      <span className="font-bold text-slate-900">{selectedCoach.experienceYears} năm</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Đánh giá</span>
                      <span className="font-bold text-amber-500">★ {selectedCoach.averageRating?.toFixed(1) || '0.0'}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="relative">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ngày bắt đầu</label>
                      <input
                        type="date"
                        value={bookingForm.startDate}
                        onChange={(e) => setBookingForm({ ...bookingForm, startDate: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-gym-500 outline-none"
                      />
                    </div>
                    <div className="relative">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ngày kết thúc</label>
                      <input
                        type="date"
                        value={bookingForm.endDate}
                        onChange={(e) => setBookingForm({ ...bookingForm, endDate: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-gym-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Content: Schedule Grid */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Chọn lịch tập theo tuần</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Lịch tập sẽ tự động lặp lại mỗi tuần trong khoảng thời gian đã chọn.</p>
                  </div>
                  <div className="hidden sm:block text-right">
                    <span className="text-sm font-bold text-gym-600 block">{bookingForm.slots.length} slot đã chọn</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Cực kỳ linh hoạt</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {daysOfWeek.map(day => (
                      <div key={day.id} className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">{day.name}</h4>
                        <div className="space-y-2">
                          {groupedAvailability[day.id]?.length > 0 ? (
                            groupedAvailability[day.id].map(slot => {
                              const isSelected = bookingForm.slots.some(s => s.dayOfWeek === day.id && s.timeSlotId === slot.timeSlotId)
                              const isBooked = coachSchedule.bookedSlots?.some(b => b.dayOfWeek === day.id && b.timeSlotId === slot.timeSlotId && b.status === 'SCHEDULED')

                              return (
                                <button
                                  key={slot.timeSlotId}
                                  disabled={isBooked}
                                  onClick={() => toggleSlot(day.id, slot.timeSlotId)}
                                  className={`w-full p-3 rounded-2xl border text-left transition-all duration-200 group relative ${isBooked
                                    ? 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed'
                                    : isSelected
                                      ? 'bg-gym-600 border-gym-600 text-white shadow-lg shadow-gym-200 scale-[1.02]'
                                      : 'bg-white border-slate-200 hover:border-gym-300 hover:shadow-sm'
                                    }`}
                                >
                                  <div className="flex flex-col">
                                    <span className={`text-[10px] font-bold ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>SLOT {slot.slotIndex}</span>
                                    <span className="text-sm font-bold truncate">{slot.startTime.substring(0, 5)} - {slot.endTime.substring(0, 5)}</span>
                                  </div>
                                  {isBooked && <span className="absolute top-2 right-2 text-[8px] font-black text-slate-400 uppercase">Đầy</span>}
                                </button>
                              )
                            })
                          ) : (
                            <div className="p-3 text-[10px] text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">Không có lịch</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between gap-6">
                  <div className="hidden sm:flex items-center gap-3 text-sm text-slate-500">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">{i}</div>)}
                    </div>
                    <span>Dễ dàng đặt lịch chỉ với vài cú click. Hệ thống sẽ tự kiểm tra membership cho bạn.</span>
                  </div>
                  <button
                    disabled={loading || bookingForm.slots.length === 0 || !bookingForm.startDate || !bookingForm.endDate}
                    onClick={handleConfirmBooking}
                    className="px-10 py-4 bg-gym-600 text-white rounded-2xl font-bold hover:bg-gym-700 transition-all shadow-xl shadow-gym-100 disabled:opacity-40 disabled:shadow-none flex items-center gap-2"
                  >
                    {loading ? 'Đang xác nhận...' : 'Xác nhận đặt lịch'}
                    {!loading && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: My Schedule (Enhanced) */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Lịch tập cá nhân</h2>
              <button onClick={loadMySchedule} className="text-sm font-bold text-gym-600 hover:text-gym-700">Làm mới lịch</button>
            </div>

            {loading && <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-50 rounded-2xl animate-pulse" />)}</div>}

            {pendingRequests.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                  Yêu cầu đang chờ phê duyệt ({pendingRequests.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingRequests.map((req) => (
                    <div key={req.ptRequestId} className="bg-amber-50/50 p-5 rounded-2xl border border-amber-200 flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-900">PT: {req.coachName}</h4>
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full uppercase">Đang chờ</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span>📅 {req.startDate} - {req.endDate}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 italic">
                          <span>Gửi lúc: {new Date(req.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-amber-600 font-medium">Buổi tập sẽ được tạo sau khi PT chấp nhận yêu cầu này.</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && mySchedule.length === 0 && pendingRequests.length === 0 && (
              <div className="bg-slate-50 rounded-3xl p-20 text-center border-2 border-dashed border-slate-200">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200 shadow-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Chưa có buổi tập nào được đặt</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">Hãy bắt đầu bằng việc chọn cho mình một huấn luyện viên ưng ý nhất.</p>
                <button onClick={() => setActiveTab('coaches')} className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm">Xem danh sách PT</button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {mySchedule.map((session) => (
                <div key={session.ptSessionId} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-gym-200 transition-colors flex gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${session.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-600' :
                    session.status === 'COMPLETED' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-900 truncate">PT: {session.coachName}</h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${session.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
                          session.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {session.status === 'SCHEDULED' ? 'Sắp tới' : session.status === 'COMPLETED' ? 'Đã tập' : 'Đã hủy'}
                        </span>
                        {session.status === 'CANCELLED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteMySession(session.ptSessionId)
                            }}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Xóa thông báo này"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {new Date(session.sessionDate).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {session.startTime.substring(0, 5)} - {session.endTime.substring(0, 5)} (Slot {session.slotIndex})
                      </div>
                    </div>
                    {session.status === 'SCHEDULED' && (
                      <button
                        onClick={() => handleCancelSession(session.ptSessionId)}
                        className="mt-4 text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors bg-red-50 px-3 py-1.5 rounded-lg w-full text-center"
                      >
                        Yêu cầu hủy buổi
                      </button>
                    )}
                    {/* PT Notes for this session */}
                    {session.notes && session.notes.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ghi chú từ PT</p>
                        {session.notes.map((note, i) => (
                          <div key={i} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            <p className="text-xs text-amber-800 leading-relaxed">{note.noteContent || note.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Feedback */}
        {activeTab === 'feedback' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Đánh giá Huấn Luyện Viên</h2>
                <p className="text-sm text-slate-500 mt-1">Chỉ có thể đánh giá các buổi tập đã hoàn thành (trạng thái: Đã tập)</p>
              </div>
            </div>

            {loading && <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-50 rounded-2xl animate-pulse" />)}</div>}

            {/* Feedback Modal */}
            {feedbackSession && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setFeedbackSession(null)}>
                <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8" onClick={e => e.stopPropagation()}>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">Gửi đánh giá</h3>
                  <p className="text-sm text-slate-500 mb-6">PT: <span className="font-bold text-slate-700">{feedbackSession.coachName}</span> — {new Date(feedbackSession.sessionDate).toLocaleDateString('vi-VN')}</p>

                  {/* Star Rating */}
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-sm font-semibold text-slate-700 mr-2">Xếp hạng:</span>
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setFeedbackForm(f => ({ ...f, rating: star }))}
                        className={`text-3xl transition-transform hover:scale-110 ${star <= feedbackForm.rating ? 'text-yellow-400' : 'text-slate-200'}`}
                      >★</button>
                    ))}
                    {feedbackForm.rating > 0 && <span className="text-sm font-bold text-slate-600 ml-2">{feedbackForm.rating}/5</span>}
                  </div>

                  {/* Comment */}
                  <textarea
                    rows={4}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gym-300 focus:border-transparent mb-6"
                    placeholder="Chia sẻ cảm nhận của bạn về buổi tập (không bắt buộc)..."
                    value={feedbackForm.comment}
                    onChange={e => setFeedbackForm(f => ({ ...f, comment: e.target.value }))}
                  />

                  <div className="flex gap-3">
                    <button onClick={() => setFeedbackSession(null)} className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">
                      Hủy
                    </button>
                    <button
                      onClick={handleSubmitFeedback}
                      disabled={feedbackLoading || feedbackForm.rating === 0}
                      className="flex-1 px-4 py-3 bg-gym-600 text-white rounded-xl font-bold hover:bg-gym-700 transition-colors disabled:opacity-50"
                    >
                      {feedbackLoading ? 'Đang gửi...' : 'Gửi đánh giá ⭐'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Completed Sessions List */}
            {!loading && (
              <>
                {mySchedule.filter(s => s.status === 'COMPLETED').length === 0 ? (
                  <div className="bg-slate-50 rounded-3xl p-16 text-center border-2 border-dashed border-slate-200">
                    <div className="text-5xl mb-4">⭐</div>
                    <h3 className="text-lg font-bold text-slate-900">Chưa có buổi tập nào hoàn thành</h3>
                    <p className="text-slate-500 text-sm mt-1">Hoàn thành buổi tập để có thể đánh giá PT của bạn.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {mySchedule.filter(s => s.status === 'COMPLETED').map((session) => {
                      const isSubmitted = submittedSessions.has(session.ptSessionId)
                      return (
                        <div key={session.ptSessionId} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-gym-200 hover:shadow-md transition-all flex gap-4">
                          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0 text-xl font-black">✓</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-slate-900 truncate">PT: {session.coachName}</h4>
                              {isSubmitted && <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 uppercase">Đã đánh giá</span>}
                            </div>
                            <div className="mt-1.5 space-y-0.5">
                              <p className="text-xs text-slate-500 font-medium">
                                📅 {new Date(session.sessionDate).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </p>
                              <p className="text-xs text-slate-500 font-medium">
                                🕐 {session.startTime?.substring(0, 5)} – {session.endTime?.substring(0, 5)} (Slot {session.slotIndex})
                              </p>
                            </div>
                            <button
                              onClick={() => { setFeedbackSession(session); setFeedbackForm({ rating: 0, comment: '' }) }}
                              disabled={isSubmitted}
                              className={`mt-3 w-full text-[12px] font-bold py-2 rounded-xl transition-all text-center ${isSubmitted
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-gym-600 text-white hover:bg-gym-700 shadow-sm'
                                }`}
                            >
                              {isSubmitted ? '✓ Đã đánh giá' : '⭐ Đánh giá buổi tập này'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </WorkspaceScaffold>
  )
}

export default CustomerCoachBookingPage
