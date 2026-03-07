import { apiClient } from '../../../api/client'

export const adminProductApi = {
  getProducts() {
    return apiClient.get('/v1/admin/products').then((response) => response.data?.data ?? response.data)
  },
  createProduct(payload) {
    return apiClient.post('/v1/admin/products', payload).then((response) => response.data?.data ?? response.data)
  },
  updateProduct(productId, payload) {
    return apiClient.put(`/v1/admin/products/${productId}`, payload).then((response) => response.data?.data ?? response.data)
  },
  uploadImage(file) {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post('/v1/admin/products/images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((response) => response.data?.data ?? response.data)
  },
  deleteUploadedImage(imageUrl) {
    return apiClient.delete('/v1/admin/products/images', {
      params: { imageUrl },
    }).then((response) => response.data?.data ?? response.data)
  },
  archiveProduct(productId) {
    return apiClient.delete(`/v1/admin/products/${productId}`).then((response) => response.data?.data ?? response.data)
  },
  restoreProduct(productId) {
    return apiClient.patch(`/v1/admin/products/${productId}/restore`).then((response) => response.data?.data ?? response.data)
  },
  getReviews() {
    return apiClient.get('/v1/admin/products/reviews').then((response) => response.data?.data ?? response.data)
  },
}
