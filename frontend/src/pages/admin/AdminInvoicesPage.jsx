import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Mail, Search } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav, receptionNav } from '../../config/navigation'
import { useSession } from '../../features/auth/useSession'
import { adminInvoiceApi } from '../../features/product/api/adminInvoiceApi'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All emails' },
  { value: 'sent', label: 'Sent' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
]

function AdminInvoicesPage() {
  const { user } = useSession()
  const role = String(user?.role || '').toUpperCase()
  const isReceptionist = role === 'RECEPTIONIST'
  const pageTitle = isReceptionist ? 'Reception Invoice Center' : 'Admin Invoice Center'
  const pageSubtitle = isReceptionist
    ? 'Review customer product invoices and invoice email delivery status from the front desk.'
    : 'Review every product invoice, inspect purchased items, and monitor invoice email delivery without changing customer flows.'
  const pageLinks = isReceptionist ? receptionNav : adminNav
  const queryPrefix = isReceptionist ? 'reception-invoices' : 'admin-invoices'

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null)

  const invoicesQuery = useQuery({
    queryKey: [queryPrefix],
    queryFn: adminInvoiceApi.getInvoices,
  })

  const invoices = invoicesQuery.data?.data?.invoices ?? []

  useEffect(() => {
    if (invoices.length === 0) {
      setSelectedInvoiceId(null)
      return
    }
    const hasSelected = invoices.some((invoice) => invoice.invoiceId === selectedInvoiceId)
    if (!hasSelected) {
      setSelectedInvoiceId(invoices[0].invoiceId)
    }
  }, [invoices, selectedInvoiceId])

  const invoiceDetailQuery = useQuery({
    queryKey: [queryPrefix, 'detail', selectedInvoiceId],
    queryFn: () => adminInvoiceApi.getInvoiceDetail(selectedInvoiceId),
    enabled: selectedInvoiceId != null,
  })

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const emailStatus = getEmailStatus(invoice)
      const matchesStatus = statusFilter === 'all' || emailStatus === statusFilter
      if (!matchesStatus) {
        return false
      }
      if (!normalizedSearch) {
        return true
      }
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
  }, [invoices, search, statusFilter])

  const selectedInvoice = invoiceDetailQuery.data?.data?.invoice ?? null
  const selectedItems = invoiceDetailQuery.data?.data?.items ?? []

  const sentCount = invoices.filter((invoice) => getEmailStatus(invoice) === 'sent').length
  const failedCount = invoices.filter((invoice) => getEmailStatus(invoice) === 'failed').length
  const pendingCount = invoices.filter((invoice) => getEmailStatus(invoice) === 'pending').length

  return (
    <WorkspaceScaffold
      title={pageTitle}
      subtitle={pageSubtitle}
      links={pageLinks}
    >
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
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <div className="grid gap-3 md:grid-cols-3">
            <SummaryCard label="Total invoices" value={invoices.length} tone="slate" />
            <SummaryCard label="Emails sent" value={sentCount} tone="emerald" />
            <SummaryCard label="Need attention" value={failedCount + pendingCount} tone="amber" />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Invoice</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Customer</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Total</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Paid at</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {invoicesQuery.isLoading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-slate-500">Loading invoices...</td>
                  </tr>
                )}
                {!invoicesQuery.isLoading && filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-slate-500">No invoices match the current filters.</td>
                  </tr>
                )}
                {filteredInvoices.map((invoice) => {
                  const isSelected = invoice.invoiceId === selectedInvoiceId
                  return (
                    <tr
                      key={invoice.invoiceId}
                      className={isSelected ? 'bg-gym-50/60' : 'hover:bg-slate-50'}
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceId(invoice.invoiceId)}
                          className="w-full text-left"
                        >
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
                      <td className="px-3 py-2 text-xs font-semibold text-slate-900">
                        {formatMoney(invoice.totalAmount, invoice.currency)}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-600">
                        {formatDateTime(invoice.paidAt)}
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
                Inspect billing snapshot, line items, and email delivery result.
              </p>
            </div>
          </header>

          {!selectedInvoiceId && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Select an invoice from the table to view its detail.
            </div>
          )}

          {selectedInvoiceId && invoiceDetailQuery.isLoading && (
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
                <DetailCard label="Recipient" value={`${selectedInvoice.recipientName || '-'} (${selectedInvoice.recipientEmail || '-'})`} />
                <DetailCard label="Phone" value={selectedInvoice.shippingPhone || '-'} />
                <DetailCard label="Payment method" value={selectedInvoice.paymentMethod || '-'} />
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shipping address</h3>
                <p className="mt-2 text-sm text-slate-800">{selectedInvoice.shippingAddress || '-'}</p>
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

function SummaryCard({ label, value, tone }) {
  const toneClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
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
  const label = status === 'sent' ? 'Email sent' : status === 'failed' ? 'Email failed' : 'Pending send'
  const className =
    status === 'sent'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : status === 'failed'
        ? 'bg-rose-50 text-rose-700 ring-rose-100'
        : 'bg-amber-50 text-amber-700 ring-amber-100'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${className}`}>
      {label}
    </span>
  )
}

function getEmailStatus(invoice) {
  if (invoice?.emailSentAt) {
    return 'sent'
  }
  if (invoice?.emailSendError) {
    return 'failed'
  }
  return 'pending'
}

function formatMoney(amount, currency = 'VND') {
  return `${Number(amount || 0).toLocaleString('en-US')} ${currency || 'VND'}`
}

function formatDateTime(value) {
  if (!value) {
    return '-'
  }
  return new Date(value).toLocaleString()
}

export default AdminInvoicesPage
