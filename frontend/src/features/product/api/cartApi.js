import { apiClient } from '../../../api/client'

export const cartApi = {
  getCart() {
    return apiClient.get('/v1/cart').then((response) => response.data)
  },
  addItem(payload) {
    return apiClient.post('/v1/cart/items', payload).then((response) => response.data)
  },
  updateItem(productId, payload) {
    return apiClient.patch(`/v1/cart/items/${productId}`, payload).then((response) => response.data)
  },
  removeItem(productId) {
    return apiClient.delete(`/v1/cart/items/${productId}`).then((response) => response.data)
  },
}
