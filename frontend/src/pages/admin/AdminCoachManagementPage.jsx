import { useState, useEffect } from 'react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'

function AdminCoachManagementPage() {
    const [coaches, setCoaches] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const [selectedCoachId, setSelectedCoachId] = useState(null)
    const [coachDetail, setCoachDetail] = useState(null)
    const [performance, setPerformance] = useState(null)
    const [students, setStudents] = useState([])
    const [activeDetailTab, setActiveDetailTab] = useState('profile') // profile, performance, students

    useEffect(() => {
        loadCoaches()
    }, [])

    async function loadCoaches() {
        try {
            setLoading(true)
            const res = await coachBookingApi.adminGetCoaches()
            // Backend sends ApiResponse { status, message, data: { items: [...] } }
            setCoaches(res.data?.items || [])
        } catch (err) {
            setError('Không tải được danh sách PT')
        } finally {
            setLoading(false)
        }
    }

    async function loadCoachDetail(coachId) {
        try {
            setLoading(true)
            setSelectedCoachId(coachId)
            setActiveDetailTab('profile')

            const [coachesRes, perfRes, stdsRes] = await Promise.all([
                coachBookingApi.adminGetCoaches(),
                coachBookingApi.adminGetCoachPerformance(coachId),
                coachBookingApi.adminGetCoachStudents(coachId)
            ])

            const detail = coachesRes.data?.items?.find(c => c.coachId === coachId)
            setCoachDetail(detail)
            setPerformance(perfRes.data)
            setStudents(stdsRes.data?.items || [])
        } catch (err) {
            setError('Không tải được thông tin chi tiết PT')
        } finally {
            setLoading(false)
        }
    }

    async function handleUpdateProfile(e) {
        e.preventDefault()
        const formData = new FormData(e.target)
        const payload = {
            bio: formData.get('bio'),
            experienceYears: parseInt(formData.get('experienceYears'))
        }

        try {
            setLoading(true)
            await coachBookingApi.adminUpdateCoachProfile(selectedCoachId, payload)
            setMessage('Cập nhật hồ sơ thành công')
            loadCoaches()
            // Refresh local detail partially
            setCoachDetail({ ...coachDetail, ...payload })
        } catch (err) {
            setError('Cập nhật thất bại')
        } finally {
            setLoading(false)
        }
    }

    return (
        <WorkspaceScaffold title="Quản Lý Huấn Luyện Viên" subtitle="Giám sát hiệu suất và quản lý hồ sơ đội ngũ PT" links={adminNav}>
            <div className="max-w-7xl mx-auto space-y-6 pb-10">

                {(error || message) && (
                    <div className={`p-4 rounded-xl flex items-center justify-between ${error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                        <span>{error || message}</span>
                        <button onClick={() => { setError(''); setMessage(''); }}>×</button>
                    </div>
                )}

                {/* Coach List */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-900">Danh sách PT ({coaches.length})</h3>
                        <button onClick={loadCoaches} className="text-sm font-bold text-gym-600">Làm mới</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Họ tên / Email</th>
                                    <th className="px-6 py-4">Kinh nghiệm</th>
                                    <th className="px-6 py-4">Đánh giá</th>
                                    <th className="px-6 py-4">Học viên</th>
                                    <th className="px-6 py-4">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {coaches.map((coach) => (
                                    <tr key={coach.coachId} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{coach.fullName}</div>
                                            <div className="text-xs text-slate-500">{coach.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm">{coach.experienceYears} năm</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-amber-500 font-bold">
                                                ★ {coach.averageRating?.toFixed(1) || '0.0'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gym-600">{coach.totalStudents || coach.studentCount || 0} đang tập</td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => loadCoachDetail(coach.coachId)}
                                                className="text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-1.5 rounded-lg transition-all"
                                            >
                                                Quản lý
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detail View (Modal-ish or conditional section) */}
                {selectedCoachId && coachDetail && (
                    <div className="bg-white rounded-3xl border-2 border-gym-100 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gym-100 rounded-xl flex items-center justify-center text-gym-600 font-bold text-xl">
                                    {coachDetail.fullName?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{coachDetail.fullName}</h3>
                                    <p className="text-sm text-slate-500">ID: {coachDetail.coachId} | {coachDetail.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setSelectedCoachId(null); setCoachDetail(null); }}
                                className="text-slate-400 hover:text-slate-900 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex border-b border-slate-100 px-6 bg-white sticky top-0 z-10">
                            {['profile', 'performance', 'students'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveDetailTab(tab)}
                                    className={`px-6 py-4 text-sm font-bold transition-all border-b-2 ${activeDetailTab === tab
                                        ? 'border-gym-500 text-gym-700'
                                        : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                >
                                    {tab === 'profile' ? 'Hồ sơ' : tab === 'performance' ? 'Hiệu suất' : 'Học viên'}
                                </button>
                            ))}
                        </div>

                        <div className="p-8">
                            {activeDetailTab === 'profile' && (
                                <form onSubmit={handleUpdateProfile} className="max-w-2xl space-y-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Lời giới thiệu (Bio)</label>
                                            <textarea
                                                name="bio"
                                                defaultValue={coachDetail.bio}
                                                className="w-full h-32 p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-gym-500 outline-none transition-all"
                                                placeholder="Nhập thông tin giới thiệu về PT..."
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Số năm kinh nghiệm</label>
                                            <input
                                                type="number"
                                                name="experienceYears"
                                                defaultValue={coachDetail.experienceYears}
                                                className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-gym-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="px-8 py-3 bg-gym-600 text-white rounded-2xl font-bold hover:bg-gym-700 transition-all shadow-lg shadow-gym-100"
                                    >
                                        {loading ? 'Đang lưu...' : 'Lưu cập nhật'}
                                    </button>
                                </form>
                            )}

                            {activeDetailTab === 'performance' && performance && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 text-center">
                                            <div className="text-3xl font-black text-amber-600">{performance.averageRating?.toFixed(1) || performance.stats?.AverageRating?.toFixed(1) || '0.0'}</div>
                                            <div className="text-sm font-bold text-amber-800 mt-1">Điểm trung bình</div>
                                        </div>
                                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-center">
                                            <div className="text-3xl font-black text-blue-600">{performance.totalReviews || performance.stats?.ReviewCount || 0}</div>
                                            <div className="text-sm font-bold text-blue-800 mt-1">Tổng lượt review</div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="font-bold text-slate-900 border-l-4 border-amber-400 pl-3">Đánh giá gần đây</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {(performance.reviews || performance.feedbacks || []).map((review, idx) => (
                                                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-amber-500 font-bold">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                                                        <span className="text-[10px] text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-700 italic">"{review.comment || 'Không có bình luận'}"</p>
                                                    {review.customerName && <p className="text-[10px] text-slate-400 text-right">— {review.customerName}</p>}
                                                </div>
                                            ))}
                                            {(performance.reviews?.length === 0 && performance.feedbacks?.length === 0) && <p className="text-slate-500 text-sm">Chưa có đánh giá nào.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'students' && (
                                <div className="space-y-6">
                                    <h4 className="font-bold text-slate-900 border-l-4 border-gym-400 pl-3">Danh sách học viên ({students.length})</h4>
                                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-slate-50 text-slate-500 font-bold">
                                                <tr>
                                                    <th className="px-6 py-4">Tên học viên</th>
                                                    <th className="px-6 py-4 text-center">Buổi đã tập</th>
                                                    <th className="px-6 py-4 text-right">Buổi cuối</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {students.map((student, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="px-6 py-4">
                                                            <div className="font-bold">{student.fullName || student.customerName}</div>
                                                            <div className="text-xs text-slate-400">{student.email || student.customerEmail}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-bold text-gym-600">{student.completedSessions || 0} buổi</td>
                                                        <td className="px-6 py-4 text-right text-slate-500">{student.lastSession || 'N/A'}</td>
                                                    </tr>
                                                ))}
                                                {students.length === 0 && (
                                                    <tr>
                                                        <td colSpan="3" className="px-6 py-10 text-center text-slate-400 italic">Chưa có học viên nào.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </WorkspaceScaffold>
    )
}

export default AdminCoachManagementPage
