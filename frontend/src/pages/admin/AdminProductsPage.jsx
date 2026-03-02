import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Edit3, PlusCircle, Search, Star, StarOff, Package,
  ShoppingBag, Trash2, ArrowRight, Shield, AlertCircle,
  Image as ImageIcon, DollarSign, MessageSquare, TrendingUp
} from 'lucide-react'
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
      title="Asset Deployment"
      subtitle="Manage the tactical gear catalog and audit customer field intelligence."
      links={adminNav}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-20 animate-in fade-in duration-700">

        {/* Main: Catalog Management */}
        <section className="lg:col-span-8 space-y-12">
          {/* Tactical Header */}
          <header className="flex flex-wrap items-center justify-between gap-8 bg-gym-dark-900 p-8 rounded-[40px] border-4 border-gym-dark-800 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gym-500/10 -mr-32 -mt-32 rounded-full blur-3xl"></div>

            <div className="relative">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Gear Catalog</h2>
              <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-[0.2em] mt-1">Inventory & Supply Logic</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 relative">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gym-dark-500 group-hover:text-gym-500 transition-colors" size={18} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter assets..."
                  className="bg-white/5 border-2 border-white/10 rounded-2xl py-3 pl-12 pr-6 text-xs font-bold text-white focus:outline-none focus:border-gym-500 focus:bg-white/10 transition-all placeholder:text-gym-dark-600 sm:w-64"
                />
              </div>
              <button
                onClick={handleCreate}
                className="btn-primary px-8 py-3.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-gym-500/20 active:scale-95"
              >
                <PlusCircle size={16} strokeWidth={3} /> Commission Asset
              </button>
            </div>
          </header>

          {/* Product Grid / Table */}
          <div className="gc-card-compact border-2 border-gym-dark-50 bg-white shadow-xl shadow-gym-dark-900/5 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left">
                <thead className="bg-gym-dark-50 text-gym-dark-400 text-[10px] font-black uppercase tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-6">Asset Identity</th>
                    <th className="px-8 py-6 text-center">In-Field Price</th>
                    <th className="px-8 py-6">Operational Status</th>
                    <th className="px-8 py-6 text-right">Directives</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gym-dark-50">
                  {productsQuery.isLoading ? (
                    [...Array(3)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={4} className="px-8 py-10 bg-gym-dark-50/20"></td>
                      </tr>
                    ))
                  ) : filteredProducts.map((product) => (
                    <tr key={product.productId} className="hover:bg-gym-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-2xl bg-gym-dark-50 border-2 border-gym-dark-100 overflow-hidden flex items-center justify-center p-2 group-hover:bg-white group-hover:border-gym-500 transition-all shadow-sm">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain transition-transform group-hover:scale-110" />
                            ) : (
                              <Package size={24} className="text-gym-dark-200" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black text-gym-dark-900 uppercase tracking-tight truncate">{product.name}</p>
                            <p className="text-[10px] font-bold text-gym-dark-400 truncate max-w-[200px] italic">{product.description || 'No technical specifications provided.'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className="px-4 py-1.5 rounded-xl bg-gym-dark-900 text-gym-500 text-[10px] font-black uppercase italic border border-gym-dark-800 shadow-sm">
                          {Number(product.price || 0).toLocaleString()} VND
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${product.active ? 'bg-emerald-500 animate-pulse' : 'bg-gym-dark-200'}`}></div>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${product.active ? 'text-emerald-700' : 'text-gym-dark-400'}`}>
                            {product.active ? 'DEPLOYED' : 'INACTIVE'}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => handleEdit(product)}
                          className="px-6 py-2.5 bg-gym-dark-50 text-gym-dark-900 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gym-dark-900 hover:text-gym-500 transition-all active:scale-95 border-2 border-transparent"
                        >
                          ADJUST
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!productsQuery.isLoading && filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <Package className="mx-auto text-gym-dark-100 mb-4" size={64} />
                        <p className="text-xs font-black text-gym-dark-300 uppercase tracking-widest italic">Inventory Manifest Empty</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Edit / Create Form */}
          {editingProduct && (
            <section className="gc-card border-l-8 border-gym-dark-900 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <header className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gym-500 text-gym-dark-900 flex items-center justify-center shadow-lg">
                    <Shield size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gym-dark-900 uppercase tracking-tight italic">
                      {editingProduct.productId ? 'Asset Reconfiguration' : 'New Asset Protocol'}
                    </h3>
                    <p className="text-[10px] font-bold text-gym-dark-400 uppercase tracking-widest">CALIBRATING INVENTORY UNIT</p>
                  </div>
                </div>
                <button onClick={() => setEditingProduct(null)} className="text-2xl font-black text-gym-dark-200 hover:text-gym-dark-900 transition-colors">×</button>
              </header>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Designated Name</label>
                    <input
                      type="text"
                      required
                      value={editingProduct.name}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev, name: e.target.value }))}
                      className="gc-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Tactical Investment (VND)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gym-dark-300" size={16} />
                      <input
                        type="number"
                        required
                        value={editingProduct.price}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev, price: Number(e.target.value) }))}
                        className="gc-input pl-12"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Visual ID (Image URL)</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gym-dark-300" size={16} />
                    <input
                      type="text"
                      value={editingProduct.imageUrl}
                      onChange={(e) => setEditingProduct(prev => ({ ...prev, imageUrl: e.target.value }))}
                      className="gc-input pl-12"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gym-dark-500 uppercase tracking-widest px-1">Technical Specifications (Description)</label>
                  <textarea
                    value={editingProduct.description}
                    onChange={(e) => setEditingProduct(prev => ({ ...prev, description: e.target.value }))}
                    className="gc-input h-32 py-4 align-top"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-6">
                  <label className="flex items-center gap-4 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={editingProduct.active}
                        onChange={(e) => setEditingProduct(prev => ({ ...prev, active: e.target.checked }))}
                        className="sr-only"
                      />
                      <div className={`w-14 h-8 rounded-full transition-colors duration-300 ${editingProduct.active ? 'bg-gym-500' : 'bg-gym-dark-200'}`}></div>
                      <div className={`absolute left-1 top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 shadow-md ${editingProduct.active ? 'translate-x-6' : ''}`}></div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gym-dark-900 uppercase">Operational Readiness</p>
                      <p className="text-[9px] font-bold text-gym-dark-400 uppercase">Visible to athlete storefronts</p>
                    </div>
                  </label>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setEditingProduct(null)}
                      className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gym-dark-400 hover:text-gym-dark-900 transition-colors"
                    >
                      Abort
                    </button>
                    <button
                      type="submit"
                      disabled={upsertMutation.isPending}
                      className="btn-primary px-12 py-4 text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3"
                    >
                      {upsertMutation.isPending ? 'SYNCING...' : <><Shield size={18} /> Confirm Assets</>}
                    </button>
                  </div>
                </div>
              </form>
            </section>
          )}
        </section>

        {/* Sidebar: Field Intelligence (Reviews) */}
        <section className="lg:col-span-4 space-y-8">
          <article className="gc-card-compact border-2 border-gym-dark-50 bg-white shadow-xl shadow-gym-dark-900/5 h-full flex flex-col">
            <header className="px-6 py-6 border-b border-gym-dark-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquare size={24} className="text-gym-500" />
                <h3 className="text-lg font-black text-gym-dark-900 uppercase tracking-tight italic">Field Intel</h3>
              </div>
              <span className="bg-gym-dark-900 text-gym-500 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                {reviews.length} LOGS
              </span>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 max-h-[800px]">
              {reviewsQuery.isLoading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 rounded-3xl bg-gym-dark-50 animate-pulse"></div>
                ))
              ) : reviews.map((review) => (
                <article key={review.productReviewId} className="p-6 rounded-[32px] bg-gym-dark-50/50 border-2 border-gym-dark-100/50 hover:bg-white hover:border-gym-500/30 hover:shadow-xl transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gym-dark-900 text-gym-500 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                        {review.customerName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-gym-dark-900 uppercase truncate max-w-[120px]">{review.productName}</p>
                        <p className="text-[8px] font-black text-gym-500 uppercase tracking-tighter">via {review.customerName}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <AdminRatingBadge rating={review.rating} />
                    </div>
                  </div>

                  <p className="text-xs font-medium text-gym-dark-700 italic leading-relaxed mb-4 group-hover:text-gym-dark-900 transition-colors">
                    "{review.comment || 'Technical silence observed.'}"
                  </p>

                  <div className="flex items-center justify-between text-[8px] font-black text-gym-dark-300 uppercase tracking-widest">
                    <span className="flex items-center gap-1"><TrendingUp size={10} /> Verified Purchase</span>
                    <span>{review.reviewDate ? new Date(review.reviewDate).toLocaleDateString() : 'Pending Sync'}</span>
                  </div>
                </article>
              ))}
              {!reviewsQuery.isLoading && reviews.length === 0 && (
                <div className="py-20 text-center opacity-40">
                  <MessageSquare className="mx-auto mb-4" size={48} />
                  <p className="text-[10px] font-black uppercase tracking-widest italic">Encrypted Intel Nil</p>
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </WorkspaceScaffold>
  )
}

function AdminRatingBadge({ rating }) {
  const value = Number(rating) || 0
  const fullStars = Math.max(1, Math.min(5, value))

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gym-dark-900 text-gym-500 text-[10px] font-black italic border border-gym-dark-800 shadow-sm">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            size={10}
            fill={index < fullStars ? "currentColor" : "none"}
            className={index < fullStars ? "text-gym-500" : "text-gym-dark-800"}
          />
        ))}
      </div>
      <span>{value.toFixed(1)}</span>
    </div>
  )
}

export default AdminProductsPage
