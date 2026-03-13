import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { foodApi } from '../../features/content/api/foodApi'
import { workoutApi } from '../../features/content/api/workoutApi'
import AiChatWidget from '../../components/common/AiChatWidget'
import { aiApi } from '../../features/content/api/aiApi'

const FOOD_PERSONALIZATION_TAGS = [
  { id: 'HIGH_PROTEIN', label: 'Dam cao' },
  { id: 'LOW_CARB', label: 'Carb thap' },
  { id: 'HIGH_CARB', label: 'Carb cao' },
  { id: 'LOW_FAT', label: 'Beo thap' },
  { id: 'LOW_CALORIE', label: 'It calories' },
  { id: 'BALANCED', label: 'Can bang macro' },
]

function toYouTubeEmbedUrl(rawUrl) {
  if (!rawUrl) return null
  const trimmed = String(rawUrl).trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    const host = url.hostname.replace(/^www\./, '').toLowerCase()
    const withParams = (base) => {
      const embed = new URL(base)
      embed.searchParams.set('rel', '0')
      embed.searchParams.set('playsinline', '1')
      if (typeof window !== 'undefined' && window.location?.origin) {
        embed.searchParams.set('origin', window.location.origin)
      }
      return embed.toString()
    }
    if (host === 'youtu.be') {
      const id = url.pathname.replace('/', '').trim()
      return id ? withParams(`https://www.youtube-nocookie.com/embed/${id}`) : null
    }

    if (host.endsWith('youtube.com')) {
      const path = url.pathname || ''
      if (path.startsWith('/embed/')) {
        const id = path.replace('/embed/', '').split('/')[0]?.trim()
        return id ? withParams(`https://www.youtube-nocookie.com/embed/${id}`) : null
      }
      if (path.startsWith('/shorts/')) {
        const id = path.replace('/shorts/', '').split('/')[0]?.trim()
        return id ? withParams(`https://www.youtube-nocookie.com/embed/${id}`) : null
      }
      if (path === '/watch') {
        const id = (url.searchParams.get('v') || '').trim()
        return id ? withParams(`https://www.youtube-nocookie.com/embed/${id}`) : null
      }
    }
    return null
  } catch {
    return null
  }
}

function normalizeAiList(items) {
  return Array.isArray(items) ? items.filter(Boolean) : []
}

function renderContextSource(contextMeta = {}) {
  const usedSignals = normalizeAiList(contextMeta.usedSignals)
  const fallbackSignals = normalizeAiList(contextMeta.fallbackSignals)
  if (usedSignals.length) {
    return usedSignals.join(' • ')
  }
  if (fallbackSignals.length) {
    return `Fallback: ${fallbackSignals.join(' • ')}`
  }
  return 'Catalog context'
}

function normalizeActionList(...groups) {
  const deduped = new Map()
  groups.flat().forEach((action) => {
    if (!action?.route || !action?.label) return
    deduped.set(action.id || action.route, action)
  })
  return Array.from(deduped.values())
}

