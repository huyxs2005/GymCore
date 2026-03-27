import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock3, CreditCard, History, Loader2, Search, UserRound, X } from 'lucide-react'
import PaginationControls from '../../components/common/PaginationControls'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { receptionNav } from '../../config/navigation'
import { receptionCustomerApi } from '../../features/users/api/receptionCustomerApi'
import { usePagination } from '../../hooks/usePagination'

function formatCheckinTime(value) {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed)
}

function MembershipPanel({ title, membership, emptyLabel, tone = 'slate' }) {
  const toneClass =
    tone === 'emerald'
      ? 'border-emerald-500/20 bg-emerald-500/5'
      : tone === 'amber'
        ? 'border-amber-500/20 bg-amber-500/5'
        : 'border-white/5 bg-white/[0.02]'

  return (
    <section className={`rounded-3xl border p-6 ${toneClass}`}>
      <div className="flex items-center gap-3">
        <CreditCard className="h-5 w-5 text-gym-500" />
        <h3 className="text-base font-bold uppercase tracking-tight text-white">{title}</h3>
      </div>

      {membership?.customerMembershipId ? (
        <div className="mt-5 space-y-4">
          <div>
            <p className="text-lg font-bold text-white">{membership.planName}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-slate-500">{membership.status}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Start date</p>
              <p className="mt-2 text-sm font-semibold text-white">{membership.startDate || '-'}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">End date</p>
              <p className="mt-2 text-sm font-semibold text-white">{membership.endDate || '-'}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-500">{emptyLabel}</p>
      )}
    </section>
  )
}

