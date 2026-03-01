import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import { apiClient } from '../../../api/client'
import { membershipApi } from './membershipApi'

describe('membershipApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.get.mockResolvedValue({ data: { ok: true } })
    apiClient.post.mockResolvedValue({ data: { ok: true } })
  })

  it('calls customer membership endpoints with expected paths', async () => {
    const purchasePayload = { membershipPlanId: 7, paymentMethod: 'PAYOS' }
    const renewPayload = { membershipPlanId: 8, paymentMethod: 'PAYOS' }
    const upgradePayload = { membershipPlanId: 9, paymentMethod: 'PAYOS' }
    const returnPayload = { paymentId: 123, orderCode: 'abc' }

    await membershipApi.getPlans()
    await membershipApi.getPlanDetail(7)
    await membershipApi.getCurrentMembership()
    await membershipApi.purchase(purchasePayload)
    await membershipApi.renew(renewPayload)
    await membershipApi.upgrade(upgradePayload)
    await membershipApi.confirmPaymentReturn(returnPayload)

    expect(apiClient.get).toHaveBeenCalledWith('/v1/memberships/plans')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/memberships/plans/7')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/memberships/current')
    expect(apiClient.post).toHaveBeenCalledWith('/v1/memberships/purchase', purchasePayload)
    expect(apiClient.post).toHaveBeenCalledWith('/v1/memberships/renew', renewPayload)
    expect(apiClient.post).toHaveBeenCalledWith('/v1/memberships/upgrade', upgradePayload)
    expect(apiClient.post).toHaveBeenCalledWith('/v1/memberships/payment-return', returnPayload)
  })

  it('returns response.data from each wrapper', async () => {
    apiClient.get.mockResolvedValueOnce({ data: { plans: [{ id: 1 }] } })
    apiClient.post.mockResolvedValueOnce({ data: { success: true } })

    await expect(membershipApi.getPlans()).resolves.toEqual({ plans: [{ id: 1 }] })
    await expect(membershipApi.purchase({ membershipPlanId: 1 })).resolves.toEqual({ success: true })
  })
})
