import { apiClient } from '../../../api/client'

export const adminApi = {
  getDashboardSummary() {
    return apiClient.get('/v1/admin/dashboard-summary').then((response) => response.data)
  },
  getRevenueOverview() {
    return apiClient.get('/v1/admin/revenue/overview').then((response) => response.data)
  },
  getCoachStudents() {
    return apiClient.get('/v1/admin/coaches/students').then((response) => response.data)
  },
  getCoachFeedback() {
    return apiClient.get('/v1/admin/coaches/feedback').then((response) => response.data)
  },
}