function ReceptionCustomersPage() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [customers, setCustomers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [error, setError] = useState('')
  const [checkinDateFrom, setCheckinDateFrom] = useState('')
  const [checkinDateTo, setCheckinDateTo] = useState('')

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.customerId === selectedCustomerId) || selectedProfile?.customer || null,
    [customers, selectedCustomerId, selectedProfile],
  )

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setCustomers([])
      setSelectedCustomerId(null)
      setSelectedProfile(null)
      setSearching(false)
      return undefined
    }

    const timer = window.setTimeout(() => {
      runSearch(trimmed)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [query])

  async function runSearch(searchTerm) {
    setSearching(true)
    setError('')
    setSelectedCustomerId(null)
    setSelectedProfile(null)
    try {
      const response = await receptionCustomerApi.searchCustomers(searchTerm)
      setCustomers(response?.data?.items || [])
    } catch (err) {
      setCustomers([])
      setError(err?.response?.data?.message || 'Failed to search customers.')
    } finally {
      setSearching(false)
    }
  }

  async function selectCustomer(customerId) {
    setSelectedCustomerId(customerId)
    setLoadingProfile(true)
    setError('')
    try {
      const response = await receptionCustomerApi.getMembership(customerId)
      setSelectedProfile(response?.data || null)
    } catch (err) {
      setSelectedProfile(null)
      setError(err?.response?.data?.message || 'Failed to load customer information.')
    } finally {
      setLoadingProfile(false)
    }
  }

  const checkinHistory = selectedProfile?.checkinHistory || []
  const activeMembership = selectedProfile?.activeMembership || {}
  const autoRenewMembership = selectedProfile?.autoRenewMembership || {}
  const expiredMembershipHistory = selectedProfile?.expiredMembershipHistory || []
  const filteredCheckinHistory = useMemo(() => {
    if (!checkinDateFrom && !checkinDateTo) return checkinHistory
    return checkinHistory.filter((item) => {
      if (!item?.checkInTime) return false
      const parsed = new Date(item.checkInTime)
      if (Number.isNaN(parsed.getTime())) return false
      const yyyy = parsed.getFullYear()
      const mm = String(parsed.getMonth() + 1).padStart(2, '0')
      const dd = String(parsed.getDate()).padStart(2, '0')
      const itemDate = `${yyyy}-${mm}-${dd}`
      if (checkinDateFrom && itemDate < checkinDateFrom) return false
      if (checkinDateTo && itemDate > checkinDateTo) return false
      return true
    })
  }, [checkinDateFrom, checkinDateTo, checkinHistory])
  const {
    currentPage: customersPage,
    setCurrentPage: setCustomersPage,
    totalPages: customerTotalPages,
    paginatedItems: paginatedCustomers,
  } = usePagination(customers, 10)
  const {
    currentPage: checkinHistoryPage,
    setCurrentPage: setCheckinHistoryPage,
    totalPages: checkinHistoryTotalPages,
    paginatedItems: paginatedCheckinHistory,
  } = usePagination(filteredCheckinHistory, 10)
  const {
    currentPage: expiredMembershipPage,
    setCurrentPage: setExpiredMembershipPage,
    totalPages: expiredMembershipTotalPages,
    paginatedItems: paginatedExpiredMemberships,
  } = usePagination(expiredMembershipHistory, 10)

  return (
    <WorkspaceScaffold showHeader={false} links={receptionNav}>
      <div className="max-w-7xl space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8">
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-white">Look up customer information</h2>
            <p className="mt-2 text-sm text-slate-500">Search name, email or phone number</p>
          </div>

          <div className="group relative">
            <div className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-2 ring-1 ring-white/10 transition-all focus-within:bg-white/5 focus-within:ring-gym-500/50">
              <div className="pl-4 text-slate-500 group-focus-within:text-gym-500">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email or phone number"
                className="h-12 w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          {!selectedCustomer ? (
            <>
              <div className="mt-8 space-y-3">
                {searching ? (
                  [1, 2, 3].map((item) => (
                    <div key={item} className="h-24 animate-pulse rounded-3xl border border-white/5 bg-white/[0.02]" />
                  ))
                ) : customers.length === 0 && query.trim() ? (
                  <div className="rounded-3xl border border-white/5 bg-white/[0.02] px-6 py-10 text-center text-sm text-slate-500">
                    Customer not found
                  </div>
                ) : (
                  paginatedCustomers.map((customer) => (
                    <button
                      key={customer.customerId}
                      type="button"
                      onClick={() => selectCustomer(customer.customerId)}
                      className="w-full rounded-3xl border border-white/5 bg-white/[0.02] p-5 text-left transition-all hover:border-white/15 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-slate-300">
                          <UserRound className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-white">{customer.fullName}</p>
                          <p className="truncate text-sm text-slate-400">{customer.email || '-'}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{customer.phone || 'No phone number'}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <PaginationControls
                currentPage={customersPage}
                totalPages={customerTotalPages}
                onPageChange={setCustomersPage}
                tone="dark"
                className="mt-5"
              />
            </>
          ) : null}

          {selectedCustomer ? (
            <section className="mt-8 space-y-6">
              <div className="rounded-3xl border border-gym-500/20 bg-gym-500/5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white">
                      <UserRound className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white">{selectedCustomer.fullName}</p>
                      <p className="mt-1 text-sm text-slate-400">{selectedCustomer.email || '-'}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{selectedCustomer.phone || 'No phone number'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId(null)
                      setSelectedProfile(null)
                      setCheckinDateFrom('')
                      setCheckinDateTo('')
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                    Change customer
                  </button>
                </div>
              </div>

              <section className="min-h-[28rem] space-y-6">
                {loadingProfile ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-gym-500" />
                  <p className="mt-5 text-sm text-slate-500">Loading customer information...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                    <p className="text-2xl font-bold text-white">{selectedCustomer.fullName}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Email</p>
                        <p className="mt-2 text-sm text-white">{selectedCustomer.email || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Phone number</p>
                        <p className="mt-2 text-sm text-white">{selectedCustomer.phone || 'No phone number'}</p>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <MembershipPanel
                      title="Current active membership"
                      membership={activeMembership}
                      emptyLabel="No active membership"
                      tone="emerald"
                    />
                    <MembershipPanel
                      title="Auto renew membership"
                      membership={autoRenewMembership}
                      emptyLabel="No scheduled membership"
                      tone="amber"
                    />
                  </div>

                  <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <History className="h-5 w-5 text-gym-500" />
                        <h3 className="text-base font-bold uppercase tracking-tight text-white">Check in history</h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <label htmlFor="checkin-date-from" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          From
                        </label>
                        <input
                          id="checkin-date-from"
                          type="date"
                          value={checkinDateFrom}
                          onChange={(event) => setCheckinDateFrom(event.target.value)}
                          max={checkinDateTo || undefined}
                          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none transition focus:border-gym-500"
                        />
                        <label htmlFor="checkin-date-to" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          To
                        </label>
                        <input
                          id="checkin-date-to"
                          type="date"
                          value={checkinDateTo}
                          onChange={(event) => setCheckinDateTo(event.target.value)}
                          min={checkinDateFrom || undefined}
                          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none transition focus:border-gym-500"
                        />
                        {checkinDateFrom || checkinDateTo ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCheckinDateFrom('')
                              setCheckinDateTo('')
                            }}
                            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {filteredCheckinHistory.length === 0 ? (
                      <p className="mt-5 text-sm text-slate-500">No check in history yet.</p>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {paginatedCheckinHistory.map((item) => (
                          <div key={item.checkInId} className="rounded-2xl border border-white/5 bg-black/20 px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2 text-white">
                                <Clock3 className="h-4 w-4 text-gym-500" />
                                <span className="text-sm font-semibold">{formatCheckinTime(item.checkInTime)}</span>
                              </div>
                              <span className="text-xs font-semibold text-emerald-400">{item.planName || 'Membership'}</span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">Employee: {item.employeeName || 'System'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <PaginationControls
                      currentPage={checkinHistoryPage}
                      totalPages={checkinHistoryTotalPages}
                      onPageChange={setCheckinHistoryPage}
                      tone="dark"
                      className="mt-5"
                    />
                  </section>

                  <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="h-5 w-5 text-gym-500" />
                      <h3 className="text-base font-bold uppercase tracking-tight text-white">Expired membership list</h3>
                    </div>
                    {expiredMembershipHistory.length === 0 ? (
                      <p className="mt-5 text-sm text-slate-500">No expired memberships.</p>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {paginatedExpiredMemberships.map((item) => (
                          <div key={item.customerMembershipId} className="rounded-2xl border border-white/5 bg-black/20 px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-white">{item.planName}</p>
                              <span className="text-xs font-semibold text-slate-400">{item.endDate || '-'}</span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {item.startDate || '-'} to {item.endDate || '-'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    <PaginationControls
                      currentPage={expiredMembershipPage}
                      totalPages={expiredMembershipTotalPages}
                      onPageChange={setExpiredMembershipPage}
                      tone="dark"
                      className="mt-5"
                    />
                  </section>
                </div>
              )}
              </section>
            </section>
          ) : null}
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

export default ReceptionCustomersPage
