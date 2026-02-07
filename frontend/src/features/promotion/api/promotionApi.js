import { apiClient } from '../../../api/client'

export const promotionApi = {
  getPromotionPosts() {
    return apiClient.get('/v1/promotions/posts').then((response) => response.data)
  },
  claimCoupon(payload) {
    return apiClient.post('/v1/promotions/claims', payload).then((response) => response.data)
  },
  applyCoupon(payload) {
    return apiClient.post('/v1/promotions/apply', payload).then((response) => response.data)
  },
  getMyClaims() {
    return apiClient.get('/v1/promotions/my-claims').then((response) => response.data)
  },
}
