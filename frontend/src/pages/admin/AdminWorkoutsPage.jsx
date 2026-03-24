import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Dumbbell, Edit3, PlusCircle, Search, ShieldCheck, Trash2, Undo2, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { adminNav } from '../../config/navigation'
import { adminWorkoutApi } from '../../features/content/api/adminWorkoutApi'

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active only' },
  { value: 'archived', label: 'Archived only' },
]

const INPUT_CLASS = 'gc-input'
const TEXTAREA_CLASS = 'gc-textarea'
const FILTER_CLASS = 'gc-select min-h-0 rounded-2xl bg-[rgba(18,18,26,0.92)] px-4 py-3'

function buildInitialWorkoutForm(categories = []) {
  const defaultCategoryId = categories[0]?.workoutCategoryId ?? ''
  return {
    workoutId: null,
    name: '',
    description: '',
    instructions: '',
    imageUrl: '',
    videoUrl: '',
    difficulty: '',
    categoryIds: defaultCategoryId ? [defaultCategoryId] : [],
    active: true,
  }
}

function normalizeWorkoutForForm(workout, categories = []) {
  if (!workout) return buildInitialWorkoutForm(categories)
  return {
    workoutId: workout.workoutId,
    name: workout.name ?? '',
    description: workout.description ?? '',
    instructions: workout.instructions ?? '',
    imageUrl: workout.imageUrl ?? '',
    videoUrl: workout.videoUrl ?? '',
    difficulty: workout.difficulty ?? '',
    categoryIds: (workout.categories || []).map((category) => category.workoutCategoryId),
    active: workout.active ?? true,
  }
}

function resolveApiMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function validateWorkoutDraft(draft) {
  if (!String(draft?.name || '').trim()) return 'Workout name is required.'
  if (!String(draft?.instructions || '').trim()) return 'Workout instructions are required.'
  if (!Array.isArray(draft?.categoryIds) || draft.categoryIds.length === 0) return 'Select at least one workout category.'
  return ''
}

function AdminWorkoutsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [editingWorkout, setEditingWorkout] = useState(null)
  const [confirmState, setConfirmState] = useState({ open: false, workout: null, action: null })
  const [formError, setFormError] = useState('')

  const workoutsQuery = useQuery({
    queryKey: ['admin-workouts'],
    queryFn: adminWorkoutApi.getWorkouts,
  })

  const upsertMutation = useMutation({
    mutationFn: (payload) =>
      payload.workoutId
        ? adminWorkoutApi.updateWorkout(payload.workoutId, payload.body)
        : adminWorkoutApi.createWorkout(payload.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-workouts'] })
      setEditingWorkout(null)
      setFormError('')
    },
    onError: (error) => setFormError(resolveApiMessage(error, 'Workout could not be saved.')),
  })

  const archiveMutation = useMutation({
    mutationFn: adminWorkoutApi.archiveWorkout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-workouts'] })
      setConfirmState({ open: false, workout: null, action: null })
    },
    onError: (error) => toast.error(resolveApiMessage(error, 'Could not archive workout.')),
  })

  const restoreMutation = useMutation({
    mutationFn: adminWorkoutApi.restoreWorkout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-workouts'] })
      setConfirmState({ open: false, workout: null, action: null })
    },
    onError: (error) => toast.error(resolveApiMessage(error, 'Could not restore workout.')),
  })

  const workouts = useMemo(() => workoutsQuery.data?.items ?? [], [workoutsQuery.data])
  const categories = useMemo(() => workoutsQuery.data?.categories ?? [], [workoutsQuery.data])
  const normalizedSearch = search.trim().toLowerCase()

  const filteredWorkouts = useMemo(() => {
    return workouts.filter((workout) => {
      const active = Boolean(workout.active)
      if (statusFilter === 'active' && !active) return false
      if (statusFilter === 'archived' && active) return false
      if (categoryFilter !== 'ALL') {
        const match = (workout.categories || []).some((c) => String(c.workoutCategoryId) === String(categoryFilter))
        if (!match) return false
      }
      if (!normalizedSearch) return true
      const haystack = [workout.name, workout.description, workout.difficulty, workout.videoUrl, ...(workout.categories || []).map((c) => c.name)]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [categoryFilter, normalizedSearch, statusFilter, workouts])

  const formCategories = useMemo(() => categories.filter((c) => c.active !== false), [categories])
  const [formState, setFormState] = useState(() => buildInitialWorkoutForm([]))

  const closeEditor = () => {
    setEditingWorkout(null)
    setFormState(buildInitialWorkoutForm(formCategories))
    setFormError('')
  }

  const openCreate = () => {
    setEditingWorkout({ workoutId: null })
    setFormState(buildInitialWorkoutForm(formCategories))
    setFormError('')
  }

  const openEdit = (workout) => {
    setEditingWorkout(workout)
    setFormState(normalizeWorkoutForForm(workout, formCategories))
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
    const error = validateWorkoutDraft(formState)
    if (error) {
      setFormError(error)
      return
    }
    const body = {
      name: String(formState.name || '').trim(),
      description: String(formState.description || '').trim() || null,
      instructions: String(formState.instructions || '').trim(),
      imageUrl: String(formState.imageUrl || '').trim() || null,
      videoUrl: String(formState.videoUrl || '').trim() || null,
      difficulty: String(formState.difficulty || '').trim() || null,
      categoryIds: formState.categoryIds || [],
      active: Boolean(formState.active),
    }
    try {
      await upsertMutation.mutateAsync({ workoutId: formState.workoutId, body })
    } catch {
      // handled in mutation callbacks
    }
  }

  const confirmArchive = (workout) => setConfirmState({ open: true, workout, action: 'archive' })
  const confirmRestore = (workout) => setConfirmState({ open: true, workout, action: 'restore' })

  return (
    <WorkspaceScaffold
      title="Workout Management"
      subtitle="Create and maintain workout knowledge content, including categories, images, and embedded YouTube videos."
      links={adminNav}
    >
      <section className="gc-card-compact space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="gc-section-kicker">Workouts</h2>
            <p className="mt-1 text-sm text-zinc-500">Search, edit, archive, and restore workout content for customer browsing.</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="gc-button-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
          >
            <PlusCircle size={18} />
            New workout
          </button>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition-[border-color,background-color,box-shadow] duration-200 ease-out focus-within:border-amber-500/30 focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-500/15">
            <Search size={16} className="text-slate-400" />
            <span className="sr-only">Search workouts</span>
            <input
              type="search"
              name="admin-workout-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="Search name, category, difficulty, or video..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            name="admin-workout-status-filter"
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
            name="admin-workout-category-filter"
            className={FILTER_CLASS}
          >
            <option value="ALL">All categories</option>
            {categories
              .filter((c) => c.active !== false)
              .map((category) => (
                <option key={category.workoutCategoryId} value={String(category.workoutCategoryId)}>
                  {category.name}
                </option>
            ))}
          </select>
        </div>

        {workoutsQuery.isLoading ? (
          <p className="text-sm text-zinc-500" aria-live="polite">
            Loading workouts…
          </p>
        ) : null}
        {workoutsQuery.isError ? <p className="text-sm text-rose-600">Could not load workouts.</p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredWorkouts.map((workout) => {
            const isActive = Boolean(workout.active)
            return (
              <article key={workout.workoutId} className="overflow-hidden rounded-3xl border border-white/10 bg-[rgba(18,18,26,0.92)] shadow-sm">
                <div className="relative aspect-[4/3] overflow-hidden bg-white/10">
                  {workout.imageUrl ? (
                    <img
                      src={workout.imageUrl}
                      alt={workout.name}
                      referrerPolicy="no-referrer"
                      width="480"
                      height="360"
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Dumbbell size={28} />
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
                    <h3 className="text-base font-bold text-white">{workout.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-400">{workout.description || 'No description yet.'}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(workout.categories || []).map((category) => (
                      <span key={`${workout.workoutId}-${category.workoutCategoryId}`} className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
                        {category.name}
                      </span>
                    ))}
                    {workout.difficulty ? (
                      <span className="rounded-full bg-gym-500/10 px-3 py-1 text-xs font-semibold text-gym-300">{workout.difficulty}</span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(workout)}
                      className="gc-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                    >
                      <Edit3 size={16} />
                      Edit
                    </button>
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => confirmArchive(workout)}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 transition-[border-color,background-color,transform] duration-200 ease-out hover:border-rose-400/35 hover:bg-rose-500/15 active:scale-[0.98]"
                      >
                        <Trash2 size={16} />
                        Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => confirmRestore(workout)}
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

        {editingWorkout ? (
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
                      aria-label={formState.workoutId ? 'Edit workout' : 'Create workout'}
                      className="w-full overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(18,18,26,0.92)] shadow-2xl"
                    >
                      <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Admin workout editor</p>
                          <h2 className="mt-2 text-xl font-bold text-white">
                            {formState.workoutId ? 'Edit workout' : 'Create workout'}
                          </h2>
                        </div>
                        <button
                          type="button"
                          onClick={closeEditor}
                          className="rounded-full p-2 text-zinc-500 transition hover:bg-white/10 hover:text-slate-100"
                          aria-label="Close workout editor"
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
                            name="workoutName"
                            type="text"
                            autoComplete="off"
                            className={`mt-1.5 ${INPUT_CLASS}`}
                            placeholder="Push-up"
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
                            placeholder="Short overview for customers..."
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Instructions *</span>
                          <textarea
                            value={formState.instructions}
                            onChange={(event) => setFormState((prev) => ({ ...prev, instructions: event.target.value }))}
                            name="instructions"
                            autoComplete="off"
                            rows={6}
                            className={`mt-1.5 ${TEXTAREA_CLASS} resize-none`}
                            placeholder="Step-by-step instructions..."
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
                                alt="Workout"
                                referrerPolicy="no-referrer"
                                width="480"
                                height="360"
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-300">
                                <Dumbbell size={28} />
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

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">YouTube URL</span>
                          <input
                            value={formState.videoUrl}
                            onChange={(event) => setFormState((prev) => ({ ...prev, videoUrl: event.target.value }))}
                            name="videoUrl"
                            type="url"
                            autoComplete="off"
                            spellCheck={false}
                            className={`mt-1.5 ${INPUT_CLASS}`}
                            placeholder="https://www.youtube.com/watch?v=..."
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Difficulty</span>
                          <input
                            value={formState.difficulty}
                            onChange={(event) => setFormState((prev) => ({ ...prev, difficulty: event.target.value }))}
                            name="difficulty"
                            type="text"
                            autoComplete="off"
                            className={`mt-1.5 ${INPUT_CLASS}`}
                            placeholder="Beginner / Intermediate / Advanced"
                          />
                        </label>

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
                            const selected = (formState.categoryIds || []).some((id) => String(id) === String(category.workoutCategoryId))
                            return (
                              <button
                                key={category.workoutCategoryId}
                                type="button"
                                onClick={() => toggleCategoryId(category.workoutCategoryId)}
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
                            {upsertMutation.isPending ? 'Saving…' : 'Save workout'}
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
        title={confirmState.action === 'restore' ? 'Restore workout?' : 'Archive workout?'}
        description={
          confirmState.action === 'restore'
            ? 'The workout will become visible to customers again.'
            : 'The workout will be hidden from customers, but kept for future restore.'
        }
        confirmLabel={confirmState.action === 'restore' ? 'Restore' : 'Archive'}
        tone={confirmState.action === 'restore' ? 'neutral' : 'danger'}
        pending={archiveMutation.isPending || restoreMutation.isPending}
        onCancel={() => setConfirmState({ open: false, workout: null, action: null })}
        onConfirm={() => {
          const targetId = confirmState.workout?.workoutId
          if (!targetId) return
          if (confirmState.action === 'restore') restoreMutation.mutate(targetId)
          else archiveMutation.mutate(targetId)
        }}
      />
    </WorkspaceScaffold>
  )
}

export default AdminWorkoutsPage







