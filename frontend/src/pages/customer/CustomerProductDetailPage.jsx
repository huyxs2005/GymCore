import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronLeft, ChevronRight, ShoppingCart, Star, StarHalf, StarOff, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { cartApi } from '../../features/product/api/cartApi'
import { productApi } from '../../features/product/api/productApi'
import { triggerAddToCartAnimation } from '../../features/product/utils/cartAnimation'
import { useSession } from '../../features/auth/useSession'

const REVIEWS_PER_PAGE = 10

function CustomerProductDetailPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const numericProductId = Number(productId)
  const queryClient = useQueryClient()
  const { user } = useSession()
  const userId = user?.userId ?? null
  const cartQueryKey = ['cart', userId]
  const ordersQueryKey = ['orders', userId]
  const [selectedImageUrl, setSelectedImageUrl] = useState('')
  const [desiredQuantity, setDesiredQuantity] = useState(1)
  const [reviewDraft, setReviewDraft] = useState(null)
  const [reviewDeleteArmedForReviewId, setReviewDeleteArmedForReviewId] = useState(null)
  const [reviewPage, setReviewPage] = useState(1)

  const productDetailQuery = useQuery({
    queryKey: ['product', numericProductId],
    queryFn: () => productApi.getProductDetail(numericProductId),
    enabled: Number.isFinite(numericProductId) && numericProductId > 0,
  })

  const addToCartMutation = useMutation({
    mutationFn: cartApi.addItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey })
    },
    onError: (error) => {
      const message = error?.response?.data?.message || error?.message || 'Unable to add item to cart.'
      toast.error(message)
    },
  })

  const reviewMutation = useMutation({
    mutationFn: ({ productId: targetProductId, rating, comment, mode }) =>
      mode === 'edit'
        ? productApi.updateReview(targetProductId, { rating, comment })
        : productApi.createReview(targetProductId, { rating, comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', numericProductId] })
      queryClient.invalidateQueries({ queryKey: ordersQueryKey })
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.message || 'Unable to submit review.'
      toast.error(message)
    },
  })

  const deleteReviewMutation = useMutation({
    mutationFn: productApi.deleteReview,
    onSuccess: () => {
      setReviewDeleteArmedForReviewId(null)
      queryClient.invalidateQueries({ queryKey: ['product', numericProductId] })
      queryClient.invalidateQueries({ queryKey: ordersQueryKey })
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.message || 'Unable to delete review.'
      toast.error(message)
    },
  })

  const productDetail = productDetailQuery.data ?? null
  const product = productDetail?.product ?? null
  const ownReview = product?.myReview ?? null
  const canReview = Boolean(product?.canReview)
  const galleryImages = useMemo(() => product?.images || [], [product?.images])
  const reviewDeleteArmed = ownReview?.reviewId != null && reviewDeleteArmedForReviewId === ownReview.reviewId
  const allReviews = useMemo(() => productDetail?.reviews || [], [productDetail?.reviews])
  const totalReviewPages = Math.max(1, Math.ceil(allReviews.length / REVIEWS_PER_PAGE))
  const currentReviewPage = Math.min(reviewPage, totalReviewPages)

  const effectiveReviewRating = reviewDraft?.rating ?? Number(ownReview?.rating || 5)
  const effectiveReviewText = reviewDraft?.comment ?? (ownReview?.comment || '')

  const pagedReviews = useMemo(() => {
    const startIndex = (currentReviewPage - 1) * REVIEWS_PER_PAGE
    return allReviews.slice(startIndex, startIndex + REVIEWS_PER_PAGE)
  }, [allReviews, currentReviewPage])

  const activeImageUrl = useMemo(() => {
    if (selectedImageUrl && galleryImages.some((image) => image.imageUrl === selectedImageUrl)) {
      return selectedImageUrl
    }
    return galleryImages.find((image) => image.isPrimary)?.imageUrl || product?.thumbnailUrl || product?.imageUrl || ''
  }, [galleryImages, product?.imageUrl, product?.thumbnailUrl, selectedImageUrl])

  const handleAddToCart = async (event) => {
    if (!product) return
    await addToCartMutation.mutateAsync({
      productId: product.productId,
      quantity: Math.max(1, Number(desiredQuantity || 1)),
    })
    triggerAddToCartAnimation(event?.currentTarget || null)
  }

  const handleBuyNow = async (event) => {
    await handleAddToCart(event)
    navigate('/customer/cart')
  }

  const handleSubmitReview = (event) => {
    event.preventDefault()
    if (!product) return
    if (!canReview) {
      toast.error('You can review this product only after you have a PAID order for it.')
      return
    }
    reviewMutation.mutate({
      productId: product.productId,
      rating: effectiveReviewRating,
      comment: effectiveReviewText,
      mode: ownReview ? 'edit' : 'create',
    })
  }

  const handleDeleteReview = () => {
    if (!product || !ownReview) return
    if (!reviewDeleteArmed) {
      setReviewDeleteArmedForReviewId(ownReview.reviewId)
      return
    }
    deleteReviewMutation.mutate(product.productId)
  }

  return (
    <WorkspaceScaffold
      title="Product Detail"
      subtitle="Review the full product gallery, usage instructions, customer feedback, and add the product to your cart."
      links={customerNav}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link to="/customer/shop" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <ArrowLeft size={16} />
          Back to catalog
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/customer/orders" className="inline-flex items-center gap-2 rounded-full border border-gym-200 bg-gym-50 px-4 py-2 text-sm font-semibold text-gym-700 hover:bg-gym-100">
            View buying history
          </Link>
          <Link to="/customer/cart" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <ShoppingCart size={16} />
            View cart
          </Link>
        </div>
      </div>

      {productDetailQuery.isLoading ? <p className="text-sm text-slate-500">Loading product details...</p> : null}
      {productDetailQuery.isError ? <p className="text-sm text-rose-600">Could not load product details.</p> : null}
      {!productDetailQuery.isLoading && !product ? <p className="text-sm text-slate-500">Product not found.</p> : null}

      {product ? (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="gc-card-compact space-y-4">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
                {activeImageUrl ? <img src={activeImageUrl} alt={product.name} className="h-[420px] w-full object-cover" /> : null}
              </div>
              {galleryImages.length > 1 ? (
                <div className="grid grid-cols-4 gap-3">
                  {galleryImages.map((image) => (
                    <button
                      key={image.productImageId || image.imageUrl}
                      type="button"
                      onClick={() => setSelectedImageUrl(image.imageUrl)}
                      className={`overflow-hidden rounded-2xl border ${activeImageUrl === image.imageUrl ? 'border-gym-500 ring-2 ring-gym-100' : 'border-slate-200'}`}
                    >
                      <img src={image.imageUrl} alt={image.altText || product.name} className="h-20 w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="gc-card-compact space-y-6">
              <div className="flex flex-wrap gap-2">
                {(product.categories || []).map((category) => (
                  <span key={`${product.productId}-${category.productCategoryId}`} className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">
                    {category.name}
                  </span>
                ))}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
                {product.shortDescription ? <p className="mt-2 text-base text-slate-600">{product.shortDescription}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <ProductRating rating={Number(product.averageRating || 0)} count={Number(product.reviewCount || 0)} />
                <span className="text-sm font-semibold text-slate-900">{Number(product.price || 0).toLocaleString('en-US')} VND</span>
              </div>
              <p className="text-sm leading-6 text-slate-700">{product.description || 'No description provided yet.'}</p>
              <div className="rounded-2xl border border-gym-100 bg-gym-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gym-700">How to use</p>
                <p className="mt-2 text-sm text-gym-900">{product.usageInstructions || 'Usage instructions will be added later.'}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-sm">
                  <button type="button" onClick={() => setDesiredQuantity((prev) => Math.max(1, prev - 1))} className="rounded-full px-2 text-slate-500 hover:text-slate-900">-</button>
                  <span className="min-w-[2rem] text-center font-semibold text-slate-800">{desiredQuantity}</span>
                  <button type="button" onClick={() => setDesiredQuantity((prev) => prev + 1)} className="rounded-full px-2 text-slate-500 hover:text-slate-900">+</button>
                </div>
                <button type="button" onClick={handleAddToCart} disabled={addToCartMutation.isPending} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gym-700 bg-gym-600 px-5 py-2 text-sm font-semibold text-white hover:bg-gym-700 disabled:cursor-not-allowed disabled:bg-slate-400">
                  <ShoppingCart size={16} />
                  {addToCartMutation.isPending ? 'Adding...' : 'Add to cart'}
                </button>
                <button type="button" onClick={handleBuyNow} disabled={addToCartMutation.isPending} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                  Buy now
                </button>
              </div>

              <div className="space-y-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="gc-section-kicker">Your review</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {canReview ? 'You can review this product because you already purchased it.' : 'Reviews are unlocked after you complete a paid order for this product.'}
                    </p>
                  </div>
                  {ownReview ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Already reviewed</span> : null}
                </div>

                <form onSubmit={handleSubmitReview} className="space-y-4">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rating</span>
                    <select value={effectiveReviewRating} onChange={(event) => setReviewDraft((prev) => ({ ...(prev || {}), rating: Number(event.target.value), comment: prev?.comment ?? effectiveReviewText }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-gym-500 focus:bg-white focus:outline-none" disabled={!canReview || reviewMutation.isPending}>
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>{value} star{value > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comment</span>
                    <textarea value={effectiveReviewText} onChange={(event) => setReviewDraft((prev) => ({ rating: prev?.rating ?? effectiveReviewRating, comment: event.target.value }))} className="min-h-[120px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-gym-500 focus:bg-white focus:outline-none" placeholder="Share your experience with this product." disabled={!canReview || reviewMutation.isPending} />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={!canReview || !effectiveReviewText.trim() || reviewMutation.isPending} className="rounded-full bg-gym-600 px-5 py-2 text-sm font-semibold text-white hover:bg-gym-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                      {reviewMutation.isPending ? 'Saving...' : ownReview ? 'Update review' : 'Submit review'}
                    </button>
                    {ownReview ? (
                      <button type="button" onClick={handleDeleteReview} disabled={deleteReviewMutation.isPending} className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold ${reviewDeleteArmed ? 'bg-rose-600 text-white hover:bg-rose-700' : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'} disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-100`}>
                        <Trash2 size={15} />
                        {deleteReviewMutation.isPending ? 'Deleting...' : reviewDeleteArmed ? 'Confirm delete' : 'Delete review'}
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>
            </section>
          </div>

          <article className="gc-card-compact space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="gc-section-kicker">Customer reviews</p>
                <p className="mt-1 text-sm text-slate-500">Recent feedback from customers who purchased this product.</p>
              </div>
              <div className="text-sm font-semibold text-slate-700">{Number(product.reviewCount || 0)} review(s)</div>
            </div>

            {allReviews.length ? (
              <>
                <div className="space-y-3">
                  {pagedReviews.map((review) => (
                    <div key={review.productReviewId} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {review.avatarUrl ? (
                            <img
                              src={review.avatarUrl}
                              alt={`${review.customerName || 'Customer'} avatar`}
                              className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gym-100 text-sm font-semibold text-gym-700 ring-2 ring-white">
                              {getReviewInitials(review.customerName)}
                            </div>
                          )}
                          <p className="truncate text-sm font-semibold text-slate-900">{review.customerName}</p>
                        </div>
                        <ProductRating rating={Number(review.rating || 0)} size="sm" />
                      </div>
                      {review.comment ? <p className="mt-2 text-sm text-slate-700">{review.comment}</p> : null}
                      <p className="mt-2 text-[11px] text-slate-400">{review.reviewDate ? new Date(review.reviewDate).toLocaleString() : ''}</p>
                    </div>
                  ))}
                </div>

                {totalReviewPages > 1 ? (
                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setReviewPage((page) => Math.max(1, page - 1))}
                      disabled={currentReviewPage === 1}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    <p className="text-sm font-medium text-slate-500">
                      Page {currentReviewPage} of {totalReviewPages}
                    </p>
                    <button
                      type="button"
                      onClick={() => setReviewPage((page) => Math.min(totalReviewPages, page + 1))}
                      disabled={currentReviewPage === totalReviewPages}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                No reviews yet.
              </div>
            )}
          </article>
        </div>
      ) : null}
    </WorkspaceScaffold>
  )
}

function ProductRating({ rating, count, size = 'md' }) {
  const value = Number.isFinite(rating) ? rating : 0
  const fullStars = Math.floor(value)
  const hasHalf = value - fullStars >= 0.5
  const totalStars = 5
  const iconSize = size === 'sm' ? 12 : 14

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-[1px]">
        {Array.from({ length: totalStars }).map((_, index) => {
          if (index < fullStars) return <Star key={index} size={iconSize} className="fill-gym-500 text-gym-500" />
          if (index === fullStars && hasHalf) return <StarHalf key={index} size={iconSize} className="fill-gym-500 text-gym-500" />
          return <StarOff key={index} size={iconSize} className="text-slate-300" />
        })}
      </div>
      <span className="text-[11px] font-medium text-slate-600">{value.toFixed(1)} {typeof count === 'number' ? `(${count})` : ''}</span>
    </div>
  )
}

function getReviewInitials(name) {
  if (!name) return 'U'
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  if (!parts.length) return 'U'
  return parts.map((part) => part[0]?.toUpperCase() || '').join('')
}

export default CustomerProductDetailPage
