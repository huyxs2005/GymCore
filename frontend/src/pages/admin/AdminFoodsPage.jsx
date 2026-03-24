import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Apple, Edit3, PlusCircle, Search, ShieldCheck, Trash2, Undo2, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { adminNav } from '../../config/navigation'
import { adminFoodApi } from '../../features/content/api/adminFoodApi'

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active only' },
  { value: 'archived', label: 'Archived only' },
]

const INPUT_CLASS = 'gc-input'
const TEXTAREA_CLASS = 'gc-textarea'
const FILTER_CLASS = 'gc-select min-h-0 rounded-2xl bg-[rgba(18,18,26,0.92)] px-4 py-3'

function buildInitialFoodForm(categories = []) {
  const defaultCategoryId = categories[0]?.foodCategoryId ?? ''
  return {
    foodId: null,
    name: '',
    description: '',
    recipe: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    imageUrl: '',
    categoryIds: defaultCategoryId ? [defaultCategoryId] : [],
    active: true,
  }
}

function normalizeFoodForForm(food, categories = []) {
  if (!food) return buildInitialFoodForm(categories)
  return {
    foodId: food.foodId,
    name: food.name ?? '',
    description: food.description ?? '',
    recipe: food.recipe ?? '',
    calories: food.calories ?? '',
    protein: food.protein ?? '',
    carbs: food.carbs ?? '',
    fat: food.fat ?? '',
    imageUrl: food.imageUrl ?? '',
    categoryIds: (food.categories || []).map((category) => category.foodCategoryId),
    active: food.active ?? true,
  }
}

function resolveApiMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function parseOptionalNonNegativeNumber(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed < 0) return NaN
  return parsed
}

function validateFoodDraft(draft) {
  if (!String(draft?.name || '').trim()) return 'Food name is required.'
  if (!Array.isArray(draft?.categoryIds) || draft.categoryIds.length === 0) return 'Select at least one food category.'
  const calories = parseOptionalNonNegativeNumber(draft?.calories)
  if (Number.isNaN(calories)) return 'Calories must be a non-negative number.'
  for (const [label, value] of [
    ['Protein', draft?.protein],
    ['Carbs', draft?.carbs],
    ['Fat', draft?.fat],
  ]) {
    const parsed = parseOptionalNonNegativeNumber(value)
    if (Number.isNaN(parsed)) return `${label} must be a non-negative number.`
  }
  return ''
}

function AdminFoodsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [editingFood, setEditingFood] = useState(null)
  const [confirmState, setConfirmState] = useState({ open: false, food: null, action: null })
  const [formError, setFormError] = useState('')

  const foodsQuery = useQuery({
    queryKey: ['admin-foods'],
    queryFn: adminFoodApi.getFoods,
  })

  const upsertMutation = useMutation({
    mutationFn: (payload) =>
      payload.foodId
        ? adminFoodApi.updateFood(payload.foodId, payload.body)
        : adminFoodApi.createFood(payload.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-foods'] })
      setEditingFood(null)
      setFormError('')
    },
    onError: (error) => setFormError(resolveApiMessage(error, 'Food could not be saved.')),
  })

  const archiveMutation = useMutation({
    mutationFn: adminFoodApi.archiveFood,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-foods'] })
      setConfirmState({ open: false, food: null, action: null })
    },
    onError: (error) => toast.error(resolveApiMessage(error, 'Could not archive food.')),
  })

  const restoreMutation = useMutation({
    mutationFn: adminFoodApi.restoreFood,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-foods'] })
      setConfirmState({ open: false, food: null, action: null })
    },
    onError: (error) => toast.error(resolveApiMessage(error, 'Could not restore food.')),
  })

  const foods = useMemo(() => foodsQuery.data?.items ?? [], [foodsQuery.data])
  const categories = useMemo(() => foodsQuery.data?.categories ?? [], [foodsQuery.data])
  const normalizedSearch = search.trim().toLowerCase()

  const filteredFoods = useMemo(() => {
    return foods.filter((food) => {
      const active = Boolean(food.active)
      if (statusFilter === 'active' && !active) return false
      if (statusFilter === 'archived' && active) return false
      if (categoryFilter !== 'ALL') {
        const match = (food.categories || []).some((c) => String(c.foodCategoryId) === String(categoryFilter))
        if (!match) return false
      }
      if (!normalizedSearch) return true
      const haystack = [food.name, food.description, ...(food.categories || []).map((c) => c.name)].join(' ').toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [categoryFilter, foods, normalizedSearch, statusFilter])

  const formCategories = useMemo(() => categories.filter((c) => c.active !== false), [categories])
  const [formState, setFormState] = useState(() => buildInitialFoodForm([]))

  const closeEditor = () => {
    setEditingFood(null)
    setFormState(buildInitialFoodForm(formCategories))
    setFormError('')
  }

  const openCreate = () => {
    setEditingFood({ foodId: null })
    setFormState(buildInitialFoodForm(formCategories))
    setFormError('')
  }

  const openEdit = (food) => {
    setEditingFood(food)
    setFormState(normalizeFoodForForm(food, formCategories))
    setFormError('')
  }

  const toggleCategoryId = (categoryId) => {
    setFormState((prev) => {
      const id = Number(categoryId)
      const next = new Set(prev.categoryIds || [])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, categoryIds: Array.from(next) }
    })
  }

  const submitForm = async (event) => {
    event.preventDefault()
    const error = validateFoodDraft(formState)
    if (error) {
      setFormError(error)
      return
    }
    const body = {
      name: String(formState.name || '').trim(),
      description: String(formState.description || '').trim() || null,
      recipe: String(formState.recipe || '').trim() || null,
      calories: parseOptionalNonNegativeNumber(formState.calories),
      protein: parseOptionalNonNegativeNumber(formState.protein),
      carbs: parseOptionalNonNegativeNumber(formState.carbs),
      fat: parseOptionalNonNegativeNumber(formState.fat),
      imageUrl: String(formState.imageUrl || '').trim() || null,
      categoryIds: formState.categoryIds || [],
      active: Boolean(formState.active),
    }
    try {
      await upsertMutation.mutateAsync({ foodId: formState.foodId, body })
    } catch {
      // handled in mutation callbacks
    }
  }

  const confirmArchive = (food) => setConfirmState({ open: true, food, action: 'archive' })
  const confirmRestore = (food) => setConfirmState({ open: true, food, action: 'restore' })

  return (
    <WorkspaceScaffold
      title="Food Management"
      subtitle="Create and maintain food knowledge content, with nutrition macros and category tagging."
      links={adminNav}
    >
      <section className="gc-card-compact space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="gc-section-kicker">Foods</h2>
            <p className="mt-1 text-sm text-zinc-500">Search, edit, archive, and restore food entries used for customer education and AI recommendations.</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="gc-button-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
          >
            <PlusCircle size={18} />
            New food
          </button>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition-[border-color,background-color,box-shadow] duration-200 ease-out focus-within:border-amber-500/30 focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-500/15">
            <Search size={16} className="text-slate-400" />
            <span className="sr-only">Search foods</span>
            <input
              type="search"
              name="admin-food-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="Search name or category..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            name="admin-food-status-filter"
            className={FILTER_CLASS}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            name="admin-food-category-filter"
            className={FILTER_CLASS}
          >
            <option value="ALL">All categories</option>
            {categories
              .filter((c) => c.active !== false)
              .map((category) => (
                <option key={category.foodCategoryId} value={String(category.foodCategoryId)}>
                  {category.name}
                </option>
            ))}
          </select>
        </div>

        {foodsQuery.isLoading ? (
          <p className="text-sm text-zinc-500" aria-live="polite">
            Loading foods…
          </p>
        ) : null}
        {foodsQuery.isError ? <p className="text-sm text-rose-600">Could not load foods.</p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredFoods.map((food) => {
            const isActive = Boolean(food.active)
            return (
              <article key={food.foodId} className="overflow-hidden rounded-3xl border border-white/10 bg-[rgba(18,18,26,0.92)] shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-white/10">
                  {food.imageUrl ? (
                    <img
                      src={food.imageUrl}
                      alt={food.name}
                      referrerPolicy="no-referrer"
                      width="480"
                      height="360"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Apple size={28} />
                    </div>
                  )}
                  <span
                    className={`absolute left-4 top-4 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${
                      isActive ? 'bg-emerald-600 text-white' : 'bg-[rgba(18,18,26,0.92)] text-white'
                    }`}
                  >
                    {isActive ? 'Active' : 'Archived'}
                  </span>
                </div>

                <div className="space-y-4 p-4">
                  <div>
                    <h3 className="text-base font-bold text-white">{food.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-400">{food.description || 'No description yet.'}</p>
                  </div>

                  <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white/5 p-3 text-xs text-slate-300">
                    <div>
                      <p className="font-semibold">Cal</p>
                      <p>{food.calories ?? '-'}</p>
                    </div>
                    <div>
                      <p className="font-semibold">P</p>
                      <p>{food.protein ?? '-'}</p>
                    </div>
                    <div>
                      <p className="font-semibold">C</p>
                      <p>{food.carbs ?? '-'}</p>
                    </div>
                    <div>
                      <p className="font-semibold">F</p>
                      <p>{food.fat ?? '-'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(food.categories || []).map((category) => (
                      <span key={`${food.foodId}-${category.foodCategoryId}`} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                        {category.name}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(food)}
                      className="gc-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                    >
                      <Edit3 size={16} />
                      Edit
                    </button>
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => confirmArchive(food)}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 transition-[border-color,background-color,transform] duration-200 ease-out hover:border-rose-400/35 hover:bg-rose-500/15 active:scale-[0.98]"
                      >
                        <Trash2 size={16} />
                        Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => confirmRestore(food)}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition-[border-color,background-color,transform] duration-200 ease-out hover:border-amber-400/35 hover:bg-amber-500/15 active:scale-[0.98]"
                      >
                        <Undo2 size={16} />
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {editingFood ? (
          typeof document !== 'undefined'
            ? createPortal(
                <div
                  className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/55 px-4 py-8 backdrop-blur-sm"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) closeEditor()
                  }}
                >
                  <div className="mx-auto flex min-h-full max-w-3xl items-start justify-center">
                    <form
                      onSubmit={submitForm}
                      aria-label={formState.foodId ? 'Edit food' : 'Create food'}
                      className="w-full overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(18,18,26,0.92)] shadow-2xl"
                    >
                      <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Admin food editor</p>
                          <h2 className="mt-2 text-xl font-bold text-white">{formState.foodId ? 'Edit food' : 'Create food'}</h2>
                        </div>
                        <button
                          type="button"
                          onClick={closeEditor}
                          className="rounded-full p-2 text-zinc-500 transition hover:bg-white/10 hover:text-slate-100"
                          aria-label="Close food editor"
                        >
                          <X size={18} />
                        </button>
                      </header>

                      <div className="grid gap-4 p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="space-y-3">
                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Name *</span>
                          <input
                            value={formState.name}
                            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                            name="foodName"
                            type="text"
                            autoComplete="off"
                            className={`mt-1.5 ${INPUT_CLASS}`}
                            placeholder="Chicken Breast"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Description</span>
                          <textarea
                            value={formState.description}
                            onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                            name="description"
                            autoComplete="off"
                            rows={3}
                            className={`mt-1.5 ${TEXTAREA_CLASS} resize-none`}
                            placeholder="Short overview..."
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Recipe</span>
                          <textarea
                            value={formState.recipe}
                            onChange={(event) => setFormState((prev) => ({ ...prev, recipe: event.target.value }))}
                            name="recipe"
                            autoComplete="off"
                            rows={6}
                            className={`mt-1.5 ${TEXTAREA_CLASS} resize-none`}
                            placeholder="Step-by-step recipe..."
                          />
                        </label>
                        </div>

                        <div className="space-y-3">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Preview</p>
                          <div className="mt-3 aspect-[4/3] overflow-hidden rounded-2xl bg-[rgba(18,18,26,0.92)]">
                            {String(formState.imageUrl || '').trim() ? (
                              <img
                                src={formState.imageUrl}
                                alt="Food"
                                referrerPolicy="no-referrer"
                                width="480"
                                height="360"
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-300">
                                <Apple size={28} />
                              </div>
                            )}
                          </div>
                          <p className="mt-3 text-xs text-zinc-500">Images are loaded directly from the URL you provide.</p>
                        </div>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Image URL</span>
                          <input
                            value={formState.imageUrl}
                            onChange={(event) => setFormState((prev) => ({ ...prev, imageUrl: event.target.value }))}
                            name="imageUrl"
                            type="url"
                            autoComplete="off"
                            spellCheck={false}
                            className={`mt-1.5 ${INPUT_CLASS}`}
                            placeholder="https://..."
                          />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Calories</span>
                            <input
                              value={formState.calories}
                              onChange={(event) => setFormState((prev) => ({ ...prev, calories: event.target.value }))}
                              name="calories"
                              inputMode="decimal"
                              autoComplete="off"
                              className={`mt-1.5 ${INPUT_CLASS}`}
                              placeholder="165"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Protein</span>
                            <input
                              value={formState.protein}
                              onChange={(event) => setFormState((prev) => ({ ...prev, protein: event.target.value }))}
                              name="protein"
                              inputMode="decimal"
                              autoComplete="off"
                              className={`mt-1.5 ${INPUT_CLASS}`}
                              placeholder="31"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Carbs</span>
                            <input
                              value={formState.carbs}
                              onChange={(event) => setFormState((prev) => ({ ...prev, carbs: event.target.value }))}
                              name="carbs"
                              inputMode="decimal"
                              autoComplete="off"
                              className={`mt-1.5 ${INPUT_CLASS}`}
                              placeholder="0"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Fat</span>
                            <input
                              value={formState.fat}
                              onChange={(event) => setFormState((prev) => ({ ...prev, fat: event.target.value }))}
                              name="fat"
                              inputMode="decimal"
                              autoComplete="off"
                              className={`mt-1.5 ${INPUT_CLASS}`}
                              placeholder="3.6"
                            />
                          </label>
                        </div>

                        <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[rgba(18,18,26,0.92)] px-4 py-3">
                          <span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                            <ShieldCheck size={16} className="text-gym-600" /> Active
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(formState.active)}
                            onChange={(event) => setFormState((prev) => ({ ...prev, active: event.target.checked }))}
                            className="h-4 w-4 accent-gym-600"
                          />
                        </label>
                        </div>
                      </div>

                      <div className="border-t border-white/10 px-6 py-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Categories *</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {formCategories.map((category) => {
                            const selected = (formState.categoryIds || []).some((id) => String(id) === String(category.foodCategoryId))
                            return (
                              <button
                                key={category.foodCategoryId}
                                type="button"
                                onClick={() => toggleCategoryId(category.foodCategoryId)}
                                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                  selected ? 'bg-gym-600 text-white' : 'border border-white/10 bg-[rgba(18,18,26,0.92)] text-slate-300 hover:bg-white/5'
                                }`}
                              >
                                {category.name}
                              </button>
                            )
                          })}
                        </div>

                        {formError ? (
                          <p className="mt-3 text-sm font-semibold text-rose-300" aria-live="polite">
                            {formError}
                          </p>
                        ) : null}

                        <div className="mt-5 flex flex-wrap justify-end gap-3">
                          <button
                            type="button"
                            onClick={closeEditor}
                            className="gc-button-secondary px-5 py-2.5 text-sm font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={upsertMutation.isPending}
                            className="gc-button-primary px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {upsertMutation.isPending ? 'Saving…' : 'Save food'}
                          </button>
                        </div>
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
        title={confirmState.action === 'restore' ? 'Restore food?' : 'Archive food?'}
        description={
          confirmState.action === 'restore'
            ? 'The food entry will become visible to customers again.'
            : 'The food entry will be hidden from customers, but kept for future restore.'
        }
        confirmLabel={confirmState.action === 'restore' ? 'Restore' : 'Archive'}
        tone={confirmState.action === 'restore' ? 'neutral' : 'danger'}
        pending={archiveMutation.isPending || restoreMutation.isPending}
        onCancel={() => setConfirmState({ open: false, food: null, action: null })}
        onConfirm={() => {
          const targetId = confirmState.food?.foodId
          if (!targetId) return
          if (confirmState.action === 'restore') restoreMutation.mutate(targetId)
          else archiveMutation.mutate(targetId)
        }}
      />
    </WorkspaceScaffold>
  )
}

export default AdminFoodsPage







