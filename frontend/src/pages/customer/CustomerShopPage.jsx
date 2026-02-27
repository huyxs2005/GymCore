import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, CreditCard, History, Star, StarHalf, StarOff } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { productApi } from '../../features/product/api/productApi'
import { cartApi } from '../../features/product/api/cartApi'
import { orderApi } from '../../features/product/api/orderApi'
import { promotionApi } from '../../features/promotion/api/promotionApi'

function CustomerShopPage() {
  const queryClient = useQueryClient()
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [productSearch, setProductSearch] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [checkoutOptions, setCheckoutOptions] = useState({
    paymentMethod: 'PAYOS',
    promoCode: '',
  })
  const [couponPreview, setCouponPreview] = useState(null)
  const [couponPreviewError, setCouponPreviewError] = useState('')
  const [showSuccessMessage, setShowSuccessMessage] = useState(() => {
    const status = new URLSearchParams(window.location.search).get('status')
    const normalizedStatus = status ? status.trim().toUpperCase() : ''
    return normalizedStatus === 'PAID' || normalizedStatus === 'SUCCESS'
  })

  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: productApi.getProducts,
  })

  const cartQuery = useQuery({
    queryKey: ['cart'],
    queryFn: cartApi.getCart,
  })

  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: orderApi.getMyOrders,
  })

  const productDetailQuery = useQuery({
    queryKey: ['product', selectedProductId],
    queryFn: () => productApi.getProductDetail(selectedProductId),
    enabled: !!selectedProductId,
  })

  const { data: claimsData } = useQuery({
    queryKey: ['myClaims'],
    queryFn: () => promotionApi.getMyClaims(),
  })

  const myClaims = claimsData?.data?.claims || []
  const availableCoupons = myClaims.filter(c => !c.UsedAt)
  const productCoupons = availableCoupons.filter((claim) => Number(claim.BonusDurationDays || 0) <= 0)
  const membershipOnlyCoupons = availableCoupons.filter((claim) => Number(claim.BonusDurationDays || 0) > 0)

  const addToCartMutation = useMutation({
    mutationFn: cartApi.addItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })

  const updateCartMutation = useMutation({
    mutationFn: ({ productId, quantity }) => cartApi.updateItem(productId, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })

  const removeCartItemMutation = useMutation({
    mutationFn: cartApi.removeItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: orderApi.checkout,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      // response is the body from orderApi.checkout, which follows ApiResponse { status, message, data }
      const checkoutUrl = response?.data?.checkoutUrl
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      } else {
        alert('Checkout URL not found in API response. Please check backend logs.')
      }
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.message || 'Checkout failed. Please try again.'
      alert(message)
    },
  })

  const createReviewMutation = useMutation({
    mutationFn: ({ productId, rating, comment }) => productApi.createReview(productId, { rating, comment }),
    onSuccess: () => {
      setReviewText('')
      setReviewRating(5)
      if (selectedProductId) {
        queryClient.invalidateQueries({ queryKey: ['product', selectedProductId] })
      }
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.message || 'Unable to submit review.'
      alert(message)
    },
  })

  const previewCouponMutation = useMutation({
    mutationFn: (payload) => promotionApi.applyCoupon(payload),
    onSuccess: (response) => {
      setCouponPreviewError('')
      setCouponPreview(response?.data ?? null)
    },
    onError: (error) => {
      setCouponPreview(null)
      setCouponPreviewError(error.response?.data?.message || error.message || 'Unable to preview coupon.')
    },
  })

  const products = productsQuery.data?.data?.products ?? []
  const normalizedSearch = productSearch.trim().toLowerCase()
  const filteredProducts = normalizedSearch
    ? products.filter((product) => String(product.name || '').toLowerCase().includes(normalizedSearch))
    : products
  const cart = cartQuery.data?.data ?? { items: [], subtotal: 0, currency: 'VND' }
  const orders = ordersQuery.data?.data?.orders ?? []
  const productDetail = productDetailQuery.data?.data ?? null
  const paidProductIds = new Set(
    orders
      .filter((order) => String(order.status || '').toUpperCase() === 'PAID')
      .flatMap((order) => (order.items || []).map((item) => item.productId)),
  )
  const canReviewSelectedProduct = selectedProductId != null && paidProductIds.has(selectedProductId)

  const handleAddToCart = (product) => {
    addToCartMutation.mutate({ productId: product.productId, quantity: 1 })
  }

  const handleUpdateCartQty = (productId, quantity) => {
    updateCartMutation.mutate({ productId, quantity })
  }

  const handleRemoveCartItem = (productId) => {
    removeCartItemMutation.mutate(productId)
  }

  const handleCheckout = () => {
    if (!cart.items || cart.items.length === 0) return
    setShowCheckoutModal(true)
  }

  const confirmCheckout = () => {
    checkoutMutation.mutate(checkoutOptions)
    setShowCheckoutModal(false)
  }

  const formatClaimBenefit = (claim) => {
    const discountPercent = Number(claim.DiscountPercent || 0)
    const discountAmount = Number(claim.DiscountAmount || 0)
    const bonusDays = Number(claim.BonusDurationDays || 0)
    const parts = []
    if (discountPercent > 0) {
      parts.push(`${discountPercent}% off`)
    } else if (discountAmount > 0) {
      parts.push(`${discountAmount.toLocaleString()} VND off`)
    }
    if (bonusDays > 0) {
      parts.push(`+${bonusDays} membership day${bonusDays > 1 ? 's' : ''}`)
    }
    return parts.length > 0 ? parts.join(' + ') : 'No benefit'
  }

  // Effect to handle post-payment redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const status = (urlParams.get('status') || '').trim().toUpperCase()
    if (status === 'PAID' || status === 'SUCCESS') {
      const paymentReturnPayload = Object.fromEntries(urlParams.entries())
      orderApi
        .confirmPaymentReturn(paymentReturnPayload)
        .catch(() => null)
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          queryClient.invalidateQueries({ queryKey: ['cart'] })
        })
      const timer = setTimeout(() => {
        setShowSuccessMessage(false)
        window.history.replaceState({}, document.title, window.location.pathname)
      }, 3000)
      return () => clearTimeout(timer)
    } else if (status === 'CANCELLED') {
      // Just clear the URL if cancelled
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [queryClient])

  const handleSubmitReview = (event) => {
    event.preventDefault()
    if (!selectedProductId) return
    if (!canReviewSelectedProduct) {
      alert('You can review this product only after you have a PAID order for it.')
      return
    }
    createReviewMutation.mutate({
      productId: selectedProductId,
      rating: reviewRating,
      comment: reviewText,
    })
  }

  return (
    <WorkspaceScaffold
      title="GymCore Product Shop"
      subtitle="Browse products, pay on website with PayOS, then pick up in person at the gym front desk."
      links={customerNav}
    >
      {showSuccessMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in rounded-3xl bg-white p-8 text-center shadow-2xl duration-300">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Star size={32} className="fill-emerald-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-900">Order Successful!</h2>
            <p className="text-slate-600">Your payment was confirmed. Please pick up your products at the gym front desk.</p>
          </div>
        </div>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md animate-in fade-in zoom-in rounded-3xl bg-white p-6 shadow-2xl duration-200">
            <h3 className="mb-4 text-xl font-bold text-slate-900">Checkout Options</h3>
            <div className="space-y-4">
              <p className="rounded-xl border border-gym-100 bg-gym-50 px-3 py-2 text-xs text-gym-800">
                Product orders are picked up in person at the gym front desk (no shipping delivery).
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Payment Method</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-gym-500 focus:outline-none"
                  value={checkoutOptions.paymentMethod}
                  onChange={(e) => setCheckoutOptions({ ...checkoutOptions, paymentMethod: e.target.value })}
                >
                  <option value="PAYOS">PayOS (Online Payment)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Apply Coupon (Optional)</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-gym-500 focus:outline-none"
                  value={checkoutOptions.promoCode}
                  onChange={(e) => {
                    const promoCode = e.target.value
                    setCheckoutOptions({ ...checkoutOptions, promoCode })
                    setCouponPreview(null)
                    setCouponPreviewError('')
                    if (promoCode) {
                      previewCouponMutation.mutate({
                        promoCode,
                        target: 'ORDER',
                        subtotal: Number(cart.subtotal || 0),
                      })
                    }
                  }}
                >
                  <option value="">No coupon applied</option>
                  {productCoupons.map((claim) => (
                    <option key={claim.ClaimID} value={claim.PromoCode}>
                      {claim.PromoCode} - {formatClaimBenefit(claim)}
                    </option>
                  ))}
                </select>
                {productCoupons.length === 0 && (
                  <p className="mt-1 text-[10px] text-slate-400">No available coupons in your wallet. Claim some in the Promotions page!</p>
                )}
                {membershipOnlyCoupons.length > 0 && (
                  <p className="mt-1 text-[10px] text-amber-600">
                    {membershipOnlyCoupons.length} coupon(s) are membership-only and cannot be used for product checkout.
                  </p>
                )}
                {couponPreview && checkoutOptions.promoCode && (
                  <p className="mt-2 rounded-lg border border-gym-100 bg-gym-50 px-2 py-1 text-[11px] text-gym-800">
                    Preview: discount {Number(couponPreview.estimatedDiscount || 0).toLocaleString()} VND,
                    total {Number(couponPreview.estimatedFinalAmount || cart.subtotal || 0).toLocaleString()} VND.
                  </p>
                )}
                {couponPreviewError && (
                  <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                    {couponPreviewError}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="flex-1 rounded-full border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmCheckout}
                className="flex-1 rounded-full border border-gym-700 bg-gym-600 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-gym-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-100"
              >
                Confirm Order
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)]">
        {/* Product list */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Products</h2>
            <span className="text-xs text-slate-500">{filteredProducts.length} / {products.length} items</span>
          </header>
          <div>
            <input
              type="text"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Search product by name..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-gym-500 focus:outline-none focus:ring-1 focus:ring-gym-500"
            />
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {productsQuery.isLoading && <p className="text-sm text-slate-500">Loading products...</p>}
            {productsQuery.isError && (
              <p className="text-sm text-red-600">Failed to load products. Please try again later.</p>
            )}
            {!productsQuery.isLoading && products.length === 0 && (
              <p className="text-sm text-slate-500">No products available yet.</p>
            )}
            {!productsQuery.isLoading && products.length > 0 && filteredProducts.length === 0 && (
              <p className="text-sm text-slate-500">No products match your search.</p>
            )}
            {filteredProducts.map((product) => (
              <button
                key={product.productId}
                type="button"
                onClick={() => setSelectedProductId(product.productId)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${selectedProductId === product.productId
                  ? 'border-gym-300 bg-gym-50'
                  : 'border-slate-200 bg-slate-50 hover:border-gym-200 hover:bg-gym-50/60'
                  }`}
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                  <p className="line-clamp-2 text-xs text-slate-600">{product.description}</p>
                  <ProductRating rating={product.averageRating} count={product.reviewCount} />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="text-sm font-bold text-gym-600">
                    {product.price?.toLocaleString('en-US')} <span className="text-xs font-medium text-slate-500">VND</span>
                  </p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleAddToCart(product)
                    }}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gym-700 bg-gym-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-gym-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300 focus-visible:ring-offset-2"
                  >
                    <ShoppingCart size={14} />
                    Add to Cart
                  </button>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Product detail + reviews */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Product detail</h2>
              <p className="mt-1 text-xs text-slate-500">
                Select a product on the left to view details and customer reviews.
              </p>
            </div>
          </header>

          {!selectedProductId && (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
              <p className="text-sm font-medium text-slate-700">No product selected</p>
              <p className="mt-1 text-xs text-slate-500">Choose a product from the list to see more information.</p>
            </div>
          )}

          {selectedProductId && productDetailQuery.isLoading && (
            <p className="text-sm text-slate-500">Loading product detail...</p>
          )}

          {selectedProductId && productDetail && (
            <div className="space-y-4">
              <article className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-slate-900">{productDetail.product.name}</h3>
                  <ProductRating
                    rating={productDetail.product.averageRating}
                    count={productDetail.product.reviewCount}
                  />
                  <p className="text-sm text-slate-700">{productDetail.product.description}</p>
                </div>
                <div className="flex flex-col items-end justify-between gap-3">
                  <p className="text-lg font-bold text-gym-600">
                    {productDetail.product.price?.toLocaleString('en-US')}{' '}
                    <span className="text-xs font-medium text-slate-500">VND</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleAddToCart(productDetail.product)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gym-700 bg-gym-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-gym-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300 focus-visible:ring-offset-2"
                  >
                    <ShoppingCart size={16} />
                    Add to Cart
                  </button>
                </div>
              </article>

              <article className="space-y-3 rounded-xl border border-slate-100 bg-white p-4">
                <h4 className="text-sm font-semibold text-slate-900">Write a review</h4>
                <form onSubmit={handleSubmitReview} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-slate-600">Rating</label>
                    <select
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 shadow-sm"
                      value={reviewRating}
                      disabled={!canReviewSelectedProduct}
                      onChange={(event) => setReviewRating(Number(event.target.value))}
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value} star{value > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="min-h-[80px] w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
                    placeholder={canReviewSelectedProduct
                      ? 'Share your experience with this product.'
                      : 'Review is available only after payment is successful for this product.'}
                    disabled={!canReviewSelectedProduct}
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <p className={`text-xs ${canReviewSelectedProduct ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {canReviewSelectedProduct
                        ? 'Payment verified. You can submit feedback for this product.'
                        : 'Feedback is locked until this product is in a PAID order.'}
                    </p>
                    <button
                      type="submit"
                      disabled={createReviewMutation.isPending || reviewText.trim().length === 0 || !canReviewSelectedProduct}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      <Star size={14} />
                      {createReviewMutation.isPending ? 'Submitting...' : 'Submit review'}
                    </button>
                  </div>
                </form>
              </article>

              <article className="space-y-3 rounded-xl border border-slate-100 bg-white p-4">
                <h4 className="text-sm font-semibold text-slate-900">Customer reviews</h4>
                {productDetail.reviews.length === 0 && (
                  <p className="text-xs text-slate-500">There are no reviews for this product yet.</p>
                )}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {productDetail.reviews.map((review) => (
                    <div
                      key={review.productReviewId}
                      className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800">{review.customerName}</p>
                        <ProductRating rating={review.rating} size="sm" />
                      </div>
                      {review.comment && <p className="text-xs text-slate-700">{review.comment}</p>}
                      <p className="text-[10px] text-slate-400">
                        {review.reviewDate ? new Date(review.reviewDate).toLocaleString() : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          )}
        </section>

        {/* Cart + checkout */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-gym-600 p-1.5 text-white">
                <ShoppingCart size={14} />
              </span>
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Cart</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Review items, pay online via PayOS, then pick up in person at the gym front desk.
                </p>
              </div>
            </div>
          </header>

          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
            {cart.items?.length === 0 && (
              <p className="text-xs text-slate-500">Your cart is empty. Start by adding a product.</p>
            )}
            {cart.items?.map((item) => (
              <div
                key={item.productId}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-600">
                    {item.price?.toLocaleString('en-US')} VND / unit
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs">
                    <button
                      type="button"
                      className="px-1 text-slate-500 hover:text-slate-900"
                      onClick={() => handleUpdateCartQty(item.productId, item.quantity - 1)}
                    >
                      -
                    </button>
                    <span className="min-w-[1.5rem] text-center font-semibold text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="px-1 text-slate-500 hover:text-slate-900"
                      onClick={() => handleUpdateCartQty(item.productId, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-900">
                      {item.lineTotal?.toLocaleString('en-US')} VND
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveCartItem(item.productId)}
                      className="text-[11px] font-medium text-red-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold text-slate-900">
                {cart.subtotal?.toLocaleString('en-US')} {cart.currency || 'VND'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Discount</span>
              <span className="font-medium text-gym-600">Calculated at PayOS</span>
            </div>
          </div>

          <button
            type="button"
            disabled={checkoutMutation.isPending || !cart.items || cart.items.length === 0}
            onClick={handleCheckout}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-gym-700 bg-gym-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-gym-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-400 disabled:text-slate-100"
          >
            <CreditCard size={16} />
            {checkoutMutation.isPending ? 'Redirecting to PayOS...' : 'Checkout with PayOS'}
          </button>

          {/* Purchase history */}
          <article className="space-y-2 rounded-xl border border-slate-100 bg-white p-3">
            <header className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 p-1.5 text-white">
                <History size={14} />
              </span>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Purchase history
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Recently paid and pending orders.
                </p>
              </div>
            </header>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 pt-1">
              {orders.length === 0 && (
                <p className="text-xs text-slate-500">You do not have any orders yet.</p>
              )}
              {orders.map((order) => (
                <div
                  key={order.orderId}
                  className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">
                      Order #{order.orderId} •{' '}
                      <span
                        className={
                          order.status === 'PAID'
                            ? 'text-emerald-600'
                            : order.status === 'PENDING'
                              ? 'text-amber-600'
                              : 'text-slate-500'
                        }
                      >
                        {order.status}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {order.orderDate ? new Date(order.orderDate).toLocaleString() : ''}
                    </p>
                  </div>
                  <ul className="space-y-0.5 text-[11px] text-slate-700">
                    {order.items?.map((item) => (
                      <li key={item.productId}>
                        {item.quantity} × {item.name}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs font-semibold text-slate-900">
                    Total:{' '}
                    {order.totalAmount?.toLocaleString('en-US')} {order.currency || 'VND'}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Fulfillment: {order.fulfillmentMethod === 'PICKUP_AT_STORE' ? 'Pickup at gym front desk' : 'Pickup at gym front desk'}
                  </p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
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
          if (index < fullStars) {
            return <Star key={index} size={iconSize} className="fill-gym-500 text-gym-500" />
          }
          if (index === fullStars && hasHalf) {
            return <StarHalf key={index} size={iconSize} className="fill-gym-500 text-gym-500" />
          }
          return <StarOff key={index} size={iconSize} className="text-slate-300" />
        })}
      </div>
      <span className="text-[11px] font-medium text-slate-600">
        {value.toFixed(1)} {typeof count === 'number' ? `(${count})` : ''}
      </span>
    </div>
  )
}

export default CustomerShopPage
