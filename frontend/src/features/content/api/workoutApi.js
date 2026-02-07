import { apiClient } from '../../../api/client'

export const workoutApi = {
  getCategories() {
    return apiClient.get('/v1/workouts/categories').then((response) => response.data)
  },
  getWorkouts() {
    return apiClient.get('/v1/workouts').then((response) => response.data)
  },
  getWorkoutDetail(workoutId) {
    return apiClient.get(`/v1/workouts/${workoutId}`).then((response) => response.data)
  },
}
