import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Edit3, ImagePlus, PackageCheck, PackageX, PlusCircle, Search, Star, Upload, X } from 'lucide-react'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { adminProductApi } from '../../features/product/api/adminProductApi'
import { toast } from 'react-hot-toast'
import PaginationControls from '../../components/common/PaginationControls'
import { usePagination } from '../../hooks/usePagination'

const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active only' },
  { value: 'archived', label: 'Archived only' },
]

const REVIEW_FILTERS = [
  { value: 'all', label: 'All review states' },
  { value: 'reviewed', label: 'Has reviews' },
  { value: 'unreviewed', label: 'No reviews' },
]

function buildInitialForm(categories = []) {
  const defaultCategoryId = categories[0]?.productCategoryId ?? ''
  return {
    productId: null,
    name: '',
    shortDescription: '',
    description: '',
    usageInstructions: '',
    price: 0,
    categoryIds: defaultCategoryId ? [defaultCategoryId] : [],
    active: true,
    images: [{ imageUrl: '', altText: '', displayOrder: 1, isPrimary: true }],
  }
}

function normalizeProductForForm(product, categories = []) {
  if (!product) return buildInitialForm(categories)
  return {
    productId: product.productId,
    name: product.name ?? '',
    shortDescription: product.shortDescription ?? '',
    description: product.description ?? '',
    usageInstructions: product.usageInstructions ?? '',
    price: Number(product.price || 0),
    categoryIds: (product.categories || []).map((category) => category.productCategoryId),
    active: product.active ?? true,
    images: (product.images || []).length > 0
      ? normalizeDisplayOrders(product.images.map((image, index) => ({
          imageUrl: image.imageUrl ?? '',
          altText: image.altText ?? '',
          displayOrder: Number(image.displayOrder || index + 1),
          isPrimary: Boolean(image.isPrimary),
        })))
      : [{ imageUrl: product.thumbnailUrl || '', altText: '', displayOrder: 1, isPrimary: true }],
  }
}

function resolveApiMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function validateProductDraft(draft) {
  if (!String(draft?.name || '').trim()) {
    return 'Product name is required.'
  }
  if (!Number.isFinite(Number(draft?.price)) || Number(draft.price) <= 0) {
    return 'Price must be greater than 0.'
  }
  if (!Array.isArray(draft?.categoryIds) || draft.categoryIds.length === 0) {
    return 'Select at least one product category.'
  }
  const uploadedImages = (draft?.images || []).filter((image) => String(image.imageUrl || '').trim())
  if (uploadedImages.length === 0) {
    return 'Upload at least one product image.'
  }
  if (!uploadedImages.some((image) => image.isPrimary)) {
    return 'Choose one primary product image.'
  }
  return ''
}

function AdminProductsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [reviewFilter, setReviewFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [editingProduct, setEditingProduct] = useState(null)
  const [uploadingImageIndex, setUploadingImageIndex] = useState(null)
  const [formError, setFormError] = useState('')

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
      setFormError('')
      setEditingProduct(null)
    },
    onError: (error) => {
      setFormError(resolveApiMessage(error, 'Product could not be saved.'))
    },
  })

  const uploadImageMutation = useMutation({
    mutationFn: adminProductApi.uploadImage,
    onSuccess: async (response, variables) => {
      const uploadedUrl = response?.imageUrl || ''
      const previousUrl = variables.previousUrl || ''
      setEditingProduct((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          images: normalizeDisplayOrders(prev.images.map((image, imageIndex) => (
            imageIndex === variables.index
              ? { ...image, imageUrl: uploadedUrl }
              : image
          ))),
        }
      })
      setUploadingImageIndex(null)
      if (isManagedUpload(previousUrl) && previousUrl !== uploadedUrl) {
        await adminProductApi.deleteUploadedImage(previousUrl).catch(() => {})
      }
    },
    onError: (error) => {
      setUploadingImageIndex(null)
      const status = error?.response?.status
      const message = error?.response?.data?.message
        || error?.response?.data?.error
        || (status === 413 ? 'Product image file is too large. Maximum size is 5 MB.' : '')
        || error?.message
        || 'Product image upload failed.'
      toast.error(message)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: adminProductApi.archiveProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: adminProductApi.restoreProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] })
    },
  })

  const products = useMemo(() => productsQuery.data?.products ?? [], [productsQuery.data])
  const categories = productsQuery.data?.categories ?? []
  const reviews = reviewsQuery.data?.reviews ?? []

  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return products.filter((product) => {
      if (statusFilter === 'active' && !product.active) return false
      if (statusFilter === 'archived' && product.active) return false
      if (reviewFilter === 'reviewed' && Number(product.reviewCount || 0) <= 0) return false
      if (reviewFilter === 'unreviewed' && Number(product.reviewCount || 0) > 0) return false
      if (categoryFilter !== 'ALL' && !(product.categories || []).some((category) => String(category.productCategoryId) === String(categoryFilter))) {
        return false
      }
      if (!keyword) return true
      const categoryText = (product.categories || []).map((category) => category.name).join(' ')
      return [product.name, product.shortDescription, categoryText].some((value) =>
        String(value || '').toLowerCase().includes(keyword),
      )
    })
  }, [categoryFilter, products, reviewFilter, search, statusFilter])
  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
  } = usePagination(filteredProducts, 10)

  const handleCreate = () => {
    setFormError('')
    setEditingProduct(buildInitialForm(categories))
  }
  const handleEdit = (product) => {
    setFormError('')
    setEditingProduct(normalizeProductForForm(product, categories))
  }

  const updateImage = (index, key, value) => {
    setEditingProduct((prev) => ({
      ...prev,
      images: prev.images.map((image, imageIndex) =>
        imageIndex === index ? { ...image, [key]: value } : image,
      ),
    }))
  }

  const setPrimaryImage = (index) => {
    setEditingProduct((prev) => ({
      ...prev,
      images: prev.images.map((image, imageIndex) => ({ ...image, isPrimary: imageIndex === index })),
    }))
  }

  const moveImage = (index, direction) => {
    setEditingProduct((prev) => {
      const nextIndex = index + direction
      if (!prev || nextIndex < 0 || nextIndex >= prev.images.length) return prev
      const nextImages = [...prev.images]
      ;[nextImages[index], nextImages[nextIndex]] = [nextImages[nextIndex], nextImages[index]]
      return { ...prev, images: normalizeDisplayOrders(nextImages) }
    })
  }

  const addImageField = () => {
    setEditingProduct((prev) => ({
      ...prev,
      images: normalizeDisplayOrders([
        ...prev.images,
        { imageUrl: '', altText: '', displayOrder: prev.images.length + 1, isPrimary: false },
      ]),
    }))
  }

  const removeImageField = async (index) => {
    if (!editingProduct) return
    const targetImage = editingProduct.images[index]
    if (isManagedUpload(targetImage?.imageUrl)) {
      await adminProductApi.deleteUploadedImage(targetImage.imageUrl).catch(() => {})
    }
    setEditingProduct((prev) => {
      const nextImages = prev.images.filter((_, imageIndex) => imageIndex !== index)
      if (nextImages.length === 0) {
        return { ...prev, images: [{ imageUrl: '', altText: '', displayOrder: 1, isPrimary: true }] }
      }
      if (!nextImages.some((image) => image.isPrimary)) {
        nextImages[0] = { ...nextImages[0], isPrimary: true }
      }
      return { ...prev, images: normalizeDisplayOrders(nextImages) }
    })
  }

  const handleImageUpload = (index, file) => {
    if (!file || !editingProduct) return
    if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
      toast.error('Product image file is too large. Maximum size is 5 MB.')
      return
    }
    setUploadingImageIndex(index)
    uploadImageMutation.mutate({
      index,
      file,
      previousUrl: editingProduct.images[index]?.imageUrl || '',
    })
  }

  const toggleCategory = (categoryId) => {
    setEditingProduct((prev) => {
      const exists = prev.categoryIds.includes(categoryId)
      return {
        ...prev,
        categoryIds: exists
          ? prev.categoryIds.filter((value) => value !== categoryId)
          : [...prev.categoryIds, categoryId],
      }
    })
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!editingProduct) return
    const validationError = validateProductDraft(editingProduct)
    if (validationError) {
      setFormError(validationError)
      return
    }
    const { productId, ...body } = editingProduct
    const cleanedBody = {
      ...body,
      images: normalizeDisplayOrders(body.images.filter((image) => image.imageUrl.trim().length > 0)),
    }
    upsertMutation.mutate({ productId, body: cleanedBody })
  }

  return (
    <WorkspaceScaffold
      title="Admin Product Management"
      subtitle="Manage the supplement catalog, uploaded gallery images, review signals, and customer-facing product presentation."
      links={adminNav}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2.4fr)_minmax(0,1.5fr)]">
        <section className="gc-card-compact space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="gc-section-kicker">Catalog</h2>
              <p className="mt-1 text-xs text-slate-500">Filter by category, status, and review activity before editing.</p>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-full bg-gym-600 px-4 py-2 text-xs font-semibold text-white hover:bg-gym-700"
            >
              <PlusCircle size={14} />
              New product
            </button>
          </header>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select
              value={reviewFilter}
              onChange={(event) => setReviewFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {REVIEW_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="ALL">All categories</option>
              {categories.map((category) => (
                <option key={category.productCategoryId} value={category.productCategoryId}>{category.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {productsQuery.isLoading ? <p className="text-sm text-slate-500">Loading products...</p> : null}
            {!productsQuery.isLoading && filteredProducts.length === 0 ? (
              <p className="text-sm text-slate-500">No products match the current filters.</p>
            ) : null}
            {paginatedItems.map((product) => (
              <article key={product.productId} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex gap-4">
                  <div className="h-24 w-24 overflow-hidden rounded-3xl bg-slate-200">
                    {product.thumbnailUrl ? (
                      <img src={product.thumbnailUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{product.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{product.shortDescription || product.description}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                        product.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {product.active ? 'Active' : 'Archived'}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {(product.categories || []).map((category) => (
                        <span key={category.productCategoryId} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                          {category.name}
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <ProductStat label="Price" value={`${Number(product.price || 0).toLocaleString('en-US')} VND`} />
                      <ProductStat label="Categories" value={`${(product.categories || []).length}`} />
                      <ProductStat label="Reviews" value={`${product.reviewCount ?? 0}`} />
                      <ProductStat label="Avg rating" value={Number(product.averageRating || 0).toFixed(1)} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(product)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 size={13} />
                        Edit
                      </button>
                      {product.active ? (
                        <button
                          type="button"
                          onClick={() => archiveMutation.mutate(product.productId)}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          <PackageX size={13} />
                          Archive
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => restoreMutation.mutate(product.productId)}
                          className="inline-flex items-center gap-2 rounded-full border border-gym-200 bg-gym-50 px-3 py-2 text-xs font-semibold text-gym-700 hover:bg-gym-100"
                        >
                          <PackageCheck size={13} />
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </section>

        <div className="space-y-6">
          <section className="gc-card-compact space-y-5">
            <header className="border-b border-slate-100 pb-4">
              <h2 className="gc-section-kicker">{editingProduct?.productId ? 'Edit product' : 'Create product'}</h2>
              <p className="mt-1 text-xs text-slate-500">Keep the form structured: basic info, pricing, categories, customer-facing copy, then gallery.</p>
            </header>

            {editingProduct ? (
              <form noValidate onSubmit={handleSubmit} className="space-y-5">
                <section className="space-y-4">
                  <SectionHeading title="Basic Info" />
                  <Field label="Product name">
                    <input
                      type="text"
                      value={editingProduct.name}
                      onChange={(event) => setEditingProduct((prev) => ({ ...prev, name: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-gym-500 focus:bg-white focus:outline-none"
                    />
                  </Field>

                  <Field label="Short description">
                    <input
                      type="text"
                      value={editingProduct.shortDescription}
                      onChange={(event) => setEditingProduct((prev) => ({ ...prev, shortDescription: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-gym-500 focus:bg-white focus:outline-none"
                    />
                  </Field>
                </section>

                <section className="space-y-4">
                  <SectionHeading title="Pricing & Visibility" />
                  <Field label="Price (VND)">
                    <input
                      type="number"
                      min={0}
                      value={editingProduct.price}
                      onChange={(event) => setEditingProduct((prev) => ({ ...prev, price: Number(event.target.value || 0) }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-gym-500 focus:bg-white focus:outline-none"
                    />
                  </Field>

                  <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={editingProduct.active}
                      onChange={(event) => setEditingProduct((prev) => ({ ...prev, active: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-gym-600 focus:ring-gym-500"
                    />
                    Visible to customers
                  </label>
                </section>

                <section className="space-y-4">
                  <SectionHeading title="Categories" />
                  <Field label="Assigned categories">
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => {
                        const active = editingProduct.categoryIds.includes(category.productCategoryId)
                        return (
                          <button
                            key={category.productCategoryId}
                            type="button"
                            onClick={() => toggleCategory(category.productCategoryId)}
                            className={`rounded-full px-3 py-2 text-xs font-semibold ${
                              active
                                ? 'bg-gym-600 text-white'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {category.name}
                          </button>
                        )
                      })}
                    </div>
                  </Field>
                </section>

                <section className="space-y-4">
                  <SectionHeading title="Customer-Facing Copy" />
                  <Field label="Description">
                    <textarea
                      value={editingProduct.description}
                      onChange={(event) => setEditingProduct((prev) => ({ ...prev, description: event.target.value }))}
                      className="min-h-[100px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-gym-500 focus:bg-white focus:outline-none"
                    />
                  </Field>

                  <Field label="Usage instructions">
                    <textarea
                      value={editingProduct.usageInstructions}
                      onChange={(event) => setEditingProduct((prev) => ({ ...prev, usageInstructions: event.target.value }))}
                      className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-gym-500 focus:bg-white focus:outline-none"
                    />
                  </Field>
                </section>

                <section className="space-y-4">
                  <SectionHeading title="Gallery" />
                  <Field label={`Gallery images (${editingProduct.images.length}/8)`}>
                    <div className="space-y-3">
                      {editingProduct.images.map((image, index) => (
                        <div key={`${index}-${image.displayOrder}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="grid gap-3 md:grid-cols-[96px_minmax(0,1fr)]">
                            <div className="h-24 w-24 overflow-hidden rounded-2xl bg-slate-200">
                              {image.imageUrl ? <img src={image.imageUrl} alt={image.altText || `Product image ${index + 1}`} className="h-full w-full object-cover" /> : null}
                            </div>
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                                  <Upload size={14} />
                                  {uploadingImageIndex === index ? 'Uploading...' : `Choose image ${index + 1}`}
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={(event) => handleImageUpload(index, event.target.files?.[0] || null)}
                                    className="sr-only"
                                    aria-label={`Choose image ${index + 1}`}
                                  />
                                </label>
                                {image.imageUrl ? <span className="text-[11px] text-slate-500">Uploaded</span> : <span className="text-[11px] text-slate-500">No image uploaded yet</span>}
                              </div>
                              <input
                                type="text"
                                value={image.altText}
                                onChange={(event) => updateImage(index, 'altText', event.target.value)}
                                placeholder="Alt text"
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-gym-500 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPrimaryImage(index)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  image.isPrimary ? 'bg-gym-600 text-white' : 'border border-slate-200 bg-white text-slate-600'
                                }`}
                              >
                                {image.isPrimary ? 'Primary image' : 'Set primary'}
                              </button>
                              <button
                                type="button"
                                onClick={() => moveImage(index, -1)}
                                disabled={index === 0}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ArrowUp size={12} />
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() => moveImage(index, 1)}
                                disabled={index === editingProduct.images.length - 1}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ArrowDown size={12} />
                                Down
                              </button>
                            </div>
                            {editingProduct.images.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeImageField(index)}
                                className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
                              >
                                <X size={12} />
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addImageField}
                        disabled={editingProduct.images.length >= 8}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ImagePlus size={14} />
                        Add image
                      </button>
                    </div>
                  </Field>
                </section>

                {formError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {formError}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null)
                      setFormError('')
                    }}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={upsertMutation.isPending || uploadImageMutation.isPending}
                    className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {upsertMutation.isPending ? 'Saving...' : editingProduct.productId ? 'Save changes' : 'Create product'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                Choose an existing product to edit or create a new one.
              </div>
            )}
          </section>

          <section className="gc-card-compact space-y-4">
            <header className="border-b border-slate-100 pb-4">
              <h2 className="gc-section-kicker">Recent Reviews</h2>
              <p className="mt-1 text-xs text-slate-500">Monitor low-rated or frequently reviewed products without leaving the catalog screen.</p>
            </header>
            <div className="space-y-3">
              {reviewsQuery.isLoading ? <p className="text-sm text-slate-500">Loading reviews...</p> : null}
              {!reviewsQuery.isLoading && reviews.length === 0 ? (
                <p className="text-sm text-slate-500">No customer reviews yet.</p>
              ) : null}
              {reviews.map((review) => (
                <article key={review.productReviewId} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{review.productName}</p>
                      <p className="text-[11px] text-slate-500">by {review.customerName}</p>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      {review.rating}
                    </div>
                  </div>
                  {review.comment ? <p className="mt-2 text-xs text-slate-700">{review.comment}</p> : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </WorkspaceScaffold>
  )
}

function SectionHeading({ title }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{title}</h3>
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function ProductStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function normalizeDisplayOrders(images) {
  return images.map((image, index) => ({
    ...image,
    displayOrder: index + 1,
  }))
}

function isManagedUpload(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/products/')
}

export default AdminProductsPage
