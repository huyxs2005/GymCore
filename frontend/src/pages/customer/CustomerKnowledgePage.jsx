import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import WorkspaceScaffold from '../../components/frame/WorkspaceScaffold'
import { customerNav } from '../../config/navigation'
import { foodApi } from '../../features/content/api/foodApi'
import { workoutApi } from '../../features/content/api/workoutApi'
import AiChatWidget from '../../components/common/AiChatWidget'

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

function CustomerKnowledgePage() {
  const [activeTab, setActiveTab] = useState('WORKOUTS')

  const [workoutCategoryId, setWorkoutCategoryId] = useState('ALL')
  const [workoutSearch, setWorkoutSearch] = useState('')
  const [selectedWorkoutId, setSelectedWorkoutId] = useState(null)

  const [foodCategoryId, setFoodCategoryId] = useState('ALL')
  const [foodSearch, setFoodSearch] = useState('')
  const [selectedFoodId, setSelectedFoodId] = useState(null)

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

  const workouts = useMemo(() => workoutsQuery.data?.items ?? [], [workoutsQuery.data])
  const workoutCategories = useMemo(() => workoutsQuery.data?.categories ?? [], [workoutsQuery.data])
  const foods = useMemo(() => foodsQuery.data?.items ?? [], [foodsQuery.data])
  const foodCategories = useMemo(() => foodsQuery.data?.categories ?? [], [foodsQuery.data])

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
                  onClick={() => setSelectedWorkoutId(workout.workoutId)}
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

            {foodsQuery.isLoading ? <p className="text-sm text-slate-500">Loading foods...</p> : null}
            {foodsQuery.isError ? <p className="text-sm text-rose-600">Could not load foods.</p> : null}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredFoods.map((food) => (
                <button
                  key={food.foodId}
                  type="button"
                  onClick={() => setSelectedFoodId(food.foodId)}
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
      />
    </WorkspaceScaffold>
  )
}

export default CustomerKnowledgePage
