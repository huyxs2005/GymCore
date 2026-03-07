import { apiClient } from '../../../api/client'

export const adminInvoiceApi = {
  getInvoices() {
    return apiClient.get('/v1/admin/invoices').then((response) => response.data?.data ?? response.data)
  },
  getInvoiceDetail(invoiceId) {
    return apiClient.get(`/v1/admin/invoices/${invoiceId}`).then((response) => response.data?.data ?? response.data)
  },
  confirmPickup(invoiceId) {
    return apiClient.patch(`/v1/admin/invoices/${invoiceId}/pickup`).then((response) => response.data?.data ?? response.data)
  },
}
