import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Mail, Phone, RefreshCw, Search, Star, Users } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { coachBookingApi } from '../../features/coach/api/coachBookingApi'
import { formatDate as formatDateValue } from '../../utils/formatters'

const RATING_FILTERS = [
  { value: 'all', label: 'All ratings' },
  { value: 'high', label: '4.0+ stars' },
  { value: 'low', label: 'Below 4.0' },
  { value: 'unrated', label: 'Unrated' },
]

const STUDENT_FILTERS = [
  { value: 'all', label: 'All student loads' },
  { value: 'active', label: 'Has active students' },
  { value: 'none', label: 'No active students' },
]

const EXPERIENCE_FILTERS = [
  { value: 'all', label: 'All experience levels' },
  { value: 'junior', label: '0-2 years' },
  { value: 'mid', label: '3-5 years' },
  { value: 'senior', label: '6+ years' },
]

const INPUT_CLASS = 'gc-input'
const TEXTAREA_CLASS = 'gc-textarea'
const FILTER_CLASS = 'gc-select min-h-0 rounded-2xl bg-[rgba(18,18,26,0.92)] px-3 py-2'

function resolveApiMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function formatDate(value) {
  if (!value) return '--'
  return formatDateValue(value, 'en-GB')
}

function formatRating(value) {
  const numeric = Number(value || 0)
  return Number.isFinite(numeric) ? numeric.toFixed(1) : '0.0'
}

function buildCoachDraft(detail) {
  return {
    fullName: detail?.fullName || '',
    phone: detail?.phone || '',
    dateOfBirth: detail?.dateOfBirth || '',
    gender: detail?.gender || '',
    experienceYears: detail?.experienceYears == null ? '' : String(detail.experienceYears),
    bio: detail?.bio || '',
  }
}

function validateCoachDraft(draft) {
  if (!String(draft.fullName || '').trim()) return 'Coach full name is required.'
  if (!String(draft.phone || '').trim()) return 'Coach phone number is required.'
  if (draft.dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(draft.dateOfBirth)) {
    return 'Date of birth must use YYYY-MM-DD format.'
  }
  if (draft.experienceYears === '') return 'Years of experience is required.'
  if (!/^\d+$/.test(String(draft.experienceYears))) {
    return 'Years of experience must be a whole number.'
  }
  if (Number(draft.experienceYears) < 0) return 'Years of experience cannot be negative.'
  if (!String(draft.bio || '').trim()) return 'Coach bio is required.'
  return ''
}

function ratingMatchesFilter(coach, ratingFilter) {
  const rating = Number(coach.averageRating || 0)
  if (ratingFilter === 'high') return rating >= 4
  if (ratingFilter === 'low') return rating > 0 && rating < 4
  if (ratingFilter === 'unrated') return rating <= 0
  return true
}

function studentMatchesFilter(coach, studentFilter) {
  const students = Number(coach.studentCount || coach.totalStudents || 0)
  if (studentFilter === 'active') return students > 0
  if (studentFilter === 'none') return students === 0
  return true
}

function experienceMatchesFilter(coach, experienceFilter) {
  const years = Number(coach.experienceYears || 0)
  if (experienceFilter === 'junior') return years <= 2
  if (experienceFilter === 'mid') return years >= 3 && years <= 5
  if (experienceFilter === 'senior') return years >= 6
  return true
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[rgba(18,18,26,0.92)] px-5 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
    </div>
  )
}

function StarRating({ value }) {
  const rounded = Math.max(0, Math.min(5, Math.round(Number(value || 0))))
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-amber-500">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            size={14}
            className={index < rounded ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
          />
        ))}
      </span>
      <span className="text-xs font-semibold text-slate-300">{formatRating(value)}</span>
    </div>
  )
}

