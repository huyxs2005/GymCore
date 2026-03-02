import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

import { apiClient } from '../../../api/client'
import { adminMembershipApi } from './adminMembershipApi'

describe('adminMembershipApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.get.mockResolvedValue({ data: { ok: true } })
    apiClient.post.mockResolvedValue({ data: { ok: true } })
    apiClient.put.mockResolvedValue({ data: { ok: true } })
  })

  it('calls admin membership plan endpoints with expected paths', async () => {
    const createPayload = {
      name: 'Gym Only - 1 Month',
      planType: 'GYM_ONLY',
      price: 500000,
      durationDays: 30,
      allowsCoachBooking: false,
      active: true,
    }
    const updatePayload = {
      name: 'Gym + Coach - 1 Month',
      planType: 'GYM_PLUS_COACH',
      price: 1200000,
      durationDays: 30,
      allowsCoachBooking: true,
      active: true,
    }

    await adminMembershipApi.getPlans()
    await adminMembershipApi.createPlan(createPayload)
    await adminMembershipApi.updatePlan(11, updatePayload)

    expect(apiClient.get).toHaveBeenCalledWith('/v1/admin/membership-plans')
    expect(apiClient.post).toHaveBeenCalledWith('/v1/admin/membership-plans', createPayload)
    expect(apiClient.put).toHaveBeenCalledWith('/v1/admin/membership-plans/11', updatePayload)
  })

  it('returns response.data from wrappers', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { plans: [{ planId: 1 }] } })
    apiClient.put.mockResolvedValueOnce({ data: { plan: { planId: 1, name: 'Updated' } } })

    await expect(adminMembershipApi.getPlans()).resolves.toEqual({ plans: [{ planId: 1 }] })
    await expect(adminMembershipApi.updatePlan(1, { name: 'Updated' })).resolves.toEqual({
      plan: { planId: 1, name: 'Updated' },
    })
  })
})
