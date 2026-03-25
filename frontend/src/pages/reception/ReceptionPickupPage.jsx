import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Search, Ticket, Package, User, Clock, Loader2, ChevronRight, X, Info, ShieldCheck, Mail } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { receptionNav } from '../../config/navigation'
import { adminInvoiceApi } from '../../features/product/api/adminInvoiceApi'

const PICKUP_FILTERS = [
  { value: 'all', label: 'All states' },
  { value: 'awaiting', label: 'Awaiting pickup' },
  { value: 'picked', label: 'Picked up' },
]

const EMAIL_FILTERS = [
  { value: 'all', label: 'All notifications' },
  { value: 'sent', label: 'Email sent' },
  { value: 'failed', label: 'Email failed' },
  { value: 'pending', label: 'Email pending' },
]

function ReceptionPickupPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [pickupFilter, setPickupFilter] = useState('awaiting')
  const [emailFilter, setEmailFilter] = useState('all')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)

  const invoicesQuery = useQuery({
    queryKey: ['reception-pickup-invoices'],
    queryFn: adminInvoiceApi.getInvoices,
  })

  const invoices = useMemo(() => invoicesQuery.data?.invoices ?? [], [invoicesQuery.data])

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const pickupState = invoice.pickedUpAt ? 'picked' : 'awaiting'
      const emailState = getEmailState(invoice)
      if (pickupFilter !== 'all' && pickupFilter !== pickupState) return false
      if (emailFilter !== 'all' && emailFilter !== emailState) return false
      if (!normalizedSearch) return true
      const haystack = [
        invoice.invoiceCode,
        invoice.orderId,
        invoice.paymentId,
        invoice.customerAccountName,
        invoice.customerAccountEmail,
        invoice.recipientName,
        invoice.recipientEmail,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [emailFilter, invoices, pickupFilter, search])

  const activeInvoiceId = useMemo(() => {
    if (filteredInvoices.length === 0) return null
    return filteredInvoices.some((invoice) => invoice.invoiceId === selectedInvoiceId)
      ? selectedInvoiceId
      : filteredInvoices[0].invoiceId
  }, [filteredInvoices, selectedInvoiceId])

  const invoiceDetailQuery = useQuery({
    queryKey: ['reception-pickup-invoice-detail', activeInvoiceId],
    queryFn: () => adminInvoiceApi.getInvoiceDetail(activeInvoiceId),
    enabled: activeInvoiceId != null,
  })

  const confirmPickupMutation = useMutation({
    mutationFn: adminInvoiceApi.confirmPickup,
    onSuccess: async (_, invoiceId) => {
      await queryClient.invalidateQueries({ queryKey: ['reception-pickup-invoices'] })
      await queryClient.invalidateQueries({ queryKey: ['reception-pickup-invoice-detail', invoiceId] })
    },
  })

  const selectedInvoice = invoiceDetailQuery.data?.invoice ?? null
  const selectedItems = invoiceDetailQuery.data?.items ?? []
  const awaitingCount = invoices.filter((invoice) => !invoice.pickedUpAt).length
  const pickedCount = invoices.filter((invoice) => Boolean(invoice.pickedUpAt)).length

  return (
    <WorkspaceScaffold
      title="Logistics Handoff Terminal"
      subtitle="Finalize product collection workflows. Verifying subject identity and paid receipts in real-time."
      links={receptionNav}
    >
      <div className="max-w-7xl space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
           <div className="space-y-8">
              <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8">
                 <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                       <h2 className="font-display text-2xl font-bold text-white tracking-tight uppercase">Handoff Queue</h2>
                       <p className="mt-1 text-sm text-slate-500">Monitoring active product collection requests.</p>
                    </div>
                    <div className="flex h-14 items-center gap-6 rounded-2xl bg-white/[0.03] px-6 border border-white/5">
                        <div className="text-center">
                           <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-0.5">Awaiting</p>
                           <p className="text-sm font-black text-white">{awaitingCount}</p>
                        </div>
                        <div className="h-6 w-px bg-white/10" />
                        <div className="text-center">
                           <p className="text-[9px] font-black uppercase tracking-widest text-gym-500 mb-0.5">Dispatched</p>
                           <p className="text-sm font-black text-white">{pickedCount}</p>
                        </div>
                    </div>
                 </div>

                 <div className="flex flex-wrap gap-3 mb-8">
                    <div className="group relative flex-1 min-w-[300px]">
                       <div className="flex items-center gap-4 rounded-2xl bg-white/[0.03] p-1.5 ring-1 ring-white/10 transition-all focus-within:ring-gym-500/50 focus-within:bg-white/5">
                          <div className="pl-4 text-slate-500 group-focus-within:text-gym-500">
                             <Search className="h-4 w-4" />
                          </div>
                          <input
                             type="text"
                             value={search}
                             onChange={(e) => setSearch(e.target.value)}
                             placeholder="Synchronize by order identifier..."
                             className="h-10 w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
                          />
                       </div>
                    </div>
                    <select
                       value={pickupFilter}
                       onChange={(e) => setPickupFilter(e.target.value)}
                       className="rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-widest text-slate-400 outline-none hover:bg-white/10 transition-colors"
                    >
                       {PICKUP_FILTERS.map((o) => <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>)}
                    </select>
                    <button 
                       onClick={() => queryClient.invalidateQueries({ queryKey: ['reception-pickup-invoices'] })}
                       className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                       <Loader2 className={`h-4 w-4 ${invoicesQuery.isLoading ? 'animate-spin text-gym-500' : ''}`} />
                    </button>
                 </div>

                 <div className="space-y-4">
                    {invoicesQuery.isLoading && <div className="py-12 text-center animate-pulse text-xs font-black uppercase tracking-widest text-slate-600">Synchronizing queue...</div>}
                    {!invoicesQuery.isLoading && filteredInvoices.length === 0 && (
                       <div className="rounded-[2rem] border border-dashed border-white/10 p-16 text-center">
                          <Package className="h-10 w-10 text-slate-800 mx-auto mb-4" />
                          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-600">No matching vectors in active queue.</p>
                       </div>
                    )}
                    {filteredInvoices.map((invoice) => {
                       const isSelected = invoice.invoiceId === activeInvoiceId
                       return (
                          <button
                             key={invoice.invoiceId}
                             type="button"
                             onClick={() => setSelectedInvoiceId(invoice.invoiceId)}
                             className={`group relative w-full overflow-hidden rounded-[2rem] border p-6 text-left transition-all duration-300 ${
                                isSelected ? 'border-gym-500 bg-gym-500/5 shadow-glow-sm' : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                             }`}
                          >
                             <div className="relative z-10 flex items-start justify-between">
                                <div>
                                   <div className="flex items-center gap-3 mb-3">
                                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Paid Handoff Ticket</p>
                                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-gym-500 shadow-glow" />}
                                   </div>
                                   <h3 className="font-display text-xl font-bold text-white tracking-tight leading-none mb-2">{invoice.invoiceCode}</h3>
                                   <p className="text-xs font-bold text-slate-400 opacity-60 uppercase mb-4 tracking-widest">
                                      {invoice.recipientName || invoice.customerAccountName || 'Unknown Subject'}
                                   </p>
                                   <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-2">
                                         <Clock className="h-3 w-3 text-slate-600" />
                                         <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Order #{invoice.orderId}</span>
                                      </div>
                                   </div>
                                </div>
                                <div className="flex flex-col gap-2 items-end">
                                   <PickupStatusBadge pickedUpAt={invoice.pickedUpAt} />
                                   <EmailStatusBadge invoice={invoice} />
                                </div>
                             </div>
                             {isSelected && <div className="absolute inset-x-0 bottom-0 h-1 bg-gym-500 shadow-glow" />}
                          </button>
                       )
                    })}
                 </div>
              </section>
           </div>

           <aside className="space-y-8">
              <section className="gc-glass-panel border-white/5 bg-white/[0.02] p-8 sticky top-8">
                 <div className="mb-6 flex items-center justify-between">
                    <div>
                       <h2 className="font-display text-xl font-bold text-white tracking-tight uppercase leading-tight">Registry Detail</h2>
                       <p className="mt-1 text-xs text-slate-500 uppercase tracking-widest font-black opacity-60">Identity verification</p>
                    </div>
                    {selectedInvoice && (
                       <div className="rounded-xl bg-gym-500/10 p-2.5 text-gym-500 ring-1 ring-gym-500/20">
                          <ShieldCheck className="h-5 w-5" />
                       </div>
                    )}
                 </div>

                 {!selectedInvoice && !invoiceDetailQuery.isLoading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                       <div className="rounded-full bg-white/5 p-6 border border-white/5 mb-4">
                          <Search className="h-8 w-8 text-slate-700" />
                       </div>
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 leading-relaxed">Awaiting selection for<br/>logistics handoff protocol.</p>
                    </div>
                 )}

                 {invoiceDetailQuery.isLoading && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                       <Loader2 className="h-10 w-10 animate-spin text-gym-500 mb-4" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Retrieving Snapshot...</p>
                    </div>
                 )}

                 {selectedInvoice && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                       <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                          <DetailRow label="Subject Identity" value={selectedInvoice.customerAccountName || selectedInvoice.recipientName} />
                          <DetailRow label="Contact Proxy" value={selectedInvoice.recipientEmail || selectedInvoice.customerAccountEmail} />
                          <DetailRow label="Temporal Marker" value={formatDateTime(selectedInvoice.paidAt)} />
                       </div>

                       <div className="rounded-2xl border border-gym-500/20 bg-gym-500/5 p-5">
                          <div className="flex items-start gap-4 mb-4">
                             <div className="rounded-xl bg-gym-500 p-2 text-slate-950">
                                <Info className="h-4 w-4" />
                             </div>
                             <div>
                                <p className="text-xs font-black uppercase tracking-widest text-gym-500">Handoff Instructions</p>
                                <p className="mt-2 text-sm leading-relaxed text-slate-300 font-medium lowercase">
                                   Verify identification for order <span className="text-white font-bold tracking-widest">#{selectedInvoice.orderId}</span> prior to kit dissemination.
                                </p>
                             </div>
                          </div>
                          <button
                             type="button"
                             onClick={() => confirmPickupMutation.mutate(selectedInvoice.invoiceId)}
                             disabled={Boolean(selectedInvoice.pickedUpAt) || confirmPickupMutation.isPending}
                             className="group relative h-14 w-full overflow-hidden rounded-xl bg-gym-500 text-[10px] font-black uppercase tracking-[0.25em] text-slate-950 shadow-glow transition-all active:scale-95 disabled:opacity-20 disabled:shadow-none"
                          >
                             <span className="relative z-10">
                                {selectedInvoice.pickedUpAt ? 'Logistics Concluded' : confirmPickupMutation.isPending ? 'Propagating...' : 'Confirm Dispatch'}
                             </span>
                          </button>
                       </div>

                       <div className="rounded-2xl border border-white/5 bg-white/[0.03] overflow-hidden">
                          <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02]">
                             <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Manifest Summary</p>
                          </div>
                          <div className="divide-y divide-white/5">
                             {selectedItems.map((item) => (
                                <div key={item.invoiceItemId} className="px-5 py-4 flex items-center justify-between group hover:bg-white/[0.01] transition-colors">
                                   <div className="min-w-0">
                                      <p className="text-xs font-bold text-white truncate">{item.productName}</p>
                                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-1">QTY: {item.quantity}</p>
                                   </div>
                                   <p className="text-xs font-black text-slate-400 tabular-nums">{formatMoney(item.lineTotal, selectedInvoice.currency)}</p>
                                </div>
                             ))}
                             {selectedItems.length === 0 && <div className="p-5 text-center text-[10px] font-bold text-slate-700 italic">No manifest items indexed.</div>}
                          </div>
                       </div>
                       
                       <div className="flex items-center gap-4 rounded-xl bg-white/[0.02] p-4 border border-white/5">
                          <div className="rounded-lg bg-white/5 p-2 text-slate-500">
                             <Mail className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                             <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Receipt Synchronization</p>
                             <EmailStatusBadge invoice={selectedInvoice} />
                          </div>
                       </div>
                    </div>
                 )}
              </section>
           </aside>
        </div>
      </div>
    </WorkspaceScaffold>
  )
}

