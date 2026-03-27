import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, PlusCircle, Search, ShieldCheck, Tags, Trash2, Undo2, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { adminNav } from '../../config/navigation'
import { adminFoodCategoryApi } from '../../features/content/api/adminFoodCategoryApi'

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active only' },
  { value: 'archived', label: 'Archived only' },
]

function resolveApiMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function buildInitialCategoryForm() {
  return {
    foodCategoryId: null,
    name: '',
    description: '',
    active: true,
  }
}

function normalizeCategoryForForm(category) {
  if (!category) return buildInitialCategoryForm()
  return {
    foodCategoryId: category.foodCategoryId ?? null,
    name: category.name ?? '',
    description: category.description ?? '',
    active: category.active ?? true,
  }
}

function validateCategoryDraft(draft) {
  if (!String(draft?.name || '').trim()) return 'Food category name is required.'
  return ''
}

function AdminFoodCategoriesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingCategory, setEditingCategory] = useState(null)
  const [formState, setFormState] = useState(() => buildInitialCategoryForm())
  const [formError, setFormError] = useState('')
  const [confirmState, setConfirmState] = useState({ open: false, item: null, action: null })

  const categoriesQuery = useQuery({
    queryKey: ['admin-food-categories'],
    queryFn: adminFoodCategoryApi.getFoodCategories,
  })

  const upsertMutation = useMutation({
    mutationFn: (payload) =>
      payload.foodCategoryId
        ? adminFoodCategoryApi.updateFoodCategory(payload.foodCategoryId, payload.body)
        : adminFoodCategoryApi.createFoodCategory(payload.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-food-categories'] })
      setEditingCategory(null)
      setFormState(buildInitialCategoryForm())
      setFormError('')
    },
    onError: (error) => setFormError(resolveApiMessage(error, 'Category could not be saved.')),
  })

  const archiveMutation = useMutation({
    mutationFn: adminFoodCategoryApi.archiveFoodCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-food-categories'] })
      setConfirmState({ open: false, item: null, action: null })
    },
    onError: (error) => toast.error(resolveApiMessage(error, 'Could not archive category.')),
  })

  const restoreMutation = useMutation({
    mutationFn: adminFoodCategoryApi.restoreFoodCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-food-categories'] })
      setConfirmState({ open: false, item: null, action: null })
    },
    onError: (error) => toast.error(resolveApiMessage(error, 'Could not restore category.')),
  })

  const categories = useMemo(() => categoriesQuery.data?.items ?? [], [categoriesQuery.data])
  const normalizedSearch = search.trim().toLowerCase()

  const filteredCategories = useMemo(() => {
    return categories.filter((category) => {
      const active = Boolean(category.active)
      if (statusFilter === 'active' && !active) return false
      if (statusFilter === 'archived' && active) return false
      if (!normalizedSearch) return true
      const haystack = [category.name, category.description].join(' ').toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [categories, normalizedSearch, statusFilter])

  const closeEditor = () => {
    setEditingCategory(null)
    setFormState(buildInitialCategoryForm())
    setFormError('')
  }

  const openCreate = () => {
    setEditingCategory({ foodCategoryId: null })
    setFormState(buildInitialCategoryForm())
    setFormError('')
  }

  const openEdit = (category) => {
    setEditingCategory(category)
    setFormState(normalizeCategoryForForm(category))
    setFormError('')
  }

  const submitForm = async (event) => {
    event.preventDefault()
    const error = validateCategoryDraft(formState)
    if (error) {
      setFormError(error)
      return
    }
    const body = {
      name: String(formState.name || '').trim(),
      description: String(formState.description || '').trim() || null,
      active: Boolean(formState.active),
    }
    try {
      await upsertMutation.mutateAsync({ foodCategoryId: formState.foodCategoryId, body })
    } catch {
      // handled in mutation callbacks
    }
  }

  return (
    <WorkspaceScaffold
      title="Food Category Management"
      subtitle="Create and maintain food category taxonomy used by the food content catalog."
      links={adminNav}
    >
      <section className="gc-card-compact space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="gc-section-kicker">Food Categories</h2>
            <p className="mt-1 text-sm text-slate-500">Manage food category names and status to keep the catalog structure clean and consistent.</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-full bg-gym-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gym-700"
          >
            <PlusCircle size={18} />
            New category
          </button>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search category name or description..."
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {categoriesQuery.isLoading ? <p className="text-sm text-slate-500">Loading categories...</p> : null}
        {categoriesQuery.isError ? <p className="text-sm text-rose-600">Could not load food categories.</p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCategories.map((category) => {
            const isActive = Boolean(category.active)
            return (
              <article key={category.foodCategoryId} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <Tags size={18} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-slate-900">{category.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{category.description || 'No description yet.'}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${
                      isActive ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
                    }`}
                  >
                    {isActive ? 'Active' : 'Archived'}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(category)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Edit3 size={16} />
                    Edit
                  </button>
                  {isActive ? (
                    <button
                      type="button"
                      onClick={() => setConfirmState({ open: true, item: category, action: 'archive' })}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      <Trash2 size={16} />
                      Archive
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmState({ open: true, item: category, action: 'restore' })}
                      className="inline-flex items-center gap-2 rounded-full border border-gym-200 bg-gym-50 px-4 py-2 text-sm font-semibold text-gym-700 transition hover:bg-gym-100"
                    >
                      <Undo2 size={16} />
                      Restore
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        {editingCategory ? (
          typeof document !== 'undefined'
            ? createPortal(
                <div
                  className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/55 px-4 py-8 backdrop-blur-sm"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) closeEditor()
                  }}
                >
                  <div className="mx-auto flex min-h-full max-w-xl items-start justify-center">
                    <form
                      onSubmit={submitForm}
                      className="w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
                    >
                      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Admin category editor</p>
                          <h2 className="mt-2 text-xl font-bold text-slate-900">
                            {formState.foodCategoryId ? 'Edit food category' : 'Create food category'}
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={closeEditor}
                          className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                          aria-label="Close category editor"
                        >
                          <X size={18} />
                        </button>
                      </header>

                      <div className="space-y-4 p-6">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Name *</span>
                          <input
                            value={formState.name}
                            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-gym-300 focus:ring-2 focus:ring-gym-100"
                            placeholder="High Protein"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Description</span>
                          <textarea
                            value={formState.description}
                            onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                            rows={4}
                            className="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-gym-300 focus:ring-2 focus:ring-gym-100"
                            placeholder="Optional detail for internal admin context..."
                          />
                        </label>

                        <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <ShieldCheck size={16} className="text-gym-600" /> Active
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(formState.active)}
                            onChange={(event) => setFormState((prev) => ({ ...prev, active: event.target.checked }))}
                            className="h-4 w-4 accent-gym-600"
                          />
                        </label>

                        {formError ? <p className="text-sm font-semibold text-rose-700">{formError}</p> : null}
                      </div>

                      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 px-6 py-5">
                        <button
                          type="button"
                          onClick={closeEditor}
                          className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={upsertMutation.isPending}
                          className="rounded-full bg-gym-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gym-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {upsertMutation.isPending ? 'Saving...' : 'Save category'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>,
                document.body
              )
            : null
        ) : null}
      </section>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.action === 'restore' ? 'Restore food category?' : 'Archive food category?'}
        description={
          confirmState.action === 'restore'
            ? 'This category will become available in food tagging again.'
            : 'This category will be hidden from active tagging but can be restored later.'
        }
        confirmLabel={confirmState.action === 'restore' ? 'Restore' : 'Archive'}
        tone={confirmState.action === 'restore' ? 'neutral' : 'danger'}
        pending={archiveMutation.isPending || restoreMutation.isPending}
        onCancel={() => setConfirmState({ open: false, item: null, action: null })}
        onConfirm={() => {
          const targetId = confirmState.item?.foodCategoryId
          if (!targetId) return
          if (confirmState.action === 'restore') restoreMutation.mutate(targetId)
          else archiveMutation.mutate(targetId)
        }}
      />
    </WorkspaceScaffold>
  )
}

export default AdminFoodCategoriesPage
