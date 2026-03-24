import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { foodApi } from '../../features/content/api/foodApi'
import { workoutApi } from '../../features/content/api/workoutApi'
import { aiApi } from '../../features/content/api/aiApi'
import { coachApi } from '../../features/coach/api/coachApi'

const FOOD_PERSONALIZATION_TAGS = [
  { id: 'HIGH_PROTEIN', label: 'Dam cao' },
  { id: 'LOW_CARB', label: 'Carb thap' },
  { id: 'HIGH_CARB', label: 'Carb cao' },
  { id: 'LOW_FAT', label: 'Beo thap' },
  { id: 'LOW_CALORIE', label: 'It calories' },
  { id: 'BALANCED', label: 'Can bang macro' },
]

const COACH_BOOKING_DAYS = [
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 7, label: 'Sun' },
]

const INPUT_CLASS = 'gc-input'
const TEXTAREA_CLASS = 'gc-textarea'
const SELECT_CLASS = 'gc-select'

function formatDateValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, amount) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

function getNextMondayOnOrAfter(date) {
  const currentDay = date.getDay()
  const daysUntilMonday = (8 - (currentDay === 0 ? 7 : currentDay)) % 7
  return addDays(date, daysUntilMonday)
}

function getMinimumBookingStartDate(baseDate = new Date()) {
  return getNextMondayOnOrAfter(addDays(baseDate, 7))
}

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
    return usedSignals.join(' | ')
  }
  if (fallbackSignals.length) {
    return `Fallback: ${fallbackSignals.join(' | ')}`
  }
  return 'Catalog context'
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
  const [selectedGoalIds, setSelectedGoalIds] = useState(null)
  const [workoutAssistantQuestion, setWorkoutAssistantQuestion] = useState('')
  const [coachAssistantQuestion, setCoachAssistantQuestion] = useState('')
  const minimumBookingStartValue = useMemo(() => formatDateValue(getMinimumBookingStartDate(new Date())), [])
  const [coachAssistantEndDate, setCoachAssistantEndDate] = useState(minimumBookingStartValue)
  const [coachAssistantDraftDay, setCoachAssistantDraftDay] = useState('1')
  const [coachAssistantDraftTimeSlotId, setCoachAssistantDraftTimeSlotId] = useState('')
  const [coachAssistantSlots, setCoachAssistantSlots] = useState([])

  const workoutsQuery = useQuery({
    queryKey: ['content', 'workouts'],
    queryFn: workoutApi.getWorkouts,
  })

  const foodsQuery = useQuery({
    queryKey: ['content', 'foods'],
    queryFn: foodApi.getFoods,
  })

  const timeSlotsQuery = useQuery({
    queryKey: ['coach', 'time-slots'],
    queryFn: coachApi.getTimeSlots,
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
  const timeSlots = useMemo(
    () => timeSlotsQuery.data?.data?.items ?? timeSlotsQuery.data?.items ?? [],
    [timeSlotsQuery.data],
  )
  const fitnessGoals = useMemo(() => fitnessGoalsQuery.data?.items ?? [], [fitnessGoalsQuery.data])
  const persistedGoalIds = useMemo(
    () => (customerGoalsQuery.data?.items ?? []).map((goal) => goal.goalId),
    [customerGoalsQuery.data],
  )
  const selectedGoalIdsState = selectedGoalIds ?? persistedGoalIds
  const savedGoalCodes = useMemo(() => customerGoalsQuery.data?.goalCodes ?? [], [customerGoalsQuery.data])
  const savedRecommendations = useMemo(() => recommendationsMutation.data ?? {}, [recommendationsMutation.data])
  const weeklyPlan = useMemo(() => weeklyPlanMutation.data ?? {}, [weeklyPlanMutation.data])
  const assistantConsoleSummary = useMemo(
    () => [
      {
        id: 'goals',
        label: 'Saved goals',
        value: selectedGoalIdsState.length,
        detail: savedGoalCodes.length ? savedGoalCodes.join(', ') : 'No goals saved yet',
      },
      {
        id: 'plan',
        label: 'Weekly plan',
        value: weeklyPlan.contractVersion ? 'Ready' : 'Draft',
        detail: weeklyPlan.contractVersion ? 'Fresh weekly guidance is ready in the plan panel below.' : 'Build my weekly plan to generate a guided week.',
      },
      {
        id: 'catalog',
        label: 'Knowledge library',
        value: `${workouts.length + foods.length}`,
        detail: `${workouts.length} workouts and ${foods.length} foods ready to explore.`,
      },
    ],
    [foods.length, savedGoalCodes, selectedGoalIdsState.length, weeklyPlan.contractVersion, workouts.length],
  )
  const coachAssistantMatchCount =
    (coachAssistantMutation.data?.fullMatches?.length ?? 0) + (coachAssistantMutation.data?.partialMatches?.length ?? 0)

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
    setSelectedGoalIds((prev) => {
      const source = prev ?? persistedGoalIds
      return source.includes(goalId) ? source.filter((id) => id !== goalId) : [...source, goalId]
    })
  }

  const saveCustomerGoals = () => {
    saveGoalsMutation.mutate(
      { goalIds: selectedGoalIdsState },
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

  const formatCoachAssistantSlotLabel = (slot) => {
    const day = COACH_BOOKING_DAYS.find((item) => item.id === Number(slot?.dayOfWeek))
    const timeSlot = timeSlots.find((item) => String(item.timeSlotId) === String(slot?.timeSlotId))
    if (!timeSlot) {
      return `${day?.label || 'Day'} | Slot ${slot?.timeSlotId || '?'}`
    }
    return `${day?.label || 'Day'} | ${timeSlot.startTime || '--'}-${timeSlot.endTime || '--'}`
  }

  const addCoachAssistantSlot = () => {
    if (!coachAssistantDraftTimeSlotId) return
    const nextSlot = {
      dayOfWeek: Number(coachAssistantDraftDay),
      timeSlotId: Number(coachAssistantDraftTimeSlotId),
    }
    setCoachAssistantSlots((prev) => {
      const exists = prev.some(
        (slot) => slot.dayOfWeek === nextSlot.dayOfWeek && slot.timeSlotId === nextSlot.timeSlotId,
      )
      return exists ? prev : [...prev, nextSlot]
    })
  }

  const removeCoachAssistantSlot = (dayOfWeek, timeSlotId) => {
    setCoachAssistantSlots((prev) =>
      prev.filter((slot) => !(slot.dayOfWeek === dayOfWeek && slot.timeSlotId === timeSlotId)),
    )
  }

  const askCoachAssistant = () => {
    coachAssistantMutation.mutate({
      question: coachAssistantQuestion,
      endDate: coachAssistantEndDate,
      slots: coachAssistantSlots,
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
    if (action?.type === 'open_workout_detail' && action?.workoutId) {
      openWorkoutDetail(action.workoutId)
      return
    }

    if (action?.type === 'open_food_detail' && action?.foodId) {
      openFoodDetail(action.foodId)
      return
    }

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
      <section className="space-y-6">
      <header className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.18),_transparent_34%),linear-gradient(135deg,_rgba(18,18,26,0.98),_rgba(10,10,15,0.92))] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <h2 className="gc-section-kicker">Knowledge & AI</h2>
              <h3 className="mt-3 text-3xl font-bold tracking-tight text-white">One workspace for learning, planning, and AI guidance</h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                Browse the workout and food library, keep your saved goals in sync, and use assistants that turn the same customer context into weekly plans and real PT booking previews.
              </p>
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
                    activeTab === tab.id ? 'bg-gym-500 text-slate-50 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {assistantConsoleSummary.map((item) => (
        <article key={item.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-ambient-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.detail}</p>
              </article>
            ))}
          </div>
        </header>

        <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6 shadow-ambient backdrop-blur-md">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-gym-500/20 bg-gym-500/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gym-400">Saved fitness goals</p>
                  <p className="mt-1 text-sm text-slate-400">Save the goals you care about so workout, food, and PT booking guidance all use the same customer context.</p>
                </div>
                <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveCustomerGoals}
                disabled={saveGoalsMutation.isPending}
                className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:bg-gym-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveGoalsMutation.isPending ? 'Dang luu...' : 'Save my goals'}
              </button>
              <button
                type="button"
                onClick={requestSavedRecommendations}
                disabled={recommendationsMutation.isPending}
                className="rounded-full border border-amber-500/20 bg-white/5 px-4 py-2 text-sm font-semibold text-gym-500 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {recommendationsMutation.isPending ? 'Dang goi y...' : 'Recommend from saved goals'}
              </button>
              <button
                type="button"
                onClick={requestWeeklyPlan}
                disabled={weeklyPlanMutation.isPending}
                className="rounded-full border border-white/10 bg-white/5/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5/20 disabled:cursor-not-allowed disabled:opacity-60"
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
                      selectedGoalIdsState.includes(goal.goalId)
                        ? 'bg-gym-500 text-slate-50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {goal.name}
                  </button>
                ))}
              </div>

              {customerGoalsQuery.isLoading ? <p className="mt-3 text-sm text-slate-400">Loading saved goals...</p> : null}
              {customerGoalsQuery.isError ? <p className="mt-3 text-sm text-rose-600">Could not load saved goals.</p> : null}
              {saveGoalsMutation.isError ? <p className="mt-3 text-sm text-rose-600">Could not save your goals.</p> : null}
              {!customerGoalsQuery.isLoading ? (
                <p className="mt-3 text-sm text-slate-400">
                  Saved goals: {savedGoalCodes.length ? savedGoalCodes.join(', ') : 'none yet'}
                </p>
              ) : null}

              {weeklyPlanMutation.isError ? <p className="mt-3 text-sm text-rose-600">Could not build your weekly plan.</p> : null}
              {recommendationsMutation.isError ? <p className="mt-3 text-sm text-rose-600">Could not load saved-goal recommendations.</p> : null}
            </div>

            <aside className="rounded-3xl border border-white/10 bg-[linear-gradient(145deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.94))] p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Assistant console</p>
              <h3 className="mt-3 text-2xl font-bold">Move from guidance to action faster</h3>
              <p className="mt-3 text-sm leading-7 text-slate-200">
                Use the assistants for quick answers, then jump directly into booking, workout detail, food detail, or your weekly plan without losing context.
              </p>

              <div className="mt-5 grid gap-3">
                <div className="rounded-3xl border border-white/10 bg-white/5/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Workout assistant</p>
                  <p className="mt-2 text-sm text-white">Best when you want a fast workout outline, exercise shortlist, or a starting split before opening detail.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Coach booking assistant</p>
                  <p className="mt-2 text-sm text-white">Best when you already know the days and recurring slots you want, and need a real PT match preview.</p>
                </div>
                <div className="rounded-3xl border border-emerald-300/30 bg-emerald-400/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Current status</p>
                  <p className="mt-2 text-lg font-bold text-white">{coachAssistantMatchCount > 0 ? `${coachAssistantMatchCount} coach options previewed` : 'No PT preview yet'}</p>
                  <p className="mt-2 text-sm text-emerald-50">
                    {coachAssistantMatchCount > 0
                      ? 'Your latest booking assistant response is ready below.'
                      : 'Add recurring slots in the coach booking assistant to preview real PT matches.'}
                  </p>
                </div>
              </div>
            </aside>
          </div>

          {weeklyPlan.contractVersion ? (
            <div className="mt-4 rounded-[1.75rem] border border-white/5 bg-black/30 p-6 shadow-ambient-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Mini weekly plan</p>
                  <h3 className="mt-2 text-lg font-bold text-white">
                    {weeklyPlan.summary?.headline || 'This week guidance'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {weeklyPlan.summary?.coachNote || 'Use this plan as guidance, then move into product flows to act on it.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-xs text-slate-400">
                  <p className="font-semibold text-white">{weeklyPlan.contractVersion}</p>
                  <p className="mt-1">Context: {renderContextSource(weeklyPlan.contextMeta)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
                <div className="grid gap-3 lg:grid-cols-3">
                  {normalizeAiList(weeklyPlan.sections).map((section) => (
                    <article key={section.id} className="rounded-3xl border border-white/5 bg-white/5 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{section.title}</p>
                      <p className="mt-2 text-sm font-semibold text-white">{section.intent || 'Guidance'}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{section.guidance}</p>

                      {normalizeAiList(section.items).length ? (
                        <div className="mt-3 space-y-2">
                          {normalizeAiList(section.items).map((item) => (
                            <div key={`${section.id}-${item.id || item.workoutId || item.foodId || item.name}`} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <p className="text-sm font-semibold text-white">{item.name || item.label}</p>
                              {item.description || item.detail ? (
                                <p className="mt-1 text-xs leading-5 text-slate-400">{item.description || item.detail}</p>
                              ) : null}
                              {normalizeAiList(item.reasons).length ? (
                                <p className="mt-2 text-xs text-slate-400">{normalizeAiList(item.reasons).join(' | ')}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>

                <aside className="space-y-3 rounded-3xl border border-white/5 bg-white/5 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Scope guardrails</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {weeklyPlan.scopeGuardrails?.level || 'guidance-only'}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      {weeklyPlan.scopeGuardrails?.coachDisclaimer || 'Guidance does not replace coach programming.'}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {weeklyPlan.scopeGuardrails?.medicalDisclaimer || 'Guidance does not replace medical advice.'}
                    </p>
                  </div>

                  {normalizeAiList(weeklyPlan.nextActions).length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Next actions</p>
                      <ul className="mt-2 space-y-2 text-sm text-slate-300">
                        {normalizeAiList(weeklyPlan.nextActions).map((action) => (
                          <li key={action.id}>
                            <button
                              type="button"
                              onClick={() => handleAiAction(action)}
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left font-semibold text-slate-300 transition hover:border-gym-500/60 hover:bg-white/5 text-gym-400 transition hover:text-gym-400"
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
            <div className="mt-4 space-y-4 rounded-[1.75rem] border border-white/5 bg-black/30 p-6 shadow-ambient-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Recommendation brief</p>
                  <h3 className="mt-2 text-lg font-bold text-white">
                    {savedRecommendations.summary?.headline || 'Saved-goal recommendations'}
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {savedRecommendations.summary?.rationale || 'Suggestions explain which customer signals informed the list.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-xs text-slate-400">
                  <p className="font-semibold text-white">
                    {savedRecommendations.summary?.focus || 'Current focus'}
                  </p>
                  <p className="mt-1">Source: {savedRecommendations.source || 'REQUEST'}</p>
                  <p className="mt-1">Context: {renderContextSource(savedRecommendations.contextMeta)}</p>
                </div>
              </div>

              {normalizeAiList(savedRecommendations.contextHighlights).length ? (
                <div className="flex flex-wrap gap-2">
                  {normalizeAiList(savedRecommendations.contextHighlights).map((highlight) => (
                    <div key={`${highlight.type}-${highlight.label}`} className="rounded-full border border-white/5 bg-white/5 px-4 py-2 text-sm text-slate-300">
                      <span className="font-semibold text-white">{highlight.label}:</span> {highlight.value}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                {normalizeAiList(savedRecommendations.sections).map((section) => (
                  <article key={section.id} className="rounded-3xl border border-white/5 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{section.title}</p>
                      <span className="text-xs text-slate-400">{section.itemType || 'guidance'}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{section.description}</p>
                    <div className="mt-3 space-y-2">
                      {normalizeAiList(section.items).map((item) => (
                        <div key={`${section.id}-${item.workoutId || item.foodId || item.name}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <p className="text-sm font-semibold text-white">{item.name}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {item.difficulty || (item.calories != null ? `${item.calories} cal` : 'Guidance item')}
                          </p>
                          {normalizeAiList(item.reasons).length ? (
                            <p className="mt-2 text-xs leading-5 text-slate-400">{normalizeAiList(item.reasons).join(' | ')}</p>
                          ) : null}
                          {item.action?.route ? (
                            <button
                              type="button"
                              onClick={() => handleAiAction(item.action)}
                              className="mt-3 rounded-full border border-gym-500/20 bg-gym-500/10 px-3 py-2 text-xs font-semibold text-gym-400 transition hover:bg-gym-500/20"
                            >
                              {item.action.label || 'Open detail'}
                            </button>
                          ) : null}
                        </div>
                      ))}
                      {!normalizeAiList(section.items).length ? (
                        <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                          {section.emptyState || 'No matching guidance yet.'}
                        </p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              {savedRecommendations.summary?.safetyNote ? (
                <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-gym-400">
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
                      className="rounded-full border border-white/5 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-gym-500/60 hover:bg-white/5 text-gym-400 transition hover:text-gym-400"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,_rgba(26,26,36,0.94),_rgba(18,18,26,0.82))] p-5 shadow-ambient-sm backdrop-blur-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Workout assistant</p>
                  <p className="mt-2 text-sm text-slate-400">Ask for a quick split, focus area, or shortlist, then open the suggested workouts directly.</p>
                </div>
                <span className="rounded-full border border-gym-500/20 bg-gym-500/10 px-3 py-1 text-xs font-semibold text-gym-400">Fast guidance</span>
              </div>
              <textarea
                value={workoutAssistantQuestion}
                onChange={(event) => setWorkoutAssistantQuestion(event.target.value)}
                rows={3}
                name="workoutAssistantQuestion"
                placeholder="vd: toi muon lich tap 4 buoi cho muc tieu tang co"
                className={`mt-3 ${TEXTAREA_CLASS} resize-none`}
              />
              <button
                type="button"
                onClick={askWorkoutAssistant}
                disabled={workoutAssistantMutation.isPending}
                className="gc-button-primary mt-3 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {workoutAssistantMutation.isPending ? 'Dang tra loi…' : 'Ask workout assistant'}
              </button>
              {workoutAssistantMutation.data?.answer ? (
                <div className="mt-3 space-y-3 rounded-2xl bg-white/5 p-3">
                  <div className="whitespace-pre-wrap text-sm text-slate-300">{workoutAssistantMutation.data.answer}</div>
                  {normalizeAiList(workoutAssistantMutation.data.workouts).length ? (
                    <div className="flex flex-wrap gap-2">
                      {normalizeAiList(workoutAssistantMutation.data.workouts).map((workout) => (
                        <button
                          key={`assistant-workout-${workout.workoutId}`}
                          type="button"
                          onClick={() =>
                            handleAiAction(
                              workout.action || {
                                route: '/customer/knowledge',
                                type: 'open_workout_detail',
                                workoutId: workout.workoutId,
                              },
                            )}
                          className="rounded-full border border-gym-500/20 bg-white/5 px-3 py-2 text-xs font-semibold text-gym-400 transition hover:bg-gym-500/10"
                        >
                          {workout.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,_rgba(26,26,36,0.94),_rgba(18,18,26,0.82))] p-5 shadow-ambient-sm backdrop-blur-md">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Coach booking assistant</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Share your preferred PT schedule here and the assistant will preview coach matches using the same rules as the booking planner.
                  </p>
                </div>
                <span className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">Real PT preview</span>
              </div>
              <textarea
                value={coachAssistantQuestion}
                onChange={(event) => setCoachAssistantQuestion(event.target.value)}
                rows={3}
                name="coachAssistantQuestion"
                placeholder="vd: toi muon PT buoi toi va uu tien lich on dinh"
                className={`mt-3 ${TEXTAREA_CLASS} resize-none`}
              />
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Booking end date</span>
                  <input
                    type="date"
                    name="coachAssistantEndDate"
                    value={coachAssistantEndDate}
                    min={minimumBookingStartValue}
                    onChange={(event) => setCoachAssistantEndDate(event.target.value)}
                    className={INPUT_CLASS}
                  />
                </label>
                <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm text-slate-400">
                  <p className="font-semibold text-white">Earliest start</p>
                  <p className="mt-1">{minimumBookingStartValue}</p>
                  <p className="mt-2 text-xs">The preview follows the live PT booking rule: at least 7 days of lead time, with the coaching plan starting from the next eligible Monday.</p>
                </div>
              </div>
              <div className="mt-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Weekday</span>
                    <select
                      name="coachAssistantDraftDay"
                      value={coachAssistantDraftDay}
                      onChange={(event) => setCoachAssistantDraftDay(event.target.value)}
                      className={SELECT_CLASS}
                    >
                      {COACH_BOOKING_DAYS.map((day) => (
                        <option key={day.id} value={day.id}>
                          {day.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recurring time slot</span>
                    <select
                      aria-label="Recurring time slot"
                      name="coachAssistantDraftTimeSlotId"
                      value={coachAssistantDraftTimeSlotId}
                      onChange={(event) => setCoachAssistantDraftTimeSlotId(event.target.value)}
                      className={SELECT_CLASS}
                    >
                      <option value="">Select a slot</option>
                      {timeSlots.map((slot) => (
                        <option key={slot.timeSlotId} value={slot.timeSlotId}>
                          {slot.startTime}-{slot.endTime}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={addCoachAssistantSlot}
                    disabled={!coachAssistantDraftTimeSlotId || timeSlotsQuery.isLoading}
                    className="self-end rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Add slot
                  </button>
                </div>
                {timeSlotsQuery.isLoading ? <p className="mt-3 text-sm text-slate-400" aria-live="polite">Loading coach time slots…</p> : null}
                {timeSlotsQuery.isError ? <p className="mt-3 text-sm text-rose-600">Could not load coach time slots.</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {coachAssistantSlots.map((slot) => (
                    <button
                      key={`${slot.dayOfWeek}-${slot.timeSlotId}`}
                      type="button"
                      onClick={() => removeCoachAssistantSlot(slot.dayOfWeek, slot.timeSlotId)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-rose-500/20 hover:text-rose-400"
                    >
                      {`${formatCoachAssistantSlotLabel(slot)} x`}
                    </button>
                  ))}
                  {!coachAssistantSlots.length ? (
                    <p className="text-sm text-slate-400">Add at least one recurring slot so the assistant can run the real PT match preview.</p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={askCoachAssistant}
                disabled={coachAssistantMutation.isPending}
                className="gc-button-secondary mt-3 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {coachAssistantMutation.isPending ? 'Dang tra loi…' : 'Ask coach assistant'}
              </button>
              {coachAssistantMutation.data?.answer ? (
                <div className="mt-3 space-y-3 rounded-2xl bg-white/5 p-3">
                  <div className="whitespace-pre-wrap text-sm text-slate-300">{coachAssistantMutation.data.answer}</div>
                  {coachAssistantMutation.data?.matchStatus === 'READY' ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
                        <p className="font-semibold">Full matches</p>
                        <p className="mt-1 text-2xl font-bold">{coachAssistantMutation.data.fullMatches?.length ?? 0}</p>
                        <p className="mt-2 text-xs">These coaches can cover every requested recurring slot through {coachAssistantMutation.data.toDate}.</p>
                      </div>
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-gym-400">
                        <p className="font-semibold">Partial matches</p>
                        <p className="mt-1 text-2xl font-bold">{coachAssistantMutation.data.partialMatches?.length ?? 0}</p>
                        <p className="mt-2 text-xs">These coaches fit part of the schedule, but some requested slots still conflict with availability or existing bookings.</p>
                      </div>
                    </div>
                  ) : null}
                  {coachAssistantMutation.data?.blockingReason ? (
                    <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                      {coachAssistantMutation.data.blockingReason}
                    </p>
                  ) : null}
                  {coachAssistantMutation.data?.missingFields?.length ? (
                    <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-gym-500">
                      Add the missing booking inputs to run a real PT match preview: {coachAssistantMutation.data.missingFields.join(', ')}.
                    </p>
                  ) : null}
                  {coachAssistantMutation.data?.fullMatches?.length ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Suggested full matches</p>
                      {coachAssistantMutation.data.fullMatches.slice(0, 3).map((coach) => (
                        <div key={`coach-assistant-full-${coach.coachId}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-white">{coach.fullName}</p>
                            <span className="text-xs font-semibold text-emerald-400">
                              {coach.matchedSlots}/{coach.requestedSlots} slots
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleAiAction({ route: '/customer/coach-booking', label: 'Open coach booking' })}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/20"
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
              <label className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 transition-[border-color,background-color,box-shadow] duration-200 ease-out focus-within:border-amber-500/30 focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-500/15">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Search</span>
                <span className="sr-only">Search workouts</span>
                <input
                  type="search"
                  name="workoutSearch"
                  value={workoutSearch}
                  onChange={(event) => setWorkoutSearch(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Push, HIIT, beginner..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
                />
              </label>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300">
                {filteredWorkouts.length} workout(s)
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWorkoutCategoryId('ALL')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  workoutCategoryId === 'ALL' ? 'bg-gym-500 text-slate-50 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/5'
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
                      ? 'bg-gym-500 text-slate-50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {workoutsQuery.isLoading ? <p className="text-sm text-slate-400" aria-live="polite">Loading workouts…</p> : null}
            {workoutsQuery.isError ? <p className="text-sm text-rose-600">Could not load workouts.</p> : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredWorkouts.map((workout) => (
                <button
                  key={workout.workoutId}
                  type="button"
                  onClick={() => openWorkoutDetail(workout.workoutId)}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-black/40">
                    {workout.imageUrl ? (
                      <img
                        src={workout.imageUrl}
                        alt={workout.name}
                        width="480"
                        height="360"
                        loading="lazy"
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
                          className="rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400"
                        >
                          {category.name}
                        </span>
                      ))}
                      {workout.difficulty ? (
                        <span className="rounded-full bg-gym-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gym-400">
                          {workout.difficulty}
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{workout.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-400">{workout.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {selectedWorkoutId ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                {workoutDetailQuery.isLoading ? <p className="text-sm text-slate-400" aria-live="polite">Loading workout details…</p> : null}
                {workoutDetailQuery.isError ? <p className="text-sm text-rose-600">Could not load workout details.</p> : null}
                {workoutDetailQuery.data ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-white">{workoutDetailQuery.data.name}</h3>
                        <p className="mt-1 text-sm text-slate-400">{workoutDetailQuery.data.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedWorkoutId(null)}
                        className="gc-button-secondary px-4 py-2 text-sm font-semibold"
                      >
                        Close
                      </button>
                    </div>

                    {(workoutDetailQuery.data.categories || []).length ? (
                      <div className="flex flex-wrap gap-2">
                        {(workoutDetailQuery.data.categories || []).map((category) => (
                          <span
                            key={`${workoutDetailQuery.data.workoutId}-${category.workoutCategoryId}`}
                            className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-slate-300"
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {toYouTubeEmbedUrl(workoutDetailQuery.data.videoUrl) ? (
                      <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/5">
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

                    <div className="whitespace-pre-wrap rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
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
              <label className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3 transition-[border-color,background-color,box-shadow] duration-200 ease-out focus-within:border-amber-500/30 focus-within:bg-white/[0.07] focus-within:ring-2 focus-within:ring-amber-500/15">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Search</span>
                <span className="sr-only">Search foods</span>
                <input
                  type="search"
                  name="foodSearch"
                  value={foodSearch}
                  onChange={(event) => setFoodSearch(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Chicken, oatmeal..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-400"
                />
              </label>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300">
                {filteredFoods.length} food(s)
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFoodCategoryId('ALL')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  foodCategoryId === 'ALL' ? 'bg-gym-500 text-slate-50 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/5'
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
                      ? 'bg-gym-500 text-slate-50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                      : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="rounded-3xl border border-gym-500/20 bg-gym-500/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gym-400">AI personalized foods</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Chon nhan macro + tra loi nhanh de AI de xuat mon an phu hop tu database.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestPersonalizedFoods}
                  disabled={personalizedFoodMutation.isPending}
                  className="gc-button-primary px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {personalizedFoodMutation.isPending ? 'Dang phan tich…' : 'Goi y Food cho toi'}
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
                        ? 'bg-gym-500 text-slate-50 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Muc tieu</span>
                  <select
                    name="foodAiGoal"
                    value={foodAiAnswers.goal}
                    onChange={(event) => setFoodAiAnswers((prev) => ({ ...prev, goal: event.target.value }))}
                    className={SELECT_CLASS}
                  >
                    <option value="">Chon muc tieu</option>
                    <option value="Giam mo">Giam mo</option>
                    <option value="Tang co">Tang co</option>
                    <option value="Giu dang">Giu dang</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Khung bua an</span>
                  <select
                    name="foodAiMealTime"
                    value={foodAiAnswers.mealTime}
                    onChange={(event) => setFoodAiAnswers((prev) => ({ ...prev, mealTime: event.target.value }))}
                    className={SELECT_CLASS}
                  >
                    <option value="">Chon bua</option>
                    <option value="Truoc tap">Truoc tap</option>
                    <option value="Sau tap">Sau tap</option>
                    <option value="Bua chinh">Bua chinh</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Muon tranh</span>
                  <input
                    name="foodAiAvoid"
                    value={foodAiAnswers.avoid}
                    onChange={(event) => setFoodAiAnswers((prev) => ({ ...prev, avoid: event.target.value }))}
                    placeholder="vd: sua, hai san..."
                    autoComplete="off"
                    className={INPUT_CLASS}
                  />
                </label>
              </div>

              {personalizedFoodMutation.isError ? (
                <p className="mt-3 text-sm text-rose-600">Khong the lay goi y ca nhan hoa luc nay.</p>
              ) : null}

              {personalizedFoodMutation.data?.summary ? (
                <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">
                  {personalizedFoodMutation.data.summary}
                </p>
              ) : null}

              {(personalizedFoodMutation.data?.followUpQuestions || []).length ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Cau hoi goi y tiep</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
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
                      className="rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-gym-500/60 hover:bg-white/5 text-gym-400 transition"
                    >
                      <p className="text-sm font-semibold text-white">{food.name}</p>
                      <p className="mt-1 text-xs text-slate-400">Match score: {food.matchScore ?? '-'}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">{(food.matchReasons || []).join(' | ')}</p>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {foodsQuery.isLoading ? <p className="text-sm text-slate-400" aria-live="polite">Loading foods…</p> : null}
            {foodsQuery.isError ? <p className="text-sm text-rose-600">Could not load foods.</p> : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredFoods.map((food) => (
                <button
                  key={food.foodId}
                  type="button"
                  onClick={() => openFoodDetail(food.foodId)}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-black/40">
                    {food.imageUrl ? (
                      <img
                        src={food.imageUrl}
                        alt={food.name}
                        width="480"
                        height="360"
                        loading="lazy"
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
                          className="rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400"
                        >
                          {category.name}
                        </span>
                      ))}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{food.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-400">{food.description}</p>
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
                  </div>
                </button>
              ))}
            </div>

            {selectedFoodId ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                {foodDetailQuery.isLoading ? <p className="text-sm text-slate-400" aria-live="polite">Loading food details…</p> : null}
                {foodDetailQuery.isError ? <p className="text-sm text-rose-600">Could not load food details.</p> : null}
                {foodDetailQuery.data ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-white">{foodDetailQuery.data.name}</h3>
                        <p className="mt-1 text-sm text-slate-400">{foodDetailQuery.data.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedFoodId(null)}
                        className="gc-button-secondary px-4 py-2 text-sm font-semibold"
                      >
                        Close
                      </button>
                    </div>

                    {(foodDetailQuery.data.categories || []).length ? (
                      <div className="flex flex-wrap gap-2">
                        {(foodDetailQuery.data.categories || []).map((category) => (
                          <span
                            key={`${foodDetailQuery.data.foodId}-${category.foodCategoryId}`}
                            className="rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-slate-300"
                          >
                            {category.name}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Calories</p>
                        <p className="mt-1 font-semibold">{foodDetailQuery.data.calories ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Protein</p>
                        <p className="mt-1 font-semibold">{foodDetailQuery.data.protein ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Carbs</p>
                        <p className="mt-1 font-semibold">{foodDetailQuery.data.carbs ?? '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Fat</p>
                        <p className="mt-1 font-semibold">{foodDetailQuery.data.fat ?? '-'}</p>
                      </div>
                    </div>

                    {foodDetailQuery.data.recipe ? (
                      <div className="whitespace-pre-wrap rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
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
    </WorkspaceScaffold>
  )
}

export default CustomerKnowledgePage






