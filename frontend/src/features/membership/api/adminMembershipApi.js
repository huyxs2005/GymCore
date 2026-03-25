import { apiClient } from '../../../api/client'

export const adminMembershipApi = {
  getPlans() {
    return apiClient.get('/v1/admin/membership-plans').then((response) => response.data)
  },
  createPlan(payload) {
    return apiClient.post('/v1/admin/membership-plans', payload).then((response) => response.data)
  },
  updatePlan(planId, payload) {
    return apiClient.put(`/v1/admin/membership-plans/${planId}`, payload).then((response) => response.data)
  },
}
