import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '../../features/notification/api/notificationApi'
import { Bell, Check, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

const NotificationDropdown = () => {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)
    const queryClient = useQueryClient()

    const { data: notifData } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => notificationApi.getNotifications(),
        refetchInterval: 30000, // Refetch every 30 seconds
    })

    const markReadMutation = useMutation({
        mutationFn: (id) => notificationApi.markAsRead(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
        },
    })

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const notifications = notifData?.data?.notifications || []
    const unreadCount = notifData?.data?.unreadCount || 0

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 overflow-hidden transform transition-all animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-bold text-slate-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <span className="text-xs font-medium text-gym-600 bg-gym-50 px-2 py-0.5 rounded-full">
                                {unreadCount} New
                            </span>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map((notif) => (
                                <div
                                    key={notif.NotificationID}
                                    className={`p-4 border-b border-slate-50 transition-colors hover:bg-slate-50 relative group ${!notif.IsRead ? 'bg-gym-50/20' : ''
                                        }`}
                                >
                                    <div className="flex gap-3">
                                        <div className="flex-1">
                                            <p className={`text-sm ${!notif.IsRead ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                                                {notif.Title}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{notif.Message}</p>
                                            <div className="flex items-center justify-between mt-2">
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(notif.CreatedAt).toLocaleDateString()}
                                                </span>
                                                {notif.LinkUrl && (
                                                    <Link
                                                        to={notif.LinkUrl}
                                                        onClick={() => setIsOpen(false)}
                                                        className="text-[10px] font-bold text-gym-600 hover:text-gym-700 flex items-center"
                                                    >
                                                        View <ExternalLink size={10} className="ml-0.5" />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                        {!notif.IsRead && (
                                            <button
                                                onClick={() => markReadMutation.mutate(notif.NotificationID)}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-gym-600 hover:bg-gym-50 rounded-md transition-all self-start"
                                                title="Mark as read"
                                            >
                                                <Check size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Bell size={20} className="text-slate-400" />
                                </div>
                                <p className="text-sm text-slate-500 font-medium">No notifications yet</p>
                                <p className="text-xs text-slate-400 mt-1">We'll let you know when something happens</p>
                            </div>
                        )}
                    </div>

                    <div className="p-3 bg-slate-50 text-center border-t border-slate-100">
                        <button className="text-xs font-bold text-gym-600 hover:text-gym-700 transition">
                            Clear All Notifications
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotificationDropdown
