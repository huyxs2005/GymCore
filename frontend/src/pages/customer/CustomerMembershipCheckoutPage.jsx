import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, CreditCard, Ticket, WalletCards } from 'lucide-react'
import { toast } from 'react-hot-toast'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { membershipApi } from '../../features/membership/api/membershipApi'
import { promotionApi } from '../../features/promotion/api/promotionApi'
import { useSession } from '../../features/auth/useSession'
import {
  buildActiveWarningMessage,
  checkoutModeLabel,
  formatDurationLabel,
  formatDurationWithCoupon,
  inferCheckoutMode,
} from '../../features/membership/utils/membershipCheckout'

function formatClaimBenefit(claim) {
  const discountPercent = Number(claim.DiscountPercent || claim.discountPercent || 0)
  const discountAmount = Number(claim.DiscountAmount || claim.discountAmount || 0)
  const bonusMonths = Number(claim.BonusDurationMonths || claim.bonusDurationMonths || 0)
  const parts = []
  if (discountPercent > 0) parts.push(`${discountPercent}% off`)
  else if (discountAmount > 0) parts.push(`${discountAmount.toLocaleString('en-US')} VND off`)
  if (bonusMonths > 0) parts.push(`+${bonusMonths} month${bonusMonths > 1 ? 's' : ''}`)
  return parts.join(' + ') || 'No benefit'
}

function CustomerMembershipCheckoutPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useSession()
  const userId = user?.userId ?? null
  const [selectedPromoCode, setSelectedPromoCode] = useState('')
  const [couponPreview, setCouponPreview] = useState(null)
  const [couponPreviewError, setCouponPreviewError] = useState('')
  const [checkoutWarning, setCheckoutWarning] = useState(null)

  const selectedPlanId = Number(searchParams.get('planId') || 0)

  const plansQuery = useQuery({
    queryKey: ['membershipPlans'],
    queryFn: membershipApi.getPlans,
  })

  const currentMembershipQuery = useQuery({
    queryKey: ['membershipCurrent'],
    queryFn: membershipApi.getCurrentMembership,
  })

  const claimsQuery = useQuery({
    queryKey: ['myClaims', userId],
    queryFn: promotionApi.getMyClaims,
    enabled: Boolean(userId),
  })

  const plans = useMemo(() => plansQuery.data?.data?.plans ?? [], [plansQuery.data])
  const currentMembership = currentMembershipQuery.data?.data?.membership ?? {}
  const membershipCoupons = useMemo(
    () =>
      (claimsQuery.data?.claims ?? []).filter(
        (claim) => !claim.UsedAt && String(claim.ApplyTarget || '').toUpperCase() === 'MEMBERSHIP',
      ),
    [claimsQuery.data],
  )

  const selectedPlan = useMemo(
    () => plans.find((plan) => Number(plan.planId) === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  const checkoutMode = selectedPlan ? inferCheckoutMode(selectedPlan, currentMembership) : 'PURCHASE'
  const hasActiveMembership = String(currentMembership?.status || '').toUpperCase() === 'ACTIVE'

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

  const checkoutMutation = useMutation({
    mutationFn: ({ mode, planId, promoCode }) => {
      const payload = {
        planId,
        paymentMethod: 'PAYOS',
        returnUrl: `${window.location.origin}/customer/membership`,
        cancelUrl: `${window.location.origin}/customer/membership?status=CANCELLED`,
        promoCode: promoCode || undefined,
      }
      if (mode === 'RENEW') return membershipApi.renew(payload)
      if (mode === 'UPGRADE') return membershipApi.upgrade(payload)
      return membershipApi.purchase(payload)
    },
    onSuccess: (response) => {
      const checkoutUrl = response?.data?.checkoutUrl
      const completedWithoutPayment = response?.data?.completedWithoutPayment
      if (checkoutUrl) {
        window.location.href = checkoutUrl
        return
      }
      if (completedWithoutPayment) {
        toast.success(response?.data?.message || 'Membership activated successfully.')
        navigate('/customer/membership?status=SUCCESS', { replace: true })
        return
      }
      toast.error('Checkout URL not found in API response. Please check backend logs.')
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.message || 'Membership checkout failed.'
      toast.error(message)
    },
  })

  const handlePromoCodeChange = (promoCode) => {
    setSelectedPromoCode(promoCode)
    setCouponPreview(null)
    setCouponPreviewError('')
    if (!promoCode || !selectedPlan) return
    previewCouponMutation.mutate({
      promoCode,
      target: 'MEMBERSHIP',
      subtotal: Number(selectedPlan.price || 0),
    })
  }

  const handleProceedPayment = () => {
    if (!selectedPlan) return
    if (hasActiveMembership) {
      setCheckoutWarning({
        mode: checkoutMode,
        message: buildActiveWarningMessage(checkoutMode, currentMembership, selectedPlan),
      })
      return
    }
    checkoutMutation.mutate({
      mode: checkoutMode,
      planId: selectedPlan.planId,
      promoCode: selectedPromoCode,
    })
  }

  const confirmCheckoutAfterWarning = () => {
    if (!selectedPlan || !checkoutWarning?.mode) {
      setCheckoutWarning(null)
      return
    }
    const mode = checkoutWarning.mode
    setCheckoutWarning(null)
    checkoutMutation.mutate({
      mode,
      planId: selectedPlan.planId,
      promoCode: selectedPromoCode,
    })
  }

  const basePrice = Number(selectedPlan?.price || 0)
  const estimatedDiscount = Number(couponPreview?.estimatedDiscount || 0)
  const finalAmount = couponPreview?.estimatedFinalAmount != null
    ? Number(couponPreview.estimatedFinalAmount)
    : basePrice
  const bonusMonths = Number(couponPreview?.bonusDurationMonths || 0)

  return (
    <WorkspaceScaffold showHeader={false} links={customerNav}>
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate('/customer/membership')}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Back to membership
          </button>
        </div>

        {!selectedPlan ? (
          <div className="rounded-3xl border border-white/10 bg-[#14141c] p-8 text-center">
            <p className="text-lg font-bold text-white">No membership plan selected.</p>
            <p className="mt-2 text-sm text-slate-400">Go back and choose a plan first.</p>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            <section>
              <article className="group relative flex min-h-[580px] flex-col overflow-hidden rounded-3xl border border-emerald-500/50 bg-emerald-500/[0.08] p-7 text-left shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] ring-1 ring-white/10">
                <div className="flex flex-col">
                  <div className="flex items-start justify-between min-h-[60px] mb-4 gap-3">
                    <h2 className="text-xl font-black tracking-tight text-white leading-tight pr-4">{selectedPlan.name}</h2>
                    <span className="shrink-0 mt-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-emerald-400 h-fit">
                      {checkoutModeLabel[checkoutMode]}
                    </span>
                  </div>

                  <div className="min-h-[80px] flex items-center mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black tracking-tighter text-white flex items-start">
                        <span className="text-lg font-bold text-slate-500 mt-1 mr-1">₫</span>
                        {basePrice.toLocaleString('en-US')}
                      </span>
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] font-bold text-slate-500 tracking-wide">VND /</span>
                        <span className="text-[10px] font-bold text-slate-400">{formatDurationLabel(selectedPlan.durationDays)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-[50px] mb-4">
                    <p className="text-[12px] font-bold text-slate-300 leading-relaxed border-l-2 border-emerald-500/30 pl-3 py-0.5">
                      {hasActiveMembership
                        ? buildActiveWarningMessage(checkoutMode, currentMembership, selectedPlan)
                        : 'Your selected membership will start after successful payment confirmation.'}
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-5">
                  <ul className="space-y-3.5">
                    <li className="flex gap-3 items-start">
                      <div className="mt-0.5 rounded-full p-0.5 shadow-sm bg-emerald-500/20 text-emerald-400">
                        <Check size={14} strokeWidth={3} />
                      </div>
                      <span className="text-[12px] font-bold leading-relaxed text-slate-100">Mode: {checkoutModeLabel[checkoutMode]}</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <div className="mt-0.5 rounded-full p-0.5 shadow-sm bg-emerald-500/20 text-emerald-400">
                        <Check size={14} strokeWidth={3} />
                      </div>
                      <span className="text-[12px] font-bold leading-relaxed text-slate-100">Duration: {formatDurationWithCoupon(selectedPlan.durationDays, bonusMonths)}</span>
                    </li>
                    <li className="flex gap-3 items-start">
                      <div className="mt-0.5 rounded-full p-0.5 shadow-sm bg-emerald-500/20 text-emerald-400">
                        <Check size={14} strokeWidth={3} />
                      </div>
                      <span className="text-[12px] font-bold leading-relaxed text-slate-100">Coupon support: price discount and bonus months are both reflected below.</span>
                    </li>
                  </ul>
                </div>
              </article>
            </section>

            <aside className="min-h-[580px] rounded-[2rem] border border-white/10 bg-[#14141c] p-8">
              <div className="flex items-center gap-3 text-white">
                <CreditCard size={18} />
                <p className="text-xs font-black uppercase tracking-[0.25em] text-white">Payment summary</p>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white">Plan</span>
                  <span className="font-bold text-white">{selectedPlan.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white">Months / duration</span>
                  <span className="font-bold text-white">{formatDurationWithCoupon(selectedPlan.durationDays, bonusMonths)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white">Base price</span>
                  <span className="font-bold text-white">{basePrice.toLocaleString('en-US')} VND</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white">Coupon discount</span>
                  <span className="font-bold text-gym-400">-{estimatedDiscount.toLocaleString('en-US')} VND</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white">Extra months from coupon</span>
                  <span className="font-bold text-gym-400">{bonusMonths > 0 ? `+${bonusMonths}` : '0'}</span>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Total to pay</span>
                    <span className="text-3xl font-black text-white">{finalAmount.toLocaleString('en-US')} VND</span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-white">Apply coupon</p>
                <div className="relative">
                  <select
                    value={selectedPromoCode}
                    onChange={(event) => handlePromoCodeChange(event.target.value)}
                    className="w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 pr-12 text-sm font-black text-white outline-none transition hover:bg-white/10 focus:border-gym-500"
                  >
                    <option value="">No coupon selected</option>
                    {membershipCoupons.map((claim) => (
                      <option key={claim.ClaimID || claim.claimId} value={claim.PromoCode || claim.promoCode} className="bg-[#12121a] text-white">
                        {(claim.PromoCode || claim.promoCode)} • {formatClaimBenefit(claim)}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Ticket size={16} />
                  </div>
                </div>
              </div>

              {selectedPromoCode ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Selected coupon</p>
                      <p className="mt-2 text-base font-black text-white">{selectedPromoCode}</p>
                      <p className="mt-1 text-xs font-semibold text-gym-400">
                        {bonusMonths > 0 ? `+${bonusMonths} month${bonusMonths > 1 ? 's' : ''}` : 'No bonus months'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPromoCode('')
                        setCouponPreview(null)
                        setCouponPreviewError('')
                      }}
                      className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                  {previewCouponMutation.isPending ? (
                    <p className="mt-3 text-sm text-amber-400">Checking coupon effect...</p>
                  ) : null}
                  {couponPreviewError ? (
                    <p className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400">
                      {couponPreviewError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleProceedPayment}
                disabled={checkoutMutation.isPending}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gym-600 px-6 py-4 text-sm font-black text-white transition hover:bg-gym-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checkoutMutation.isPending ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <WalletCards size={16} />
                    Continue to payment
                  </>
                )}
              </button>
            </aside>
          </div>
        )}
      </div>

      {checkoutWarning ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-amber-500/20 bg-[#12121a] shadow-2xl">
            <div className="border-b border-amber-500/20 bg-amber-500/10 p-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/30">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-amber-400">Action required</h3>
            </div>
            <div className="p-6">
              <p className="text-center text-sm font-medium leading-7 text-slate-300">{checkoutWarning.message}</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.2em] text-slate-300">
                Mode: {checkoutModeLabel[checkoutWarning.mode]}
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCheckoutWarning(null)}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-slate-200 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmCheckoutAfterWarning}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-400"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </WorkspaceScaffold>
  )
}

export default CustomerMembershipCheckoutPage
