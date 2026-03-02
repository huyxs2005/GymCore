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
  const formatPostBenefit = (post) => {
    const discountPercent = Number(post.DiscountPercent || 0)
    const discountAmount = Number(post.DiscountAmount || 0)
    const bonusDays = Number(post.BonusDurationDays || 0)
    const parts = []
    if (discountPercent > 0) {
      parts.push(`${discountPercent}% OFF`)
    } else if (discountAmount > 0) {
      parts.push(`${discountAmount.toLocaleString()} VND OFF`)
    }
    if (bonusDays > 0) {
      parts.push(`+${bonusDays} DAYS`)
    }
    return parts.length > 0 ? parts.join(' + ') : 'SPECIAL'
  }

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <article
              key={post.PromotionPostID}
              className="gc-card-compact border-2 border-gym-dark-50 bg-white group transition-all duration-500 hover:border-gym-500 hover:shadow-2xl hover:-translate-y-2 overflow-hidden"
            >
              <div className="relative h-56 -mx-8 -mt-8 mb-6 overflow-hidden">
                <img
                  src={post.BannerUrl || 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800'}
                  alt={post.Title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gym-dark-900/80 via-transparent to-transparent opacity-60"></div>

                <div className="absolute top-4 left-4">
                  <div className="bg-gym-500 text-gym-dark-900 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2">
                    <Sparkles size={14} strokeWidth={3} />
                    {formatPostBenefit(post)}
                  </div>
                </div>

                {post.IsClaimed === 1 && (
                  <div className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in duration-500">
                    <div className="bg-gym-dark-900/90 backdrop-blur-md text-gym-500 border-2 border-gym-500/30 px-6 py-3 rounded-[32px] font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl">
                      <CheckCircle2 size={20} strokeWidth={3} />
                      Secured in Wallet
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-gym-500">
                  <Ticket size={20} strokeWidth={2.5} />
                  <span className="text-xs font-black uppercase tracking-[0.3em]">{post.PromoCode}</span>
                </div>

                <h3 className="text-xl font-black text-gym-dark-900 uppercase tracking-tight leading-tight group-hover:text-gym-500 transition-colors">
                  {post.Title}
                </h3>

                <p className="text-xs font-medium text-gym-dark-400 line-clamp-2 leading-relaxed h-8">
                  {post.Content || 'Exclusive access to premium training resources and gear discounts for our dedicated athletes.'}
                </p>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-gym-dark-50/50 border border-gym-dark-100/50">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-gym-dark-300 uppercase tracking-widest">Expiration</span>
                    <span className="text-[10px] font-black text-gym-dark-900 uppercase tracking-tight">
                      {new Date(post.EndAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <Gift size={20} className="text-gym-dark-200" />
                </div>

                <button
                  onClick={() => claimMutation.mutate({ promotionId: post.PromotionID, sourcePostId: post.PromotionPostID })}
                  disabled={claimMutation.isPending || post.IsClaimed === 1}
                  className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 shadow-lg
                    ${post.IsClaimed === 1
                      ? 'bg-gym-dark-50 text-gym-dark-300 border-2 border-gym-dark-100 cursor-default shadow-none'
                      : claimMutation.isPending
                        ? 'bg-gym-dark-200 text-gym-dark-400 cursor-not-allowed'
                        : 'bg-gym-dark-900 text-gym-500 hover:bg-black hover:shadow-gym-dark-900/20 active:scale-95'
                    }`}
                >
                  {post.IsClaimed === 1 ? 'Voucher Secured' : claimMutation.isPending ? 'Processing...' : 'Deploy Offer'}
                </button>
              </div>
            </article>
          ))}

          {posts.length === 0 && (
            <div className="col-span-full py-24 text-center gc-card-compact border-2 border-dashed border-gym-dark-100 bg-gym-dark-50/30">
              <div className="w-20 h-20 bg-white rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl text-gym-dark-200">
                <Ticket size={40} />
              </div>
              <h3 className="text-gym-dark-900 font-black uppercase tracking-tight text-xl">Tactical Silence</h3>
              <p className="text-gym-dark-400 text-xs font-bold mt-2 uppercase tracking-widest">No active deployments. Check back for future drops.</p>
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
