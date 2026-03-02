import { useQuery } from '@tanstack/react-query'
import {
  Users, Star, MessageSquare, TrendingUp, Award,
  BarChart3, Activity, Shield, ArrowUpRight,
  UserCheck, AlertCircle, Search, Filter,
  PieChart, Layout
} from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { adminApi } from '../../features/admin/api/adminApi'

function AdminCoachInsightsPage() {
  const { data: studentsData, isLoading: loadingStudents } = useQuery({
    queryKey: ['admin-coach-students'],
    queryFn: adminApi.getCoachStudents,
  })

  const { data: feedbackData, isLoading: loadingFeedback } = useQuery({
    queryKey: ['admin-coach-feedback'],
    queryFn: adminApi.getCoachFeedback,
  })

  const students = studentsData?.data?.items || []
  const feedbacks = feedbackData?.data?.items || []

  // Aggregate metrics
  const totalStudents = students.length
  const avgRating = feedbacks.length > 0
    ? (feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / feedbacks.length).toFixed(1)
    : '0.0'

  return (
    <WorkspaceScaffold
      title="Talent Analytics"
      subtitle="Deep-dive into coaching efficiency, athlete retention, and satisfaction vectors."
      links={adminNav}
    >
      <div className="space-y-12 pb-20 animate-in fade-in duration-700">

        {/* Tactical Command Header */}
        <header className="flex flex-wrap items-center justify-between gap-8 bg-gym-dark-900 p-8 rounded-[40px] border-4 border-gym-dark-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gym-500/10 -mr-32 -mt-32 rounded-full blur-3xl"></div>

          <div className="relative flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-gym-500 text-gym-dark-900 flex items-center justify-center shadow-lg shadow-gym-500/20">
              <TrendingUp size={32} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Elite Performance Deck</h2>
              <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-[0.2em] mt-1">Cross-Platform Talent Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-4 relative z-10">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <p className="text-[9px] font-black text-gym-dark-500 uppercase tracking-widest">Global Satisfaction</p>
              <div className="flex items-center gap-2 mt-1">
                <Star size={14} className="text-gym-500" fill="currentColor" />
                <span className="text-xl font-black text-white italic">{avgRating}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Aggregate Insight Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <InsightCard
            title="Active Deployments"
            value={totalStudents}
            subtext="Athlete Count"
            icon={<Users size={24} />}
            variant="dark"
          />
          <InsightCard
            title="Feedback Volume"
            value={feedbacks.length}
            subtext="Intelligence Logs"
            icon={<MessageSquare size={24} />}
            variant="white"
          />
          <InsightCard
            title="Talent Efficiency"
            value="84%"
            subtext="Retention Rate"
            icon={<Award size={24} />}
            variant="white"
            trend="+4.2%"
          />
        </div>

        {/* Global Feedback Stream & Talent Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Section: Feedback Stream */}
          <section className="lg:col-span-7 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-gym-500 rounded-full"></div>
                <h3 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight italic">Field Intelligence Feed</h3>
              </div>
              <span className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest">Real-time Stream</span>
            </div>

            <div className="space-y-6 max-h-[800px] overflow-y-auto no-scrollbar pr-2">
              {loadingFeedback ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 rounded-[32px] bg-gym-dark-50 animate-pulse"></div>
                ))
              ) : feedbacks.length === 0 ? (
                <div className="py-20 text-center opacity-40">
                  <MessageSquare size={48} className="mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest italic">Intelligence Null</p>
                </div>
              ) : feedbacks.map((f, i) => (
                <article key={i} className="p-8 rounded-[40px] bg-white border-2 border-gym-dark-50 hover:border-gym-500/30 hover:shadow-2xl transition-all duration-500 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gym-500/5 -mr-12 -mt-12 rounded-full blur-2xl group-hover:bg-gym-500/10 transition-colors"></div>

                  <div className="flex justify-between items-start mb-6 relative">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-gym-dark-900 text-gym-500 flex items-center justify-center font-black shadow-lg group-hover:scale-110 transition-transform">
                        {f.customerName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-gym-dark-900 uppercase tracking-tight">{f.customerName}</p>
                        <p className="text-[9px] font-black text-gym-500 uppercase tracking-widest">via COACH SERVICE</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex gap-0.5 text-gym-500">
                        {[...Array(5)].map((_, idx) => (
                          <Star key={idx} size={12} fill={idx < f.rating ? "currentColor" : "none"} strokeWidth={3} />
                        ))}
                      </div>
                      <span className="text-[8px] font-black text-gym-dark-300 uppercase mt-2 tracking-widest">{new Date(f.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-gym-dark-700 italic leading-relaxed group-hover:text-gym-dark-900 transition-colors">
                    "{f.comment || 'Technical silence observed in transmission.'}"
                  </p>

                  <footer className="mt-6 pt-6 border-t border-gym-dark-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield size={12} className="text-gym-dark-300" />
                      <span className="text-[9px] font-black text-gym-dark-400 uppercase tracking-widest">Specialist: {f.coachName || 'UNIDENTIFIED'}</span>
                    </div>
                    <ArrowUpRight size={16} className="text-gym-dark-100 group-hover:text-gym-500 transition-colors" />
                  </footer>
                </article>
              ))}
            </div>
          </section>

          {/* Section: Athlete Distribution */}
          <section className="lg:col-span-5 space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-gym-dark-900 rounded-full"></div>
              <h3 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight italic">Operational Reach</h3>
            </div>

            <div className="gc-card border-l-8 border-gym-dark-900 bg-white shadow-2xl overflow-hidden p-0">
              <div className="p-8 bg-gym-dark-50/50 border-b border-gym-dark-50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest">Athlete Manifest</p>
                  <h4 className="text-sm font-black text-gym-dark-900 uppercase italic">Coach Deployment heatmap</h4>
                </div>
                <BarChart3 size={20} className="text-gym-dark-200" />
              </div>

              <div className="divide-y divide-gym-dark-50 custom-scrollbar max-h-[600px] overflow-y-auto">
                {loadingStudents ? (
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-gym-dark-50/20 animate-pulse"></div>
                  ))
                ) : students.length === 0 ? (
                  <div className="p-10 text-center text-gym-dark-200 uppercase font-black text-[10px] tracking-widest italic">Heatmap Offline</div>
                ) : students.map((s, i) => (
                  <div key={i} className="px-8 py-6 hover:bg-gym-50/50 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-gym-dark-900 text-gym-500 flex items-center justify-center font-black group-hover:rotate-12 transition-transform shadow-md">
                        {s.customerName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-black text-gym-dark-900 uppercase">{s.customerName}</p>
                        <p className="text-[8px] font-bold text-gym-dark-400 uppercase tracking-widest italic">Specialist: {s.coachName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-gym-500 bg-gym-dark-900 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                        ACTIVE
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <footer className="p-8 bg-gym-dark-900 text-gym-500 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] italic">Proprietary Talent Analytics v2.0</p>
              </footer>
            </div>
          </section>

        </div>
      </div>
    </WorkspaceScaffold>
  )
}

function InsightCard({ title, value, subtext, icon, variant, trend }) {
  return (
    <article className={`p-8 rounded-[40px] border-4 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 group relative overflow-hidden ${variant === 'dark'
        ? 'bg-gym-dark-900 border-gym-dark-800 text-white shadow-xl shadow-gym-dark-900/20'
        : 'bg-white border-gym-dark-50 text-gym-dark-900 shadow-xl shadow-gym-dark-900/5'
      }`}>
      {variant === 'dark' && <div className="absolute top-0 right-0 w-32 h-32 bg-gym-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-gym-500/10 transition-colors"></div>}

      <div className="flex justify-between items-start mb-8 relative">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 duration-500 ${variant === 'dark' ? 'bg-gym-500 text-gym-dark-900' : 'bg-gym-dark-900 text-gym-500'
          }`}>
          {icon}
        </div>
        {trend && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
            <ArrowUpRight size={10} strokeWidth={3} /> {trend}
          </div>
        )}
      </div>

      <div className="relative space-y-1">
        <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${variant === 'dark' ? 'text-gym-dark-500' : 'text-gym-dark-300'}`}>{title}</p>
        <h4 className="text-4xl font-black italic tracking-tighter">
          {value}
        </h4>
      </div>

      <footer className="mt-8 pt-6 border-t border-gym-dark-100/10 flex items-center gap-3 relative">
        <div className="w-2 h-2 rounded-full bg-gym-500 animate-pulse"></div>
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${variant === 'dark' ? 'text-gym-dark-400' : 'text-gym-dark-400'}`}>{subtext}</span>
      </footer>
    </article>
  )
}

export default AdminCoachInsightsPage
