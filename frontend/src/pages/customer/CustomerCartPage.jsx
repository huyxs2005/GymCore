import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CreditCard, Mail, Receipt, ShoppingCart, Ticket, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { authApi } from '../../features/auth/api/authApi'
import { useSession } from '../../features/auth/useSession'
import { cartApi } from '../../features/product/api/cartApi'
import { orderApi } from '../../features/product/api/orderApi'
import { promotionApi } from '../../features/promotion/api/promotionApi'
import { getDynamicProductImage } from '../../features/product/utils/productImageUtils'

function CustomerCartPage() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const userId = user?.userId ?? null
  const cartQueryKey = useMemo(() => ['cart', userId], [userId])
  const claimsQueryKey = useMemo(() => ['myClaims', userId], [userId])
  const profileQueryKey = useMemo(() => ['profile', userId], [userId])

  const [isRecipientModalOpen, setRecipientModalOpen] = useState(false)
  const [checkoutOptions, setCheckoutOptions] = useState({ promoCode: '' })
  const [recipientInfo, setRecipientInfo] = useState(() => ({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    email: user?.email || '',
  }))
  const [couponPreview, setCouponPreview] = useState(null)
  const [couponPreviewError, setCouponPreviewError] = useState('')
  const [showSuccessMessage, setShowSuccessMessage] = useState(() => {
    const status = new URLSearchParams(window.location.search).get('status')
    const normalizedStatus = status ? status.trim().toUpperCase() : ''
    return normalizedStatus === 'PAID' || normalizedStatus === 'SUCCESS'
  })

  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: authApi.getProfile,
    enabled: Boolean(userId),
  })

  const cartQuery = useQuery({
    queryKey: cartQueryKey,
    queryFn: cartApi.getCart,
    enabled: Boolean(userId),
  })

  const { data: claimsData } = useQuery({
    queryKey: claimsQueryKey,
    queryFn: () => promotionApi.getMyClaims(),
    enabled: Boolean(userId),
  })

  const updateCartMutation = useMutation({
    mutationFn: ({ productId, quantity }) => cartApi.updateItem(productId, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey })
    },
  })

  const removeCartItemMutation = useMutation({
    mutationFn: cartApi.removeItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey })
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: orderApi.checkout,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey })
      const checkoutUrl = response?.checkoutUrl
      if (checkoutUrl) {
        window.location.assign(checkoutUrl)
      } else {
        toast.error('Checkout URL not found in API response. Please check backend logs.')
      }
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.message || 'Checkout failed. Please try again.'
      toast.error(message)
    },
  })

  const previewCouponMutation = useMutation({
    mutationFn: (payload) => promotionApi.applyCoupon(payload),
    onSuccess: (response) => {
      setCouponPreviewError('')
      setCouponPreview(response ?? null)
    },
    onError: (error) => {
      setCouponPreview(null)
      setCouponPreviewError(error.response?.data?.message || error.message || 'Unable to preview coupon.')
    },
  })

  const profileUser = profileQuery.data?.user ?? null
  const cart = cartQuery.data ?? { items: [], subtotal: 0, currency: 'VND' }
  const cartItems = useMemo(() => cart.items ?? [], [cart.items])
  const cartItemCount = useMemo(() => cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [cartItems])
  const myClaims = claimsData?.claims || []
  const availableCoupons = myClaims.filter((claim) => !claim.UsedAt)
  const productCoupons = availableCoupons.filter((claim) => String(claim.ApplyTarget || '').toUpperCase() === 'ORDER')
  const membershipOnlyCoupons = availableCoupons.filter((claim) => String(claim.ApplyTarget || '').toUpperCase() === 'MEMBERSHIP')

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const status = (urlParams.get('status') || '').trim().toUpperCase()
    if (status === 'PAID' || status === 'SUCCESS') {
      const paymentReturnPayload = Object.fromEntries(urlParams.entries())
      orderApi
        .confirmPaymentReturn(paymentReturnPayload)
        .then((response) => {
          const invoiceError = response?.invoiceError
          const invoiceCreated = response?.invoiceCreated
          const invoiceEmailSent = response?.invoiceEmailSent
          if (invoiceError) {
            toast.error(`Payment confirmed, but invoice email failed: ${invoiceError}`)
            return
          }
          if (invoiceCreated === false || invoiceEmailSent === false) {
            toast.error('Payment was confirmed, but the invoice email was not sent. Please check backend mail configuration.')
          }
        })
        .catch(() => null)
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: cartQueryKey })
        })
      const timer = setTimeout(() => {
        setShowSuccessMessage(false)
        window.history.replaceState({}, document.title, window.location.pathname)
      }, 3000)
      return () => clearTimeout(timer)
    }
    if (status === 'CANCELLED') {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    return undefined
  }, [cartQueryKey, queryClient])

  const handleUpdateCartQty = (productId, quantity) => {
    const nextQuantity = Number(quantity || 0)
    if (nextQuantity <= 0) {
      removeCartItemMutation.mutate(productId)
      return
    }
    updateCartMutation.mutate({ productId, quantity: nextQuantity })
  }

  const handleCheckout = () => {
    if (!cart.items || cart.items.length === 0) return
    setRecipientInfo((prev) => ({
      fullName: prev.fullName || profileUser?.fullName || user?.fullName || '',
      phone: prev.phone || profileUser?.phone || user?.phone || '',
      email: prev.email || profileUser?.email || user?.email || '',
    }))
    setRecipientModalOpen(true)
  }

  const handleConfirmCheckout = () => {
    checkoutMutation.mutate({
      paymentMethod: 'PAYOS',
      promoCode: checkoutOptions.promoCode,
      fullName: recipientInfo.fullName,
      phone: recipientInfo.phone,
      email: recipientInfo.email,
    })
    setRecipientModalOpen(false)
  }

  const handlePromoCodeChange = (promoCode) => {
    setCheckoutOptions((prev) => ({ ...prev, promoCode }))
    setCouponPreview(null)
    setCouponPreviewError('')
    if (!promoCode) return
    previewCouponMutation.mutate({
      promoCode,
      target: 'ORDER',
      subtotal: Number(cart.subtotal || 0),
    })
  }

  const formatClaimBenefit = (claim) => {
    const discountPercent = Number(claim.DiscountPercent || 0)
    const discountAmount = Number(claim.DiscountAmount || 0)
    const bonusMonths = Number(claim.BonusDurationMonths || 0)
    const parts = []
    if (discountPercent > 0) {
      parts.push(`${discountPercent}% off`)
    } else if (discountAmount > 0) {
      parts.push(`${discountAmount.toLocaleString()} VND off`)
    }
    if (bonusMonths > 0) {
      parts.push(`+${bonusMonths} membership month${bonusMonths > 1 ? 's' : ''}`)
    }
    return parts.length > 0 ? parts.join(' + ') : 'No benefit'
  }

  return (
    <WorkspaceScaffold
      title="Your Cart"
      subtitle="Review supplement items, apply an order coupon, and confirm your receipt details before PayOS checkout."
      links={customerNav}
    >
      {showSuccessMessage ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in rounded-3xl bg-white p-8 text-center shadow-2xl duration-300">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Receipt size={32} />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-900">Order Successful!</h2>
            <p className="text-slate-600">Your payment was confirmed. Check your email or order history for the order ID, then bring it to the gym front desk for pickup.</p>
          </div>
        </div>
      ) : null}

      <RecipientModal
        checkoutPending={checkoutMutation.isPending}
        info={recipientInfo}
        open={isRecipientModalOpen}
        onCancel={() => setRecipientModalOpen(false)}
        onChange={setRecipientInfo}
        onConfirm={handleConfirmCheckout}
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/customer/shop" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <ArrowLeft size={16} />
          Back to catalog
        </Link>
        <Link to="/customer/orders" className="inline-flex items-center gap-2 rounded-full border border-gym-200 bg-gym-50 px-4 py-2 text-sm font-semibold text-gym-700 hover:bg-gym-100">
          View buying history
        </Link>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <article className="gc-card-compact space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="gc-section-kicker">Cart items</p>
              <p className="mt-1 text-sm text-slate-500">{cartItemCount} item(s) ready for checkout.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {Number(cart.subtotal || 0).toLocaleString('en-US')} {cart.currency || 'VND'} subtotal
            </div>
          </header>

          {cartQuery.isLoading ? <p className="text-sm text-slate-500">Loading cart...</p> : null}
          {cartQuery.isError ? <p className="text-sm text-rose-600">Could not load cart.</p> : null}
          {!cartQuery.isLoading && cartItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Your cart is empty. Go back to the product catalog and add supplements first.
            </div>
          ) : null}

          <div className="space-y-3">
            {cartItems.map((item) => (
              <article key={item.productId} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-1 items-start gap-3 min-w-0">
                    <img src={getDynamicProductImage(item.name)} alt={item.name} className="h-14 w-14 rounded-xl object-cover border border-slate-200" />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{Number(item.price || 0).toLocaleString('en-US')} VND / unit</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeCartItemMutation.mutate(item.productId)} className="text-[11px] font-medium text-rose-600 hover:text-rose-700">
                    Remove
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-sm">
                    <button type="button" onClick={() => handleUpdateCartQty(item.productId, Number(item.quantity || 0) - 1)} className="rounded-full px-2 text-slate-500 hover:text-slate-900">-</button>
                    <span className="min-w-[2rem] text-center font-semibold text-slate-800">{item.quantity}</span>
                    <button type="button" onClick={() => handleUpdateCartQty(item.productId, Number(item.quantity || 0) + 1)} className="rounded-full px-2 text-slate-500 hover:text-slate-900">+</button>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{Number(item.lineTotal || 0).toLocaleString('en-US')} VND</p>
                </div>
              </article>
            ))}
          </div>
        </article>

        <aside className="gc-card-compact space-y-4">
          <header className="border-b border-slate-100 pb-4">
            <p className="gc-section-kicker">Checkout</p>
            <p className="mt-1 text-sm text-slate-500">Apply one order coupon, then continue to PayOS.</p>
          </header>

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold text-slate-900">{Number(cart.subtotal || 0).toLocaleString('en-US')} {cart.currency || 'VND'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Discount</span>
              <span className="font-medium text-gym-600">Calculated at PayOS</span>
            </div>
          </div>

          <div>
            <label htmlFor="cart-page-promo-code" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Apply coupon</label>
            <select id="cart-page-promo-code" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-gym-500 focus:outline-none" value={checkoutOptions.promoCode} onChange={(event) => handlePromoCodeChange(event.target.value)}>
              <option value="">No coupon applied</option>
              {productCoupons.map((claim) => (
                <option key={claim.ClaimID} value={claim.PromoCode}>{claim.PromoCode} - {formatClaimBenefit(claim)}</option>
              ))}
            </select>
            {productCoupons.length === 0 ? <p className="mt-1 text-[10px] text-slate-400">No available coupons in your wallet. Claim some in the Promotions page.</p> : null}
            {membershipOnlyCoupons.length > 0 ? <p className="mt-1 text-[10px] text-amber-600">{membershipOnlyCoupons.length} coupon(s) are membership-only and cannot be used for product checkout.</p> : null}
            {previewCouponMutation.isPending ? <p className="mt-2 text-[11px] text-slate-500">Checking coupon...</p> : null}
            {couponPreview && checkoutOptions.promoCode ? <p className="mt-2 rounded-lg border border-gym-100 bg-gym-50 px-2 py-1 text-[11px] text-gym-800">Preview: discount {Number(couponPreview.estimatedDiscount || 0).toLocaleString()} VND, total {Number(couponPreview.estimatedFinalAmount || cart.subtotal || 0).toLocaleString()} VND.</p> : null}
            {couponPreviewError ? <p className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{couponPreviewError}</p> : null}
          </div>

          <div className="space-y-3 rounded-2xl border border-gym-100 bg-gym-50 p-4 text-sm text-gym-900">
            <div className="flex items-center gap-2 font-semibold">
              <Mail size={16} />
              Receipt details
            </div>
            <p>We will email your receipt and order ID to the account details you confirm before payment.</p>
            <div className="flex items-center gap-2 font-semibold">
              <Ticket size={16} />
              Pickup rule
            </div>
            <p>Bring the order ID to the gym front desk. The receptionist will confirm pickup there.</p>
          </div>

          <button type="button" disabled={checkoutMutation.isPending || cartItems.length === 0} onClick={handleCheckout} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-gym-700 bg-gym-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-gym-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-400 disabled:text-slate-100">
            <CreditCard size={16} />
            {checkoutMutation.isPending ? 'Redirecting to PayOS...' : 'Checkout with PayOS'}
          </button>
        </aside>
      </section>
    </WorkspaceScaffold>
  )
}

