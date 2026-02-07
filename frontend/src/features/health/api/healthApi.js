import { apiClient } from '../../../api/client'

export const healthApi = {
  getCurrent() {
    return apiClient.get('/v1/health/current').then((response) => response.data)
  },
  getHistory() {
    return apiClient.get('/v1/health/history').then((response) => response.data)
  },
  createRecord(payload) {
    return apiClient.post('/v1/health/records', payload).then((response) => response.data)
  },
}
