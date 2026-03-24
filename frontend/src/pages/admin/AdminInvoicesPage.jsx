import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileText, Mail, Search } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav, receptionNav } from '../../config/navigation'
import { useSession } from '../../features/auth/useSession'
import { adminInvoiceApi } from '../../features/product/api/adminInvoiceApi'
import { formatCurrency, formatDateTime as formatDateTimeValue } from '../../utils/formatters'

const EMAIL_OPTIONS = [
  { value: 'all', label: 'All emails' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
]

const PICKUP_OPTIONS = [
  { value: 'all', label: 'All pickup states' },
  { value: 'awaiting', label: 'Awaiting pickup' },
  { value: 'picked', label: 'Picked up' },
]

const FILTER_CLASS = 'gc-select min-h-0 rounded-full bg-[rgba(18,18,26,0.92)] px-3 py-1.5 text-xs font-medium'

function AdminInvoicesPage() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const role = String(user?.role || '').toUpperCase()
  const isReceptionist = role === 'RECEPTIONIST'
  const pageTitle = isReceptionist ? 'Reception Invoice Center' : 'Admin Invoice Center'
  const pageSubtitle = isReceptionist
    ? 'Review customer pickup receipts, confirm front-desk handoff, and monitor email delivery status.'
    : 'Review paid product pickup receipts, billing snapshots, pickup handoff, and email delivery health.'
  const pageLinks = isReceptionist ? receptionNav : adminNav
  const queryPrefix = isReceptionist ? 'reception-invoices' : 'admin-invoices'

  const [search, setSearch] = useState('')
  const [emailFilter, setEmailFilter] = useState('all')
  const [pickupFilter, setPickupFilter] = useState('all')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)

  const invoicesQuery = useQuery({
    queryKey: [queryPrefix],
    queryFn: adminInvoiceApi.getInvoices,
  })

  const confirmPickupMutation = useMutation({
    mutationFn: adminInvoiceApi.confirmPickup,
    onSuccess: async (_, invoiceId) => {
      await queryClient.invalidateQueries({ queryKey: [queryPrefix] })
      await queryClient.invalidateQueries({ queryKey: [queryPrefix, 'detail', invoiceId] })
    },
  })

  const resendEmailMutation = useMutation({
    mutationFn: adminInvoiceApi.resendEmail,
    onSuccess: async (_, invoiceId) => {
      await queryClient.invalidateQueries({ queryKey: [queryPrefix] })
      await queryClient.invalidateQueries({ queryKey: [queryPrefix, 'detail', invoiceId] })
    },
  })

  const invoices = useMemo(() => invoicesQuery.data?.invoices ?? [], [invoicesQuery.data])
  const pickupTrackingAvailableFromList = invoicesQuery.data?.pickupTrackingAvailable
  const activeInvoiceId = useMemo(() => {
    if (invoices.length === 0) return null
    return invoices.some((invoice) => invoice.invoiceId === selectedInvoiceId)
      ? selectedInvoiceId
      : invoices[0].invoiceId
  }, [invoices, selectedInvoiceId])

  const invoiceDetailQuery = useQuery({
    queryKey: [queryPrefix, 'detail', activeInvoiceId],
    queryFn: () => adminInvoiceApi.getInvoiceDetail(activeInvoiceId),
    enabled: activeInvoiceId != null,
  })
  const pickupTrackingAvailable =
    pickupTrackingAvailableFromList ?? invoiceDetailQuery.data?.pickupTrackingAvailable ?? true

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const emailStatus = getEmailStatus(invoice)
      const pickupStatus = invoice.pickedUpAt ? 'picked' : 'awaiting'
      if (emailFilter !== 'all' && emailStatus !== emailFilter) return false
      if (pickupTrackingAvailable && pickupFilter !== 'all' && pickupStatus !== pickupFilter) return false
      if (!normalizedSearch) return true
      const haystack = [
        invoice.invoiceCode,
        invoice.customerAccountName,
        invoice.customerAccountEmail,
        invoice.recipientName,
        invoice.recipientEmail,
        invoice.orderId,
        invoice.paymentId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [emailFilter, invoices, pickupFilter, pickupTrackingAvailable, search])

  const selectedInvoice = invoiceDetailQuery.data?.invoice ?? null
  const selectedItems = invoiceDetailQuery.data?.items ?? []
  const sentCount = invoices.filter((invoice) => getEmailStatus(invoice) === 'sent').length
  const failedCount = invoices.filter((invoice) => getEmailStatus(invoice) === 'failed').length
  const pendingCount = invoices.filter((invoice) => getEmailStatus(invoice) === 'pending').length
  const pickedUpCount = invoices.filter((invoice) => Boolean(invoice.pickedUpAt)).length

  return (
    <WorkspaceScaffold title={pageTitle} subtitle={pageSubtitle} links={pageLinks}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="space-y-4 rounded-2xl border border-white/10 bg-[rgba(18,18,26,0.92)] p-4 shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Invoices</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                View every customer invoice generated after successful product payments.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Search size={14} className="text-slate-400" />
                <span className="sr-only">Search invoices</span>
                <input
                  type="search"
                  name="invoiceSearch"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Search invoice, customer, order…"
                  className="w-44 bg-transparent text-xs text-slate-100 placeholder:text-slate-400 outline-none sm:w-64"
                />
              </div>
              <select
                value={pickupFilter}
                onChange={(event) => setPickupFilter(event.target.value)}
                disabled={!pickupTrackingAvailable}
                name="pickupFilter"
                className={FILTER_CLASS}
              >
                {PICKUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={emailFilter}
                onChange={(event) => setEmailFilter(event.target.value)}
                name="emailFilter"
                className={FILTER_CLASS}
              >
                {EMAIL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </header>

          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="Total invoices" value={invoices.length} tone="slate" />
            <SummaryCard label="Emails sent" value={sentCount} tone="emerald" />
            <SummaryCard label="Picked up" value={pickedUpCount} tone="gym" />
            <SummaryCard label="Need attention" value={failedCount + pendingCount} tone="amber" />
          </div>

          {!pickupTrackingAvailable && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              Pickup tracking is unavailable on this database. Apply `docs/alter.txt` and restart the backend to enable
              front-desk pickup confirmation.
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-xs">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Invoice</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Customer</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Total</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Paid at</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Pickup</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[rgba(18,18,26,0.92)]">
                {invoicesQuery.isLoading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-center text-zinc-500" aria-live="polite">Loading invoices…</td>
                  </tr>
                )}
                {!invoicesQuery.isLoading && filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-center text-zinc-500">No invoices match the current filters.</td>
                  </tr>
                )}
                {filteredInvoices.map((invoice) => {
                  const isSelected = invoice.invoiceId === activeInvoiceId
                  return (
                    <tr key={invoice.invoiceId} className={isSelected ? 'bg-gym-500/10/60' : 'hover:bg-white/5'}>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => setSelectedInvoiceId(invoice.invoiceId)} className="w-full text-left">
                          <p className="text-xs font-semibold text-white">{invoice.invoiceCode}</p>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            Order #{invoice.orderId} � Payment #{invoice.paymentId}
                          </p>
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs font-medium text-white">{invoice.customerAccountName || invoice.recipientName || '-'}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">{invoice.recipientEmail || invoice.customerAccountEmail || '-'}</p>
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-white">{formatMoney(invoice.totalAmount, invoice.currency)}</td>
                      <td className="px-3 py-2 text-[11px] text-slate-400">{formatDateTime(invoice.paidAt)}</td>
                      <td className="px-3 py-2">
                        <PickupStatusBadge invoice={invoice} pickupTrackingAvailable={pickupTrackingAvailable} />
                      </td>
                      <td className="px-3 py-2">
                        <EmailStatusBadge invoice={invoice} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/10 bg-[rgba(18,18,26,0.92)] p-4 shadow-sm">
          <header className="flex items-center gap-2 border-b border-white/10 pb-3">
            <span className="rounded-xl bg-[rgba(18,18,26,0.92)] p-2 text-white">
              <FileText size={16} />
            </span>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Invoice detail</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Inspect billing snapshot, line items, pickup handoff, and email delivery result.
              </p>
            </div>
          </header>

          {!activeInvoiceId && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-zinc-500">
              Select an invoice from the table to view its detail.
            </div>
          )}

          {activeInvoiceId && invoiceDetailQuery.isLoading && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-500">
              Loading invoice detail...
            </div>
          )}

          {selectedInvoice && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailCard label="Invoice code" value={selectedInvoice.invoiceCode} />
                <DetailCard label="Paid at" value={formatDateTime(selectedInvoice.paidAt)} />
                <DetailCard label="Customer account" value={`${selectedInvoice.customerAccountName || '-'} (${selectedInvoice.customerAccountEmail || '-'})`} />
                <DetailCard label="Pickup receipt" value={`${selectedInvoice.recipientName || '-'} (${selectedInvoice.recipientEmail || '-'})`} />
                <DetailCard label="Phone" value={selectedInvoice.shippingPhone || '-'} />
                <DetailCard label="Payment method" value={selectedInvoice.paymentMethod || '-'} />
              </div>

              <div className="rounded-2xl border border-gym-500/20 bg-gym-500/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gym-300">Pickup instruction</h3>
                    <p className="mt-2 text-sm text-gym-100">
                      Customer presents Order #{selectedInvoice.orderId} at the gym front desk to collect the paid products.
                    </p>
                    <p className="mt-2 text-xs text-gym-300">
                      Status: {!pickupTrackingAvailable
                        ? 'Pickup tracking is unavailable on the current database schema.'
                        : selectedInvoice.pickedUpAt
                          ? `Picked up at ${formatDateTime(selectedInvoice.pickedUpAt)}`
                          : 'Waiting for front-desk handoff'}
                    </p>
                    {selectedInvoice.pickedUpByName ? (
                      <p className="mt-1 text-xs text-gym-300">Handled by: {selectedInvoice.pickedUpByName}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => confirmPickupMutation.mutate(selectedInvoice.invoiceId)}
                    disabled={!pickupTrackingAvailable || Boolean(selectedInvoice.pickedUpAt) || confirmPickupMutation.isPending}
                    className="gc-button-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:bg-white/10"
                  >
                    <CheckCircle2 size={14} />
                    {!pickupTrackingAvailable
                      ? 'Pickup tracking unavailable'
                      : selectedInvoice.pickedUpAt
                      ? 'Pickup confirmed'
                      : confirmPickupMutation.isPending
                        ? 'Confirming...'
                        : 'Confirm pickup'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgba(18,18,26,0.92)]">
                <div className="border-b border-white/10 px-4 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Items purchased</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedItems.map((item) => (
                    <div key={item.invoiceItemId} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{item.productName}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">Qty {item.quantity} � Unit {formatMoney(item.unitPrice, selectedInvoice.currency)}</p>
                      </div>
                      <p className="text-sm font-semibold text-white">{formatMoney(item.lineTotal, selectedInvoice.currency)}</p>
                    </div>
                  ))}
                  {selectedItems.length === 0 && (
                    <div className="px-4 py-3 text-sm text-zinc-500">No invoice items found.</div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Totals</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <strong>{formatMoney(selectedInvoice.subtotal, selectedInvoice.currency)}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Discount</span>
                      <strong>{formatMoney(selectedInvoice.discountAmount, selectedInvoice.currency)}</strong>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-2 text-white">
                      <span>Total paid</span>
                      <strong>{formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency)}</strong>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Email delivery</h3>
                  <div className="mt-3 flex items-start gap-3">
                    <span className="rounded-xl bg-[rgba(18,18,26,0.92)] p-2 text-slate-300 shadow-sm ring-1 ring-white/10">
                      <Mail size={16} />
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <EmailStatusBadge invoice={selectedInvoice} />
                      <p className="text-[11px] text-zinc-500">
                        Sent at: {selectedInvoice.emailSentAt ? formatDateTime(selectedInvoice.emailSentAt) : 'Not sent yet'}
                      </p>
                      {!selectedInvoice.emailSentAt && (
                        <button
                          type="button"
                          onClick={() => resendEmailMutation.mutate(selectedInvoice.invoiceId)}
                          disabled={resendEmailMutation.isPending}
                          className="gc-button-secondary inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400"
                        >
                          <Mail size={12} />
                          {resendEmailMutation.isPending ? 'Sending…' : selectedInvoice.emailSendError ? 'Retry email' : 'Send email'}
                        </button>
                      )}
                      {selectedInvoice.emailSendError && (
                        <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300 ring-1 ring-rose-100">
                          {selectedInvoice.emailSendError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

function SummaryCard({ label, value, tone }) {
  const toneClass = {
    slate: 'border-white/10 bg-white/5 text-white',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    gym: 'border-gym-500/20 bg-gym-500/10 text-gym-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  }[tone] || 'border-white/10 bg-white/5 text-white'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  )
}

function EmailStatusBadge({ invoice }) {
  const status = getEmailStatus(invoice)
  const label = status === 'sent' ? 'Email sent' : status === 'failed' ? 'Email failed' : 'Pending send'
  const className =
    status === 'sent'
      ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
      : status === 'failed'
        ? 'bg-rose-500/10 text-rose-300 ring-rose-100'
        : 'bg-amber-500/10 text-amber-300 ring-amber-100'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${className}`}>
      {label}
    </span>
  )
}

function PickupStatusBadge({ invoice, pickupTrackingAvailable }) {
  if (!pickupTrackingAvailable) {
    return (
      <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 bg-amber-500/10 text-amber-300 ring-amber-100">
        Not tracked
      </span>
    )
  }

  const pickedUp = Boolean(invoice?.pickedUpAt)
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${pickedUp ? 'bg-gym-500/10 text-gym-300 ring-gym-100' : 'bg-white/10 text-slate-400 ring-white/10'}`}>
      {pickedUp ? 'Picked up' : 'Awaiting pickup'}
    </span>
  )
}

function getEmailStatus(invoice) {
  if (invoice?.emailSentAt) return 'sent'
  if (invoice?.emailSendError) return 'failed'
  return 'pending'
}

function formatMoney(amount, currency = 'VND') {
  return formatCurrency(amount, currency)
}

function formatDateTime(value) {
  if (!value) return '-'
  return formatDateTimeValue(value)
}

export default AdminInvoicesPage






