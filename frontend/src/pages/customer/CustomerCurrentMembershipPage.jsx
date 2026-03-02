import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, CalendarClock, CreditCard, Dumbbell, QrCode } from 'lucide-react'
import { Link } from 'react-router-dom'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { membershipApi } from '../../features/membership/api/membershipApi'

const statusTone = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  SCHEDULED: 'bg-amber-100 text-amber-700',
  PENDING: 'bg-amber-100 text-amber-700',
  EXPIRED: 'bg-slate-200 text-slate-700',
}

const planTypeLabel = {
  DAY_PASS: 'Day Pass',
  GYM_ONLY: 'Gym Only',
  GYM_PLUS_COACH: 'Gym + Coach',
}

function formatCurrency(value) {
  const amount = Number(value || 0)
  return `${amount.toLocaleString('en-US')} VND`
}

function formatCouponBenefit(coupon, payment) {
  if (!coupon) return 'No coupon benefit recorded'
  const parts = []
  const originalAmount = Number(payment?.originalAmount || 0)
  const discountAmount = Number(payment?.discountAmount || 0)
  if (discountAmount > 0) {
    if (originalAmount > 0) {
      const discountPercent = Math.round((discountAmount / originalAmount) * 100)
      parts.push(`${formatCurrency(discountAmount)} off (${discountPercent}% saved)`)
    } else {
      parts.push(`${formatCurrency(discountAmount)} off`)
    }
  }
  const bonusMonths = Number(coupon?.bonusDurationMonths || 0)
  if (bonusMonths > 0) {
    parts.push(`+${bonusMonths} bonus month${bonusMonths > 1 ? 's' : ''}`)
  }
  return parts.join(' + ') || 'Coupon applied'
}

function buildHighlights(membership, validForCheckin) {
  const allowsCoachBooking = Boolean(membership?.plan?.allowsCoachBooking)
  return [
    {
      label: 'Front desk check-in',
      value: validForCheckin ? 'Ready' : 'Unavailable',
      tone: validForCheckin ? 'text-emerald-600' : 'text-slate-500',
    },
    {
      label: 'Coach booking',
      value: allowsCoachBooking ? 'Unlocked' : 'Not included',
      tone: allowsCoachBooking ? 'text-emerald-600' : 'text-slate-500',
    },
    {
      label: 'Plan type',
      value: planTypeLabel[String(membership?.plan?.planType || '').toUpperCase()] || 'Membership',
      tone: 'text-slate-900',
    },
  ]
}

function CustomerCurrentMembershipPage() {
  const currentMembershipQuery = useQuery({
    queryKey: ['membershipCurrent'],
    queryFn: membershipApi.getCurrentMembership,
  })

  const membership = currentMembershipQuery.data?.data?.membership ?? {}
  const validForCheckin = Boolean(currentMembershipQuery.data?.data?.validForCheckin)
  const invalidReason = currentMembershipQuery.data?.data?.reason || ''
  const hasMembership = Object.keys(membership).length > 0
  const plan = membership?.plan ?? {}
  const payment = membership?.payment ?? null
  const coupon = payment?.coupon ?? null
  const highlights = buildHighlights(membership, validForCheckin)
  const status = String(membership?.status || '').toUpperCase()
  const allowsCoachBooking = Boolean(plan?.allowsCoachBooking)

  return (
    <WorkspaceScaffold
      title="My Membership"
      subtitle="Review your current plan, what it unlocks, and the next action you can take."
      links={customerNav}
    >
      {currentMembershipQuery.isLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          Loading membership details...
        </div>
      )}

      {currentMembershipQuery.isError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 shadow-sm">
          Failed to load your current membership.
        </div>
      )}

      {!currentMembershipQuery.isLoading && !currentMembershipQuery.isError && !hasMembership && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">No active membership</p>
              <h2 className="text-2xl font-bold text-slate-900">You are not enrolled in a membership plan yet.</h2>
              <p className="max-w-2xl text-sm text-slate-600">
                Start with a gym plan or choose a Gym + Coach package if you want PT booking access.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/customer/membership"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-gym-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gym-700"
              >
                Browse membership plans
              </Link>
              <Link
                to="/customer/promotions"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                View promotions
              </Link>
            </div>
          </div>
        </section>
      )}

      {!currentMembershipQuery.isLoading && !currentMembershipQuery.isError && hasMembership && (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <section className="space-y-6">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[status] || 'bg-slate-200 text-slate-700'}`}>
                      {status || 'UNKNOWN'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {planTypeLabel[String(plan?.planType || '').toUpperCase()] || 'Membership'}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{plan?.name || 'Membership plan'}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {membership?.startDate || '-'} to {membership?.endDate || '-'}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {highlights.map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                        <p className={`mt-2 text-sm font-semibold ${item.tone}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="min-w-[220px] rounded-3xl border border-gym-100 bg-gym-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gym-700">Plan summary</p>
                  <div className="mt-3 space-y-3 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span>Price paid</span>
                      <strong className="text-slate-900">{formatCurrency(plan?.price)}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Duration</span>
                      <strong className="text-slate-900">{plan?.durationDays || 0} day(s)</strong>
                    </div>
                    {'daysRemaining' in membership ? (
                      <div className="flex items-center justify-between gap-3">
                        <span>Time remaining</span>
                        <strong className="text-emerald-700">{membership.daysRemaining} day(s)</strong>
                      </div>
                    ) : null}
                    {'daysUntilActive' in membership ? (
                      <div className="flex items-center justify-between gap-3">
                        <span>Starts in</span>
                        <strong className="text-amber-700">{membership.daysUntilActive} day(s)</strong>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className={`font-semibold ${validForCheckin ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {validForCheckin ? 'Your membership is valid for receptionist check-in.' : invalidReason || 'Your membership is not valid for check-in yet.'}
                </p>
              </div>
            </article>

            {payment ? (
              <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                    <CreditCard size={18} />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Payment Snapshot</h3>
                    <p className="text-sm text-slate-500">Latest recorded payment linked to this membership.</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Original amount</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(payment?.originalAmount ?? payment?.amount)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Payment status</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{payment?.status || '-'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Discount applied</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(payment?.discountAmount)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Amount</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(payment?.amount)}</p>
                  </div>
                </div>

                {coupon ? (
                  <div className="mt-5 rounded-2xl border border-gym-200 bg-gym-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gym-700">Applied coupon</p>
                        <p className="mt-2 text-lg font-bold text-slate-900">{coupon?.promoCode || 'Membership coupon'}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gym-700 shadow-sm">
                        {coupon?.applyTarget || 'MEMBERSHIP'}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-800">{formatCouponBenefit(coupon, payment)}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      This membership period and final payment reflect the coupon benefit that was applied at checkout.
                    </p>
                  </div>
                ) : null}
              </article>
            ) : null}
          </section>

          <aside className="space-y-6">
            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
              <p className="mt-1 text-sm text-slate-500">Jump directly to the next task instead of browsing the full workspace.</p>

              <div className="mt-5 space-y-3">
                <Link
                  to="/customer/membership"
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-gym-200 hover:bg-gym-50"
                >
                  <span className="rounded-xl bg-white p-2 text-gym-700 shadow-sm">
                    <CalendarClock size={16} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Manage plans</span>
                    <span className="mt-1 block text-xs text-slate-500">Renew, upgrade, or browse other membership options.</span>
                  </span>
                </Link>

                <Link
                  to="/customer/coach-booking"
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                    allowsCoachBooking
                      ? 'border-slate-200 bg-slate-50 hover:border-gym-200 hover:bg-gym-50'
                      : 'border-slate-200 bg-slate-100 opacity-70'
                  }`}
                >
                  <span className="rounded-xl bg-white p-2 text-gym-700 shadow-sm">
                    <Dumbbell size={16} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Coach booking</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {allowsCoachBooking
                        ? 'Your current plan includes PT coach booking access.'
                        : 'Upgrade to Gym + Coach to unlock PT booking.'}
                    </span>
                  </span>
                </Link>

                <Link
                  to="/customer/checkin-health"
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-gym-200 hover:bg-gym-50"
                >
                  <span className="rounded-xl bg-white p-2 text-gym-700 shadow-sm">
                    <QrCode size={16} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">Check-in and health</span>
                    <span className="mt-1 block text-xs text-slate-500">Open your QR code and review body metrics in one place.</span>
                  </span>
                </Link>
              </div>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <BadgeCheck size={18} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Membership Guidance</h3>
                  <p className="text-sm text-slate-500">What to expect with your current plan.</p>
                </div>
              </div>

              <ul className="mt-5 space-y-3 text-sm text-slate-600">
                <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  Receptionist check-in uses this active membership state and date range.
                </li>
                <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  PT booking requires an active plan that includes coach access for the requested period.
                </li>
                <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  Renewals and upgrades are handled from the membership plans page through PayOS.
                </li>
              </ul>
            </article>
          </aside>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CustomerCurrentMembershipPage
