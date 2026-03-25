import { apiClient } from '../../../api/client'

export const coachCustomerApi = {
  getCustomers() {
    return apiClient.get('/v1/coach/customers').then((response) => response.data)
  },
  getCustomerDetail(customerId) {
    return apiClient.get(`/v1/coach/customers/${customerId}`).then((response) => response.data)
  },
  getCustomerHistory(customerId) {
    return apiClient.get(`/v1/coach/customers/${customerId}/history`).then((response) => response.data)
  },
  updateProgress(customerId, payload) {
    return apiClient.put(`/v1/coach/customers/${customerId}/progress`, payload).then((response) => response.data)
  },
  getFeedback() {
    return apiClient.get('/v1/coach/feedback').then((response) => response.data)
  },
  getAverageRating() {
    return apiClient.get('/v1/coach/feedback/average').then((response) => response.data)
  },
}
