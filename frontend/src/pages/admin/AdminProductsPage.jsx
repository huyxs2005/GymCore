import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, PlusCircle, Search, Star, StarOff } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { adminProductApi } from '../../features/product/api/adminProductApi'

function AdminProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState(null)

  const productsQuery = useQuery({
    queryKey: ['admin-products'],
    queryFn: adminProductApi.getProducts,
  })

  const reviewsQuery = useQuery({
    queryKey: ['admin-product-reviews'],
    queryFn: adminProductApi.getReviews,
  })

  const upsertMutation = useMutation({
    mutationFn: (payload) =>
      payload.productId
        ? adminProductApi.updateProduct(payload.productId, payload.body)
        : adminProductApi.createProduct(payload.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
      setEditingProduct(null)
    },
  })

  const products = productsQuery.data?.data?.products ?? []
  const reviews = reviewsQuery.data?.data?.reviews ?? []

  const filteredProducts = products.filter((product) =>
    product.name?.toLowerCase().includes(search.toLowerCase()),
  )

  const handleEdit = (product) => {
    setEditingProduct({
      productId: product.productId,
      name: product.name ?? '',
      description: product.description ?? '',
      price: Number(product.price) || 0,
      imageUrl: product.imageUrl ?? '',
      active: product.active ?? true,
    })
  }

  const handleCreate = () => {
    setEditingProduct({
      productId: null,
      name: '',
      description: '',
      price: 0,
      imageUrl: '',
      active: true,
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!editingProduct) return
    const { productId, ...body } = editingProduct
    upsertMutation.mutate({ productId, body })
  }

  return (
    <WorkspaceScaffold
      title="Admin Product Management"
      subtitle="Maintain the product catalog and monitor customer reviews."
      links={adminNav}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2.2fr)]">
        {/* Products table + editor */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Products</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Add new products or update existing ones.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products..."
                  className="w-32 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none sm:w-48"
                />
              </div>
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex items-center gap-2 rounded-full bg-gym-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-gym-700"
              >
                <PlusCircle size={14} />
                New product
              </button>
            </div>
          </header>

          <div className="max-h-72 overflow-x-auto rounded-xl border border-slate-100">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Price (VND)</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {productsQuery.isLoading && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-center text-slate-500">
                      Loading products...
                    </td>
                  </tr>
                )}
                {!productsQuery.isLoading && filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-center text-slate-500">
                      No products found.
                    </td>
                  </tr>
                )}
                {filteredProducts.map((product) => (
                  <tr key={product.productId}>
                    <td className="px-3 py-2">
                      <div className="max-w-[220px]">
                        <p className="truncate text-xs font-semibold text-slate-900">{product.name}</p>
                        {product.description && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-500">{product.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-800">
                      {Number(product.price || 0).toLocaleString('en-US')}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          product.active
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                        }`}
                      >
                        {product.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleEdit(product)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-gym-300 hover:text-gym-700"
                      >
                        <Edit3 size={12} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingProduct && (
            <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingProduct.productId ? 'Edit product' : 'Create product'}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Name</label>
                  <input
                    type="text"
                    required
                    value={editingProduct.name}
                    onChange={(event) =>
                      setEditingProduct((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Price (VND)</label>
                  <input
                    type="number"
                    min={0}
                    step="1000"
                    required
                    value={editingProduct.price}
                    onChange={(event) =>
                      setEditingProduct((prev) => ({
                        ...prev,
                        price: Number(event.target.value || 0),
                      }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Description</label>
                <textarea
                  value={editingProduct.description}
                  onChange={(event) =>
                    setEditingProduct((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className="min-h-[70px] w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
                  placeholder="Short description for this product..."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Image URL (optional)</label>
                  <input
                    type="text"
                    value={editingProduct.imageUrl}
                    onChange={(event) =>
                      setEditingProduct((prev) => ({ ...prev, imageUrl: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-gym-400 focus:outline-none focus:ring-1 focus:ring-gym-400"
                    placeholder="https://..."
                  />
                </div>
                <div className="flex items-end justify-between">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={editingProduct.active}
                      onChange={(event) =>
                        setEditingProduct((prev) => ({ ...prev, active: event.target.checked }))
                      }
                      className="h-3 w-3 rounded border-slate-300 text-gym-600 focus:ring-gym-500"
                    />
                    Active (visible to customers)
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={upsertMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  {upsertMutation.isPending
                    ? 'Saving...'
                    : editingProduct.productId
                      ? 'Save changes'
                      : 'Create product'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Review monitoring */}
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Product reviews
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Monitor customer feedback and rating quality.
              </p>
            </div>
            <span className="text-[11px] text-slate-500">
              {reviews.length} review{reviews.length === 1 ? '' : 's'}
            </span>
          </header>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {reviewsQuery.isLoading && (
              <p className="text-xs text-slate-500">Loading reviews...</p>
            )}
            {!reviewsQuery.isLoading && reviews.length === 0 && (
              <p className="text-xs text-slate-500">
                There are no product reviews yet.
              </p>
            )}
            {reviews.map((review) => (
              <article
                key={review.productReviewId}
                className="space-y-1 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-900">
                      {review.productName}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      by <span className="font-medium">{review.customerName}</span>
                    </p>
                  </div>
                  <AdminRatingBadge rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="text-[11px] text-slate-700">{review.comment}</p>
                )}
                <p className="text-[10px] text-slate-400">
                  {review.reviewDate ? new Date(review.reviewDate).toLocaleString() : ''}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

function AdminRatingBadge({ rating }) {
  const value = Number(rating) || 0
  const fullStars = Math.max(1, Math.min(5, value))

  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, index) =>
          index < fullStars ? (
            <Star key={index} size={10} className="fill-amber-400 text-amber-400" />
          ) : (
            <StarOff key={index} size={10} className="text-amber-200" />
          ),
        )}
      </div>
      <span>{value.toFixed(1)}</span>
    </div>
  )
}

export default AdminProductsPage
