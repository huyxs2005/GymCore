import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Mail, Receipt, Search, ShoppingBag, Ticket } from 'lucide-react'
import { Link } from 'react-router-dom'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { useSession } from '../../features/auth/useSession'
import { orderApi } from '../../features/product/api/orderApi'
import { productApi } from '../../features/product/api/productApi'
import { getDynamicProductImage } from '../../features/product/utils/productImageUtils'
import { formatCurrency, formatDateTime } from '../../utils/formatters'

const PICKUP_FILTERS = [
  { value: 'all', label: 'All pickup states' },
  { value: 'awaiting', label: 'Awaiting pickup' },
  { value: 'picked', label: 'Picked up' },
]

function CustomerOrderHistoryPage() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const userId = user?.userId ?? null
  const [reviewDraft, setReviewDraft] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [pickupFilter, setPickupFilter] = useState('all')

  const ordersQuery = useQuery({
    queryKey: ['orders', userId],
    queryFn: orderApi.getMyOrders,
    enabled: Boolean(userId),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ productId, rating, comment, reviewId }) =>
      reviewId
        ? productApi.updateReview(productId, { rating, comment })
        : productApi.createReview(productId, { rating, comment }),
    onSuccess: () => {
      setReviewDraft(null)
      queryClient.invalidateQueries({ queryKey: ['orders', userId] })
    },
  })

  const deleteReviewMutation = useMutation({
    mutationFn: productApi.deleteReview,
    onSuccess: () => {
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['orders', userId] })
    },
  })

  const orders = useMemo(() => ordersQuery.data?.orders ?? [], [ordersQuery.data])
  const paidOrders = useMemo(
    () => orders.filter((order) => String(order.status || '').toUpperCase() === 'PAID'),
    [orders],
  )

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return paidOrders.filter((order) => {
      const pickupState = order.pickedUpAt ? 'picked' : 'awaiting'
      if (pickupFilter !== 'all' && pickupFilter !== pickupState) {
        return false
      }
      if (!normalizedSearch) {
        return true
      }
      const haystack = [
        order.orderId,
        order.invoiceCode,
        order.paymentId,
        ...(order.items || []).map((item) => item.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [paidOrders, pickupFilter, search])

  const awaitingPickupCount = paidOrders.filter((order) => !order.pickedUpAt).length
  const pickedUpCount = paidOrders.filter((order) => Boolean(order.pickedUpAt)).length
  const emailIssueCount = paidOrders.filter((order) => !order.emailSentAt).length

  const submitReview = (event) => {
    event.preventDefault()
    if (!reviewDraft) return
    reviewMutation.mutate({
      ...reviewDraft,
      comment: reviewDraft.comment.trim(),
    })
  }

  const handleDeleteReview = (productId) => {
    if (deleteTarget !== productId) {
      setDeleteTarget(productId)
      return
    }
    deleteReviewMutation.mutate(productId)
  }

  return (
    <WorkspaceScaffold
      title="Order History"
      subtitle="Track paid supplement purchases, confirm pickup status, and manage feedback for products you already bought."
      links={customerNav}
    >
      {reviewDraft ? (
        <div className="mb-6 rounded-3xl border border-white/10 bg-[rgba(18,18,26,0.92)] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Review product</p>
              <h2 className="mt-2 text-xl font-bold text-white">{reviewDraft.productName}</h2>
              <p className="mt-1 text-sm text-slate-400">Order #{reviewDraft.orderId}</p>
            </div>
            <button
              type="button"
              onClick={() => setReviewDraft(null)}
              className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-slate-400 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={submitReview} className="mt-5 space-y-4">
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rating</span>
              <select
                name="reviewRating"
                value={reviewDraft.rating}
                onChange={(event) =>
                  setReviewDraft((prev) => ({ ...prev, rating: Number(event.target.value) }))
                }
                className="gc-select"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value} star{value > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Comment</span>
              <textarea
                name="reviewComment"
                value={reviewDraft.comment}
                onChange={(event) =>
                  setReviewDraft((prev) => ({ ...prev, comment: event.target.value }))
                }
                className="gc-textarea min-h-[120px]"
                placeholder="Share your result with this supplement…"
              />
            </label>
            <button
              type="submit"
              disabled={reviewMutation.isPending || !reviewDraft.comment.trim()}
              className="rounded-full bg-gym-600 px-5 py-2 text-sm font-semibold text-white hover:bg-gym-700 disabled:cursor-not-allowed disabled:bg-white/10"
            >
              {reviewMutation.isPending ? 'Submitting…' : reviewDraft.reviewId ? 'Update review' : 'Submit review'}
            </button>
          </form>
        </div>
      ) : null}

      <section className="gc-card-compact space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="gc-section-kicker">Purchase history</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Bring the order ID to the front desk for pickup until the order is marked as collected.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard label="Paid orders" value={paidOrders.length} tone="slate" />
            <SummaryCard label="Awaiting pickup" value={awaitingPickupCount} tone="amber" />
            <SummaryCard label="Email issues" value={emailIssueCount} tone="rose" />
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 transition-[border-color,background-color,box-shadow] focus-within:border-gym-500/40 focus-within:bg-white/10 focus-within:ring-2 focus-within:ring-gym-500/20">
            <Search size={15} className="text-slate-400" />
            <span className="sr-only">Search order history</span>
            <input
              type="search"
              name="orderHistorySearch"
              autoComplete="off"
              spellCheck={false}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order ID, invoice code, or product name…"
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-400"
            />
          </label>
          <select
            value={pickupFilter}
            onChange={(event) => setPickupFilter(event.target.value)}
            className="rounded-2xl border border-white/10 bg-[rgba(18,18,26,0.92)] px-3 py-2 text-sm text-slate-300"
          >
            {PICKUP_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <div className="rounded-2xl bg-gym-500/10 px-4 py-2 text-sm font-semibold text-gym-300">
            Picked up: {pickedUpCount}
          </div>
        </div>

        {ordersQuery.isLoading ? <p aria-live="polite" className="text-sm text-zinc-500">Loading order history…</p> : null}
        {ordersQuery.isError ? <p className="text-sm text-rose-600">Could not load order history.</p> : null}
        {!ordersQuery.isLoading && filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-zinc-500">
            No paid product orders match the current filters.
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {filteredOrders.map((order) => (
            <article key={order.orderId} className="rounded-3xl border border-white/10 bg-[rgba(18,18,26,0.92)] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Order ID</p>
                  <p className="mt-2 text-2xl font-bold text-white">#{order.orderId}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Paid {order.paidAt ? formatDateTime(order.paidAt) : 'time unavailable'}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-right text-[11px] font-semibold text-emerald-300">
                  <div>Paid</div>
                  <div className="mt-1 text-base text-white">
                    {formatCurrency(order.totalAmount, order.currency || 'VND')}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <StatusTile
                  icon={<Ticket size={15} />}
                  label="Pickup"
                  value={order.pickedUpAt ? 'Picked up' : 'Awaiting pickup'}
                  detail={order.pickedUpAt ? formatDateTime(order.pickedUpAt) : 'Bring order ID to the receptionist.'}
                  tone={order.pickedUpAt ? 'gym' : 'amber'}
                />
                <StatusTile
                  icon={<Mail size={15} />}
                  label="Receipt email"
                  value={order.emailSentAt ? 'Sent' : order.emailSendError ? 'Failed' : 'Pending'}
                  detail={order.emailSentAt ? formatDateTime(order.emailSentAt) : order.emailSendError || 'Waiting for delivery'}
                  tone={order.emailSentAt ? 'emerald' : order.emailSendError ? 'rose' : 'slate'}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetaRow label="Invoice code" value={order.invoiceCode || '-'} />
                  <MetaRow label="Payment ID" value={order.paymentId ? `#${order.paymentId}` : '-'} />
                  <MetaRow label="Payment method" value={order.paymentMethod || 'PAYOS'} />
                  <MetaRow label="Fulfillment" value="Pickup at store" />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-gym-500/20 bg-gym-500/10 px-4 py-3 text-xs text-gym-200">
                Show order ID <span className="font-bold">#{order.orderId}</span> at the front desk until the receptionist confirms pickup.
              </div>

              <div className="mt-4 space-y-3">
                {(order.items || []).map((item) => {
                  const reviewUnlocked = Boolean(order.pickedUpAt)
                  return (
                  <div key={`${order.orderId}-${item.productId}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/10 border border-white/10">
                        <img
                          src={getDynamicProductImage(item.name)}
                          alt={item.name}
                          width="56"
                          height="56"
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                        <p className="text-[11px] text-zinc-500">
                          Qty {item.quantity} | {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <Link
                        to={`/customer/shop/${item.productId}`}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[rgba(18,18,26,0.92)] px-3 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10"
                      >
                        View product
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      {item.hasReview ? (
                        <div className="text-xs text-slate-400">
                          <span className="font-semibold text-white">Your review:</span>{' '}
                          {item.reviewRating}/5
                          {item.reviewComment ? ` - ${item.reviewComment}` : ''}
                        </div>
                      ) : (
                        <div className="text-xs text-zinc-500">No review yet.</div>
                      )}
                      {!reviewUnlocked ? (
                        <div className="text-xs font-medium text-amber-300">
                          Review unlocks after pickup is confirmed.
                        </div>
                      ) : !item.hasReview ? (
                        <button
                          type="button"
                          onClick={() =>
                            setReviewDraft({
                              orderId: order.orderId,
                              productId: item.productId,
                              productName: item.name,
                              rating: 5,
                              comment: '',
                            })}
                          className="rounded-full border border-gym-500/30 bg-[rgba(18,18,26,0.92)] px-3 py-1 text-xs font-semibold text-gym-300 hover:bg-gym-500/15"
                        >
                          Leave review
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          {deleteTarget === item.productId ? (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(null)}
                              className="rounded-full border border-white/10 bg-[rgba(18,18,26,0.92)] px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
                            >
                              Keep review
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleDeleteReview(item.productId)}
                            disabled={deleteReviewMutation.isPending && deleteTarget === item.productId}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              deleteTarget === item.productId
                                ? 'bg-rose-600 text-white hover:bg-rose-700'
                                : 'border border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-100'
                            }`}
                          >
                            {deleteReviewMutation.isPending && deleteTarget === item.productId ? 'Deleting…' : deleteTarget === item.productId ? 'Confirm delete' : 'Delete review'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setReviewDraft({
                                orderId: order.orderId,
                                productId: item.productId,
                                productName: item.name,
                                rating: Number(item.reviewRating || 5),
                                comment: item.reviewComment || '',
                                reviewId: item.reviewId,
                              })}
                            className="rounded-full border border-white/10 bg-[rgba(18,18,26,0.92)] px-3 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
                          >
                            Edit review
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  )
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
    </WorkspaceScaffold>
  )
}

function SummaryCard({ label, value, tone }) {
  const toneClass = tone === 'amber'
    ? 'bg-amber-500/10 text-amber-300'
    : tone === 'rose'
      ? 'bg-rose-500/10 text-rose-300'
      : 'bg-white/10 text-slate-300'
  return (
    <div className={`rounded-2xl px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] opacity-70">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  )
}

function StatusTile({ icon, label, value, detail, tone }) {
  const toneClass = tone === 'gym'
    ? 'border-gym-500/20 bg-gym-500/10 text-gym-300'
    : tone === 'amber'
      ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
      : tone === 'rose'
        ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
        : 'border-white/10 bg-white/5 text-slate-300'

  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm font-bold">{value}</div>
      <div className="mt-1 text-[11px] opacity-80">{detail}</div>
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm text-white">{value}</div>
    </div>
  )
}

export default CustomerOrderHistoryPage








