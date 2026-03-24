import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, PlusCircle, Search } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { adminMembershipApi } from '../../features/membership/api/adminMembershipApi'
import { formatCurrency } from '../../utils/formatters'

const PLAN_TYPE_FILTERS = [
  { value: 'ALL', label: 'All plan types' },
  { value: 'DAY_PASS', label: 'Day Pass' },
  { value: 'GYM_ONLY', label: 'Gym Only' },
  { value: 'GYM_PLUS_COACH', label: 'Gym + Coach' },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active only' },
  { value: 'inactive', label: 'Inactive only' },
]

const COACH_FILTERS = [
  { value: 'all', label: 'All coach access' },
  { value: 'enabled', label: 'Coach booking enabled' },
  { value: 'disabled', label: 'Coach booking disabled' },
]

const FILTER_CLASS = 'gc-select min-h-0 rounded-full bg-[rgba(18,18,26,0.92)] px-3 py-1.5 text-xs font-medium'
const INPUT_CLASS = 'gc-input min-h-0 rounded-md px-3 py-1.5 text-xs'

function normalizePlanDraft(draft) {
  const planType = (draft.planType || 'GYM_ONLY').toUpperCase()
  if (planType === 'DAY_PASS') {
    return { ...draft, planType, durationDays: 1, allowsCoachBooking: false }
  }
  if (planType === 'GYM_PLUS_COACH') {
    return { ...draft, planType, allowsCoachBooking: true }
  }
  return { ...draft, planType, allowsCoachBooking: false }
}

function resolveApiMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function validatePlanDraft(draft) {
  const normalized = normalizePlanDraft(draft)
  if (!String(normalized.name || '').trim()) {
    return 'Plan name is required.'
  }
  if (String(normalized.name).trim().length > 100) {
    return 'Plan name must not exceed 100 characters.'
  }
  if (!['DAY_PASS', 'GYM_ONLY', 'GYM_PLUS_COACH'].includes(normalized.planType)) {
    return 'Plan type must be DAY_PASS, GYM_ONLY, or GYM_PLUS_COACH.'
  }
  if (!Number.isFinite(Number(normalized.price)) || Number(normalized.price) <= 0) {
    return 'Price must be greater than 0.'
  }
  if (!Number.isInteger(Number(normalized.durationDays)) || Number(normalized.durationDays) <= 0) {
    return 'Duration days must be a positive integer.'
  }
  if (normalized.planType === 'DAY_PASS' && Number(normalized.durationDays) !== 1) {
    return 'Day Pass must use exactly 1 day.'
  }
  return ''
}

function AdminMembershipsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [planTypeFilter, setPlanTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('all')
  const [coachFilter, setCoachFilter] = useState('all')
  const [editingPlan, setEditingPlan] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const plansQuery = useQuery({
    queryKey: ['admin-membership-plans'],
    queryFn: adminMembershipApi.getPlans,
  })

  const upsertMutation = useMutation({
    mutationFn: ({ planId, body }) =>
      planId ? adminMembershipApi.updatePlan(planId, body) : adminMembershipApi.createPlan(body),
    onSuccess: () => {
      setErrorMessage('')
      queryClient.invalidateQueries({ queryKey: ['admin-membership-plans'] })
      setEditingPlan(null)
    },
    onError: (error) => {
      setErrorMessage(resolveApiMessage(error, 'Failed to save membership plan.'))
    },
  })

  const plans = useMemo(() => plansQuery.data?.data?.plans ?? [], [plansQuery.data])
  const filteredPlans = useMemo(
    () =>
      plans.filter((plan) => {
        if (planTypeFilter !== 'ALL' && String(plan.planType).toUpperCase() !== planTypeFilter) {
          return false
        }
        if (statusFilter === 'active' && !plan.active) return false
        if (statusFilter === 'inactive' && plan.active) return false
        if (coachFilter === 'enabled' && !plan.allowsCoachBooking) return false
        if (coachFilter === 'disabled' && plan.allowsCoachBooking) return false
        const text = `${plan.name || ''} ${plan.planType || ''}`.toLowerCase()
        return text.includes(search.toLowerCase())
      }),
    [coachFilter, planTypeFilter, plans, search, statusFilter],
  )

  const handleCreate = () => {
    setErrorMessage('')
    setEditingPlan({
      planId: null,
      name: '',
      planType: 'GYM_ONLY',
      price: 500000,
      durationDays: 30,
      allowsCoachBooking: false,
      active: true,
    })
  }

  const handleEdit = (plan) => {
    setErrorMessage('')
    setEditingPlan({
      planId: plan.planId,
      name: plan.name ?? '',
      planType: (plan.planType || 'GYM_ONLY').toUpperCase(),
      price: Number(plan.price || 0),
      durationDays: Number(plan.durationDays || 1),
      allowsCoachBooking: Boolean(plan.allowsCoachBooking),
      active: Boolean(plan.active),
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!editingPlan) return
    const validationError = validatePlanDraft(editingPlan)
    if (validationError) {
      setErrorMessage(validationError)
      return
    }
    const normalized = normalizePlanDraft(editingPlan)
    const { planId, ...body } = normalized
    upsertMutation.mutate({ planId, body })
  }

  return (
    <WorkspaceScaffold
      title="Admin Membership Plans"
      subtitle="Create and update plans under the C-section business rules."
      links={adminNav}
    >
      <div className="space-y-4">
        <section className="space-y-4 gc-card-compact">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h2 className="gc-section-kicker">Membership Plans</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Types: <span className="font-medium">DAY_PASS</span>, <span className="font-medium">GYM_ONLY</span>, <span className="font-medium">GYM_PLUS_COACH</span>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 transition-[border-color,background-color,box-shadow] duration-200 ease-out focus-within:border-amber-500/30 focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-500/15">
                <Search size={14} className="text-slate-400" />
                <span className="sr-only">Search plans</span>
                <input
                  type="search"
                  name="membershipPlanSearch"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Search plans…"
                  className="w-32 bg-transparent text-xs text-slate-100 placeholder:text-slate-400 outline-none sm:w-52"
                />
              </div>
              <select
                value={planTypeFilter}
                onChange={(event) => setPlanTypeFilter(event.target.value)}
                name="planTypeFilter"
                className={FILTER_CLASS}
              >
                {PLAN_TYPE_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                name="membershipStatusFilter"
                className={FILTER_CLASS}
              >
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={coachFilter}
                onChange={(event) => setCoachFilter(event.target.value)}
                name="membershipCoachFilter"
                className={FILTER_CLASS}
              >
                {COACH_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreate}
                className="gc-button-primary inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold shadow-sm"
              >
                <PlusCircle size={14} />
                New plan
              </button>
            </div>
          </header>

          {plansQuery.error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
              {resolveApiMessage(plansQuery.error, 'Membership plans could not be loaded.')}
            </div>
          ) : null}

          <div className="max-h-80 overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-xs">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Price</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Days</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Coach</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-400">Status</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-[rgba(18,18,26,0.92)]">
                {plansQuery.isLoading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-3 text-center text-slate-500" aria-live="polite">
                      Loading plans…
                    </td>
                  </tr>
                )}
                {!plansQuery.isLoading && filteredPlans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-3 text-center text-slate-500">
                      No membership plans found.
                    </td>
                  </tr>
                )}
                {filteredPlans.map((plan) => (
                  <tr key={plan.planId}>
                    <td className="px-3 py-2 text-slate-50">{plan.name}</td>
                    <td className="px-3 py-2 text-slate-200">{plan.planType}</td>
                    <td className="px-3 py-2 text-slate-200">{formatCurrency(plan.price)}</td>
                    <td className="px-3 py-2 text-slate-200">{plan.durationDays}</td>
                    <td className="px-3 py-2 text-slate-200">{plan.allowsCoachBooking ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          plan.active
                            ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20'
                            : 'bg-white/10 text-slate-400 ring-1 ring-white/10'
                        }`}
                      >
                        {plan.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleEdit(plan)}
                        className="gc-button-secondary inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium"
                      >
                        <Edit3 size={12} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {editingPlan && (
          <section className="gc-card-compact">
            <form noValidate onSubmit={handleSubmit} className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-50">
                {editingPlan.planId ? 'Update membership plan' : 'Create membership plan'}
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Plan name</label>
                  <input
                    type="text"
                    name="name"
                    maxLength={100}
                    value={editingPlan.name}
                    onChange={(event) =>
                      setEditingPlan((prev) => ({ ...prev, name: event.target.value }))
                    }
                    autoComplete="off"
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Plan type</label>
                  <select
                    value={editingPlan.planType}
                    onChange={(event) =>
                      setEditingPlan((prev) => normalizePlanDraft({ ...prev, planType: event.target.value }))
                    }
                    name="planType"
                    className={INPUT_CLASS}
                  >
                    <option value="DAY_PASS">DAY_PASS</option>
                    <option value="GYM_ONLY">GYM_ONLY</option>
                    <option value="GYM_PLUS_COACH">GYM_PLUS_COACH</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Price (VND)</label>
                  <input
                    type="number"
                    name="price"
                    min={1}
                    step="1000"
                    value={editingPlan.price}
                    onChange={(event) =>
                      setEditingPlan((prev) => ({ ...prev, price: Number(event.target.value || 0) }))
                    }
                    inputMode="numeric"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Duration (days)</label>
                  <input
                    type="number"
                    name="durationDays"
                    min={1}
                    disabled={editingPlan.planType === 'DAY_PASS'}
                    value={editingPlan.planType === 'DAY_PASS' ? 1 : editingPlan.durationDays}
                    onChange={(event) =>
                      setEditingPlan((prev) => ({ ...prev, durationDays: Number(event.target.value || 1) }))
                    }
                    inputMode="numeric"
                    className={`${INPUT_CLASS} disabled:bg-white/10`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">Coach booking</label>
                  <input
                    type="text"
                    readOnly
                    value={normalizePlanDraft(editingPlan).allowsCoachBooking ? 'Enabled' : 'Disabled'}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-200">
                <input
                  type="checkbox"
                  checked={editingPlan.active}
                  onChange={(event) =>
                    setEditingPlan((prev) => ({ ...prev, active: event.target.checked }))
                  }
                  className="h-3 w-3 rounded border-white/15 text-gym-600 focus:ring-gym-500"
                />
                Active (available for new purchases)
              </label>

              {errorMessage && (
                <p className="text-xs font-medium text-red-600" aria-live="polite">{errorMessage}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="gc-button-secondary px-3 py-1 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={upsertMutation.isPending}
                  className="gc-button-primary inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold shadow-sm disabled:cursor-not-allowed disabled:bg-white/50"
                >
                  {upsertMutation.isPending
                    ? 'Saving…'
                    : editingPlan.planId
                      ? 'Save changes'
                      : 'Create plan'}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </WorkspaceScaffold>
  )
}

export default AdminMembershipsPage





