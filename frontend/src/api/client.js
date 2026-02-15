import axios from 'axios'
import { clearSession, getAccessToken, setAccessToken } from '../features/auth/session'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config
    const status = error?.response?.status
    if (!originalRequest || status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    // Skip refresh loop for auth endpoints that are expected to return 401.
    const url = originalRequest.url || ''
    if (url.includes('/v1/auth/login') || url.includes('/v1/auth/refresh')) {
      return Promise.reject(error)
    }

    originalRequest._retry = true
    try {
      const refreshResponse = await apiClient.post('/v1/auth/refresh')
      const nextAccessToken = refreshResponse?.data?.data?.accessToken
      if (!nextAccessToken) {
        throw new Error('Missing refreshed access token.')
      }
      setAccessToken(nextAccessToken)
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      clearSession()
      return Promise.reject(refreshError)
    }
  },
)
