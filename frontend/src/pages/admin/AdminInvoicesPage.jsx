import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileText, Mail, Search, Clock, CreditCard, ShieldCheck, AlertCircle, Loader2, ChevronRight, User } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav, receptionNav } from '../../config/navigation'
import { useSession } from '../../features/auth/useSession'
import { adminInvoiceApi } from '../../features/product/api/adminInvoiceApi'

const EMAIL_OPTIONS = [
  { value: 'all', label: 'All notifications' },
  { value: 'sent', label: 'Email sent' },
  { value: 'failed', label: 'Email failed' },
  { value: 'pending', label: 'Email pending' },
]

const PICKUP_OPTIONS = [
  { value: 'all', label: 'All states' },
  { value: 'awaiting', label: 'Awaiting pickup' },
  { value: 'picked', label: 'Picked up' },
]

function AdminInvoicesPage() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const role = String(user?.role || '').toUpperCase()
  const isReceptionist = role === 'RECEPTIONIST'
  const pageTitle = isReceptionist ? 'Intelligence Ledger' : 'Admin Invoice Center'
  const pageSubtitle = isReceptionist
    ? 'Comprehensive billing registry and product handoff monitoring interface.'
    : 'Review paid product pickup receipts, billing snapshots, pickup handoff, and email delivery health.'
  const pageLinks = isReceptionist ? receptionNav : adminNav
  const queryPrefix = isReceptionist ? 'reception-invoices' : 'admin-invoices'

  const [search, setSearch] = useState('')
  const [emailFilter, setEmailFilter] = useState('all')
  const [pickupFilter, setPickupFilter] = useState('all')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)

  const invoicesQuery = useQuery({
    queryKey: [queryPrefix],
    queryFn: adminInvoiceApi.getInvoices,
  })

  const confirmPickupMutation = useMutation({
    mutationFn: adminInvoiceApi.confirmPickup,
    onSuccess: async (_, invoiceId) => {
      await queryClient.invalidateQueries({ queryKey: [queryPrefix] })
      await queryClient.invalidateQueries({ queryKey: [queryPrefix, 'detail', invoiceId] })
    },
  })

  const resendEmailMutation = useMutation({
    mutationFn: adminInvoiceApi.resendEmail,
    onSuccess: async (_, invoiceId) => {
      await queryClient.invalidateQueries({ queryKey: [queryPrefix] })
      await queryClient.invalidateQueries({ queryKey: [queryPrefix, 'detail', invoiceId] })
    },
  })

  const invoices = useMemo(() => invoicesQuery.data?.invoices ?? [], [invoicesQuery.data])
  const pickupTrackingAvailableFromList = invoicesQuery.data?.pickupTrackingAvailable
  const activeInvoiceId = useMemo(() => {
    if (invoices.length === 0) return null
    return invoices.some((invoice) => invoice.invoiceId === selectedInvoiceId)
      ? selectedInvoiceId
      : invoices[0].invoiceId
  }, [invoices, selectedInvoiceId])

  const invoiceDetailQuery = useQuery({
    queryKey: [queryPrefix, 'detail', activeInvoiceId],
    queryFn: () => adminInvoiceApi.getInvoiceDetail(activeInvoiceId),
    enabled: activeInvoiceId != null,
  })
  const pickupTrackingAvailable =
    pickupTrackingAvailableFromList ?? invoiceDetailQuery.data?.pickupTrackingAvailable ?? true

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const emailStatus = getEmailStatus(invoice)
      const pickupStatus = invoice.pickedUpAt ? 'picked' : 'awaiting'
      if (emailFilter !== 'all' && emailStatus !== emailFilter) return false
      if (pickupTrackingAvailable && pickupFilter !== 'all' && pickupStatus !== pickupFilter) return false
      if (!normalizedSearch) return true
      const haystack = [
        invoice.invoiceCode,
        invoice.customerAccountName,
        invoice.customerAccountEmail,
        invoice.recipientName,
        invoice.recipientEmail,
        invoice.orderId,
        invoice.paymentId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [emailFilter, invoices, pickupFilter, pickupTrackingAvailable, search])

  const selectedInvoice = invoiceDetailQuery.data?.invoice ?? null
  const selectedItems = invoiceDetailQuery.data?.items ?? []
  const sentCount = invoices.filter((invoice) => getEmailStatus(invoice) === 'sent').length
  const failedCount = invoices.filter((invoice) => getEmailStatus(invoice) === 'failed').length
  const pendingCount = invoices.filter((invoice) => getEmailStatus(invoice) === 'pending').length
  const pickedUpCount = invoices.filter((invoice) => Boolean(invoice.pickedUpAt)).length

  if (isReceptionist) {
    return (
      <WorkspaceScaffold title={pageTitle} subtitle={pageSubtitle} links={pageLinks}>
        <div className="max-w-7xl space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8">
              <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                 <div>
                    <h2 className="font-display text-2xl font-bold text-white tracking-tight uppercase">Ledger Monitoring</h2>
                    <p className="mt-1 text-sm text-slate-500 font-medium">Synchronizing distributed billing snapshots across all facility zones.</p>
                 </div>
                 <div className="flex h-16 items-center gap-6 rounded-2xl bg-white/[0.03] px-8 border border-white/5">
                    <div className="text-center">
                       <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-0.5">Total Vectors</p>
                       <p className="text-sm font-black text-white tabular-nums">{invoices.length}</p>
                    </div>
                    <div className="h-6 w-px bg-white/10" />
                    <div className="text-center">
                       <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-0.5">Dispatched</p>
                       <p className="text-sm font-black text-white tabular-nums">{pickedUpCount}</p>
                    </div>
                    <div className="h-6 w-px bg-white/10" />
                    <div className="text-center">
                       <p className="text-[9px] font-black uppercase tracking-widest text-rose-500 mb-0.5">Attention</p>
                       <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                          <p className="text-sm font-black text-white tabular-nums">{failedCount + pendingCount}</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="flex flex-wrap gap-4 mb-10">
                 <div className="group relative flex-1 min-w-[300px]">
                    <div className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-1.5 ring-1 ring-white/10 transition-all focus-within:ring-gym-500/50 focus-within:bg-white/5">
                       <div className="pl-4 text-slate-500 group-focus-within:text-gym-500 transition-colors">
                          <Search className="h-4 w-4" />
                       </div>
                       <input
                          type="text"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Query ledger via ID, name, or metadata..."
                          className="h-10 w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
                       />
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <select
                       value={pickupFilter}
                       onChange={(e) => setPickupFilter(e.target.value)}
                       disabled={!pickupTrackingAvailable}
                       className="h-14 rounded-2xl border border-white/10 bg-white/5 px-6 text-xs font-black uppercase tracking-widest text-slate-400 outline-none hover:bg-white/10 transition-colors disabled:opacity-20"
                    >
                       {PICKUP_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
                    </select>
                    <select
                       value={emailFilter}
                       onChange={(e) => setEmailFilter(e.target.value)}
                       className="h-14 rounded-2xl border border-white/10 bg-white/5 px-6 text-xs font-black uppercase tracking-widest text-slate-400 outline-none hover:bg-white/10 transition-colors"
                    >
                       {EMAIL_OPTIONS.map((o) => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
                    </select>
                 </div>
              </div>

              <div className="overflow-hidden rounded-[2.5rem] border border-white/5 bg-white/[0.01]">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="bg-white/[0.02]">
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Log Identifier</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Subject Proxy</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Magnitude</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">State Vector</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Dispatch</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                       {invoicesQuery.isLoading ? (
                          <tr><td colSpan={5} className="py-20 text-center text-xs font-black uppercase tracking-widest text-slate-700 animate-pulse">Synchronizing Ledger...</td></tr>
                       ) : filteredInvoices.length === 0 ? (
                          <tr><td colSpan={5} className="py-20 text-center text-xs font-black uppercase tracking-widest text-slate-800">No active vectors matched query.</td></tr>
                       ) : (
                          filteredInvoices.map((invoice) => {
                             const isSelected = invoice.invoiceId === activeInvoiceId
                             return (
                                <tr 
                                   key={invoice.invoiceId} 
                                   onClick={() => setSelectedInvoiceId(invoice.invoiceId)}
                                   className={`group cursor-pointer transition-all duration-300 ${isSelected ? 'bg-gym-500/[0.04]' : 'hover:bg-white/[0.02]'}`}
                                >
                                   <td className="px-8 py-6">
                                      <div className="flex items-center gap-4">
                                         <div className={`h-1.5 w-1.5 rounded-full transition-all ${isSelected ? 'bg-gym-500 shadow-glow' : 'bg-transparent group-hover:bg-white/20'}`} />
                                         <div>
                                            <p className="text-sm font-bold text-white tracking-tight leading-none mb-1">{invoice.invoiceCode}</p>
                                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-500 transition-colors">T:{formatDateTime(invoice.paidAt)}</p>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="px-8 py-6">
                                      <p className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors uppercase truncate max-w-[200px]">{invoice.recipientName || invoice.customerAccountName}</p>
                                      <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:text-slate-500 mt-0.5 truncate max-w-[200px]">{invoice.recipientEmail || invoice.customerAccountEmail}</p>
                                   </td>
                                   <td className="px-8 py-6 text-right">
                                      <p className="text-sm font-black text-white tabular-nums tracking-tight">{formatMoney(invoice.totalAmount, invoice.currency)}</p>
                                   </td>
                                   <td className="px-8 py-6">
                                      <EmailStatusBadge invoice={invoice} />
                                   </td>
                                   <td className="px-8 py-6">
                                      <PickupStatusBadge invoice={invoice} pickupTrackingAvailable={pickupTrackingAvailable} />
                                   </td>
                                </tr>
                             )
                          })
                       )}
                    </tbody>
                 </table>
              </div>
           </section>

           {activeInvoiceId && (
              <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8 animate-in fade-in slide-in-from-right-4 duration-500 scroll-mt-8">
                 <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                       <div className="flex items-center gap-3 mb-2">
                          <div className="h-2 w-2 rounded-full bg-gym-500 shadow-glow" />
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gym-500">Registry Snapshot</p>
                       </div>
                       <h2 className="font-display text-3xl font-bold text-white tracking-tight uppercase leading-tight">
                          {selectedInvoice?.invoiceCode}
                       </h2>
                       <p className="mt-1 text-sm text-slate-500 font-medium">Detailed billing integrity report and logistics handoff verification.</p>
                    </div>
                    {selectedInvoice && (
                       <div className="flex h-14 items-center gap-6 rounded-2xl bg-white/[0.03] px-8 border border-white/5">
                          <div className="text-center">
                             <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-0.5">Magnitude</p>
                             <p className="text-lg font-black text-gym-500 tabular-nums tracking-tight">{formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency)}</p>
                          </div>
                       </div>
                    )}
                 </div>

                 {invoiceDetailQuery.isLoading ? (
                    <div className="flex items-center justify-center py-20 text-center">
                       <Loader2 className="h-10 w-10 animate-spin text-gym-500" />
                       <p className="ml-4 text-xs font-black uppercase tracking-widest text-slate-600">Retrieving high-fidelity detail...</p>
                    </div>
                 ) : selectedInvoice ? (
                    <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
                       <div className="space-y-10">
                          <div className="grid gap-6 sm:grid-cols-2">
                             <DetailItem label="Origin Subject" value={selectedInvoice.customerAccountName} subValue={selectedInvoice.customerAccountEmail} />
                             <DetailItem label="Recipient Signal" value={selectedInvoice.recipientName} subValue={selectedInvoice.recipientEmail} />
                             <DetailItem label="Temporal Marker" value={formatDateTime(selectedInvoice.paidAt)} icon={<Clock className="h-3 w-3" />} />
                             <DetailItem label="Gate Mode" value={selectedInvoice.paymentMethod} subValue="Verified Protocol" icon={<CreditCard className="h-3 w-3" />} />
                          </div>

                          <div className="rounded-[2.5rem] border border-white/5 bg-white/[0.01] overflow-hidden">
                             <div className="px-8 py-5 border-b border-white/5 bg-white/[0.02]">
                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Manifest Summary</p>
                             </div>
                             <div className="divide-y divide-white/5 px-8">
                                {selectedItems.map((item) => (
                                   <div key={item.invoiceItemId} className="py-6 flex items-center justify-between group">
                                      <div>
                                         <p className="text-sm font-bold text-white font-display mb-1">{item.productName}</p>
                                         <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">UNIT: {formatMoney(item.unitPrice)} • QTY: {item.quantity}</p>
                                      </div>
                                      <p className="text-sm font-black text-white tabular-nums tracking-tight">{formatMoney(item.lineTotal)}</p>
                                   </div>
                                ))}
                             </div>
                             <div className="p-8 bg-white/[0.02] border-t border-white/5 space-y-3">
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                                   <span>Subtotal Vector</span>
                                   <span className="text-white">{formatMoney(selectedInvoice.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                                   <span>Discount Offset</span>
                                   <span className="text-rose-500">-{formatMoney(selectedInvoice.discountAmount)}</span>
                                </div>
                                <div className="flex justify-between pt-4 border-t border-white/10">
                                   <span className="text-xs font-black text-gym-500 uppercase tracking-[0.3em]">Net Magnitude</span>
                                   <span className="text-xl font-black text-white tabular-nums tracking-tight">{formatMoney(selectedInvoice.totalAmount)}</span>
                                </div>
                             </div>
                          </div>
                       </div>

                       <div className="space-y-8">
                          <div className="rounded-[2rem] border border-gym-500/20 bg-gym-500/5 p-8 flex flex-col justify-between h-full max-h-[400px]">
                             <div>
                                <div className="flex items-center gap-3 mb-6">
                                   <div className="rounded-xl bg-gym-500 p-2 text-slate-950">
                                      <ShieldCheck className="h-5 w-5" />
                                   </div>
                                   <h4 className="text-lg font-bold text-white font-display uppercase tracking-tight">Logistics Verification</h4>
                                </div>
                                <p className="text-sm leading-relaxed text-slate-300 font-medium mb-8">
                                   Identify subject presenting order <span className="text-white font-bold tracking-widest">#{selectedInvoice.orderId}</span> to finalize product dispatch.
                                </p>
                             </div>

                             <div className="space-y-6">
                                <div className="flex items-center justify-between border-t border-white/10 pt-6">
                                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Current Pulse</span>
                                   <PickupStatusBadge invoice={selectedInvoice} pickupTrackingAvailable={pickupTrackingAvailable} isDetailed />
                                </div>
                                <button
                                   type="button"
                                   onClick={() => confirmPickupMutation.mutate(selectedInvoice.invoiceId)}
                                   disabled={!pickupTrackingAvailable || Boolean(selectedInvoice.pickedUpAt) || confirmPickupMutation.isPending}
                                   className="group relative h-16 w-full overflow-hidden rounded-2xl bg-gym-500 text-[10px] font-black uppercase tracking-[0.3em] text-slate-950 shadow-glow transition-all active:scale-95 disabled:opacity-20 disabled:shadow-none"
                                >
                                   {selectedInvoice.pickedUpAt ? 'Logistics Concluded' : confirmPickupMutation.isPending ? 'Verifying...' : 'Authorize Dispatch'}
                                </button>
                             </div>
                          </div>

                          <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-8 space-y-6">
                             <div className="flex items-center gap-4">
                                <Mail className="h-5 w-5 text-slate-500" />
                                <h4 className="text-xs font-black text-white uppercase tracking-widest">Cloud Correspondence</h4>
                             </div>
                             
                             <div className="flex items-center justify-between rounded-xl bg-white/5 p-5 border border-white/5">
                                <div>
                                   <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Status Vector</p>
                                   <EmailStatusBadge invoice={selectedInvoice} />
                                </div>
                                <button
                                   type="button"
                                   onClick={() => resendEmailMutation.mutate(selectedInvoice.invoiceId)}
                                   disabled={resendEmailMutation.isPending}
                                   className="h-10 px-6 rounded-lg bg-white/10 text-[9px] font-black text-white uppercase tracking-widest hover:bg-white/20 transition-all active:scale-95 disabled:opacity-20"
                                >
                                   {resendEmailMutation.isPending ? 'SENDING...' : 'Retransmit Signal'}
                                </button>
                             </div>

                             {selectedInvoice.emailSendError && (
                                <div className="rounded-xl bg-rose-500/10 p-4 border border-rose-500/20 flex items-start gap-3">
                                   <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                                   <p className="text-[10px] font-bold text-rose-300 leading-normal uppercase tracking-tight">{selectedInvoice.emailSendError}</p>
                                </div>
                             )}
                          </div>
                       </div>
                    </div>
                 ) : null}
              </section>
           )}
        </div>
      </WorkspaceScaffold>
    )
  }

  return (
    <WorkspaceScaffold title={pageTitle} subtitle={pageSubtitle} links={pageLinks}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Invoices</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                View every customer invoice generated after successful product payments.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search invoice, customer, order..."
                  className="w-44 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none sm:w-64"
                />
              </div>
              <select
                value={pickupFilter}
                onChange={(event) => setPickupFilter(event.target.value)}
                disabled={!pickupTrackingAvailable}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
              >
                {PICKUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={emailFilter}
                onChange={(event) => setEmailFilter(event.target.value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
              >
                {EMAIL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </header>

          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="Total invoices" value={invoices.length} tone="slate" />
            <SummaryCard label="Emails sent" value={sentCount} tone="emerald" />
            <SummaryCard label="Picked up" value={pickedUpCount} tone="gym" />
            <SummaryCard label="Need attention" value={failedCount + pendingCount} tone="amber" />
          </div>

          {!pickupTrackingAvailable && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Pickup tracking is unavailable on this database. Apply `docs/alter.txt` and restart the backend to enable
              front-desk pickup confirmation.
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Invoice</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Customer</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Total</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Paid at</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Pickup</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {invoicesQuery.isLoading && (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-center text-slate-500">Loading invoices...</td>
                  </tr>
                )}
                {!invoicesQuery.isLoading && filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-center text-slate-500">No invoices match the current filters.</td>
                  </tr>
                )}
                {filteredInvoices.map((invoice) => {
                  const isSelected = invoice.invoiceId === activeInvoiceId
                  return (
                    <tr key={invoice.invoiceId} className={isSelected ? 'bg-gym-50/60' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => setSelectedInvoiceId(invoice.invoiceId)} className="w-full text-left">
                          <p className="text-xs font-semibold text-slate-900">{invoice.invoiceCode}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Order #{invoice.orderId} • Payment #{invoice.paymentId}
                          </p>
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-xs font-medium text-slate-900">{invoice.customerAccountName || invoice.recipientName || '-'}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{invoice.recipientEmail || invoice.customerAccountEmail || '-'}</p>
                      </td>
                      <td className="px-3 py-2 text-xs font-semibold text-slate-900">{formatMoney(invoice.totalAmount, invoice.currency)}</td>
                      <td className="px-3 py-2 text-[11px] text-slate-600">{formatDateTime(invoice.paidAt)}</td>
                      <td className="px-3 py-2">
                        <PickupStatusBadge invoice={invoice} pickupTrackingAvailable={pickupTrackingAvailable} />
                      </td>
                      <td className="px-3 py-2">
                        <EmailStatusBadge invoice={invoice} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="rounded-xl bg-slate-900 p-2 text-white">
              <FileText size={16} />
            </span>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Invoice detail</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Inspect billing snapshot, line items, pickup handoff, and email delivery result.
              </p>
            </div>
          </header>

          {!activeInvoiceId && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Select an invoice from the table to view its detail.
            </div>
          )}

          {activeInvoiceId && invoiceDetailQuery.isLoading && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-500">
              Loading invoice detail...
            </div>
          )}

          {selectedInvoice && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailCard label="Invoice code" value={selectedInvoice.invoiceCode} />
                <DetailCard label="Paid at" value={formatDateTime(selectedInvoice.paidAt)} />
                <DetailCard label="Customer account" value={`${selectedInvoice.customerAccountName || '-'} (${selectedInvoice.customerAccountEmail || '-'})`} />
                <DetailCard label="Pickup receipt" value={`${selectedInvoice.recipientName || '-'} (${selectedInvoice.recipientEmail || '-'})`} />
                <DetailCard label="Phone" value={selectedInvoice.shippingPhone || '-'} />
                <DetailCard label="Payment method" value={selectedInvoice.paymentMethod || '-'} />
              </div>

              <div className="rounded-2xl border border-gym-100 bg-gym-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gym-700">Pickup instruction</h3>
                    <p className="mt-2 text-sm text-gym-900">
                      Customer presents Order #{selectedInvoice.orderId} at the gym front desk to collect the paid products.
                    </p>
                    <p className="mt-2 text-xs text-gym-700">
                      Status: {!pickupTrackingAvailable
                        ? 'Pickup tracking is unavailable on the current database schema.'
                        : selectedInvoice.pickedUpAt
                          ? `Picked up at ${formatDateTime(selectedInvoice.pickedUpAt)}`
                          : 'Waiting for front-desk handoff'}
                    </p>
                    {selectedInvoice.pickedUpByName ? (
                      <p className="mt-1 text-xs text-gym-700">Handled by: {selectedInvoice.pickedUpByName}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => confirmPickupMutation.mutate(selectedInvoice.invoiceId)}
                    disabled={!pickupTrackingAvailable || Boolean(selectedInvoice.pickedUpAt) || confirmPickupMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-full bg-gym-600 px-4 py-2 text-xs font-semibold text-white hover:bg-gym-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <CheckCircle2 size={14} />
                    {!pickupTrackingAvailable
                      ? 'Pickup tracking unavailable'
                      : selectedInvoice.pickedUpAt
                      ? 'Pickup confirmed'
                      : confirmPickupMutation.isPending
                        ? 'Confirming...'
                        : 'Confirm pickup'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items purchased</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedItems.map((item) => (
                    <div key={item.invoiceItemId} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.productName}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">Qty {item.quantity} • Unit {formatMoney(item.unitPrice, selectedInvoice.currency)}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatMoney(item.lineTotal, selectedInvoice.currency)}</p>
                    </div>
                  ))}
                  {selectedItems.length === 0 && (
                    <div className="px-4 py-3 text-sm text-slate-500">No invoice items found.</div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totals</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <strong>{formatMoney(selectedInvoice.subtotal, selectedInvoice.currency)}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Discount</span>
                      <strong>{formatMoney(selectedInvoice.discountAmount, selectedInvoice.currency)}</strong>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-slate-900">
                      <span>Total paid</span>
                      <strong>{formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency)}</strong>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email delivery</h3>
                  <div className="mt-3 flex items-start gap-3">
                    <span className="rounded-xl bg-white p-2 text-slate-700 shadow-sm ring-1 ring-slate-200">
                      <Mail size={16} />
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <EmailStatusBadge invoice={selectedInvoice} />
                      <p className="text-[11px] text-slate-500">
                        Sent at: {selectedInvoice.emailSentAt ? formatDateTime(selectedInvoice.emailSentAt) : 'Not sent yet'}
                      </p>
                      {!selectedInvoice.emailSentAt && (
                        <button
                          type="button"
                          onClick={() => resendEmailMutation.mutate(selectedInvoice.invoiceId)}
                          disabled={resendEmailMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <Mail size={12} />
                          {resendEmailMutation.isPending ? 'Sending...' : selectedInvoice.emailSendError ? 'Retry email' : 'Send email'}
                        </button>
                      )}
                      {selectedInvoice.emailSendError && (
                        <p className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] text-rose-700 ring-1 ring-rose-100">
                          {selectedInvoice.emailSendError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

function DetailItem({ label, value, subValue, icon }) {
  return (
    <div>
       <div className="flex items-center gap-2 mb-2">
          {icon && <span className="text-slate-600">{icon}</span>}
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">{label}</p>
       </div>
       <p className="text-sm font-bold text-white uppercase tracking-tight truncate">{value || '—'}</p>
       {subValue && <p className="text-[10px] font-bold text-slate-600 truncate mt-0.5">{subValue}</p>}
    </div>
  )
}

function SummaryCard({ label, value, tone }) {
  const toneClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    gym: 'border-gym-100 bg-gym-50 text-gym-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
  }[tone] || 'border-slate-200 bg-slate-50 text-slate-900'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  )
}

function DetailCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

function EmailStatusBadge({ invoice }) {
  const status = getEmailStatus(invoice)
  const isSent = status === 'sent'
  const isFailed = status === 'failed'
  
  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 ring-1 ${
      isSent ? 'bg-sky-500/10 text-sky-400 ring-sky-500/20' : isFailed ? 'bg-rose-500/10 text-rose-400 ring-rose-500/20' : 'bg-white/5 text-slate-500 ring-white/10'
    }`}>
       <span className="text-[9px] font-black uppercase tracking-widest">
         {isSent ? 'Notified' : isFailed ? 'Alert' : 'Pending'}
       </span>
    </div>
  )
}

function PickupStatusBadge({ invoice, pickupTrackingAvailable, isDetailed = false }) {
  if (!pickupTrackingAvailable) {
    if (isDetailed) return <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Tracking Disabled</span>
    return (
      <span className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1 ring-1 bg-white/5 text-slate-600 ring-white/10">
        <span className="text-[9px] font-black uppercase tracking-widest">Untracked</span>
      </span>
    )
  }

  const pickedUp = Boolean(invoice?.pickedUpAt)
  if (isDetailed) {
     return (
        <div className="flex items-center gap-2">
           <div className={`h-1.5 w-1.5 rounded-full ${pickedUp ? 'bg-emerald-500 shadow-glow' : 'bg-amber-500'}`} />
           <span className={`text-[10px] font-black uppercase tracking-widest ${pickedUp ? 'text-emerald-500' : 'text-amber-500'}`}>
              {pickedUp ? 'Concluded' : 'Awaiting'}
           </span>
        </div>
     )
  }

  return (
    <div className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 ring-1 ${
      pickedUp ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20 shadow-glow-sm' : 'bg-amber-500/10 text-amber-500 ring-amber-500/20'
    }`}>
       <span className="text-[9px] font-black uppercase tracking-widest">
         {pickedUp ? 'Dispatched' : 'Awaiting'}
       </span>
    </div>
  )
}

function getEmailStatus(invoice) {
  if (invoice?.emailSentAt) return 'sent'
  if (invoice?.emailSendError) return 'failed'
  return 'pending'
}

function formatMoney(amount, currency = 'VND') {
  return `${Number(amount || 0).toLocaleString('en-US')} ${currency || 'VND'}`
}

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default AdminInvoicesPage
