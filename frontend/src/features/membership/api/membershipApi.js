import { apiClient } from '../../../api/client'

export const membershipApi = {
  getPlans() {
    return apiClient.get('/v1/memberships/plans').then((response) => response.data)
  },
  getPlanDetail(planId) {
    return apiClient.get(`/v1/memberships/plans/${planId}`).then((response) => response.data)
  },
  getCurrentMembership() {
    return apiClient.get('/v1/memberships/current').then((response) => response.data)
  },
  purchase(payload) {
    return apiClient.post('/v1/memberships/purchase', payload).then((response) => response.data)
  },
  renew(payload) {
    return apiClient.post('/v1/memberships/renew', payload).then((response) => response.data)
  },
  upgrade(payload) {
    return apiClient.post('/v1/memberships/upgrade', payload).then((response) => response.data)
  },
  confirmPaymentReturn(payload) {
    return apiClient.post('/v1/memberships/payment-return', payload).then((response) => response.data)
  },
}
