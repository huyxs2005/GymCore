import { apiClient } from '../../../api/client'

export const adminInvoiceApi = {
  getInvoices() {
    return apiClient.get('/v1/admin/invoices').then((response) => response.data)
  },
  getInvoiceDetail(invoiceId) {
    return apiClient.get(`/v1/admin/invoices/${invoiceId}`).then((response) => response.data)
  },
}
