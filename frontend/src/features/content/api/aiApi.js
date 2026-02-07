import { apiClient } from '../../../api/client'

export const aiApi = {
  askWorkoutAssistant(payload) {
    return apiClient.post('/v1/ai/workout-assistant', payload).then((response) => response.data)
  },
  assistCoachBooking(payload) {
    return apiClient.post('/v1/ai/coach-booking-assistant', payload).then((response) => response.data)
  },
}
