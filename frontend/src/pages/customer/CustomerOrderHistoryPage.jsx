import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Package, Search, ShoppingBag, Star, UserRound, X } from 'lucide-react'
import PaginationControls from '../../components/common/PaginationControls'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { useSession } from '../../features/auth/useSession'
import { membershipApi } from '../../features/membership/api/membershipApi'
import { productApi } from '../../features/product/api/productApi'
import {
  formatDurationLabel,
  formatDurationWithCoupon,
} from '../../features/membership/utils/membershipCheckout'
import { orderApi } from '../../features/product/api/orderApi'
import { usePagination } from '../../hooks/usePagination'

const TABS = [
  { value: 'membership', label: 'Membership buying history' },
  { value: 'product', label: 'Product buying history' },
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

function buildMembershipDurationText(membership) {
  const durationDays = Number(membership?.plan?.durationDays || 0)
  const bonusMonths = Number(membership?.payment?.coupon?.bonusDurationMonths || 0)
  return formatDurationWithCoupon(durationDays, bonusMonths) || formatDurationLabel(durationDays)
}

function getMembershipStatusBadgeClass(status) {
  const normalizedStatus = String(status || '').toUpperCase()
  if (normalizedStatus === 'ACTIVE') {
    return 'rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white'
  }
  if (normalizedStatus === 'EXPIRED') {
    return 'rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300'
  }
  if (normalizedStatus === 'CANCELLED') {
    return 'rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300'
  }
  return 'rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300'
}

function buildReviewDraft(item) {
  return {
    productId: item?.productId ?? null,
    productName: item?.name ?? 'Product',
    rating: Number(item?.reviewRating || 5),
    comment: item?.reviewComment || '',
    mode: item?.hasReview ? 'edit' : 'create',
  }
}

function getProductOrderStatus(order) {
  const pickupStatus = String(order?.pickupStatus || '').toUpperCase()
  if (pickupStatus === 'PICKED_UP' || order?.pickedUpAt) {
    return {
      label: 'Completed order',
      detail: order?.pickedUpAt ? `Completed ${formatDateTime(order.pickedUpAt)}` : 'Completed order',
      badgeClass: 'rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400',
    }
  }
  return {
    label: 'Awaiting pickup',
    detail: 'Waiting for receptionist pickup confirmation',
    badgeClass: 'rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300',
  }
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 px-5 py-5">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

function CustomerOrderHistoryPage() {
  const { user } = useSession()
  const userId = user?.userId ?? null
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('membership')
  const [membershipSearch, setMembershipSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [selectedMembershipId, setSelectedMembershipId] = useState(null)
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [reviewModal, setReviewModal] = useState({ open: false, productId: null, productName: '', rating: 5, comment: '', mode: 'create' })
  const [reviewError, setReviewError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const membershipHistoryQuery = useQuery({
    queryKey: ['customer-membership-history', userId],
    queryFn: membershipApi.getHistory,
    enabled: Boolean(userId),
  })

  const ordersQuery = useQuery({
    queryKey: ['orders', userId],
    queryFn: orderApi.getMyOrders,
    enabled: Boolean(userId),
  })

  const memberships = useMemo(
    () => membershipHistoryQuery.data?.data?.memberships ?? membershipHistoryQuery.data?.memberships ?? [],
    [membershipHistoryQuery.data],
  )

  const productOrders = useMemo(() => {
    const orders = ordersQuery.data?.orders ?? []
    return orders.filter((order) => String(order.status || '').toUpperCase() === 'PAID')
  }, [ordersQuery.data])

  const filteredMemberships = useMemo(() => {
    const normalized = membershipSearch.trim().toLowerCase()
    if (!normalized) return memberships
    return memberships.filter((membership) =>
      String(membership?.plan?.name || '').toLowerCase().includes(normalized),
    )
  }, [membershipSearch, memberships])

  const filteredOrders = useMemo(() => {
    const normalized = productSearch.trim().toLowerCase()
    if (!normalized) return productOrders
    return productOrders.filter((order) => {
      const haystack = [
        order?.invoiceCode,
        order?.orderId,
        order?.paymentId,
        ...(order?.items || []).map((item) => item.name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [productOrders, productSearch])

  const {
    currentPage: membershipPage,
    setCurrentPage: setMembershipPage,
    totalPages: membershipTotalPages,
    paginatedItems: paginatedMemberships,
  } = usePagination(filteredMemberships, 10)

  const {
    currentPage: orderPage,
    setCurrentPage: setOrderPage,
    totalPages: orderTotalPages,
    paginatedItems: paginatedOrders,
  } = usePagination(filteredOrders, 10)

  const selectedMembership = useMemo(
    () => memberships.find((membership) => membership.customerMembershipId === selectedMembershipId) || null,
    [memberships, selectedMembershipId],
  )

  const selectedOrder = useMemo(
    () => productOrders.find((order) => order.orderId === selectedOrderId) || null,
    [productOrders, selectedOrderId],
  )
  const selectedOrderStatus = useMemo(() => getProductOrderStatus(selectedOrder), [selectedOrder])

  const reviewMutation = useMutation({
    mutationFn: ({ productId, rating, comment, mode }) =>
      mode === 'edit'
        ? productApi.updateReview(productId, { rating, comment })
        : productApi.createReview(productId, { rating, comment }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders', userId] })
      setReviewModal({ open: false, productId: null, productName: '', rating: 5, comment: '', mode: 'create' })
      setReviewError('')
    },
    onError: (error) => {
      setReviewError(error?.response?.data?.message || error?.message || 'Unable to save review.')
    },
  })

  const deleteReviewMutation = useMutation({
    mutationFn: ({ productId }) => productApi.deleteReview(productId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders', userId] })
      setDeleteTarget(null)
    },
  })

  useEffect(() => {
    setSelectedMembershipId(null)
    setMembershipPage(1)
  }, [membershipSearch, setMembershipPage])

  useEffect(() => {
    setSelectedOrderId(null)
    setOrderPage(1)
  }, [productSearch, setOrderPage])

  useEffect(() => {
    setSelectedMembershipId(null)
    setSelectedOrderId(null)
  }, [activeTab])

  function openReviewModal(item) {
    setReviewModal({ open: true, ...buildReviewDraft(item) })
    setReviewError('')
  }

  function closeReviewModal() {
    if (reviewMutation.isPending) return
    setReviewModal({ open: false, productId: null, productName: '', rating: 5, comment: '', mode: 'create' })
    setReviewError('')
  }

  function submitReview(event) {
    event.preventDefault()
    if (!reviewModal.productId) return
    if (reviewModal.rating < 1 || reviewModal.rating > 5) {
      setReviewError('Please choose a rating from 1 to 5.')
      return
    }
    reviewMutation.mutate({
      productId: reviewModal.productId,
      rating: reviewModal.rating,
      comment: reviewModal.comment,
      mode: reviewModal.mode,
    })
  }

  return (
    <WorkspaceScaffold showHeader={false} links={customerNav}>
      <div className="mx-auto max-w-7xl space-y-8 pb-12">
        <section className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                  activeTab === tab.value
                    ? 'bg-gym-500 text-slate-950 shadow-glow'
                    : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'membership' ? (
            <section className="space-y-6">
              <div className="group relative">
                <div className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-2 ring-1 ring-white/10 transition-all focus-within:bg-white/5 focus-within:ring-gym-500/50">
                  <div className="pl-4 text-slate-500">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={membershipSearch}
                    onChange={(event) => setMembershipSearch(event.target.value)}
                    placeholder="Search membership name"
                    className="h-12 w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              {!selectedMembership ? (
                <>
                  <div className="space-y-3">
                    {membershipHistoryQuery.isLoading ? (
                      [1, 2, 3].map((item) => (
                        <div key={item} className="h-24 animate-pulse rounded-3xl border border-white/5 bg-white/[0.02]" />
                      ))
                    ) : filteredMemberships.length === 0 ? (
                      <div className="rounded-3xl border border-white/5 bg-white/[0.02] px-6 py-12 text-center text-sm text-slate-500">
                        No membership purchases match the current search.
                      </div>
                    ) : (
                      paginatedMemberships.map((membership) => (
                        <button
                          key={membership.customerMembershipId}
                          type="button"
                          onClick={() => setSelectedMembershipId(membership.customerMembershipId)}
                          className="w-full rounded-3xl border border-white/5 bg-white/[0.02] p-5 text-left transition hover:border-white/15 hover:bg-white/[0.04]"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-300">
                                <CalendarDays className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-base font-bold text-white">{membership?.plan?.name || 'Membership'}</p>
                                <p className="mt-1 text-sm text-slate-400">{buildMembershipDurationText(membership)}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  Bought: {formatDateTime(membership?.payment?.createdAt || membership?.createdAt)}
                                </p>
                              </div>
                            </div>
                            <span className={getMembershipStatusBadgeClass(membership?.status)}>
                              {membership?.status || 'UNKNOWN'}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <PaginationControls
                    currentPage={membershipPage}
                    totalPages={membershipTotalPages}
                    onPageChange={setMembershipPage}
                    tone="dark"
                  />
                </>
              ) : (
                <section className="space-y-6">
                  <div className="rounded-3xl border border-gym-500/20 bg-gym-500/5 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white">
                          <UserRound className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-white">{selectedMembership?.plan?.name || 'Membership'}</p>
                          <p className="mt-1 text-sm text-slate-400">{buildMembershipDurationText(selectedMembership)}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Bought: {formatDateTime(selectedMembership?.payment?.createdAt || selectedMembership?.createdAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedMembershipId(null)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
                      >
                        <X className="h-4 w-4" />
                        Change membership
                      </button>
                    </div>
                  </div>

                  <section className="rounded-[2rem] border border-white/10 bg-[#14141c] p-8">
                    <div className="flex items-center gap-3 text-white">
                      <CalendarDays size={18} />
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-white">Membership summary</p>
                    </div>

                    <div className="mt-6 space-y-4">
                      <div className="flex items-center justify-between gap-6 text-sm">
                        <span className="text-white">Plan</span>
                        <span className="text-right font-bold text-white">{selectedMembership?.plan?.name || 'Membership'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-6 text-sm">
                        <span className="text-white">Months / duration</span>
                        <span className="text-right font-bold text-white">{buildMembershipDurationText(selectedMembership)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-6 text-sm">
                        <span className="text-white">Bought date</span>
                        <span className="text-right font-bold text-white">
                          {formatDateTime(selectedMembership?.payment?.createdAt || selectedMembership?.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-6 text-sm">
                        <span className="text-white">Status</span>
                        <span className="text-right font-bold text-white">{selectedMembership?.status || 'UNKNOWN'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-6 text-sm">
                        <span className="text-white">Coupon used</span>
                        <span className="text-right font-bold text-white">
                          {selectedMembership?.payment?.coupon?.promoCode || 'No coupon used'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-6 text-sm">
                        <span className="text-white">Coupon discount</span>
                        <span className="text-right font-bold text-gym-400">
                          -{Number(selectedMembership?.payment?.discountAmount || 0).toLocaleString('en-US')} VND
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-6 text-sm">
                        <span className="text-white">Extra months from coupon</span>
                        <span className="text-right font-bold text-gym-400">
                          {Number(selectedMembership?.payment?.coupon?.bonusDurationMonths || 0)}
                        </span>
                      </div>
                      <div className="border-t border-white/10 pt-4">
                        <div className="flex items-center justify-between gap-6">
                          <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Price calculation</span>
                          <span className="text-right text-2xl font-black text-white">
                            {Number(selectedMembership?.payment?.originalAmount ?? selectedMembership?.plan?.price).toLocaleString('en-US')} - {Number(selectedMembership?.payment?.discountAmount || 0).toLocaleString('en-US')}
                          </span>
                        </div>
                      </div>
                      <div className="border-t border-white/10 pt-4">
                        <div className="flex items-center justify-between gap-6">
                          <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Total</span>
                          <span className="text-3xl font-black text-white">
                            {formatMoney(selectedMembership?.payment?.amount ?? selectedMembership?.plan?.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                </section>
              )}
            </section>
          ) : (
            <section className="space-y-6">
              <div className="group relative">
                <div className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-2 ring-1 ring-white/10 transition-all focus-within:bg-white/5 focus-within:ring-gym-500/50">
                  <div className="pl-4 text-slate-500">
                    <Search className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search order number, invoice code, or product name"
                    className="h-12 w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              {!selectedOrder ? (
                <>
                  <div className="space-y-3">
                    {ordersQuery.isLoading ? (
                      [1, 2, 3].map((item) => (
                        <div key={item} className="h-24 animate-pulse rounded-3xl border border-white/5 bg-white/[0.02]" />
                      ))
                    ) : filteredOrders.length === 0 ? (
                      <div className="rounded-3xl border border-white/5 bg-white/[0.02] px-6 py-12 text-center">
                        <Package className="mx-auto h-10 w-10 text-slate-700" />
                        <p className="mt-4 text-sm text-slate-500">No product orders match the current search.</p>
                      </div>
                    ) : (
                      paginatedOrders.map((order) => {
                        const orderStatus = getProductOrderStatus(order)
                        return (
                        <button
                          key={order.orderId}
                          type="button"
                          onClick={() => setSelectedOrderId(order.orderId)}
                          className="w-full rounded-3xl border border-white/5 bg-white/[0.02] p-5 text-left transition hover:border-white/15 hover:bg-white/[0.04]"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-300">
                                <ShoppingBag className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="text-base font-bold text-white">{order.invoiceCode || `Order #${order.orderId}`}</p>
                                <p className="mt-1 text-sm text-slate-400">{`Order #${order.orderId}`}</p>
                                <p className="mt-1 text-xs font-semibold text-slate-500">
                                  Bought: {formatDateTime(order.paidAt)}
                                </p>
                              </div>
                            </div>
                            <span className={orderStatus.badgeClass}>
                              {orderStatus.label}
                            </span>
                          </div>
                        </button>
                        )
                      })
                    )}
                  </div>

                  <PaginationControls
                    currentPage={orderPage}
                    totalPages={orderTotalPages}
                    onPageChange={setOrderPage}
                    tone="dark"
                  />
                </>
              ) : (
                <section className="space-y-6">
                  <div className="rounded-3xl border border-gym-500/20 bg-gym-500/5 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white">
                          <UserRound className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xl font-bold text-white">{selectedOrder.invoiceCode || `Order #${selectedOrder.orderId}`}</p>
                          <p className="mt-1 text-sm text-slate-400">{`Order #${selectedOrder.orderId}`}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            Bought: {formatDateTime(selectedOrder.paidAt)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedOrderId(null)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
                      >
                        <X className="h-4 w-4" />
                        Change order
                      </button>
                    </div>
                  </div>

                  <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                    <div className="grid gap-3 md:grid-cols-4">
                      <InfoTile label="Bought date" value={formatDateTime(selectedOrder.paidAt)} />
                      <InfoTile label="Payment" value={selectedOrder.paymentMethod || '-'} />
                      <InfoTile label="Status" value={selectedOrderStatus.label} />
                      <InfoTile label="Total paid" value={formatMoney(selectedOrder.totalAmount, selectedOrder.currency)} />
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-gym-500" />
                        <h3 className="text-base font-bold uppercase tracking-tight text-white">Order details</h3>
                      </div>
                      <span className={selectedOrderStatus.badgeClass}>
                        {selectedOrderStatus.detail}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <InfoTile label="Coupon used" value={selectedOrder.promoCode || 'No coupon used'} />
                      <InfoTile label="Total before" value={formatMoney(selectedOrder.subtotal, selectedOrder.currency)} />
                      <InfoTile label="Total after" value={formatMoney(selectedOrder.totalAmount, selectedOrder.currency)} />
                    </div>

                    <div className="mt-5 space-y-3">
                      {(selectedOrder.items || []).map((item) => (
                        <div key={`${selectedOrder.orderId}-${item.productId}`} className="rounded-2xl border border-white/5 bg-black/20 px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{item.name}</p>
                              <p className="mt-1 text-xs text-slate-500">Quantity: {item.quantity}</p>
                              {selectedOrder.pickedUpAt ? (
                                item.hasReview ? (
                                  <div className="mt-2 space-y-1">
                                    <p className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
                                      <Star className="h-3.5 w-3.5 fill-current" />
                                      {Number(item.reviewRating || 0).toFixed(1)} / 5
                                    </p>
                                    <p className="text-xs text-slate-400">{item.reviewComment || 'No written comment.'}</p>
                                  </div>
                                ) : (
                                  <p className="mt-2 text-xs text-slate-400">Leave a review now that pickup is confirmed.</p>
                                )
                              ) : (
                                <p className="mt-2 text-xs text-slate-500">Review unlocks after the receptionist confirms pickup.</p>
                              )}
                            </div>
                            <div className="space-y-3 text-right">
                              <p className="text-xs text-slate-500">Unit price: {formatMoney(item.unitPrice, selectedOrder.currency)}</p>
                              <p className="mt-1 text-sm font-semibold text-white">
                                {formatMoney(Number(item.unitPrice || 0) * Number(item.quantity || 0), selectedOrder.currency)}
                              </p>
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openReviewModal(item)}
                                  disabled={!selectedOrder.pickedUpAt}
                                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                                    selectedOrder.pickedUpAt
                                      ? 'border border-gym-500/30 bg-gym-500/10 text-gym-300 hover:bg-gym-500/20'
                                      : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-500'
                                  }`}
                                >
                                  {item.hasReview ? 'Edit review' : 'Leave review'}
                                </button>
                                {item.hasReview ? (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget({ productId: item.productId, productName: item.name })}
                                    disabled={!selectedOrder.pickedUpAt}
                                    className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                                      selectedOrder.pickedUpAt
                                        ? 'border border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20'
                                        : 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-500'
                                    }`}
                                  >
                                    Delete review
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </section>
              )}
            </section>
          )}
        </section>
      </div>

      {reviewModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#12131a] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-gym-400">
                  {reviewModal.mode === 'edit' ? 'Edit review' : 'Leave review'}
                </p>
                <h3 className="mt-2 text-xl font-black text-white">{reviewModal.productName}</h3>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                disabled={reviewMutation.isPending}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submitReview}>
              <div>
                <label htmlFor="product-review-rating" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Rating
                </label>
                <select
                  id="product-review-rating"
                  value={reviewModal.rating}
                  onChange={(event) => setReviewModal((prev) => ({ ...prev, rating: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-gym-500 focus:outline-none"
                  disabled={reviewMutation.isPending}
                >
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating} className="bg-slate-900 text-white">
                      {rating} star{rating > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="product-review-comment" className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                  Comment
                </label>
                <textarea
                  id="product-review-comment"
                  value={reviewModal.comment}
                  onChange={(event) => setReviewModal((prev) => ({ ...prev, comment: event.target.value }))}
                  className="mt-2 min-h-[140px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-gym-500 focus:outline-none"
                  placeholder="Share your experience with this product."
                  disabled={reviewMutation.isPending}
                />
              </div>

              {reviewError ? <p className="text-sm text-red-300">{reviewError}</p> : null}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={closeReviewModal}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                  disabled={reviewMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-gym-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-gym-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={reviewMutation.isPending}
                >
                  {reviewMutation.isPending
                    ? 'Saving...'
                    : reviewModal.mode === 'edit'
                      ? 'Update review'
                      : 'Submit review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#12131a] p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Delete review</p>
            <h3 className="mt-2 text-xl font-black text-white">{deleteTarget.productName}</h3>
            <p className="mt-3 text-sm text-slate-400">This will remove your product review from the order history and product page.</p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10"
                disabled={deleteReviewMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteReviewMutation.mutate({ productId: deleteTarget.productId })}
                className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={deleteReviewMutation.isPending}
              >
                {deleteReviewMutation.isPending ? 'Deleting...' : 'Confirm delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </WorkspaceScaffold>
  )
}

export default CustomerOrderHistoryPage
