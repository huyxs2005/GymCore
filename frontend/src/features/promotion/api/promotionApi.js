import { apiClient } from '../../../api/client'

function unwrapApiData(response) {
  return response?.data?.data ?? response?.data ?? {}
}

export const promotionApi = {
  getPromotionPosts() {
    return apiClient.get('/v1/promotions/posts').then(unwrapApiData)
  },
  claimCoupon(payload) {
    return apiClient.post('/v1/promotions/claims', payload).then(unwrapApiData)
  },
  claimCouponCode(payload) {
    return apiClient.post('/v1/promotions/claims/code', payload, { skipMutationSync: true }).then(unwrapApiData)
  },
  applyCoupon(payload) {
    return apiClient.post('/v1/promotions/apply', payload, { skipMutationSync: true }).then(unwrapApiData)
  },
  getMyClaims() {
    return apiClient.get('/v1/promotions/my-claims').then(unwrapApiData)
  },
}
