import { useState } from 'react'
import { Plus, Search, Shield, ShieldCheck, Lock, Unlock, Mail, Phone, MoreVertical, Filter, UserPlus, UserMinus, ToggleLeft, ToggleRight } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'

function AdminUsersPage() {
  const [isAddingStaff, setIsAddingStaff] = useState(false)

  const users = [
    { id: 1, name: 'Alex Rivera', email: 'alex.r@gymcore.com', role: 'ADMIN', status: 'ACTIVE', phone: '+1 202 555 0124' },
    { id: 2, name: 'Jordan Sykes', email: 'j.sykes@gymcore.com', role: 'STAFF', status: 'LOCKED', phone: '+1 202 555 0188' },
    { id: 3, name: 'Morgan Hale', email: 'morgan.h@gmail.com', role: 'CUSTOMER', status: 'ACTIVE', phone: '+1 202 555 0199' },
    { id: 4, name: 'Casey Vahn', email: 'c.vahn@gymcore.com', role: 'STAFF', status: 'ACTIVE', phone: '+1 202 555 0167' }
  ]

  const roleColors = {
    ADMIN: 'bg-red-500 text-white',
    STAFF: 'bg-gym-500 text-gym-dark-900',
    CUSTOMER: 'bg-gym-dark-100 text-gym-dark-600'
  }

  return (
    <WorkspaceScaffold
      title="Identity Control"
      subtitle="Manage security clearances and personnel authentication profiles."
      links={adminNav}
    >
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Tactical Header Actions */}
        <section className="flex flex-wrap items-center justify-between gap-6 bg-gym-dark-900 p-8 rounded-[40px] border-4 border-gym-dark-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gym-500/10 -mr-32 -mt-32 rounded-full blur-3xl"></div>

          <div className="relative w-full sm:w-auto">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Personnel Registry</h2>
            <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-[0.2em] mt-1">Operational Security Hub</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 relative w-full sm:w-auto">
            <div className="relative group flex-1 sm:flex-none sm:min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gym-dark-500 group-hover:text-gym-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Search IDs, Emails, or Clearances..."
                className="w-full bg-white/5 border-2 border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold text-white focus:outline-none focus:border-gym-500 focus:bg-white/10 transition-all placeholder:text-gym-dark-600"
              />
            </div>
            <button
              onClick={() => setIsAddingStaff(true)}
              className="btn-primary px-8 py-3.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-gym-500/20 active:scale-95"
            >
              <UserPlus size={16} strokeWidth={3} /> Commission Staff
            </button>
          </div>
        </section>

        {/* User Intelligence Grid */}
        <section className="gc-card-compact border-2 border-gym-dark-50 overflow-hidden bg-white shadow-xl shadow-gym-dark-900/5">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-gym-dark-50 text-gym-dark-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-8 py-6">Operator Identity</th>
                  <th className="px-8 py-6">Clearance Level</th>
                  <th className="px-8 py-6">Operational Status</th>
                  <th className="px-8 py-6">Contact Vector</th>
                  <th className="px-8 py-6 text-right">Directives</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gym-dark-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gym-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gym-dark-900 text-gym-500 flex items-center justify-center font-black shadow-lg group-hover:scale-110 transition-transform">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gym-dark-900 uppercase tracking-tight">{user.name}</p>
                          <p className="text-[10px] font-bold text-gym-dark-400 mt-0.5">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border-2 border-transparent ${roleColors[user.role]}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${user.status === 'ACTIVE' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}></div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${user.status === 'ACTIVE' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {user.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gym-dark-600">
                          <Phone size={12} className="text-gym-dark-300" /> {user.phone}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gym-dark-600">
                          <Mail size={12} className="text-gym-dark-300" /> {user.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className={`p-3 rounded-xl border-2 transition-all group/btn ${user.status === 'ACTIVE' ? 'border-amber-100 text-amber-500 hover:bg-amber-500 hover:text-white hover:border-amber-500' : 'border-emerald-100 text-emerald-500 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'}`}>
                          {user.status === 'ACTIVE' ? <Lock size={16} /> : <Unlock size={16} />}
                        </button>
                        <button className="p-3 rounded-xl border-2 border-gym-dark-50 text-gym-dark-400 hover:bg-gym-dark-900 hover:text-gym-500 hover:border-gym-dark-900 transition-all">
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="px-8 py-6 bg-gym-dark-50 flex items-center justify-between border-t border-gym-dark-100">
            <span className="text-[10px] font-black text-gym-dark-400 uppercase tracking-widest">Displaying {users.length} Operators</span>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white border border-gym-dark-100 rounded-xl text-gym-dark-400 cursor-not-allowed">Previous</button>
              <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-white border border-gym-dark-100 rounded-xl text-gym-dark-900 hover:border-gym-500 transition-colors">Next Phase</button>
            </div>
          </footer>
        </section>

        {/* Global Stats Overlay */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <article className="gc-card-compact border-2 border-gym-dark-900 bg-gym-dark-900 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gym-500/5 -mr-16 -mt-16 rounded-full blur-3xl"></div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-gym-dark-400 uppercase tracking-[0.2em] mb-2">Total Deployments</p>
                <p className="text-4xl font-black text-white italic">4,821 <span className="text-sm font-bold text-gym-500 not-italic">ATHLETES</span></p>
              </div>
              <div className="w-16 h-16 rounded-[2rem] bg-gym-500/10 text-gym-500 flex items-center justify-center font-black border border-gym-500/20">
                <Users size={32} />
              </div>
            </div>
          </article>

          <article className="gc-card-compact border-2 border-gym-dark-50 bg-white group hover:border-gym-500 transition-all duration-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-gym-dark-400 uppercase tracking-[0.2em] mb-2">Active Staffing</p>
                <p className="text-4xl font-black text-gym-dark-900 italic">24 <span className="text-sm font-bold text-gym-dark-300 not-italic">COMMISSIONED</span></p>
              </div>
              <div className="w-16 h-16 rounded-[2rem] bg-gym-dark-50 text-gym-dark-900 flex items-center justify-center font-black border border-gym-dark-100 group-hover:bg-gym-500 group-hover:border-gym-500 transition-all">
                <ShieldCheck size={32} />
              </div>
            </div>
          </article>
        </section>
      </div>

      {/* Commission Modal (Staff Add Placeholder) */}
      {isAddingStaff && (
        <div className="fixed inset-0 z-[100] bg-gym-dark-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 overflow-y-auto max-h-[90vh]">
            <header className="px-10 py-8 bg-gym-dark-900 text-white flex items-center justify-between">
              <div>
                <h4 className="text-xl font-black uppercase tracking-tight text-gym-500 italic">Staff Commission</h4>
                <p className="text-[10px] font-bold text-gym-dark-400 mt-1 uppercase tracking-widest">Provisioning New Tactical Access</p>
              </div>
              <button onClick={() => setIsAddingStaff(false)} className="hover:text-gym-500 transition-colors text-2xl font-black">×</button>
            </header>

            <div className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Full Identity</label>
                  <input type="text" className="gc-input" placeholder="e.g. Victor Thorne" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Authentication Email</label>
                  <input type="email" className="gc-input" placeholder="victor.t@gymcore.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Security Role</label>
                  <select className="gc-input">
                    <option>STAFF OPERATOR</option>
                    <option>ADMIN COMMANDER</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => setIsAddingStaff(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-gym-dark-400 hover:text-gym-dark-900 transition-colors">Abort</button>
                <button className="btn-primary flex-[2] py-4 text-[10px] font-black shadow-2xl">Confirm Commission</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default AdminUsersPage