function AdminCoachManagementPage() {
  const [coaches, setCoaches] = useState([])
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [studentFilter, setStudentFilter] = useState('all')
  const [experienceFilter, setExperienceFilter] = useState('all')
  const [selectedCoachId, setSelectedCoachId] = useState(null)
  const [coachDetail, setCoachDetail] = useState(null)
  const [performance, setPerformance] = useState(null)
  const [students, setStudents] = useState([])
  const [activeDetailTab, setActiveDetailTab] = useState('profile')
  const [draft, setDraft] = useState(null)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    loadCoaches()
  }, [])

  async function loadCoaches() {
    try {
      setLoading(true)
      setError('')
      const res = await coachBookingApi.adminGetCoaches()
      setCoaches(res.data?.items || [])
    } catch (loadError) {
      setError(resolveApiMessage(loadError, 'Coach list could not be loaded.'))
    } finally {
      setLoading(false)
    }
  }

  async function loadCoachDetail(coachId) {
    try {
      setDetailLoading(true)
      setError('')
      setMessage('')
      setSelectedCoachId(coachId)
      setActiveDetailTab('profile')

      const [detailRes, perfRes, studentsRes] = await Promise.all([
        coachBookingApi.adminGetCoachDetail(coachId),
        coachBookingApi.adminGetCoachPerformance(coachId),
        coachBookingApi.adminGetCoachStudents(coachId),
      ])

      const detail = detailRes.data || null
      setCoachDetail(detail)
      setDraft(buildCoachDraft(detail))
      setPerformance(perfRes.data || null)
      setStudents(studentsRes.data?.items || [])
      setFormError('')
    } catch (loadError) {
      setError(resolveApiMessage(loadError, 'Coach detail could not be loaded.'))
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleUpdateProfile(event) {
    event.preventDefault()
    if (!selectedCoachId || !draft) return

    const validationError = validateCoachDraft(draft)
    if (validationError) {
      setFormError(validationError)
      return
    }

    try {
      setDetailLoading(true)
      setFormError('')
      setError('')
      await coachBookingApi.adminUpdateCoachProfile(selectedCoachId, {
        fullName: draft.fullName.trim(),
        phone: draft.phone.trim(),
        dateOfBirth: draft.dateOfBirth || null,
        gender: draft.gender.trim() || null,
        experienceYears: Number(draft.experienceYears),
        bio: draft.bio.trim(),
      })
      await loadCoaches()
      await loadCoachDetail(selectedCoachId)
      setMessage('Coach profile updated successfully.')
    } catch (saveError) {
      setFormError(resolveApiMessage(saveError, 'Coach profile could not be updated.'))
      setDetailLoading(false)
    }
  }

  const filteredCoaches = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return coaches.filter((coach) => {
      if (!ratingMatchesFilter(coach, ratingFilter)) return false
      if (!studentMatchesFilter(coach, studentFilter)) return false
      if (!experienceMatchesFilter(coach, experienceFilter)) return false
      if (!keyword) return true
      return [coach.fullName, coach.email, coach.phone, coach.bio]
        .some((value) => String(value || '').toLowerCase().includes(keyword))
    })
  }, [coaches, experienceFilter, ratingFilter, search, studentFilter])

  const summary = useMemo(() => ({
    total: coaches.length,
    highRated: coaches.filter((coach) => Number(coach.averageRating || 0) >= 4).length,
    activeStudents: coaches.reduce((sum, coach) => sum + Number(coach.studentCount || 0), 0),
    needsAttention: coaches.filter((coach) => Number(coach.studentCount || 0) === 0 || Number(coach.averageRating || 0) < 4).length,
  }), [coaches])

  return (
    <WorkspaceScaffold title="Coach Management" subtitle="Filter coach performance, inspect coach rosters, and update profile information with explicit validation." links={adminNav}>
      <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.16),_transparent_30%),linear-gradient(135deg,_rgba(18,18,26,0.98),_rgba(10,10,15,0.92))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Coach operations</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">Keep coach quality, load, and profile data aligned</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                Review the full coach directory, surface who needs attention, then drill into performance, students, and editable profile information from one workspace.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/70 bg-[rgba(18,18,26,0.85)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Current focus</p>
                <p className="mt-2 text-lg font-bold text-white">{summary.needsAttention} coach(es) need attention</p>
                <p className="mt-2 text-sm text-slate-400">This includes unrated coaches and coaches with no active students.</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[rgba(18,18,26,0.85)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Roster health</p>
                <p className="mt-2 text-lg font-bold text-white">{summary.activeStudents} active student relationships</p>
                <p className="mt-2 text-sm text-slate-400">Use the filters below to isolate high-load, low-load, or high-rating coaches quickly.</p>
              </div>
            </div>
          </div>
        </section>

        {(error || message) ? (
          <div className={`flex items-center justify-between rounded-3xl border px-5 py-4 text-sm font-medium ${error ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>
            <span>{error || message}</span>
            <button type="button" className="rounded-full px-3 py-1 text-xs font-semibold" onClick={() => { setError(''); setMessage('') }}>
              Dismiss
            </button>
          </div>
        ) : null}

        <section className="gc-card-compact space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="gc-section-kicker">Coach directory</h2>
              <p className="mt-1 text-xs text-zinc-500">Filter by search, rating, student activity, and experience before opening a coach profile.</p>
            </div>
            <button
              type="button"
              onClick={loadCoaches}
              className="gc-button-secondary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total coaches" value={summary.total} />
            <SummaryCard label="4.0+ rating" value={summary.highRated} />
            <SummaryCard label="Active students" value={summary.activeStudents} />
            <SummaryCard label="Need attention" value={summary.needsAttention} />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
            <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 transition-[border-color,background-color,box-shadow] duration-200 ease-out focus-within:border-amber-500/30 focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-500/15">
              <Search size={14} className="text-slate-400" />
              <span className="sr-only">Search coaches</span>
              <input
                type="search"
                name="coachSearch"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Search by coach, email, phone, or bio…"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
              />
            </label>
            <select
              aria-label="Rating filter"
              value={ratingFilter}
              onChange={(event) => setRatingFilter(event.target.value)}
              name="ratingFilter"
              className={FILTER_CLASS}
            >
              {RATING_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              aria-label="Student filter"
              value={studentFilter}
              onChange={(event) => setStudentFilter(event.target.value)}
              name="studentFilter"
              className={FILTER_CLASS}
            >
              {STUDENT_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              aria-label="Experience filter"
              value={experienceFilter}
              onChange={(event) => setExperienceFilter(event.target.value)}
              name="experienceFilter"
              className={FILTER_CLASS}
            >
              {EXPERIENCE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-[rgba(18,18,26,0.92)] shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                <tr>
                  <th className="px-5 py-4">Coach</th>
                  <th className="px-5 py-4">Experience</th>
                  <th className="px-5 py-4">Rating</th>
                  <th className="px-5 py-4">Students</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-zinc-500" aria-live="polite">Loading coaches…</td>
                  </tr>
                ) : filteredCoaches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-zinc-500">No coaches match the current filters.</td>
                  </tr>
                ) : filteredCoaches.map((coach) => (
                  <tr key={coach.coachId} className={selectedCoachId === coach.coachId ? 'bg-gym-500/10' : 'hover:bg-white/5'}>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-white">{coach.fullName}</div>
                      <div className="mt-1 text-xs text-zinc-500">{coach.email}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-300">{Number(coach.experienceYears || 0)} years</td>
                    <td className="px-5 py-4">
                      <StarRating value={coach.averageRating} />
                    </td>
                    <td className="px-5 py-4 text-slate-300">{Number(coach.studentCount || 0)} active</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => loadCoachDetail(coach.coachId)}
                        className="gc-button-secondary px-4 py-2 text-xs font-semibold"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {selectedCoachId && (
          <section className="gc-card-compact space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-4">
                {coachDetail?.avatarUrl ? (
                  <img src={coachDetail.avatarUrl} alt={coachDetail.fullName} className="h-14 w-14 rounded-3xl object-cover" width="56" height="56" loading="lazy" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gym-500/10 text-xl font-black text-gym-300">
                    {coachDetail?.fullName?.charAt(0) || 'C'}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-white">{coachDetail?.fullName || 'Coach detail'}</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {coachDetail?.email || '--'} • ID #{selectedCoachId}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Mail size={14} />
                  {coachDetail?.email || '--'}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Phone size={14} />
                  {coachDetail?.phone || '--'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 border-b border-white/10 pb-3">
              {[
                { key: 'profile', label: 'Profile' },
                { key: 'performance', label: 'Performance' },
                { key: 'students', label: 'Students' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveDetailTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    activeDetailTab === tab.key
                      ? 'bg-amber-500 text-slate-950'
                      : 'border border-white/10 bg-[rgba(18,18,26,0.92)] text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {detailLoading && !coachDetail ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-6 text-sm text-zinc-500">
                Loading coach detail…
              </div>
            ) : null}

            {activeDetailTab === 'profile' && draft ? (
              <form noValidate onSubmit={handleUpdateProfile} className="space-y-5">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Profile editor</p>
                  <p className="mt-2 text-sm text-slate-400">Update the coach-facing profile information below. Validation is applied before the payload is sent to the backend.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Full name</span>
                    <input
                      type="text"
                      name="fullName"
                      value={draft.fullName}
                      onChange={(event) => {
                        setDraft((prev) => ({ ...prev, fullName: event.target.value }))
                        setFormError('')
                      }}
                      autoComplete="name"
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Phone</span>
                    <input
                      type="tel"
                      name="phone"
                      value={draft.phone}
                      onChange={(event) => {
                        setDraft((prev) => ({ ...prev, phone: event.target.value }))
                        setFormError('')
                      }}
                      autoComplete="tel"
                      inputMode="tel"
                      spellCheck={false}
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Date of birth</span>
                    <input
                      type="date"
                      name="dateOfBirth"
                      value={draft.dateOfBirth}
                      onChange={(event) => {
                        setDraft((prev) => ({ ...prev, dateOfBirth: event.target.value }))
                        setFormError('')
                      }}
                      autoComplete="bday"
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Gender</span>
                    <input
                      type="text"
                      name="gender"
                      value={draft.gender}
                      onChange={(event) => {
                        setDraft((prev) => ({ ...prev, gender: event.target.value }))
                        setFormError('')
                      }}
                      autoComplete="sex"
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Years of experience</span>
                    <input
                      type="number"
                      name="experienceYears"
                      min="0"
                      value={draft.experienceYears}
                      onChange={(event) => {
                        setDraft((prev) => ({ ...prev, experienceYears: event.target.value }))
                        setFormError('')
                      }}
                      autoComplete="off"
                      inputMode="numeric"
                      className={INPUT_CLASS}
                    />
                  </label>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Bio</span>
                    <textarea
                      name="bio"
                      value={draft.bio}
                      onChange={(event) => {
                        setDraft((prev) => ({ ...prev, bio: event.target.value }))
                        setFormError('')
                      }}
                      autoComplete="off"
                      className={`min-h-[140px] ${TEXTAREA_CLASS}`}
                      placeholder="Describe the coach profile, strengths, and focus areas…"
                    />
                  </label>
                </div>

                {formError ? (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300" aria-live="polite">
                    {formError}
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={detailLoading}
                    className="gc-button-primary px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {detailLoading ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            ) : null}

            {activeDetailTab === 'performance' ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <SummaryCard label="Average rating" value={formatRating(performance?.averageRating)} />
                  <SummaryCard label="Total reviews" value={performance?.totalReviews || 0} />
                  <SummaryCard label="Active students" value={students.length} />
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-white">Recent reviews</h3>
                  {(performance?.reviews || []).length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-6 text-sm text-zinc-500">
                      No reviews yet.
                    </div>
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {(performance?.reviews || []).map((review) => (
                        <article key={review.coachFeedbackId} className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <StarRating value={review.rating} />
                            <span className="text-[11px] text-slate-400">{formatDate(review.createdAt)}</span>
                          </div>
                          <p className="mt-3 text-sm text-slate-300">{review.comment || 'No comment provided.'}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {activeDetailTab === 'students' ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Users size={16} className="text-amber-300" />
                  Active student roster
                  </div>
                  <p className="mt-2 text-sm text-slate-400">Use this list to see who is actively assigned to the selected coach and how far each relationship has progressed.</p>
                </div>
                <div className="overflow-x-auto rounded-[28px] border border-white/10 bg-[rgba(18,18,26,0.92)] shadow-sm">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-white/5 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      <tr>
                        <th className="px-5 py-4">Student</th>
                        <th className="px-5 py-4">Completed sessions</th>
                        <th className="px-5 py-4">Latest completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {students.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-6 text-center text-zinc-500">No students assigned yet.</td>
                        </tr>
                      ) : students.map((student) => (
                        <tr key={student.customerId}>
                          <td className="px-5 py-4">
                            <div className="font-semibold text-white">{student.fullName}</div>
                            <div className="mt-1 text-xs text-zinc-500">{student.email}</div>
                          </td>
                          <td className="px-5 py-4 text-slate-300">{student.completedSessions || 0}</td>
                          <td className="px-5 py-4 text-slate-300">{student.lastSession || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </WorkspaceScaffold>
  )
}

export default AdminCoachManagementPage





