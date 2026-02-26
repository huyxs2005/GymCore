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
  const [savedAvailability, setSavedAvailability] = useState(null) // Lịch trống đã lưu

  // Default time slots (fallback nếu API lỗi)
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

  const [timeSlots, setTimeSlots] = useState(defaultTimeSlots) // Khởi tạo với default để checkbox luôn hiển thị

  // Lịch trống theo tuần: { [dayOfWeek-timeSlotId]: true/false }
  const [availability, setAvailability] = useState({})

  useEffect(() => {
    loadTimeSlots()
  }, [])

  const isFirstAvailabilityView = useRef(true)
  // Lần đầu vào trang không tải lịch → ô trống, PT phải tự tích; khi chuyển tab về "Cập nhật lịch trống" thì tải lịch đã lưu
  useEffect(() => {
    if (activeTab !== 'availability') return
    if (isFirstAvailabilityView.current) {
      isFirstAvailabilityView.current = false
      return
    }
    loadMyAvailability()
  }, [activeTab])

  const daysOfWeek = [
    { dayOfWeek: 1, name: 'Thứ 2' },
    { dayOfWeek: 2, name: 'Thứ 3' },
    { dayOfWeek: 3, name: 'Thứ 4' },
    { dayOfWeek: 4, name: 'Thứ 5' },
    { dayOfWeek: 5, name: 'Thứ 6' },
    { dayOfWeek: 6, name: 'Thứ 7' },
    { dayOfWeek: 7, name: 'Chủ nhật' },
  ]

  useEffect(() => {
    if (activeTab === 'schedule') {
      loadMySchedule()
    } else if (activeTab === 'saved-availability') {
      loadSavedAvailability()
    } else if (activeTab === 'availability') {
      loadMyAvailability()
    }
  }, [activeTab])

  async function loadMyAvailability() {
    try {
      setError('')
      const res = await coachApi.getMyAvailability()
      // Backend ApiResponse: { success, message, data: { weeklyAvailability: [...] } }
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
      setError(err?.response?.data?.message || 'Không tải được lịch đã lưu.')
    }
  }

  async function loadTimeSlots() {
    try {
      setLoading(true)
      const response = await coachApi.getTimeSlots()
      // Backend trả về ApiResponse { success, message, data: { items: [...] } }
      const items = response?.data?.items || response?.items || []
      if (items.length > 0) {
        setTimeSlots(items)
        setError('')
      } else {
        // Giữ nguyên defaultSlots nếu API trả về rỗng
        setError('')
      }
    } catch (err) {
      console.error('Error loading time slots:', err)
      // Giữ nguyên defaultSlots nếu API lỗi
      console.warn('Using default time slots due to API error')
    } finally {
      setLoading(false)
    }
  }

  async function loadSavedAvailability() {
    try {
      setLoading(true)
      // Lấy lịch trống đã lưu từ API getCoachSchedule (với coachId của chính mình)
      // Hoặc có thể tạo API riêng, nhưng tạm thời dùng getCoachSchedule
      // Note: Cần coachId của chính mình - có thể lấy từ token hoặc tạo API riêng
      // Tạm thời dùng cách khác: load từ getCoachSchedule với fromDate/toDate
      const today = new Date()
      const fromDate = today.toISOString().split('T')[0]
      const toDate = new Date(today.getTime() + 13 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      // Tạm thời bỏ qua vì cần coachId, sẽ thêm sau
      setSavedAvailability({ weeklyAvailability: [], bookedSlots: [] })
    } catch (err) {
      console.error('Error loading saved availability:', err)
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
      setError(err?.response?.data?.message || 'Không tải được lịch')
    } finally {
      setLoading(false)
    }
  }

  async function handleCompleteSession(sessionId) {
    if (!window.confirm('Bạn có xác nhận đã hoàn thành buổi tập này?')) return
    try {
      setLoading(true)
      await coachBookingApi.completeSession(sessionId)
      setMySchedule(prev => prev.map(s => s.ptSessionId === sessionId ? { ...s, status: 'COMPLETED' } : s))
      setMessage('Đã đánh dấu hoàn thành buổi tập.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể hoàn thành buổi tập.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteSession(sessionId) {
    if (!window.confirm('Bạn có chắc chắn muốn xóa thông báo hủy lịch này?')) return
    try {
      setLoading(true)
      await coachBookingApi.deleteSession(sessionId)
      setMySchedule(prev => prev.filter(s => s.ptSessionId !== sessionId))
      setMessage('Đã xóa thông báo hủy lịch.')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể xóa buổi tập.')
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
      // Chuyển availability state thành array format cho API
      // Chỉ gửi các slot đã chọn (isAvailable = true) để tối ưu
      const slots = []
      daysOfWeek.forEach((day) => {
        timeSlots.forEach((slot) => {
          const key = `${day.dayOfWeek}-${slot.timeSlotId}`
          const isChecked = availability[key] === true
          // Gửi cả checked và unchecked để backend có thể set IsAvailable = false cho slot không chọn
          slots.push({
            dayOfWeek: day.dayOfWeek,
            timeSlotId: slot.timeSlotId, // Dùng TimeSlotID từ API
            isAvailable: isChecked,
          })
        })
      })

      await coachApi.updateAvailability({ slots })
      setMessage('Cập nhật lịch trống thành công! Dấu tích được giữ nguyên. Khách hàng có thể xem và đặt lịch ngay tại trang Đặt lịch PT (có thể cần tải lại trang).')
      // Không xóa state availability — giữ nguyên dấu tích để PT dễ kiểm soát
      setTimeout(() => setMessage(''), 6000)
    } catch (err) {
      console.error('Error saving availability:', err)
      setError(err?.response?.data?.message || 'Cập nhật lịch thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <WorkspaceScaffold
      title="Coach Schedule Workspace"
      subtitle="Manage weekly availability and view assigned PT sessions."
      links={coachNav}
    >
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('availability')}
            className={`px-4 py-2 text-sm font-medium transition ${activeTab === 'availability'
              ? 'border-b-2 border-gym-600 text-gym-700'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Cập nhật lịch trống
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 text-sm font-medium transition ${activeTab === 'schedule'
              ? 'border-b-2 border-gym-600 text-gym-700'
              : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            Lịch đã đặt
          </button>
        </div>

        {/* Giải thích */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-medium">📌 Lưu ý:</p>
          <ul className="mt-2 list-disc list-inside space-y-1">
            <li>
              <strong>"Cập nhật lịch trống"</strong>: Chọn các slot bạn có thể nhận học viên (lịch làm việc theo tuần). Đây là lịch
              trống để khách hàng xem và đặt lịch.
            </li>
            <li>
              <strong>"Lịch đã đặt"</strong>: Hiển thị các buổi tập đã được khách hàng đặt với bạn. Chỉ hiển thị khi có khách hàng
              đặt lịch.
            </li>
          </ul>
        </div>

        {/* Messages */}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
            <button onClick={() => setError('')} className="ml-2 font-semibold">
              ×
            </button>
          </div>
        )}
        {message && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            {message}
            <button onClick={() => setMessage('')} className="ml-2 font-semibold">
              ×
            </button>
          </div>
        )}

        {/* Tab: Cập nhật lịch trống */}
        {activeTab === 'availability' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Lịch làm việc theo tuần</h2>
              <p className="mt-1 text-sm text-slate-600">
                Chọn các slot bạn có thể nhận học viên. Slot được chọn sẽ hiển thị cho khách hàng để đặt lịch.
              </p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                Sau khi chọn xong các ô bên dưới, nhấn nút <strong>Lưu lịch trống</strong> để lưu.
              </p>


              {/* Bảng lịch */}
              {loading && timeSlots.length === 0 ? (
                <div className="mt-6 text-center text-sm text-slate-600">Đang tải danh sách slot...</div>
              ) : timeSlots.length === 0 ? (
                <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  Không có dữ liệu slot. Vui lòng kiểm tra kết nối API hoặc chạy lại backend.
                </div>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Thứ</th>
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
                <span className="text-sm font-medium text-slate-700">Đã chọn xong? Nhấn nút bên phải để lưu lịch.</span>
                <button
                  type="button"
                  onClick={handleSaveAvailability}
                  disabled={loading}
                  className="rounded-lg bg-gym-600 px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-gym-700 disabled:opacity-50"
                >
                  {loading ? 'Đang lưu...' : 'Lưu lịch trống'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Lịch đã đặt */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Lịch đã được đặt</h2>
                <p className="text-sm text-slate-500 mt-0.5">Danh sách buổi tập đã được học viên đặt với bạn</p>
              </div>
              <button onClick={loadMySchedule} className="text-sm font-bold text-gym-600 hover:text-gym-700 px-3 py-1.5 bg-gym-50 rounded-lg transition-colors">↻ Làm mới</button>
            </div>

            {loading && <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-50 rounded-xl animate-pulse" />)}</div>}

            {!loading && mySchedule.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-16 text-center">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <p className="font-bold text-slate-900">Chưa có lịch nào được đặt</p>
                <p className="text-sm text-slate-500 mt-1">Học viên sẽ xuất hiện khi họ đặt lịch với bạn.</p>
              </div>
            )}

            {!loading && mySchedule.length > 0 && (() => {
              // Group sessions by date
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
                      {/* Date header */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-gym-600 text-white rounded-xl px-3 py-1.5 text-xs font-black">
                          {new Date(date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </div>
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-xs text-slate-400 font-medium">{grouped[date].length} buổi</span>
                      </div>
                      {/* Sessions for this date */}
                      <div className="space-y-2">
                        {grouped[date].map(session => {
                          const statusMap = {
                            SCHEDULED: { label: 'Sắp tới', dot: 'bg-blue-500', card: 'border-blue-100 bg-blue-50/30', badge: 'bg-blue-100 text-blue-700' },
                            COMPLETED: { label: 'Đã tập', dot: 'bg-green-500', card: 'border-green-100 bg-green-50/30', badge: 'bg-green-100 text-green-700' },
                            CANCELLED: { label: 'Đã hủy', dot: 'bg-red-400', card: 'border-red-100 bg-red-50/20 opacity-60', badge: 'bg-red-100 text-red-600' },
                          }
                          const sc = statusMap[session.status] ?? { label: session.status, dot: 'bg-slate-400', card: 'border-slate-100', badge: 'bg-slate-100 text-slate-600' }
                          return (
                            <div key={session.ptSessionId} className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${sc.card} transition-all`}>
                              {/* Time column */}
                              <div className="w-24 shrink-0 text-center">
                                <p className="text-sm font-black text-slate-800">{session.startTime?.substring(0, 5)}</p>
                                <p className="text-[10px] text-slate-400 font-medium">{session.endTime?.substring(0, 5)} · Slot {session.slotIndex}</p>
                              </div>
                              <div className={`w-2 h-2 rounded-full ${sc.dot} shrink-0`} />
                              {/* Student info */}
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-900 truncate">{session.customerName}</p>
                                <div className="flex flex-wrap gap-3 mt-0.5">
                                  {session.customerPhone && <span className="text-xs text-slate-500">📞 {session.customerPhone}</span>}
                                  {session.customerEmail && <span className="text-xs text-slate-500 truncate">✉ {session.customerEmail}</span>}
                                </div>
                              </div>
                              {/* Status badge & Actions */}
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase shrink-0 ${sc.badge}`}>{sc.label}</span>
                                {session.status === 'SCHEDULED' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCompleteSession(session.ptSessionId)
                                    }}
                                    className="px-3 py-1.5 bg-gym-600 text-white text-[10px] font-bold rounded-lg hover:bg-gym-700 transition-colors shadow-sm"
                                  >
                                    Hoàn thành
                                  </button>
                                )}
                                {session.status === 'CANCELLED' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteSession(session.ptSessionId)
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Xóa thông báo này"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
