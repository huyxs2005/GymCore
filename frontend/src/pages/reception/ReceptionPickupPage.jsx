import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Search, Ticket } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { receptionNav } from '../../config/navigation'
import { adminInvoiceApi } from '../../features/product/api/adminInvoiceApi'
import { formatCurrency, formatDateTime } from '../../utils/formatters'

const PICKUP_FILTERS = [
  { value: 'all', label: 'All pickup states' },
  { value: 'awaiting', label: 'Awaiting pickup' },
  { value: 'picked', label: 'Picked up' },
]

const EMAIL_FILTERS = [
  { value: 'all', label: 'All email states' },
  { value: 'sent', label: 'Email sent' },
  { value: 'failed', label: 'Email failed' },
  { value: 'pending', label: 'Email pending' },
]

function ReceptionPickupPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [pickupFilter, setPickupFilter] = useState('awaiting')
  const [emailFilter, setEmailFilter] = useState('all')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)

  const invoicesQuery = useQuery({
    queryKey: ['reception-pickup-invoices'],
    queryFn: adminInvoiceApi.getInvoices,
  })

  const invoices = useMemo(() => invoicesQuery.data?.invoices ?? [], [invoicesQuery.data])

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const pickupState = invoice.pickedUpAt ? 'picked' : 'awaiting'
      const emailState = getEmailState(invoice)
      if (pickupFilter !== 'all' && pickupFilter !== pickupState) return false
      if (emailFilter !== 'all' && emailFilter !== emailState) return false
      if (!normalizedSearch) return true
      const haystack = [
        invoice.invoiceCode,
        invoice.orderId,
        invoice.paymentId,
        invoice.customerAccountName,
        invoice.customerAccountEmail,
        invoice.recipientName,
        invoice.recipientEmail,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [emailFilter, invoices, pickupFilter, search])

  const activeInvoiceId = useMemo(() => {
    if (filteredInvoices.length === 0) return null
    return filteredInvoices.some((invoice) => invoice.invoiceId === selectedInvoiceId)
      ? selectedInvoiceId
      : filteredInvoices[0].invoiceId
  }, [filteredInvoices, selectedInvoiceId])

  const invoiceDetailQuery = useQuery({
    queryKey: ['reception-pickup-invoice-detail', activeInvoiceId],
    queryFn: () => adminInvoiceApi.getInvoiceDetail(activeInvoiceId),
    enabled: activeInvoiceId != null,
  })

  const confirmPickupMutation = useMutation({
    mutationFn: adminInvoiceApi.confirmPickup,
    onSuccess: async (_, invoiceId) => {
      await queryClient.invalidateQueries({ queryKey: ['reception-pickup-invoices'] })
      await queryClient.invalidateQueries({ queryKey: ['reception-pickup-invoice-detail', invoiceId] })
    },
  })

  const selectedInvoice = invoiceDetailQuery.data?.invoice ?? null
  const selectedItems = invoiceDetailQuery.data?.items ?? []
  const awaitingCount = invoices.filter((invoice) => !invoice.pickedUpAt).length
  const pickedCount = invoices.filter((invoice) => Boolean(invoice.pickedUpAt)).length

  return (
    <WorkspaceScaffold
      title="Reception Pickup Desk"
      subtitle="Search paid receipts by order ID, invoice code, or customer identity and confirm the front-desk handoff quickly."
      links={receptionNav}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)]">
        <section className="gc-card-compact space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h2 className="gc-section-kicker">Pickup Queue</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Front-desk staff can locate paid supplement receipts and confirm product collection.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <SummaryPill label="Awaiting" value={awaitingCount} tone="amber" />
              <SummaryPill label="Picked up" value={pickedCount} tone="gym" />
            </div>
          </header>

          <div className="flex flex-wrap gap-2">
            <label className="flex min-w-[260px] flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 transition-[border-color,background-color,box-shadow] focus-within:border-gym-500/40 focus-within:bg-white/10 focus-within:ring-2 focus-within:ring-gym-500/20">
              <Search size={15} className="text-slate-400" />
              <span className="sr-only">Search pickup receipts</span>
              <input
                type="search"
                name="receptionPickupSearch"
                autoComplete="off"
                spellCheck={false}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search order ID, invoice code, customer email…"
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-400"
              />
            </label>
            <select
              name="pickupStateFilter"
              value={pickupFilter}
              onChange={(event) => setPickupFilter(event.target.value)}
              className="gc-select"
            >
              {PICKUP_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              name="emailStateFilter"
              value={emailFilter}
              onChange={(event) => setEmailFilter(event.target.value)}
              className="gc-select"
            >
              {EMAIL_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {invoicesQuery.isLoading ? <p aria-live="polite" className="text-sm text-zinc-500">Loading pickup queue…</p> : null}
            {!invoicesQuery.isLoading && filteredInvoices.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-zinc-500">
                No pickup receipts match the current search.
              </div>
            ) : null}
            {filteredInvoices.map((invoice) => {
              const isSelected = invoice.invoiceId === activeInvoiceId
              return (
                <button
                  key={invoice.invoiceId}
                  type="button"
                  onClick={() => setSelectedInvoiceId(invoice.invoiceId)}
                  className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${
                    isSelected ? 'border-gym-500/20 bg-gym-500/10' : 'border-white/10 bg-[rgba(18,18,26,0.92)] hover:border-white/10'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Pickup receipt</p>
                      <h3 className="mt-2 text-lg font-bold text-white">{invoice.invoiceCode}</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Order #{invoice.orderId} | Payment #{invoice.paymentId}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">
                        {invoice.recipientName || invoice.customerAccountName || 'Unknown customer'} | {invoice.recipientEmail || invoice.customerAccountEmail || '-'}
                      </p>
                    </div>
                    <div className="space-y-2 text-right">
                      <PickupStatusBadge pickedUpAt={invoice.pickedUpAt} />
                      <EmailStatusBadge invoice={invoice} />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <section className="gc-card-compact space-y-4">
          <header className="border-b border-white/10 pb-4">
            <h2 className="gc-section-kicker">Handoff Detail</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Confirm the customer identity, verify the paid items, then mark the order as picked up.
            </p>
          </header>

          {!selectedInvoice && !invoiceDetailQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-zinc-500">
              Select a pickup receipt from the queue.
            </div>
          ) : null}

          {invoiceDetailQuery.isLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-sm text-zinc-500">
              Loading handoff detail…
            </div>
          ) : null}

          {selectedInvoice ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailCard label="Invoice code" value={selectedInvoice.invoiceCode} />
                <DetailCard label="Paid at" value={formatDateTime(selectedInvoice.paidAt)} />
                <DetailCard label="Customer" value={selectedInvoice.customerAccountName || selectedInvoice.recipientName || '-'} />
                <DetailCard label="Receipt email" value={selectedInvoice.recipientEmail || selectedInvoice.customerAccountEmail || '-'} />
                <DetailCard label="Phone" value={selectedInvoice.shippingPhone || '-'} />
                <DetailCard label="Payment method" value={selectedInvoice.paymentMethod || '-'} />
              </div>

              <div className="rounded-2xl border border-gym-500/20 bg-gym-500/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-gym-300">Front-desk workflow</p>
                    <p className="mt-2 text-sm text-gym-100">
                      Ask for order ID <span className="font-bold">#{selectedInvoice.orderId}</span> before handing over the products.
                    </p>
                    <p className="mt-2 text-xs text-gym-300">
                      {selectedInvoice.pickedUpAt
                        ? `Picked up at ${formatDateTime(selectedInvoice.pickedUpAt)}`
                        : 'Not yet marked as picked up'}
                    </p>
                    {selectedInvoice.pickedUpByName ? (
                      <p className="mt-1 text-xs text-gym-300">Handled by: {selectedInvoice.pickedUpByName}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => confirmPickupMutation.mutate(selectedInvoice.invoiceId)}
                    disabled={Boolean(selectedInvoice.pickedUpAt) || confirmPickupMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-full bg-gym-600 px-4 py-2 text-xs font-semibold text-white hover:bg-gym-700 disabled:cursor-not-allowed disabled:bg-white/10"
                  >
                    <CheckCircle2 size={14} />
                    {selectedInvoice.pickedUpAt
                      ? 'Pickup confirmed'
                      : confirmPickupMutation.isPending
                        ? 'Confirming…'
                        : 'Confirm pickup'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[rgba(18,18,26,0.92)]">
                <div className="border-b border-white/10 px-4 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Items for collection</h3>
                </div>
                <div className="divide-y divide-white/10">
                  {selectedItems.map((item) => (
                    <div key={item.invoiceItemId} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{item.productName}</p>
                        <p className="text-[11px] text-zinc-500">
                          Qty {item.quantity} | {formatCurrency(item.unitPrice, selectedInvoice.currency)} each
                        </p>
                      </div>
                      <strong className="text-sm text-white">{formatCurrency(item.lineTotal, selectedInvoice.currency)}</strong>
                    </div>
                  ))}
                  {selectedItems.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-zinc-500">No invoice items found.</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <span className="rounded-2xl bg-[rgba(18,18,26,0.92)] p-2 text-slate-300 shadow-sm ring-1 ring-white/10">
                    <Ticket size={16} />
                  </span>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-white">Receipt delivery</p>
                    <EmailStatusBadge invoice={selectedInvoice} />
                    <p className="text-[11px] text-zinc-500">
                      Sent at: {selectedInvoice.emailSentAt ? formatDateTime(selectedInvoice.emailSentAt) : 'Not sent yet'}
                    </p>
                    {selectedInvoice.emailSendError ? (
                      <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300 ring-1 ring-rose-100">
                        {selectedInvoice.emailSendError}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

function SummaryPill({ label, value, tone }) {
  const toneClass = tone === 'gym'
    ? 'bg-gym-500/10 text-gym-300'
    : 'bg-amber-500/10 text-amber-300'
  return (
    <div className={`rounded-2xl px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] opacity-70">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
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

function PickupStatusBadge({ pickedUpAt }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
      pickedUpAt
        ? 'bg-gym-500/10 text-gym-300 ring-gym-100'
        : 'bg-amber-500/10 text-amber-300 ring-amber-100'
    }`}>
      {pickedUpAt ? 'Picked up' : 'Awaiting pickup'}
    </span>
  )
}

function EmailStatusBadge({ invoice }) {
  const status = getEmailState(invoice)
  const className = status === 'sent'
    ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
    : status === 'failed'
      ? 'bg-rose-500/10 text-rose-300 ring-rose-100'
      : 'bg-white/10 text-slate-300 ring-white/10'
  const label = status === 'sent' ? 'Email sent' : status === 'failed' ? 'Email failed' : 'Email pending'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${className}`}>{label}</span>
}

function getEmailState(invoice) {
  if (invoice?.emailSentAt) return 'sent'
  if (invoice?.emailSendError) return 'failed'
  return 'pending'
}

export default ReceptionPickupPage






