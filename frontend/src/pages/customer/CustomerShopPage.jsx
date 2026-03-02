import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, CreditCard, Star, StarHalf, StarOff, Zap, X } from 'lucide-react'
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
  const [isCartDrawerOpen, setCartDrawerOpen] = useState(() => new URLSearchParams(window.location.search).get('openCart') === '1')
  const [productQuantities, setProductQuantities] = useState({})
  const [checkoutOptions, setCheckoutOptions] = useState({
    promoCode: '',
  })
  const [couponPreview, setCouponPreview] = useState(null)
  const [couponPreviewError, setCouponPreviewError] = useState('')
  const [showSuccessMessage, setShowSuccessMessage] = useState(() => {
    const status = new URLSearchParams(window.location.search).get('status')
    const normalizedStatus = status ? status.trim().toUpperCase() : ''
    return normalizedStatus === 'PAID' || normalizedStatus === 'SUCCESS'
  })

  useEffect(() => {
    const openCart = () => setCartDrawerOpen(true)
    const closeCart = () => setCartDrawerOpen(false)
    const toggleCart = () => setCartDrawerOpen((prev) => !prev)

    window.addEventListener('gymcore:open-cart', openCart)
    window.addEventListener('gymcore:close-cart', closeCart)
    window.addEventListener('gymcore:toggle-cart', toggleCart)

    return () => {
      window.removeEventListener('gymcore:open-cart', openCart)
      window.removeEventListener('gymcore:close-cart', closeCart)
      window.removeEventListener('gymcore:toggle-cart', toggleCart)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('openCart') !== '1') return

    params.delete('openCart')
    const nextSearch = params.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`
    window.history.replaceState({}, document.title, nextUrl)
  }, [])

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
  const productCoupons = availableCoupons.filter((claim) => String(claim.ApplyTarget || '').toUpperCase() === 'ORDER')
  const membershipOnlyCoupons = availableCoupons.filter((claim) => String(claim.ApplyTarget || '').toUpperCase() === 'MEMBERSHIP')

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
  const cartItems = useMemo(() => cart.items ?? [], [cart.items])
  const cartItemCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cartItems],
  )
  const productDetail = productDetailQuery.data?.data ?? null
  const paidProductIds = new Set(
    orders
      .filter((order) => String(order.status || '').toUpperCase() === 'PAID')
      .flatMap((order) => (order.items || []).map((item) => item.productId)),
  )
  const canReviewSelectedProduct = selectedProductId != null && paidProductIds.has(selectedProductId)
  const selectedProductQuantity = selectedProductId ? getDesiredQuantity(selectedProductId) : 1

  function getDesiredQuantity(productId) {
    const parsed = Number(productQuantities[productId] || 1)
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1
  }

  const changeDesiredQuantity = (productId, delta) => {
    setProductQuantities((prev) => {
      const parsed = Number(prev[productId] || 1)
      const current = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 1
      const next = Math.max(1, current + delta)
      return { ...prev, [productId]: next }
    })
  }

  const triggerAddToCartAnimation = (sourceElement) => {
    if (!sourceElement) return
    const targetElement = document.getElementById('customer-cart-button')
    if (!targetElement) return

    const sourceRect = sourceElement.getBoundingClientRect()
    const targetRect = targetElement.getBoundingClientRect()
    const startX = sourceRect.left + sourceRect.width / 2
    const startY = sourceRect.top + sourceRect.height / 2
    const endX = targetRect.left + targetRect.width / 2
    const endY = targetRect.top + targetRect.height / 2
    const dx = endX - startX
    const dy = endY - startY

    const ghost = document.createElement('div')
    ghost.className = 'pointer-events-none fixed z-[120] h-4 w-4 rounded-full border border-gym-600 bg-gym-500/80 shadow-lg'
    ghost.style.left = `${startX}px`
    ghost.style.top = `${startY}px`
    ghost.style.transform = 'translate(-50%, -50%)'
    document.body.appendChild(ghost)

    const animation = ghost.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.95 },
        { transform: `translate(calc(-50% + ${dx * 0.55}px), calc(-50% + ${dy * 0.45}px)) scale(0.82)`, opacity: 0.9, offset: 0.65 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.25)`, opacity: 0.15 },
      ],
      { duration: 650, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)', fill: 'forwards' },
    )
    animation.onfinish = () => {
      ghost.remove()
      window.dispatchEvent(new Event('gymcore:cart-pulse'))
    }
  }

  const handleAddToCart = async (product, options = {}) => {
    const {
      quantity = 1,
      sourceElement = null,
      openCart = false,
      openCheckout = false,
    } = options

    try {
      await addToCartMutation.mutateAsync({ productId: product.productId, quantity: Math.max(1, Number(quantity || 1)) })
      triggerAddToCartAnimation(sourceElement)
      if (openCart || openCheckout) {
        setCartDrawerOpen(true)
      }
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to add item to cart.'
      alert(message)
    }
  }

  const handleUpdateCartQty = (productId, quantity) => {
    const nextQuantity = Number(quantity || 0)
    if (nextQuantity <= 0) {
      handleRemoveCartItem(productId)
      return
    }
    updateCartMutation.mutate({ productId, quantity: nextQuantity })
  }

  const handleRemoveCartItem = (productId) => {
    removeCartItemMutation.mutate(productId)
  }

  const handleCheckout = () => {
    if (!cart.items || cart.items.length === 0) return
    checkoutMutation.mutate({
      paymentMethod: 'PAYOS',
      promoCode: checkoutOptions.promoCode,
    })
  }

  const handlePromoCodeChange = (promoCode) => {
    setCheckoutOptions((prev) => ({ ...prev, promoCode }))
    setCouponPreview(null)
    setCouponPreviewError('')

    if (!promoCode) return

    previewCouponMutation.mutate({
      promoCode,
      target: 'ORDER',
      subtotal: Number(cart.subtotal || 0),
    })
  }

  const formatClaimBenefit = (claim) => {
    const discountPercent = Number(claim.DiscountPercent || 0)
    const discountAmount = Number(claim.DiscountAmount || 0)
    const bonusMonths = Number(claim.BonusDurationMonths || 0)
    const parts = []
    if (discountPercent > 0) {
      parts.push(`${discountPercent}% off`)
    } else if (discountAmount > 0) {
      parts.push(`${discountAmount.toLocaleString()} VND off`)
    }
    if (bonusMonths > 0) {
      parts.push(`+${bonusMonths} membership month${bonusMonths > 1 ? 's' : ''}`)
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Product list */}
        <section className="space-y-3 gc-card-compact">
          <header className="flex items-center justify-between gap-2">
            <h2 className="gc-section-kicker">Products</h2>
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
                  <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs">
                    <button
                      type="button"
                      className="rounded-full px-1 text-slate-500 hover:text-slate-900"
                      onClick={(event) => {
                        event.stopPropagation()
                        changeDesiredQuantity(product.productId, -1)
                      }}
                    >
                      -
                    </button>
                    <span className="min-w-[1.25rem] text-center font-semibold text-slate-800">
                      {getDesiredQuantity(product.productId)}
                    </span>
                    <button
                      type="button"
                      className="rounded-full px-1 text-slate-500 hover:text-slate-900"
                      onClick={(event) => {
                        event.stopPropagation()
                        changeDesiredQuantity(product.productId, 1)
                      }}
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleAddToCart(product, {
                          quantity: getDesiredQuantity(product.productId),
                          sourceElement: event.currentTarget,
                        })
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gym-700 bg-gym-600 px-3 py-2 text-[11px] font-bold text-white shadow-md transition-colors hover:bg-gym-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300 focus-visible:ring-offset-2"
                    >
                      <ShoppingCart size={13} />
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleAddToCart(product, {
                          quantity: getDesiredQuantity(product.productId),
                          sourceElement: event.currentTarget,
                          openCart: true,
                          openCheckout: true,
                        })
                      }}
                      className="inline-flex min-h-9 items-center gap-1 rounded-full border border-amber-400 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-100"
                    >
                      <Zap size={13} />
                      Buy now
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Product detail + reviews */}
        <section className="space-y-4 gc-card-compact">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="gc-section-kicker">Product detail</h2>
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
                  <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-sm">
                    <button
                      type="button"
                      className="rounded-full px-2 text-slate-500 hover:text-slate-900"
                      onClick={() => changeDesiredQuantity(productDetail.product.productId, -1)}
                    >
                      -
                    </button>
                    <span className="min-w-[2rem] text-center font-semibold text-slate-800">
                      {selectedProductQuantity}
                    </span>
                    <button
                      type="button"
                      className="rounded-full px-2 text-slate-500 hover:text-slate-900"
                      onClick={() => changeDesiredQuantity(productDetail.product.productId, 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={(event) =>
                        handleAddToCart(productDetail.product, {
                          quantity: selectedProductQuantity,
                          sourceElement: event.currentTarget,
                        })
                      }
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-gym-700 bg-gym-600 px-5 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-gym-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300 focus-visible:ring-offset-2"
                    >
                      <ShoppingCart size={16} />
                      Add to cart
                    </button>
                    <button
                      type="button"
                      onClick={(event) =>
                        handleAddToCart(productDetail.product, {
                          quantity: selectedProductQuantity,
                          sourceElement: event.currentTarget,
                          openCart: true,
                          openCheckout: true,
                        })
                      }
                      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-amber-400 bg-amber-50 px-5 py-2 text-sm font-bold text-amber-700 transition-colors hover:bg-amber-100"
                    >
                      <Zap size={16} />
                      Buy now
                    </button>
                  </div>
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

      <CartDrawer
        open={isCartDrawerOpen}
        itemCount={cartItemCount}
        cart={cart}
        cartItems={cartItems}
        checkoutOptions={checkoutOptions}
        checkoutMutation={checkoutMutation}
        couponPreview={couponPreview}
        couponPreviewError={couponPreviewError}
        formatClaimBenefit={formatClaimBenefit}
        membershipOnlyCoupons={membershipOnlyCoupons}
        onClose={() => setCartDrawerOpen(false)}
        onCheckout={handleCheckout}
        onPromoCodeChange={handlePromoCodeChange}
        onUpdateQuantity={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        previewCouponPending={previewCouponMutation.isPending}
        productCoupons={productCoupons}
      />
      </div>
    </WorkspaceScaffold>
  )
}

function CartDrawer({
  open,
  itemCount,
  cart,
  cartItems,
  checkoutOptions,
  checkoutMutation,
  couponPreview,
  couponPreviewError,
  formatClaimBenefit,
  membershipOnlyCoupons,
  onClose,
  onCheckout,
  onPromoCodeChange,
  onUpdateQuantity,
  onRemoveItem,
  previewCouponPending,
  productCoupons,
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-[70] bg-slate-900/35 transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-[80] h-screen w-full max-w-md transform border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-gym-600 p-1.5 text-white">
                  <ShoppingCart size={14} />
                </span>
                <h2 className="text-base font-bold text-slate-900">Your Cart</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">{itemCount} item(s) selected</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            >
              <X size={18} />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-3">
              {cartItems.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  Your cart is empty. Add products to continue.
                </p>
              )}
              {cartItems.map((item) => (
                <article
                  key={item.productId}
                  className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-600">{Number(item.price || 0).toLocaleString('en-US')} VND / unit</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.productId)}
                      className="text-[11px] font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs">
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.productId, Number(item.quantity || 0) - 1)}
                        className="rounded-full px-1 text-slate-500 hover:text-slate-900"
                      >
                        -
                      </button>
                      <span className="min-w-[1.5rem] text-center font-semibold text-slate-800">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(item.productId, Number(item.quantity || 0) + 1)}
                        className="rounded-full px-1 text-slate-500 hover:text-slate-900"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {Number(item.lineTotal || 0).toLocaleString('en-US')} VND
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <section className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {Number(cart.subtotal || 0).toLocaleString('en-US')} {cart.currency || 'VND'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Discount</span>
                <span className="font-medium text-gym-600">Calculated at PayOS</span>
              </div>
              <div className="pt-1">
                <label htmlFor="cart-promo-code" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Apply coupon</label>
                <select
                  id="cart-promo-code"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-gym-500 focus:outline-none"
                  value={checkoutOptions.promoCode}
                  onChange={(event) => onPromoCodeChange(event.target.value)}
                >
                  <option value="">No coupon applied</option>
                  {productCoupons.map((claim) => (
                    <option key={claim.ClaimID} value={claim.PromoCode}>
                      {claim.PromoCode} - {formatClaimBenefit(claim)}
                    </option>
                  ))}
                </select>
                {productCoupons.length === 0 && (
                  <p className="mt-1 text-[10px] text-slate-400">No available coupons in your wallet. Claim some in the Promotions page.</p>
                )}
                {membershipOnlyCoupons.length > 0 && (
                  <p className="mt-1 text-[10px] text-amber-600">
                    {membershipOnlyCoupons.length} coupon(s) are membership-only and cannot be used for product checkout.
                  </p>
                )}
                {previewCouponPending && <p className="mt-2 text-[11px] text-slate-500">Checking coupon...</p>}
                {couponPreview && checkoutOptions.promoCode && (
                  <p className="mt-2 rounded-lg border border-gym-100 bg-gym-50 px-2 py-1 text-[11px] text-gym-800">
                    Preview: discount {Number(couponPreview.estimatedDiscount || 0).toLocaleString()} VND, total {Number(couponPreview.estimatedFinalAmount || cart.subtotal || 0).toLocaleString()} VND.
                  </p>
                )}
                {couponPreviewError && (
                  <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-[11px] text-red-700">
                    {couponPreviewError}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={checkoutMutation.isPending || cartItems.length === 0}
                onClick={onCheckout}
                className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-gym-700 bg-gym-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-gym-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-400 disabled:text-slate-100"
              >
                <CreditCard size={16} />
                {checkoutMutation.isPending ? 'Redirecting to PayOS...' : 'Checkout with PayOS'}
              </button>
            </section>
          </div>
        </div>
      </aside>
    </>
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