function DetailRow({ label, value }) {
  return (
    <div>
       <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">{label}</p>
       <p className="text-sm font-bold text-white truncate">{value || '—'}</p>
    </div>
  )
}

function PickupStatusBadge({ pickedUpAt }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-1 ring-1 transition-all ${
      pickedUpAt
        ? 'bg-emerald-500/10 text-emerald-500 ring-emerald-500/20 shadow-glow-sm'
        : 'bg-amber-500/10 text-amber-500 ring-amber-500/20'
    }`}>
      <div className={`h-1 w-1 rounded-full ${pickedUpAt ? 'bg-emerald-500 shadow-glow' : 'bg-amber-500'}`} />
      <span className="text-[9px] font-black uppercase tracking-widest">{pickedUpAt ? 'Dispatched' : 'Awaiting'}</span>
    </div>
  )
}

function EmailStatusBadge({ invoice }) {
  const status = getEmailState(invoice)
  const isSent = status === 'sent'
  const isFailed = status === 'failed'
  
  return (
    <div className={`flex items-center gap-2 rounded-lg px-2.5 py-1 ring-1 ${
      isSent ? 'bg-sky-500/10 text-sky-400 ring-sky-500/20' : isFailed ? 'bg-rose-500/10 text-rose-400 ring-rose-500/20' : 'bg-white/5 text-slate-500 ring-white/10'
    }`}>
       <span className="text-[9px] font-black uppercase tracking-widest">
         {isSent ? 'Notified' : isFailed ? 'Alert' : 'Pending'}
       </span>
    </div>
  )
}

function getEmailState(invoice) {
  if (invoice?.emailSentAt) return 'sent'
  if (invoice?.emailSendError) return 'failed'
  return 'pending'
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
}

function formatMoney(amount, currency = 'VND') {
  return `${Number(amount || 0).toLocaleString('en-US')} ${currency || 'VND'}`
}

export default ReceptionPickupPage
