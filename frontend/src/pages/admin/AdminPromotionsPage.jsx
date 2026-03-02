import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminPromotionApi } from '../../features/promotion/api/adminPromotionApi'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import {
  Plus, Edit, Ticket, Image as ImageIcon, CheckCircle, XCircle,
  CircleOff, Calendar, FileText, Layout, Sparkles, Zap,
  Shield, TrendingUp, ArrowRight, MessageSquare, Tag,
  Target, Globe, ShieldCheck
} from 'lucide-react'
import { toast } from 'react-hot-toast'

function toOptionalNumber(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function toNonNegativeInt(value) {
  const parsed = Number.parseInt(String(value ?? '0'), 10)
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return 0
  return Math.max(0, parsed)
}

function formatCouponBenefit(coupon) {
  const bonusDays = Number(coupon?.BonusDurationDays || 0)
  const discountPercent = toOptionalNumber(coupon?.DiscountPercent)
  const discountAmount = toOptionalNumber(coupon?.DiscountAmount)
  const parts = []
  if (discountPercent != null && discountPercent > 0) {
    parts.push(`${discountPercent}% OFF`)
  } else if (discountAmount != null && discountAmount > 0) {
    parts.push(`${discountAmount.toLocaleString()} VND OFF`)
  }
  if (bonusDays > 0) {
    parts.push(`+${bonusDays} DAYS`)
  }
  return parts.length > 0 ? parts.join(' + ') : 'No benefit'
}

const AdminPromotionsPage = () => {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('coupons')
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  // Queries
  const { data: couponsData, isLoading: loadingCoupons } = useQuery({
    queryKey: ['adminCoupons'],
    queryFn: () => adminPromotionApi.getCoupons(),
  })

  const { data: postsData, isLoading: loadingPosts } = useQuery({
    queryKey: ['adminPosts'],
    queryFn: () => adminPromotionApi.getPosts(),
  })

  // Mutations
  const createCouponMutation = useMutation({
    mutationFn: (payload) => adminPromotionApi.createCoupon(payload),
    onSuccess: () => {
      toast.success('Voucher unit initialized.')
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] })
      setIsCouponModalOpen(false)
    },
  })

  const updateCouponMutation = useMutation({
    mutationFn: ({ id, payload }) => adminPromotionApi.updateCoupon(id, payload),
    onSuccess: () => {
      toast.success('Voucher recalibrated.')
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] })
      setIsCouponModalOpen(false)
    },
  })

  const deleteCouponMutation = useMutation({
    mutationFn: (id) => adminPromotionApi.deleteCoupon(id),
    onSuccess: () => {
      toast.success('Voucher decommissioned.')
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] })
    },
  })

  const createPostMutation = useMutation({
    mutationFn: (payload) => adminPromotionApi.createPost(payload),
    onSuccess: () => {
      toast.success('Campaign broadcasted.')
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] })
      setIsPostModalOpen(false)
    },
  })

  const updatePostMutation = useMutation({
    mutationFn: ({ id, payload }) => adminPromotionApi.updatePost(id, payload),
    onSuccess: () => {
      toast.success('Campaign adjusted.')
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] })
      setIsPostModalOpen(false)
    },
  })

  const deletePostMutation = useMutation({
    mutationFn: (id) => adminPromotionApi.deletePost(id),
    onSuccess: () => {
      toast.success('Campaign terminated.')
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] })
    },
  })

  const coupons = couponsData?.data?.coupons || []
  const posts = postsData?.data?.posts || []

  return (
    <WorkspaceScaffold
      title="Marketing Ops"
      subtitle="Strategize and deploy promotional vectors across the athlete network."
      links={adminNav}
    >
      <div className="space-y-12 pb-20 animate-in fade-in duration-700">

        {/* Command Center Header */}
        <section className="relative overflow-hidden bg-gym-dark-900 rounded-[40px] p-10 text-white shadow-2xl border-4 border-gym-dark-800 group">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[500px] h-[500px] bg-gym-500/10 rounded-full blur-[100px] group-hover:bg-gym-500/20 transition-colors duration-1000"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gym-500 text-gym-dark-900 flex items-center justify-center shadow-lg">
                  <Zap size={20} strokeWidth={3} />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tighter italic">Promotional Vanguard</h2>
              </div>
              <p className="text-gym-dark-400 font-bold text-lg leading-relaxed uppercase tracking-tight italic">
                Deploy high-impact vouchers and marketing transmissions to accelerate athlete engagement.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => { setEditingItem(null); setIsCouponModalOpen(true); }}
                className="btn-primary px-10 py-4 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-xl shadow-gym-500/20 active:scale-95 transition-all"
              >
                <Ticket size={20} /> Initialize Voucher
              </button>
              <button
                onClick={() => { setEditingItem(null); setIsPostModalOpen(true); }}
                className="px-10 py-4 bg-white/5 hover:bg-white/10 text-white border-2 border-white/10 rounded-[24px] font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 backdrop-blur-md"
              >
                <Globe size={20} /> Broadcast Campaign
              </button>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <nav className="flex items-center gap-8 border-b-2 border-gym-dark-50 sticky top-0 bg-white/80 backdrop-blur-xl z-20 px-4">
          <button
            onClick={() => setActiveTab('coupons')}
            className={`py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 border-b-4 relative ${activeTab === 'coupons' ? 'border-gym-500 text-gym-dark-900 translate-y-px' : 'border-transparent text-gym-dark-300 hover:text-gym-dark-600'}`}
          >
            <Tag size={14} strokeWidth={3} /> Tactical Vouchers
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 border-b-4 relative ${activeTab === 'posts' ? 'border-gym-500 text-gym-dark-900 translate-y-px' : 'border-transparent text-gym-dark-300 hover:text-gym-dark-600'}`}
          >
            <ShieldCheck size={14} strokeWidth={3} /> Campaign Transmissions
          </button>
        </nav>

        {/* Content Area */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === 'coupons' && (
            <section className="gc-card-compact border-2 border-gym-dark-50 bg-white overflow-hidden shadow-2xl">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-gym-dark-900 text-gym-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    <tr>
                      <th className="px-10 py-6">Unit Protocol</th>
                      <th className="px-10 py-6">Asset Benefit</th>
                      <th className="px-10 py-6">Operational Window</th>
                      <th className="px-10 py-6">Deployment Status</th>
                      <th className="px-10 py-6 text-right">Directives</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gym-dark-50">
                    {loadingCoupons ? (
                      <tr><td colSpan="5" className="p-20 text-center text-gym-dark-300 italic font-black uppercase tracking-widest animate-pulse">Syncing Voucher Registry...</td></tr>
                    ) : coupons.length === 0 ? (
                      <tr><td colSpan="5" className="p-20 text-center text-gym-dark-200">
                        <Ticket size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-black uppercase tracking-widest text-xs italic">Voucher Manifest Empty</p>
                      </td></tr>
                    ) : coupons.map(coupon => (
                      <tr key={coupon.PromotionID} className="hover:bg-gym-50/50 transition-colors group">
                        <td className="px-10 py-6">
                          <span className="font-mono font-black text-gym-dark-900 bg-gym-50 px-4 py-2 rounded-xl border-2 border-gym-dark-100 uppercase tracking-widest group-hover:bg-gym-dark-900 group-hover:text-gym-500 transition-colors">
                            {coupon.PromoCode}
                          </span>
                        </td>
                        <td className="px-10 py-6">
                          <p className="text-sm font-black text-gym-dark-900 uppercase italic">
                            {formatCouponBenefit(coupon)}
                          </p>
                        </td>
                        <td className="px-10 py-6 text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest">
                          {new Date(coupon.ValidFrom).toLocaleDateString()} <ArrowRight size={10} className="inline mx-2 text-gym-500" /> {new Date(coupon.ValidTo).toLocaleDateString()}
                        </td>
                        <td className="px-10 py-6">
                          {coupon.IsActive ? (
                            <span className="flex items-center gap-2 text-emerald-600 text-[9px] font-black uppercase tracking-[0.2em] bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100 transition-all hover:scale-105">
                              <CheckCircle size={10} strokeWidth={3} /> Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 text-gym-dark-300 text-[9px] font-black uppercase tracking-[0.2em] bg-gym-dark-50 px-4 py-1.5 rounded-full border border-gym-dark-100">
                              <XCircle size={10} strokeWidth={3} /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-10 py-6 text-right flex justify-end gap-3">
                          <button
                            onClick={() => { setEditingItem(coupon); setIsCouponModalOpen(true); }}
                            className="w-10 h-10 flex items-center justify-center bg-gym-dark-50 text-gym-dark-400 rounded-xl hover:bg-gym-dark-900 hover:text-gym-500 transition-all active:scale-90"
                          >
                            <Edit size={16} strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={() => { if (window.confirm('Command Confirmation: Decommission this voucher?')) deleteCouponMutation.mutate(coupon.PromotionID) }}
                            className="w-10 h-10 flex items-center justify-center bg-gym-dark-50 text-gym-dark-300 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
                          >
                            <CircleOff size={16} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'posts' && (
            <section className="gc-card-compact border-2 border-gym-dark-50 bg-white overflow-hidden shadow-2xl">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-gym-dark-900 text-gym-500 text-[10px] font-black uppercase tracking-[0.2em]">
                    <tr>
                      <th className="px-10 py-6">Tactical Broadcast</th>
                      <th className="px-10 py-6">Linked Protocol</th>
                      <th className="px-10 py-6">Air-Time</th>
                      <th className="px-10 py-6">Broadcast Link</th>
                      <th className="px-10 py-6 text-right">Directives</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gym-dark-50">
                    {loadingPosts ? (
                      <tr><td colSpan="5" className="p-20 text-center text-gym-dark-300 italic font-black uppercase tracking-widest animate-pulse">Syncing Campaign Logs...</td></tr>
                    ) : posts.length === 0 ? (
                      <tr><td colSpan="5" className="p-20 text-center text-gym-dark-200">
                        <Globe size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-black uppercase tracking-widest text-xs italic">Campaign Logs Null</p>
                      </td></tr>
                    ) : posts.map(post => (
                      <tr key={post.PromotionPostID} className="hover:bg-gym-50/50 transition-colors group">
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-6">
                            <div className="relative group/img">
                              <img src={post.BannerUrl} className="w-20 h-14 object-cover rounded-[16px] border-2 border-gym-dark-100 group-hover:border-gym-500 transition-all shadow-lg" alt="" />
                              <div className="absolute inset-0 bg-gym-dark-900/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-[16px]">
                                <ImageIcon size={16} className="text-gym-500" />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-black text-gym-dark-900 text-sm uppercase italic tracking-tight truncate">{post.Title}</p>
                              <p className="text-[10px] text-gym-dark-400 line-clamp-1 font-medium mt-1 uppercase tracking-tighter italic">{post.Content}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-6">
                          <span className="font-mono text-[10px] font-black text-gym-500 bg-gym-dark-900 px-4 py-2 rounded-xl border border-gym-dark-800 uppercase tracking-widest shadow-lg">
                            {post.PromoCode || 'N/A'}
                          </span>
                        </td>
                        <td className="px-10 py-6 text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest">
                          {new Date(post.StartAt).toLocaleDateString()} <ArrowRight size={10} className="inline mx-2 text-gym-500" /> {new Date(post.EndAt).toLocaleDateString()}
                        </td>
                        <td className="px-10 py-6">
                          {post.IsActive ? (
                            <span className="flex items-center gap-2 text-emerald-600 text-[9px] font-black uppercase tracking-[0.2em] bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100">
                              <CheckCircle size={10} strokeWidth={3} /> Transmitting
                            </span>
                          ) : (
                            <span className="flex items-center gap-2 text-gym-dark-300 text-[9px] font-black uppercase tracking-[0.2em] bg-gym-dark-50 px-4 py-1.5 rounded-full border border-gym-dark-100">
                              <XCircle size={10} strokeWidth={3} /> Terminated
                            </span>
                          )}
                        </td>
                        <td className="px-10 py-6 text-right flex justify-end gap-3">
                          <button
                            onClick={() => { setEditingItem(post); setIsPostModalOpen(true); }}
                            className="w-10 h-10 flex items-center justify-center bg-gym-dark-50 text-gym-dark-400 rounded-xl hover:bg-gym-dark-900 hover:text-gym-500 transition-all active:scale-90"
                          >
                            <Edit size={16} strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={() => { if (window.confirm('Command Confirmation: Terminate this broadcast?')) deletePostMutation.mutate(post.PromotionPostID) }}
                            className="w-10 h-10 flex items-center justify-center bg-gym-dark-50 text-gym-dark-300 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
                          >
                            <CircleOff size={16} strokeWidth={2.5} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Voucher Modal */}
        {isCouponModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gym-dark-900/90 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-500">
              <header className="px-10 py-8 bg-gym-dark-900 text-white flex justify-between items-center border-b-4 border-gym-dark-800">
                <div>
                  <h3 className="font-black text-gym-500 text-xl uppercase tracking-tighter italic">Voucher Calibration</h3>
                  <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest mt-1">
                    {editingItem ? `SYNCING UNIT: ${editingItem.PromotionID}` : 'INITIALIZING NEW PROTOCOL'}
                  </p>
                </div>
                <button onClick={() => setIsCouponModalOpen(false)} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all font-black text-2xl">×</button>
              </header>

              <form className="p-10 space-y-8" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const raw = Object.fromEntries(formData);
                const payload = {
                  ...raw,
                  discountPercent: toOptionalNumber(raw.discountPercent),
                  discountAmount: toOptionalNumber(raw.discountAmount),
                  bonusDurationDays: toNonNegativeInt(raw.bonusDurationDays),
                  isActive: raw.isActive === 'on' ? 1 : 0
                }
                if (editingItem) {
                  updateCouponMutation.mutate({ id: editingItem.PromotionID, payload: { ...editingItem, ...payload } });
                } else {
                  createCouponMutation.mutate(payload);
                }
              }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Tactical Code</label>
                    <input name="promoCode" defaultValue={editingItem?.PromoCode} required className="gc-input font-mono uppercase" placeholder="TACTICAL10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Description Brief</label>
                    <input name="description" defaultValue={editingItem?.Description} className="gc-input" placeholder="Elite access discount" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Discount %</label>
                    <input name="discountPercent" type="number" step="0.01" defaultValue={editingItem?.DiscountPercent} className="gc-input" placeholder="10.00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Discount VND</label>
                    <input name="discountAmount" type="number" defaultValue={editingItem?.DiscountAmount} className="gc-input" placeholder="50,000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Bonus Days</label>
                    <input
                      name="bonusDurationDays"
                      type="number"
                      min="0"
                      defaultValue={editingItem?.BonusDurationDays ?? 0}
                      className="gc-input"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1 font-black flex items-center gap-2"><Calendar size={12} /> Sync Start</label>
                    <input name="validFrom" type="date" defaultValue={editingItem?.ValidFrom?.split('T')[0]} required className="gc-input" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1 font-black flex items-center gap-2"><Calendar size={12} /> Sync End</label>
                    <input name="validTo" type="date" defaultValue={editingItem?.ValidTo?.split('T')[0]} required className="gc-input" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-6 pt-4">
                  <label className="flex items-center gap-4 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={editingItem ? (editingItem.IsActive === 1 || editingItem.IsActive === true) : true}
                        className="sr-only"
                      />
                      <div className={`w-14 h-8 rounded-full transition-colors duration-300 ${editingItem?.IsActive ? 'bg-gym-500' : 'bg-gym-dark-200'} group-hover:opacity-80`}></div>
                      <div className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${editingItem?.IsActive ? 'translate-x-6' : ''}`}></div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gym-dark-900 uppercase">Operational Readiness</p>
                      <p className="text-[9px] font-bold text-gym-dark-400 uppercase">Ready for athlete deployment</p>
                    </div>
                  </label>

                  <button type="submit" disabled={createCouponMutation.isPending || updateCouponMutation.isPending} className="btn-primary flex-1 py-5 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3">
                    {editingItem ? 'SYNC CHANGES' : <><Shield size={18} /> INITIALIZE UNIT</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Campaign Modal */}
        {isPostModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gym-dark-900/90 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-500">
              <header className="px-10 py-8 bg-gym-dark-900 text-white flex justify-between items-center border-b-4 border-gym-dark-800">
                <div>
                  <h3 className="font-black text-gym-500 text-xl uppercase tracking-tighter italic">Campaign Broadcast Configuration</h3>
                  <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest mt-1">
                    {editingItem ? `ADJUSTING FEED: ${editingItem.PromotionPostID}` : 'INITIALIZING BROADCAST SEQUENCE'}
                  </p>
                </div>
                <button onClick={() => setIsPostModalOpen(false)} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all font-black text-2xl">×</button>
              </header>

              <form className="p-10 space-y-8" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const raw = Object.fromEntries(formData);
                const payload = {
                  ...raw,
                  promotionId: parseInt(raw.promotionId),
                  isActive: raw.isActive === 'on' ? 1 : 0
                }
                if (editingItem) {
                  updatePostMutation.mutate({ id: editingItem.PromotionPostID, payload: { ...editingItem, ...payload } });
                } else {
                  createPostMutation.mutate(payload);
                }
              }}>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1 font-black flex items-center gap-2"><Target size={12} /> Transmission Title</label>
                  <input name="title" defaultValue={editingItem?.Title} required className="gc-input italic" placeholder="SUMMER MEGA PROTOCOL" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Signal Content</label>
                  <textarea name="content" defaultValue={editingItem?.Content} required rows="3" className="gc-input py-4 align-top" placeholder="Broadcasting tactical advantage..." />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1 flex items-center gap-2"><ImageIcon size={12} /> Asset URL (Banner)</label>
                    <input name="bannerUrl" defaultValue={editingItem?.BannerUrl} required className="gc-input text-xs" placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1 flex items-center gap-2"><Tag size={12} /> Link Protocol (Coupon)</label>
                    <select name="promotionId" className="gc-input" defaultValue={editingItem?.PromotionID}>
                      <option value="">DECOUPLED</option>
                      {coupons.map(c => (
                        <option key={c.PromotionID} value={c.PromotionID}>{c.PromoCode} - {formatCouponBenefit(c)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1 font-black flex items-center gap-2"><Calendar size={12} /> Broadcast Start</label>
                    <input name="startAt" type="date" defaultValue={editingItem?.StartAt?.split('T')[0]} required className="gc-input" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1 font-black flex items-center gap-2"><Calendar size={12} /> Broadcast End</label>
                    <input name="endAt" type="date" defaultValue={editingItem?.EndAt?.split('T')[0]} required className="gc-input" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-6 pt-4">
                  <label className="flex items-center gap-4 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={editingItem ? (editingItem.IsActive === 1 || editingItem.IsActive === true) : true}
                        className="sr-only"
                      />
                      <div className={`w-14 h-8 rounded-full transition-colors duration-300 ${editingItem?.IsActive ? 'bg-gym-500' : 'bg-gym-dark-200'} group-hover:opacity-80`}></div>
                      <div className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${editingItem?.IsActive ? 'translate-x-6' : ''}`}></div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gym-dark-900 uppercase">Signal Status</p>
                      <p className="text-[9px] font-bold text-gym-dark-400 uppercase">Active broadcast in feed</p>
                    </div>
                  </label>

                  <button type="submit" disabled={createPostMutation.isPending || updatePostMutation.isPending} className="btn-primary flex-1 py-5 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3">
                    {editingItem ? 'SYNC BROADCAST' : <><Globe size={18} /> PUSH TO NETWORK</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </WorkspaceScaffold>
  )
}

export default AdminPromotionsPage
