import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminPromotionApi } from '../../features/promotion/api/adminPromotionApi'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import {
  TrendingUp, ShoppingBag, CreditCard, Download, Calendar,
  BarChart3, ArrowUpRight, Zap, Target, Shield,
  Activity, PieChart, FileText, Globe
} from 'lucide-react'
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
      link.setAttribute('download', `GymCore_Strategic_Intel_${new Date().toISOString().split('T')[0]}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      toast.success('Strategic Intel exported successfully.')
    } catch (error) {
      toast.error('Export sequence failed.')
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
      title="Strategic Intel"
      subtitle="Financial trajectory analysis and operational revenue matrices."
      links={adminNav}
    >
      <div className="space-y-12 pb-20 animate-in fade-in duration-700">

        {/* Tactical Command Header */}
        <header className="flex flex-wrap items-center justify-between gap-8 bg-gym-dark-900 p-8 rounded-[40px] border-4 border-gym-dark-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gym-500/10 -mr-32 -mt-32 rounded-full blur-3xl"></div>

          <div className="relative flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-gym-500 text-gym-dark-900 flex items-center justify-center shadow-lg shadow-gym-500/20">
              <Activity size={32} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Revenue Command</h2>
              <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-[0.2em] mt-1">Real-Time Fiscal Synchronization</p>
            </div>
          </div>

          <button
            onClick={exportPdf}
            className="btn-primary px-10 py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-gym-500/20 active:scale-95 transition-all relative z-10"
          >
            <Download size={20} strokeWidth={3} /> Export PDF Intelligence
          </button>
        </header>

        {/* Intelligence Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ReportCard
            title="Total Revenue Matrix"
            amount={totalRevenue}
            icon={<TrendingUp size={24} strokeWidth={3} />}
            variant="dark"
            subtext="Consolidated Capital"
            trend="+12.5% vs Last Period"
          />
          <ReportCard
            title="Logistic Gear Sales"
            amount={totalProductAmount}
            icon={<ShoppingBag size={24} strokeWidth={3} />}
            variant="white"
            subtext={`${productRevenue.length} Deployed Orders`}
            trend="+8.2%"
          />
          <ReportCard
            title="Membership Protocols"
            amount={totalMembershipAmount}
            icon={<Shield size={24} strokeWidth={3} />}
            variant="white"
            subtext={`${membershipRevenue.length} Active Authorizations`}
            trend="+15.1%"
          />
        </div>

        {/* Data Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Tactical Gear Revenue Log */}
          <article className="gc-card-compact border-2 border-gym-dark-50 bg-white shadow-xl shadow-gym-dark-900/5 h-full flex flex-col overflow-hidden">
            <header className="px-8 py-8 border-b-2 border-gym-dark-50 flex items-center justify-between bg-gym-dark-50/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-gym-dark-900 text-gym-500 flex items-center justify-center">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight italic">Gear Deployment Revenue</h3>
                  <p className="text-[9px] font-bold text-gym-dark-400 uppercase tracking-widest">Historical Procurement Data</p>
                </div>
              </div>
              <PieChart size={20} className="text-gym-dark-200" />
            </header>

            <div className="flex-1 overflow-x-auto custom-scrollbar max-h-[500px]">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-gym-dark-900 text-gym-500 text-[10px] font-black uppercase tracking-[0.2em] z-10">
                  <tr>
                    <th className="px-10 py-5">Sync Date</th>
                    <th className="px-10 py-5 text-center">Unit Count</th>
                    <th className="px-10 py-5 text-right">Fiscal Inflow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gym-dark-50">
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan="3" className="px-10 py-10 bg-gym-dark-50/20"></td>
                      </tr>
                    ))
                  ) : productRevenue.length === 0 ? (
                    <tr><td colSpan="3" className="px-10 py-20 text-center text-gym-dark-200 uppercase font-black text-xs italic tracking-widest">Data Vector Null</td></tr>
                  ) : productRevenue.map((row, i) => (
                    <tr key={i} className="hover:bg-gym-50/50 transition-colors group">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-3">
                          <Calendar size={14} className="text-gym-dark-200 group-hover:text-gym-500 transition-colors" />
                          <span className="text-sm font-black text-gym-dark-700 group-hover:text-gym-dark-900 transition-colors">{row.RevenueDate}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className="px-3 py-1 rounded-full bg-gym-dark-900 text-gym-500 text-[9px] font-black uppercase tracking-widest">
                          {row.PaidOrders} ORDERS
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <p className="text-sm font-black text-gym-dark-900 italic">{Number(row.RevenueAmount).toLocaleString()} <span className="text-[10px] text-gym-dark-300 not-italic">VND</span></p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          {/* Authorization Protocol Revenue Log */}
          <article className="gc-card-compact border-2 border-gym-dark-50 bg-white shadow-xl shadow-gym-dark-900/5 h-full flex flex-col overflow-hidden">
            <header className="px-8 py-8 border-b-2 border-gym-dark-50 flex items-center justify-between bg-gym-dark-50/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-gym-500 text-gym-dark-900 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight italic">Protocol Revenue</h3>
                  <p className="text-[9px] font-bold text-gym-dark-400 uppercase tracking-widest">Access Authorization Metrics</p>
                </div>
              </div>
              <BarChart3 size={20} className="text-gym-dark-200" />
            </header>

            <div className="flex-1 overflow-x-auto custom-scrollbar max-h-[500px]">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-gym-dark-900 text-gym-500 text-[10px] font-black uppercase tracking-[0.2em] z-10">
                  <tr>
                    <th className="px-10 py-5">Sync Date</th>
                    <th className="px-10 py-5 text-center">Authorization Count</th>
                    <th className="px-10 py-5 text-right">Fiscal Inflow</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gym-dark-50">
                  {isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan="3" className="px-10 py-10 bg-gym-dark-50/20"></td>
                      </tr>
                    ))
                  ) : membershipRevenue.length === 0 ? (
                    <tr><td colSpan="3" className="px-10 py-20 text-center text-gym-dark-200 uppercase font-black text-xs italic tracking-widest">Data Vector Null</td></tr>
                  ) : membershipRevenue.map((row, i) => (
                    <tr key={i} className="hover:bg-gym-50/50 transition-colors group">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-3">
                          <Calendar size={14} className="text-gym-dark-200 group-hover:text-gym-500 transition-colors" />
                          <span className="text-sm font-black text-gym-dark-700 group-hover:text-gym-dark-900 transition-colors">{row.RevenueDate}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className="px-3 py-1 rounded-full bg-gym-500 text-gym-dark-900 text-[9px] font-black uppercase tracking-widest">
                          {row.PaidMemberships} PLANS
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <p className="text-sm font-black text-gym-dark-900 italic">{Number(row.RevenueAmount).toLocaleString()} <span className="text-[10px] text-gym-dark-300 not-italic">VND</span></p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </div>
    </WorkspaceScaffold>
  )
}

const ReportCard = ({ title, amount, icon, variant, subtext, trend }) => (
  <article className={`p-8 rounded-[40px] border-4 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 group relative overflow-hidden ${variant === 'dark'
      ? 'bg-gym-dark-900 border-gym-dark-800 text-white shadow-xl shadow-gym-dark-900/20'
      : 'bg-white border-gym-dark-50 text-gym-dark-900 shadow-xl shadow-gym-dark-900/5'
    }`}>
    {variant === 'dark' && <div className="absolute top-0 right-0 w-32 h-32 bg-gym-500/10 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-gym-500/20 transition-colors"></div>}

    <div className="flex justify-between items-start mb-8 relative">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 duration-500 ${variant === 'dark' ? 'bg-gym-500 text-gym-dark-900' : 'bg-gym-dark-900 text-gym-500'
        }`}>
        {icon}
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
        <ArrowUpRight size={10} strokeWidth={3} /> {trend}
      </div>
    </div>

    <div className="relative space-y-1">
      <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${variant === 'dark' ? 'text-gym-dark-400' : 'text-gym-dark-300'}`}>{title}</p>
      <div className="flex items-baseline gap-2">
        <h4 className="text-3xl font-black italic tracking-tighter">
          {Number(amount).toLocaleString()}
        </h4>
        <span className={`text-xs font-bold uppercase ${variant === 'dark' ? 'text-gym-dark-500' : 'text-gym-dark-300'}`}>VND</span>
      </div>
    </div>

    <footer className="mt-8 pt-6 border-t border-gym-dark-100/10 flex items-center gap-3 relative">
      <div className="w-2 h-2 rounded-full bg-gym-500 animate-pulse"></div>
      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${variant === 'dark' ? 'text-gym-dark-400' : 'text-gym-dark-400'}`}>{subtext}</span>
    </footer>
  </article>
)

export default AdminReportsPage
