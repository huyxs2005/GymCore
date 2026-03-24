import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bell, Clock3, LifeBuoy, MailWarning, PackageSearch, Search, ShieldAlert, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { adminSupportApi } from '../../features/admin/api/adminSupportApi'
import { formatDateTime } from '../../utils/formatters'

function SearchResultCard({ item, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.customerId)}
      className={`w-full rounded-3xl border p-4 text-left transition ${
        active ? 'border-gym-400 bg-gym-500/10' : 'border-white/10 bg-[rgba(18,18,26,0.92)] hover:border-gym-500/30 hover:bg-white/5'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-white break-words">{item.fullName}</p>
          <p className="mt-1 text-sm text-zinc-500 break-words">{item.email || item.phone || 'No contact'}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${item.locked ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {item.locked ? 'Locked' : 'Open'}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
        <div>
          <span className="font-semibold text-white">Membership:</span> {item.planName || item.membershipStatus || 'None'}
        </div>
        <div>
          <span className="font-semibold text-white">Next PT:</span> {item.nextSessionDate || 'None'}
        </div>
        <div>
          <span className="font-semibold text-white">Replacement:</span> {item.replacementStatus || 'None'}
        </div>
        <div>
          <span className="font-semibold text-white">Last notification:</span> {item.lastNotificationAt ? formatDateTime(item.lastNotificationAt) : 'None'}
        </div>
      </div>
    </button>
  )
}

function InfoCard({ icon, title, subtitle, children }) {
  const IconComponent = icon

  return (
    <article className="rounded-3xl border border-white/10 bg-[rgba(18,18,26,0.92)] p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-2xl bg-gym-500/10 p-3 text-gym-300">
          <IconComponent className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-white break-words">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-zinc-500 break-words">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  )
}

function LinkPills({ links = {}, keys = [] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {keys
        .filter((key) => links[key])
        .map((key) => (
          <Link
            key={key}
            to={links[key]}
            className="rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0)),rgba(26,26,36,0.72)] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/15 hover:bg-white/[0.07]"
          >
            {key}
          </Link>
        ))}
    </div>
  )
}

function AdminSupportConsolePage() {
  const [search, setSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)

  const searchQuery = useQuery({
    queryKey: ['admin-support-search', search],
    queryFn: () => adminSupportApi.searchCustomers(search),
  })

  const searchItems = useMemo(() => searchQuery.data?.items ?? [], [searchQuery.data])
  const resolvedSelectedCustomerId = useMemo(() => {
    if (!searchItems.length) return null
    return searchItems.some((item) => item.customerId === selectedCustomerId)
      ? selectedCustomerId
      : searchItems[0].customerId
  }, [searchItems, selectedCustomerId])
  const detailQuery = useQuery({
    queryKey: ['admin-support-detail', resolvedSelectedCustomerId],
    queryFn: () => adminSupportApi.getCustomerDetail(resolvedSelectedCustomerId),
    enabled: Boolean(resolvedSelectedCustomerId),
  })
  const detail = detailQuery.data ?? {}
  const account = detail.account ?? {}
  const memberships = detail.memberships ?? {}
  const pt = detail.pt ?? {}
  const orders = detail.orders ?? {}
  const pickup = detail.pickup ?? {}
  const invoiceEmail = detail.invoiceEmail ?? {}
  const notifications = detail.notifications ?? {}
  const alerts = detail.alerts ?? []
  const links = detail.links ?? {}

  return (
    <WorkspaceScaffold
      title="Admin Support Console"
      subtitle="Search a customer once, then review account, membership, PT, commerce, pickup, invoice email, and notification context in one place."
      links={adminNav}
    >
      <section className="space-y-6">
        <header className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.16),_transparent_32%),linear-gradient(135deg,_rgba(18,18,26,0.98),_rgba(10,10,15,0.92))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="gc-section-kicker">Customer lifecycle view</h2>
              <h3 className="mt-3 text-3xl font-bold tracking-tight text-white">Read the whole customer state before taking action</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">Read-first support console for triage and fast deep-links into existing admin and reception screens.</p>
          </div>
            <div className="space-y-3">
              <div className="rounded-full border border-gym-500/20 bg-gym-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gym-200">
                Support read-only
              </div>
              <div className="rounded-3xl border border-white/70 bg-[rgba(18,18,26,0.85)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Support goal</p>
                <p className="mt-2 text-sm font-semibold text-white">Diagnose quickly, then deep-link to the right workspace</p>
              </div>
            </div>
          </div>
        </header>

        <section className="gc-card-compact space-y-5">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0)),rgba(26,26,36,0.72)] px-4 py-3 focus-within:gc-focus-ring">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              name="support-search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search by customer name, email, or phone…"
              className="w-full bg-transparent text-sm text-white focus-visible:outline-none placeholder:text-slate-400"
            />
          </label>

        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-300">Matched customers</p>
              <span className="text-xs text-zinc-500">{searchItems.length}</span>
            </div>
            {searchQuery.isLoading ? <p className="text-sm text-zinc-500" aria-live="polite">Searching customers…</p> : null}
            {searchQuery.isError ? <p className="text-sm text-rose-400">Could not search customers.</p> : null}
            <div className="space-y-3">
              {searchItems.map((item) => (
                <SearchResultCard
                  key={item.customerId}
                  item={item}
                  active={resolvedSelectedCustomerId === item.customerId}
                  onSelect={setSelectedCustomerId}
                />
              ))}
            </div>
          </aside>

          <div className="space-y-5">
            {detailQuery.isLoading ? <p className="text-sm text-zinc-500" aria-live="polite">Loading support detail…</p> : null}
            {detailQuery.isError ? <p className="text-sm text-rose-400">Could not load support detail.</p> : null}

            {resolvedSelectedCustomerId && !detailQuery.isLoading ? (
              <>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <InfoCard icon={UserRound} title={account.fullName || 'Customer'} subtitle={account.email || account.phone || 'No contact on file'}>
                    <p className="text-sm text-slate-400">Account state: <span className="font-semibold text-white">{account.locked ? 'Locked' : account.active === false ? 'Inactive' : 'Active'}</span></p>
                    <p className="mt-1 text-xs text-zinc-500">Created: {formatDateTime(account.createdAt)}</p>
                  </InfoCard>

                  <InfoCard icon={Clock3} title="Current membership" subtitle={memberships.current?.planName || 'No membership'}>
                    <p className="text-sm text-slate-400">Status: <span className="font-semibold text-white">{memberships.current?.status || 'NONE'}</span></p>
                    <p className="mt-1 text-xs text-zinc-500">Ends: {memberships.current?.endDate || '-'}</p>
                  </InfoCard>

                  <InfoCard icon={LifeBuoy} title="PT context" subtitle={pt.currentPhase?.coachName || 'No active PT phase'}>
                    <p className="text-sm text-slate-400">Phase: <span className="font-semibold text-white">{pt.currentPhase?.status || 'NONE'}</span></p>
                    <p className="mt-1 text-xs text-zinc-500">Upcoming sessions: {(pt.upcomingSessions || []).length}</p>
                  </InfoCard>

                  <InfoCard icon={PackageSearch} title="Commerce & pickup" subtitle={`${pickup.count || 0} awaiting pickup`}>
                    <p className="text-sm text-slate-400">Recent orders: <span className="font-semibold text-white">{orders.count || 0}</span></p>
                    <p className="mt-1 text-xs text-zinc-500">Invoice email failures: {invoiceEmail.failureCount || 0}</p>
                  </InfoCard>
                </section>

                {alerts.length ? (
                  <section className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-300" />
                      <h3 className="text-base font-bold text-white">Support alerts</h3>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {alerts.map((alert) => (
                        <div key={alert.id} className="rounded-2xl border border-amber-500/20 bg-[rgba(18,18,26,0.92)] px-4 py-3">
                          <p className="text-sm font-semibold text-white">{alert.message}</p>
                          <Link to={alert.route} className="mt-2 inline-block text-xs font-semibold text-amber-300 hover:text-amber-200">
                            Open related workspace
                          </Link>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="grid gap-4 xl:grid-cols-2">
                  <InfoCard icon={ShieldAlert} title="Account & memberships" subtitle="Account state, lock reason, and latest membership rows">
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                        <p>Email: <span className="font-semibold text-white">{account.email || '-'}</span></p>
                        <p className="mt-1">Phone: <span className="font-semibold text-white">{account.phone || '-'}</span></p>
                        <p className="mt-1">Lock reason: <span className="font-semibold text-white">{account.lockReason || 'None'}</span></p>
                      </div>
                      {(memberships.history || []).map((item) => (
                        <div key={item.customerMembershipId} className="rounded-2xl border border-white/10 bg-[rgba(18,18,26,0.92)] p-4 text-sm text-slate-400">
                          <p className="font-semibold text-white">{item.planName}</p>
                          <p className="mt-1">Status: {item.status}</p>
                          <p className="mt-1">Window: {item.startDate || '-'} to {item.endDate || '-'}</p>
                        </div>
                      ))}
                      <LinkPills links={links} keys={['users', 'memberships']} />
                    </div>
                  </InfoCard>

                  <InfoCard icon={LifeBuoy} title="PT lifecycle" subtitle="Requests, upcoming sessions, and replacement context">
                    <div className="space-y-3">
                      {(pt.requests || []).map((item) => (
                        <div key={`request-${item.ptRequestId}`} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                          <p className="font-semibold text-white">Request #{item.ptRequestId}</p>
                          <p className="mt-1">Status: {item.status}</p>
                          <p className="mt-1">Coach: {item.coachName || 'Unassigned'}</p>
                          <p className="mt-1">Window: {item.startDate || '-'} to {item.endDate || '-'}</p>
                        </div>
                      ))}
                      {(pt.upcomingSessions || []).map((item) => (
                        <div key={`session-${item.ptSessionId}`} className="rounded-2xl border border-white/10 bg-[rgba(18,18,26,0.92)] p-4 text-sm text-slate-400">
                          <p className="font-semibold text-white">{item.sessionDate || '-'} with {item.coachName || 'Coach'}</p>
                          <p className="mt-1">Slot {item.slotIndex || item.timeSlotId} ({String(item.startTime || '').slice(0, 5)}-{String(item.endTime || '').slice(0, 5)})</p>
                          <p className="mt-1">Replacement: {item.replacementStatus || 'None'}{item.replacementCoachName ? ` -> ${item.replacementCoachName}` : ''}</p>
                        </div>
                      ))}
                      <LinkPills links={links} keys={['coachManagement']} />
                    </div>
                  </InfoCard>
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                  <InfoCard icon={PackageSearch} title="Orders & pickup" subtitle="Recent orders and awaiting pickup">
                    <div className="space-y-3">
                      {(orders.items || []).map((item) => (
                        <div key={`order-${item.orderId}`} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                          <p className="font-semibold text-white">Order #{item.orderId}</p>
                          <p className="mt-1">Status: {item.status || 'Unknown'}</p>
                          <p className="mt-1">Invoice: {item.invoiceCode || 'Not issued'}</p>
                          <p className="mt-1">Paid: {formatDateTime(item.paidAt)}</p>
                        </div>
                      ))}
                      <LinkPills links={links} keys={['invoices', 'pickup']} />
                    </div>
                  </InfoCard>

                  <InfoCard icon={MailWarning} title="Invoice email" subtitle="Delivery tracking for product receipts">
                    <div className="space-y-3">
                      {(invoiceEmail.items || []).map((item) => (
                        <div key={`invoice-${item.invoiceId}`} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                          <p className="font-semibold text-white">{item.invoiceCode || `Invoice #${item.invoiceId}`}</p>
                          <p className="mt-1">Recipient: {item.recipientEmail || 'N/A'}</p>
                          <p className="mt-1">Sent: {formatDateTime(item.emailSentAt)}</p>
                          <p className="mt-1">Error: {item.emailSendError || 'None'}</p>
                        </div>
                      ))}
                      <LinkPills links={links} keys={['invoices']} />
                    </div>
                  </InfoCard>

                  <InfoCard icon={Bell} title="Notifications" subtitle="Latest customer-facing notifications">
                    <div className="space-y-3">
                      {(notifications.items || []).map((item) => (
                        <div key={`notification-${item.notificationId}`} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                          <p className="font-semibold text-white">{item.title}</p>
                          <p className="mt-1 line-clamp-3">{item.message}</p>
                          <p className="mt-1 text-xs text-zinc-500">{formatDateTime(item.createdAt)} | {item.read ? 'Read' : 'Unread'}</p>
                        </div>
                      ))}
                      <LinkPills links={links} keys={['notifications']} />
                    </div>
                  </InfoCard>
                </section>
              </>
            ) : null}
          </div>
        </div>
        </section>
      </section>
    </WorkspaceScaffold>
  )
}

export default AdminSupportConsolePage





