import { apiClient } from '../../../api/client'

export const authApi = {
  register(payload) {
    return apiClient.post('/v1/auth/register', payload).then((response) => response.data)
  },
  login(payload) {
    return apiClient.post('/v1/auth/login', payload).then((response) => response.data)
  },
  loginWithGoogle(payload) {
    return apiClient.post('/v1/auth/login/google', payload).then((response) => response.data)
  },
  forgotPassword(payload) {
    return apiClient.post('/v1/auth/forgot-password', payload).then((response) => response.data)
  },
  changePassword(payload) {
    return apiClient.post('/v1/auth/change-password', payload).then((response) => response.data)
  },
  getProfile() {
    return apiClient.get('/v1/auth/me').then((response) => response.data)
  },
  updateProfile(payload) {
    return apiClient.put('/v1/auth/me', payload).then((response) => response.data)
  },
  logout() {
    return apiClient.post('/v1/auth/logout').then((response) => response.data)
  },
}
