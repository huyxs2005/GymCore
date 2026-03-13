import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { notificationApi } from '../../features/notification/api/notificationApi'
import {
  formatNotificationTimestamp,
  getNotificationAvatarText,
  markAllNotificationsRead,
  resolveNotificationLink,
  updateNotificationCollection,
} from '../../features/notification/notificationUtils'

function normalizeBucket(notification) {
  return String(notification?.reminder?.bucket || '').toUpperCase()
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

function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'dropdown'],
    queryFn: async () => {
      const result = await notificationApi.getNotifications()
      return { ...result, __unreadOnly: false }
    },
    refetchInterval: 30000,
  })

  const unreadCount = notifData?.data?.unreadCount || 0
  const notifications = useMemo(() => notifData?.data?.notifications || [], [notifData?.data?.notifications])
  const reminderCenter = useMemo(() => {
    if (notifData?.data?.reminderCenter) {
      return notifData.data.reminderCenter
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
  }, [notifData?.data?.reminderCenter, notifications])
  const previewActionable = useMemo(
    () => (reminderCenter?.actionable || []).slice(0, 3),
    [reminderCenter?.actionable],
  )
  const previewHistory = useMemo(
    () => (reminderCenter?.history || []).slice(0, 2),
    [reminderCenter?.history],
  )

  const refreshNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markReadMutation = useMutation({
    mutationFn: (notificationId) => notificationApi.markAsRead(notificationId),
    onSuccess: (_, notificationId) => {
      queryClient.setQueryData(['notifications', 'dropdown'], (current) =>
        updateNotificationCollection(current, notificationId, true),
      )
      queryClient.setQueryData(['notifications', 'all'], (current) =>
        updateNotificationCollection(current, notificationId, true),
      )
      refreshNotifications()
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.setQueryData(['notifications', 'dropdown'], (current) => markAllNotificationsRead(current))
      queryClient.setQueryData(['notifications', 'all'], (current) => markAllNotificationsRead(current))
      refreshNotifications()
    },
  })

  function handleOpenNotification(notification) {
    const resolvedLink = resolveNotificationLink(notification)
    if (!resolvedLink) return
    if (!notification.isRead) {
      markReadMutation.mutate(notification.notificationId)
    }
    setIsOpen(false)
    navigate(resolvedLink)
  }

  function jumpToTop() {
    window.scrollTo(0, 0)
  }

  function smoothScrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleShowAllNotifications() {
    setIsOpen(false)
    if (location.pathname === '/notifications') {
      smoothScrollToTop()
      return
    }
    jumpToTop()
    navigate('/notifications')
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const actionableCount = reminderCenter?.counts?.actionable ?? previewActionable.length
  const totalVisible = previewActionable.length + previewHistory.length

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((value) => !value)}
        className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-700 transition hover:border-gym-300 hover:bg-gym-50 hover:text-slate-950 focus:outline-none"
        aria-label="Open notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full border-2 border-white bg-gym-500 px-1 text-[10px] font-black text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 mt-2 w-[24rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
          <div className="border-b border-slate-200 bg-gradient-to-r from-gym-50 via-white to-slate-50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[1.05rem] font-semibold text-slate-900">Reminder Center</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {actionableCount > 0
                    ? `${actionableCount} active reminder${actionableCount === 1 ? '' : 's'} waiting for review`
                    : 'No active reminders right now'}
                </p>
              </div>
              {unreadCount > 0 ? (
                <span className="rounded-full border border-gym-200 bg-gym-100 px-2.5 py-0.5 text-[11px] font-semibold text-gym-800">
                  {unreadCount} unread
                </span>
              ) : null}
            </div>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {totalVisible > 0 ? (
              <div>
                {previewActionable.length > 0 ? (
                  <section className="border-b border-slate-200">
                    <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gym-800">
                      Act now
                    </div>
                    {previewActionable.map((notification) => {
                      const destination = getDestination(notification)
                      return (
                        <article
                          key={notification.notificationId}
                          data-testid={`dropdown-notification-${notification.notificationId}`}
                          data-notification-bucket="actionable"
                          data-notification-tone="primary"
                          className="border-t border-slate-100 bg-gym-50/60 px-4 py-3 transition hover:bg-gym-50"
                        >
                          <div className="flex gap-3">
                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gym-400 to-gym-600 text-xs font-black text-white shadow-sm">
                              {getNotificationAvatarText(notification)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-5 text-slate-700">
                                <span className="font-semibold text-gym-900">{notification.title}</span>{' '}
                                <span className="text-slate-600">{notification.message}</span>
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                <span>{formatNotificationTimestamp(notification.createdAt)}</span>
                                <span>&bull;</span>
                                <span className="font-medium text-amber-700">
                                  {notification.isRead ? 'Handled, kept visible' : 'Needs review'}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                {!notification.isRead ? (
                                  <button
                                    type="button"
                                    onClick={() => markReadMutation.mutate(notification.notificationId)}
                                    className="text-xs font-medium text-gym-700 transition hover:text-gym-800"
                                  >
                                    Mark read
                                  </button>
                                ) : null}
                                {resolveNotificationLink(notification) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenNotification(notification)}
                                    className="text-xs font-medium text-gym-700 transition hover:text-gym-800"
                                  >
                                    {destination?.label || 'Open'}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </section>
                ) : null}

                {previewHistory.length > 0 ? (
                  <section>
                    <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Recent history
                    </div>
                    {previewHistory.map((notification) => {
                      const destination = getDestination(notification)
                      return (
                        <article
                          key={notification.notificationId}
                          data-testid={`dropdown-notification-${notification.notificationId}`}
                          data-notification-bucket="history"
                          data-notification-tone={notification.isRead ? 'muted' : 'secondary'}
                          className={`border-t border-slate-100 px-4 py-3 transition hover:bg-slate-50 ${notification.isRead ? 'bg-slate-50/90 opacity-80' : 'bg-white'}`}
                        >
                          <div className="flex gap-3">
                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-500 text-xs font-black text-white shadow-sm">
                              {getNotificationAvatarText(notification)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-5 text-slate-600">
                                <span className={notification.isRead ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}>
                                  {notification.title}
                                </span>{' '}
                                <span className={notification.isRead ? 'text-slate-500' : 'text-slate-600'}>
                                  {notification.message}
                                </span>
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                                <span>{formatNotificationTimestamp(notification.createdAt)}</span>
                                <span>&bull;</span>
                                <span className={notification.isRead ? 'font-medium text-slate-400' : 'font-medium text-amber-700'}>
                                  {notification.isRead ? 'Read' : 'Unread history'}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                {!notification.isRead ? (
                                  <button
                                    type="button"
                                    onClick={() => markReadMutation.mutate(notification.notificationId)}
                                    className="text-xs font-medium text-gym-700 transition hover:text-gym-800"
                                  >
                                    Mark read
                                  </button>
                                ) : null}
                                {resolveNotificationLink(notification) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenNotification(notification)}
                                    className="text-xs font-medium text-slate-700 transition hover:text-slate-900"
                                  >
                                    {destination?.label || 'Open'}
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </section>
                ) : null}
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gym-200 bg-gym-50 text-gym-700">
                  <Bell size={18} />
                </div>
                <p className="text-sm font-medium text-slate-900">No reminders yet</p>
                <p className="mt-1 text-xs text-slate-500">Successful actions and coach updates will show up here.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-3 text-sm">
            <button
              type="button"
              onClick={handleShowAllNotifications}
              className="font-medium text-gym-700 transition hover:text-gym-800"
            >
              Open reminder center
            </button>
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-2 font-medium text-gym-700 transition hover:text-gym-800 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <CheckCheck size={14} />
              Mark Read
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default NotificationDropdown
