// API service with authentication support

const API_BASE = '/api'

// Helper function for API requests
async function apiRequest(url, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include', // Include cookies for authentication
    ...options
  }

  try {
    const response = await fetch(`${API_BASE}${url}`, defaultOptions)
    
    if (response.status === 401) {
      // Unauthorized - throw error to be handled by components
      throw new Error('Unauthorized')
    }
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('API request failed:', error)
    throw error
  }
}

// API methods
export const api = {
  // GET request
  get: (url) => apiRequest(url),
  
  // POST request
  post: (url, data) => apiRequest(url, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  // PUT request
  put: (url, data) => apiRequest(url, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  // DELETE request
  delete: (url) => apiRequest(url, {
    method: 'DELETE'
  }),
  
  // Raw SQL query
  sql: (query, params = []) => apiRequest('/sql/raw', {
    method: 'POST',
    body: JSON.stringify({ query, params })
  })
}

// Users/Auth API methods
export const usersApi = {
  // Authentication
  checkAccess: () => api.get('/auth/check-access'),
  
  // Credits and checkout
  createCheckout: (data) => api.post('/auth/create-checkout', data),
  useCredits: (data) => api.post('/auth/use-credits', data),
  getCheckoutLink: () => api.get('/auth/checkout-link')
}

// CommentBot specific API methods
export const commentBotApi = {
  // Comment Groups
  getCommentGroups: () => api.get('/commentbot?type=comment-groups'),
  getCommentGroup: (id) => api.get(`/commentbot?type=comment-group-detail&id=${id}`),
  createCommentGroup: (data) => api.post('/commentbot/comment-groups', data),
  updateCommentGroup: (id, data) => api.put(`/commentbot/comment-groups/${id}`, data),
  deleteCommentGroup: (id) => api.delete(`/commentbot/comment-groups/${id}`),
  
  // Account Pools
  getAccountPools: () => api.get('/commentbot?type=account-pools'),
  getAccountPool: (id) => api.get(`/commentbot/account-pools/${id}`),
  createAccountPool: (data) => api.post('/commentbot/account-pools', data),
  updateAccountPool: (id, data) => api.put(`/commentbot/account-pools/${id}`, data),
  deleteAccountPool: (id) => api.delete(`/commentbot/account-pools/${id}`),
  
  // Orders
  getOrders: () => api.get('/commentbot?type=orders'),
  getOrder: (id) => api.get(`/commentbot/orders/${id}`),
  createOrder: (data) => api.post('/commentbot/create-order', data),
  updateOrder: (id, data) => api.put(`/commentbot/orders/${id}`, data),
  deleteOrder: (id) => api.delete(`/commentbot/orders/${id}`),
  getOrderStatus: (orderId) => api.get(`/commentbot?type=order-status&order_id=${orderId}`),
  
  // Other endpoints
  checkAccounts: (type) => api.post(`/commentbot/check-accounts?type=${type}`),
  getCommentGroupDetail: (id) => api.get(`/commentbot?type=comment-group-detail&id=${id}`)
}

// BCGen specific API methods
export const bcgenApi = {
  // Get availability for all regions
  getAvailability: () => api.get('/bcgen/availability'),
  
  // Create a new order
  createOrder: (country, quantity) => api.post('/bcgen/create-order', {
    country,
    quantity
  }),
  
  // Get user's orders
  getUserOrders: () => api.get('/bcgen/user-orders'),
  
  // Get specific order status and accounts
  getOrderStatus: (orderId) => api.get(`/bcgen/order-status/${orderId}`),
  
  // Request refund for an account
  refundRequest: (orderId, accountUsername) => api.post('/bcgen/refund-request', {
    orderId,
    accountUsername
  })
}

export default api