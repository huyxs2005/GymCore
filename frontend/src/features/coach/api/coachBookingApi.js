import { apiClient } from '../../../api/client'

export const coachBookingApi = {
  matchCoaches(payload) {
    return apiClient.post('/v1/coach-booking/match', payload).then((response) => response.data)
  },
  createRequest(payload) {
    return apiClient.post('/v1/coach-booking/requests', payload).then((response) => response.data)
  },
  getMySchedule() {
    return apiClient.get('/v1/coach-booking/my-schedule').then((response) => response.data)
  },
  cancelSession(sessionId, payload) {
    return apiClient.patch(`/v1/coach-booking/sessions/${sessionId}/cancel`, payload).then((response) => response.data)
  },
  rescheduleSession(sessionId, payload) {
    return apiClient
      .patch(`/v1/coach-booking/sessions/${sessionId}/reschedule`, payload)
      .then((response) => response.data)
  },
  submitFeedback(payload) {
    return apiClient.post('/v1/coach-booking/feedback', payload).then((response) => response.data)
  },
}
