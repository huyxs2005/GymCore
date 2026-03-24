import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

import { apiClient } from '../../../api/client'
import { notificationApi } from './notificationApi'

describe('notificationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.get.mockResolvedValue({ data: { ok: true } })
    apiClient.patch.mockResolvedValue({ data: { ok: true } })
  })

  it('calls notification endpoints with the correct paths', async () => {
    await notificationApi.getNotifications()
    await notificationApi.getNotifications({ unreadOnly: true })
    await notificationApi.getNotifications({ view: 'actionable' })
    await notificationApi.getNotifications({ unreadOnly: true, view: 'history' })
    await notificationApi.markAsRead(12)
    await notificationApi.markAsUnread(13)
    await notificationApi.markAllAsRead()

    expect(apiClient.get).toHaveBeenCalledWith('/v1/notifications?unreadOnly=false')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/notifications?unreadOnly=true')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/notifications?unreadOnly=false&view=actionable')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/notifications?unreadOnly=true&view=history')
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/notifications/12/read')
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/notifications/13/unread')
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/notifications/read-all')
  })
})


