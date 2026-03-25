import { apiClient } from '../../../api/client'

export const reportApi = {
  getRevenueReport(params) {
    return apiClient.get('/v1/admin/reports/revenue', { params }).then((response) => response.data)
  },
  getProductRevenue(params) {
    return apiClient.get('/v1/admin/reports/revenue/products', { params }).then((response) => response.data)
  },
  getMembershipRevenue(params) {
    return apiClient.get('/v1/admin/reports/revenue/memberships', { params }).then((response) => response.data)
  },
  exportPdf(payload) {
    return apiClient.post('/v1/admin/reports/export-pdf', payload).then((response) => response.data)
  },
}
