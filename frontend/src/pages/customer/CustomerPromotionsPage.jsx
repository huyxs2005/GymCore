import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { promotionApi } from '../../features/promotion/api/promotionApi'
import { toast } from 'react-hot-toast'
import { Ticket, Gift, Sparkles, Clock, CheckCircle2, X } from 'lucide-react'

function CustomerPromotionsPage() {
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [claimedCoupon, setClaimedCoupon] = useState(null)
  const queryClient = useQueryClient()

  const { data: postsData, isLoading } = useQuery({
    queryKey: ['promotionPosts'],
    queryFn: () => promotionApi.getPromotionPosts(),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const claimMutation = useMutation({
    mutationFn: (payload) => promotionApi.claimCoupon(payload),
    onSuccess: (response, variables) => {
      // Find the coupon that was just claimed to show in the modal
      const post = posts.find(p => p.PromotionID === variables.promotionId)
      setClaimedCoupon(post)
      setShowSuccessModal(true)
      queryClient.invalidateQueries({ queryKey: ['promotionPosts'] })
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
                {post.IsClaimed === 1 && (
                  <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="bg-white/90 text-slate-900 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-xl">
                      <CheckCircle2 size={18} className="text-green-500" />
                      In Your Wallet
                    </span>
                  </div>
                )}
              </div>

              <div className="p-5">
                <div className="flex items-center gap-2 text-gym-600 mb-2">
                  <Ticket size={16} />
                  <span className="text-sm font-bold tracking-wider">{post.PromoCode}</span>
                </div>

                <h3 className="font-bold text-slate-900 text-lg mb-2 group-hover:text-gym-600 transition-colors line-clamp-1">
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
                  disabled={claimMutation.isPending || post.IsClaimed === 1}
                  className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2
                    ${post.IsClaimed === 1
                      ? 'bg-green-50 text-green-600 border border-green-100 cursor-default'
                      : claimMutation.isPending
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-gym-600 text-white hover:bg-gym-700 active:scale-95 shadow-sm'
                    }`}
                >
                  {post.IsClaimed === 1 ? (
                    <>
                      <CheckCircle2 size={16} />
                      Claimed
                    </>
                  ) : claimMutation.isPending ? (
                    'Claiming...'
                  ) : (
                    'Claim Voucher'
                  )}
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

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="relative h-32 bg-gym-600 flex items-center justify-center">
              <div className="absolute top-4 right-4 text-white/60 hover:text-white cursor-pointer transition-colors" onClick={() => setShowSuccessModal(false)}>
                <X size={24} />
              </div>
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg transform -translate-y-2">
                <Gift size={40} className="text-gym-600 animate-bounce" />
              </div>
            </div>
            <div className="px-8 pb-8 pt-4 text-center">
              <h2 className="text-2xl font-black text-slate-900 mb-2">Claim Successful!</h2>
              <p className="text-slate-500 text-sm mb-6">
                Voucher <span className="font-bold text-gym-600">#{claimedCoupon?.PromoCode}</span> has been added to your wallet. Use it during checkout to save!
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors shadow-lg active:scale-95 transition-transform"
              >
                Awesome!
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceScaffold>
  )
}

export default CustomerPromotionsPage
