// API service with authentication support
const API_BASE = '/api'

// Global request deduplication cache
const requestCache = new Map()
const pendingRequests = new Map()

// Helper function for API requests
async function apiRequest(url, options = {}) {
  // Create a cache key for deduplication
  const cacheKey = `${options.method || 'GET'}:${url}:${JSON.stringify(options.body || '')}`

  // For check-access requests, use aggressive caching and deduplication
  if (url === '/auth/check-access') {
    // If we have a cached result, return it
    if (requestCache.has(cacheKey)) {
      const cached = requestCache.get(cacheKey)
      if (Date.now() - cached.timestamp < 30000) { // 30 second cache
        return cached.data
      }
    }

    // If request is already pending, return the pending promise
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey)
    }
  }

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include', // Include cookies for authentication
    ...options
  }

  // For check-access, create promise and store it
  let requestPromise
  if (url === '/auth/check-access') {
    requestPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}${url}`, defaultOptions)

        if (response.status === 401) {
          // Special handling for metrics endpoints - don't logout immediately
          if (url.includes('/metrics/') || url.includes('/affiliate/')) {
            return { success: false, error: 'Authentication required', data: [] }
          }

          // Session expired or invalid - handle logout
          handleSessionExpired()
          throw new Error('Unauthorized')
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(error.error || `HTTP ${response.status}`)
        }

        const data = await response.json()

        // Cache the result
        requestCache.set(cacheKey, {
          data,
          timestamp: Date.now()
        })

        return data
      } finally {
        pendingRequests.delete(cacheKey)
      }
    })()

    pendingRequests.set(cacheKey, requestPromise)
    return requestPromise
  }

  try {
    const response = await fetch(`${API_BASE}${url}`, defaultOptions)

    if (response.status === 401) {
      // Special handling for metrics endpoints - don't logout immediately
      if (url.includes('/metrics/') || url.includes('/affiliate/')) {
        return { success: false, error: 'Authentication required', data: [] }
      }

      // Session expired or invalid - handle logout
      handleSessionExpired()
      throw new Error('Unauthorized')
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw error
  }
}

// Clear request cache (useful after auth changes)
function clearRequestCache() {
  requestCache.clear()
  pendingRequests.clear()
}

// Handle expired sessions
function handleSessionExpired() {
  // Clear any local auth state
  localStorage.removeItem('user')
  sessionStorage.clear()

  // Clear request cache
  clearRequestCache()

  // Clear cookies by setting them to expire
  document.cookie = 'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;'

  // Dispatch a custom event that components can listen to
  window.dispatchEvent(new CustomEvent('auth:expired'))

  // Redirect to home page with auth modal
  if (window.location.pathname !== '/') {
    window.location.href = '/?showAuth=true'
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
  }),

  // Clear request cache
  clearCache: clearRequestCache
}

// Users/Auth API methods
export const usersApi = {
  // Authentication
  checkAccess: () => api.get('/auth/check-access'),
  
  // Credits and checkout
  createCheckout: (data) => api.post('/auth/create-checkout', data),
  useCredits: (data) => api.post('/auth/use-credits', data),
  getCheckoutLink: () => api.get('/auth/checkout-link'),
  getPricing: () => api.get('/auth/pricing'),
  
  // Virtual Assistants
  getVirtualAssistants: () => api.get('/auth/virtual-assistants'),
  addVirtualAssistant: (email, roles = {}) => api.post('/auth/virtual-assistants', { email, ...roles }),
  extendVirtualAssistant: (assistantId) => api.post('/auth/virtual-assistants/extend', { assistantId }),
  editVirtualAssistant: (assistantId, newEmail, roles = {}) => api.put('/auth/virtual-assistants/edit', { assistantId, newEmail, ...roles }),
  removeVirtualAssistant: (id) => api.delete(`/auth/virtual-assistants/${id}`),
  
  // Virtual Assistant Mode
  startVirtualAssistantMode: (targetUserId) => api.post('/auth/virtual-assistant/start', { targetUserId }),
  endVirtualAssistantMode: () => api.post('/auth/virtual-assistant/end'),
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
  createBulkOrder: (data) => api.post('/commentbot/bulk-order', data),
  updateOrder: (id, data) => api.put(`/commentbot/orders/${id}`, data),
  deleteOrder: (id) => api.delete(`/commentbot/orders/${id}`),
  getOrderStatus: (orderId) => api.get(`/commentbot?type=order-status&order_id=${orderId}`),
  cancelOrder: (orderId) => api.delete(`/commentbot/order/${orderId}`),
  saveOrderProgress: (orderId, data) => api.post(`/commentbot/orders/${orderId}/save-progress`, data),
  
  // Job queue endpoints
  getJobs: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.offset) queryParams.append('offset', params.offset);
    // Don't add 'type' from params - it's already set to 'jobs' in the URL
    return api.get(`/commentbot?type=jobs&${queryParams.toString()}`);
  },
  getJobStatus: (jobId) => api.get(`/commentbot?type=job-status&job_id=${jobId}`),
  getJobLogs: (jobId) => api.get(`/commentbot?type=job-logs&job_id=${jobId}`),
  cancelJob: (jobId) => api.post(`/commentbot/cancel-job?job_id=${jobId}`),
  getQueueStats: () => api.get('/commentbot?type=queue-stats'),
  
  // Other endpoints
  checkAccounts: (type) => api.post(`/commentbot/check-accounts?type=${type}`),
  getCommentGroupDetail: (id) => api.get(`/commentbot?type=comment-group-detail&id=${id}`),
  
  // Logs (Admin only)
  getLogs: (params) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    return api.get(`/commentbot/logs?${queryParams.toString()}`);
  }
}

// BCGen specific API methods
export const bcgenApi = {
  // Get availability for all regions
  getAvailability: () => api.get('/bcgen/availability'),
  
  // Create a new order
  createOrder: (country, quantity) => api.post('/bcgen/create-order', { country, quantity }),
  
  // Get user's orders
  getUserOrders: () => api.get('/bcgen/user-orders'),
  
  // Get specific order status and accounts
  getOrderStatus: (orderId) => api.get(`/bcgen/order-status/${orderId}`),
  
  // Request refund for an order
  requestRefund: (orderId, reason) => api.post('/bcgen/refund-request', {
    orderId,
    reason
  }),
  
  // Get all refund requests (admin only)
  getRefundRequests: () => api.get('/bcgen/refund-requests'),
  
  // Process refund request (admin only)
  processRefund: (requestId, action, adminNotes) => api.post('/bcgen/process-refund', {
    requestId,
    action,
    adminNotes
  }),
  
  // Check email for an account
  checkEmail: (email, username) => api.post('/bcgen/check-email', {
    email,
    username
  })
}

// Metrics specific API methods
export const metricsApi = {
  // Fluent APIs
  getFluentApis: () => api.get('/metrics/fluent-apis'),
  addFluentApi: (data) => api.post('/metrics/fluent-apis', data),
  deleteFluentApi: (id) => api.delete(`/metrics/fluent-apis/${id}`),
  
  // Affiliate data
  testAffiliate: (data) => api.post('/affiliate/test', data),
  getClicks: (data) => api.post('/affiliate/clicks', data),
  getConversions: (data) => api.post('/affiliate/conversions', data),
  getSubaffiliateSummary: (data) => api.post('/affiliate/subaffiliatesummary', data)
}

// Sparks specific API methods
export const sparksApi = {
  // List sparks with pagination and filtering
  listSparks: (params) => {
    const queryParams = new URLSearchParams(params).toString()
    return api.get(`/sparks${queryParams ? `?${queryParams}` : ''}`)
  },
  
  // Get a specific spark
  getSpark: (id) => api.get(`/sparks/${id}`),
  
  // Create a new spark
  createSpark: (data) => api.post('/sparks', data),
  
  // Update an existing spark
  updateSpark: (id, data) => api.put(`/sparks/${id}`, data),
  
  // Delete a spark
  deleteSpark: (id) => api.delete(`/sparks/${id}`),
  
  // Toggle spark status (active/inactive)
  toggleSparkStatus: (id) => api.put(`/sparks/${id}/toggle-status`),
  
  // Get spark statistics
  getSparkStats: (id) => api.get(`/sparks/${id}/stats`),
  
  // Extract TikTok thumbnail
  extractTikTokThumbnail: (tiktokUrl) => api.post('/sparks/extract-tiktok-thumbnail', { tiktokUrl }),
  
  // Bot status operations
  updateBotStatus: (sparkIds, status) => api.put('/sparks/bulk-bot-status', { spark_ids: sparkIds, status }),
  getBotStatus: (sparkIds) => api.post('/sparks/bot-status', { spark_ids: sparkIds }),

  // Payment status operations
  updatePaymentStatus: (sparkIds, status) => api.put('/sparks/bulk-payment-status', { spark_ids: sparkIds, payment_status: status }),

  // Payment settings operations
  getPaymentSettings: () => api.get('/sparks/payment-settings'),
  savePaymentSettings: (settings) => api.post('/sparks/payment-settings', settings),

  // Payment history operations
  getPaymentHistory: (filters = {}) => {
    const queryParams = new URLSearchParams(filters).toString()
    return api.get(`/sparks/payment-history${queryParams ? `?${queryParams}` : ''}`)
  },
  recordPayment: (paymentData) => api.post('/sparks/record-payment', paymentData),

  // Weekly payment entry operations
  getWeeklyPaymentEntries: () => api.get('/sparks/weekly-payment-entries'),
  createWeeklyPaymentEntry: (entryData) => api.post('/sparks/weekly-payment-entries', entryData),
  updateWeeklyPaymentEntryStatus: (entryId, status) => api.put(`/sparks/weekly-payment-entries/${entryId}/status`, { status }),
  updateWeeklyPaymentEntryAmount: (entryId, amount) => api.put(`/sparks/weekly-payment-entries/${entryId}/amount`, { amount }),
  updateWeeklyPaymentEntryPaymentMethod: (entryId, paymentMethod) => api.put(`/sparks/weekly-payment-entries/${entryId}/payment-method`, { payment_method: paymentMethod })
}

// Templates specific API methods
export const templatesApi = {
  // List templates with pagination and filtering
  listTemplates: (params) => {
    const queryParams = new URLSearchParams(params).toString()
    return api.get(`/templates${queryParams ? `?${queryParams}` : ''}`)
  },
  
  // Get templates for dropdown (simplified list)
  getTemplatesList: () => api.get('/templates/list'),
  
  // Get a specific template
  getTemplate: (id) => api.get(`/templates/${id}`),
  
  // Create a new template
  createTemplate: (data) => api.post('/templates', data),
  
  // Update an existing template
  updateTemplate: (id, data) => api.put(`/templates/${id}`, data),
  
  // Delete a template
  deleteTemplate: (id) => api.delete(`/templates/${id}`),
  
  // Duplicate a template
  duplicateTemplate: (id) => api.post(`/templates/${id}/duplicate`),
  
  // Get template categories
  getCategories: () => api.get('/templates/categories')
}

// Shopify Stores specific API methods
export const shopifyApi = {
  // List stores with pagination and filtering
  listStores: (params) => {
    const queryParams = new URLSearchParams(params).toString()
    return api.get(`/shopify-stores${queryParams ? `?${queryParams}` : ''}`)
  },
  
  // Get a specific store
  getStore: (id) => api.get(`/shopify-stores/${id}`),
  
  // Create a new store
  createStore: (data) => api.post('/shopify-stores', data),
  
  // Update an existing store
  updateStore: (id, data) => api.put(`/shopify-stores/${id}`, data),
  
  // Delete a store
  deleteStore: (id) => api.delete(`/shopify-stores/${id}`),
  
  // Toggle store status (active/inactive)
  toggleStoreStatus: (id) => api.put(`/shopify-stores/${id}/toggle-status`),
  
  // Test store connection
  testConnection: (id) => api.post(`/shopify-stores/${id}/test-connection`),
  
  // Get store credentials (includes sensitive data)
  getStoreCredentials: (id) => api.get(`/shopify-stores/${id}/credentials`)
}

// Campaigns specific API methods
export const campaignsApi = {
  // List campaigns with pagination and filtering
  listCampaigns: (params) => {
    const queryParams = new URLSearchParams(params).toString()
    return api.get(`/campaigns${queryParams ? `?${queryParams}` : ''}`)
  },
  
  // Get a specific campaign
  getCampaign: (id) => api.get(`/campaigns/${id}`),
  
  // Create a new campaign
  createCampaign: (data) => api.post('/campaigns', data),
  
  // Update an existing campaign
  updateCampaign: (id, data) => api.put(`/campaigns/${id}`, data),
  
  // Delete a campaign
  deleteCampaign: (id) => api.delete(`/campaigns/${id}`),
  
  // Toggle campaign active status
  toggleCampaignActive: (id) => api.post(`/campaigns/${id}/toggle-active`),
  
  // Update campaign status
  updateCampaignStatus: (id, status) => api.put(`/campaigns/${id}/status`, { status }),
  
  // Update campaign ID
  updateCampaignId: (oldId, newId) => api.put(`/campaigns/${oldId}/update-id`, { newId }),
  
  // Update launch ID
  updateLaunchId: (campaignId, oldLaunchId, newLaunchId) => api.put(`/campaigns/${campaignId}/launches/${encodeURIComponent(oldLaunchId)}/update-id`, { newLaunchId }),
  
  // Manage campaign launches
  manageLaunches: (id, action, launchData) => api.post(`/campaigns/${id}/launches`, { action, launchData }),
  
  // Generate campaign link
  generateLink: (data) => api.post('/campaigns/generate-link', data),
  
  // Get stores list for dropdown
  getStoresList: () => api.get('/shopify-stores?limit=100'),
  
  // Get templates list for dropdown  
  getTemplatesList: () => api.get('/templates/list')
}

export default api