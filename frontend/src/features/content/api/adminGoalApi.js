import { apiClient } from '../../../api/client'

export const adminGoalApi = {
  getGoals() {
    return apiClient.get('/v1/admin/goals').then((response) => response.data?.data ?? response.data)
  },
  createGoal(payload) {
    return apiClient.post('/v1/admin/goals', payload).then((response) => response.data?.data ?? response.data)
  },
  updateGoal(goalId, payload) {
    return apiClient.put(`/v1/admin/goals/${goalId}`, payload).then((response) => response.data?.data ?? response.data)
  },
  archiveGoal(goalId) {
    return apiClient.delete(`/v1/admin/goals/${goalId}`).then((response) => response.data?.data ?? response.data)
  },
  restoreGoal(goalId) {
    return apiClient.patch(`/v1/admin/goals/${goalId}/restore`).then((response) => response.data?.data ?? response.data)
  },
}


