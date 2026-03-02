import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminPromotionApi } from '../../features/promotion/api/adminPromotionApi'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { TrendingUp, ShoppingBag, CreditCard, Download, Calendar, BarChart3 } from 'lucide-react'
import { toast } from 'react-hot-toast'

const AdminReportsPage = () => {
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['revenueReport'],
    queryFn: () => adminPromotionApi.getRevenueReport(),
  })

  const exportPdf = async () => {
    try {
      const blob = await adminPromotionApi.exportRevenuePdf()
      const url = window.URL.createObjectURL(new Blob([blob]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `GymCore_Revenue_Report_${new Date().toISOString().split('T')[0]}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      toast.success('PDF Report downloaded!')
    } catch {
      toast.error('Failed to export PDF')
    }
  }

  const reports = reportData?.data || { productOrders: [], memberships: [] }
  const productRevenue = reports.productOrders || []
  const membershipRevenue = reports.memberships || []

  const totalProductAmount = productRevenue.reduce((sum, r) => sum + (r.RevenueAmount || 0), 0)
  const totalMembershipAmount = membershipRevenue.reduce((sum, r) => sum + (r.RevenueAmount || 0), 0)
  const totalRevenue = totalProductAmount + totalMembershipAmount

  return (
    <WorkspaceScaffold
      title="Revenue Intelligence"
      subtitle="Track your gym's financial performance with integrated data and exportable reports."
      links={adminNav}
    >
      <div className="space-y-8">
        {/* Header Actions */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gym-100 text-gym-600 rounded-lg">
              <BarChart3 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Performance Snapshot</h2>
              <p className="text-xs text-slate-500">Real-time revenue aggregation from all sources.</p>
            </div>
          </div>
          <button
            onClick={exportPdf}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
          >
            <Download size={18} /> Export PDF Report
          </button>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ReportCard
            title="Total Revenue"
            amount={totalRevenue}
            icon={<TrendingUp className="text-gym-600" />}
            color="bg-gym-50"
            subtext="Combined income"
          />
          <ReportCard
            title="Product Sales"
            amount={totalProductAmount}
            icon={<ShoppingBag className="text-blue-600" />}
            color="bg-blue-50"
            subtext={`${productRevenue.length} active entries`}
          />
          <ReportCard
            title="Memberships"
            amount={totalMembershipAmount}
            icon={<CreditCard className="text-purple-600" />}
            color="bg-purple-50"
            subtext={`${membershipRevenue.length} active entries`}
          />
        </div>

        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Products Revenue */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ShoppingBag size={18} className="text-blue-600" />
                Product Revenue
              </h3>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">History</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 font-bold">Date</th>
                    <th className="px-6 py-3 font-bold">Orders</th>
                    <th className="px-6 py-3 font-bold text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan="3" className="p-8 text-center text-slate-400 text-sm">Loading...</td></tr>
                  ) : productRevenue.length === 0 ? (
                    <tr><td colSpan="3" className="p-8 text-center text-slate-400 text-sm">No data available</td></tr>
                  ) : productRevenue.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600 flex items-center gap-2">
                        <Calendar size={14} className="text-slate-300" />
                        {row.RevenueDate}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.PaidOrders}</td>
                      <td className="px-6 py-4 text-sm font-extrabold text-blue-600 text-right">
                        {Number(row.RevenueAmount).toLocaleString()} VND
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Membership Revenue */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <CreditCard size={18} className="text-purple-600" />
                Membership Revenue
              </h3>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">History</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-slate-50 text-[10px] text-slate-500 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 font-bold">Date</th>
                    <th className="px-6 py-3 font-bold">Count</th>
                    <th className="px-6 py-3 font-bold text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading ? (
                    <tr><td colSpan="3" className="p-8 text-center text-slate-400 text-sm">Loading...</td></tr>
                  ) : membershipRevenue.length === 0 ? (
                    <tr><td colSpan="3" className="p-8 text-center text-slate-400 text-sm">No data available</td></tr>
                  ) : membershipRevenue.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600 flex items-center gap-2">
                        <Calendar size={14} className="text-slate-300" />
                        {row.RevenueDate}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.PaidMemberships}</td>
                      <td className="px-6 py-4 text-sm font-extrabold text-purple-600 text-right">
                        {Number(row.RevenueAmount).toLocaleString()} VND
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceScaffold>
  )
}

const ReportCard = ({ title, amount, icon, color, subtext }) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between group transition-all hover:shadow-xl hover:border-gym-100">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-2xl ${color} transition-transform group-hover:scale-110 duration-300`}>
        {icon}
      </div>
      <div className="text-right">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <h4 className="text-2xl font-black text-slate-900 mt-1 whitespace-nowrap">
          {Number(amount).toLocaleString()} <span className="text-xs font-medium text-slate-400">VND</span>
        </h4>
      </div>
    </div>
    <div className="pt-4 border-t border-slate-50 flex items-center gap-2">
      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{subtext}</span>
    </div>
  </div>
)

export default AdminReportsPage
