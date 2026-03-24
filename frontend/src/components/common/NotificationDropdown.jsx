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

  const dropdownData = notifData?.data
  const unreadCount = dropdownData?.unreadCount || 0
  const notifications = useMemo(() => dropdownData?.notifications || [], [dropdownData])
  const reminderCenter = useMemo(() => {
    if (dropdownData?.reminderCenter) {
      return dropdownData.reminderCenter
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
  }, [dropdownData, notifications])
  const actionableItems = useMemo(() => reminderCenter?.actionable || [], [reminderCenter])
  const historyItems = useMemo(() => reminderCenter?.history || [], [reminderCenter])
  const previewActionable = useMemo(() => actionableItems.slice(0, 3), [actionableItems])
  const previewHistory = useMemo(() => historyItems.slice(0, 2), [historyItems])

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
        className="relative rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-md transition hover:border-gym-500/30 hover:bg-white/10 hover:text-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gym-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        aria-label="Open notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full border border-slate-950 bg-gym-500 px-1 text-[10px] font-black text-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.3)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 mt-2 w-[24rem] overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(18,18,26,0.94)] shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(18,18,26,0.92)_52%)] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-[1.05rem] font-semibold tracking-tight text-slate-50">Reminder Center</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  {actionableCount > 0
                    ? `${actionableCount} active reminder${actionableCount === 1 ? '' : 's'} waiting for review`
                    : 'No active reminders right now'}
                </p>
              </div>
              {unreadCount > 0 ? (
                <span className="rounded-full border border-gym-500/20 bg-gym-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-gym-300">
                  {unreadCount} unread
                </span>
              ) : null}
            </div>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {totalVisible > 0 ? (
              <div>
                {previewActionable.length > 0 ? (
                  <section className="border-b border-white/10">
                    <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gym-300">
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
                          className="border-t border-white/10 bg-gym-500/10 px-4 py-3 transition hover:bg-gym-500/15"
                        >
                          <div className="flex gap-3">
                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gym-400 to-gym-600 text-xs font-black text-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.22)]">
                              {getNotificationAvatarText(notification)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-5 text-slate-200">
                                <span className="font-semibold text-gym-300">{notification.title}</span>{' '}
                                <span className="text-zinc-400">{notification.message}</span>
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                                <span>{formatNotificationTimestamp(notification.createdAt)}</span>
                                <span>&bull;</span>
                                <span className="font-medium text-gym-300">
                                  {notification.isRead ? 'Handled, kept visible' : 'Needs review'}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                {!notification.isRead ? (
                                  <button
                                    type="button"
                                    onClick={() => markReadMutation.mutate(notification.notificationId)}
                                    className="text-xs font-medium text-gym-300 transition hover:text-gym-200"
                                  >
                                    Mark read
                                  </button>
                                ) : null}
                                {resolveNotificationLink(notification) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenNotification(notification)}
                                    className="text-xs font-medium text-gym-300 transition hover:text-gym-200"
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
                    <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
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
                          className={`border-t border-white/10 px-4 py-3 transition hover:bg-white/5 ${notification.isRead ? 'bg-white/5 opacity-80' : 'bg-[rgba(18,18,26,0.9)]'}`}
                        >
                          <div className="flex gap-3">
                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-xs font-black text-slate-50 shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
                              {getNotificationAvatarText(notification)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-5 text-zinc-400">
                                <span className={notification.isRead ? 'font-medium text-slate-300' : 'font-semibold text-slate-50'}>
                                  {notification.title}
                                </span>{' '}
                                <span className={notification.isRead ? 'text-zinc-500' : 'text-zinc-400'}>
                                  {notification.message}
                                </span>
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                                <span>{formatNotificationTimestamp(notification.createdAt)}</span>
                                <span>&bull;</span>
                                <span className={notification.isRead ? 'font-medium text-zinc-500' : 'font-medium text-gym-300'}>
                                  {notification.isRead ? 'Read' : 'Unread history'}
                                </span>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3">
                                {!notification.isRead ? (
                                  <button
                                    type="button"
                                    onClick={() => markReadMutation.mutate(notification.notificationId)}
                                    className="text-xs font-medium text-gym-300 transition hover:text-gym-200"
                                  >
                                    Mark read
                                  </button>
                                ) : null}
                                {resolveNotificationLink(notification) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenNotification(notification)}
                                    className="text-xs font-medium text-slate-300 transition hover:text-white"
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
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gym-500/20 bg-gym-500/10 text-gym-300 shadow-[0_0_18px_rgba(245,158,11,0.2)]">
                  <Bell size={18} />
                </div>
                <p className="text-sm font-medium text-slate-50">No reminders yet</p>
                <p className="mt-1 text-xs text-zinc-500">Successful actions and coach updates will show up here.</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-4 py-3 text-sm">
            <button
              type="button"
              onClick={handleShowAllNotifications}
              className="font-medium text-gym-300 transition hover:text-gym-200"
            >
              Open reminder center
            </button>
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-2 font-medium text-gym-300 transition hover:text-gym-200 disabled:cursor-not-allowed disabled:text-zinc-500"
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


