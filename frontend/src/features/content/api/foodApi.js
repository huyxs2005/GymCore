import { apiClient } from '../../../api/client'

export const foodApi = {
  getCategories() {
    return apiClient.get('/v1/foods/categories').then((response) => response.data)
  },
  getFoods() {
    return apiClient.get('/v1/foods').then((response) => response.data)
  },
  getFoodDetail(foodId) {
    return apiClient.get(`/v1/foods/${foodId}`).then((response) => response.data)
  },
}
