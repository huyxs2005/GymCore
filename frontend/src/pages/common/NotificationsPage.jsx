import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { Link } from 'react-router-dom'
import { notificationApi } from '../../features/notification/api/notificationApi'
import {
  formatNotificationTimestamp,
  getNotificationAvatarText,
  groupNotificationsByDay,
  markAllNotificationsRead,
  resolveNotificationLink,
  updateNotificationCollection,
} from '../../features/notification/notificationUtils'

function normalizeCategory(notification) {
  return String(notification?.reminder?.category || 'general')
    .toLowerCase()
    .replace(/_/g, ' ')
}

function getDestination(notification) {
  return notification?.reminder?.destination || null
}

function NotificationRow({
  notification,
  checked,
  onToggleChecked,
  onToggleRead,
}) {
  const destination = getDestination(notification)
  const link = resolveNotificationLink(notification)

  return (
    <div className="flex items-start gap-4 px-5 py-5">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggleChecked(notification.notificationId)}
        className="mt-2 h-4 w-4 rounded border border-white/15 bg-transparent accent-[#0ea773]"
      />

      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-black text-slate-100">
        {getNotificationAvatarText(notification)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[1.02rem] leading-7 text-slate-200">
              <span className="font-bold text-slate-50">{notification.title}</span>{' '}
              <span className="text-slate-300">{notification.message}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span>{formatNotificationTimestamp(notification.createdAt)}</span>
              <span className="text-slate-500">•</span>
              <span className={notification.isRead ? 'text-slate-500' : 'text-[#0ea773]'}>
                {notification.isRead ? 'Read' : 'Unread'}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {normalizeCategory(notification)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4 text-sm">
            <button
              type="button"
              onClick={() => onToggleRead(notification)}
              className="font-medium text-slate-300 transition hover:text-[#0ea773]"
            >
              {notification.isRead ? 'Mark unread' : 'Mark read'}
            </button>
            {link ? (
              <Link to={link} className="font-medium text-slate-300 transition hover:text-[#0ea773]">
                {destination?.label || 'Open'}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function NotificationsPage() {
  const [filter, setFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: async () => {
      const result = await notificationApi.getNotifications()
      return { ...result, __unreadOnly: false }
    },
  })

  const notificationData = data?.data
  const notifications = useMemo(() => notificationData?.notifications || [], [notificationData])
  const unreadCount = notificationData?.unreadCount || 0

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((notification) => !notification.isRead)
    }
    return notifications
  }, [filter, notifications])

  const groupedNotifications = useMemo(() => groupNotificationsByDay(filteredNotifications), [filteredNotifications])
  const visibleNotificationIds = useMemo(
    () => filteredNotifications.map((notification) => notification.notificationId),
    [filteredNotifications],
  )

  const allVisibleSelected =
    visibleNotificationIds.length > 0 && visibleNotificationIds.every((notificationId) => selectedIds.includes(notificationId))

  const refreshNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.setQueryData(['notifications', 'all'], (current) => markAllNotificationsRead(current))
      refreshNotifications()
    },
  })

  const toggleReadMutation = useMutation({
    mutationFn: ({ notificationId, isRead }) =>
      isRead ? notificationApi.markAsRead(notificationId) : notificationApi.markAsUnread(notificationId),
    onSuccess: (_, { notificationId, isRead }) => {
      queryClient.setQueryData(['notifications', 'all'], (current) =>
        updateNotificationCollection(current, notificationId, isRead),
      )
      refreshNotifications()
    },
  })

  const bulkActionMutation = useMutation({
    mutationFn: async ({ notificationIds, isRead }) => {
      await Promise.all(
        notificationIds.map((notificationId) =>
          isRead ? notificationApi.markAsRead(notificationId) : notificationApi.markAsUnread(notificationId),
        ),
      )
      return { notificationIds, isRead }
    },
    onSuccess: ({ notificationIds, isRead }) => {
      notificationIds.forEach((notificationId) => {
        queryClient.setQueryData(['notifications', 'all'], (current) =>
          updateNotificationCollection(current, notificationId, isRead),
        )
      })
      setSelectedIds([])
      refreshNotifications()
    },
  })

  function toggleSelection(notificationId) {
    setSelectedIds((prev) =>
      prev.includes(notificationId) ? prev.filter((id) => id !== notificationId) : [...prev, notificationId],
    )
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (allVisibleSelected ? prev.filter((id) => !visibleNotificationIds.includes(id)) : Array.from(new Set([...prev, ...visibleNotificationIds]))))
  }

  function handleBulkAction(action) {
    if (!action || selectedIds.length === 0) return
    bulkActionMutation.mutate({
      notificationIds: selectedIds,
      isRead: action === 'read',
    })
  }

  function handleToggleRead(notification) {
    toggleReadMutation.mutate({
      notificationId: notification.notificationId,
      isRead: !notification.isRead,
    })
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#17171d] px-0 py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-4 px-1 text-slate-100">
          <div className="flex flex-wrap items-center">
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{ backgroundColor: '#1c1c26' }}
              className={`min-w-12 rounded-l-[4px] border border-white/15 px-4 py-2 text-sm leading-none transition ${filter === 'all' ? 'text-[#0ea773]' : 'text-slate-300 hover:text-[#0ea773]'}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              style={{ backgroundColor: '#1c1c26' }}
              className={`min-w-16 rounded-r-[4px] border border-l-0 border-white/15 px-4 py-2 text-sm leading-none transition ${filter === 'unread' ? 'text-[#0ea773]' : 'text-slate-300 hover:text-[#0ea773]'}`}
            >
              Unread
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[2px] border border-white/10 bg-[#1b1b22] text-slate-100 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">

          {isLoading ? (
            <div className="space-y-3 px-4 py-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-20 animate-pulse border border-white/10 bg-white/5" />
              ))}
            </div>
          ) : filteredNotifications.length > 0 ? (
            <>
              <div>
                {Object.entries(groupedNotifications).map(([label, items]) => (
                  <section key={label} className="border-b border-white/10 last:border-b-0">
                    <div className="flex items-center gap-3 border-b border-white/10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={items.every((notification) => selectedIds.includes(notification.notificationId))}
                        onChange={() => {
                          const ids = items.map((notification) => notification.notificationId)
                          const allSelected = ids.every((id) => selectedIds.includes(id))
                          setSelectedIds((prev) =>
                            allSelected ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids])),
                          )
                        }}
                        className="h-4 w-4 rounded border border-white/15 bg-transparent accent-[#0ea773]"
                      />
                      <h2 className="text-[1.05rem] font-medium text-[#8ed8f0]">{label}</h2>
                    </div>

                    {items.map((notification) => (
                      <div key={notification.notificationId} className="border-b border-white/10 last:border-b-0">
                        <NotificationRow
                          notification={notification}
                          checked={selectedIds.includes(notification.notificationId)}
                          onToggleChecked={toggleSelection}
                          onToggleRead={handleToggleRead}
                        />
                      </div>
                    ))}
                  </section>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 px-4 py-3 text-sm text-slate-300">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border border-white/15 bg-transparent accent-[#0ea773]"
                  />
                  <span>Select all</span>
                </label>

                <div className="flex items-center gap-2">
                  <span>With selected...</span>
                  <button
                    type="button"
                    onClick={() => handleBulkAction('read')}
                    disabled={selectedIds.length === 0 || bulkActionMutation.isPending}
                    className="rounded-[4px] border border-white/15 bg-[#2a2a31] px-3 py-2 text-sm text-slate-300 transition hover:text-[#0ea773] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mark read
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkAction('unread')}
                    disabled={selectedIds.length === 0 || bulkActionMutation.isPending}
                    className="rounded-[4px] border border-white/15 bg-[#2a2a31] px-3 py-2 text-sm text-slate-300 transition hover:text-[#0ea773] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mark unread
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300">
                <Bell size={20} />
              </div>
              <p className="text-lg font-medium text-slate-100">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NotificationsPage
