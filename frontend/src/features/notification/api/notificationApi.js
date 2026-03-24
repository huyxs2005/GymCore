import { apiClient } from '../../../api/client'

function buildNotificationsQuery(options = {}) {
  const params = new URLSearchParams()
  params.set('unreadOnly', options.unreadOnly ? 'true' : 'false')

  const view = typeof options.view === 'string' ? options.view.trim().toLowerCase() : ''
  if (view && view !== 'all') {
    params.set('view', view)
  }

  return params.toString()
}

export const notificationApi = {
  getNotifications(options = {}) {
    return apiClient.get(`/v1/notifications?${buildNotificationsQuery(options)}`).then((response) => response.data)
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


