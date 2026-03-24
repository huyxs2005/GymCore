import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, Flag, PlusCircle, Search, ShieldCheck, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { adminNav } from '../../config/navigation'
import { adminGoalApi } from '../../features/content/api/adminGoalApi'

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active only' },
  { value: 'archived', label: 'Archived only' },
]

const INPUT_CLASS = 'gc-input'
const TEXTAREA_CLASS = 'gc-textarea'
const FILTER_CLASS = 'gc-select min-h-0 rounded-2xl bg-[rgba(18,18,26,0.92)] px-4 py-3'

function buildInitialForm(workouts = [], foods = []) {
  return {
    goalId: null,
    goalCode: '',
    name: '',
    description: '',
    active: true,
    workoutIds: workouts[0]?.workoutId ? [workouts[0].workoutId] : [],
    foodIds: foods[0]?.foodId ? [foods[0].foodId] : [],
  }
}

function normalizeGoal(goal, workouts = [], foods = []) {
  if (!goal) return buildInitialForm(workouts, foods)
  return {
    goalId: goal.goalId,
    goalCode: goal.goalCode ?? '',
    name: goal.name ?? '',
    description: goal.description ?? '',
    active: goal.active ?? true,
    workoutIds: goal.workoutIds ?? [],
    foodIds: goal.foodIds ?? [],
  }
}

function resolveApiMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback
}

function validateGoalDraft(draft) {
  if (!String(draft?.goalCode || '').trim()) return 'Goal code is required.'
  if (!String(draft?.name || '').trim()) return 'Goal name is required.'
  return ''
}

