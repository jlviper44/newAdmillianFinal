// Axios configuration with authentication support

import axios from 'axios'

// Create an axios instance with default configuration
const axiosInstance = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // This ensures cookies are sent with requests
})

// Add a request interceptor to handle authentication
axiosInstance.interceptors.request.use(
  (config) => {
    // You can add additional headers here if needed
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add a response interceptor to handle errors
axiosInstance.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // Don't logout for metrics endpoints
      const url = error.config?.url || ''
      if (url.includes('/metrics/') || url.includes('/affiliate/')) {
        console.warn('Metrics API requires authentication')
        return Promise.reject(error)
      }
      
      // Handle unauthorized access
      handleSessionExpired()
    }
    return Promise.reject(error)
  }
)

// Handle expired sessions
function handleSessionExpired() {
  // Clear any local auth state
  localStorage.removeItem('user')
  sessionStorage.clear()
  
  // Clear cookies by setting them to expire
  document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'
  
  // Dispatch a custom event that components can listen to
  window.dispatchEvent(new CustomEvent('auth:expired'))
  
  // Redirect to home page with auth modal
  if (window.location.pathname !== '/') {
    window.location.href = '/?showAuth=true'
  }
}

export default axiosInstance