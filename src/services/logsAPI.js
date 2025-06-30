/**
 * Logs API Service
 * Handles all API calls related to click tracking logs
 */

const API_BASE = '/api/logs';

/**
 * Get logs with filtering and pagination
 */
async function getLogs(params = {}) {
  const queryParams = new URLSearchParams();
  
  // Add parameters if they exist and are not default values
  if (params.page) queryParams.set('page', params.page);
  if (params.limit) queryParams.set('limit', params.limit);
  if (params.campaign && params.campaign !== 'all') queryParams.set('campaign', params.campaign);
  if (params.type && params.type !== 'all') queryParams.set('type', params.type);
  if (params.decision && params.decision !== 'all') queryParams.set('decision', params.decision);
  if (params.tag && params.tag !== 'all') queryParams.set('tag', params.tag);
  if (params.startDate) queryParams.set('startDate', params.startDate);
  if (params.endDate) queryParams.set('endDate', params.endDate);
  if (params.search) queryParams.set('search', params.search);
  
  const response = await fetch(`${API_BASE}?${queryParams}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch logs: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get a single log by ID
 */
async function getLog(logId) {
  const response = await fetch(`${API_BASE}/${logId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch log: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get logs summary statistics
 */
async function getLogsSummary() {
  const response = await fetch(`${API_BASE}/summary`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch logs summary: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get logs grouped by campaign
 */
async function getLogsByCampaign(days = 7) {
  const response = await fetch(`${API_BASE}/by-campaign?days=${days}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch campaign stats: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get logs grouped by type
 */
async function getLogsByType() {
  const response = await fetch(`${API_BASE}/by-type`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch type stats: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Get campaigns list for dropdown
 */
async function getCampaignsList() {
  const response = await fetch(`/api/logs/campaigns/list`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch campaigns list: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Create a new log entry
 */
async function createLog(logData) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(logData)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to create log: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Clear old logs
 */
async function clearOldLogs(days) {
  const response = await fetch(`${API_BASE}/clear`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ days })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to clear logs: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fix first10 tags for existing logs
 */
async function fixFirst10Tags(campaignId = null) {
  const body = {};
  if (campaignId) {
    body.campaignId = campaignId;
  }
  
  const response = await fetch(`${API_BASE}/fix-first10`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fix first10 tags: ${response.statusText}`);
  }
  
  return response.json();
}

export default {
  getLogs,
  getLog,
  getLogsSummary,
  getLogsByCampaign,
  getLogsByType,
  getCampaignsList,
  createLog,
  clearOldLogs,
  fixFirst10Tags
};