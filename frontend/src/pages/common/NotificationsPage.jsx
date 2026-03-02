import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, CheckCheck } from 'lucide-react'
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

function NotificationsPage() {
  const [filter, setFilter] = useState('all')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: async () => {
      const result = await notificationApi.getNotifications()
      return { ...result, __unreadOnly: false }
    },
  })

  const unreadCount = data?.data?.unreadCount || 0
  const notifications = useMemo(() => data?.data?.notifications || [], [data?.data?.notifications])

  const refreshNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.setQueryData(['notifications', 'all'], (current) => markAllNotificationsRead(current))
      queryClient.setQueryData(['notifications', 'unread'], (current) => markAllNotificationsRead(current))
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
      queryClient.setQueryData(['notifications', 'unread'], (current) =>
        updateNotificationCollection(current, notificationId, isRead),
      )
      refreshNotifications()
    },
  })

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter((notification) => !notification.isRead)
    }
    return notifications
  }, [filter, notifications])

  const groupedNotifications = useMemo(
    () => groupNotificationsByDay(filteredNotifications),
    [filteredNotifications],
  )

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-gym-50 via-white to-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <div className="border-b border-slate-200 bg-gradient-to-r from-gym-50 via-white to-slate-50 px-6 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
              <p className="mt-1 text-sm text-slate-600">
                Coach actions, payment confirmations, and successful account updates appear here.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`rounded-xl px-4 py-2 text-sm transition ${filter === 'all' ? 'bg-gym-500 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('unread')}
                  className={`rounded-xl px-4 py-2 text-sm transition ${filter === 'unread' ? 'bg-gym-500 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Unread
                </button>
              </div>
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={unreadCount === 0}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-gym-300 hover:text-gym-800 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <CheckCheck size={16} />
                Mark Read
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4 px-6 py-6">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="bg-white">
            {Object.entries(groupedNotifications).map(([label, items]) => (
              <section key={label} className="border-b border-slate-100 last:border-b-0">
                <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-3 text-[1.05rem] font-semibold text-gym-800">
                  {label}
                </div>
                {items.map((notification) => {
                  const isUnread = !notification.isRead
                  return (
                    <div
                      key={notification.notificationId}
                      className={`border-b border-slate-100 px-6 py-5 last:border-b-0 ${isUnread ? 'bg-gym-50/60' : 'bg-slate-50/45'}`}
                    >
                      <div className="flex items-start gap-4">
                        <button
                          type="button"
                          aria-label={notification.isRead ? `Mark ${notification.title} as unread` : `Mark ${notification.title} as read`}
                          onClick={() =>
                            toggleReadMutation.mutate({
                              notificationId: notification.notificationId,
                              isRead: !notification.isRead,
                            })
                          }
                          className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border transition ${
                            isUnread
                              ? 'border-gym-500 bg-white text-gym-600 hover:bg-gym-50'
                              : 'border-slate-300 bg-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {notification.isRead ? <Check size={14} /> : null}
                        </button>
                        <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gym-400 to-gym-600 text-sm font-black text-white shadow-sm">
                          {getNotificationAvatarText(notification)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isUnread ? 'bg-gym-100 text-gym-800' : 'bg-slate-200 text-slate-600'}`}>
                              {isUnread ? 'Unread' : 'Read'}
                            </span>
                          </div>
                          <p className="mt-2 text-[1.05rem] leading-7 text-slate-700">
                            <span className={`${isUnread ? 'font-semibold text-gym-800' : 'font-medium text-slate-800'}`}>
                              {notification.title}
                            </span>{' '}
                            <span className={isUnread ? 'text-slate-700' : 'text-slate-500'}>{notification.message}</span>
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{formatNotificationTimestamp(notification.createdAt)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-4">
                          {resolveNotificationLink(notification) ? (
                            <Link
                              to={resolveNotificationLink(notification)}
                              className="text-sm font-medium text-gym-700 transition hover:text-gym-800"
                            >
                              Open
                            </Link>
                          ) : null}
                          <span className={`text-sm font-medium ${isUnread ? 'text-gym-700' : 'text-slate-500'}`}>
                            {notification.isRead ? 'Marked as read' : 'Pending read'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
        ) : (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gym-200 bg-gym-50 text-gym-700">
              <Bell size={22} />
            </div>
            <p className="text-lg font-medium text-slate-900">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              We will show payment updates, promotion alerts, and PT session activity here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationsPage
