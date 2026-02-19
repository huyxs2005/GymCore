import { apiClient } from '../../../api/client'

export const adminPromotionApi = {
  getCoupons() {
    return apiClient.get('/v1/admin/promotions/coupons').then((response) => response.data)
  },
  createCoupon(payload) {
    return apiClient.post('/v1/admin/promotions/coupons', payload).then((response) => response.data)
  },
  updateCoupon(promotionId, payload) {
    return apiClient.put(`/v1/admin/promotions/coupons/${promotionId}`, payload).then((response) => response.data)
  },
  createPost(payload) {
    return apiClient.post('/v1/admin/promotions/posts', payload).then((response) => response.data)
  },
  updatePost(postId, payload) {
    return apiClient.put(`/v1/admin/promotions/posts/${postId}`, payload).then((response) => response.data)
  },
  getPosts() {
    return apiClient.get('/v1/promotions/posts').then((response) => response.data)
  },
  getRevenueReport() {
    return apiClient.get('/v1/admin/promotions/revenue-report').then((response) => response.data)
  },
  exportRevenuePdf() {
    return apiClient.get('/v1/admin/promotions/revenue-report/pdf', { responseType: 'blob' })
      .then((response) => response.data)
  },
}
