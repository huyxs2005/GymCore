import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Edit3, PlusCircle, Search, CreditCard, Clock, Star,
  Shield, CheckCircle2, AlertCircle, Trash2, ArrowRight,
  Filter, Zap, TrendingUp
} from 'lucide-react'
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
      setErrorMessage(resolveApiMessage(error, 'Tactical Error: Plan synchronization failed.'))
    },
  })

  const plans = plansQuery.data?.data?.plans ?? []
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

  const getPlanIcon = (type) => {
    switch (type) {
      case 'DAY_PASS': return <Clock size={16} />
      case 'GYM_PLUS_COACH': return <Zap size={16} />
      default: return <CreditCard size={16} />
    }
  }

  return (
    <WorkspaceScaffold
      title="Access Protocols"
      subtitle="Architect and manage tiered membership deployments and pricing vectors."
      links={adminNav}
    >
      <div className="space-y-12 pb-20 animate-in fade-in duration-700">
        {/* Tactical Header */}
        <section className="flex flex-wrap items-center justify-between gap-8 bg-gym-dark-900 p-8 rounded-[40px] border-4 border-gym-dark-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gym-500/10 -mr-32 -mt-32 rounded-full blur-3xl"></div>

          <div className="relative">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Membership Matrix</h2>
            <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-[0.2em] mt-1">Tier Configuration & Deployment</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 relative">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gym-dark-500 group-hover:text-gym-500 transition-colors" size={18} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter protocols..."
                className="bg-white/5 border-2 border-white/10 rounded-2xl py-3 pl-12 pr-6 text-xs font-bold text-white focus:outline-none focus:border-gym-500 focus:bg-white/10 transition-all placeholder:text-gym-dark-600 sm:w-64"
              />
            </div>
            <button
              onClick={handleCreate}
              className="btn-primary px-8 py-3.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-gym-500/20 active:scale-95"
            >
              <PlusCircle size={16} strokeWidth={3} /> Initialize Plan
            </button>
          </div>
        </section>

        {/* Membership Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plansQuery.isLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-64 rounded-[40px] bg-gym-dark-50 animate-pulse border-2 border-gym-dark-100"></div>
            ))
          ) : filteredPlans.map((plan) => (
            <article
              key={plan.planId}
              className={`gc-card-compact border-2 bg-white relative overflow-hidden group transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 ${plan.active ? 'border-gym-dark-50' : 'opacity-60 border-dashed border-gym-dark-200'}`}
            >
              {!plan.active && (
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center">
                  <span className="bg-gym-dark-900 text-gym-dark-400 px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.3em]">Decommissioned</span>
                </div>
              )}

              <div className="flex items-center justify-between mb-8">
                <div className={`p-4 rounded-2xl ${plan.planType === 'GYM_PLUS_COACH' ? 'bg-gym-500 text-gym-dark-900' : 'bg-gym-dark-900 text-gym-500'} shadow-lg group-hover:scale-110 transition-transform`}>
                  {getPlanIcon(plan.planType)}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gym-dark-300 uppercase tracking-widest">Protocol Type</p>
                  <p className="text-xs font-black text-gym-dark-900 uppercase italic">{plan.planType}</p>
                </div>
              </div>

              <h3 className="text-xl font-black text-gym-dark-900 uppercase tracking-tight mb-2 group-hover:text-gym-500 transition-colors">
                {plan.name}
              </h3>

              <div className="space-y-4 mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-gym-dark-900 tracking-tighter">
                    {Number(plan.price || 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-bold text-gym-dark-400 uppercase">VND / {plan.durationDays}D</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${plan.allowsCoachBooking ? 'bg-emerald-50 text-emerald-600' : 'bg-gym-dark-50 text-gym-dark-300'}`}>
                    {plan.allowsCoachBooking ? <CheckCircle2 size={14} strokeWidth={3} /> : <AlertCircle size={14} strokeWidth={3} />}
                  </div>
                  <span className="text-[10px] font-black text-gym-dark-600 uppercase tracking-widest">
                    Coach Booking: {plan.allowsCoachBooking ? 'ENABLED' : 'RESTRICTED'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleEdit(plan)}
                className="w-full py-4 bg-gym-dark-50 text-gym-dark-900 border-2 border-transparent rounded-[24px] font-black text-[10px] uppercase tracking-[0.2em] transition-all group-hover:bg-gym-dark-900 group-hover:text-gym-500 flex items-center justify-center gap-3"
              >
                <Edit3 size={14} strokeWidth={3} /> Reconfigure Protocol
              </button>
            </article>
          ))}
        </section>

        {/* Configuration Modal / Editor Overlay */}
        {editingPlan && (
          <div className="fixed inset-0 z-[100] bg-gym-dark-900/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-500">
            <section className="w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500">
              <header className="px-10 py-8 bg-gym-dark-900 text-white flex items-center justify-between border-b-4 border-gym-dark-800">
                <div>
                  <h4 className="text-xl font-black uppercase tracking-tight text-gym-500 italic">Protocol Calibration</h4>
                  <p className="text-[10px] font-bold text-gym-dark-400 mt-1 uppercase tracking-widest">
                    {editingPlan.planId ? `SYNCING UNIT: ${editingPlan.planId}` : 'INITIALIZING NEW DEPLOYMENT'}
                  </p>
                </div>
                <button onClick={() => setEditingPlan(null)} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all font-black text-2xl">×</button>
              </header>

              <form onSubmit={handleSubmit} className="p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Designated Name</label>
                    <input
                      type="text"
                      required
                      value={editingPlan.name}
                      onChange={(e) => setEditingPlan(prev => ({ ...prev, name: e.target.value }))}
                      className="gc-input"
                      placeholder="e.g. TACTICAL PLUS"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Clearance Model</label>
                    <select
                      value={editingPlan.planType}
                      onChange={(e) => setEditingPlan(prev => normalizePlanDraft({ ...prev, planType: e.target.value }))}
                      className="gc-input"
                    >
                      <option value="DAY_PASS">DAY_PASS (Tactical entry)</option>
                      <option value="GYM_ONLY">GYM_ONLY (Standard access)</option>
                      <option value="GYM_PLUS_COACH">GYM_PLUS_COACH (Elite access)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Investment (VND)</label>
                    <input
                      type="number"
                      required
                      value={editingPlan.price}
                      onChange={(e) => setEditingPlan(prev => ({ ...prev, price: Number(e.target.value) }))}
                      className="gc-input"
                      placeholder="500,000"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Operational Duration (Days)</label>
                    <input
                      type="number"
                      disabled={editingPlan.planType === 'DAY_PASS'}
                      value={editingPlan.planType === 'DAY_PASS' ? 1 : editingPlan.durationDays}
                      onChange={(e) => setEditingPlan(prev => ({ ...prev, durationDays: Number(e.target.value) }))}
                      className="gc-input disabled:bg-gym-dark-50/50 italic opacity-60"
                      placeholder="30"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-6 rounded-3xl bg-gym-dark-50/50 border-2 border-gym-dark-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${normalizePlanDraft(editingPlan).allowsCoachBooking ? 'bg-gym-500 text-gym-dark-900' : 'bg-gym-dark-200 text-gym-dark-400'}`}>
                      <Zap size={18} strokeWidth={3} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gym-dark-900">Coach Booking Link</p>
                      <p className="text-[9px] font-bold text-gym-dark-400 uppercase tracking-tighter">Automatic based on Clearance Model</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full ${normalizePlanDraft(editingPlan).allowsCoachBooking ? 'bg-emerald-500 text-white' : 'bg-gym-dark-100 text-gym-dark-400'}`}>
                    {normalizePlanDraft(editingPlan).allowsCoachBooking ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <label className="flex items-center gap-4 p-2 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={editingPlan.active}
                      onChange={(e) => setEditingPlan(prev => ({ ...prev, active: e.target.checked }))}
                      className="sr-only"
                    />
                    <div className={`w-14 h-8 rounded-full transition-colors duration-300 ${editingPlan.active ? 'bg-gym-500' : 'bg-gym-dark-200'}`}></div>
                    <div className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${editingPlan.active ? 'translate-x-6' : ''}`}></div>
                  </div>
                  <div>
                    <p className="text-xs font-black text-gym-dark-900 uppercase">Deployment Readiness</p>
                    <p className="text-[10px] font-bold text-gym-dark-400 uppercase">Available for athlete requisition</p>
                  </div>
                </label>

                {errorMessage && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600">
                    <AlertCircle size={16} />
                    <p className="text-[10px] font-black uppercase tracking-widest">{errorMessage}</p>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="flex-1 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gym-dark-400 hover:text-gym-dark-900 transition-colors"
                  >
                    Abort Mission
                  </button>
                  <button
                    type="submit"
                    disabled={upsertMutation.isPending}
                    className="btn-primary flex-[2] py-5 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3"
                  >
                    {upsertMutation.isPending ? 'SYNCING...' : <><Shield size={18} /> Confirm Plan</>}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    </WorkspaceScaffold>
  )
}

export default AdminMembershipsPage
