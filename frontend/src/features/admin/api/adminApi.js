import { apiClient } from '../../../api/client'

export const adminApi = {
  getDashboardSummary() {
    return apiClient.get('/v1/admin/dashboard-summary').then((response) => response.data)
  },
  getRevenueOverview(params) {
    return apiClient.get('/v1/admin/revenue/overview', { params }).then((response) => response.data)
  },
  exportRevenueExcel(params) {
    return apiClient.get('/v1/admin/revenue/export.xlsx', {
      params,
      responseType: 'blob',
    })
  },
  getCoachStudents() {
    return apiClient.get('/v1/admin/coaches/students').then((response) => response.data)
  },
  getCoachFeedback() {
    return apiClient.get('/v1/admin/coaches/feedback').then((response) => response.data)
  },
}


