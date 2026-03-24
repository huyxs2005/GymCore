function normalizeDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatNotificationTimestamp(value) {
  const date = normalizeDate(value)
  if (!date) return 'Unknown time'

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.round((today - target) / 86400000)
  const timeLabel = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

  if (dayDiff === 0) return `Today at ${timeLabel}`
  if (dayDiff === 1) return `Yesterday at ${timeLabel}`
  if (dayDiff > 1 && dayDiff < 7) {
    const weekday = date.toLocaleDateString([], { weekday: 'long' })
    return `${weekday} at ${timeLabel}`
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function getNotificationGroupLabel(value) {
  const date = normalizeDate(value)
  if (!date) return 'Earlier'

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDiff = Math.round((today - target) / 86400000)

  if (dayDiff === 0) return 'Today'
  if (dayDiff === 1) return 'Yesterday'
  if (dayDiff > 1 && dayDiff < 7) {
    return date.toLocaleDateString([], { weekday: 'long' })
  }

  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

export function groupNotificationsByDay(notifications) {
  return notifications.reduce((groups, notification) => {
    const label = getNotificationGroupLabel(notification.createdAt)
    if (!groups[label]) {
      groups[label] = []
    }
    groups[label].push(notification)
    return groups
  }, {})
}

export function getNotificationAvatarText(notification) {
  const source = `${notification?.title || ''} ${notification?.type || ''}`.trim()
  if (!source) return 'AL'
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function resolveNotificationLink(notification) {
  const rawLink = String(notification?.linkUrl || '').trim()
  const type = String(notification?.type || '').toUpperCase()
  if (rawLink === '/coach/schedule' && type.startsWith('PT_')) {
    return '/coach/schedule?tab=schedule'
  }
  return rawLink
}

export function updateNotificationCollection(data, notificationId, nextIsRead) {
  if (!data?.data?.notifications) return data

  const notifications = data.data.notifications
    .map((notification) =>
      notification.notificationId === notificationId
        ? { ...notification, isRead: nextIsRead }
        : notification,
    )
    .filter((notification) => !(data.__unreadOnly && notification.isRead))

  const unreadCount = Math.max(
    0,
    notifications.reduce((count, notification) => count + (notification.isRead ? 0 : 1), 0),
  )

  return {
    ...data,
    data: {
      ...data.data,
      notifications,
      unreadCount,
    },
  }
}

export function markAllNotificationsRead(data) {
  if (!data?.data?.notifications) return data

  if (data.__unreadOnly) {
    return {
      ...data,
      data: {
        ...data.data,
        notifications: [],
        unreadCount: 0,
      },
    }
  }

  return {
    ...data,
    data: {
      ...data.data,
      notifications: data.data.notifications.map((notification) => ({
        ...notification,
        isRead: true,
      })),
      unreadCount: 0,
    },
  }
}


