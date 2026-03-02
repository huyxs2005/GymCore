import { useState, useEffect } from 'react'
import {
    Users, Star, Award, TrendingUp, ChevronRight, RefreshCw,
    Mail, Calendar, BookOpen, Shield, MessageSquare, Briefcase,
    UserCheck, AlertCircle, Search, Filter
} from 'lucide-react'
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
    const [activeDetailTab, setActiveDetailTab] = useState('profile')

    useEffect(() => {
        loadCoaches()
    }, [])

    async function loadCoaches() {
        try {
            setLoading(true)
            const res = await coachBookingApi.adminGetCoaches()
            setCoaches(res.data?.items || [])
        } catch (err) {
            setError('Tactical failure: Unable to sync Coach Registry.')
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
            setError('Tactical failure: Detail decryption error.')
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
            setMessage('Profile recalibrated successfully.')
            loadCoaches()
            setCoachDetail({ ...coachDetail, ...payload })
        } catch (err) {
            setError('Recalibration failed. Please verify inputs.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <WorkspaceScaffold
            title="Elite Talent Ops"
            subtitle="Strategic oversight and performance calibration for the Coach Corps."
            links={adminNav}
        >
            <div className="space-y-12 pb-20 animate-in fade-in duration-700">

                {/* Status Notifications */}
                {(error || message) && (
                    <div className={`p-6 rounded-[32px] border-2 flex items-center justify-between shadow-2xl animate-in slide-in-from-top-4 ${error ? 'bg-red-900 border-red-500/30 text-white' : 'bg-gym-dark-900 border-gym-500/30 text-gym-500'}`}>
                        <div className="flex items-center gap-4">
                            {error ? <AlertCircle size={24} /> : <Shield size={24} />}
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{error ? 'System Alert' : 'Success Protocol'}</p>
                                <p className="text-sm font-black">{error || message}</p>
                            </div>
                        </div>
                        <button onClick={() => { setError(''); setMessage(''); }} className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all font-black text-xl">×</button>
                    </div>
                )}

                {/* Talent Registry Section */}
                <section className="gc-card-compact border-2 border-gym-dark-50 bg-white overflow-hidden shadow-xl shadow-gym-dark-900/5">
                    <div className="p-8 bg-gym-dark-900 text-white flex flex-wrap justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gym-500 text-gym-dark-900 flex items-center justify-center">
                                <Briefcase size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tight italic">Coach Corps Registry</h3>
                                <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest">{coaches.length} Commissioned Specialists</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="relative group hidden sm:block">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gym-dark-500" size={16} />
                                <input type="text" placeholder="Filter specialists..." className="bg-white/5 border border-white/10 rounded-xl py-2.5 pl-12 pr-4 text-xs font-bold text-white focus:outline-none focus:border-gym-500 focus:bg-white/10 transition-all w-64" />
                            </div>
                            <button onClick={loadCoaches} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gym-500 hover:bg-gym-500 hover:text-gym-dark-900 transition-all shadow-lg active:scale-90">
                                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-gym-dark-50 text-gym-dark-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-8 py-6">Specialist Identity</th>
                                    <th className="px-8 py-6">Operational Years</th>
                                    <th className="px-8 py-6">Tactical Rating</th>
                                    <th className="px-8 py-6">Active Deployments</th>
                                    <th className="px-8 py-6 text-right">Directives</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gym-dark-50">
                                {coaches.map((coach) => (
                                    <tr key={coach.coachId} className="hover:bg-gym-50/50 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-gym-dark-900 text-gym-500 flex items-center justify-center font-black shadow-lg group-hover:scale-110 transition-transform">
                                                    {coach.fullName?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-gym-dark-900 uppercase tracking-tight">{coach.fullName}</p>
                                                    <p className="text-[10px] font-bold text-gym-dark-400 mt-0.5">{coach.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-xs font-black text-gym-dark-600 uppercase italic">
                                            {coach.experienceYears} Years
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <Star size={14} className="text-gym-500" fill="currentColor" />
                                                <span className="text-sm font-black text-gym-dark-900 italic">{coach.averageRating?.toFixed(1) || '0.0'}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-32 h-2 bg-gym-dark-50 rounded-full overflow-hidden border border-gym-dark-100">
                                                    <div
                                                        className="h-full bg-gym-500 rounded-full"
                                                        style={{ width: `${Math.min(100, (coach.totalStudents || 0) * 10)}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-black text-gym-500 uppercase italic">{coach.totalStudents || 0} ACTIVE</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <button
                                                onClick={() => loadCoachDetail(coach.coachId)}
                                                className="px-6 py-2.5 bg-gym-dark-900 text-gym-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black hover:shadow-xl transition-all active:scale-95 group-hover:bg-gym-500 group-hover:text-gym-dark-900"
                                            >
                                                CALIBRATE
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Profile Deep-Dive Section */}
                {selectedCoachId && coachDetail && (
                    <section className="gc-card-compact border-2 border-gym-dark-50 bg-white shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-gym-500/5 -mr-48 -mt-48 rounded-full blur-3xl"></div>

                        <header className="px-8 py-6 bg-gym-dark-50 border-b border-gym-dark-100 flex flex-wrap justify-between items-center gap-4">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-gym-dark-900 border-4 border-white shadow-2xl rounded-3xl flex items-center justify-center text-gym-500 font-black text-2xl italic">
                                    {coachDetail.fullName?.charAt(0)}
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-gym-dark-900 uppercase tracking-tighter italic leading-none">{coachDetail.fullName}</h3>
                                    <div className="flex items-center gap-4 text-[10px] font-black text-gym-dark-400 uppercase tracking-widest">
                                        <span className="flex items-center gap-1.5"><Shield size={12} strokeWidth={2.5} /> Specialist ID: {coachDetail.coachId}</span>
                                        <span className="flex items-center gap-1.5"><Mail size={12} strokeWidth={2.5} /> {coachDetail.email}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => { setSelectedCoachId(null); setCoachDetail(null); }}
                                className="w-12 h-12 rounded-2xl bg-white border-2 border-gym-dark-100 flex items-center justify-center hover:bg-gym-dark-900 hover:text-gym-500 hover:border-gym-dark-900 transition-all text-2xl font-black"
                            >
                                ×
                            </button>
                        </header>

                        <nav className="flex px-8 bg-white border-b border-gym-dark-50 sticky top-0 z-10 overflow-x-auto no-scrollbar">
                            {[
                                { id: 'profile', label: 'TACTICAL BIO', icon: <UserCheck size={14} /> },
                                { id: 'performance', label: 'ANALYTICS', icon: <TrendingUp size={14} /> },
                                { id: 'students', label: 'OPERATIONAL REACH', icon: <Users size={14} /> }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveDetailTab(tab.id)}
                                    className={`px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 border-b-4 relative whitespace-nowrap ${activeDetailTab === tab.id
                                        ? 'border-gym-500 text-gym-dark-900 translate-y-px'
                                        : 'border-transparent text-gym-dark-300 hover:text-gym-dark-500'}`}
                                >
                                    {tab.icon} {tab.label}
                                </button>
                            ))}
                        </nav>

                        <div className="p-10">
                            {activeDetailTab === 'profile' && (
                                <form onSubmit={handleUpdateProfile} className="max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-10">
                                    <div className="md:col-span-8 space-y-8">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                                <BookOpen size={14} className="text-gym-500" /> Bio & Technical Overview
                                            </label>
                                            <textarea
                                                name="bio"
                                                defaultValue={coachDetail.bio}
                                                className="gc-input h-48 py-6 align-top overflow-y-auto no-scrollbar italic font-medium leading-relaxed"
                                                placeholder="Decrypting specialist background..."
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-4 space-y-10">
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                                <Calendar size={14} className="text-gym-500" /> Years Commissioned
                                            </label>
                                            <input
                                                type="number"
                                                name="experienceYears"
                                                defaultValue={coachDetail.experienceYears}
                                                className="gc-input text-xl"
                                                placeholder="00"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="btn-primary w-full py-5 text-[10px] font-black uppercase shadow-2xl flex items-center justify-center gap-3"
                                        >
                                            {loading ? 'RECALIBRATING...' : <><Shield size={18} /> Update Clearances</>}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {activeDetailTab === 'performance' && performance && (
                                <div className="space-y-12">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                        <article className="p-8 rounded-[40px] bg-gym-dark-900 border-2 border-gym-dark-800 text-white relative group overflow-hidden">
                                            <div className="absolute inset-0 bg-gym-500/5 group-hover:bg-gym-500/10 transition-colors"></div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gym-dark-400 mb-2 relative">Precision Rating</p>
                                            <div className="flex items-baseline gap-2 relative">
                                                <span className="text-5xl font-black text-gym-500 italic">
                                                    {performance.averageRating?.toFixed(1) || performance.stats?.AverageRating?.toFixed(1) || '0.0'}
                                                </span>
                                                <span className="text-xs font-bold text-gym-dark-300">/ 5.0</span>
                                            </div>
                                        </article>

                                        <article className="p-8 rounded-[40px] bg-white border-2 border-gym-dark-50 shadow-lg relative group">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gym-dark-400 mb-2">Intel Count</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-5xl font-black text-gym-dark-900 italic">
                                                    {performance.totalReviews || performance.stats?.ReviewCount || 0}
                                                </span>
                                                <span className="text-xs font-bold text-gym-dark-400 uppercase tracking-widest">FEEDBACKS</span>
                                            </div>
                                            <div className="absolute top-8 right-8 text-gym-500 opacity-20 group-hover:opacity-100 transition-opacity">
                                                <MessageSquare size={32} />
                                            </div>
                                        </article>
                                    </div>

                                    <div className="space-y-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-gym-500 rounded-full"></div>
                                            <h4 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight italic">Raw Field Intelligence</h4>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {(performance.reviews || performance.feedbacks || []).map((review, idx) => (
                                                <div key={idx} className="p-6 bg-gym-dark-50/50 rounded-[32px] border-2 border-gym-dark-100/50 group hover:bg-white hover:shadow-2xl transition-all duration-300">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="flex gap-1 text-gym-500">
                                                            {[...Array(5)].map((_, i) => (
                                                                <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} strokeWidth={2.5} />
                                                            ))}
                                                        </div>
                                                        <span className="text-[9px] font-black text-gym-dark-300 uppercase tracking-widest">{new Date(review.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm font-medium text-gym-dark-700 italic leading-relaxed mb-6 group-hover:text-gym-dark-900 transition-colors">"{review.comment || 'Tactical silence observed.'}"</p>
                                                    {review.customerName && (
                                                        <div className="flex items-center gap-2 justify-end">
                                                            <div className="w-5 h-5 rounded-full bg-gym-dark-900 flex items-center justify-center">
                                                                <Users size={10} className="text-gym-500" />
                                                            </div>
                                                            <p className="text-[9px] font-black text-gym-dark-400 uppercase tracking-widest">— {review.customerName}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {(performance.reviews?.length === 0 && performance.feedbacks?.length === 0) && (
                                                <div className="col-span-full py-20 text-center bg-gym-dark-50/30 rounded-[40px] border-2 border-dashed border-gym-dark-100">
                                                    <MessageSquare className="mx-auto text-gym-dark-100 mb-4" size={48} />
                                                    <p className="text-[10px] font-black text-gym-dark-300 uppercase tracking-widest italic">Encrypted Feedback Sync Nil</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeDetailTab === 'students' && (
                                <div className="space-y-10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-gym-500 rounded-full"></div>
                                            <h4 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight italic">Operational Reach ({students.length} Athletes)</h4>
                                        </div>
                                        <button className="text-[10px] font-black text-gym-500 uppercase tracking-widest flex items-center gap-2 hover:gap-3 transition-all">
                                            Download Manifest <RefreshCw size={14} />
                                        </button>
                                    </div>

                                    <div className="bg-white rounded-[40px] border-2 border-gym-dark-50 overflow-hidden shadow-2xl">
                                        <table className="w-full text-left">
                                            <thead className="bg-gym-dark-900 text-gym-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                                <tr>
                                                    <th className="px-10 py-6">Athlete Profile</th>
                                                    <th className="px-10 py-6 text-center">Sessions Logged</th>
                                                    <th className="px-10 py-6 text-right">Last Sync Event</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gym-dark-50">
                                                {students.map((student, idx) => (
                                                    <tr key={idx} className="hover:bg-gym-50/50 transition-colors group">
                                                        <td className="px-10 py-6">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-2xl bg-gym-dark-50 text-gym-dark-900 flex items-center justify-center font-black group-hover:bg-gym-dark-900 group-hover:text-gym-500 transition-all">
                                                                    {(student.fullName || student.customerName)?.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-black text-gym-dark-900 uppercase tracking-tight">{student.fullName || student.customerName}</div>
                                                                    <div className="text-[10px] font-bold text-gym-dark-300 truncate max-w-[200px]">{student.email || student.customerEmail}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-10 py-6 text-center">
                                                            <span className="px-4 py-1.5 rounded-xl bg-gym-dark-900 text-gym-500 text-[10px] font-black uppercase italic border border-gym-dark-800 shadow-sm">
                                                                {student.completedSessions || 0} DEPLOYED
                                                            </span>
                                                        </td>
                                                        <td className="px-10 py-6 text-right">
                                                            <span className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest bg-gym-dark-50 px-3 py-1.5 rounded-full border border-gym-dark-100">
                                                                {student.lastSession || 'AWAITING SYNC'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {students.length === 0 && (
                                                    <tr>
                                                        <td colSpan="3" className="px-10 py-20 text-center">
                                                            <Users className="mx-auto text-gym-dark-100 mb-4" size={64} />
                                                            <p className="text-xs font-black text-gym-dark-300 uppercase tracking-widest italic">Resource Manifest Empty</p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </WorkspaceScaffold>
    )
}

export default AdminCoachManagementPage
