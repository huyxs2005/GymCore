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

function normalizeBucket(notification) {
  return String(notification?.reminder?.bucket || '').toUpperCase()
}

function normalizeCategory(notification) {
  return String(notification?.reminder?.category || 'general')
    .toLowerCase()
    .replace(/_/g, ' ')
}

function getDestination(notification) {
  return notification?.reminder?.destination || null
}

function partitionReminderCenter(notifications) {
  return notifications.reduce(
    (groups, notification) => {
      if (normalizeBucket(notification) === 'ACTIONABLE') {
        groups.actionable.push(notification)
      } else {
        groups.history.push(notification)
      }
      return groups
    },
    { actionable: [], history: [] },
  )
}

function NotificationToggle({ notification, toggleReadMutation }) {
  return (
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
        notification.isRead
          ? 'border-slate-300 bg-slate-200 text-slate-500 hover:bg-slate-100'
          : 'border-gym-500 bg-white text-gym-600 hover:bg-gym-50'
      }`}
    >
      {notification.isRead ? <Check size={14} /> : null}
    </button>
  )
}

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

  const notificationData = data?.data
  const unreadCount = notificationData?.unreadCount || 0
  const notifications = useMemo(() => notificationData?.notifications || [], [notificationData])
  const reminderCenter = useMemo(() => {
    if (notificationData?.reminderCenter) {
      return notificationData.reminderCenter
    }
    const fallback = partitionReminderCenter(notifications)
    return {
      ...fallback,
      counts: {
        total: notifications.length,
        actionable: fallback.actionable.length,
        history: fallback.history.length,
      },
    }
  }, [notificationData, notifications])

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

  const actionableNotifications = useMemo(() => reminderCenter?.actionable || [], [reminderCenter])
  const historyNotifications = useMemo(() => reminderCenter?.history || [], [reminderCenter])

  const filteredHistoryNotifications = useMemo(() => {
    if (filter === 'actionable') {
      return []
    }
    if (filter === 'history-unread') {
      return historyNotifications.filter((notification) => !notification.isRead)
    }
    return historyNotifications
  }, [filter, historyNotifications])

  const groupedNotifications = useMemo(
    () => groupNotificationsByDay(filteredHistoryNotifications),
    [filteredHistoryNotifications],
  )

  const showActionableSection = filter !== 'history-unread'
  const showHistorySection = filter !== 'actionable'
  const totalCount = reminderCenter?.counts?.total ?? notifications.length
  const actionableCount = reminderCenter?.counts?.actionable ?? actionableNotifications.length
  const historyCount = reminderCenter?.counts?.history ?? historyNotifications.length

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-b from-gym-50 via-white to-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <div className="border-b border-slate-200 bg-gradient-to-r from-gym-50 via-white to-slate-50 px-6 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Reminder Center</h1>
              <p className="mt-1 text-sm text-slate-600">
                Handle urgent reminders first, then keep the quieter record of what you have already handled.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`rounded-xl px-4 py-2 text-sm transition ${filter === 'all' ? 'bg-gym-500 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All activity
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('actionable')}
                  className={`rounded-xl px-4 py-2 text-sm transition ${filter === 'actionable' ? 'bg-gym-500 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Actionable reminders
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('history-unread')}
                  className={`rounded-xl px-4 py-2 text-sm transition ${filter === 'history-unread' ? 'bg-gym-500 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Unread history
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
        ) : totalCount > 0 ? (
          <div className="space-y-8 bg-white px-6 py-6">
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-gym-200 bg-gym-50/80 p-5">
                <p className="text-sm font-medium text-gym-700">Actionable reminders</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{actionableCount}</p>
                <p className="mt-2 text-sm text-slate-600">Direct next steps stay at the top until you handle them.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50/90 p-5">
                <p className="text-sm font-medium text-slate-700">Unread items</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{unreadCount}</p>
                <p className="mt-2 text-sm text-slate-600">Keep an eye on what still needs your attention.</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-medium text-slate-700">History kept visible</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{historyCount}</p>
                <p className="mt-2 text-sm text-slate-600">Read items stay searchable without competing with live reminders.</p>
              </div>
            </section>

            {showActionableSection ? (
              <section aria-labelledby="actionable-reminders-heading" className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 id="actionable-reminders-heading" className="text-xl font-semibold text-slate-900">
                      Act now
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Urgent reminders stay separated from quieter account history.
                    </p>
                  </div>
                  <span className="rounded-full border border-gym-200 bg-gym-100 px-3 py-1 text-xs font-semibold text-gym-800">
                    {actionableCount} active
                  </span>
                </div>

                {actionableNotifications.length > 0 ? (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {actionableNotifications.map((notification) => {
                      const destination = getDestination(notification)
                      const link = resolveNotificationLink(notification)
                      return (
                        <article
                          key={notification.notificationId}
                          data-testid={`page-notification-${notification.notificationId}`}
                          data-notification-bucket="actionable"
                          data-notification-tone="primary"
                          className="rounded-3xl border border-gym-200 bg-gradient-to-br from-gym-50 via-white to-gym-100/50 p-5 shadow-sm shadow-gym-900/5"
                        >
                          <div className="flex items-start gap-4">
                            <NotificationToggle notification={notification} toggleReadMutation={toggleReadMutation} />
                            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gym-400 to-gym-600 text-sm font-black text-white shadow-sm">
                              {getNotificationAvatarText(notification)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-gym-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gym-800">
                                  {normalizeCategory(notification)}
                                </span>
                                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${notification.isRead ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                                  {notification.isRead ? 'Handled, keep visible' : 'Needs review'}
                                </span>
                              </div>
                              <h3 className="mt-3 text-lg font-semibold text-slate-900">{notification.title}</h3>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{notification.message}</p>
                              <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                                {formatNotificationTimestamp(notification.createdAt)}
                              </p>
                              <div className="mt-4 flex flex-wrap items-center gap-3">
                                {link ? (
                                  <Link
                                    to={link}
                                    className="inline-flex items-center rounded-full bg-gym-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gym-700"
                                  >
                                    {destination?.label || 'Open'}
                                  </Link>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleReadMutation.mutate({
                                      notificationId: notification.notificationId,
                                      isRead: !notification.isRead,
                                    })
                                  }
                                  className="text-sm font-medium text-gym-700 transition hover:text-gym-800"
                                >
                                  {notification.isRead ? 'Keep as unread reminder' : 'Mark reminder read'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                    <p className="text-base font-medium text-slate-900">No active reminders right now.</p>
                    <p className="mt-2 text-sm text-slate-500">You are caught up. Your read history stays below for reference.</p>
                  </div>
                )}
              </section>
            ) : null}

            {showHistorySection ? (
              <section aria-labelledby="notification-history-heading" className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 id="notification-history-heading" className="text-xl font-semibold text-slate-900">
                      History
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Read items stay visible with quieter styling so they do not crowd live reminders.
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {filteredHistoryNotifications.length} shown
                  </span>
                </div>

                {filteredHistoryNotifications.length > 0 ? (
                  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50/60">
                    {Object.entries(groupedNotifications).map(([label, items]) => (
                      <section key={label} className="border-b border-slate-200 last:border-b-0">
                        <div className="border-b border-slate-200 bg-slate-100/90 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
                          {label}
                        </div>
                        {items.map((notification) => {
                          const destination = getDestination(notification)
                          return (
                            <div
                              key={notification.notificationId}
                              data-testid={`page-notification-${notification.notificationId}`}
                              data-notification-bucket="history"
                              data-notification-tone={notification.isRead ? 'muted' : 'secondary'}
                              className={`border-b border-slate-200 px-6 py-5 last:border-b-0 ${notification.isRead ? 'bg-slate-50/80 opacity-80' : 'bg-white'}`}
                            >
                              <div className="flex items-start gap-4">
                                <NotificationToggle notification={notification} toggleReadMutation={toggleReadMutation} />
                                <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-sm font-black text-white shadow-sm">
                                  {getNotificationAvatarText(notification)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${notification.isRead ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                                      {notification.isRead ? 'Read' : 'Unread history'}
                                    </span>
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                                      {normalizeCategory(notification)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-[1.02rem] leading-7 text-slate-600">
                                    <span className={`${notification.isRead ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>
                                      {notification.title}
                                    </span>{' '}
                                    <span className={notification.isRead ? 'text-slate-500' : 'text-slate-600'}>{notification.message}</span>
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">{formatNotificationTimestamp(notification.createdAt)}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-4">
                                  {resolveNotificationLink(notification) ? (
                                    <Link
                                      to={resolveNotificationLink(notification)}
                                      className="text-sm font-medium text-slate-700 transition hover:text-slate-900"
                                    >
                                      {destination?.label || 'Open'}
                                    </Link>
                                  ) : null}
                                  <span className={`text-sm font-medium ${notification.isRead ? 'text-slate-500' : 'text-amber-700'}`}>
                                    {notification.isRead ? 'Already handled' : 'Still unread'}
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
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                    <p className="text-base font-medium text-slate-900">
                      {filter === 'history-unread' ? 'No unread history items' : 'No notification history yet'}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Payment updates, completed actions, and older reminders will stay here once they arrive.
                    </p>
                  </div>
                )}
              </section>
            ) : null}
          </div>
        ) : (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gym-200 bg-gym-50 text-gym-700">
              <Bell size={22} />
            </div>
            <p className="text-lg font-medium text-slate-900">
              {filter === 'history-unread' ? 'No unread notification history' : 'No notifications yet'}
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
