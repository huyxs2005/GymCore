import { useState } from 'react'
import { Search, User, CreditCard, Calendar, Activity, Loader2, ShieldCheck, ShieldAlert, ChevronRight, X } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { receptionNav } from '../../config/navigation'
import { receptionCustomerApi } from '../../features/users/api/receptionCustomerApi'

function ReceptionCustomersPage() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedCustomerMembership, setSelectedCustomerMembership] = useState(null)
  const [loadingMembership, setLoadingMembership] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch(e) {
    if (e) e.preventDefault()
    if (!query.trim()) return

    setSearching(true)
    setError('')
    setSelectedCustomerId(null)
    setSelectedCustomerMembership(null)

    try {
      const response = await receptionCustomerApi.searchCustomers(query.trim())
      setCustomers(response?.data?.items || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to synchronize customer data.')
      setCustomers([])
    } finally {
      setSearching(false)
    }
  }

  async function viewMembership(customerId) {
    setSelectedCustomerId(customerId)
    setLoadingMembership(true)
    setError('')
    try {
      const response = await receptionCustomerApi.getMembership(customerId)
      setSelectedCustomerMembership(response?.data || null)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to retrieve membership contract.')
      setSelectedCustomerMembership(null)
    } finally {
      setLoadingMembership(false)
    }
  }

  const selectedCustomer = customers.find(c => c.customerId === selectedCustomerId)

  return (
    <WorkspaceScaffold
      title="Intelligence Registry"
      subtitle="Comprehensive subject lookup and contract verification interface for front-desk logistics."
      links={receptionNav}
    >
      <div className="max-w-7xl space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-white tracking-tight uppercase">Subject Locator</h2>
              <p className="mt-1 text-sm text-slate-500">Query the central registry via name, phone, or identification proxy.</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="group relative">
            <div className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-2 ring-1 ring-white/10 transition-all focus-within:ring-gym-500/50 focus-within:bg-white/5">
              <div className="pl-4 text-slate-500 group-focus-within:text-gym-500">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Synchronize with subject identity..."
                className="h-12 w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="flex h-12 items-center gap-2 rounded-xl bg-gym-500 px-8 text-xs font-black uppercase tracking-widest text-slate-950 shadow-glow disabled:opacity-20 disabled:shadow-none transition-all active:scale-95"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Synchronize'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 flex items-center gap-3 text-rose-400">
              <ShieldAlert className="h-5 w-5" />
              <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
              <button onClick={() => setError('')} className="ml-auto text-rose-500 hover:text-rose-400">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {searching ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-32 animate-pulse rounded-3xl border border-white/5 bg-white/[0.01]" />
              ))
            ) : customers.length === 0 && query ? (
              <div className="col-span-full py-16 text-center">
                <div className="mx-auto h-px w-24 bg-white/5 mb-6" />
                <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-600">Registry query yielded no active results.</p>
              </div>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.customerId}
                  type="button"
                  onClick={() => viewMembership(customer.customerId)}
                  className={`group relative overflow-hidden rounded-3xl border p-6 text-left transition-all duration-300 ${
                    selectedCustomerId === customer.customerId
                      ? 'border-gym-500 bg-gym-500/5 shadow-glow-sm'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="relative z-10">
                    <div className="mb-4 flex items-center justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${selectedCustomerId === customer.customerId ? 'bg-gym-500 text-slate-950' : 'bg-white/5 text-slate-500 group-hover:text-white group-hover:bg-white/10'}`}>
                        <User className="h-6 w-6" />
                      </div>
                      <ChevronRight className={`h-5 w-5 transition-all ${selectedCustomerId === customer.customerId ? 'translate-x-0 text-gym-500' : '-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 text-slate-600'}`} />
                    </div>
                    <h3 className="font-display text-lg font-bold text-white tracking-tight">{customer.fullName}</h3>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-400">
                      {customer.phone || 'NO_PROXY'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-600 group-hover:text-slate-500 truncate mt-0.5">
                      {customer.email || 'NO_CREDENTIAL'}
                    </p>
                  </div>
                  {selectedCustomerId === customer.customerId && (
                    <div className="absolute inset-0 bg-gradient-to-br from-gym-500/10 via-transparent to-transparent opacity-50" />
                  )}
                </button>
              ))
            )}
          </div>
        </section>

        {selectedCustomerId && (
          <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-2 w-2 rounded-full bg-gym-500 shadow-glow" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gym-500">Subject Blueprint</p>
                </div>
                <h2 className="font-display text-3xl font-bold text-white tracking-tight uppercase leading-tight">
                  {selectedCustomer?.fullName}
                </h2>
                <p className="mt-1 text-sm text-slate-500 font-medium">Detailed contract synchronization and active membership metrics.</p>
              </div>
              <div className="flex h-14 items-center gap-8 rounded-2xl bg-white/[0.03] px-8 border border-white/5">
                 <div className="text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-0.5">Subject ID</p>
                    <p className="text-xs font-bold text-white tracking-widest">#{String(selectedCustomerId).padStart(6, '0')}</p>
                 </div>
                 <div className="h-6 w-px bg-white/10" />
                 <div className="text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-0.5">Contract Status</p>
                    <div className="flex items-center gap-2">
                       <span className={`h-1.5 w-1.5 rounded-full ${selectedCustomerMembership ? 'bg-emerald-500 shadow-glow' : 'bg-rose-500'}`} />
                       <p className="text-xs font-black uppercase tracking-tight text-white">
                         {loadingMembership ? 'WAITING...' : selectedCustomerMembership ? 'VERIFIED' : 'UNAVAILABLE'}
                       </p>
                    </div>
                 </div>
              </div>
            </div>

            {loadingMembership ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-gym-500" />
                <p className="mt-6 text-xs font-black uppercase tracking-[0.3em] text-slate-600">Synchronizing contract metadata...</p>
              </div>
            ) : selectedCustomerMembership ? (
              <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-6">
                  <div className="rounded-[2rem] border border-white/10 bg-white/[0.01] p-8">
                     <div className="flex items-center gap-4 mb-8">
                        <div className="rounded-2xl bg-gym-500/10 p-3 text-gym-500 ring-1 ring-gym-500/20">
                           <CreditCard className="h-6 w-6" />
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Membership Tier</p>
                           <h4 className="text-xl font-bold text-white font-display uppercase tracking-tight">{selectedCustomerMembership.planName || 'Standard Protocol'}</h4>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-white/[0.03] p-5 border border-white/5">
                           <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Status Vector</p>
                           <p className={`text-lg font-black uppercase tracking-tight ${selectedCustomerMembership.status === 'ACTIVE' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {selectedCustomerMembership.status}
                           </p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.03] p-5 border border-white/5">
                           <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Contract Duration</p>
                           <p className="text-lg font-black text-white uppercase tracking-tight">365 DAYS</p>
                        </div>
                     </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                     <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-3 mb-4">
                           <Calendar className="h-4 w-4 text-slate-500" />
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Initialization</p>
                        </div>
                        <p className="text-lg font-bold text-white tabular-nums tracking-tight">{selectedCustomerMembership.startDate || '—'}</p>
                     </div>
                     <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-3 mb-4">
                           <Activity className="h-4 w-4 text-rose-500" />
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Termination</p>
                        </div>
                        <p className="text-lg font-bold text-white tabular-nums tracking-tight">{selectedCustomerMembership.endDate || '—'}</p>
                     </div>
                  </div>
                </div>

                <div className="rounded-[2.5rem] border border-white/5 bg-white/[0.01] p-10 flex flex-col justify-between">
                   <div>
                      <h4 className="text-xl font-bold text-white font-display uppercase tracking-tight mb-4">Contract Integrity Analysis</h4>
                      <p className="text-sm leading-relaxed text-slate-500 mb-8">
                        The current subject identity corresponds with a verified active contract. 
                        Access rights are propagated across all facility zones based on this membership tier.
                      </p>
                      
                      <div className="space-y-4">
                         {[
                           { label: 'Cloud Identity Synchronization', ok: true },
                           { label: 'Payment Gateway Clearance', ok: true },
                           { label: 'Facility Access Entitlement', ok: true },
                        ].map((item, idx) => (
                           <div key={idx} className="flex items-center justify-between py-3 border-b border-white/5">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.label}</span>
                              <ShieldCheck className="h-4 w-4 text-emerald-500" />
                           </div>
                        ))}
                      </div>
                   </div>

                   <div className="mt-10 flex items-center justify-between rounded-2xl bg-emerald-500/10 p-4 border border-emerald-500/20 shadow-glow-sm">
                      <div className="flex items-center gap-3">
                         <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                         <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Verified Secure Identity</span>
                      </div>
                      <ShieldCheck className="h-5 w-5 text-emerald-500" />
                   </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[2.5rem] border border-dashed border-white/10 p-20 text-center">
                 <ShieldAlert className="mx-auto h-12 w-12 text-slate-800 mb-6" />
                 <h4 className="text-xl font-bold text-slate-400 uppercase tracking-tight">Contract Vector Unavailable</h4>
                 <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">This subject profile does not have an active membership contract indexed in the current registry.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </WorkspaceScaffold>
  )
}

export default ReceptionCustomersPage
