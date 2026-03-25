import { apiClient } from '../../../api/client'

export const coachApi = {
  getTimeSlots() {
    return apiClient.get('/v1/time-slots').then((response) => response.data)
  },
  getCoaches() {
    return apiClient.get('/v1/coaches').then((response) => response.data)
  },
  getCoachById(coachId) {
    return apiClient.get(`/v1/coaches/${coachId}`).then((response) => response.data)
  },
  getCoachSchedule(coachId) {
    return apiClient.get(`/v1/coaches/${coachId}/schedule`).then((response) => response.data)
  },
  getMyCoachSchedule() {
    return apiClient.get('/v1/coach/schedule').then((response) => response.data)
  },
  getMyAvailability() {
    return apiClient.get('/v1/coach/availability').then((response) => response.data)
  },
  updateAvailability(payload) {
    return apiClient.put('/v1/coach/availability', payload).then((response) => response.data)
  },
}
