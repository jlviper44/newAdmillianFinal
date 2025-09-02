import axios from 'axios'

const API_BASE = '/api/link-splitter'

const linkSplitterAPI = {
  // Groups
  async getGroups() {
    const response = await axios.get(`${API_BASE}/groups`)
    return response.data
  },
  
  async createGroup(data) {
    const response = await axios.post(`${API_BASE}/groups`, data)
    return response.data
  },
  
  async updateGroup(id, data) {
    const response = await axios.put(`${API_BASE}/groups/${id}`, data)
    return response.data
  },
  
  async deleteGroup(id) {
    const response = await axios.delete(`${API_BASE}/groups/${id}`)
    return response.data
  },
  
  // Projects
  async getProjects(params = {}) {
    const response = await axios.get(`${API_BASE}/projects`, { params })
    return response.data
  },
  
  async getProject(id) {
    const response = await axios.get(`${API_BASE}/projects/${id}`)
    return response.data
  },
  
  async createProject(data) {
    const response = await axios.post(`${API_BASE}/projects`, data)
    return response.data
  },
  
  async updateProject(id, data) {
    const response = await axios.put(`${API_BASE}/projects/${id}`, data)
    return response.data
  },
  
  async deleteProject(id) {
    const response = await axios.delete(`${API_BASE}/projects/${id}`)
    return response.data
  },
  
  async duplicateProject(id, data = {}) {
    const response = await axios.post(`${API_BASE}/projects/${id}/duplicate`, data)
    return response.data
  },
  
  // Analytics
  async getAnalytics(projectId, params = {}) {
    const response = await axios.get(`${API_BASE}/analytics/${projectId}`, { params })
    return response.data
  },
  
  async getRealtimeAnalytics(projectId) {
    const response = await axios.get(`${API_BASE}/analytics/${projectId}/realtime`)
    return response.data
  },
  
  async exportAnalytics(projectId, params = {}) {
    const response = await axios.get(`${API_BASE}/analytics/${projectId}/export`, { 
      params,
      responseType: params.format === 'csv' ? 'text' : 'json'
    })
    return response.data
  },
  
  // Testing & Validation
  async testLink(data) {
    const response = await axios.post(`${API_BASE}/test-link`, data)
    return response.data
  },
  
  async validateUrl(url) {
    const response = await axios.post(`${API_BASE}/validate-url`, { url })
    return response.data
  },
  
  async checkAlias(alias, excludeId = null) {
    const response = await axios.post(`${API_BASE}/check-alias`, { 
      alias, 
      exclude_id: excludeId 
    })
    return response.data
  },
  
  // Get redirect URL by code
  async getRedirect(code) {
    const response = await axios.get(`${API_BASE}/redirect/${code}`)
    return response.data
  },
  
  // Helper function to generate short link URL
  getShortLink(alias) {
    return `${window.location.origin}/l/${alias}`
  }
}

export default linkSplitterAPI