import axios from './axios-config'

const BASE_URL = '/analytics'

export default {
  /**
   * Track an analytics event
   */
  async trackEvent(data) {
    const response = await axios.post(`${BASE_URL}/event`, {
      ...data,
      timestamp: new Date().toISOString(),
      
      // Get client-side metrics
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      
      // Get performance metrics if available
      performance_metrics: this.getPerformanceMetrics(),
      
      // Get session info
      session_id: this.getSessionId(),
      is_new_session: this.isNewSession(),
      
      // Get fingerprint if available
      fingerprint_id: await this.getFingerprint()
    })
    return response.data
  },
  
  /**
   * Get advanced analytics for a project
   */
  async getAdvancedAnalytics(projectId, params = {}) {
    const response = await axios.get(`${BASE_URL}/project/${projectId}`, {
      params: {
        start_date: params.start_date,
        end_date: params.end_date,
        granularity: params.granularity || 'daily'
      }
    })
    return response.data
  },
  
  /**
   * Get real-time analytics
   */
  async getRealTimeAnalytics(projectId = null) {
    const url = projectId ? `${BASE_URL}/realtime/${projectId}` : `${BASE_URL}/realtime`
    const response = await axios.get(url)
    return response.data
  },
  
  async getRealtimeAnalytics(projectId) {
    const response = await axios.get(`${BASE_URL}/realtime/${projectId}`)
    return response.data
  },
  
  /**
   * Get analytics aggregations
   */
  async getAggregatedAnalytics(projectId, type = 'daily', dateRange) {
    const response = await axios.get(`${BASE_URL}/aggregated/${projectId}`, {
      params: {
        type,
        start_date: dateRange?.start,
        end_date: dateRange?.end
      }
    })
    return response.data
  },
  
  /**
   * Get fraud analysis
   */
  async getFraudAnalysis(projectId, params = {}) {
    const response = await axios.get(`${BASE_URL}/fraud/${projectId}`, {
      params
    })
    return response.data
  },
  
  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(projectId, params = {}) {
    const response = await axios.get(`${BASE_URL}/performance/${projectId}`, {
      params
    })
    return response.data
  },
  
  /**
   * Get A/B test results
   */
  async getABTestResults(projectId, testId = null) {
    const url = testId 
      ? `${BASE_URL}/ab-tests/${projectId}/${testId}`
      : `${BASE_URL}/ab-tests/${projectId}`
    const response = await axios.get(url)
    return response.data
  },
  
  /**
   * Create A/B test
   */
  async createABTest(projectId, testData) {
    const response = await axios.post(`${BASE_URL}/ab-tests/${projectId}`, testData)
    return response.data
  },
  
  /**
   * Update A/B test status
   */
  async updateABTestStatus(projectId, testId, status) {
    const response = await axios.patch(`${BASE_URL}/ab-tests/${projectId}/${testId}`, {
      status
    })
    return response.data
  },
  
  /**
   * Get conversion goals
   */
  async getConversionGoals(projectId) {
    const response = await axios.get(`${BASE_URL}/goals/${projectId}`)
    return response.data
  },
  
  /**
   * Create conversion goal
   */
  async createConversionGoal(projectId, goalData) {
    const response = await axios.post(`${BASE_URL}/goals/${projectId}`, goalData)
    return response.data
  },
  
  /**
   * Export analytics data
   */
  async exportAnalytics(projectId, params = {}) {
    const response = await axios.get(`${BASE_URL}/export/${projectId}`, {
      params: {
        format: params.format || 'csv',
        start_date: params.start_date,
        end_date: params.end_date,
        include_raw: params.include_raw || false
      },
      responseType: 'blob'
    })
    return response.data
  },
  
  /**
   * Get top performers (countries, cities, referrers, etc.)
   */
  async getTopPerformers(projectId, type, limit = 10) {
    const response = await axios.get(`${BASE_URL}/top/${projectId}/${type}`, {
      params: { limit }
    })
    return response.data
  },
  
  /**
   * Get UTM campaign performance
   */
  async getUTMPerformance(projectId, params = {}) {
    const response = await axios.get(`${BASE_URL}/utm/${projectId}`, {
      params
    })
    return response.data
  },
  
  /**
   * Get device and browser analytics
   */
  async getDeviceAnalytics(projectId, params = {}) {
    const response = await axios.get(`${BASE_URL}/devices/${projectId}`, {
      params
    })
    return response.data
  },
  
  /**
   * Get geographic analytics
   */
  async getGeoAnalytics(projectId, params = {}) {
    const response = await axios.get(`${BASE_URL}/geo/${projectId}`, {
      params
    })
    return response.data
  },
  
  /**
   * Get link health status
   */
  async getLinkHealth(projectId) {
    const response = await axios.get(`${BASE_URL}/health/${projectId}`)
    return response.data
  },
  
  /**
   * Trigger manual analytics aggregation
   */
  async triggerAggregation(type = 'hourly') {
    const response = await axios.post(`${BASE_URL}/aggregate`, { type })
    return response.data
  },
  
  // Helper methods
  
  /**
   * Get or create session ID
   */
  getSessionId() {
    let sessionId = sessionStorage.getItem('linksplitter_session_id')
    if (!sessionId) {
      sessionId = this.generateUUID()
      sessionStorage.setItem('linksplitter_session_id', sessionId)
      sessionStorage.setItem('linksplitter_session_start', Date.now())
    }
    return sessionId
  },
  
  /**
   * Check if this is a new session
   */
  isNewSession() {
    const sessionStart = sessionStorage.getItem('linksplitter_session_start')
    if (!sessionStart) return true
    
    // Session expires after 30 minutes of inactivity
    const elapsed = Date.now() - parseInt(sessionStart)
    return elapsed > 30 * 60 * 1000
  },
  
  /**
   * Get performance metrics from browser
   */
  getPerformanceMetrics() {
    if (!window.performance || !window.performance.timing) return null
    
    const timing = window.performance.timing
    const metrics = {
      page_load_time: timing.loadEventEnd - timing.navigationStart,
      dns_time: timing.domainLookupEnd - timing.domainLookupStart,
      connect_time: timing.connectEnd - timing.connectStart,
      response_time: timing.responseEnd - timing.requestStart,
      dom_interactive_time: timing.domInteractive - timing.navigationStart
    }
    
    // Only return positive values
    Object.keys(metrics).forEach(key => {
      if (metrics[key] < 0 || metrics[key] > 60000) {
        metrics[key] = null
      }
    })
    
    return metrics
  },
  
  /**
   * Get browser fingerprint
   */
  async getFingerprint() {
    try {
      // Simple fingerprinting - in production, use a library like FingerprintJS
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('fingerprint', 2, 2)
      const canvasData = canvas.toDataURL()
      
      const fingerprint = {
        screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        canvas: canvasData.slice(-50) // Last 50 chars of canvas data
      }
      
      // Create a simple hash
      const str = JSON.stringify(fingerprint)
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
      }
      
      return hash.toString(16)
    } catch (error) {
      console.error('Error generating fingerprint:', error)
      return null
    }
  },
  
  /**
   * Generate UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  },
  
  /**
   * Track engagement metrics
   */
  trackEngagement() {
    const startTime = Date.now()
    let maxScroll = 0
    let clickCount = 0
    
    // Track scroll depth
    window.addEventListener('scroll', () => {
      const scrollPercentage = Math.round(
        (window.scrollY + window.innerHeight) / document.body.scrollHeight * 100
      )
      maxScroll = Math.max(maxScroll, scrollPercentage)
    })
    
    // Track clicks
    document.addEventListener('click', () => {
      clickCount++
    })
    
    // Return metrics when needed
    return () => ({
      time_on_page: Math.round((Date.now() - startTime) / 1000),
      scroll_depth: maxScroll,
      clicks_count: clickCount
    })
  },

  // Additional methods for Advanced Analytics Dashboard
  
  /**
   * Get active users
   */
  async getActiveUsers() {
    const response = await axios.get(`${BASE_URL}/active-users`)
    return response.data
  },

  /**
   * Get fraud analytics
   */
  async getFraudAnalytics() {
    const response = await axios.get(`${BASE_URL}/fraud`)
    return response.data
  },

  /**
   * Get A/B test results
   */
  async getABTests() {
    const response = await axios.get(`${BASE_URL}/ab-tests`)
    return response.data
  },

  /**
   * Get activity logs
   */
  async getActivityLogs(filters = {}) {
    const response = await axios.get(`${BASE_URL}/activity-logs`, { params: filters })
    return response.data
  },

  /**
   * Get webhooks
   */
  async getWebhooks() {
    const response = await axios.get(`${BASE_URL}/webhooks`)
    return response.data
  },

  /**
   * Create webhook
   */
  async createWebhook(webhookData) {
    const response = await axios.post(`${BASE_URL}/webhooks`, webhookData)
    return response.data
  },

  /**
   * Update webhook
   */
  async updateWebhook(webhookId, webhookData) {
    const response = await axios.put(`${BASE_URL}/webhooks/${webhookId}`, webhookData)
    return response.data
  },

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId) {
    const response = await axios.delete(`${BASE_URL}/webhooks/${webhookId}`)
    return response.data
  },

  /**
   * Test webhook
   */
  async testWebhook(webhookId) {
    const response = await axios.post(`${BASE_URL}/webhooks/${webhookId}/test`)
    return response.data
  },

  /**
   * Get performance metrics
   */
  async getPerformanceData(timeRange = '24h') {
    const response = await axios.get(`${BASE_URL}/performance`, {
      params: { timeRange }
    })
    return response.data
  },

  /**
   * Get geographic data
   */
  async getGeographicData(timeRange = '7d') {
    const response = await axios.get(`${BASE_URL}/geographic`, {
      params: { timeRange }
    })
    return response.data
  }
}