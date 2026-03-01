import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarClock, CreditCard } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { membershipApi } from '../../features/membership/api/membershipApi'

const planTypeMeta = {
  DAY_PASS: { label: 'Day Pass' },
  GYM_ONLY: { label: 'Gym Only' },
  GYM_PLUS_COACH: { label: 'Gym + Coach' },
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

function inferCheckoutMode(selectedPlan, currentMembership) {
  const membershipStatus = String(currentMembership?.status || '').toUpperCase()
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
  const [checkoutWarning, setCheckoutWarning] = useState(null)
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

  const plans = plansQuery.data?.data?.plans ?? []
  const currentMembership = currentMembershipQuery.data?.data?.membership ?? {}
  const validForCheckin = Boolean(currentMembershipQuery.data?.data?.validForCheckin)
  const invalidReason = currentMembershipQuery.data?.data?.reason || ''
  const hasActiveMembership = String(currentMembership?.status || '').toUpperCase() === 'ACTIVE'

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

  const visiblePlans = plansByCategory[selectedCategory] ?? []

  useEffect(() => {
    if ((plansByCategory[selectedCategory] ?? []).length > 0) {
      return
    }

    const fallback = Object.keys(planTypeMeta).find((key) => (plansByCategory[key] ?? []).length > 0)
    if (fallback && fallback !== selectedCategory) {
      setSelectedCategory(fallback)
    }
  }, [plansByCategory, selectedCategory])

  useEffect(() => {
    if (visiblePlans.length === 0) {
      setSelectedPlanId(null)
      return
    }

    const stillVisible = visiblePlans.some((plan) => plan.planId === selectedPlanId)
    if (!stillVisible) {
      setSelectedPlanId(visiblePlans[0].planId)
    }
  }, [visiblePlans, selectedPlanId])

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.planId === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  const checkoutMutation = useMutation({
    mutationFn: ({ mode, planId }) => {
      const payload = {
        planId,
        paymentMethod: 'PAYOS',
        returnUrl: `${window.location.origin}/customer/membership`,
        cancelUrl: `${window.location.origin}/customer/membership?status=CANCELLED`,
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
        alert('Checkout URL not found in API response. Please check backend logs.')
      }
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.message || 'Membership checkout failed.'
      alert(message)
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

    checkoutMutation.mutate({ mode, planId: selectedPlan.planId })
  }

  const confirmCheckoutAfterWarning = () => {
    if (!selectedPlan || !checkoutWarning?.mode) {
      setCheckoutWarning(null)
      return
    }

    const mode = checkoutWarning.mode
    setCheckoutWarning(null)
    checkoutMutation.mutate({ mode, planId: selectedPlan.planId })
  }

  const checkoutModePreview = selectedPlan ? inferCheckoutMode(selectedPlan, currentMembership) : null

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
        <section className="space-y-3 gc-card-compact">
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

          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(planTypeMeta).map(([key, meta]) => {
              const count = plansByCategory[key]?.length ?? 0
              const selected = selectedCategory === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCategory(key)}
                  className={`rounded-xl border px-3 py-2 text-left transition ${
                    selected
                      ? 'border-gym-300 bg-gym-50'
                      : 'border-slate-200 bg-slate-50 hover:border-gym-200 hover:bg-gym-50/60'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-900">{meta.label}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{count} plan(s)</p>
                </button>
              )
            })}
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {visiblePlans.map((plan) => {
              const selected = selectedPlanId === plan.planId
              return (
                <button
                  key={plan.planId}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.planId)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    selected
                      ? 'border-gym-300 bg-gym-50'
                      : 'border-slate-200 bg-slate-50 hover:border-gym-200 hover:bg-gym-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                  </div>
                    <p className="text-sm font-bold text-gym-600">
                      {Number(plan.price || 0).toLocaleString('en-US')} <span className="text-xs text-slate-500">VND</span>
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    Duration: {plan.durationDays} day(s) - Coach booking: {plan.allowsCoachBooking ? 'Yes' : 'No'}
                  </p>
                </button>
              )
            })}
            {!plansQuery.isLoading && visiblePlans.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                No plans in this category.
              </p>
            )}
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

            <button
              type="button"
              disabled={checkoutMutation.isPending || !selectedPlan}
              onClick={handleCheckout}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-gym-700 bg-gym-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-gym-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-400 disabled:text-slate-100"
            >
              <CalendarClock size={16} />
              {checkoutMutation.isPending ? 'Redirecting to PayOS...' : 'Checkout'}
            </button>
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
