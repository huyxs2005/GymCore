import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Clock3, History, AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import PaginationControls from '../../components/common/PaginationControls'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { membershipApi } from '../../features/membership/api/membershipApi'
import { getPlanTierRank } from '../../features/membership/utils/membershipCheckout'
import { usePagination } from '../../hooks/usePagination'

const planTypeLabel = {
  DAY_PASS: 'Day Pass',
  GYM_ONLY: 'Gym Only',
  GYM_PLUS_COACH: 'Gym + Coach',
}

const statusTone = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-400',
  SCHEDULED: 'bg-amber-500/10 text-amber-400',
  EXPIRED: 'bg-slate-500/10 text-slate-300',
  CANCELLED: 'bg-rose-500/10 text-rose-400',
  PENDING: 'bg-amber-500/10 text-amber-400',
}

const planBenefits = {
  DAY_PASS: [
    'One-day front desk check-in access',
    'Best for trial visits and occasional drop-ins',
    'No long-term commitment or PT booking included',
  ],
  GYM_ONLY: [
    'Full gym floor access for the selected duration',
    'Receptionist check-in and health tracking support',
    'Best fit if you train independently without PT sessions',
  ],
  GYM_PLUS_COACH: [
    'Includes full gym membership access',
    'Unlocks coach matching and PT booking requests',
    'Best for members who want guided progress and follow-up',
  ],
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('en-US')} VND`
}

function formatDate(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(parsed)
}

function renderDaysRemaining(membership) {
  if (membership?.daysRemaining != null) {
    return `${membership.daysRemaining} day(s) left`
  }
  if (membership?.daysUntilActive != null) {
    return `Starts in ${membership.daysUntilActive} day(s)`
  }
  return 'No active countdown'
}

function MembershipCard({ title, membership, tone = 'emerald' }) {
  const plan = membership?.plan ?? {}
  const status = String(membership?.status || '').toUpperCase()
  const benefits = planBenefits[String(plan?.planType || '').toUpperCase()] ?? []

  const toneClasses = {
    emerald: 'border-emerald-500/20 bg-emerald-500/[0.05]',
    amber: 'border-amber-500/20 bg-amber-500/[0.05]',
    slate: 'border-white/10 bg-white/[0.02]',
  }

  return (
    <article className={`rounded-3xl border p-6 ${toneClasses[tone] || toneClasses.slate}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{title}</p>
          <h2 className="mt-3 text-2xl font-bold text-white">{plan?.name || 'Membership plan'}</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[status] || 'bg-white/10 text-slate-300'}`}>
          {status || 'UNKNOWN'}
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Start date</p>
          <p className="mt-2 text-sm font-semibold text-white">{formatDate(membership?.startDate)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">End date</p>
          <p className="mt-2 text-sm font-semibold text-white">{formatDate(membership?.endDate)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Price paid</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {formatMoney(membership?.payment?.amount ?? plan?.price)}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-gym-500" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Membership time</p>
        </div>
        <p className="mt-3 text-base font-semibold text-white">{renderDaysRemaining(membership)}</p>
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-gym-500" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Benefits</p>
        </div>
        <div className="mt-4 grid gap-3">
          {benefits.map((benefit) => (
            <div key={benefit} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200">
              {benefit}
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function CustomerCurrentMembershipPage() {
  const queryClient = useQueryClient()
  const [switchWarningOpen, setSwitchWarningOpen] = useState(false)
  const currentMembershipQuery = useQuery({
    queryKey: ['membershipCurrent'],
    queryFn: membershipApi.getCurrentMembership,
  })

  const switchNowMutation = useMutation({
    mutationFn: (payload) => membershipApi.switchNow(payload),
    onSuccess: async () => {
      setSwitchWarningOpen(false)
      toast.success('Queued membership is now active.')
      await queryClient.invalidateQueries({ queryKey: ['membershipCurrent'] })
      await queryClient.invalidateQueries({ queryKey: ['membershipPlans'] })
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || error.message || 'Unable to switch membership now.')
    },
  })

  const membership = currentMembershipQuery.data?.data?.membership ?? {}
  const queuedMembership = currentMembershipQuery.data?.data?.queuedMembership ?? null
  const expiredMembershipHistory = currentMembershipQuery.data?.data?.expiredMembershipHistory ?? []
  const hasMembership = Object.keys(membership).length > 0
  const activePlanTier = getPlanTierRank(membership?.plan?.planType)
  const queuedPlanTier = getPlanTierRank(queuedMembership?.plan?.planType)
  const canSwitchToQueuedHigherTier = queuedPlanTier > activePlanTier
  const canSwitchQueuedMembershipNow = Boolean(
    queuedMembership
    && Object.keys(queuedMembership).length > 0
    && String(membership?.status || '').toUpperCase() === 'ACTIVE'
    && canSwitchToQueuedHigherTier
  )

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
  } = usePagination(expiredMembershipHistory, 10)

  return (
    <WorkspaceScaffold
      title="Current Membership"
      subtitle="See your active plan, upcoming renewal, plan benefits, remaining days, and expired membership history."
      links={customerNav}
      showHeader={false}
    >
      {currentMembershipQuery.isLoading ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 text-sm text-slate-400">
          Loading membership details...
        </div>
      ) : null}

      {currentMembershipQuery.isError ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/[0.05] p-6 text-sm text-rose-300">
          Failed to load your current membership.
        </div>
      ) : null}

      {!currentMembershipQuery.isLoading && !currentMembershipQuery.isError && !hasMembership ? (
        <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">No current membership</p>
          <h2 className="mt-3 text-2xl font-bold text-white">You do not have a membership plan right now.</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">
            Buy a membership plan to unlock check-in access, and choose Gym + Coach if you want PT booking included.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/customer/membership"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-gym-500 px-5 py-2.5 text-sm font-semibold text-slate-950"
            >
              Browse membership plans
            </Link>
          </div>
        </section>
      ) : null}

      {!currentMembershipQuery.isLoading && !currentMembershipQuery.isError && hasMembership ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <MembershipCard title="Current membership" membership={membership} tone="emerald" />

            <section className="space-y-6">
              {queuedMembership && Object.keys(queuedMembership).length > 0 ? (
                <div className="space-y-4">
                  <MembershipCard title="Upcoming renew membership" membership={queuedMembership} tone="amber" />
                  {canSwitchQueuedMembershipNow ? (
                    <button
                      type="button"
                      onClick={() => setSwitchWarningOpen(true)}
                      disabled={switchNowMutation.isPending}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {switchNowMutation.isPending ? 'Switching now...' : 'Switch To This Membership Now'}
                    </button>
                  ) : null}
                </div>
              ) : (
                <article className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-white/5 p-3 text-gym-500">
                      <CalendarClock size={18} />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Upcoming renew membership</h3>
                      <p className="text-sm text-slate-500">No upcoming renewal is queued yet.</p>
                    </div>
                  </div>
                  <p className="mt-5 text-sm text-slate-400">
                    When you renew in advance, the next membership will appear here.
                  </p>
                </article>
              )}
            </section>
          </div>

          <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-white/5 p-3 text-gym-500">
                  <History size={18} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white">Expired membership history</h3>
                  <p className="text-sm text-slate-500">Use this history for renewal tracking and coupon eligibility.</p>
                </div>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                {expiredMembershipHistory.length} record{expiredMembershipHistory.length === 1 ? '' : 's'}
              </span>
            </div>

            {expiredMembershipHistory.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-slate-400">
                No expired memberships yet.
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-3">
                  {paginatedItems.map((item) => {
                    const plan = item?.plan ?? {}
                    return (
                      <div key={item.customerMembershipId} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-white">{plan?.name || 'Membership plan'}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {planTypeLabel[String(plan?.planType || '').toUpperCase()] || 'Membership'}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[String(item?.status || '').toUpperCase()] || 'bg-white/10 text-slate-300'}`}>
                            {item?.status || 'EXPIRED'}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Start date</p>
                            <p className="mt-2 text-sm font-semibold text-white">{formatDate(item?.startDate)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">End date</p>
                            <p className="mt-2 text-sm font-semibold text-white">{formatDate(item?.endDate)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Paid amount</p>
                            <p className="mt-2 text-sm font-semibold text-white">{formatMoney(item?.payment?.amount ?? plan?.price)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Benefits</p>
                            <p className="mt-2 text-sm font-semibold text-white">{planBenefits[String(plan?.planType || '').toUpperCase()]?.[0] || 'Membership access'}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  tone="dark"
                  className="mt-5"
                />
              </>
            )}
          </section>
        </div>
      ) : null}

      {switchWarningOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-amber-500/20 bg-[#12121a] shadow-2xl">
            <div className="border-b border-amber-500/20 bg-amber-500/10 p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/30">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-amber-400">Switch membership now?</h3>
            </div>
            <div className="p-6">
              <p className="text-center text-sm font-medium leading-7 text-slate-300">
                If you continue, your current membership will end today, the queued membership will start immediately,
                and the old membership will move to expired history.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSwitchWarningOpen(false)}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-slate-200 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => switchNowMutation.mutate({ customerMembershipId: queuedMembership?.customerMembershipId })}
                  disabled={switchNowMutation.isPending}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {switchNowMutation.isPending ? 'Switching...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </WorkspaceScaffold>
  )
}

export default CustomerCurrentMembershipPage
