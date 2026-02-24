import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import StarterPage from '../../components/common/StarterPage'
import { adminNav } from '../../config/navigation'
<<<<<<< Updated upstream
=======
import { Plus, Edit, Ticket, Image as ImageIcon, CheckCircle, XCircle, Trash2 } from 'lucide-react'
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

  const createPostMutation = useMutation({
    mutationFn: (payload) => adminPromotionApi.createPost(payload),
    onSuccess: () => {
      toast.success('Marketing post created')
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] })
      setIsPostModalOpen(false)
    },
  })

  const updatePostMutation = useMutation({
    mutationFn: ({ id, payload }) => adminPromotionApi.updatePost(id, payload),
    onSuccess: () => {
      toast.success('Marketing post updated')
      queryClient.invalidateQueries({ queryKey: ['adminPosts'] })
      setIsPostModalOpen(false)
    },
  })

  const coupons = couponsData?.data?.coupons || []
  const posts = postsData?.data?.posts || []
>>>>>>> Stashed changes

function AdminPromotionsPage() {
  return (
    <WorkspaceScaffold
      title="Admin Promotions"
      subtitle="Manage coupon codes and promotion posts."
      links={adminNav}
    >
<<<<<<< Updated upstream
      <StarterPage
        title="Coupon + post administration"
        subtitle="Support coupon validity windows and one-time-per-user claim rule."
        endpoints={[
          'GET /api/v1/admin/promotions/coupons',
          'POST /api/v1/admin/promotions/coupons',
          'PUT /api/v1/admin/promotions/coupons/{promotionId}',
          'POST /api/v1/admin/promotions/posts',
          'PUT /api/v1/admin/promotions/posts/{postId}',
        ]}
        frontendFiles={['src/pages/admin/AdminPromotionsPage.jsx', 'src/features/promotion/api/adminPromotionApi.js']}
        backendFiles={[
          'src/main/java/com/gymcore/backend/modules/promotion/controller/PromotionController.java',
          'src/main/java/com/gymcore/backend/modules/promotion/service/PromotionService.java',
        ]}
      />
=======
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('coupons')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'coupons' ? 'border-gym-600 text-gym-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
          >
            Discount Coupons
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'posts' ? 'border-gym-600 text-gym-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
          >
            Marketing Posts
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
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => { setEditingItem(coupon); setIsCouponModalOpen(true); }}
                          className="p-2 text-slate-400 hover:text-gym-600 hover:bg-gym-50 rounded-lg transition-all"
                        >
                          <Edit size={16} />
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
                Promotion Posts
              </h3>
              <button
                onClick={() => { setEditingItem(null); setIsPostModalOpen(true); }}
                className="bg-gym-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-gym-700 transition-all"
              >
                <Plus size={16} /> Create Post
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {loadingPosts ? (
                <div className="col-span-full py-10 text-center text-slate-400">Loading posts...</div>
              ) : posts.length === 0 ? (
                <div className="col-span-full py-10 text-center text-slate-400">No promotion posts found.</div>
              ) : posts.map(post => (
                <div key={post.PromotionPostID} className="group rounded-2xl border border-slate-100 bg-white overflow-hidden hover:shadow-md transition-all">
                  <div className="h-40 bg-slate-100 relative">
                    <img
                      src={post.BannerUrl || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800'}
                      alt={post.Title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3 flex gap-2">
                      <button
                        onClick={() => { setEditingItem(post); setIsPostModalOpen(true); }}
                        className="p-2 bg-white/90 backdrop-blur-sm text-slate-600 rounded-lg hover:text-gym-600 transition-all shadow-sm"
                      >
                        <Edit size={14} />
                      </button>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <span className="bg-gym-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        {post.PromoCode}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <h4 className="font-bold text-slate-900 truncate">{post.Title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {post.Content}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                      <span className="text-[10px] text-slate-400">
                        Ends: {new Date(post.EndAt).toLocaleDateString()}
                      </span>
                      {post.IsActive ? (
                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Active</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">Draft</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coupon Modal */}
        {isCouponModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-900 text-xl">{editingItem ? 'Edit Coupon' : 'New Coupon'}</h3>
                <button onClick={() => setIsCouponModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
              </div>
              <form className="p-6 space-y-4" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const payload = Object.fromEntries(formData);
                if (editingItem) {
                  updateCouponMutation.mutate({ id: editingItem.PromotionID, payload: { ...editingItem, ...payload } });
                } else {
                  createCouponMutation.mutate(payload);
                }
              }}>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Coupon Code</label>
                  <input name="promoCode" defaultValue={editingItem?.PromoCode} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 focus:ring-2 focus:ring-gym-200 outline-none transition-all font-mono" placeholder="WELCOME10" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Description</label>
                  <input name="description" defaultValue={editingItem?.Description} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" placeholder="10% off for new members" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Discount (%)</label>
                    <input name="discountPercent" type="number" step="0.01" defaultValue={editingItem?.DiscountPercent} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Amt (VND)</label>
                    <input name="discountAmount" type="number" defaultValue={editingItem?.DiscountAmount} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Valid From</label>
                    <input name="validFrom" type="date" defaultValue={editingItem?.ValidFrom?.split('T')[0]} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Valid To</label>
                    <input name="validTo" type="date" defaultValue={editingItem?.ValidTo?.split('T')[0]} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" />
                  </div>
                </div>
                <button type="submit" disabled={createCouponMutation.isPending || updateCouponMutation.isPending} className="w-full bg-gym-600 text-white py-3.5 rounded-2xl font-extrabold shadow-lg hover:bg-gym-700 transition-all mt-4 disabled:bg-slate-300">
                  {editingItem ? 'Save Changes' : 'Create Coupon'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Post Modal */}
        {isPostModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-extrabold text-slate-900 text-xl">{editingItem ? 'Edit Post' : 'New Promotion Post'}</h3>
                <button onClick={() => setIsPostModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={24} /></button>
              </div>
              <form className="p-6 space-y-4" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const payload = Object.fromEntries(formData);
                // Ensure IsActive is boolean
                payload.isActive = payload.isActive === 'true';
                if (editingItem) {
                  updatePostMutation.mutate({ id: editingItem.PromotionPostID, payload: { ...editingItem, ...payload } });
                } else {
                  createPostMutation.mutate(payload);
                }
              }}>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Title</label>
                  <input name="title" defaultValue={editingItem?.Title} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" placeholder="Summer Body Challenge" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Content</label>
                  <textarea name="content" defaultValue={editingItem?.Content} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all min-h-[100px]" placeholder="Detailed description of the promotion..." />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Banner Image URL</label>
                  <input name="bannerUrl" defaultValue={editingItem?.BannerUrl} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all" placeholder="https://..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Link to Coupon</label>
                    <select name="promotionId" defaultValue={editingItem?.PromotionID} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all">
                      <option value="">Select a coupon</option>
                      {coupons.map(c => <option key={c.PromotionID} value={c.PromotionID}>{c.PromoCode} ({c.DiscountPercent ? `${c.DiscountPercent}%` : `${c.DiscountAmount}VND`})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                    <select name="isActive" defaultValue={editingItem?.IsActive ? 'true' : 'false'} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all">
                      <option value="true">Active/Published</option>
                      <option value="false">Draft/Hidden</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Start Posting</label>
                    <input name="startAt" type="datetime-local" defaultValue={editingItem?.StartAt ? new Date(editingItem.StartAt).toISOString().slice(0, 16) : ''} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">End Posting</label>
                    <input name="endAt" type="datetime-local" defaultValue={editingItem?.EndAt ? new Date(editingItem.EndAt).toISOString().slice(0, 16) : ''} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-gym-500 outline-none transition-all text-xs" />
                  </div>
                </div>
                <button type="submit" disabled={createPostMutation.isPending || updatePostMutation.isPending} className="w-full bg-gym-600 text-white py-3.5 rounded-2xl font-extrabold shadow-lg hover:bg-gym-700 transition-all mt-4 disabled:bg-slate-300">
                  {editingItem ? 'Update Post' : 'Publish Post'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
>>>>>>> Stashed changes
    </WorkspaceScaffold>
  )
}

export default AdminPromotionsPage
