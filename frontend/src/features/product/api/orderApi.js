import { apiClient } from '../../../api/client'

export const orderApi = {
  checkout(payload) {
    return apiClient.post('/v1/orders/checkout', payload).then((response) => response.data)
  },
  confirmPaymentReturn(payload) {
    return apiClient.post('/v1/orders/payment-return', payload).then((response) => response.data)
  },
  getMyOrders() {
    return apiClient.get('/v1/orders/my-orders').then((response) => response.data)
  },
}
