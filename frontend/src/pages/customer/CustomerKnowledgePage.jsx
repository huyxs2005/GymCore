import { Search, Dumbbell, Apple, Cpu, ExternalLink, ArrowRight, PlayCircle, BookOpen } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'

function CustomerKnowledgePage() {
  const categories = [
    {
      id: 'workouts',
      title: 'Training Library',
      description: 'Explore tactical workout programs designed for maximum hypertrophy and strength.',
      icon: <Dumbbell className="text-gym-500" size={24} />,
      count: '42 Programs',
      bg: 'bg-gym-dark-900',
      text: 'text-white'
    },
    {
      id: 'nutrition',
      title: 'Fueling Protocols',
      description: 'Precision nutrition guides to optimize recovery and metabolic performance.',
      icon: <Apple className="text-gym-dark-900" size={24} />,
      count: '128 Recipes',
      bg: 'bg-gym-500',
      text: 'text-gym-dark-900'
    },
    {
      id: 'ai',
      title: 'Neural Core AI',
      description: 'Get hyper-personalized recommendations powered by our proprietary training algorithms.',
      icon: <Cpu className="text-gym-500" size={24} />,
      count: 'Custom Sync',
      bg: 'bg-gym-dark-50',
      text: 'text-gym-dark-900'
    }
  ]

  const featuredContent = [
    {
      title: 'Advanced Deadlift Mechanics',
      category: 'Technique',
      duration: '12 min',
      thumbnail: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800'
    },
    {
      title: 'Post-Workout Protein Synthesis',
      category: 'Nutrition',
      duration: '8 min',
      thumbnail: 'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=800'
    }
  ]

  return (
    <WorkspaceScaffold
      title="Knowledge Hub"
      subtitle="Access elite training intelligence and AI-driven performance optimization."
      links={customerNav}
    >
      <div className="space-y-12 animate-in fade-in duration-700">
        {/* Search & Orientation */}
        <section className="relative h-64 rounded-[40px] overflow-hidden bg-gym-dark-900 flex flex-col items-center justify-center text-center p-8 border-4 border-gym-dark-800 shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gym-500/10 -mr-32 -mt-32 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-gym-500/5 -ml-32 -mb-32 rounded-full blur-3xl"></div>

          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-6 italic">
            Search the <span className="text-gym-500">GymCore</span> Intelligence Base
          </h2>

          <div className="w-full max-w-2xl relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gym-dark-400 group-hover:text-gym-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="Query exercises, nutrition protocols, or AI diagnostics..."
              className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-4 pl-16 pr-6 text-sm text-white focus:outline-none focus:border-gym-500 focus:bg-white/10 transition-all placeholder:text-gym-dark-500 font-bold"
            />
          </div>
        </section>

        {/* Intelligence Categories */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {categories.map((cat) => (
            <article
              key={cat.id}
              className={`gc-card-compact border-2 border-gym-dark-50 p-8 flex flex-col h-full transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 group relative overflow-hidden`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gym-dark-50 group-hover:bg-gym-500/10 -mr-8 -mt-8 rounded-full transition-colors"></div>

              <div className="mb-6 relative">
                <div className="w-14 h-14 rounded-2xl bg-gym-dark-50 flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm border border-gym-dark-100">
                  {cat.icon}
                </div>
              </div>

              <h3 className="text-xl font-black text-gym-dark-900 uppercase tracking-tight mb-3">
                {cat.title}
              </h3>

              <p className="text-xs font-medium text-gym-dark-500 leading-relaxed mb-8 flex-1">
                {cat.description}
              </p>

              <div className="flex items-center justify-between mt-auto">
                <span className="text-[10px] font-black uppercase tracking-widest text-gym-dark-300">
                  {cat.count}
                </span>
                <button className="w-10 h-10 rounded-full bg-gym-dark-900 text-gym-500 flex items-center justify-center shadow-lg group-hover:bg-gym-500 group-hover:text-gym-dark-900 transition-all">
                  <ArrowRight size={18} strokeWidth={3} />
                </button>
              </div>
            </article>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Featured Content */}
          <section className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-gym-500 rounded-full"></div>
                <h3 className="text-xl font-black text-gym-dark-900 uppercase tracking-tight">Intelligence Feed</h3>
              </div>
              <button className="text-[10px] font-black text-gym-500 uppercase tracking-[0.2em] flex items-center gap-2 hover:gap-3 transition-all">
                View Archive <ArrowRight size={14} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {featuredContent.map((item, idx) => (
                <div key={idx} className="group cursor-pointer">
                  <div className="relative h-48 rounded-[32px] overflow-hidden mb-4 border-2 border-gym-dark-50 shadow-sm transition-all group-hover:shadow-xl group-hover:border-gym-500/30">
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors"></div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-gym-500 text-gym-dark-900 rounded-full flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform duration-300">
                        <PlayCircle size={24} fill="currentColor" />
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-4">
                      <span className="px-3 py-1 bg-gym-dark-900/80 backdrop-blur-md text-[8px] font-black text-gym-500 uppercase tracking-widest rounded-full border border-white/10">
                        {item.duration}
                      </span>
                    </div>
                  </div>
                  <h4 className="text-sm font-black text-gym-dark-900 uppercase tracking-tight group-hover:text-gym-500 transition-colors">{item.title}</h4>
                  <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest mt-1">{item.category}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Tactical Resources Sidebar */}
          <section className="lg:col-span-4 space-y-8">
            <div className="gc-card-compact bg-gym-dark-900 border-gym-dark-900 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gym-500/10 -mr-16 -mt-16 rounded-full blur-3xl"></div>

              <div className="relative space-y-6">
                <div className="flex items-center gap-3">
                  <BookOpen size={24} className="text-gym-500" />
                  <h3 className="text-lg font-black uppercase tracking-tight text-white italic">Tactical Docs</h3>
                </div>

                <div className="space-y-3">
                  {['Safety Protocols', 'Gear Optimization', 'Facility Guidelines'].map((doc, i) => (
                    <button key={i} className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-gym-500/50 transition-all text-left group">
                      <span className="text-xs font-bold text-gym-dark-100">{doc}</span>
                      <ExternalLink size={14} className="text-gym-dark-400 group-hover:text-gym-500 transition-colors" />
                    </button>
                  ))}
                </div>

                <button className="w-full py-4 bg-gym-500 text-gym-dark-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:shadow-gym-500/20 transition-all active:scale-95">
                  Sync All Assets
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </WorkspaceScaffold>
  )
}

export default CustomerKnowledgePage
