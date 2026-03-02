import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, PlusCircle, Search } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { adminMembershipApi } from '../../features/membership/api/adminMembershipApi'

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

function AdminMembershipsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
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
        const text = `${plan.name || ''} ${plan.planType || ''}`.toLowerCase()
        return text.includes(search.toLowerCase())
      }),
    [plans, search],
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
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="gc-section-kicker">Membership Plans</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Types: <span className="font-medium">DAY_PASS</span>, <span className="font-medium">GYM_ONLY</span>, <span className="font-medium">GYM_PLUS_COACH</span>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search plans..."
                  className="w-32 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none sm:w-52"
                />
              </div>
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex items-center gap-2 rounded-full bg-gym-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-gym-700"
              >
                <PlusCircle size={14} />
                New plan
              </button>
            </div>
          </header>

          <div className="max-h-80 overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Type</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Price</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Days</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Coach</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {plansQuery.isLoading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-3 text-center text-slate-500">
                      Loading plans...
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
                    <td className="px-3 py-2 text-slate-900">{plan.name}</td>
                    <td className="px-3 py-2 text-slate-700">{plan.planType}</td>
                    <td className="px-3 py-2 text-slate-700">{Number(plan.price || 0).toLocaleString('en-US')} VND</td>
                    <td className="px-3 py-2 text-slate-700">{plan.durationDays}</td>
                    <td className="px-3 py-2 text-slate-700">{plan.allowsCoachBooking ? 'Yes' : 'No'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          plan.active
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                        }`}
                      >
                        {plan.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleEdit(plan)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-gym-300 hover:text-gym-700"
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
            <form onSubmit={handleSubmit} className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingPlan.planId ? 'Update membership plan' : 'Create membership plan'}
              </h3>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Plan name</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={editingPlan.name}
                    onChange={(event) =>
                      setEditingPlan((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Plan type</label>
                  <select
                    value={editingPlan.planType}
                    onChange={(event) =>
                      setEditingPlan((prev) => normalizePlanDraft({ ...prev, planType: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
                  >
                    <option value="DAY_PASS">DAY_PASS</option>
                    <option value="GYM_ONLY">GYM_ONLY</option>
                    <option value="GYM_PLUS_COACH">GYM_PLUS_COACH</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Price (VND)</label>
                  <input
                    type="number"
                    min={1}
                    step="1000"
                    required
                    value={editingPlan.price}
                    onChange={(event) =>
                      setEditingPlan((prev) => ({ ...prev, price: Number(event.target.value || 0) }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Duration (days)</label>
                  <input
                    type="number"
                    min={1}
                    required
                    disabled={editingPlan.planType === 'DAY_PASS'}
                    value={editingPlan.planType === 'DAY_PASS' ? 1 : editingPlan.durationDays}
                    onChange={(event) =>
                      setEditingPlan((prev) => ({ ...prev, durationDays: Number(event.target.value || 1) }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400 disabled:bg-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Coach booking</label>
                  <input
                    type="text"
                    readOnly
                    value={normalizePlanDraft(editingPlan).allowsCoachBooking ? 'Enabled' : 'Disabled'}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={editingPlan.active}
                  onChange={(event) =>
                    setEditingPlan((prev) => ({ ...prev, active: event.target.checked }))
                  }
                  className="h-3 w-3 rounded border-slate-300 text-gym-600 focus:ring-gym-500"
                />
                Active (available for new purchases)
              </label>

              {errorMessage && (
                <p className="text-xs font-medium text-red-600">{errorMessage}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={upsertMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  {upsertMutation.isPending
                    ? 'Saving...'
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
