import { apiClient } from '../../../api/client'

export const adminWorkoutApi = {
  getWorkouts() {
    return apiClient.get('/v1/admin/workouts').then((response) => response.data?.data ?? response.data)
  },
  createWorkout(payload) {
    return apiClient.post('/v1/admin/workouts', payload).then((response) => response.data?.data ?? response.data)
  },
  updateWorkout(workoutId, payload) {
    return apiClient.put(`/v1/admin/workouts/${workoutId}`, payload).then((response) => response.data?.data ?? response.data)
  },
  archiveWorkout(workoutId) {
    return apiClient.delete(`/v1/admin/workouts/${workoutId}`).then((response) => response.data?.data ?? response.data)
  },
  restoreWorkout(workoutId) {
    return apiClient.patch(`/v1/admin/workouts/${workoutId}/restore`).then((response) => response.data?.data ?? response.data)
  },
}

