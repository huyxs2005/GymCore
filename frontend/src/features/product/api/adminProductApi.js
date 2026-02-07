import { apiClient } from '../../../api/client'

export const adminProductApi = {
  getProducts() {
    return apiClient.get('/v1/admin/products').then((response) => response.data)
  },
  createProduct(payload) {
    return apiClient.post('/v1/admin/products', payload).then((response) => response.data)
  },
  updateProduct(productId, payload) {
    return apiClient.put(`/v1/admin/products/${productId}`, payload).then((response) => response.data)
  },
  getReviews() {
    return apiClient.get('/v1/admin/products/reviews').then((response) => response.data)
  },
}
