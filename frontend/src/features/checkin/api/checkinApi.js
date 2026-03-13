import { apiClient } from '../../../api/client'

export const checkinApi = {
  getQrToken() {
    return apiClient.get('/v1/checkin/qr').then((response) => response.data)
  },
  getHistory() {
    return apiClient.get('/v1/checkin/history').then((response) => response.data)
  },
  getUtilitySnapshot() {
    return Promise.all([this.getQrToken(), this.getHistory()]).then(([qr, history]) => ({
      qr,
      history,
    }))
  },
  getCoachNotes() {
    return apiClient.get('/v1/health/coach-notes').then((response) => response.data)
  },
}
