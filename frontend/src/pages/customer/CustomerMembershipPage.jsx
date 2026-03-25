import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CreditCard, Dumbbell, ShieldCheck, Sparkles, Ticket, Check } from 'lucide-react'
import { toast } from 'react-hot-toast'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { membershipApi } from '../../features/membership/api/membershipApi'
import { promotionApi } from '../../features/promotion/api/promotionApi'

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

  if (currentPlanType === 'DAY_PASS') {
    return 'RENEW'
  }

  if (currentPlanType && selectedPlanType && currentPlanType === selectedPlanType) {
    return 'RENEW'
  }

  if (currentPlanType === 'GYM_ONLY' && selectedPlanType === 'GYM_PLUS_COACH') {
    return 'UPGRADE'
  }

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
    if (!selectedPlan) return

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
      title="Membership Space"
      subtitle="Select a plan, manage your access, and keep your fitness journey active."
      links={customerNav}
    >
      {showSuccessMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
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
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.1fr)]">
        {/* LEFT COLUMN: PLANS */}
        <section className="flex flex-col space-y-5">
          <header className="flex items-center justify-between gap-4 pl-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-100">Membership Plans</h2>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></span>
              <span className="text-xs font-bold text-slate-300">{plans.length} Available</span>
            </div>
          </header>

          {plansQuery.isLoading && (
            <div className="flex h-[400px] items-center justify-center rounded-[2rem] border border-white/5 bg-white/5">
              <p className="animate-pulse text-sm font-medium text-slate-500">Loading premium plans...</p>
            </div>
          )}
          {plansQuery.isError && (
            <div className="rounded-[2rem] border border-red-500/20 bg-red-500/5 p-8 text-center">
              <AlertTriangle className="mx-auto mb-3 text-red-400" size={32} />
              <p className="text-sm font-medium text-red-400">Unable to load plans at this time.</p>
            </div>
          )}
          {!plansQuery.isLoading && plans.length === 0 && (
            <div className="rounded-[2rem] border border-white/5 bg-white/5 p-8 text-center text-slate-400">
              No active plans are currently listed.
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-3">
            {planColumns.map(({ key, meta, plans: categoryPlans, activePlan, selected }) => {
              const Icon = meta.icon
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!categoryPlans.length}
                  onClick={() => {
                    if (!categoryPlans.length) return
                    setSelectedCategory(key)
                    setSelectedPlanId(activePlan?.planId ?? categoryPlans[0]?.planId ?? null)
                    setSelectionTouched(true)
                    resetCouponSelection()
                  }}
                  className={`group relative flex min-h-[460px] flex-col overflow-hidden rounded-[2rem] border p-6 text-left transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-500 ${!categoryPlans.length ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'} ${
                    selected
                      ? `${meta.colors.activeBorder} ${meta.colors.activeBg} scale-[1.02] shadow-ambient`
                      : `${meta.colors.border} ${meta.colors.bg} scale-100 hover:scale-[1.01] hover:shadow-ambient`
                  }`}
                >
                  {/* Card Background Glow */}
                  {selected && (
                    <div className={`absolute -right-20 -top-20 h-40 w-40 rounded-full blur-[80px] bg-${meta.colors.accent}-500/20`} />
                  )}

                  {/* Header Area */}
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-black tracking-tight text-white">{meta.label}</h3>
                      <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-400 line-clamp-2">{meta.headline}</p>
                    </div>
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors duration-300 ${selected ? meta.colors.activeIconBox : meta.colors.iconBox}`}>
                      <Icon size={24} strokeWidth={2.5} />
                    </div>
                  </div>

                  {/* Dropdown Selection Area */}
                  <div className="relative mt-auto pt-6">
                    <label
                      htmlFor={`duration-${key}`}
                      className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-slate-500"
                    >
                      Duration Option
                    </label>
                    <div onClick={(e) => e.stopPropagation()} className="relative">
                      <select
                        id={`duration-${key}`}
                        disabled={!categoryPlans.length}
                        className="gc-input w-full appearance-none pr-10 text-sm font-semibold !text-slate-100 placeholder-slate-500"
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
                            {formatDurationLabel(plan.durationDays)} — {Number(plan.price || 0).toLocaleString('en-US')} VND
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>

                    {activePlan ? (
                      <div className={`mt-4 overflow-hidden rounded-xl border border-white/5 bg-black/20 backdrop-blur-sm transition-all ${selected ? 'ring-1 ring-white/10' : ''}`}>
                        <div className="flex items-center justify-between border-b border-white/5 bg-white/5 px-4 py-3">
                          <span className="truncate pr-4 text-[13px] font-bold text-slate-200">{activePlan.name}</span>
                          {selected ? (
                            <span className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${meta.colors.tag}`}>
                              Selected
                            </span>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-px bg-white/5">
                          <div className="bg-[#101017] p-4 group-hover:bg-[#12121a] transition-colors">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Cost</p>
                            <p className={`mt-1 font-bold tracking-tight ${meta.colors.text}`}>
                              {Number(activePlan.price || 0).toLocaleString('en-US')}₫
                            </p>
                          </div>
                          <div className="bg-[#101017] p-4 group-hover:bg-[#12121a] transition-colors">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Access</p>
                            <p className="mt-1 text-[13px] font-bold text-slate-300">
                              {activePlan.allowsCoachBooking ? 'Full + Coach' : 'Gym Floor Only'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-[13px] text-slate-600">Please choose a different plan type. This option has no active configuration.</p>
                    )}
                  </div>

                  {/* Benefits Area */}
                  <div className="relative mt-6 pt-6 border-t border-white/10">
                    <div className={`flex items-center gap-2 text-[13px] font-bold uppercase tracking-widest ${meta.colors.text}`}>
                      <Sparkles size={14} className="opacity-80" />
                      Key Features
                    </div>
                    <ul className="mt-4 space-y-3 px-1 text-[13px] text-slate-400">
                      {meta.benefits.map((benefit, i) => (
                        <li key={i} className="flex gap-3 leading-relaxed">
                          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${meta.colors.check}`}>
                            <Check size={10} strokeWidth={3} />
                          </span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* RIGHT COLUMN: STATUS & PAYMENT */}
        <section className="flex flex-col space-y-5">
          <header className="pl-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-100">Status & Payment</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-500">Manage your active subscription and checkout.</p>
          </header>

          <div className="gc-glass-panel p-6 shadow-ambient">
            {renderCurrentMembershipCard()}
            
            <hr className="my-6 border-white/10" />

            {/* Checkout Area */}
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-300">
              <CreditCard size={16} className="text-gym-400" />
              Secure Checkout
            </h3>

            <div className="space-y-4">
              {/* Selected Plan Summary */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Ready to Action</p>
                {selectedPlan ? (
                  <div className="mt-2 text-sm">
                    <p className="font-bold text-slate-200">{selectedPlan.name}</p>
                    <p className="mt-0.5 text-gym-400 font-bold">{Number(selectedPlan.price || 0).toLocaleString('en-US')} VND</p>
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] font-medium text-slate-500">No plan selected. Tap a plan on the left.</p>
                )}
                
                {selectedPlan && checkoutModePreview && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-1 text-xs">
                    <span className="font-medium text-slate-400">Mode:</span>
                    <span className="font-bold text-slate-100 tracking-wide uppercase text-[10px]">{checkoutModeLabel[checkoutModePreview]}</span>
                  </div>
                )}
              </div>

              {/* Promo Code selector */}
              <div className="space-y-2">
                <label htmlFor="promo-code" className="block text-[11px] font-bold uppercase tracking-widest text-slate-400">
                  Wallet Coupons
                </label>
                <div className="relative">
                  <select
                    id="promo-code"
                    disabled={!selectedPlan || queueLimitReached}
                    value={selectedPromoCode}
                    onChange={(e) => handlePromoCodeChange(e.target.value)}
                    className="gc-input w-full appearance-none pr-10 text-[13px] font-semibold !text-slate-100 disabled:opacity-50"
                  >
                    <option value="" className="bg-[#12121a]">Optimize without coupon</option>
                    {membershipCoupons.map((claim) => (
                      <option key={claim.ClaimID} value={claim.PromoCode} className="bg-[#12121a]">
                        {claim.PromoCode} • {formatClaimBenefit(claim)}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
                
                {membershipCoupons.length === 0 && (
                  <p className="pl-1 text-xs text-slate-600">No matching coupons in your wallet.</p>
                )}
                {previewCouponMutation.isPending && (
                  <p className="pl-1 text-xs text-amber-500/80">Validating coupon conditions...</p>
                )}
                
                {couponPreview && selectedPromoCode && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs">
                    <p className="font-medium text-emerald-400">Verified Discount: {Number(couponPreview.estimatedDiscount || 0).toLocaleString('en-US')}₫</p>
                    {Number(couponPreview.bonusDurationMonths || 0) > 0 && (
                      <p className="mt-1 font-medium text-emerald-300">Bonus: +{Number(couponPreview.bonusDurationMonths)} month(s) extra</p>
                    )}
                    <hr className="my-2 border-emerald-500/20" />
                    <p className="font-bold text-slate-100">Final Total: {Number(couponPreview.estimatedFinalAmount || selectedPlan?.price || 0).toLocaleString('en-US')}₫</p>
                  </div>
                )}
                {couponPreviewError && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500 font-medium">
                    {couponPreviewError}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={checkoutMutation.isPending || !selectedPlan || queueLimitReached}
                  onClick={handleCheckout}
                  className="gc-button-primary w-full shadow-amber-500/20 disabled:scale-100 disabled:opacity-50 disabled:shadow-none"
                >
                  {checkoutMutation.isPending ? (
                    'Initializing Environment...'
                  ) : (
                    <span className="flex items-center gap-2">
                      <CalendarClock size={16} className={!selectedPlan || queueLimitReached ? 'opacity-50' : 'opacity-100'} />
                      <span className="text-sm font-bold tracking-wide">{checkoutActionLabel} Via PayOS</span>
                    </span>
                  )}
                </button>

                {queueLimitReached && (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                    <p className="text-[11px] font-medium leading-relaxed text-amber-400">
                      Your schedule is fully booked. You already hold maximum concurrent plans (1 Active + 1 Queued). Use what you have before unlocking more power.
                    </p>
                  </div>
                )}
              </div>
            </div>
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
