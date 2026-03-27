import { apiClient } from '../../../api/client'

export const aiApi = {
  getFitnessGoals() {
    return apiClient.get('/v1/goals').then((response) => response.data?.data ?? response.data)
  },
  getCustomerGoals() {
    return apiClient.get('/v1/customer/goals').then((response) => response.data?.data ?? response.data)
  },
  updateCustomerGoals(payload) {
    return apiClient.put('/v1/customer/goals', payload).then((response) => response.data?.data ?? response.data)
  },
  askWorkoutAssistant(payload) {
    return apiClient.post('/v1/ai/workout-assistant', payload).then((response) => response.data?.data ?? response.data)
  },
  askFoodAssistant(payload) {
    return apiClient.post('/v1/ai/food-assistant', payload).then((response) => response.data?.data ?? response.data)
  },
  askCoachBookingAssistant(payload) {
    return apiClient.post('/v1/ai/coach-booking-assistant', payload).then((response) => response.data?.data ?? response.data)
  },
  getRecommendations(payload) {
    return apiClient.post('/v1/ai/recommendations', payload).then((response) => response.data?.data ?? response.data)
  },
  getWeeklyPlan(payload) {
    return apiClient.post('/v1/ai/weekly-plan', payload).then((response) => response.data?.data ?? response.data)
  },
  getPersonalizedFoodRecommendations(payload) {
    return apiClient.post('/v1/ai/food-personalized', payload).then((response) => response.data?.data ?? response.data)
  },
}
