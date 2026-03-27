import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CreditCard, Loader2, Package, Search, ShoppingBag, UserRound, X } from 'lucide-react'
import PaginationControls from '../../components/common/PaginationControls'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { receptionNav } from '../../config/navigation'
import { adminInvoiceApi } from '../../features/product/api/adminInvoiceApi'
import { usePagination } from '../../hooks/usePagination'

const STATUS_FILTERS = [
  { value: 'awaiting', label: 'Needs pickup' },
  { value: 'picked', label: 'Completed order' },
  { value: 'all', label: 'All orders' },
]

function formatDateTime(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed)
}

function formatMoney(amount, currency = 'VND') {
  return `${Number(amount || 0).toLocaleString('en-US')} ${currency || 'VND'}`
}

function matchesStatus(invoice, filter) {
  if (filter === 'all') return true
  if (filter === 'picked') return Boolean(invoice?.pickedUpAt)
  return !invoice?.pickedUpAt
}

function matchesSearch(invoice, normalizedSearch) {
  if (!normalizedSearch) return true
  const haystack = [
    invoice?.invoiceCode,
    invoice?.orderId,
    invoice?.paymentId,
    invoice?.customerAccountName,
    invoice?.customerAccountEmail,
    invoice?.recipientName,
    invoice?.recipientEmail,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(normalizedSearch)
}

function ReceptionPickupPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('awaiting')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)

  const invoicesQuery = useQuery({
    queryKey: ['reception-pickup-invoices'],
    queryFn: adminInvoiceApi.getInvoices,
  })

  const confirmPickupMutation = useMutation({
    mutationFn: adminInvoiceApi.confirmPickup,
    onSuccess: async (_, invoiceId) => {
      await queryClient.invalidateQueries({ queryKey: ['reception-pickup-invoices'] })
      await queryClient.invalidateQueries({ queryKey: ['reception-pickup-invoice-detail', invoiceId] })
    },
  })

  const invoices = useMemo(() => invoicesQuery.data?.invoices ?? [], [invoicesQuery.data])
  const normalizedSearch = search.trim().toLowerCase()

  const filteredInvoices = useMemo(
    () => invoices.filter((invoice) => matchesStatus(invoice, statusFilter) && matchesSearch(invoice, normalizedSearch)),
    [invoices, normalizedSearch, statusFilter],
  )

  const {
    currentPage: invoicesPage,
    setCurrentPage: setInvoicesPage,
    totalPages: invoiceTotalPages,
    paginatedItems: paginatedInvoices,
  } = usePagination(filteredInvoices, 10)

  const selectedInvoiceFromList = useMemo(
    () => invoices.find((invoice) => invoice.invoiceId === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId],
  )

  useEffect(() => {
    if (!selectedInvoiceId) return
    if (selectedInvoiceFromList) return
    setSelectedInvoiceId(null)
  }, [selectedInvoiceFromList, selectedInvoiceId])

  useEffect(() => {
    setSelectedInvoiceId(null)
    setInvoicesPage(1)
  }, [statusFilter, setInvoicesPage])

  const invoiceDetailQuery = useQuery({
    queryKey: ['reception-pickup-invoice-detail', selectedInvoiceId],
    queryFn: () => adminInvoiceApi.getInvoiceDetail(selectedInvoiceId),
    enabled: selectedInvoiceId != null,
  })

  const selectedInvoice = invoiceDetailQuery.data?.invoice ?? selectedInvoiceFromList
  const selectedItems = invoiceDetailQuery.data?.items ?? []
  const awaitingCount = invoices.filter((invoice) => !invoice.pickedUpAt).length
  const pickedCount = invoices.filter((invoice) => Boolean(invoice.pickedUpAt)).length

  return (
    <WorkspaceScaffold showHeader={false} links={receptionNav}>
      <div className="max-w-7xl space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-white">Customer pickup orders</h2>
              <p className="mt-2 text-sm text-slate-500">
                Ask for the order number or invoice code, confirm the details, then complete the handoff.
              </p>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-3">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-500">Needs pickup</p>
                <p className="mt-1 text-sm font-bold text-white">{awaitingCount}</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">Completed order</p>
                <p className="mt-1 text-sm font-bold text-white">{pickedCount}</p>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-2 ring-1 ring-white/10 transition-all focus-within:bg-white/5 focus-within:ring-gym-500/50">
              <div className="pl-4 text-slate-500 group-focus-within:text-gym-500">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Enter order number, invoice code, customer name or email"
                className="h-12 w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={`rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                  statusFilter === filter.value
                    ? 'bg-gym-500 text-slate-950 shadow-glow'
                    : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {!selectedInvoice ? (
            <>
              <div className="space-y-3">
                {invoicesQuery.isLoading ? (
                  [1, 2, 3].map((item) => (
                    <div key={item} className="h-24 animate-pulse rounded-3xl border border-white/5 bg-white/[0.02]" />
                  ))
                ) : filteredInvoices.length === 0 ? (
                  <div className="rounded-3xl border border-white/5 bg-white/[0.02] px-6 py-12 text-center">
                    <Package className="mx-auto h-10 w-10 text-slate-700" />
                    <p className="mt-4 text-sm text-slate-500">No orders match the current search.</p>
                  </div>
                ) : (
                  paginatedInvoices.map((invoice) => (
                    <button
                      key={invoice.invoiceId}
                      type="button"
                      onClick={() => setSelectedInvoiceId(invoice.invoiceId)}
                      className="w-full rounded-3xl border border-white/5 bg-white/[0.02] p-5 text-left transition hover:border-white/15 hover:bg-white/[0.04]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-300">
                            <ShoppingBag className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-base font-bold text-white">{invoice.invoiceCode}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {`Order #${invoice.orderId}${invoice.recipientName || invoice.customerAccountName ? ` • ${invoice.recipientName || invoice.customerAccountName}` : ''}`}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              Bought: {formatDateTime(invoice.paidAt)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            invoice.pickedUpAt ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {invoice.pickedUpAt ? 'Completed order' : 'Needs pickup'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <PaginationControls
                currentPage={invoicesPage}
                totalPages={invoiceTotalPages}
                onPageChange={setInvoicesPage}
                tone="dark"
                className="mt-5"
              />
            </>
          ) : null}

          {selectedInvoice ? (
            <section className="space-y-6">
              <div className="rounded-3xl border border-gym-500/20 bg-gym-500/5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white">
                      <UserRound className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">{selectedInvoice.invoiceCode || `Order #${selectedInvoice.orderId}`}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {`Order #${selectedInvoice.orderId}${selectedInvoice.recipientName || selectedInvoice.customerAccountName ? ` • ${selectedInvoice.recipientName || selectedInvoice.customerAccountName}` : ''}`}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {selectedInvoice.recipientEmail || selectedInvoice.customerAccountEmail || '-'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceId(null)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                    Change order
                  </button>
                </div>
              </div>

              {invoiceDetailQuery.isLoading ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.02] py-16 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-gym-500" />
                  <p className="mt-4 text-sm text-slate-500">Loading order details...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Bought date</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formatDateTime(selectedInvoice.paidAt)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Payment</p>
                        <p className="mt-2 text-sm font-semibold text-white">{selectedInvoice.paymentMethod || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Status</p>
                        <p className="mt-2 text-sm font-semibold text-white">{selectedInvoice.pickedUpAt ? 'Completed order' : 'Awaiting pickup'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Total paid</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency)}</p>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-gym-500" />
                        <h3 className="text-base font-bold uppercase tracking-tight text-white">Order details</h3>
                      </div>
                      {selectedInvoice.pickedUpAt ? (
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                          Completed order {formatDateTime(selectedInvoice.pickedUpAt)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Coupon used</p>
                        <p className="mt-2 text-sm font-semibold text-white">{selectedInvoice.promoCode || 'No coupon used'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Total before</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formatMoney(selectedInvoice.subtotal, selectedInvoice.currency)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Total after</p>
                        <p className="mt-2 text-sm font-semibold text-white">{formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency)}</p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {selectedItems.length === 0 ? (
                        <p className="text-sm text-slate-500">No items found for this order.</p>
                      ) : (
                        selectedItems.map((item) => (
                          <div key={item.invoiceItemId} className="rounded-2xl border border-white/5 bg-black/20 px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">{item.productName}</p>
                                <p className="mt-1 text-xs text-slate-500">Quantity: {item.quantity}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-slate-500">Unit price: {formatMoney(item.unitPrice, selectedInvoice.currency)}</p>
                                <p className="mt-1 text-sm font-semibold text-white">{formatMoney(item.lineTotal, selectedInvoice.currency)}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-5 w-5 text-gym-500" />
                          <h3 className="text-base font-bold uppercase tracking-tight text-white">Front desk handoff</h3>
                        </div>
                        <p className="text-sm text-slate-500">
                          Confirm the order number with the customer, verify the items, then complete the pickup.
                        </p>
                      </div>
                      {!selectedInvoice.pickedUpAt ? (
                        <button
                          type="button"
                          onClick={() => confirmPickupMutation.mutate(selectedInvoice.invoiceId)}
                          disabled={confirmPickupMutation.isPending}
                          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-gym-500 px-6 text-sm font-bold text-slate-950 shadow-glow transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
                        >
                          {confirmPickupMutation.isPending ? 'Completing...' : 'Complete order'}
                        </button>
                      ) : null}
                    </div>

                    {selectedInvoice.pickedUpAt && selectedInvoice.pickedUpByName ? (
                      <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Completed by {selectedInvoice.pickedUpByName}
                      </div>
                    ) : null}
                  </section>
                </div>
              )}
            </section>
          ) : null}
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

export default ReceptionPickupPage
