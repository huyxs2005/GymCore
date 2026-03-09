import { apiClient } from '../../../api/client'

export const adminFoodApi = {
  getFoods() {
    return apiClient.get('/v1/admin/foods').then((response) => response.data?.data ?? response.data)
  },
  createFood(payload) {
    return apiClient.post('/v1/admin/foods', payload).then((response) => response.data?.data ?? response.data)
  },
  updateFood(foodId, payload) {
    return apiClient.put(`/v1/admin/foods/${foodId}`, payload).then((response) => response.data?.data ?? response.data)
  },
  archiveFood(foodId) {
    return apiClient.delete(`/v1/admin/foods/${foodId}`).then((response) => response.data?.data ?? response.data)
  },
  restoreFood(foodId) {
    return apiClient.patch(`/v1/admin/foods/${foodId}/restore`).then((response) => response.data?.data ?? response.data)
  },
}

