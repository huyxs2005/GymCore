import { apiClient } from '../../../api/client'

export const authApi = {
  register(payload) {
    return apiClient.post('/v1/auth/register', payload).then((response) => response.data)
  },
  resendRegisterOtp(payload) {
    return apiClient.post('/v1/auth/register/resend-otp', payload).then((response) => response.data)
  },
  verifyRegisterOtp(payload) {
    return apiClient.post('/v1/auth/register/verify-otp', payload).then((response) => response.data)
  },
  login(payload) {
    return apiClient.post('/v1/auth/login', payload).then((response) => response.data)
  },
  loginWithGoogle(payload) {
    return apiClient.post('/v1/auth/login/google', payload).then((response) => response.data)
  },
  refresh() {
    return apiClient.post('/v1/auth/refresh').then((response) => response.data)
  },
  forgotPassword(payload) {
    return apiClient.post('/v1/auth/forgot-password', payload).then((response) => response.data)
  },
  resendForgotPasswordOtp(payload) {
    return apiClient.post('/v1/auth/forgot-password/resend-otp', payload).then((response) => response.data)
  },
  verifyForgotPasswordOtp(payload) {
    return apiClient.post('/v1/auth/forgot-password/verify-otp', payload).then((response) => response.data)
  },
  resetForgotPassword(payload) {
    return apiClient.post('/v1/auth/forgot-password/reset', payload).then((response) => response.data)
  },
  changePassword(payload) {
    return apiClient.patch('/v1/auth/change-password', payload).then((response) => response.data)
  },
  getProfile() {
    return apiClient.get('/v1/auth/me').then((response) => response.data)
  },
  getMyQrToken() {
    return apiClient.get('/v1/auth/me/qr-token').then((response) => response.data)
  },
  updateProfile(payload) {
    return apiClient.put('/v1/auth/me', payload).then((response) => response.data)
  },
  logout() {
    return apiClient.post('/v1/auth/logout').then((response) => response.data)
  },
}
