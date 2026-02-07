import { apiClient } from '../../../api/client'

export const notificationApi = {
  getNotifications() {
    return apiClient.get('/v1/notifications').then((response) => response.data)
  },
  markAsRead(notificationId) {
    return apiClient.patch(`/v1/notifications/${notificationId}/read`).then((response) => response.data)
  },
}
