import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CreditCard, Dumbbell, ShieldCheck, Sparkles, Ticket } from 'lucide-react'
import { toast } from 'react-hot-toast'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { membershipApi } from '../../features/membership/api/membershipApi'
import { promotionApi } from '../../features/promotion/api/promotionApi'

const planTypeMeta = {
  DAY_PASS: {
    label: 'Day Pass',
    headline: 'Quick access for a single training day',
    accent: 'from-amber-500/15 via-white to-orange-500/10',
    border: 'border-amber-200',
    button: 'bg-amber-500 text-white',
    tone: 'text-amber-700',
    icon: Ticket,
    benefits: [
      'One-day front desk check-in access',
      'Best for trial visits and occasional drop-ins',
      'No long-term commitment or PT booking included',
    ],
  },
  GYM_ONLY: {
    label: 'Gym Only',
    headline: 'Standard membership for consistent self-training',
    accent: 'from-sky-500/15 via-white to-cyan-500/10',
    border: 'border-sky-200',
    button: 'bg-sky-600 text-white',
    tone: 'text-sky-700',
    icon: ShieldCheck,
    benefits: [
      'Full gym floor access for the selected duration',
      'Receptionist check-in and health tracking support',
      'Best fit if you train independently without PT sessions',
    ],
  },
  GYM_PLUS_COACH: {
    label: 'Gym + Coach',
    headline: 'Premium plan with personal training booking access',
    accent: 'from-emerald-500/18 via-white to-teal-500/12',
    border: 'border-emerald-200',
    button: 'bg-gym-600 text-white',
    tone: 'text-emerald-700',
    icon: Dumbbell,
    benefits: [
      'Includes full gym membership access',
      'Unlocks coach matching and PT booking requests',
      'Best for members who want guided progress and follow-up',
    ],
  },
}

const checkoutModeLabel = {
  PURCHASE: 'Purchase',
  RENEW: 'Renew',
  UPGRADE: 'Upgrade',
}

function normalizePlanType(planType) {
  return String(planType || '')
    .trim()
    .toUpperCase()
}

function formatDurationLabel(durationDays) {
  const days = Number(durationDays || 0)
  if (days <= 1) return '1 day'
  if (days >= 365 * 2) return '24 months'
  if (days >= 365) return '12 months'
  if (days >= 180) return '6 months'
  if (days >= 30) return '1 month'
  return `${days} days`
}

function inferCheckoutMode(selectedPlan, currentMembership) {
  const membershipStatus = String(currentMembership?.status || '').toUpperCase()
  const currentPlanId = Number(currentMembership?.plan?.planId || 0)
  const selectedPlanId = Number(selectedPlan?.planId || 0)
  if (membershipStatus === 'EXPIRED' && currentPlanId > 0 && currentPlanId === selectedPlanId) {
    return 'RENEW'
  }
  if (membershipStatus !== 'ACTIVE') {
    return 'PURCHASE'
  }

  const currentPlanType = normalizePlanType(currentMembership?.plan?.planType)
  const selectedPlanType = normalizePlanType(selectedPlan?.planType)

  // Day pass should always finish first; next purchase becomes queued.
  if (currentPlanType === 'DAY_PASS') {
    return 'RENEW'
  }

  if (currentPlanType && selectedPlanType && currentPlanType === selectedPlanType) {
    return 'RENEW'
  }

  if (currentPlanType === 'GYM_ONLY' && selectedPlanType === 'GYM_PLUS_COACH') {
    return 'UPGRADE'
  }

  // Other active-plan switches are treated as queued change at period end.
  return 'RENEW'
}

function buildActiveWarningMessage(mode, currentMembership, selectedPlan) {
  const currentName = currentMembership?.plan?.name || 'current membership'
  const selectedName = selectedPlan?.name || 'selected plan'
  const currentPlanType = normalizePlanType(currentMembership?.plan?.planType)
  const selectedPlanType = normalizePlanType(selectedPlan?.planType)

  if (mode === 'RENEW' && currentPlanType === 'DAY_PASS' && selectedPlanType !== 'DAY_PASS') {
    return `You currently have an ACTIVE Day Pass (${currentName}). If you continue, ${selectedName} will take effect after the Day Pass expires.`
  }

  if (mode === 'RENEW') {
    return `You already have an ACTIVE membership (${currentName}). If you continue, ${selectedName} will be queued to start after your current membership ends (renew flow).`
  }

  return `You already have an ACTIVE membership (${currentName}). If you continue, your current membership will end today and ${selectedName} starts today (upgrade flow).`
}

