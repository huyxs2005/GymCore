import { apiClient } from '../../../api/client'

export const receptionCheckinApi = {
  scan(payload) {
    return apiClient.post('/v1/reception/checkin/scan', payload).then((response) => response.data)
  },
  validateMembership(customerId) {
    return apiClient.get(`/v1/reception/checkin/${customerId}/validity`).then((response) => response.data)
  },
  getHistory() {
    return apiClient.get('/v1/reception/checkin/history').then((response) => response.data)
  },
}
