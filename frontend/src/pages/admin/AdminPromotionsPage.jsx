import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminPromotionApi } from '../../features/promotion/api/adminPromotionApi'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { Plus, Edit, Ticket, Image as ImageIcon, CheckCircle, XCircle, Trash2, Calendar, FileText, Layout, Sparkles } from 'lucide-react'
import { toast } from 'react-hot-toast'

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
      toast.success('Coupon created')
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] })
      setIsCouponModalOpen(false)
    },
  })

  const updateCouponMutation = useMutation({
    mutationFn: ({ id, payload }) => adminPromotionApi.updateCoupon(id, payload),
    onSuccess: () => {
      toast.success('Coupon updated')
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] })
      setIsCouponModalOpen(false)
    },
  })

  const deleteCouponMutation = useMutation({
    mutationFn: (id) => adminPromotionApi.deleteCoupon(id),
    onSuccess: () => {
      toast.success('Coupon deactivated')
      queryClient.invalidateQueries({ queryKey: ['adminCoupons'] })
    },
  })

  const createPostMutation = useMutation({
    mutationFn: (payload) => adminPromotionApi.createPost(payload),
    onSuccess: () => {
      toast.success('Promotion post created')
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] })
      setIsPostModalOpen(false)
    },
  })

  const updatePostMutation = useMutation({
    mutationFn: ({ id, payload }) => adminPromotionApi.updatePost(id, payload),
    onSuccess: () => {
      toast.success('Promotion post updated')
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] })
      setIsPostModalOpen(false)
    },
  })

  const deletePostMutation = useMutation({
    mutationFn: (id) => adminPromotionApi.deletePost(id),
    onSuccess: () => {
      toast.success('Marketing post deactivated')
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] })
    },
  })

  const coupons = couponsData?.data?.coupons || []
  const posts = postsData?.data?.posts || []

  return (
    <WorkspaceScaffold
      title="Promotions Management"
      subtitle="Create and manage discount coupons and marketing campaign posts."
      links={adminNav}
    >
      <div className="space-y-8">
        {/* Quick Create Section */}
        <section className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-gym-200/50 group">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-gym-600/20 rounded-full blur-[80px] group-hover:bg-gym-600/30 transition-colors duration-700"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-[60px]"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="text-3xl font-black mb-3 flex items-center gap-3">
                <Sparkles className="text-gym-400 animate-pulse" />
                Create New Promotion
              </h2>
              <p className="text-slate-400 font-medium text-lg leading-relaxed">
                Launch a new marketing campaign or create standalone discount coupons to drive customer engagement and sales.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => { setEditingItem(null); setIsCouponModalOpen(true); }}
                className="px-8 py-4 bg-gym-600 hover:bg-gym-700 text-white rounded-2xl font-bold flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-gym-600/20"
              >
                <Ticket size={20} />
                New Coupon
              </button>
              <button
                onClick={() => { setEditingItem(null); setIsPostModalOpen(true); }}
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl font-bold flex items-center gap-3 transition-all active:scale-95 backdrop-blur-md"
              >
                <Layout size={20} />
                New Marketing Post
              </button>
            </div>
          </div>
        </section>

        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'coupons' ? 'border-gym-600 text-gym-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
          >
            <Ticket size={16} /> Discount Coupons
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'posts' ? 'border-gym-600 text-gym-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
          >
            <Layout size={16} /> Marketing Posts
          </button>
        </div>

        {activeTab === 'coupons' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Ticket className="text-gym-600" size={20} />
                Active Coupons
              </h3>
              <button
                onClick={() => { setEditingItem(null); setIsCouponModalOpen(true); }}
                className="bg-gym-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gym-700 transition-all"
              >
                <Plus size={16} /> Create Coupon
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold">Code</th>
                    <th className="px-6 py-4 font-bold">Discount</th>
                    <th className="px-6 py-4 font-bold">Validity</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingCoupons ? (
                    <tr><td colSpan="5" className="p-10 text-center text-slate-400">Loading coupons...</td></tr>
                  ) : coupons.length === 0 ? (
                    <tr><td colSpan="5" className="p-10 text-center text-slate-400">No coupons found.</td></tr>
                  ) : coupons.map(coupon => (
                    <tr key={coupon.PromotionID} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-gym-600 bg-gym-50 px-2 py-1 rounded">
                          {coupon.PromoCode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900">
                          {coupon.DiscountPercent ? `${coupon.DiscountPercent}%` : `${Number(coupon.DiscountAmount).toLocaleString()} VND`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(coupon.ValidFrom).toLocaleDateString()} - {new Date(coupon.ValidTo).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {coupon.IsActive ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs font-bold bg-green-50 px-2 py-0.5 rounded-full w-fit">
                            <CheckCircle size={12} /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400 text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                            <XCircle size={12} /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => { setEditingItem(coupon); setIsCouponModalOpen(true); }}
                          className="p-2 text-slate-400 hover:text-gym-600 hover:bg-gym-50 rounded-lg transition-all"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => { if (window.confirm('Deactivate this coupon?')) deleteCouponMutation.mutate(coupon.PromotionID) }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="text-gym-600" size={20} />
                Marketing Posts
              </h3>
              <button
                onClick={() => { setEditingItem(null); setIsPostModalOpen(true); }}
                className="bg-gym-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gym-700 transition-all"
              >
                <Plus size={16} /> Create Post
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold">Post Info</th>
                    <th className="px-6 py-4 font-bold">Target Coupon</th>
                    <th className="px-6 py-4 font-bold">Duration</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loadingPosts ? (
                    <tr><td colSpan="5" className="p-10 text-center text-slate-400">Loading posts...</td></tr>
                  ) : posts.length === 0 ? (
                    <tr><td colSpan="5" className="p-10 text-center text-slate-400">No promotion posts found.</td></tr>
                  ) : posts.map(post => (
                    <tr key={post.PromotionPostID} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={post.BannerUrl} className="w-10 h-10 object-cover rounded-md" alt="" />
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{post.Title}</p>
                            <p className="text-xs text-slate-500 line-clamp-1">{post.Content}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-gym-600 bg-gym-50 px-2 py-1 rounded">
                          {post.PromoCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(post.StartAt).toLocaleDateString()} - {new Date(post.EndAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {post.IsActive ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs font-bold bg-green-50 px-2 py-0.5 rounded-full w-fit">
                            <CheckCircle size={12} /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400 text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                            <XCircle size={12} /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button
                          onClick={() => { setEditingItem(post); setIsPostModalOpen(true); }}
                          className="p-2 text-slate-400 hover:text-gym-600 hover:bg-gym-50 rounded-lg transition-all"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => { if (window.confirm('Deactivate this post?')) deletePostMutation.mutate(post.PromotionPostID) }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Coupon Modal */}
        {isCouponModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-900 text-xl">{editingItem ? 'Edit Coupon' : 'New Coupon'}</h3>
                <button onClick={() => setIsCouponModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
              </div>
              <form className="p-6 space-y-4" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const raw = Object.fromEntries(formData);
                const payload = {
                  ...raw,
                  isActive: raw.isActive === 'on' ? 1 : 0
                }
                if (editingItem) {
                  updateCouponMutation.mutate({ id: editingItem.PromotionID, payload: { ...editingItem, ...payload } });
                } else {
                  createCouponMutation.mutate(payload);
                }
              }}>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Ticket size={12} /> Coupon Code</label>
                  <input name="promoCode" defaultValue={editingItem?.PromoCode} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 focus:ring-2 focus:ring-gym-200 outline-none transition-all font-mono" placeholder="WELCOME10" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                  <input name="description" defaultValue={editingItem?.Description} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" placeholder="10% off for first order" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Discount (%)</label>
                    <input name="discountPercent" type="number" step="0.01" defaultValue={editingItem?.DiscountPercent} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Discount (VND)</label>
                    <input name="discountAmount" type="number" defaultValue={editingItem?.DiscountAmount} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Calendar size={12} /> Valid From</label>
                    <input name="validFrom" type="date" defaultValue={editingItem?.ValidFrom?.split('T')[0]} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Calendar size={12} /> Valid To</label>
                    <input name="validTo" type="date" defaultValue={editingItem?.ValidTo?.split('T')[0]} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <input type="checkbox" name="isActive" defaultChecked={editingItem ? (editingItem.IsActive === 1 || editingItem.IsActive === true) : true} className="w-5 h-5 accent-gym-600" />
                  <label className="text-sm font-bold text-slate-700">Set as Active</label>
                </div>
                <button type="submit" disabled={createCouponMutation.isPending || updateCouponMutation.isPending} className="w-full bg-gym-600 text-white py-4 rounded-2xl font-extrabold shadow-lg shadow-gym-200 hover:bg-gym-700 hover:shadow-xl transition-all active:scale-[0.98]">
                  {editingItem ? 'Save Changes' : 'Create Coupon'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Post Modal */}
        {isPostModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-900 text-xl">{editingItem ? 'Edit Post' : 'New Post'}</h3>
                <button onClick={() => setIsPostModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
              </div>
              <form className="p-6 space-y-4" onSubmit={(e) => {
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
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><FileText size={12} /> Post Title</label>
                  <input name="title" defaultValue={editingItem?.Title} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" placeholder="Summer Mega Sale!" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Content</label>
                  <textarea name="content" defaultValue={editingItem?.Content} required rows="3" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" placeholder="Get 10% off all supplements this summer..." />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><ImageIcon size={12} /> Banner Image URL</label>
                  <input name="bannerUrl" defaultValue={editingItem?.BannerUrl} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" placeholder="https://..." />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Ticket size={12} /> Link to Coupon</label>
                  <select name="promotionId" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all bg-white" defaultValue={editingItem?.PromotionID}>
                    <option value="">Select a coupon</option>
                    {coupons.map(c => (
                      <option key={c.PromotionID} value={c.PromotionID}>{c.PromoCode} ({c.DiscountPercent ? `${c.DiscountPercent}%` : `${c.DiscountAmount} VND`})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Calendar size={12} /> Start At</label>
                    <input name="startAt" type="date" defaultValue={editingItem?.StartAt?.split('T')[0]} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Calendar size={12} /> End At</label>
                    <input name="endAt" type="date" defaultValue={editingItem?.EndAt?.split('T')[0]} required className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <input type="checkbox" name="isActive" defaultChecked={editingItem ? (editingItem.IsActive === 1 || editingItem.IsActive === true) : true} className="w-5 h-5 accent-gym-600" />
                  <label className="text-sm font-bold text-slate-700">Set as Active</label>
                </div>
                <button type="submit" disabled={createPostMutation.isPending || updatePostMutation.isPending} className="w-full bg-gym-600 text-white py-4 rounded-2xl font-extrabold shadow-lg shadow-gym-200 hover:bg-gym-700 hover:shadow-xl transition-all active:scale-[0.98]">
                  {editingItem ? 'Update Post' : 'Publish Post'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </WorkspaceScaffold>
  )
}

export default AdminPromotionsPage
