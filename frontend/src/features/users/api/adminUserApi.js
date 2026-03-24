import { apiClient } from '../../../api/client'

export const adminUserApi = {
  getUsers(params) {
    return apiClient.get('/v1/admin/users', { params }).then((response) => response.data)
  },
  createStaff(payload) {
    return apiClient.post('/v1/admin/users/staff', payload).then((response) => response.data)
  },
  updateStaff(userId, payload) {
    return apiClient.put(`/v1/admin/users/${userId}`, payload).then((response) => response.data)
  },
  lockUser(userId, payload) {
    return apiClient.patch(`/v1/admin/users/${userId}/lock`, payload).then((response) => response.data)
  },
  unlockUser(userId) {
    return apiClient.patch(`/v1/admin/users/${userId}/unlock`).then((response) => response.data)
  },
}


