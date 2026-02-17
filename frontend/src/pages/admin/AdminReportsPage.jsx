import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange, ArrowRight } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { reportApi } from '../../features/admin/api/reportApi'

function AdminReportsPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const productRevenueQuery = useQuery({
    queryKey: ['admin-product-revenue', { from, to }],
    queryFn: () => reportApi.getProductRevenue({ from: from || undefined, to: to || undefined }),
  })

  const data = productRevenueQuery.data?.data ?? { summary: { totalRevenue: 0, count: 0 }, orders: [] }
  const summary = data.summary ?? { totalRevenue: 0, count: 0, currency: 'VND' }
  const orders = data.orders ?? []

  return (
    <WorkspaceScaffold
      title="Admin Reports"
      subtitle="Quick view of paid product revenue."
      links={adminNav}
    >
      <div className="space-y-6">
        {/* Filters + summary */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 p-1.5 text-white">
                <CalendarRange size={14} />
              </span>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Product revenue (PAID orders)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Filter by payment date range and review paid product orders.
                </p>
              </div>
            </div>
          </header>

          <div className="grid gap-4 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)]">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <DateField label="From date" value={from} onChange={setFrom} />
                <DateField label="To date" value={to} onChange={setTo} />
              </div>
              <p className="text-[11px] text-slate-500">
                Dates are optional. Leave empty to see all paid orders.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] text-slate-500">Total revenue</p>
                  <p className="text-base font-bold text-gym-600">
                    {Number(summary.totalRevenue || 0).toLocaleString('en-US')}{' '}
                    <span className="text-xs font-medium text-slate-500">{summary.currency || 'VND'}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Paid orders</p>
                  <p className="text-base font-semibold text-slate-900">{summary.count || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Orders table */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Paid product orders
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Each row corresponds to a confirmed payment linked to an order.
              </p>
            </div>
            <span className="text-[11px] text-slate-500">
              {orders.length} order{orders.length === 1 ? '' : 's'}
            </span>
          </header>

          <div className="max-h-[420px] overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Order</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Customer</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Total (VND)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {productRevenueQuery.isLoading && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-center text-slate-500">
                      Loading revenue data...
                    </td>
                  </tr>
                )}
                {!productRevenueQuery.isLoading && orders.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-center text-slate-500">
                      No paid orders found for the selected range.
                    </td>
                  </tr>
                )}
                {orders.map((order) => (
                  <tr key={order.orderId}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 text-xs font-semibold text-slate-900">
                        <span>#{order.orderId}</span>
                        <ArrowRight size={10} className="text-slate-400" />
                        <span className="text-[11px] text-slate-500">PAID</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-800">{order.customerName}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {order.orderDate ? new Date(order.orderDate).toLocaleString() : ''}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-slate-900">
                      {Number(order.totalAmount || 0).toLocaleString('en-US')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

function DateField({ label, value, onChange }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
      />
    </div>
  )
}

export default AdminReportsPage
