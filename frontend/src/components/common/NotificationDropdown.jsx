import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, ChevronRight } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { notificationApi } from '../../features/notification/api/notificationApi'
import {
  formatNotificationTimestamp,
  getNotificationAvatarText,
  markAllNotificationsRead,
  resolveNotificationLink,
  updateNotificationCollection,
} from '../../features/notification/notificationUtils'

function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const result = await notificationApi.getNotifications({ unreadOnly: true })
      return { ...result, __unreadOnly: true }
    },
    refetchInterval: 30000,
  })

  const unreadCount = notifData?.data?.unreadCount || 0
  const notifications = useMemo(() => notifData?.data?.notifications || [], [notifData?.data?.notifications])
  const previewItems = useMemo(() => notifications.slice(0, 4), [notifications])

  const refreshNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markReadMutation = useMutation({
    mutationFn: (notificationId) => notificationApi.markAsRead(notificationId),
    onSuccess: (_, notificationId) => {
      queryClient.setQueryData(['notifications', 'unread'], (current) =>
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
      queryClient.setQueryData(['notifications', 'unread'], (current) => markAllNotificationsRead(current))
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[1.05rem] font-semibold text-slate-900">Alerts</h3>
              {unreadCount > 0 ? (
                <span className="rounded-full border border-gym-200 bg-gym-100 px-2.5 py-0.5 text-[11px] font-semibold text-gym-800">
                  {unreadCount} unread
                </span>
              ) : null}
            </div>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {previewItems.length > 0 ? (
              previewItems.map((notification) => {
                const isUnread = !notification.isRead
                return (
                  <div
                    key={notification.notificationId}
                    className={`border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 ${isUnread ? 'bg-gym-50/60' : 'bg-white'}`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gym-400 to-gym-600 text-xs font-black text-white shadow-sm">
                        {getNotificationAvatarText(notification)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-5 text-slate-700">
                          <span className={`font-semibold ${isUnread ? 'text-gym-800' : 'text-slate-900'}`}>{notification.title}</span>{' '}
                          <span className="text-slate-600">{notification.message}</span>
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span>{formatNotificationTimestamp(notification.createdAt)}</span>
                          <span>&bull;</span>
                          <span className={`font-medium ${isUnread ? 'text-gym-700' : 'text-slate-400'}`}>
                            {isUnread ? 'Unread' : 'Read'}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
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
                              className="inline-flex items-center gap-1 text-xs font-medium text-gym-700 transition hover:text-gym-800"
                            >
                              Open
                              <ChevronRight size={12} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-gym-200 bg-gym-50 text-gym-700">
                  <Bell size={18} />
                </div>
                <p className="text-sm font-medium text-slate-900">No alerts yet</p>
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
              Show All
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
