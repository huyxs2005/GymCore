import { apiClient } from '../../../api/client'

export const receptionCustomerApi = {
  searchCustomers(query) {
    return apiClient.get('/v1/reception/customers/search', { params: { q: query } }).then((response) => response.data)
  },
  getMembership(customerId) {
    return apiClient.get(`/v1/reception/customers/${customerId}/membership`).then((response) => response.data)
  },
}
