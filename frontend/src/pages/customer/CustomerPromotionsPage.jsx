import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { promotionApi } from '../../features/promotion/api/promotionApi'
import { toast } from 'react-hot-toast'
import { Ticket, Gift, Sparkles, Clock } from 'lucide-react'

function CustomerPromotionsPage() {
  const queryClient = useQueryClient()

  const { data: postsData, isLoading } = useQuery({
    queryKey: ['promotionPosts'],
    queryFn: () => promotionApi.getPromotionPosts(),
  })

  const claimMutation = useMutation({
    mutationFn: (payload) => promotionApi.claimCoupon(payload),
    onSuccess: (response) => {
      toast.success(response?.message || 'Coupon claimed successfully!')
      queryClient.invalidateQueries({ queryKey: ['myClaims'] })
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || 'Failed to claim coupon')
    },
  })

  const posts = postsData?.data?.posts || []

  return (
    <WorkspaceScaffold
      title="Promotions & Special Offers"
      subtitle="Discover exclusive deals and claim coupons for your fitness journey."
      links={customerNav}
    >
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-gym-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <div
              key={post.PromotionPostID}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group transition-all hover:shadow-md hover:-translate-y-1"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={post.BannerUrl || 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800'}
                  alt={post.Title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute top-3 left-3">
                  <span className="bg-gym-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                    <Sparkles size={12} />
                    {post.DiscountPercent ? `${post.DiscountPercent}% OFF` : `$${post.DiscountAmount} OFF`}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 text-gym-600 mb-2">
                  <Ticket size={16} />
                  <span className="text-sm font-bold tracking-wider">{post.PromoCode}</span>
                </div>

                <h3 className="font-bold text-slate-900 text-lg mb-2 group-hover:text-gym-600 transition-colors">
                  {post.Title}
                </h3>

                <p className="text-slate-600 text-sm mb-6 line-clamp-2 min-h-[40px]">
                  {post.Content}
                </p>

                <div className="flex items-center justify-between mb-6 p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Clock size={14} />
                    <span className="text-[10px] font-medium">
                      Expires: {new Date(post.EndAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Gift size={16} className="text-gym-400" />
                </div>

                <button
                  onClick={() => claimMutation.mutate({ promotionId: post.PromotionID, sourcePostId: post.PromotionPostID })}
                  disabled={claimMutation.isPending}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 
                    ${claimMutation.isPending
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-gym-600 text-white hover:bg-gym-700 active:scale-95 shadow-sm'
                    }`}
                >
                  {claimMutation.isPending ? 'Claiming...' : 'Claim Voucher'}
                </button>
              </div>
            </div>
          ))}

          {posts.length === 0 && (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ticket className="text-slate-300" size={32} />
              </div>
              <h3 className="text-slate-900 font-bold">No active promotions</h3>
              <p className="text-slate-500 text-sm mt-1">Check back later for exclusive fitness offers!</p>
            </div>
          )}
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CustomerPromotionsPage
