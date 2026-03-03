import { apiClient } from '../../../api/client'

export const notificationApi = {
  getNotifications(options = {}) {
    const unreadOnly = options.unreadOnly ? 'true' : 'false'
    return apiClient.get(`/v1/notifications?unreadOnly=${unreadOnly}`).then((response) => response.data)
  },
  markAsRead(notificationId) {
    return apiClient.patch(`/v1/notifications/${notificationId}/read`).then((response) => response.data)
  },
  markAsUnread(notificationId) {
    return apiClient.patch(`/v1/notifications/${notificationId}/unread`).then((response) => response.data)
  },
  markAllAsRead() {
    return apiClient.patch('/v1/notifications/read-all').then((response) => response.data)
  },
}
