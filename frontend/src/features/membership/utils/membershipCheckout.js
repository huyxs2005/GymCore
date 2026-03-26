export const checkoutModeLabel = {
  PURCHASE: 'Purchase',
  RENEW: 'Renew',
  UPGRADE: 'Upgrade',
}

export function normalizePlanType(planType) {
  return String(planType || '')
    .trim()
    .toUpperCase()
}

export function formatDurationLabel(durationDays) {
  const days = Number(durationDays || 0)
  if (days <= 1) return '1 day'
  if (days >= 365 * 2) return '24 months'
  if (days >= 365) return '12 months'
  if (days >= 180) return '6 months'
  if (days >= 30) return '1 month'
  return `${days} days`
}

export function formatDurationWithCoupon(durationDays, bonusMonths = 0) {
  const baseLabel = formatDurationLabel(durationDays)
  const extraMonths = Number(bonusMonths || 0)
  if (extraMonths <= 0) return baseLabel
  return `${baseLabel} + ${extraMonths} extra month${extraMonths > 1 ? 's' : ''}`
}

export function inferCheckoutMode(selectedPlan, currentMembership) {
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

export function buildActiveWarningMessage(mode, currentMembership, selectedPlan) {
  const currentName = currentMembership?.plan?.name || 'current membership'
  const selectedName = selectedPlan?.name || 'selected plan'
  const currentPlanType = normalizePlanType(currentMembership?.plan?.planType)
  const selectedPlanType = normalizePlanType(selectedPlan?.planType)

  if (mode === 'RENEW' && currentPlanType === 'DAY_PASS' && selectedPlanType !== 'DAY_PASS') {
    return `You currently have an ACTIVE Day Pass (${currentName}). If you continue, ${selectedName} will take effect after the Day Pass expires.`
  }

  if (mode === 'RENEW') {
    return `You already have an ACTIVE membership (${currentName}). If you continue, ${selectedName} will be queued to start after your current membership ends.`
  }

  return `You already have an ACTIVE membership (${currentName}). If you continue, your current membership will end today and ${selectedName} starts today.`
}
