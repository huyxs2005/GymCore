import { apiClient } from '../../../api/client'

export const adminFoodCategoryApi = {
  getFoodCategories() {
    return apiClient.get('/v1/admin/food-categories').then((response) => response.data?.data ?? response.data)
  },
  createFoodCategory(payload) {
    return apiClient.post('/v1/admin/food-categories', payload).then((response) => response.data?.data ?? response.data)
  },
  updateFoodCategory(foodCategoryId, payload) {
    return apiClient.put(`/v1/admin/food-categories/${foodCategoryId}`, payload).then((response) => response.data?.data ?? response.data)
  },
  archiveFoodCategory(foodCategoryId) {
    return apiClient.delete(`/v1/admin/food-categories/${foodCategoryId}`).then((response) => response.data?.data ?? response.data)
  },
  restoreFoodCategory(foodCategoryId) {
    return apiClient.patch(`/v1/admin/food-categories/${foodCategoryId}/restore`).then((response) => response.data?.data ?? response.data)
  },
}

