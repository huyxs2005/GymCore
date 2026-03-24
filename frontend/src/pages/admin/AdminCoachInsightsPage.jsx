import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowRight, Search, Star, TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { adminApi } from '../../features/admin/api/adminApi'

function formatRating(value) {
  const numeric = Number(value || 0)
  return Number.isFinite(numeric) ? numeric.toFixed(1) : '0.0'
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

function SummaryCard({ label, value, detail, tone = 'border-white/10 bg-white/5' }) {
  return (
    <article className={`rounded-[28px] border p-5 shadow-sm ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-3 text-sm text-slate-400">{detail}</p>
    </article>
  )
}

function listItemKey(item) {
  return item.coachId || item.coachName
}

function buildCoachInsightRows(studentItems = [], feedbackItems = []) {
  const byCoachId = new Map()

  studentItems.forEach((item) => {
    byCoachId.set(item.coachId, {
      coachId: item.coachId,
      coachName: item.coachName,
      studentCount: Number(item.studentCount || 0),
      averageRating: 0,
      reviewCount: 0,
    })
  })

  feedbackItems.forEach((item) => {
    const existing = byCoachId.get(item.coachId) || {
      coachId: item.coachId,
      coachName: item.coachName,
      studentCount: 0,
      averageRating: 0,
      reviewCount: 0,
    }
    byCoachId.set(item.coachId, {
      ...existing,
      coachName: item.coachName || existing.coachName,
      averageRating: Number(item.averageRating || 0),
      reviewCount: Number(item.reviewCount || 0),
    })
  })

  return Array.from(byCoachId.values()).sort((left, right) => {
    if (right.studentCount !== left.studentCount) return right.studentCount - left.studentCount
    if (right.averageRating !== left.averageRating) return right.averageRating - left.averageRating
    return String(left.coachName || '').localeCompare(String(right.coachName || ''))
  })
}

function insightStatus(coach) {
  if (coach.studentCount >= 5 && coach.averageRating < 4 && coach.reviewCount > 0) {
    return {
      label: 'High load, low satisfaction',
      tone: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
      detail: 'This coach is handling a large roster but rating is trending low.',
    }
  }
  if (coach.studentCount === 0) {
    return {
      label: 'Needs students',
      tone: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
      detail: 'The coach currently has no active student relationship.',
    }
  }
  if (coach.reviewCount === 0) {
    return {
      label: 'Feedback pending',
      tone: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
      detail: 'Student activity exists but the coach still lacks review coverage.',
    }
  }
  if (coach.averageRating >= 4.5) {
    return {
      label: 'Top performer',
      tone: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      detail: 'High customer satisfaction with stable review coverage.',
    }
  }
  return {
    label: 'Stable',
    tone: 'bg-white/5 text-slate-300 border-white/10',
    detail: 'No urgent signal from current student and feedback trends.',
  }
}

function AdminCoachInsightsPage() {
  const [search, setSearch] = useState('')
  const [signalFilter, setSignalFilter] = useState('all')

  const studentsQuery = useQuery({
    queryKey: ['admin-coach-students-insights'],
    queryFn: adminApi.getCoachStudents,
  })

  const feedbackQuery = useQuery({
    queryKey: ['admin-coach-feedback-insights'],
    queryFn: adminApi.getCoachFeedback,
  })

  const rows = useMemo(
    () => buildCoachInsightRows(studentsQuery.data?.items ?? [], feedbackQuery.data?.items ?? []),
    [feedbackQuery.data?.items, studentsQuery.data?.items],
  )

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return rows.filter((coach) => {
      const status = insightStatus(coach)
      if (signalFilter === 'attention' && !['High load, low satisfaction', 'Needs students'].includes(status.label)) {
        return false
      }
      if (signalFilter === 'top' && status.label !== 'Top performer') {
        return false
      }
      if (signalFilter === 'feedback-gap' && status.label !== 'Feedback pending') {
        return false
      }
      if (!keyword) return true
      return String(coach.coachName || '').toLowerCase().includes(keyword)
    })
  }, [rows, search, signalFilter])

  const summary = useMemo(() => {
    const topPerformerCount = rows.filter((coach) => insightStatus(coach).label === 'Top performer').length
    const needsAttentionCount = rows.filter((coach) =>
      ['High load, low satisfaction', 'Needs students'].includes(insightStatus(coach).label),
    ).length
    const feedbackGapCount = rows.filter((coach) => insightStatus(coach).label === 'Feedback pending').length
    const totalStudents = rows.reduce((sum, coach) => sum + coach.studentCount, 0)

    return {
      totalCoaches: rows.length,
      topPerformerCount,
      needsAttentionCount,
      feedbackGapCount,
      totalStudents,
      mostLoadedCoach: rows[0] || null,
      highestRatedCoach: rows
        .filter((coach) => coach.reviewCount > 0)
        .slice()
        .sort((left, right) => right.averageRating - left.averageRating || right.reviewCount - left.reviewCount)[0] || null,
    }
  }, [rows])

  const watchlist = useMemo(
    () => rows.filter((coach) => ['High load, low satisfaction', 'Needs students', 'Feedback pending'].includes(insightStatus(coach).label)).slice(0, 6),
    [rows],
  )

  const hasError = studentsQuery.isError || feedbackQuery.isError

  return (
    <WorkspaceScaffold
      title="Admin Coach Insights"
      subtitle="View coach students and customer feedback across the platform."
      links={adminNav}
    >
      <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(245,158,11,0.1),_transparent_28%),linear-gradient(135deg,_rgba(18,18,26,0.98),_rgba(10,10,15,0.92))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Coach insights</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">Turn student load and feedback into clear coach signals</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                This workspace combines roster size and rating coverage so admin can quickly see who is overloaded, who lacks student traction, and who is performing strongly enough to model.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  to="/admin/coach-management"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open coach management <ArrowRight size={16} />
                </Link>
                <Link
                  to="/admin/support"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(18,18,26,0.92)] px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5"
                >
                  Open support console <ArrowRight size={16} />
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/70 bg-[rgba(18,18,26,0.85)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Most loaded coach</p>
                <p className="mt-2 text-lg font-bold text-white">{summary.mostLoadedCoach?.coachName || 'No data yet'}</p>
                <p className="mt-2 text-sm text-slate-400">
                  {summary.mostLoadedCoach ? `${summary.mostLoadedCoach.studentCount} active student relationships` : 'Waiting for roster data.'}
                </p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-[rgba(18,18,26,0.85)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Highest rated coach</p>
                <p className="mt-2 text-lg font-bold text-white">{summary.highestRatedCoach?.coachName || 'No review data yet'}</p>
                <p className="mt-2 text-sm text-slate-400">
                  {summary.highestRatedCoach ? `${formatRating(summary.highestRatedCoach.averageRating)} average across ${summary.highestRatedCoach.reviewCount} review(s)` : 'Waiting for customer feedback.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {hasError ? (
          <section className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-300 shadow-sm">
            Coach insight data could not be loaded. Refresh once the backend is available.
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Tracked coaches" value={summary.totalCoaches} detail="Combined from coach student and feedback endpoints." />
          <SummaryCard label="Top performers" value={summary.topPerformerCount} detail="Coaches with 4.5+ rating and real review coverage." tone="border-emerald-500/20 bg-emerald-500/10" />
          <SummaryCard label="Need attention" value={summary.needsAttentionCount} detail="Low-satisfaction high-load coaches or coaches with no active students." tone="border-rose-500/20 bg-rose-500/10" />
          <SummaryCard label="Student relationships" value={summary.totalStudents} detail={`${summary.feedbackGapCount} coach(es) still need stronger feedback coverage.`} tone="border-sky-500/20 bg-sky-500/10" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <article className="gc-card-compact">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-300">
                <TrendingUp size={18} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Watchlist</p>
                <h3 className="mt-1 text-xl font-bold text-white">Coaches that deserve a closer look</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {watchlist.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-zinc-500">
                  No coach currently stands out as high risk based on the latest data.
                </div>
              ) : (
                watchlist.map((coach) => {
                  const status = insightStatus(coach)
                  return (
                    <article key={`watch-${listItemKey(coach)}`} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-bold text-white">{coach.coachName}</p>
                          <p className="mt-1 text-sm text-slate-400">{status.detail}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${status.tone}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-[rgba(18,18,26,0.92)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Students</p>
                          <p className="mt-2 text-lg font-bold text-white">{coach.studentCount}</p>
                        </div>
                        <div className="rounded-2xl bg-[rgba(18,18,26,0.92)] px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Feedback</p>
                          <div className="mt-2">
                            <StarRating value={coach.averageRating} />
                          </div>
                          <p className="mt-2 text-xs text-zinc-500">{coach.reviewCount} review(s)</p>
                        </div>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </article>

          <article className="gc-card-compact">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Directory insights</p>
                <h3 className="mt-1 text-xl font-bold text-white">Coach roster and feedback overview</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSignalFilter('all')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${signalFilter === 'all' ? 'bg-gym-600 text-white' : 'border border-white/10 bg-[rgba(18,18,26,0.92)] text-slate-300 hover:bg-white/5'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSignalFilter('attention')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${signalFilter === 'attention' ? 'bg-gym-600 text-white' : 'border border-white/10 bg-[rgba(18,18,26,0.92)] text-slate-300 hover:bg-white/5'}`}
                >
                  Needs attention
                </button>
                <button
                  type="button"
                  onClick={() => setSignalFilter('top')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${signalFilter === 'top' ? 'bg-gym-600 text-white' : 'border border-white/10 bg-[rgba(18,18,26,0.92)] text-slate-300 hover:bg-white/5'}`}
                >
                  Top performers
                </button>
                <button
                  type="button"
                  onClick={() => setSignalFilter('feedback-gap')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${signalFilter === 'feedback-gap' ? 'bg-gym-600 text-white' : 'border border-white/10 bg-[rgba(18,18,26,0.92)] text-slate-300 hover:bg-white/5'}`}
                >
                  Feedback gaps
                </button>
              </div>
            </div>

            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition-[border-color,background-color,box-shadow] focus-within:border-gym-500/40 focus-within:bg-white/10 focus-within:ring-2 focus-within:ring-gym-500/20">
              <Search size={15} className="text-slate-400" />
              <span className="sr-only">Search coach insights</span>
              <input
                type="search"
                name="coachInsightSearch"
                autoComplete="off"
                spellCheck={false}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by coach name…"
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-400"
              />
            </label>

            {(studentsQuery.isLoading || feedbackQuery.isLoading) && !rows.length ? (
              <div className="mt-5 grid gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-3xl border border-white/10 bg-white/10" />
                ))}
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-[28px] border border-white/10 bg-[rgba(18,18,26,0.92)] shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/5 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    <tr>
                      <th className="px-5 py-4">Coach</th>
                      <th className="px-5 py-4">Student load</th>
                      <th className="px-5 py-4">Feedback</th>
                      <th className="px-5 py-4">Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-center text-zinc-500">No coaches match the current filters.</td>
                      </tr>
                    ) : (
                      filteredRows.map((coach) => {
                        const status = insightStatus(coach)
                        return (
                          <tr key={listItemKey(coach)} className="hover:bg-white/5">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-white">{coach.coachName}</div>
                              <div className="mt-1 text-xs text-zinc-500">Coach ID #{coach.coachId}</div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300">
                                <Users size={14} />
                                {coach.studentCount} active student(s)
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <StarRating value={coach.averageRating} />
                              <p className="mt-2 text-xs text-zinc-500">{coach.reviewCount} review(s)</p>
                            </td>
                            <td className="px-5 py-4">
                              <div className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${status.tone}`}>
                                {status.label}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-[28px] border border-white/10 bg-[rgba(18,18,26,0.92)] p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <Star size={18} />
              </span>
              <h3 className="text-lg font-bold text-white">Best reviewed</h3>
            </div>
            <p className="mt-4 text-base font-semibold text-white">{summary.highestRatedCoach?.coachName || 'No review data yet'}</p>
            <p className="mt-2 text-sm text-slate-400">
              {summary.highestRatedCoach ? `${formatRating(summary.highestRatedCoach.averageRating)} average across ${summary.highestRatedCoach.reviewCount} review(s).` : 'Once coach feedback arrives, this card will highlight the current benchmark.'}
            </p>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-[rgba(18,18,26,0.92)] p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
                <Activity size={18} />
              </span>
              <h3 className="text-lg font-bold text-white">Feedback coverage</h3>
            </div>
            <p className="mt-4 text-base font-semibold text-white">{summary.feedbackGapCount} coach(es) need more review visibility</p>
            <p className="mt-2 text-sm text-slate-400">Coaches with student activity but no review coverage can hide service-quality drift until it becomes a support issue.</p>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-[rgba(18,18,26,0.92)] p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
                <TrendingUp size={18} />
              </span>
              <h3 className="text-lg font-bold text-white">Load balancing</h3>
            </div>
            <p className="mt-4 text-base font-semibold text-white">{summary.mostLoadedCoach?.coachName || 'No roster data yet'}</p>
            <p className="mt-2 text-sm text-slate-400">
              {summary.mostLoadedCoach ? `${summary.mostLoadedCoach.studentCount} active student(s) currently sit with the heaviest roster.` : 'Once coach-student mappings appear, this card will flag the busiest coach.'}
            </p>
          </article>
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

export default AdminCoachInsightsPage





