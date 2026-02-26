import { useState, useEffect } from 'react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { coachNav } from '../../config/navigation'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'

function CoachBookingManagementPage() {
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
        loadRequests()
    }, [])

    async function loadRequests() {
        try {
            setLoading(true)
            const data = await coachBookingApi.getPendingRequests()
            const items = data?.data?.items || []
            setRequests(items)
        } catch (err) {
            setError('Không tải được danh sách yêu cầu')
        } finally {
            setLoading(false)
        }
    }

    async function handleAction(requestId, action) {
        if (!confirm(`Bạn có chắc muốn ${action === 'ACCEPT' ? 'phê duyệt' : 'từ chối'} yêu cầu này?`)) return
        try {
            setLoading(true)
            await coachBookingApi.actionRequest(requestId, action)
            setMessage(action === 'ACCEPT' ? 'Đã phê duyệt và tạo lịch tập' : 'Đã từ chối yêu cầu')
            loadRequests()
        } catch (err) {
            setError(err?.response?.data?.message || 'Thao tác thất bại')
            // Important: refresh list even on error to sync state (e.g. if it's already approved)
            loadRequests()
        } finally {
            setLoading(false)
        }
    }

    const getStatusStyle = (status) => {
        switch (status) {
            case 'PENDING': return 'bg-amber-100 text-amber-700'
            case 'APPROVED': return 'bg-green-100 text-green-700'
            case 'DENIED': return 'bg-red-100 text-red-700'
            default: return 'bg-slate-100 text-slate-700'
        }
    }
    const getDayName = (day) => {
        const days = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 7: 'CN' }
        return days[day] || day
    }

    const renderSlots = (slots) => {
        if (!slots || slots.length === 0) return <span className="text-slate-400 italic">Không có slot</span>
        return (
            <div className="flex flex-wrap gap-1.5 mt-2">
                {slots.map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100 uppercase">
                        {getDayName(s.dayOfWeek)} • Slot {s.slotIndex}
                    </span>
                ))}
            </div>
        )
    }

    if (loading) return (
        <WorkspaceScaffold title="Quản Lý Yêu Cầu Đặt Lịch" subtitle="Phê duyệt hoặc từ chối yêu cầu từ học viên" links={coachNav}>
            <div className="max-w-6xl mx-auto space-y-6 pb-10">

                {(error || message) && (
                    <div className={`p-4 rounded-xl flex items-center justify-between ${error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                        <span>{error || message}</span>
                        <button onClick={() => { setError(''); setMessage(''); }}>×</button>
                    </div>
                )}
                <div className="text-center py-10 text-slate-500">Đang tải...</div>
            </div>
        </WorkspaceScaffold>
    )

    return (
        <WorkspaceScaffold title="Quản Lý Yêu Cầu Đặt Lịch" subtitle="Phê duyệt hoặc từ chối yêu cầu từ học viên" links={coachNav}>
            <div className="max-w-6xl mx-auto space-y-6 pb-10">

                {(error || message) && (
                    <div className={`p-4 rounded-xl flex items-center justify-between ${error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                        <span>{error || message}</span>
                        <button onClick={() => { setError(''); setMessage(''); }}>×</button>
                    </div>
                )}

                {!loading && requests.length === 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center">
                        <h3 className="text-lg font-bold text-slate-800">Không có yêu cầu mới</h3>
                        <p className="text-slate-500">Hiện tại bạn không có học viên nào đang chờ phê duyệt.</p>
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
                                        <span className="text-slate-500">Thời gian:</span>
                                        <span className="font-semibold text-slate-800">{req.startDate} đến {req.endDate}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Gửi ngày:</span>
                                        <span>{new Date(req.createdAt).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lịch tập mong muốn (hàng tuần):</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {req.slots?.map((s, idx) => (
                                            <span key={idx} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-600">
                                                Thứ {s.dayOfWeek === 7 ? 'CN' : s.dayOfWeek + 1}: Slot {s.slotIndex}
                                            </span>
                                        ))}
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Thông tin liên hệ:</h4>
                                        <p className="text-sm text-slate-700 font-medium flex items-center gap-2">
                                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                            {req.customerPhone || 'N/A'}
                                        </p>
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
                                        Chấp nhận
                                    </button>
                                    <button
                                        onClick={() => handleAction(req.ptRequestId, 'DENY')}
                                        disabled={loading}
                                        className="flex-1 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Từ chối
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
