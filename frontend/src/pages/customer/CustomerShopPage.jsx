import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, Star, StarHalf, StarOff } from 'lucide-react'
import { toast } from 'react-hot-toast'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { useSession } from '../../features/auth/useSession'
import { cartApi } from '../../features/product/api/cartApi'
import { orderApi } from '../../features/product/api/orderApi'
import { productApi } from '../../features/product/api/productApi'
import { triggerAddToCartAnimation } from '../../features/product/utils/cartAnimation'

function CustomerShopPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useSession()
  const userId = user?.userId ?? null
  const cartQueryKey = useMemo(() => ['cart', userId], [userId])

  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL')
  const [productSearch, setProductSearch] = useState('')
  const [productQuantities, setProductQuantities] = useState({})
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
    queryKey: cartQueryKey,
    queryFn: cartApi.getCart,
    enabled: Boolean(userId),
  })

  const addToCartMutation = useMutation({
    mutationFn: cartApi.addItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKey })
    },
  })

  const products = useMemo(() => productsQuery.data?.products ?? [], [productsQuery.data])
  const productCategories = useMemo(() => productsQuery.data?.categories ?? [], [productsQuery.data])
  const normalizedSearch = productSearch.trim().toLowerCase()
  const cart = cartQuery.data ?? { items: [] }
  const cartItemCount = useMemo(
    () => (cart.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cart.items],
  )

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const status = (urlParams.get('status') || '').trim().toUpperCase()
    if (status === 'PAID' || status === 'SUCCESS') {
      const paymentReturnPayload = Object.fromEntries(urlParams.entries())
      orderApi
        .confirmPaymentReturn(paymentReturnPayload)
        .catch(() => null)
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: cartQueryKey })
        })
      const timer = setTimeout(() => {
        setShowSuccessMessage(false)
        window.history.replaceState({}, document.title, window.location.pathname)
      }, 3000)
      return () => clearTimeout(timer)
    }
    if (status === 'CANCELLED') {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
    return undefined
  }, [cartQueryKey, queryClient])

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

  const handleAddToCart = async (product, options = {}) => {
    const { quantity = 1, sourceElement = null } = options
    try {
      await addToCartMutation.mutateAsync({ productId: product.productId, quantity: Math.max(1, Number(quantity || 1)) })
      triggerAddToCartAnimation(sourceElement)
    } catch (error) {
      const message = error?.response?.data?.message || error?.message || 'Unable to add item to cart.'
      toast.error(message)
    }
  }

  const handleBuyNow = async (product, options = {}) => {
    const { quantity = 1, sourceElement = null } = options
    await handleAddToCart(product, { quantity, sourceElement })
    navigate('/customer/cart')
  }

  const filteredProducts = products.filter((product) => {
    const categoryMatch =
      selectedCategoryId === 'ALL' ||
      (product.categories || []).some((category) => String(category.productCategoryId) === String(selectedCategoryId))
    if (!categoryMatch) return false
    if (!normalizedSearch) return true
    const haystack = [
      product.name,
      product.shortDescription,
      product.description,
      ...(product.categories || []).map((category) => category.name),
    ].join(' ').toLowerCase()
    return haystack.includes(normalizedSearch)
  })

  return (
    <WorkspaceScaffold
      title="GymCore Product Shop"
      subtitle="Browse supplements here, open a dedicated product page for full details, and manage checkout from the separate cart page."
      links={customerNav}
    >
      {showSuccessMessage ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in rounded-3xl bg-white p-8 text-center shadow-2xl duration-300">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Star size={32} className="fill-emerald-600" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-slate-900">Order Successful!</h2>
            <p className="text-slate-600">Your payment was confirmed. Check your email or order history for the order ID, then bring it to the gym front desk for pickup.</p>
          </div>
        </div>
      ) : null}

      <section className="gc-card-compact space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="gc-section-kicker">Catalog</h2>
            <p className="mt-1 text-sm text-slate-500">Search products here. Open a product page for the full gallery, usage instructions, and reviews.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/customer/orders" className="inline-flex items-center rounded-full border border-gym-200 bg-gym-50 px-4 py-2 text-sm font-semibold text-gym-700 transition hover:bg-gym-100">
              View buying history
            </Link>
            <Link to="/customer/cart" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              <ShoppingCart size={16} />
              View cart ({cartItemCount})
            </Link>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Search</span>
            <input
              type="text"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Protein, creatine, pre-workout..."
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            {cartItemCount} item(s) in cart
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('ALL')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedCategoryId === 'ALL' ? 'bg-gym-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            All
          </button>
          {productCategories.map((category) => (
            <button
              key={category.productCategoryId}
              type="button"
              onClick={() => setSelectedCategoryId(String(category.productCategoryId))}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${String(selectedCategoryId) === String(category.productCategoryId) ? 'bg-gym-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {productsQuery.isLoading ? <p className="text-sm text-slate-500">Loading products...</p> : null}
        {productsQuery.isError ? <p className="text-sm text-rose-600">Could not load products.</p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => {
            const desiredQuantity = getDesiredQuantity(product.productId)
            return (
              <article key={product.productId} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <Link to={`/customer/shop/${product.productId}`} className="block">
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    {product.thumbnailUrl || product.imageUrl ? (
                      <img
                        src={product.thumbnailUrl || product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]"
                      />
                    ) : null}
                  </div>
                </Link>
                <div className="space-y-4 p-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {(product.categories || []).map((category) => (
                        <span key={`${product.productId}-${category.productCategoryId}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                          {category.name}
                        </span>
                      ))}
                    </div>
                    <Link to={`/customer/shop/${product.productId}`} className="block text-lg font-bold text-slate-900 hover:text-gym-700">
                      {product.name}
                    </Link>
                    <p className="text-sm text-slate-600">
                      {product.shortDescription || product.description || 'Product details available on the product page.'}
                    </p>
                    <ProductRating rating={Number(product.averageRating || 0)} count={Number(product.reviewCount || 0)} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Price</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">{Number(product.price || 0).toLocaleString('en-US')} VND</p>
                    </div>
                    <Link to={`/customer/shop/${product.productId}`} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      View details
                    </Link>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs">
                      <button type="button" onClick={() => changeDesiredQuantity(product.productId, -1)} className="rounded-full px-1 text-slate-500 hover:text-slate-900">
                        -
                      </button>
                      <span className="min-w-[1.5rem] text-center font-semibold text-slate-800">{desiredQuantity}</span>
                      <button type="button" onClick={() => changeDesiredQuantity(product.productId, 1)} className="rounded-full px-1 text-slate-500 hover:text-slate-900">
                        +
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(event) => handleAddToCart(product, { quantity: desiredQuantity, sourceElement: event.currentTarget })}
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-gym-700 bg-gym-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gym-700"
                      >
                        Add to cart
                      </button>
                      <button
                        type="button"
                        onClick={(event) => handleBuyNow(product, { quantity: desiredQuantity, sourceElement: event.currentTarget })}
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                      >
                        Buy now
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {!productsQuery.isLoading && filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
            No products match the current filters.
          </div>
        ) : null}
      </section>
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

export default CustomerShopPage
