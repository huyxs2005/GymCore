import { apiClient } from '../../../api/client'

export const adminSupportApi = {
  searchCustomers(query) {
    return apiClient
      .get('/v1/admin/support/customers', { params: { q: query || undefined } })
      .then((response) => response.data?.data ?? response.data)
  },
  getCustomerDetail(customerId) {
    return apiClient.get(`/v1/admin/support/customers/${customerId}`).then((response) => response.data?.data ?? response.data)
  },
}


