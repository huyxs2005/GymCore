import { apiClient } from '../../../api/client'

export const productApi = {
  getProducts() {
    return apiClient.get('/v1/products').then((response) => response.data)
  },
  getProductDetail(productId) {
    return apiClient.get(`/v1/products/${productId}`).then((response) => response.data)
  },
  createReview(productId, payload) {
    return apiClient.post(`/v1/products/${productId}/reviews`, payload).then((response) => response.data)
  },
}