function CustomerMembershipPage() {
  const queryClient = useQueryClient()
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('DAY_PASS')
  const [selectionTouched, setSelectionTouched] = useState(false)
  const [checkoutWarning, setCheckoutWarning] = useState(null)
  const [selectedPromoCode, setSelectedPromoCode] = useState('')
  const [couponPreview, setCouponPreview] = useState(null)
  const [couponPreviewError, setCouponPreviewError] = useState('')
  const [showSuccessMessage, setShowSuccessMessage] = useState(() => {
    const status = new URLSearchParams(window.location.search).get('status')
    const normalizedStatus = status ? status.trim().toUpperCase() : ''
    return normalizedStatus === 'PAID' || normalizedStatus === 'SUCCESS'
  })

  const plansQuery = useQuery({
    queryKey: ['membershipPlans'],
    queryFn: membershipApi.getPlans,
  })

  const currentMembershipQuery = useQuery({
    queryKey: ['membershipCurrent'],
    queryFn: membershipApi.getCurrentMembership,
  })

  const claimsQuery = useQuery({
    queryKey: ['myClaims'],
    queryFn: promotionApi.getMyClaims,
  })

  const plans = useMemo(() => plansQuery.data?.data?.plans ?? [], [plansQuery.data])
  const currentMembership = currentMembershipQuery.data?.data?.membership ?? {}
  const queuedMembership = currentMembershipQuery.data?.data?.queuedMembership ?? null
  const membershipCoupons = useMemo(
    () => (claimsQuery.data?.claims ?? []).filter(
      (claim) => !claim.UsedAt && String(claim.ApplyTarget || '').toUpperCase() === 'MEMBERSHIP',
    ),
    [claimsQuery.data],
  )
  const validForCheckin = Boolean(currentMembershipQuery.data?.data?.validForCheckin)
  const invalidReason = currentMembershipQuery.data?.data?.reason || ''
  const hasActiveMembership = String(currentMembership?.status || '').toUpperCase() === 'ACTIVE'
  const hasQueuedMembership = Boolean(queuedMembership && Object.keys(queuedMembership).length > 0)

  const plansByCategory = useMemo(
    () =>
      plans.reduce(
        (acc, plan) => {
          const key = normalizePlanType(plan.planType)
          if (acc[key]) {
            acc[key].push(plan)
          }
          return acc
        },
        { DAY_PASS: [], GYM_ONLY: [], GYM_PLUS_COACH: [] },
      ),
    [plans],
  )

  const availableCategories = useMemo(
    () => Object.keys(planTypeMeta).filter((key) => (plansByCategory[key] ?? []).length > 0),
    [plansByCategory],
  )

  const preferredCategory = normalizePlanType(currentMembership?.plan?.planType)
  const activeCategory = selectionTouched
    ? (availableCategories.includes(selectedCategory) ? selectedCategory : (availableCategories[0] ?? 'DAY_PASS'))
    : (availableCategories.includes(preferredCategory)
        ? preferredCategory
        : (availableCategories.includes(selectedCategory) ? selectedCategory : (availableCategories[0] ?? 'DAY_PASS')))

  const visiblePlans = useMemo(
    () => plansByCategory[activeCategory] ?? [],
    [activeCategory, plansByCategory],
  )

  const preferredPlanId = selectionTouched
    ? selectedPlanId
    : Number(currentMembership?.plan?.planId || selectedPlanId || 0)

  const activeSelectedPlanId = visiblePlans.some((plan) => plan.planId === preferredPlanId)
    ? preferredPlanId
    : (visiblePlans[0]?.planId ?? null)

  const selectedPlan = useMemo(
    () => visiblePlans.find((plan) => plan.planId === activeSelectedPlanId) ?? null,
    [activeSelectedPlanId, visiblePlans],
  )

  const planColumns = useMemo(
    () =>
      Object.entries(planTypeMeta).map(([key, meta]) => {
        const categoryPlans = plansByCategory[key] ?? []
        const fallbackPlan = categoryPlans[0] ?? null
        const chosenPlan = categoryPlans.find((plan) => plan.planId === selectedPlanId) ?? null
        const activePlan = selectedCategory === key ? chosenPlan ?? fallbackPlan : fallbackPlan
        return {
          key,
          meta,
          plans: categoryPlans,
          activePlan,
          selected: selectedCategory === key,
        }
      }),
    [plansByCategory, selectedCategory, selectedPlanId],
  )

  const checkoutMutation = useMutation({
    mutationFn: ({ mode, planId, promoCode }) => {
      const payload = {
        planId,
        paymentMethod: 'PAYOS',
        returnUrl: `${window.location.origin}/customer/membership`,
        cancelUrl: `${window.location.origin}/customer/membership?status=CANCELLED`,
        promoCode: promoCode || undefined,
      }
      if (mode === 'RENEW') {
        return membershipApi.renew(payload)
      }
      if (mode === 'UPGRADE') {
        return membershipApi.upgrade(payload)
      }
      return membershipApi.purchase(payload)
    },
    onSuccess: (response) => {
      const checkoutUrl = response?.data?.checkoutUrl
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      } else {
        toast.error('Checkout URL not found in API response. Please check backend logs.')
      }
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.message || 'Membership checkout failed.'
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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const status = (urlParams.get('status') || '').trim().toUpperCase()
    if (status === 'PAID' || status === 'SUCCESS') {
      const paymentReturnPayload = Object.fromEntries(urlParams.entries())
      membershipApi
        .confirmPaymentReturn(paymentReturnPayload)
        .catch(() => null)
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: ['membershipCurrent'] })
          queryClient.invalidateQueries({ queryKey: ['membershipPlans'] })
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
  }, [queryClient])

  const handleCheckout = () => {
    if (!selectedPlan) {
      return
    }

    const mode = inferCheckoutMode(selectedPlan, currentMembership)
    if (hasActiveMembership) {
      setCheckoutWarning({
        mode,
        message: buildActiveWarningMessage(mode, currentMembership, selectedPlan),
      })
      return
    }

    checkoutMutation.mutate({ mode, planId: selectedPlan.planId, promoCode: selectedPromoCode })
  }

  const confirmCheckoutAfterWarning = () => {
    if (!selectedPlan || !checkoutWarning?.mode) {
      setCheckoutWarning(null)
      return
    }

    const mode = checkoutWarning.mode
    setCheckoutWarning(null)
    checkoutMutation.mutate({ mode, planId: selectedPlan.planId, promoCode: selectedPromoCode })
  }

  const checkoutModePreview = selectedPlan ? inferCheckoutMode(selectedPlan, currentMembership) : null
  const queueLimitReached = hasActiveMembership && hasQueuedMembership
  const checkoutActionLabel = checkoutModePreview ? checkoutModeLabel[checkoutModePreview] : 'Checkout'

  const resetCouponSelection = () => {
    setSelectedPromoCode('')
    setCouponPreview(null)
    setCouponPreviewError('')
  }

  const handlePromoCodeChange = (promoCode) => {
    setSelectedPromoCode(promoCode)
    setCouponPreview(null)
    setCouponPreviewError('')

    if (!promoCode || !selectedPlan) {
      return
    }

    previewCouponMutation.mutate({
      promoCode,
      target: 'MEMBERSHIP',
      subtotal: Number(selectedPlan.price || 0),
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
      parts.push(`${discountAmount.toLocaleString('en-US')} VND off`)
    }
    if (bonusMonths > 0) {
      parts.push(`+${bonusMonths} month${bonusMonths > 1 ? 's' : ''}`)
    }
    return parts.join(' + ') || 'No benefit'
  }

  return (
    <WorkspaceScaffold
      title="Customer Membership"
      subtitle="Browse plans, pay with PayOS, and track your current membership/check-in status."
      links={customerNav}
    >
      {showSuccessMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in rounded-3xl bg-white p-8 text-center shadow-2xl duration-300">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CreditCard size={32} />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-900">Membership Payment Successful</h2>
            <p className="text-slate-600">Your membership status has been refreshed.</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)]">
        <section className="space-y-4 gc-card-compact">
          <header className="flex items-center justify-between gap-2">
            <h2 className="gc-section-kicker">Membership Plans</h2>
            <span className="text-xs text-slate-500">{plans.length} plans</span>
          </header>

          {plansQuery.isLoading && <p className="text-sm text-slate-500">Loading membership plans...</p>}
          {plansQuery.isError && (
            <p className="text-sm text-red-600">Failed to load membership plans. Please try again.</p>
          )}
          {!plansQuery.isLoading && plans.length === 0 && (
            <p className="text-sm text-slate-500">No active plans available.</p>
          )}

          <div className="grid gap-4 xl:grid-cols-3">
            {planColumns.map(({ key, meta, plans: categoryPlans, activePlan, selected }) => {
              const Icon = meta.icon
              return (
                <article
                  key={key}
                  className={`flex min-h-[400px] flex-col rounded-[28px] border bg-gradient-to-br p-5 shadow-sm transition ${
                    selected
                      ? `${meta.border} ${meta.accent} ring-2 ring-offset-2 ring-gym-200`
                      : `border-slate-200 ${meta.accent} hover:border-gym-200`
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!categoryPlans.length) return
                      setSelectedCategory(key)
                      setSelectedPlanId(activePlan?.planId ?? categoryPlans[0]?.planId ?? null)
                      setSelectionTouched(true)
                      resetCouponSelection()
                    }}
                    className="w-full text-left"
                    disabled={!categoryPlans.length}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="gc-section-kicker">{meta.label}</p>
                        <h3 className="mt-2 text-2xl font-bold text-slate-900">{meta.label}</h3>
                        <p className="mt-2 text-sm text-slate-600">{meta.headline}</p>
                      </div>
                      <span className={`rounded-2xl p-3 ${selected ? meta.button : 'bg-white text-slate-700'} shadow-sm`}>
                        <Icon size={20} />
                      </span>
                    </div>
                  </button>

                  <div className="mt-5 rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur">
                    <label
                      htmlFor={`membership-duration-${key}`}
                      className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
                    >
                      Choose duration
                    </label>
                    <select
                      id={`membership-duration-${key}`}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 focus:border-gym-500 focus:outline-none"
                      value={activePlan?.planId ?? ''}
                      onChange={(event) => {
                        const nextPlanId = Number(event.target.value)
                        setSelectedCategory(key)
                        setSelectedPlanId(Number.isNaN(nextPlanId) ? null : nextPlanId)
                        setSelectionTouched(true)
                        resetCouponSelection()
                      }}
                      disabled={!categoryPlans.length}
                    >
                      {!categoryPlans.length && <option value="">No plans available</option>}
                      {categoryPlans.map((plan) => (
                        <option key={plan.planId} value={plan.planId}>
                          {formatDurationLabel(plan.durationDays)} - {Number(plan.price || 0).toLocaleString('en-US')} VND
                        </option>
                      ))}
                    </select>

                    {activePlan ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-900">{activePlan.name}</span>
                          {selected ? (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.button}`}>
                              Selected
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Price</p>
                            <p className={`mt-1 font-bold ${meta.tone}`}>
                              {Number(activePlan.price || 0).toLocaleString('en-US')} VND
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Access</p>
                            <p className="mt-1 font-semibold text-slate-900">
                              {activePlan.allowsCoachBooking ? 'Gym + Coach' : 'Gym access'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate-500">This membership type is not configured yet.</p>
                    )}
                  </div>

                  <div className="mt-5 flex-1 rounded-2xl border border-slate-200 bg-white/85 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className={meta.tone} />
                      <p className="text-sm font-semibold text-slate-900">Benefits</p>
                    </div>
                    <ul className="mt-3 space-y-3 text-sm text-slate-600">
                      {meta.benefits.map((benefit) => (
                        <li key={benefit} className="flex gap-2">
                          <span className={`mt-1 h-2 w-2 rounded-full ${selected ? meta.button : 'bg-slate-300'}`} />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="space-y-4 gc-card-compact">
          <header className="border-b border-slate-100 pb-3">
            <h2 className="gc-section-kicker">Current Membership</h2>
            <p className="mt-1 text-xs text-slate-500">Status below is also used by receptionist check-in validation.</p>
          </header>

          {currentMembershipQuery.isLoading && <p className="text-sm text-slate-500">Loading current membership...</p>}
          {currentMembershipQuery.isError && (
            <p className="text-sm text-red-600">Failed to load current membership status.</p>
          )}

          {!currentMembershipQuery.isLoading && (!currentMembership || Object.keys(currentMembership).length === 0) && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              You do not have any membership yet.
            </div>
          )}

          {!currentMembershipQuery.isLoading && currentMembership && Object.keys(currentMembership).length > 0 && (
            <div className="space-y-3">
              <article className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{currentMembership.plan?.name || 'Membership'}</p>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      currentMembership.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : currentMembership.status === 'PENDING' || currentMembership.status === 'SCHEDULED'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {currentMembership.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Start: {currentMembership.startDate || '-'} - End: {currentMembership.endDate || '-'}
                </p>
                <p className={`text-xs font-medium ${validForCheckin ? 'text-emerald-600' : 'text-amber-700'}`}>
                  {validForCheckin ? 'Valid for QR check-in.' : invalidReason || 'Not valid for check-in yet.'}
                </p>
              </article>

              {queuedMembership && Object.keys(queuedMembership).length > 0 && (
                <article className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Queued next membership</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{queuedMembership.plan?.name || 'Membership'}</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                      {queuedMembership.status || 'SCHEDULED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Starts: {queuedMembership.startDate || '-'} - Ends: {queuedMembership.endDate || '-'}
                  </p>
                  <p className="text-xs font-medium text-amber-700">
                    Your payment was recorded. This plan will appear as active when the current membership period ends.
                  </p>
                </article>
              )}
            </div>
          )}

          <article className="space-y-3 rounded-xl border border-slate-100 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Checkout with PayOS</h3>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-xs text-slate-700">
              <p className="font-semibold text-slate-800">Selected plan</p>
              {selectedPlan ? (
                <p className="mt-1">
                  {selectedPlan.name} - {Number(selectedPlan.price || 0).toLocaleString('en-US')} VND
                </p>
              ) : (
                <p className="mt-1 text-slate-500">Select a plan on the left.</p>
              )}
              {selectedPlan && checkoutModePreview && (
                <p className="mt-2 text-[11px] text-slate-600">
                  Checkout mode will be applied automatically:{' '}
                  <span className="font-semibold">{checkoutModeLabel[checkoutModePreview]}</span>
                </p>
              )}
            </div>

            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
              <label htmlFor="membership-promo-code" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Apply membership coupon
              </label>
              <select
                id="membership-promo-code"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-gym-500 focus:outline-none"
                value={selectedPromoCode}
                onChange={(event) => handlePromoCodeChange(event.target.value)}
                disabled={!selectedPlan}
              >
                <option value="">No coupon applied</option>
                {membershipCoupons.map((claim) => (
                  <option key={claim.ClaimID} value={claim.PromoCode}>
                    {claim.PromoCode} - {formatClaimBenefit(claim)}
                  </option>
                ))}
              </select>
              {membershipCoupons.length === 0 && (
                <p className="text-[11px] text-slate-500">No membership coupons available in your wallet.</p>
              )}
              {previewCouponMutation.isPending && (
                <p className="text-[11px] text-slate-500">Checking coupon...</p>
              )}
              {couponPreview && selectedPromoCode && (
                <p className="rounded-lg border border-gym-100 bg-gym-50 px-2 py-2 text-[11px] text-gym-800">
                  Preview: discount {Number(couponPreview.estimatedDiscount || 0).toLocaleString('en-US')} VND
                  {Number(couponPreview.bonusDurationMonths || 0) > 0
                    ? `, +${Number(couponPreview.bonusDurationMonths)} month${Number(couponPreview.bonusDurationMonths) > 1 ? 's' : ''}`
                    : ''}
                  , total {Number(couponPreview.estimatedFinalAmount || selectedPlan?.price || 0).toLocaleString('en-US')} VND.
                </p>
              )}
              {couponPreviewError && (
                <p className="rounded-lg border border-red-100 bg-red-50 px-2 py-2 text-[11px] text-red-700">
                  {couponPreviewError}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={checkoutMutation.isPending || !selectedPlan || queueLimitReached}
              onClick={handleCheckout}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-gym-700 bg-gym-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-gym-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-400 disabled:text-slate-100"
            >
              <CalendarClock size={16} />
              {checkoutMutation.isPending ? 'Redirecting to PayOS...' : `${checkoutActionLabel} with PayOS`}
            </button>
            {queueLimitReached && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                You already have the maximum of 2 memberships in progress: your current active membership and one queued next membership.
              </p>
            )}
          </article>
        </section>
      </div>

      {checkoutWarning && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertTriangle size={18} />
              </span>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-slate-900">Membership action warning</h3>
                <p className="text-sm text-slate-600">{checkoutWarning.message}</p>
                <p className="text-xs text-slate-500">
                  Continue with <span className="font-semibold">{checkoutModeLabel[checkoutWarning.mode]}</span> checkout?
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCheckoutWarning(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCheckoutAfterWarning}
                className="rounded-lg bg-gym-600 px-3 py-2 text-sm font-semibold text-white hover:bg-gym-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CustomerMembershipPage