function GoalPicker({ items, selectedIds, idKey, label, onToggle }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const itemId = item[idKey]
          const selected = selectedIds.some((value) => String(value) === String(itemId))
          return (
            <button
              key={`${label}-${itemId}`}
              type="button"
              onClick={() => onToggle(itemId)}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                selected ? 'bg-amber-500 text-slate-950' : 'border border-white/10 bg-[rgba(18,18,26,0.92)] text-slate-300 hover:bg-white/5'
              } ${item.active === false ? 'opacity-60' : ''}`}
            >
              {item.name}
              {item.active === false ? ' (Archived)' : ''}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function AdminGoalsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingGoal, setEditingGoal] = useState(null)
  const [formState, setFormState] = useState(() => buildInitialForm())
  const [formError, setFormError] = useState('')
  const [confirmState, setConfirmState] = useState({ open: false, goal: null, action: null })

  const goalsQuery = useQuery({
    queryKey: ['admin-goals'],
    queryFn: adminGoalApi.getGoals,
  })

  const upsertMutation = useMutation({
    mutationFn: (payload) =>
      payload.goalId ? adminGoalApi.updateGoal(payload.goalId, payload.body) : adminGoalApi.createGoal(payload.body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-goals'] })
      setEditingGoal(null)
      setFormError('')
    },
    onError: (error) => setFormError(resolveApiMessage(error, 'Goal could not be saved.')),
  })

  const archiveMutation = useMutation({
    mutationFn: adminGoalApi.archiveGoal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-goals'] })
      setConfirmState({ open: false, goal: null, action: null })
    },
    onError: (error) => toast.error(resolveApiMessage(error, 'Could not archive goal.')),
  })

  const restoreMutation = useMutation({
    mutationFn: adminGoalApi.restoreGoal,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-goals'] })
      setConfirmState({ open: false, goal: null, action: null })
    },
    onError: (error) => toast.error(resolveApiMessage(error, 'Could not restore goal.')),
  })

  const goals = useMemo(() => goalsQuery.data?.items ?? [], [goalsQuery.data])
  const workouts = useMemo(() => goalsQuery.data?.workouts ?? [], [goalsQuery.data])
  const foods = useMemo(() => goalsQuery.data?.foods ?? [], [goalsQuery.data])
  const normalizedSearch = search.trim().toLowerCase()

  const filteredGoals = useMemo(() => {
    return goals.filter((goal) => {
      const active = Boolean(goal.active)
      if (statusFilter === 'active' && !active) return false
      if (statusFilter === 'archived' && active) return false
      if (!normalizedSearch) return true
      const haystack = [
        goal.goalCode,
        goal.name,
        goal.description,
        ...(goal.workouts || []).map((item) => item.name),
        ...(goal.foods || []).map((item) => item.name),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [goals, normalizedSearch, statusFilter])

  const closeEditor = () => {
    setEditingGoal(null)
    setFormState(buildInitialForm(workouts, foods))
    setFormError('')
  }

  const openCreate = () => {
    setEditingGoal({ goalId: null })
    setFormState(buildInitialForm(workouts, foods))
    setFormError('')
  }

  const openEdit = (goal) => {
    setEditingGoal(goal)
    setFormState(normalizeGoal(goal, workouts, foods))
    setFormError('')
  }

  const toggleSelection = (key, id) => {
    setFormState((prev) => {
      const current = new Set(prev[key] || [])
      if (current.has(id)) current.delete(id)
      else current.add(id)
      return { ...prev, [key]: Array.from(current) }
    })
  }

  const submitForm = async (event) => {
    event.preventDefault()
    const error = validateGoalDraft(formState)
    if (error) {
      setFormError(error)
      return
    }
    try {
      await upsertMutation.mutateAsync({
        goalId: formState.goalId,
        body: {
          goalCode: String(formState.goalCode || '').trim(),
          name: String(formState.name || '').trim(),
          description: String(formState.description || '').trim() || null,
          active: Boolean(formState.active),
          workoutIds: formState.workoutIds || [],
          foodIds: formState.foodIds || [],
        },
      })
    } catch {
      // handled by mutation callbacks
    }
  }

  return (
    <WorkspaceScaffold
      title="Goal Management"
      subtitle="Maintain fitness goal codes and map them to workouts and foods used by the customer AI layer."
      links={adminNav}
    >
      <section className="gc-card-compact space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="gc-section-kicker">Fitness goals</h2>
            <p className="mt-1 text-sm text-zinc-500">Control saved-goal options and the workout/food mappings behind recommendations.</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="gc-button-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
          >
            <PlusCircle size={18} />
            New goal
          </button>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition-[border-color,background-color,box-shadow] duration-200 ease-out focus-within:border-amber-500/30 focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-500/15">
            <Search size={16} className="text-slate-400" />
            <span className="sr-only">Search goals</span>
            <input
              type="search"
              name="goalSearch"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="Search code, title, workouts, or foods…"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            name="goalStatusFilter"
            className={FILTER_CLASS}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {goalsQuery.isLoading ? <p className="text-sm text-zinc-500" aria-live="polite">Loading goals…</p> : null}
        {goalsQuery.isError ? <p className="text-sm text-rose-600">Could not load admin goals.</p> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)]">
          <div className="grid gap-4 md:grid-cols-2">
            {filteredGoals.map((goal) => {
              const isActive = Boolean(goal.active)
              return (
                <article key={goal.goalId} className="rounded-3xl border border-white/10 bg-[rgba(18,18,26,0.92)] p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                        {goal.goalCode}
                      </span>
                      <h3 className="mt-3 text-lg font-bold text-white">{goal.name}</h3>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${isActive ? 'bg-emerald-600 text-white' : 'bg-[rgba(18,18,26,0.92)] text-white'}`}>
                      {isActive ? 'Active' : 'Archived'}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">{goal.description || 'No goal description yet.'}</p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mapped workouts</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(goal.workouts || []).length ? (
                          goal.workouts.map((item) => (
                            <span key={`goal-${goal.goalId}-workout-${item.workoutId}`} className="rounded-full bg-gym-500/10 px-3 py-1 text-xs font-semibold text-gym-300">
                              {item.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mapped foods</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(goal.foods || []).length ? (
                          goal.foods.map((item) => (
                            <span key={`goal-${goal.goalId}-food-${item.foodId}`} className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                              {item.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400">None</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(goal)}
                      className="gc-button-secondary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                    >
                      <Edit3 size={16} />
                      Edit
                    </button>
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => setConfirmState({ open: true, goal, action: 'archive' })}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-100"
                      >
                        <Trash2 size={16} />
                        Archive
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmState({ open: true, goal, action: 'restore' })}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 transition-[border-color,background-color,transform] duration-200 ease-out hover:border-amber-400/35 hover:bg-amber-500/15 active:scale-[0.98]"
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

          <aside className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-amber-300" />
              <h3 className="text-lg font-bold text-white">{editingGoal ? 'Goal editor' : 'Select a goal'}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {editingGoal
                ? 'Update the goal code, title, active state, and AI mappings.'
                : 'Create a new goal or open an existing one to manage its recommendation mappings.'}
            </p>

            {editingGoal ? (
              <form onSubmit={submitForm} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Goal code *</span>
                  <input
                    name="goalCode"
                    value={formState.goalCode}
                    onChange={(event) => setFormState((prev) => ({ ...prev, goalCode: event.target.value }))}
                    autoComplete="off"
                    spellCheck={false}
                    className={`mt-1.5 ${INPUT_CLASS}`}
                    placeholder="GAIN_MUSCLE"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Goal name *</span>
                  <input
                    name="goalName"
                    value={formState.name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                    autoComplete="off"
                    className={`mt-1.5 ${INPUT_CLASS}`}
                    placeholder="Gain muscle"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Description</span>
                  <textarea
                    name="description"
                    value={formState.description}
                    onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                    autoComplete="off"
                    rows={3}
                    className={`mt-1.5 ${TEXTAREA_CLASS} resize-none`}
                    placeholder="Explain when this goal should be selected…"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[rgba(18,18,26,0.92)] px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                    <ShieldCheck size={16} className="text-amber-300" />
                    Active
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(formState.active)}
                    onChange={(event) => setFormState((prev) => ({ ...prev, active: event.target.checked }))}
                    className="h-4 w-4 accent-gym-600"
                  />
                </label>

                <GoalPicker
                  items={workouts}
                  selectedIds={formState.workoutIds}
                  idKey="workoutId"
                  label="Workout mappings"
                  onToggle={(id) => toggleSelection('workoutIds', id)}
                />

                <GoalPicker
                  items={foods}
                  selectedIds={formState.foodIds}
                  idKey="foodId"
                  label="Food mappings"
                  onToggle={(id) => toggleSelection('foodIds', id)}
                />

                {formError ? <p className="text-sm font-semibold text-rose-300" aria-live="polite">{formError}</p> : null}

                <div className="flex flex-wrap justify-end gap-3">
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
                    {upsertMutation.isPending ? 'Saving…' : editingGoal.goalId ? 'Save changes' : 'Create goal'}
                  </button>
                </div>
              </form>
            ) : null}
          </aside>
        </div>
      </section>

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.action === 'restore' ? 'Restore goal?' : 'Archive goal?'}
        description={
          confirmState.action === 'restore'
            ? 'The goal will become available again for customer saved-goal flows.'
            : 'The goal will be hidden from customers, but kept for restore and audit history.'
        }
        confirmLabel={confirmState.action === 'restore' ? 'Restore' : 'Archive'}
        tone={confirmState.action === 'restore' ? 'neutral' : 'danger'}
        pending={archiveMutation.isPending || restoreMutation.isPending}
        onCancel={() => setConfirmState({ open: false, goal: null, action: null })}
        onConfirm={() => {
          const targetId = confirmState.goal?.goalId
          if (!targetId) return
          if (confirmState.action === 'restore') restoreMutation.mutate(targetId)
          else archiveMutation.mutate(targetId)
        }}
      />
    </WorkspaceScaffold>
  )
}

export default AdminGoalsPage