function RecipientModal({ open, info, onChange, onCancel, onConfirm, checkoutPending }) {
  if (!open) return null

  const updateField = (field, value) => {
    onChange((prev) => ({ ...prev, [field]: value }))
  }

  const canConfirm = info.fullName.trim().length > 0 && info.email.trim().length > 0

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-400">Pickup receipt</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">Confirm receipt details</h3>
            <p className="mt-2 text-sm text-slate-600">We will email your receipt and order ID here. Bring that order ID to the receptionist for pickup.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" aria-label="Close recipient modal">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full name</span>
            <input type="text" value={info.fullName} onChange={(event) => updateField('fullName', event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-gym-500 focus:bg-white focus:outline-none" placeholder="Account full name" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone (optional)</span>
            <input type="text" value={info.phone} onChange={(event) => updateField('phone', event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-gym-500 focus:bg-white focus:outline-none" placeholder="Contact phone number" />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
            <input type="email" value={info.email} onChange={(event) => updateField('email', event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-gym-500 focus:bg-white focus:outline-none" placeholder="Receipt email address" />
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Back to cart
          </button>
          <button type="button" onClick={onConfirm} disabled={!canConfirm || checkoutPending} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-gym-700 bg-gym-600 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-gym-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-100">
            {checkoutPending ? 'Redirecting to PayOS...' : 'Confirm and pay'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CustomerCartPage
