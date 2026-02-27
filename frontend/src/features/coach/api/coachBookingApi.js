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
  deleteMySession(sessionId) {
    return apiClient.delete(`/v1/coach-booking/my-schedule/sessions/${sessionId}`).then((response) => response.data)
  },
  cancelSession(sessionId, body) {
    return apiClient.patch(`/v1/coach-booking/sessions/${sessionId}/cancel`, body).then((response) => response.data)
  },
  deleteRequest(requestId) {
    return apiClient.patch(`/v1/coach-booking/requests/${requestId}/delete`).then((response) => response.data)
  },
  rescheduleSession(sessionId, payload) {
    return apiClient
      .patch(`/v1/coach-booking/sessions/${sessionId}/reschedule`, payload)
      .then((response) => response.data)
  },
  submitFeedback(payload) {
    return apiClient.post('/v1/coach-booking/feedback', payload).then((response) => response.data)
  },
  // Coach actions
  getPendingRequests() {
    return apiClient.get('/v1/coach/pt-requests').then((response) => response.data)
  },
  getRescheduleRequests() {
    return apiClient.get('/v1/coach/reschedule-requests').then((response) => response.data)
  },
  actionRequest(requestId, action, body) {
    const suffix = action === 'ACCEPT' ? 'approve' : 'deny'
    return apiClient.post(`/v1/coach/pt-requests/${requestId}/${suffix}`, body || {}).then((response) => response.data)
  },
  approveRescheduleRequest(sessionId) {
    return apiClient.post(`/v1/coach/pt-sessions/${sessionId}/reschedule-approve`).then((response) => response.data)
  },
  denyRescheduleRequest(sessionId, body) {
    return apiClient.post(`/v1/coach/pt-sessions/${sessionId}/reschedule-deny`, body || {}).then((response) => response.data)
  },
  // Coach – customers management
  getCoachCustomers() {
    return apiClient.get('/v1/coach/customers').then((response) => response.data)
  },
  getCoachCustomerDetail(customerId) {
    return apiClient.get(`/v1/coach/customers/${customerId}`).then((response) => response.data)
  },
  getCoachCustomerHistory(customerId) {
    return apiClient.get(`/v1/coach/customers/${customerId}/history`).then((response) => response.data)
  },
  updateCustomerProgress(customerId, body) {
    return apiClient.put(`/v1/coach/customers/${customerId}/progress`, body).then((response) => response.data)
  },
  createSessionNote(sessionId, body) {
    return apiClient.post(`/v1/coach/pt-sessions/${sessionId}/notes`, body).then((response) => response.data)
  },
  updateSessionNote(noteId, body) {
    return apiClient.put(`/v1/coach/pt-sessions/notes/${noteId}`, body).then((response) => response.data)
  },
  deleteSession(sessionId) {
    return apiClient.delete(`/v1/coach/pt-sessions/${sessionId}`).then((response) => response.data)
  },
  completeSession(sessionId) {
    return apiClient.post(`/v1/coach/pt-sessions/${sessionId}/complete`).then((response) => response.data)
  },
  // Coach – feedback
  getCoachFeedback() {
    return apiClient.get('/v1/coach/feedback').then((response) => response.data)
  },
  getCoachFeedbackAverage() {
    return apiClient.get('/v1/coach/feedback/average').then((response) => response.data)
  },
  // Admin actions
  adminGetCoaches() {
    return apiClient.get('/v1/admin/coaches').then((response) => response.data)
  },
  adminUpdateCoachProfile(coachId, payload) {
    return apiClient.put(`/v1/admin/coaches/${coachId}`, payload).then((response) => response.data)
  },
  adminGetCoachPerformance(coachId) {
    return apiClient.get(`/v1/admin/coaches/${coachId}/performance`).then((response) => response.data)
  },
  adminGetCoachStudents(coachId) {
    return apiClient.get(`/v1/admin/coaches/${coachId}/students`).then((response) => response.data)
  }
}
