import { apiClient } from '../../../api/client'

export const promotionApi = {
  getCoupons() {
    return apiClient.get('/v1/promotions/coupons').then((response) => response.data)
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
