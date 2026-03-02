import { TrendingUp, Users, CreditCard, ShoppingBag, ArrowUpRight, ArrowDownRight, Activity, Calendar, Zap, DollarSign } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'

function AdminDashboardPage() {
  const stats = [
    {
      label: 'Gross Revenue',
      value: '$24,850',
      trend: '+12.5%',
      isPositive: true,
      icon: <DollarSign className="text-gym-500" size={20} />,
      period: 'Monthly Analytics'
    },
    {
      label: 'Active Athletes',
      value: '1,280',
      trend: '+4.2%',
      isPositive: true,
      icon: <Users className="text-gym-500" size={20} />,
      period: 'Dynamic Population'
    },
    {
      label: 'Store Deployments',
      value: '482',
      trend: '-2.1%',
      isPositive: false,
      icon: <ShoppingBag className="text-gym-500" size={20} />,
      period: 'Transaction Volume'
    },
    {
      label: 'Facility Syncs',
      value: '3,120',
      trend: '+18.4%',
      isPositive: true,
      icon: <Zap className="text-gym-500" size={20} />,
      period: 'Check-in Events'
    }
  ]

  const recentActivity = [
    { user: 'Liam Nguyen', action: 'Membership Renewal', time: '2 mins ago', amount: '$120' },
    { user: 'Sarah Chen', action: 'Pt Session Booked', time: '15 mins ago', amount: 'N/A' },
    { user: 'Marcus Thorne', action: 'Store Purchase', time: '42 mins ago', amount: '$85' },
    { user: 'Elena Rossi', action: 'Coach Match Success', time: '1 hour ago', amount: 'N/A' }
  ]

  return (
    <WorkspaceScaffold
      title="Tactical Command"
      subtitle="Comprehensive platform intelligence and operational oversight."
      links={adminNav}
    >
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Metric Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <article key={i} className="gc-card-compact border-2 border-gym-dark-50 bg-white group hover:border-gym-500 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gym-dark-900 flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                  {stat.icon}
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${stat.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                  {stat.isPositive ? <ArrowUpRight size={12} strokeWidth={3} /> : <ArrowDownRight size={12} strokeWidth={3} />}
                  {stat.trend}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-black text-gym-dark-400 uppercase tracking-[0.2em]">{stat.label}</p>
                <p className="text-3xl font-black text-gym-dark-900 tracking-tighter">{stat.value}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-gym-dark-50">
                <p className="text-[8px] font-black text-gym-dark-300 uppercase tracking-widest">{stat.period}</p>
              </div>
            </article>
          ))}
        </section>

        {/* Analytics & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Revenue Visualization Stub */}
          <section className="lg:col-span-8">
            <article className="gc-card border-l-8 border-gym-dark-900 h-full flex flex-col">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <TrendingUp className="text-gym-500" size={24} />
                  <h3 className="text-xl font-black text-gym-dark-900 uppercase tracking-tight italic">Revenue Trajectory</h3>
                </div>
                <div className="flex gap-2">
                  {['7D', '30D', '90D', '1Y'].map(t => (
                    <button key={t} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${t === '30D' ? 'bg-gym-dark-900 text-gym-500' : 'bg-gym-dark-50 text-gym-dark-400 hover:bg-gym-dark-100'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-gym-dark-50/50 rounded-3xl border-2 border-dashed border-gym-dark-100 flex flex-col items-center justify-center p-12 text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 animate-pulse">
                  <Activity className="text-gym-dark-200" size={32} />
                </div>
                <p className="text-sm font-black text-gym-dark-900 uppercase tracking-[0.2em]">Neural Analytics Loading...</p>
                <p className="text-xs font-bold text-gym-dark-400 mt-2">Aggregating transactional data from global nodes.</p>
              </div>
            </article>
          </section>

          {/* Tactical Log */}
          <section className="lg:col-span-4">
            <article className="gc-card-compact border-2 border-gym-dark-50 h-full">
              <div className="flex items-center gap-3 mb-8 px-2">
                <Zap className="text-gym-500" size={24} />
                <h3 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight">Deployment Log</h3>
              </div>

              <div className="space-y-6">
                {recentActivity.map((act, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-gym-dark-50/50 border border-gym-dark-100/30 hover:bg-white hover:border-gym-500/30 hover:shadow-lg transition-all cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gym-dark-900 text-gym-500 flex items-center justify-center font-black group-hover:scale-110 transition-transform shadow-md">
                        {act.user.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gym-dark-900 uppercase tracking-tight">{act.user}</p>
                        <p className="text-[9px] font-bold text-gym-dark-400 uppercase tracking-widest mt-0.5">{act.action}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-gym-dark-900">{act.amount}</p>
                      <p className="text-[8px] font-bold text-gym-dark-300 uppercase mt-0.5">{act.time}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button className="w-full mt-8 py-4 bg-gym-dark-900 text-gym-500 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:shadow-gym-dark-900/20 active:scale-95 transition-all">
                Full Operations Log
              </button>
            </article>
          </section>
        </div>

        {/* Quick Tactical Deployments */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Users', icon: <Users size={20} /> },
            { label: 'Coach Sync', icon: <Zap size={20} /> },
            { label: 'Storefront', icon: <ShoppingBag size={20} /> },
            { label: 'Reports', icon: <TrendingUp size={20} /> }
          ].map((action, i) => (
            <button key={i} className="gc-card-compact border-2 border-gym-dark-50 p-6 flex items-center justify-center gap-4 hover:border-gym-500 hover:bg-white hover:shadow-xl transition-all group active:scale-95">
              <div className="text-gym-dark-400 group-hover:text-gym-500 transition-colors">
                {action.icon}
              </div>
              <span className="text-xs font-black text-gym-dark-900 uppercase tracking-[0.2em]">Manage {action.label}</span>
            </button>
          ))}
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

export default AdminDashboardPage
