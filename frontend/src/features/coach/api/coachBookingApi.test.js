import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('../../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}))

import { apiClient } from '../../../api/client'
import { coachBookingApi } from './coachBookingApi'

describe('coachBookingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.get.mockResolvedValue({ data: { ok: true } })
    apiClient.post.mockResolvedValue({ data: { ok: true } })
    apiClient.patch.mockResolvedValue({ data: { ok: true } })
    apiClient.delete.mockResolvedValue({ data: { ok: true } })
    apiClient.put.mockResolvedValue({ data: { ok: true } })
  })

  it('calls reschedule request endpoints with correct paths', async () => {
    await coachBookingApi.getRescheduleRequests()
    await coachBookingApi.approveRescheduleRequest(123)
    await coachBookingApi.denyRescheduleRequest(123, { reason: 'conflict' })

    expect(apiClient.get).toHaveBeenCalledWith('/v1/coach/reschedule-requests')
    expect(apiClient.post).toHaveBeenCalledWith('/v1/coach/pt-sessions/123/reschedule-approve')
    expect(apiClient.post).toHaveBeenCalledWith('/v1/coach/pt-sessions/123/reschedule-deny', { reason: 'conflict' })
  })

  it('sends match payload for preview', async () => {
    const payload = {
      endDate: '2026-03-31',
      slots: [{ dayOfWeek: 1, timeSlotId: 1 }],
    }
    await coachBookingApi.matchCoaches(payload)
    expect(apiClient.post).toHaveBeenCalledWith('/v1/coach-booking/match', payload)
  })

  it('uses empty body when denyRescheduleRequest is called without body', async () => {
    await coachBookingApi.denyRescheduleRequest(321)
    expect(apiClient.post).toHaveBeenCalledWith('/v1/coach/pt-sessions/321/reschedule-deny', {})
  })

  it('covers customer/coach/admin endpoint wrappers for path correctness', async () => {
    await coachBookingApi.createRequest({ coachId: 7 })
    await coachBookingApi.getMySchedule()
    await coachBookingApi.deleteMySession(11)
    await coachBookingApi.cancelSession(12, { cancelReason: 'busy' })
    await coachBookingApi.deleteRequest(13)
    await coachBookingApi.rescheduleSession(14, { sessionDate: '2026-03-10', timeSlotId: 2 })
    await coachBookingApi.submitFeedback({ ptSessionId: 14, rating: 5 })
    await coachBookingApi.getPendingRequests()
    await coachBookingApi.actionRequest(15, 'ACCEPT')
    await coachBookingApi.getCoachCustomers()
    await coachBookingApi.getCoachCustomerDetail(16)
    await coachBookingApi.getCoachCustomerHistory(16)
    await coachBookingApi.updateCustomerProgress(16, { note: 'progress' })
    await coachBookingApi.createSessionNote(17, { note: 'done' })
    await coachBookingApi.updateSessionNote(18, { note: 'updated' })
    await coachBookingApi.deleteSession(19)
    await coachBookingApi.completeSession(20)
    await coachBookingApi.getCoachFeedback()
    await coachBookingApi.getCoachFeedbackAverage()
    await coachBookingApi.adminGetCoaches()
    await coachBookingApi.adminUpdateCoachProfile(21, { bio: 'x' })
    await coachBookingApi.adminGetCoachPerformance(21)
    await coachBookingApi.adminGetCoachStudents(21)

    expect(apiClient.post).toHaveBeenCalledWith('/v1/coach-booking/requests', { coachId: 7 })
    expect(apiClient.get).toHaveBeenCalledWith('/v1/coach-booking/my-schedule')
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/coach-booking/my-schedule/sessions/11')
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/coach-booking/sessions/12/cancel', { cancelReason: 'busy' })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/coach-booking/requests/13/delete')
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/coach-booking/sessions/14/reschedule', {
      sessionDate: '2026-03-10',
      timeSlotId: 2,
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/coach-booking/feedback', { ptSessionId: 14, rating: 5 })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/coach/pt-requests/15/approve', {})
    expect(apiClient.get).toHaveBeenCalledWith('/v1/coach/customers')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/coach/customers/16')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/coach/customers/16/history')
    expect(apiClient.put).toHaveBeenCalledWith('/v1/coach/customers/16/progress', { note: 'progress' })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/coach/pt-sessions/17/notes', { note: 'done' })
    expect(apiClient.put).toHaveBeenCalledWith('/v1/coach/pt-sessions/notes/18', { note: 'updated' })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/coach/pt-sessions/19')
    expect(apiClient.post).toHaveBeenCalledWith('/v1/coach/pt-sessions/20/complete')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/coach/feedback')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/coach/feedback/average')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/admin/coaches')
    expect(apiClient.put).toHaveBeenCalledWith('/v1/admin/coaches/21', { bio: 'x' })
    expect(apiClient.get).toHaveBeenCalledWith('/v1/admin/coaches/21/performance')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/admin/coaches/21/students')
  })
})
