import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BadgePercent,
  Dumbbell,
  PackageCheck,
  ShoppingBag,
  UserCog,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { adminApi } from '../../features/admin/api/adminApi'

const QUICK_LINKS = [
  { to: '/admin/users', label: 'Manage staff' },
  { to: '/admin/memberships', label: 'Membership plans' },
  { to: '/admin/coach-management', label: 'Coach management' },
  { to: '/admin/invoices', label: 'Invoices' },
  { to: '/admin/promotions', label: 'Promotions' },
  { to: '/admin/reports', label: 'Revenue reports' },
]

function AdminDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ['admin-dashboard-summary'],
    queryFn: adminApi.getDashboardSummary,
  })

  const summary = dashboardQuery.data?.data ?? {}
  const pickupTrackingAvailable = summary.commerceMetrics?.pickupTrackingAvailable ?? true
  const totalStaff = (summary.staffMetrics?.totalAdmins ?? 0)
    + (summary.staffMetrics?.totalReceptionists ?? 0)
    + (summary.staffMetrics?.totalCoaches ?? 0)

  const cards = [
    {
      label: 'Total customers',
      value: summary.customerMetrics?.totalCustomers,
      hint: `${summary.customerMetrics?.activeCustomers ?? 0} currently have active memberships`,
      icon: <Users size={18} />,
      tone: 'bg-gym-50 text-gym-700',
    },
    {
      label: 'Staff accounts',
      value: totalStaff,
      hint: `${summary.staffMetrics?.totalAdmins ?? 0} admins / ${summary.staffMetrics?.totalReceptionists ?? 0} reception / ${summary.staffMetrics?.totalCoaches ?? 0} coaches`,
      icon: <UserCog size={18} />,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Pending PT requests',
      value: summary.ptMetrics?.pendingPtRequests,
      hint: `${summary.ptMetrics?.sessionsScheduledToday ?? 0} PT sessions scheduled today`,
      icon: <Dumbbell size={18} />,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Orders awaiting pickup',
      value: summary.commerceMetrics?.awaitingPickupOrders,
      hint: pickupTrackingAvailable
        ? `${summary.commerceMetrics?.pickedUpToday ?? 0} picked up today`
        : 'Pickup tracking unavailable on current DB schema',
      icon: <PackageCheck size={18} />,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Live promotions',
      value: summary.promotionMetrics?.activePromotionPosts,
      hint: `${summary.promotionMetrics?.activeCoupons ?? 0} claimable coupons are live`,
      icon: <BadgePercent size={18} />,
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Locked staff accounts',
      value: summary.staffMetrics?.lockedStaffAccounts,
      hint: 'Accounts that currently need admin review',
      icon: <UserCog size={18} />,
      tone: 'bg-rose-50 text-rose-700',
    },
  ]

  return (
    <WorkspaceScaffold
      title="Admin Dashboard"
      subtitle="Operational overview for staff, PT demand, promotions, and pickup desk activity."
      links={adminNav}
    >
      <div className="space-y-6">
        <section className="gc-card-compact space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">Overview</p>
          <h2 className="text-2xl font-bold text-slate-900">Operations snapshot</h2>
          <p className="max-w-3xl text-sm text-slate-600">
            Use this page for the current operational state. Revenue analysis and date-based money trends now live in
            Reports.
          </p>
          <div className="pt-2">
            <Link
              to="/admin/reports"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-gym-200 hover:text-gym-700"
            >
              Open revenue reports <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {dashboardQuery.error ? (
          <section className="gc-card-compact border border-rose-200 bg-rose-50/80">
            <h3 className="text-lg font-bold text-rose-900">Dashboard data could not be loaded</h3>
            <p className="mt-2 text-sm text-rose-700">
              {dashboardQuery.error?.response?.data?.message || 'Refresh the page or retry once the backend is available.'}
            </p>
          </section>
        ) : null}

        {!pickupTrackingAvailable && !dashboardQuery.error ? (
          <section className="gc-card-compact border border-amber-200 bg-amber-50/80">
            <h3 className="text-base font-bold text-amber-900">Pickup tracking is unavailable</h3>
            <p className="mt-2 text-sm text-amber-800">
              Apply the missing invoice pickup columns from `docs/alter.txt` if you want live pickup counts and pickup
              confirmation on invoices.
            </p>
          </section>
        ) : null}

        {dashboardQuery.isLoading && !dashboardQuery.data ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-[28px] border border-slate-100 bg-white" />
            ))}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <ListCard
            title="Latest payments"
            icon={<ShoppingBag size={18} className="text-gym-600" />}
            items={summary.recentPayments}
            emptyText="No successful payments recorded yet."
            renderItem={(payment) => (
              <>
                <div>
                  <p className="text-sm font-bold text-slate-900">{payment.customerName || 'Unknown customer'}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{payment.paymentTarget}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(payment.amount)}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(payment.paidAt)}</p>
                </div>
              </>
            )}
          />

          <ListCard
            title="Pickup desk queue"
            icon={<PackageCheck size={18} className="text-emerald-600" />}
            items={summary.awaitingPickupOrders}
            emptyText={pickupTrackingAvailable
              ? 'No paid product orders are waiting for pickup.'
              : 'Pickup tracking is unavailable until the invoice pickup columns are applied.'}
            renderItem={(invoice) => (
              <>
                <div>
                  <p className="text-sm font-bold text-slate-900">{invoice.invoiceCode}</p>
                  <p className="mt-1 text-xs text-slate-500">Order #{invoice.orderId}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(invoice.totalAmount)}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(invoice.paidAt)}</p>
                </div>
              </>
            )}
          />

          <ListCard
            title="PT requests waiting"
            icon={<Dumbbell size={18} className="text-amber-600" />}
            items={summary.pendingPtRequests}
            emptyText="No pending PT requests right now."
            renderItem={(request) => (
              <>
                <div>
                  <p className="text-sm font-bold text-slate-900">{request.customerName}</p>
                  <p className="mt-1 text-xs text-slate-500">{request.coachName || 'Unassigned coach'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatDateTime(request.createdAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">Request created</p>
                </div>
              </>
            )}
          />
        </section>

        <section className="gc-card-compact">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Navigation</p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">Quick access</h3>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="group rounded-[28px] border border-slate-100 bg-slate-50/60 p-5 transition hover:border-gym-200 hover:bg-gym-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-bold text-slate-900">{link.label}</span>
                  <ArrowRight size={18} className="text-slate-400 transition group-hover:text-gym-700" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

function MetricCard({ label, value, hint, icon, tone }) {
  return (
    <article className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{label}</p>
          <h3 className="mt-3 text-3xl font-black text-slate-900">{value ?? 0}</h3>
        </div>
        <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
          {icon}
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-500">{hint}</p>
    </article>
  )
}

function ListCard({ title, icon, items = [], emptyText, renderItem }) {
  return (
    <section className="gc-card-compact">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
          {icon}
        </span>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      </div>

      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4 text-sm text-slate-500">
            {emptyText}
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.invoiceId || item.paymentId || item.ptRequestId || index}
              className="flex items-start justify-between gap-4 rounded-3xl border border-slate-100 bg-white p-4"
            >
              {renderItem(item)}
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString()} VND`
}

function formatDateTime(value) {
  if (!value) return '--'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

export default AdminDashboardPage
