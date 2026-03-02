import { apiClient } from '../../../api/client'

export const aiApi = {
  askWorkoutAssistant(payload) {
    return apiClient.post('/v1/ai/workout-assistant', payload).then((response) => response.data)
  },
  getRecommendations(payload) {
    return apiClient.post('/v1/ai/recommendations', payload).then((response) => response.data)
  },
}
