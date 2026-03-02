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
  const [activeDetailTab, setActiveDetailTab] = useState('profile')

  useEffect(() => {
    loadCoaches()
  }, [])

  async function loadCoaches() {
    try {
      setLoading(true)
      const res = await coachBookingApi.adminGetCoaches()
      setCoaches(res.data?.items || [])
    } catch {
      setError('Could not load coach list')
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
        coachBookingApi.adminGetCoachStudents(coachId),
      ])

      const detail = coachesRes.data?.items?.find(c => c.coachId === coachId)
      setCoachDetail(detail)
      setPerformance(perfRes.data)
      setStudents(stdsRes.data?.items || [])
    } catch {
      setError('Could not load coach details')
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateProfile(e) {
    e.preventDefault()
    const formData = new FormData(e.target)
    const payload = {
      bio: formData.get('bio'),
      experienceYears: parseInt(formData.get('experienceYears')),
    }

    try {
      setLoading(true)
      await coachBookingApi.adminUpdateCoachProfile(selectedCoachId, payload)
      setMessage('Coach profile updated successfully')
      loadCoaches()
      setCoachDetail({ ...coachDetail, ...payload })
    } catch {
      setError('Profile update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <WorkspaceScaffold title="Coach Management" subtitle="Review coach performance and manage coach profiles" links={adminNav}>
      <div className="mx-auto max-w-7xl space-y-6 pb-10">
        {(error || message) && (
          <div className={`flex items-center justify-between rounded-xl p-4 ${error ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            <span>{error || message}</span>
            <button onClick={() => { setError(''); setMessage('') }}>x</button>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-6">
            <h3 className="text-lg font-bold text-slate-900">Coach list ({coaches.length})</h3>
            <button onClick={loadCoaches} className="text-sm font-bold text-gym-600">Refresh</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-4">Name / Email</th>
                  <th className="px-6 py-4">Experience</th>
                  <th className="px-6 py-4">Rating</th>
                  <th className="px-6 py-4">Students</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coaches.map((coach) => (
                  <tr key={coach.coachId} className="transition-colors hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{coach.fullName}</div>
                      <div className="text-xs text-slate-500">{coach.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">{coach.experienceYears} years</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 font-bold text-amber-500">
                        ? {coach.averageRating?.toFixed(1) || '0.0'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gym-600">{coach.totalStudents || coach.studentCount || 0} active</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => loadCoachDetail(coach.coachId)}
                        className="rounded-lg bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-200"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedCoachId && coachDetail && (
          <div className="animate-in fade-in slide-in-from-bottom-4 overflow-hidden rounded-3xl border-2 border-gym-100 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gym-100 text-xl font-bold text-gym-600">
                  {coachDetail.fullName?.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{coachDetail.fullName}</h3>
                  <p className="text-sm text-slate-500">ID: {coachDetail.coachId} | {coachDetail.email}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedCoachId(null); setCoachDetail(null) }}
                className="text-2xl text-slate-400 hover:text-slate-900"
              >
                x
              </button>
            </div>

            <div className="sticky top-0 z-10 flex border-b border-slate-100 bg-white px-6">
              {['profile', 'performance', 'students'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveDetailTab(tab)}
                  className={`border-b-2 px-6 py-4 text-sm font-bold transition-all ${activeDetailTab === tab
                    ? 'border-gym-500 text-gym-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  {tab === 'profile' ? 'Profile' : tab === 'performance' ? 'Performance' : 'Students'}
                </button>
              ))}
            </div>

            <div className="p-8">
              {activeDetailTab === 'profile' && (
                <form onSubmit={handleUpdateProfile} className="max-w-2xl space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Bio</label>
                      <textarea
                        name="bio"
                        defaultValue={coachDetail.bio}
                        className="h-32 w-full rounded-2xl border border-slate-200 p-4 outline-none transition-all focus:ring-2 focus:ring-gym-500"
                        placeholder="Enter coach profile summary..."
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Years of experience</label>
                      <input
                        type="number"
                        name="experienceYears"
                        defaultValue={coachDetail.experienceYears}
                        className="w-full rounded-2xl border border-slate-200 p-4 outline-none transition-all focus:ring-2 focus:ring-gym-500"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-2xl bg-gym-600 px-8 py-3 font-bold text-white shadow-lg shadow-gym-100 transition-all hover:bg-gym-700"
                  >
                    {loading ? 'Saving...' : 'Save changes'}
                  </button>
                </form>
              )}

              {activeDetailTab === 'performance' && performance && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-center">
                      <div className="text-3xl font-black text-amber-600">{performance.averageRating?.toFixed(1) || performance.stats?.AverageRating?.toFixed(1) || '0.0'}</div>
                      <div className="mt-1 text-sm font-bold text-amber-800">Average score</div>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 text-center">
                      <div className="text-3xl font-black text-blue-600">{performance.totalReviews || performance.stats?.ReviewCount || 0}</div>
                      <div className="mt-1 text-sm font-bold text-blue-800">Total reviews</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="border-l-4 border-amber-400 pl-3 font-bold text-slate-900">Recent reviews</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {(performance.reviews || performance.feedbacks || []).map((review, idx) => (
                        <div key={idx} className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-500">{'?'.repeat(review.rating)}{'?'.repeat(5 - review.rating)}</span>
                            <span className="text-[10px] text-slate-400">{new Date(review.createdAt).toLocaleDateString('en-GB')}</span>
                          </div>
                          <p className="text-sm italic text-slate-700">"{review.comment || 'No comment'}"</p>
                          {review.customerName && <p className="text-right text-[10px] text-slate-400">- {review.customerName}</p>}
                        </div>
                      ))}
                      {(performance.reviews?.length === 0 && performance.feedbacks?.length === 0) && <p className="text-sm text-slate-500">No reviews yet.</p>}
                    </div>
                  </div>
                </div>
              )}

              {activeDetailTab === 'students' && (
                <div className="space-y-6">
                  <h4 className="border-l-4 border-gym-400 pl-3 font-bold text-slate-900">Student list ({students.length})</h4>
                  <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 font-bold text-slate-500">
                        <tr>
                          <th className="px-6 py-4">Student name</th>
                          <th className="px-6 py-4 text-center">Completed sessions</th>
                          <th className="px-6 py-4 text-right">Latest session</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {students.map((student, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="font-bold">{student.fullName || student.customerName}</div>
                              <div className="text-xs text-slate-400">{student.email || student.customerEmail}</div>
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-gym-600">{student.completedSessions || 0} sessions</td>
                            <td className="px-6 py-4 text-right text-slate-500">{student.lastSession || 'N/A'}</td>
                          </tr>
                        ))}
                        {students.length === 0 && (
                          <tr>
                            <td colSpan="3" className="px-6 py-10 text-center italic text-slate-400">No students yet.</td>
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
