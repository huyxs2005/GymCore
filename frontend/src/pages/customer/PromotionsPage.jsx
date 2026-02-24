import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { promotionApi } from '../../features/promotion/api/promotionApi'
import { toast } from 'react-hot-toast'

const PromotionsPage = () => {
    const queryClient = useQueryClient()

    const { data: postsData, isLoading } = useQuery({
        queryKey: ['promotionPosts'],
        queryFn: () => promotionApi.getPromotionPosts(),
    })

    const { data: claimsData } = useQuery({
        queryKey: ['myClaims'],
        queryFn: () => promotionApi.getMyClaims(),
    })

    const myClaims = claimsData?.data?.claims || []

    const claimMutation = useMutation({
        mutationFn: (payload) => promotionApi.claimCoupon(payload),
        onSuccess: (response) => {
            toast.success('Claim Successful!')
            queryClient.invalidateQueries({ queryKey: ['myClaims'] })
        },
        onError: (error) => {
            toast.error(error?.response?.data?.message || 'Failed to claim coupon')
        },
    })

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gym-600"></div>
            </div>
        )
    }

    const posts = postsData?.data?.posts || []

    const isAlreadyClaimed = (promotionId) => {
        return myClaims.some(claim => claim.PromotionID === promotionId)
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center mb-16">
                <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl">
                    Exclusive Offers & Promotions
                </h1>
                <p className="mt-4 text-xl text-slate-500 max-w-2xl mx-auto">
                    Elevate your fitness journey with our special deals and discounts. Claim your vouchers today!
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map((post) => {
                    const claimed = isAlreadyClaimed(post.PromotionID)
                    return (
                        <div
                            key={post.PromotionPostID}
                            className="group bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2"
                        >
                            <div className="relative h-56 w-full">
                                <img
                                    src={post.BannerUrl || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800'}
                                    alt={post.Title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                />
                                <div className="absolute top-4 right-4 text-xs font-bold uppercase tracking-widest bg-gym-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-full shadow-lg">
                                    {post.DiscountPercent ? `${post.DiscountPercent}% OFF` : `${Number(post.DiscountAmount).toLocaleString()} VND OFF`}
                                </div>
                            </div>

                            <div className="p-6">
                                <h3 className="text-2xl font-bold text-slate-900 mb-2 truncate">
                                    {post.Title}
                                </h3>
                                <p className="text-slate-600 text-sm mb-6 line-clamp-3 leading-relaxed">
                                    {post.Content}
                                </p>

                                <div className="flex items-center justify-between mb-6 text-xs text-slate-400">
                                    <span className="flex items-center">
                                        <svg className="w-4 h-4 mr-1 text-gym-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Ends: {new Date(post.EndAt).toLocaleDateString()}
                                    </span>
                                    <span className="font-mono text-gym-600 font-bold bg-gym-50 px-2 py-1 rounded">
                                        {post.PromoCode}
                                    </span>
                                </div>

                                <button
                                    onClick={() => claimMutation.mutate({ promotionId: post.PromotionID, sourcePostId: post.PromotionPostID })}
                                    disabled={claimMutation.isPending || claimed}
                                    className={`w-full py-3.5 px-6 rounded-xl font-extrabold text-white transition-all duration-200 shadow-md 
                    ${claimed
                                            ? 'bg-green-600 cursor-not-allowed opacity-90'
                                            : claimMutation.isPending
                                                ? 'bg-slate-400 cursor-not-allowed'
                                                : 'bg-gym-600 hover:bg-gym-700 active:scale-[0.98] hover:shadow-lg'
                                        }`}
                                >
                                    {claimed ? 'Claimed' : claimMutation.isPending ? 'Claiming...' : 'Claim Voucher'}
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {posts.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                    <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 00-2 2H6a2 2 0 00-2 2v-5m16 0h-3.586a1 1 0 01-.707-.293l-2.414-2.414a1 1 0 00-.707-.293h-3.172a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293H4" />
                    </svg>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">No active promotions</h3>
                    <p className="mt-1 text-slate-500">Check back later for exciting fitness deals!</p>
                </div>
            )}
        </div>
    )
}

export default PromotionsPage