function CustomerKnowledgePage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('WORKOUTS')

  const [workoutCategoryId, setWorkoutCategoryId] = useState('ALL')
  const [workoutSearch, setWorkoutSearch] = useState('')
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null)

  const [foodCategoryId, setFoodCategoryId] = useState('ALL')
  const [foodSearch, setFoodSearch] = useState('')
  const [selectedFoodId, setSelectedFoodId] = useState(null)
  const [selectedFoodTags, setSelectedFoodTags] = useState([])
  const [foodAiAnswers, setFoodAiAnswers] = useState({
    goal: '',
    mealTime: '',
    avoid: '',
  })
  const [selectedGoalIds, setSelectedGoalIds] = useState([])
  const [workoutAssistantQuestion, setWorkoutAssistantQuestion] = useState('')
  const [coachAssistantQuestion, setCoachAssistantQuestion] = useState('')

  const workoutsQuery = useQuery({
    queryKey: ['content', 'workouts'],
    queryFn: workoutApi.getWorkouts,
  })

  const foodsQuery = useQuery({
    queryKey: ['content', 'foods'],
    queryFn: foodApi.getFoods,
  })

  const workoutDetailQuery = useQuery({
    queryKey: ['content', 'workout', selectedWorkoutId],
    queryFn: () => workoutApi.getWorkoutDetail(selectedWorkoutId),
    enabled: Boolean(selectedWorkoutId),
  })

  const foodDetailQuery = useQuery({
    queryKey: ['content', 'food', selectedFoodId],
    queryFn: () => foodApi.getFoodDetail(selectedFoodId),
    enabled: Boolean(selectedFoodId),
  })

  const personalizedFoodMutation = useMutation({
    mutationFn: aiApi.getPersonalizedFoodRecommendations,
  })

  const fitnessGoalsQuery = useQuery({
    queryKey: ['content', 'fitness-goals'],
    queryFn: aiApi.getFitnessGoals,
  })

  const customerGoalsQuery = useQuery({
    queryKey: ['content', 'customer-goals'],
    queryFn: aiApi.getCustomerGoals,
  })

  const saveGoalsMutation = useMutation({
    mutationFn: aiApi.updateCustomerGoals,
  })

  const recommendationsMutation = useMutation({
    mutationFn: aiApi.getRecommendations,
  })

  const weeklyPlanMutation = useMutation({
    mutationFn: aiApi.getWeeklyPlan,
  })

  const workoutAssistantMutation = useMutation({
    mutationFn: aiApi.askWorkoutAssistant,
  })

  const coachAssistantMutation = useMutation({
    mutationFn: aiApi.askCoachBookingAssistant,
  })

  const workouts = useMemo(() => workoutsQuery.data?.items ?? [], [workoutsQuery.data])
  const workoutCategories = useMemo(() => workoutsQuery.data?.categories ?? [], [workoutsQuery.data])
  const foods = useMemo(() => foodsQuery.data?.items ?? [], [foodsQuery.data])
  const foodCategories = useMemo(() => foodsQuery.data?.categories ?? [], [foodsQuery.data])
  const fitnessGoals = useMemo(() => fitnessGoalsQuery.data?.items ?? [], [fitnessGoalsQuery.data])
  const savedGoalCodes = useMemo(() => customerGoalsQuery.data?.goalCodes ?? [], [customerGoalsQuery.data])
  const savedRecommendations = useMemo(() => recommendationsMutation.data ?? {}, [recommendationsMutation.data])
  const weeklyPlan = useMemo(() => weeklyPlanMutation.data ?? {}, [weeklyPlanMutation.data])

  useEffect(() => {
    const goalIds = (customerGoalsQuery.data?.items ?? []).map((goal) => goal.goalId)
    setSelectedGoalIds(goalIds)
  }, [customerGoalsQuery.data])

  const normalizedWorkoutSearch = workoutSearch.trim().toLowerCase()
  const filteredWorkouts = useMemo(() => {
    return workouts.filter((workout) => {
      const categoryMatch =
        workoutCategoryId === 'ALL' ||
        (workout.categories || []).some((category) => String(category.workoutCategoryId) === String(workoutCategoryId))
      if (!categoryMatch) return false
      if (!normalizedWorkoutSearch) return true
      const haystack = [workout.name, workout.description, workout.difficulty, ...(workout.categories || []).map((c) => c.name)]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedWorkoutSearch)
    })
  }, [normalizedWorkoutSearch, workoutCategoryId, workouts])

  const normalizedFoodSearch = foodSearch.trim().toLowerCase()
  const filteredFoods = useMemo(() => {
    return foods.filter((food) => {
      const categoryMatch =
        foodCategoryId === 'ALL' ||
        (food.categories || []).some((category) => String(category.foodCategoryId) === String(foodCategoryId))
      if (!categoryMatch) return false
      if (!normalizedFoodSearch) return true
      const haystack = [food.name, food.description, ...(food.categories || []).map((c) => c.name)].join(' ').toLowerCase()
      return haystack.includes(normalizedFoodSearch)
    })
  }, [foodCategoryId, foods, normalizedFoodSearch])

  const personalizedFoods = useMemo(
    () => personalizedFoodMutation.data?.foods ?? [],
    [personalizedFoodMutation.data],
  )
  const widgetQuickActions = useMemo(
    () =>
      normalizeActionList(
        weeklyPlan.nextActions,
        savedRecommendations.nextActions,
        workoutAssistantMutation.data?.workouts?.map((workout) => workout?.action),
        selectedWorkoutId
          ? [
              {
                id: 'knowledge-selected-workout',
                label: 'Open workout detail',
                route: `/customer/knowledge/workouts/${selectedWorkoutId}`,
                type: 'route',
                workoutId: selectedWorkoutId,
              },
            ]
          : [],
        selectedFoodId
          ? [
              {
                id: 'knowledge-selected-food',
                label: 'Open food detail',
                route: `/customer/knowledge/foods/${selectedFoodId}`,
                type: 'route',
                foodId: selectedFoodId,
              },
            ]
          : [],
      ),
    [
      weeklyPlan.nextActions,
      savedRecommendations.nextActions,
      workoutAssistantMutation.data?.workouts,
      selectedWorkoutId,
      selectedFoodId,
    ],
  )

  const toggleFoodTag = (tagId) => {
    setSelectedFoodTags((prev) =>
      prev.includes(tagId) ? prev.filter((item) => item !== tagId) : [...prev, tagId],
    )
  }

  const requestPersonalizedFoods = () => {
    personalizedFoodMutation.mutate({
      tags: selectedFoodTags,
      answers: foodAiAnswers,
      limitFoods: 6,
    })
  }

  const toggleSavedGoal = (goalId) => {
    setSelectedGoalIds((prev) => (prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId]))
  }

  const saveCustomerGoals = () => {
    saveGoalsMutation.mutate(
      { goalIds: selectedGoalIds },
      {
        onSuccess: () => customerGoalsQuery.refetch(),
      },
    )
  }

  const requestSavedRecommendations = () => {
    recommendationsMutation.mutate({
      limitWorkouts: 4,
      limitFoods: 4,
    })
  }

  const requestWeeklyPlan = () => {
    weeklyPlanMutation.mutate({
      workoutLimit: 3,
      foodLimit: 3,
    })
  }

  const askWorkoutAssistant = () => {
    workoutAssistantMutation.mutate({
      question: workoutAssistantQuestion,
      limitWorkouts: 4,
    })
  }

  const askCoachAssistant = () => {
    coachAssistantMutation.mutate({
      question: coachAssistantQuestion,
    })
  }

  const openWorkoutDetail = (workoutId) => {
    setActiveTab('WORKOUTS')
    setSelectedWorkoutId(workoutId)
  }

  const openFoodDetail = (foodId) => {
    setActiveTab('FOODS')
    setSelectedFoodId(foodId)
  }

  const handleAiAction = (action) => {
    const route = String(action?.route || '').trim()
    if (!route) return

    const workoutMatch = route.match(/^\/customer\/knowledge\/workouts\/(\d+)$/)
    if (workoutMatch) {
      openWorkoutDetail(Number(workoutMatch[1]))
      return
    }

    const foodMatch = route.match(/^\/customer\/knowledge\/foods\/(\d+)$/)
    if (foodMatch) {
      openFoodDetail(Number(foodMatch[1]))
      return
    }

    if (route === '/customer/knowledge') {
      navigate(route)
      return
    }

    navigate(route)
  }

  return (
    <WorkspaceScaffold
      title="Customer Workout/Food/AI"
      subtitle="Browse workouts + foods and request goal-based recommendations."
      links={customerNav}
    >
      <section className="gc-card-compact space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="gc-section-kicker">Knowledge & AI</h2>
            <p className="mt-1 text-sm text-slate-500">Workouts, foods, and goal-based recommendations.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'WORKOUTS', label: 'Workouts' },
              { id: 'FOODS', label: 'Foods' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id ? 'bg-gym-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        <div className="rounded-3xl border border-amber-100 bg-amber-50/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Saved fitness goals</p>
              <p className="mt-1 text-sm text-slate-600">Luu goal vao profile de AI workout, food, va booking assistant dung chung mot ngu canh.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveCustomerGoals}
                disabled={saveGoalsMutation.isPending}
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveGoalsMutation.isPending ? 'Dang luu...' : 'Save my goals'}
              </button>
              <button
                type="button"
                onClick={requestSavedRecommendations}
                disabled={recommendationsMutation.isPending}
                className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {recommendationsMutation.isPending ? 'Dang goi y...' : 'Recommend from saved goals'}
              </button>
              <button
                type="button"
                onClick={requestWeeklyPlan}
                disabled={weeklyPlanMutation.isPending}
                className="rounded-full border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {weeklyPlanMutation.isPending ? 'Dang lap ke hoach...' : 'Build my weekly plan'}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {fitnessGoals.map((goal) => (
              <button
                key={goal.goalId}
                type="button"
                onClick={() => toggleSavedGoal(goal.goalId)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  selectedGoalIds.includes(goal.goalId)
                    ? 'bg-amber-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {goal.name}
              </button>
            ))}
          </div>

          {customerGoalsQuery.isLoading ? <p className="mt-3 text-sm text-slate-500">Loading saved goals...</p> : null}
          {customerGoalsQuery.isError ? <p className="mt-3 text-sm text-rose-600">Could not load saved goals.</p> : null}
          {saveGoalsMutation.isError ? <p className="mt-3 text-sm text-rose-600">Could not save your goals.</p> : null}
          {!customerGoalsQuery.isLoading ? (
            <p className="mt-3 text-sm text-slate-600">
              Saved goals: {savedGoalCodes.length ? savedGoalCodes.join(', ') : 'none yet'}
            </p>
          ) : null}

          {weeklyPlanMutation.isError ? <p className="mt-3 text-sm text-rose-600">Could not build your weekly plan.</p> : null}
          {recommendationsMutation.isError ? <p className="mt-3 text-sm text-rose-600">Could not load saved-goal recommendations.</p> : null}

          {weeklyPlan.contractVersion ? (
            <div className="mt-4 rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Mini weekly plan</p>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">
                    {weeklyPlan.summary?.headline || 'This week guidance'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {weeklyPlan.summary?.coachNote || 'Use this plan as guidance, then move into product flows to act on it.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-900">{weeklyPlan.contractVersion}</p>
                  <p className="mt-1">Context: {renderContextSource(weeklyPlan.contextMeta)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                <div className="grid gap-3 lg:grid-cols-3">
                  {normalizeAiList(weeklyPlan.sections).map((section) => (
                    <article key={section.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{section.title}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{section.intent || 'Guidance'}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{section.guidance}</p>

                      {normalizeAiList(section.items).length ? (
                        <div className="mt-3 space-y-2">
                          {normalizeAiList(section.items).map((item) => (
                            <div key={`${section.id}-${item.id || item.workoutId || item.foodId || item.name}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                              <p className="text-sm font-semibold text-slate-900">{item.name || item.label}</p>
                              {item.description || item.detail ? (
                                <p className="mt-1 text-xs leading-5 text-slate-600">{item.description || item.detail}</p>
                              ) : null}
                              {normalizeAiList(item.reasons).length ? (
                                <p className="mt-2 text-xs text-slate-500">{normalizeAiList(item.reasons).join(' • ')}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>

                <aside className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Scope guardrails</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {weeklyPlan.scopeGuardrails?.level || 'guidance-only'}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {weeklyPlan.scopeGuardrails?.coachDisclaimer || 'Guidance does not replace coach programming.'}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {weeklyPlan.scopeGuardrails?.medicalDisclaimer || 'Guidance does not replace medical advice.'}
                    </p>
                  </div>

                  {normalizeAiList(weeklyPlan.nextActions).length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Next actions</p>
                      <ul className="mt-2 space-y-2 text-sm text-slate-700">
                        {normalizeAiList(weeklyPlan.nextActions).map((action) => (
                          <li key={action.id}>
                            <button
                              type="button"
                              onClick={() => handleAiAction(action)}
                              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-700 transition hover:border-gym-300 hover:text-gym-700"
                            >
                              {action.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </aside>
              </div>
            </div>
          ) : null}

          {(savedRecommendations.workouts?.length || savedRecommendations.foods?.length) ? (
            <div className="mt-4 space-y-4 rounded-[28px] border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Recommendation brief</p>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">
                    {savedRecommendations.summary?.headline || 'Saved-goal recommendations'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {savedRecommendations.summary?.rationale || 'Suggestions explain which customer signals informed the list.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-900">
                    {savedRecommendations.summary?.focus || 'Current focus'}
                  </p>
                  <p className="mt-1">Source: {savedRecommendations.source || 'REQUEST'}</p>
                  <p className="mt-1">Context: {renderContextSource(savedRecommendations.contextMeta)}</p>
                </div>
              </div>

              {normalizeAiList(savedRecommendations.contextHighlights).length ? (
                <div className="flex flex-wrap gap-2">
                  {normalizeAiList(savedRecommendations.contextHighlights).map((highlight) => (
                    <div key={`${highlight.type}-${highlight.label}`} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                      <span className="font-semibold text-slate-900">{highlight.label}:</span> {highlight.value}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                {normalizeAiList(savedRecommendations.sections).map((section) => (
                  <article key={section.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                      <span className="text-xs text-slate-500">{section.itemType || 'guidance'}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{section.description}</p>
                    <div className="mt-3 space-y-2">
                      {normalizeAiList(section.items).map((item) => (
                        <div key={`${section.id}-${item.workoutId || item.foodId || item.name}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.difficulty || (item.calories != null ? `${item.calories} cal` : 'Guidance item')}
                          </p>
                          {normalizeAiList(item.reasons).length ? (
                            <p className="mt-2 text-xs leading-5 text-slate-600">{normalizeAiList(item.reasons).join(' • ')}</p>
                          ) : null}
                          {item.action?.route ? (
                            <button
                              type="button"
                              onClick={() => handleAiAction(item.action)}
                              className="mt-3 rounded-full border border-gym-200 bg-gym-50 px-3 py-2 text-xs font-semibold text-gym-700 transition hover:bg-gym-100"
                            >
                              {item.action.label || 'Open detail'}
                            </button>
                          ) : null}
                        </div>
                      ))}
                      {!normalizeAiList(section.items).length ? (
                        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                          {section.emptyState || 'No matching guidance yet.'}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              {savedRecommendations.summary?.safetyNote ? (
                <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {savedRecommendations.summary.safetyNote}
                </p>
              ) : null}

              {normalizeAiList(savedRecommendations.nextActions).length ? (
                <div className="flex flex-wrap gap-2">
                  {normalizeAiList(savedRecommendations.nextActions).map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleAiAction(action)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-gym-300 hover:text-gym-700"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Workout assistant</p>
              <textarea
                value={workoutAssistantQuestion}
                onChange={(event) => setWorkoutAssistantQuestion(event.target.value)}
                rows={3}
                placeholder="vd: toi muon lich tap 4 buoi cho muc tieu tang co"
                className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-gym-300 focus:ring-2 focus:ring-gym-100"
              />
              <button
                type="button"
                onClick={askWorkoutAssistant}
                disabled={workoutAssistantMutation.isPending}
                className="mt-3 rounded-full bg-gym-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gym-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {workoutAssistantMutation.isPending ? 'Dang tra loi...' : 'Ask workout assistant'}
              </button>
              {workoutAssistantMutation.data?.answer ? (
                <div className="mt-3 space-y-3 rounded-2xl bg-slate-50 p-3">
                  <div className="whitespace-pre-wrap text-sm text-slate-700">{workoutAssistantMutation.data.answer}</div>
                  {normalizeAiList(workoutAssistantMutation.data.workouts).length ? (
                    <div className="flex flex-wrap gap-2">
                      {normalizeAiList(workoutAssistantMutation.data.workouts).map((workout) => (
                        <button
                          key={`assistant-workout-${workout.workoutId}`}
                          type="button"
                          onClick={() => handleAiAction(workout.action || { route: `/customer/knowledge/workouts/${workout.workoutId}` })}
                          className="rounded-full border border-gym-200 bg-white px-3 py-2 text-xs font-semibold text-gym-700 transition hover:bg-gym-50"
                        >
                          {workout.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Coach booking assistant</p>
              <textarea
                value={coachAssistantQuestion}
                onChange={(event) => setCoachAssistantQuestion(event.target.value)}
                rows={3}
                placeholder="vd: toi muon PT buoi toi va uu tien lich on dinh"
                className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-gym-300 focus:ring-2 focus:ring-gym-100"
              />
              <button
                type="button"
                onClick={askCoachAssistant}
                disabled={coachAssistantMutation.isPending}
                className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {coachAssistantMutation.isPending ? 'Dang tra loi...' : 'Ask coach assistant'}
              </button>
              {coachAssistantMutation.data?.answer ? (
                <div className="mt-3 space-y-3 rounded-2xl bg-slate-50 p-3">
                  <div className="whitespace-pre-wrap text-sm text-slate-700">{coachAssistantMutation.data.answer}</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAiAction({ route: '/customer/coach-booking', label: 'Open coach booking' })}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
                    >
                      Open coach booking
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {activeTab === 'WORKOUTS' ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Search</span>
                <input
                  type="text"
                  value={workoutSearch}
                  onChange={(event) => setWorkoutSearch(event.target.value)}
                  placeholder="Push, HIIT, beginner..."
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </label>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                {filteredWorkouts.length} workout(s)
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWorkoutCategoryId('ALL')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  workoutCategoryId === 'ALL' ? 'bg-gym-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                All
              </button>
              {workoutCategories.map((category) => (
                <button
                  key={category.workoutCategoryId}
                  type="button"
                  onClick={() => setWorkoutCategoryId(String(category.workoutCategoryId))}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    String(workoutCategoryId) === String(category.workoutCategoryId)
                      ? 'bg-gym-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {workoutsQuery.isLoading ? <p className="text-sm text-slate-500">Loading workouts...</p> : null}
            {workoutsQuery.isError ? <p className="text-sm text-rose-600">Could not load workouts.</p> : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredWorkouts.map((workout) => (
                <button
                  key={workout.workoutId}
                  type="button"
                  onClick={() => openWorkoutDetail(workout.workoutId)}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    {workout.imageUrl ? (
                      <img
                        src={workout.imageUrl}
                        alt={workout.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap gap-2">
                      {(workout.categories || []).map((category) => (
                        <span
                          key={`${workout.workoutId}-${category.workoutCategoryId}`}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600"
                        >
                          {category.name}
                        </span>
                      ))}
                      {workout.difficulty ? (
                        <span className="rounded-full bg-gym-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gym-700">
                          {workout.difficulty}
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{workout.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{workout.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {selectedWorkoutId ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                {workoutDetailQuery.isLoading ? <p className="text-sm text-slate-500">Loading workout details...</p> : null}
                {workoutDetailQuery.isError ? <p className="text-sm text-rose-600">Could not load workout details.</p> : null}
                {workoutDetailQuery.data ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{workoutDetailQuery.data.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{workoutDetailQuery.data.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedWorkoutId(null)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Close
                      </button>
                    </div>

                    {(workoutDetailQuery.data.categories || []).length ? (
                      <div className="flex flex-wrap gap-2">
                        {(workoutDetailQuery.data.categories || []).map((category) => (
                          <span
                            key={`${workoutDetailQuery.data.workoutId}-${category.workoutCategoryId}`}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {toYouTubeEmbedUrl(workoutDetailQuery.data.videoUrl) ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <div className="aspect-video w-full">
                          <iframe
                            title={`${workoutDetailQuery.data.name} video`}
                            src={toYouTubeEmbedUrl(workoutDetailQuery.data.videoUrl)}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            referrerPolicy="strict-origin-when-cross-origin"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      {workoutDetailQuery.data.instructions}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'FOODS' ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Search</span>
                <input
                  type="text"
                  value={foodSearch}
                  onChange={(event) => setFoodSearch(event.target.value)}
                  placeholder="Chicken, oatmeal..."
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
              </label>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                {filteredFoods.length} food(s)
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFoodCategoryId('ALL')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  foodCategoryId === 'ALL' ? 'bg-gym-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                All
              </button>
              {foodCategories.map((category) => (
                <button
                  key={category.foodCategoryId}
                  type="button"
                  onClick={() => setFoodCategoryId(String(category.foodCategoryId))}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    String(foodCategoryId) === String(category.foodCategoryId)
                      ? 'bg-gym-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="rounded-3xl border border-gym-100 bg-gym-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gym-700">AI personalized foods</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Chon nhan macro + tra loi nhanh de AI de xuat mon an phu hop tu database.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestPersonalizedFoods}
                  disabled={personalizedFoodMutation.isPending}
                  className="rounded-full bg-gym-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gym-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {personalizedFoodMutation.isPending ? 'Dang phan tich...' : 'Goi y Food cho toi'}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {FOOD_PERSONALIZATION_TAGS.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleFoodTag(tag.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      selectedFoodTags.includes(tag.id)
                        ? 'bg-gym-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Muc tieu</span>
                  <select
                    value={foodAiAnswers.goal}
                    onChange={(event) => setFoodAiAnswers((prev) => ({ ...prev, goal: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gym-500"
                  >
                    <option value="">Chon muc tieu</option>
                    <option value="Giam mo">Giam mo</option>
                    <option value="Tang co">Tang co</option>
                    <option value="Giu dang">Giu dang</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Khung bua an</span>
                  <select
                    value={foodAiAnswers.mealTime}
                    onChange={(event) => setFoodAiAnswers((prev) => ({ ...prev, mealTime: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-gym-500"
                  >
                    <option value="">Chon bua</option>
                    <option value="Truoc tap">Truoc tap</option>
                    <option value="Sau tap">Sau tap</option>
                    <option value="Bua chinh">Bua chinh</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Muon tranh</span>
                  <input
                    value={foodAiAnswers.avoid}
                    onChange={(event) => setFoodAiAnswers((prev) => ({ ...prev, avoid: event.target.value }))}
                    placeholder="vd: sua, hai san..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-gym-500"
                  />
                </label>
              </div>

              {personalizedFoodMutation.isError ? (
                <p className="mt-3 text-sm text-rose-600">Khong the lay goi y ca nhan hoa luc nay.</p>
              ) : null}

              {personalizedFoodMutation.data?.summary ? (
                <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                  {personalizedFoodMutation.data.summary}
                </p>
              ) : null}

              {(personalizedFoodMutation.data?.followUpQuestions || []).length ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Cau hoi goi y tiep</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {(personalizedFoodMutation.data?.followUpQuestions || []).map((question) => (
                      <li key={question.id}>- {question.question}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {personalizedFoods.length ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {personalizedFoods.map((food) => (
                    <button
                      key={`ai-food-${food.foodId}`}
                      type="button"
                      onClick={() => openFoodDetail(food.foodId)}
                      className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-gym-300"
                    >
                      <p className="text-sm font-semibold text-slate-900">{food.name}</p>
                      <p className="mt-1 text-xs text-slate-500">Match score: {food.matchScore ?? '-'}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{(food.matchReasons || []).join(' • ')}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {foodsQuery.isLoading ? <p className="text-sm text-slate-500">Loading foods...</p> : null}
            {foodsQuery.isError ? <p className="text-sm text-rose-600">Could not load foods.</p> : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredFoods.map((food) => (
                <button
                  key={food.foodId}
                  type="button"
                  onClick={() => openFoodDetail(food.foodId)}
                  className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                    {food.imageUrl ? (
                      <img
                        src={food.imageUrl}
                        alt={food.name}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap gap-2">
                      {(food.categories || []).map((category) => (
                        <span
                          key={`${food.foodId}-${category.foodCategoryId}`}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600"
                        >
                          {category.name}
                        </span>
                      ))}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{food.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{food.description}</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700">
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
                  </div>
                </button>
              ))}
            </div>

            {selectedFoodId ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                {foodDetailQuery.isLoading ? <p className="text-sm text-slate-500">Loading food details...</p> : null}
                {foodDetailQuery.isError ? <p className="text-sm text-rose-600">Could not load food details.</p> : null}
                {foodDetailQuery.data ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{foodDetailQuery.data.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{foodDetailQuery.data.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFoodId(null)}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Close
                      </button>
                    </div>

                    {(foodDetailQuery.data.categories || []).length ? (
                      <div className="flex flex-wrap gap-2">
                        {(foodDetailQuery.data.categories || []).map((category) => (
                          <span
                            key={`${foodDetailQuery.data.foodId}-${category.foodCategoryId}`}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Calories</p>
                        <p className="mt-1 font-semibold">{foodDetailQuery.data.calories ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Protein</p>
                        <p className="mt-1 font-semibold">{foodDetailQuery.data.protein ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Carbs</p>
                        <p className="mt-1 font-semibold">{foodDetailQuery.data.carbs ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Fat</p>
                        <p className="mt-1 font-semibold">{foodDetailQuery.data.fat ?? '-'}</p>
                      </div>
                    </div>

                    {foodDetailQuery.data.recipe ? (
                      <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                        {foodDetailQuery.data.recipe}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <AiChatWidget
        context={{
          mode: activeTab,
          selectedWorkout: workoutDetailQuery.data
            ? {
                workoutId: workoutDetailQuery.data.workoutId,
                name: workoutDetailQuery.data.name,
                description: workoutDetailQuery.data.description,
                instructions: workoutDetailQuery.data.instructions,
                videoUrl: workoutDetailQuery.data.videoUrl,
              }
            : null,
          selectedFood: foodDetailQuery.data
            ? {
                foodId: foodDetailQuery.data.foodId,
                name: foodDetailQuery.data.name,
                description: foodDetailQuery.data.description,
                recipe: foodDetailQuery.data.recipe,
                calories: foodDetailQuery.data.calories,
                protein: foodDetailQuery.data.protein,
                carbs: foodDetailQuery.data.carbs,
                fat: foodDetailQuery.data.fat,
              }
            : null,
        }}
        quickActions={widgetQuickActions}
        onAction={handleAiAction}
      />
    </WorkspaceScaffold>
  )
}

export default CustomerKnowledgePage
