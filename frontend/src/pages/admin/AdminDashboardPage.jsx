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
import EmptyState from '../../components/ui/EmptyState'
import MetricCard from '../../components/ui/MetricCard'
import PageSection from '../../components/ui/PageSection'
import StatusBadge from '../../components/ui/StatusBadge'
import { adminNav } from '../../config/navigation'
import { adminApi } from '../../features/admin/api/adminApi'
import { formatCurrency, formatDateTime, formatInteger } from '../../utils/formatters'

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
      value: formatInteger(summary.customerMetrics?.totalCustomers),
      hint: `${formatInteger(summary.customerMetrics?.activeCustomers)} currently have active memberships`,
      icon: <Users size={18} />,
    },
    {
      label: 'Staff accounts',
      value: formatInteger(totalStaff),
      hint: `${formatInteger(summary.staffMetrics?.totalAdmins)} admin / ${formatInteger(summary.staffMetrics?.totalReceptionists)} reception / ${formatInteger(summary.staffMetrics?.totalCoaches)} coach`,
      icon: <UserCog size={18} />,
    },
    {
      label: 'Pending PT requests',
      value: formatInteger(summary.ptMetrics?.pendingPtRequests),
      hint: `${formatInteger(summary.ptMetrics?.sessionsScheduledToday)} PT sessions scheduled today`,
      icon: <Dumbbell size={18} />,
    },
    {
      label: 'Awaiting pickup',
      value: formatInteger(summary.commerceMetrics?.awaitingPickupOrders),
      hint: pickupTrackingAvailable
        ? `${formatInteger(summary.commerceMetrics?.pickedUpToday)} picked up today`
        : 'Pickup tracking is unavailable on the current DB schema.',
      icon: <PackageCheck size={18} />,
    },
    {
      label: 'Live promotions',
      value: formatInteger(summary.promotionMetrics?.activePromotionPosts),
      hint: `${formatInteger(summary.promotionMetrics?.activeCoupons)} claimable coupons are live`,
      icon: <BadgePercent size={18} />,
    },
    {
      label: 'Locked accounts',
      value: formatInteger(summary.staffMetrics?.lockedStaffAccounts),
      hint: 'Accounts that currently need admin review.',
      icon: <UserCog size={18} />,
    },
  ]

  return (
    <WorkspaceScaffold
      title="Admin Dashboard"
      subtitle="Operational overview for staff, PT demand, promotions, product invoices, and pickup desk activity."
      links={adminNav}
      headerMeta={(
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={dashboardQuery.error ? 'danger' : 'success'}>
            {dashboardQuery.error ? 'Data Error' : 'Realtime Snapshot'}
          </StatusBadge>
          {!pickupTrackingAvailable ? <StatusBadge tone="warning">Pickup tracking incomplete</StatusBadge> : null}
        </div>
      )}
      actions={(
        <Link to="/admin/reports" className="gc-button-primary">
          Open revenue reports
          <ArrowRight size={16} />
        </Link>
      )}
    >
      <div className="space-y-6">
        <PageSection
          kicker="Overview"
          title="Operations snapshot"
          description="Revenue trends and date-based financial analysis stay in Reports. This dashboard is for current action and triage."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/admin/reports" className="gc-button-primary">
              Open revenue reports
              <ArrowRight size={16} />
            </Link>
          </div>

          {dashboardQuery.error ? (
            <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm leading-7 text-rose-100">
              {dashboardQuery.error?.response?.data?.message || 'Dashboard data could not be loaded. Retry once the backend is available.'}
            </div>
          ) : null}

          {!pickupTrackingAvailable && !dashboardQuery.error ? (
            <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm leading-7 text-amber-100">
              <p className="font-semibold text-white">Pickup tracking is unavailable</p>
              <p>Apply the missing invoice pickup columns from `docs/alter.txt` if you want live pickup counts and pickup confirmation inside invoices.</p>
            </div>
          ) : null}
        </PageSection>

        {dashboardQuery.isLoading && !dashboardQuery.data ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="gc-card-compact h-36 animate-pulse" />
            ))}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <ActivityList
            title="Latest payments"
            icon={<ShoppingBag size={18} className="text-gym-300" />}
            items={summary.recentPayments}
            emptyText="No successful payments have been recorded yet."
            renderItem={(payment) => (
              <>
                <div>
                  <p className="text-sm font-bold text-white">{payment.customerName || 'Unknown customer'}</p>
                  <p className="mt-1 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-slate-500">{payment.paymentTarget}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{formatCurrency(payment.amount)}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(payment.paidAt)}</p>
                </div>
              </>
            )}
          />

          <ActivityList
            title="Pickup desk queue"
            icon={<PackageCheck size={18} className="text-gym-300" />}
            items={summary.awaitingPickupOrders}
            emptyText={pickupTrackingAvailable
              ? 'No paid product orders are waiting for pickup.'
              : 'Pickup tracking unavailable on current DB schema.'}
            renderItem={(invoice) => (
              <>
                <div>
                  <p className="text-sm font-bold text-white">{invoice.invoiceCode}</p>
                  <p className="mt-1 text-xs text-slate-500">Order #{invoice.orderId}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{formatCurrency(invoice.totalAmount)}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(invoice.paidAt)}</p>
                </div>
              </>
            )}
          />

          <ActivityList
            title="PT requests waiting"
            icon={<Dumbbell size={18} className="text-gym-300" />}
            items={summary.pendingPtRequests}
            emptyText="No pending PT requests right now."
            renderItem={(request) => (
              <>
                <div>
                  <p className="text-sm font-bold text-white">{request.customerName}</p>
                  <p className="mt-1 text-xs text-slate-500">{request.coachName || 'Unassigned coach'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">{formatDateTime(request.createdAt)}</p>
                  <p className="mt-1 text-xs text-slate-500">Request created</p>
                </div>
              </>
            )}
          />
        </section>

        <PageSection
          kicker="Navigation"
          title="Quick access"
          description="Jump straight into the admin surfaces that usually need action first."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="gc-card-compact group flex items-center justify-between gap-3 hover:border-white/20 hover:bg-white/[0.05]"
              >
                <span className="font-display text-xl font-bold text-white">{link.label}</span>
                <ArrowRight size={18} className="text-slate-500 transition-[transform,color] duration-200 group-hover:translate-x-1 group-hover:text-white" />
              </Link>
            ))}
          </div>
        </PageSection>
      </div>
    </WorkspaceScaffold>
  )
}

function ActivityList({ title, icon, items = [], emptyText, renderItem }) {
  return (
    <PageSection contentClassName="space-y-3">
      <div className="flex items-center gap-3 pb-1">
        <span className="gc-metric-icon">{icon}</span>
        <h3 className="font-display text-xl font-bold text-white">{title}</h3>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No items here yet" description={emptyText} />
      ) : (
        items.map((item, index) => (
          <div key={item.invoiceId || item.paymentId || item.ptRequestId || index} className="gc-panel-soft flex items-start justify-between gap-4 px-4 py-4">
            {renderItem(item)}
          </div>
        ))
      )}
    </PageSection>
  )
}

export default AdminDashboardPage


