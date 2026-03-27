import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CreditCard, Dumbbell, ShieldCheck, Sparkles, Ticket, Check, Diamond } from 'lucide-react'
import { toast } from 'react-hot-toast'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { membershipApi } from '../../features/membership/api/membershipApi'
import { promotionApi } from '../../features/promotion/api/promotionApi'
import { useSession } from '../../features/auth/useSession'
import { useNavigate } from 'react-router-dom'
import {
  buildActiveWarningMessage,
  checkoutModeLabel,
  formatDurationLabel,
  inferCheckoutMode,
  normalizePlanType,
} from '../../features/membership/utils/membershipCheckout'
const planTypeMeta = {
  DAY_PASS: {
    label: 'Day Pass',
    headline: 'Quick access for a single training day',
    colors: {
      border: 'border-white/10 group-hover:border-amber-500/30',
      activeBorder: 'border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)] ring-1 ring-amber-500',
      bg: 'bg-white/5 group-hover:bg-amber-500/[0.04]',
      activeBg: 'bg-amber-500/[0.08]',
      iconBox: 'bg-white/5 text-slate-400 group-hover:text-amber-400 group-hover:bg-amber-500/10',
      activeIconBox: 'bg-amber-500 text-amber-950 shadow-[0_0_20px_rgba(245,158,11,0.3)]',
      text: 'text-amber-400',
      check: 'bg-amber-500/20 text-amber-400',
      tag: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    },
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
    colors: {
      border: 'border-white/10 group-hover:border-sky-500/30',
      activeBorder: 'border-sky-500/50 shadow-[0_0_30px_rgba(14,165,233,0.15)] ring-1 ring-sky-500',
      bg: 'bg-white/5 group-hover:bg-sky-500/[0.04]',
      activeBg: 'bg-sky-500/[0.08]',
      iconBox: 'bg-white/5 text-slate-400 group-hover:text-sky-400 group-hover:bg-sky-500/10',
      activeIconBox: 'bg-sky-500 text-sky-950 shadow-[0_0_20px_rgba(14,165,233,0.3)]',
      text: 'text-sky-400',
      check: 'bg-sky-500/20 text-sky-400',
      tag: 'bg-sky-500/10 text-sky-400 border-sky-500/20'
    },
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
    colors: {
      border: 'border-white/10 group-hover:border-emerald-500/30',
      activeBorder: 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500',
      bg: 'bg-white/5 group-hover:bg-emerald-500/[0.04]',
      activeBg: 'bg-emerald-500/[0.08]',
      iconBox: 'bg-white/5 text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-500/10',
      activeIconBox: 'bg-emerald-500 text-emerald-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]',
      text: 'text-emerald-400',
      check: 'bg-emerald-500/20 text-emerald-400',
      tag: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    },
    icon: Dumbbell,
    benefits: [
      'Includes full gym membership access',
      'Unlocks coach matching and PT booking requests',
      'Best for members who want guided progress and follow-up',
    ],
  },
}


function CustomerMembershipPage() {
  const { user } = useSession()
  const userId = user?.userId ?? null
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('DAY_PASS')
  const [selectionTouched, setSelectionTouched] = useState(false)
  const [checkoutWarning, setCheckoutWarning] = useState(null)
  const [selectedPromoCode, setSelectedPromoCode] = useState('')
  const [couponPreview, setCouponPreview] = useState(null)
  const [couponPreviewError, setCouponPreviewError] = useState('')
  const [successCountdown, setSuccessCountdown] = useState(10)
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
    queryKey: ['myClaims', userId],
    queryFn: promotionApi.getMyClaims,
    enabled: Boolean(userId),
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

  function dismissPaymentSuccessOverlay() {
    setShowSuccessMessage(false)
    setSuccessCountdown(10)
    navigate('/customer/coach-booking?tab=match', { replace: true })
  }

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
      setShowSuccessMessage(true)
      setSuccessCountdown(10)
      const paymentReturnPayload = Object.fromEntries(urlParams.entries())
      membershipApi
        .confirmPaymentReturn(paymentReturnPayload)
        .catch(() => null)
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: ['membershipCurrent'] })
          queryClient.invalidateQueries({ queryKey: ['membershipPlans'] })
        })
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    if (status === 'CANCELLED') {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [queryClient])

  useEffect(() => {
    if (!showSuccessMessage) return undefined

    const timer = window.setInterval(() => {
      setSuccessCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          dismissPaymentSuccessOverlay()
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [showSuccessMessage])

  const handleCheckout = (plan) => {
    const targetPlan = plan || selectedPlan
    if (!targetPlan) return
    navigate(`/customer/membership/checkout?planId=${targetPlan.planId}`)
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

    if (!promoCode || !selectedPlan) return

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
    if (discountPercent > 0) parts.push(`${discountPercent}% off`)
    else if (discountAmount > 0) parts.push(`${discountAmount.toLocaleString('en-US')} VND off`)
    if (bonusMonths > 0) parts.push(`+${bonusMonths} month${bonusMonths > 1 ? 's' : ''}`)
    return parts.join(' + ') || 'No benefit'
  }

  const renderCurrentMembershipCard = () => {
    if (currentMembershipQuery.isLoading) {
      return (
        <div className="flex animate-pulse flex-col items-center justify-center rounded-[1.25rem] border border-white/5 bg-white/5 p-8 text-slate-500">
          <div className="mb-3 h-8 w-8 rounded-full bg-slate-700/50" />
          <div className="h-4 w-32 rounded bg-slate-700/50" />
        </div>
      )
    }
    
    if (!currentMembership || Object.keys(currentMembership).length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 bg-white/5 p-8 text-center">
          <ShieldCheck size={32} className="mb-3 text-slate-600" />
          <p className="text-sm font-medium text-slate-400">No active membership</p>
          <p className="mt-1 text-xs text-slate-500">Select a plan from the list to get started.</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <article className="relative overflow-hidden rounded-[1.25rem] border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-5 shadow-ambient sm:p-6">
          <div className="absolute inset-0 bg-white/5 opacity-0 transition hover:opacity-100" />
          <div className="relative flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Active Plan</p>
              <p className="mt-1 text-lg font-bold text-slate-100">{currentMembership.plan?.name || 'Membership'}</p>
            </div>
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                currentMembership.status === 'ACTIVE'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : currentMembership.status === 'PENDING' || currentMembership.status === 'SCHEDULED'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
              }`}
            >
              <div className={`mt-[1px] h-1.5 w-1.5 rounded-full ${currentMembership.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-current'}`} />
              {currentMembership.status}
            </span>
          </div>
          <div className="relative mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-slate-400">
              <div className="flex items-center gap-2">
                <CalendarClock size={14} className="text-slate-500" />
                <span><span className="text-slate-300">Start:</span> {currentMembership.startDate || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock size={14} className="text-slate-500" />
                <span><span className="text-slate-300">End:</span> {currentMembership.endDate || '-'}</span>
              </div>
            </div>
            <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${
              validForCheckin ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400' : 'border-amber-500/20 bg-amber-500/5 text-amber-400'
            }`}>
              <Sparkles size={14} className="mt-0.5 shrink-0" />
              <p>{validForCheckin ? 'Membership is valid. Ready for QR check-in.' : invalidReason || 'Not currently valid for check-in.'}</p>
            </div>
          </div>
        </article>

        {queuedMembership && Object.keys(queuedMembership).length > 0 && (
          <article className="relative overflow-hidden rounded-[1.25rem] border border-amber-500/20 bg-amber-500/5 p-5 shadow-ambient">
            <div className="relative flex items-center justify-between gap-4 border-b border-amber-500/10 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600/70">Queued Next Plan</p>
                <p className="mt-1 text-base font-bold text-amber-400">{queuedMembership.plan?.name || 'Membership'}</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                <div className="mt-[1px] h-1.5 w-1.5 rounded-full bg-amber-400" />
                {queuedMembership.status || 'SCHEDULED'}
              </span>
            </div>
            <div className="relative mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4 text-[11px] font-medium text-amber-600/80">
                <span><span className="text-amber-500">Starts:</span> {queuedMembership.startDate || '-'}</span>
                <span><span className="text-amber-500">Ends:</span> {queuedMembership.endDate || '-'}</span>
              </div>
              <p className="text-[11px] font-medium leading-relaxed text-amber-400/80">
                Your payment was recorded. This plan will kick in automatically when your active membership sequence concludes.
              </p>
            </div>
          </article>
        )}
      </div>
    )
  }

  return (
    <WorkspaceScaffold
      showHeader={false}
      links={customerNav}
    >
      {showSuccessMessage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              dismissPaymentSuccessOverlay()
            }
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              dismissPaymentSuccessOverlay()
            }
          }}
        >
          <div className="animate-in fade-in zoom-in-95 relative w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#12121a] p-8 text-center shadow-2xl duration-300">
            <div className="absolute inset-0 overflow-hidden rounded-[2rem]">
              <div className="absolute -top-[50%] left-[50%] h-[200%] w-[200%] -translate-x-[50%] animate-[spin_10s_linear_infinite] opacity-20">
                <div className="absolute inset-0 bg-[conic-gradient(from_90deg_at_50%_50%,#00000000_50%,#10b981_100%)]"></div>
              </div>
            </div>
            <div className="relative z-10">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 shadow-[0_0_40px_rgba(16,185,129,0.3)] ring-1 ring-emerald-500/30">
                <Check size={32} strokeWidth={3} />
              </div>
              <h2 className="mb-2 text-2xl font-bold text-slate-100">Payment Successful!</h2>
              <p className="text-sm text-slate-400">Your membership space has been updated.</p>
              <p className="mt-3 text-xs font-medium text-slate-500">
                Click outside to continue to PT booking, or this closes in {successCountdown}s.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1200px] px-6 py-6">
        {/* PLANS SECTION */}
        <section className="flex flex-col">

          <div className="grid gap-12 grid-cols-1 lg:grid-cols-3">
            {planColumns.map(({ key, meta, plans: categoryPlans, activePlan, selected }) => {
              const Icon = meta.icon
              const currentMode = activePlan ? inferCheckoutMode(activePlan, currentMembership) : 'PURCHASE'
              const isProcessing = checkoutMutation.isPending && selectedPlanId === activePlan?.planId

              return (
                <article
                  key={key}
                  disabled={!categoryPlans.length}
                  onClick={() => {
                    if (!categoryPlans.length) return
                    setSelectedCategory(key)
                    setSelectedPlanId(activePlan?.planId ?? categoryPlans[0]?.planId ?? null)
                    setSelectionTouched(true)
                    resetCouponSelection()
                  }}
                  className={`group relative flex min-h-[580px] flex-col overflow-hidden rounded-3xl border p-7 text-left transition-all duration-500 ease-out ${!categoryPlans.length ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'} ${
                    selected
                      ? `${meta.colors.activeBorder} ${meta.colors.activeBg} scale-[1.01] z-10 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] ring-1 ring-white/10`
                      : `border-white/5 bg-[#14141c] hover:bg-[#181822] hover:border-white/20`
                  }`}
                >
                  {/* CARD HEADER (COMPACT FOR VISIBILITY) */}
                  <div className="flex flex-col">
                    <div className="flex items-start justify-between min-h-[60px] mb-4 gap-3">
                      <h3 className="text-xl font-black tracking-tight text-white leading-tight pr-4">{meta.label}</h3>
                      {key === 'GYM_PLUS_COACH' && (
                        <span className="shrink-0 mt-1 flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-emerald-400 shadow-glow-sm h-fit">
                          <Diamond size={8} className="fill-emerald-400" />
                          Recommended
                        </span>
                      )}
                    </div>

                    <div className="min-h-[80px] flex items-center mb-4">
                      {activePlan ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black tracking-tighter text-white flex items-start">
                            <span className="text-lg font-bold text-slate-500 mt-1 mr-1">₫</span>
                            {Number(activePlan.price || 0).toLocaleString('en-US')}
                          </span>
                          <div className="flex flex-col leading-none">
                            <span className="text-[10px] font-bold text-slate-500 tracking-wide">VND /</span>
                            <span className="text-[10px] font-bold text-slate-400">{formatDurationLabel(activePlan.durationDays)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-end gap-1 min-h-[50px]">
                          <span className="text-3xl font-black tracking-tight text-slate-700 uppercase">N/A</span>
                        </div>
                      )}
                    </div>

                    <div className="min-h-[50px] mb-4">
                      <p className="text-[12px] font-bold text-slate-300 leading-relaxed border-l-2 border-emerald-500/30 pl-3 py-0.5">
                        {meta.headline}
                      </p>
                    </div>
                  </div>

                  {/* DURATION SELECTOR (COMPACT) */}
                  <div className="min-h-[70px] mb-3 w-full">
                    <div onClick={(e) => e.stopPropagation()} className="relative">
                      <select
                        id={`duration-${key}`}
                        disabled={!categoryPlans.length}
                        className={`w-full appearance-none rounded-lg px-4 py-3 text-left text-[13px] font-black transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/10 ${
                          selected
                            ? 'bg-white/10 text-white border-white/20'
                            : 'bg-white/5 border border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/10'
                        }`}
                        value={activePlan?.planId ?? ''}
                        onChange={(e) => {
                          const nextPlanId = Number(e.target.value)
                          setSelectedCategory(key)
                          setSelectedPlanId(Number.isNaN(nextPlanId) ? null : nextPlanId)
                          setSelectionTouched(true)
                          resetCouponSelection()
                        }}
                      >
                        {!categoryPlans.length && <option value="">Currently Unavailable</option>}
                        {categoryPlans.map((plan) => (
                          <option key={plan.planId} value={plan.planId} className="bg-[#12121a] text-slate-100">
                            {formatDurationLabel(plan.durationDays)} Access Plan
                          </option>
                        ))}
                      </select>
                      {categoryPlans.length > 0 && (
                        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 opacity-70">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* MAIN ACTION BUTTON (COMPACT) */}
                  <div className="min-h-[60px] mb-4">
                    <button
                      type="button"
                      disabled={checkoutMutation.isPending || !activePlan || queueLimitReached}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCategory(key)
                        setSelectedPlanId(activePlan?.planId ?? null)
                        handleCheckout(activePlan)
                      }}
                      className={`w-full py-3.5 rounded-lg font-black text-[13px] shadow-lg transition-all duration-300 flex items-center justify-center gap-2 group/btn ${
                        selected
                          ? 'bg-emerald-600 text-white shadow-emerald-500/20 hover:bg-emerald-500 hover:scale-[1.01] active:scale-[0.98]'
                          : 'bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white active:scale-[0.98]'
                      } disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100`}
                    >
                      {isProcessing ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <>
                          <CreditCard size={16} className="transition-transform group-hover/btn:rotate-6" />
                          <span>{checkoutModeLabel[currentMode]}</span>
                        </>
                      )}
                    </button>
                    {selected && queueLimitReached && (
                      <p className="mt-2 text-[9px] text-center font-black text-amber-500/80 uppercase tracking-widest bg-amber-500/10 py-0.5 rounded-full border border-amber-500/10">
                        Queue Limit
                      </p>
                    )}
                  </div>


                  {/* BENEFITS LIST (COMPACT) */}
                  <div className="border-t border-white/5 pt-5">
                    <ul className="space-y-3.5">
                      {meta.benefits.map((benefit, i) => (
                        <li key={i} className="flex gap-3 items-start">
                          <div className={`mt-0.5 rounded-full p-0.5 shadow-sm ${selected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/30 text-slate-500'}`}>
                            <Check size={14} strokeWidth={3} />
                          </div>
                          <span className={`text-[12px] font-bold leading-relaxed ${selected ? 'text-slate-100' : 'text-slate-400'}`}>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

      </div>

      {checkoutWarning && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-md animate-in zoom-in-95 fade-in duration-200 overflow-hidden rounded-[2rem] border border-amber-500/20 bg-[#12121a] shadow-2xl">
            <div className="bg-amber-500/10 p-6 flex flex-col items-center border-b border-amber-500/20">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/30">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-amber-400">Action Required</h3>
            </div>
            
            <div className="p-6">
              <p className="text-sm font-medium leading-relaxed text-slate-300 text-center">
                {checkoutWarning.message}
              </p>
              
              <div className="mt-6 rounded-xl bg-black/40 p-4">
                <p className="text-center text-xs text-slate-400">
                  You are about to execute a <span className="font-bold text-amber-400 uppercase tracking-wider">{checkoutModeLabel[checkoutWarning.mode]}</span> operation.
                </p>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCheckoutWarning(null)}
                  className="flex-1 gc-button-secondary border-white/10 hover:border-white/20 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmCheckoutAfterWarning}
                  className="flex-1 inline-flex h-11 items-center justify-center rounded-xl bg-amber-500 px-6 font-bold text-slate-950 transition hover:bg-amber-400"
                >
                  Confirm & Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CustomerMembershipPage
