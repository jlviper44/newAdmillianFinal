// Logs Worker - logs.maximillillianh.workers.dev
// Handles click tracking and system logs for TikTok Ad Cloaker

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

addEventListener('scheduled', event => {
  event.waitUntil(performScheduledTasks());
});

/**
 * Main request handler
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // API endpoints
  if (path.startsWith('/api/')) {
    return handleApiRequest(request, path);
  }
  
  // Client-side JavaScript
  if (path === '/logs-client.js') {
    return new Response(LOGS_CLIENT_JS, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
  
  // Main HTML interface
  return new Response(LOGS_HTML, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  });
}

/**
 * API request router with CORS support
 */
async function handleApiRequest(request, path) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let response;

    // Route to appropriate handler
    switch (true) {
      // Create log
      case path === '/api/logs' && request.method === 'POST':
        response = await createLog(request);
        break;
        
      // List logs
      case path === '/api/logs' && request.method === 'GET':
        response = await listLogs(request);
        break;
        
      // Get single log
      case path.match(/^\/api\/logs\/[^\/]+$/) && request.method === 'GET':
        const logId = path.split('/').pop();
        response = await getLog(logId);
        break;
        
      // Summary statistics
      case path === '/api/logs/summary':
        response = await getLogsSummary();
        break;
        
      // Campaign statistics
      case path === '/api/logs/by-campaign':
        response = await getLogsByCampaign(request);
        break;
        
      // Type statistics
      case path === '/api/logs/by-type':
        response = await getLogsByType();
        break;
        
      // Export to CSV
      case path === '/api/logs/export':
        return await exportLogs(request); // Return directly for different content type
        
      // Clear old logs
      case path === '/api/logs/clear' && request.method === 'POST':
        response = await clearOldLogs(request);
        break;
        
      // Fix first10 tags
      case path === '/api/logs/fix-first10' && request.method === 'POST':
        response = await fixFirst10Tags(request);
        break;
        
      // Get campaigns for dropdown
      case path === '/api/campaigns/list':
        response = await getCampaignsList();
        break;
        
      default:
        response = new Response(
          JSON.stringify({ error: 'Endpoint not found' }),
          { status: 404 }
        );
    }

    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('API Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Create a new log entry
 */
async function createLog(request) {
  try {
    const data = await request.json();
    
    // Generate ID and timestamp if not provided
    const log = {
      id: data.id || crypto.randomUUID(),
      timestamp: data.timestamp || new Date().toISOString(),
      ...data,
      tags: data.tags || []
    };
    
    // Process OS information
    if (!log.os && log.userAgent) {
      const osInfo = detectOSFromUserAgent(log.userAgent);
      log.os = osInfo.os;
      log.osVersion = osInfo.version;
    }
    
    // Check if this is in first 10 clicks for campaign
    if (log.campaignId) {
      const isFirst10 = await checkIfFirst10Click(log.campaignId);
      if (isFirst10 && !log.tags.includes('first10')) {
        log.tags.push('first10');
      }
    }
    
    // Save to KV
    await LOGS.put(log.id, JSON.stringify(log));
    
    // Update campaign statistics
    if (log.campaignId) {
      await updateCampaignStats(log.campaignId, log.decision);
    }
    
    return new Response(JSON.stringify({
      success: true,
      id: log.id,
      message: 'Log created successfully'
    }), { status: 201 });
    
  } catch (error) {
    console.error('Error creating log:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create log',
        message: error.message 
      }),
      { status: 400 }
    );
  }
}

/**
 * List logs with filtering and pagination
 */
async function listLogs(request) {
  try {
    const url = new URL(request.url);
    
    // Parse query parameters
    const params = {
      page: parseInt(url.searchParams.get('page') || '1'),
      limit: parseInt(url.searchParams.get('limit') || '100'),
      campaign: url.searchParams.get('campaign'),
      type: url.searchParams.get('type'),
      decision: url.searchParams.get('decision'),
      tag: url.searchParams.get('tag'),
      startDate: url.searchParams.get('startDate'),
      endDate: url.searchParams.get('endDate'),
      search: url.searchParams.get('search')
    };
    
    // Fetch all logs
    const allLogs = await getAllLogs();
    
    // Apply filters
    let filteredLogs = allLogs;
    
    if (params.campaign && params.campaign !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.campaignId === params.campaign);
    }
    
    if (params.type && params.type !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.type === params.type);
    }
    
    if (params.decision && params.decision !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.decision === params.decision);
    }
    
    if (params.tag && params.tag !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.tags && log.tags.includes(params.tag));
    }
    
    if (params.startDate) {
      const startTime = new Date(params.startDate).getTime();
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp).getTime() >= startTime);
    }
    
    if (params.endDate) {
      const endTime = new Date(params.endDate).getTime() + 86400000; // End of day
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp).getTime() < endTime);
    }
    
    if (params.search) {
      const searchLower = params.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.ip?.toLowerCase().includes(searchLower) ||
        log.userAgent?.toLowerCase().includes(searchLower) ||
        log.country?.toLowerCase().includes(searchLower) ||
        log.city?.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Add campaign names
    const enrichedLogs = await enrichWithCampaignNames(filteredLogs);
    
    // Paginate
    const total = enrichedLogs.length;
    const start = (params.page - 1) * params.limit;
    const paginatedLogs = enrichedLogs.slice(start, start + params.limit);
    
    return new Response(JSON.stringify({
      logs: paginatedLogs,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: total,
        totalPages: Math.ceil(total / params.limit)
      }
    }));
    
  } catch (error) {
    console.error('Error listing logs:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to list logs',
        message: error.message 
      }),
      { status: 500 }
    );
  }
}

/**
 * Get a single log by ID
 */
async function getLog(logId) {
  try {
    const log = await LOGS.get(logId, 'json');
    
    if (!log) {
      return new Response(
        JSON.stringify({ error: 'Log not found' }),
        { status: 404 }
      );
    }
    
    // Add campaign name
    if (log.campaignId) {
      const campaign = await CAMPAIGNS.get(log.campaignId, 'json');
      log.campaignName = campaign?.name || 'Unknown Campaign';
    }
    
    return new Response(JSON.stringify(log));
    
  } catch (error) {
    console.error('Error getting log:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get log',
        message: error.message 
      }),
      { status: 500 }
    );
  }
}

/**
 * Get summary statistics
 */
async function getLogsSummary() {
  try {
    const logs = await getAllLogs();
    
    // Basic counts
    const total = logs.length;
    const passed = logs.filter(l => l.decision === 'blackhat').length;
    const blocked = logs.filter(l => l.decision === 'whitehat').length;
    const first10 = logs.filter(l => l.tags?.includes('first10')).length;
    
    // Calculate conversion rate
    const conversionRate = total > 0 ? ((passed / total) * 100).toFixed(2) : 0;
    
    // Get last 7 days stats
    const dailyStats = getDailyStats(logs, 7);
    
    // Get last 24 hours stats
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLogs = logs.filter(l => new Date(l.timestamp) > last24Hours);
    
    return new Response(JSON.stringify({
      total,
      passed,
      blocked,
      first10,
      conversionRate,
      dailyStats,
      last24Hours: {
        total: recentLogs.length,
        passed: recentLogs.filter(l => l.decision === 'blackhat').length,
        blocked: recentLogs.filter(l => l.decision === 'whitehat').length
      }
    }));
    
  } catch (error) {
    console.error('Error getting summary:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get summary' }),
      { status: 500 }
    );
  }
}

/**
 * Get logs grouped by campaign
 */
async function getLogsByCampaign(request) {
  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '7');
    
    const logs = await getAllLogs();
    
    // Filter by date range
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentLogs = logs.filter(l => new Date(l.timestamp) > cutoff);
    
    // Group by campaign
    const campaigns = {};
    
    for (const log of recentLogs) {
      if (!log.campaignId) continue;
      
      if (!campaigns[log.campaignId]) {
        const campaign = await CAMPAIGNS.get(log.campaignId, 'json');
        campaigns[log.campaignId] = {
          id: log.campaignId,
          name: campaign?.name || 'Unknown Campaign',
          total: 0,
          passed: 0,
          blocked: 0,
          first10: 0,
          conversionRate: 0
        };
      }
      
      campaigns[log.campaignId].total++;
      
      if (log.decision === 'blackhat') {
        campaigns[log.campaignId].passed++;
      } else {
        campaigns[log.campaignId].blocked++;
      }
      
      if (log.tags?.includes('first10')) {
        campaigns[log.campaignId].first10++;
      }
    }
    
    // Calculate conversion rates
    Object.values(campaigns).forEach(campaign => {
      campaign.conversionRate = campaign.total > 0 
        ? ((campaign.passed / campaign.total) * 100).toFixed(2) 
        : 0;
    });
    
    // Sort by total clicks
    const sorted = Object.values(campaigns).sort((a, b) => b.total - a.total);
    
    return new Response(JSON.stringify({ campaigns: sorted }));
    
  } catch (error) {
    console.error('Error getting campaign stats:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get campaign statistics' }),
      { status: 500 }
    );
  }
}

/**
 * Get logs grouped by type
 */
async function getLogsByType() {
  try {
    const logs = await getAllLogs();
    
    // Define log types
    const types = {
      click: { name: 'Successful Clicks', total: 0, passed: 0, blocked: 0 },
      validation: { name: 'Failed Validations', total: 0, passed: 0, blocked: 0 },
      pending: { name: 'Initial Checks', total: 0, passed: 0, blocked: 0 }
    };
    
    // Count by type and decision
    logs.forEach(log => {
      if (types[log.type]) {
        types[log.type].total++;
        if (log.decision === 'blackhat') {
          types[log.type].passed++;
        } else {
          types[log.type].blocked++;
        }
      }
    });
    
    return new Response(JSON.stringify({ types }));
    
  } catch (error) {
    console.error('Error getting type stats:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get type statistics' }),
      { status: 500 }
    );
  }
}

/**
 * Export logs as CSV
 */
async function exportLogs(request) {
  try {
    const url = new URL(request.url);
    
    // Get filtered logs (reuse listLogs logic)
    const logsResponse = await listLogs(request);
    const data = await logsResponse.json();
    
    if (!data.logs) {
      throw new Error('No logs to export');
    }
    
    // Generate CSV
    const csv = generateCSV(data.logs);
    
    // Return CSV file
    const filename = `tiktok-clicks-${new Date().toISOString().split('T')[0]}.csv`;
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('Error exporting logs:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to export logs' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Clear old logs
 */
async function clearOldLogs(request) {
  try {
    const { days } = await request.json();
    
    if (!days || days < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid days parameter' }),
        { status: 400 }
      );
    }
    
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const keys = await LOGS.list();
    let deleted = 0;
    
    // Delete in batches
    const deletePromises = [];
    
    for (const key of keys.keys) {
      const log = await LOGS.get(key.name, 'json');
      if (log && new Date(log.timestamp) < cutoff) {
        deletePromises.push(LOGS.delete(key.name));
        deleted++;
        
        // Process in batches of 50
        if (deletePromises.length >= 50) {
          await Promise.all(deletePromises);
          deletePromises.length = 0;
        }
      }
    }
    
    // Process remaining
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
    
    return new Response(JSON.stringify({
      success: true,
      deleted,
      message: `Deleted ${deleted} logs older than ${days} days`
    }));
    
  } catch (error) {
    console.error('Error clearing logs:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to clear logs' }),
      { status: 500 }
    );
  }
}

/**
 * Fix first10 tags for existing logs
 */
async function fixFirst10Tags(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetCampaign = body.campaignId;
    
    const logs = await getAllLogs();
    
    // Group by campaign
    const campaigns = {};
    logs.forEach(log => {
      if (!log.campaignId) return;
      if (targetCampaign && log.campaignId !== targetCampaign) return;
      
      if (!campaigns[log.campaignId]) {
        campaigns[log.campaignId] = [];
      }
      campaigns[log.campaignId].push(log);
    });
    
    let updated = 0;
    
    // Process each campaign
    for (const [campaignId, campaignLogs] of Object.entries(campaigns)) {
      // Sort by timestamp (oldest first)
      campaignLogs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Update first 10
      const first10 = campaignLogs.slice(0, 10);
      
      for (const log of first10) {
        if (!log.tags) log.tags = [];
        
        if (!log.tags.includes('first10')) {
          log.tags.push('first10');
          await LOGS.put(log.id, JSON.stringify(log));
          updated++;
        }
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      updated,
      message: `Updated ${updated} logs with first10 tag`
    }));
    
  } catch (error) {
    console.error('Error fixing first10 tags:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fix first10 tags' }),
      { status: 500 }
    );
  }
}

/**
 * Get campaigns list for dropdown
 */
async function getCampaignsList() {
  try {
    const keys = await CAMPAIGNS.list();
    const campaigns = [];
    
    for (const key of keys.keys) {
      const campaign = await CAMPAIGNS.get(key.name, 'json');
      if (campaign) {
        campaigns.push({
          id: campaign.id,
          name: campaign.name || 'Unnamed Campaign'
        });
      }
    }
    
    // Sort alphabetically
    campaigns.sort((a, b) => a.name.localeCompare(b.name));
    
    return new Response(JSON.stringify({ campaigns }));
    
  } catch (error) {
    console.error('Error getting campaigns:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get campaigns' }),
      { status: 500 }
    );
  }
}

// Helper Functions

/**
 * Get all logs from KV store
 */
async function getAllLogs() {
  const keys = await LOGS.list();
  const logs = [];
  
  // Fetch in batches
  const batchSize = 50;
  const promises = [];
  
  for (const key of keys.keys) {
    promises.push(LOGS.get(key.name, 'json'));
    
    if (promises.length >= batchSize) {
      const batch = await Promise.all(promises);
      logs.push(...batch.filter(Boolean));
      promises.length = 0;
    }
  }
  
  // Process remaining
  if (promises.length > 0) {
    const batch = await Promise.all(promises);
    logs.push(...batch.filter(Boolean));
  }
  
  return logs;
}

/**
 * Check if a click is in the first 10 for a campaign
 */
async function checkIfFirst10Click(campaignId) {
  const keys = await LOGS.list();
  let count = 0;
  
  for (const key of keys.keys) {
    const log = await LOGS.get(key.name, 'json');
    if (log && log.campaignId === campaignId) {
      count++;
      if (count >= 10) return false;
    }
  }
  
  return true;
}

/**
 * Update campaign statistics (optional - for future use)
 */
async function updateCampaignStats(campaignId, decision) {
  // This could update a separate stats KV namespace
  // For now, we calculate stats on demand
}

/**
 * Enrich logs with campaign names
 */
async function enrichWithCampaignNames(logs) {
  const campaignCache = {};
  
  for (const log of logs) {
    if (log.campaignId) {
      if (!campaignCache[log.campaignId]) {
        const campaign = await CAMPAIGNS.get(log.campaignId, 'json');
        campaignCache[log.campaignId] = campaign?.name || 'Unknown Campaign';
      }
      log.campaignName = campaignCache[log.campaignId];
    }
  }
  
  return logs;
}

/**
 * Get daily statistics
 */
function getDailyStats(logs, days) {
  const stats = [];
  const now = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const dayLogs = logs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= date && logDate < nextDate;
    });
    
    stats.unshift({
      date: date.toISOString().split('T')[0],
      total: dayLogs.length,
      passed: dayLogs.filter(l => l.decision === 'blackhat').length,
      blocked: dayLogs.filter(l => l.decision === 'whitehat').length,
      first10: dayLogs.filter(l => l.tags?.includes('first10')).length
    });
  }
  
  return stats;
}

/**
 * Detect OS from user agent
 */
function detectOSFromUserAgent(userAgent) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    const match = userAgent.match(/OS (\d+)/);
    return { os: 'ios', version: match ? parseInt(match[1]) : 0 };
  }
  
  if (/Android/i.test(userAgent)) {
    const match = userAgent.match(/Android (\d+)/);
    return { os: 'android', version: match ? parseInt(match[1]) : 0 };
  }
  
  if (/Windows/i.test(userAgent)) {
    return { os: 'windows', version: 0 };
  }
  
  if (/Mac OS/i.test(userAgent)) {
    return { os: 'macos', version: 0 };
  }
  
  return { os: 'unknown', version: 0 };
}

/**
 * Generate CSV from logs
 */
function generateCSV(logs) {
  const headers = [
    'Timestamp',
    'Campaign',
    'Campaign ID',
    'Launch',
    'Type',
    'Decision',
    'IP Address',
    'Country',
    'Region',
    'City',
    'OS',
    'User Agent',
    'Referrer',
    'URL',
    'TTCLID',
    'Tags'
  ];
  
  const rows = [headers.join(',')];
  
  logs.forEach(log => {
    const row = [
      log.timestamp || '',
      escapeCSV(log.campaignName || ''),
      log.campaignId || '',
      log.launchNumber !== undefined ? log.launchNumber : '',
      log.type || '',
      log.decision || '',
      log.ip || '',
      log.country || '',
      log.region || '',
      log.city || '',
      log.os || '',
      escapeCSV(log.userAgent || ''),
      escapeCSV(log.referer || ''),
      escapeCSV(log.url || ''),
      log.params?.ttclid || '',
      (log.tags || []).join(';')
    ];
    
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
}

/**
 * Escape CSV values
 */
function escapeCSV(value) {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Perform scheduled tasks
 */
async function performScheduledTasks() {
  try {
    console.log('Running scheduled tasks');
    
    // Fix first10 tags
    await fixFirst10Tags(new Request('https://logs.maximillillianh.workers.dev/api/logs/fix-first10', {
      method: 'POST',
      body: JSON.stringify({})
    }));
    
    // Clean up old logs (older than 90 days)
    await clearOldLogs(new Request('https://logs.maximillillianh.workers.dev/api/logs/clear', {
      method: 'POST',
      body: JSON.stringify({ days: 90 })
    }));
    
    console.log('Scheduled tasks completed');
  } catch (error) {
    console.error('Error in scheduled tasks:', error);
  }
}

// Client-side JavaScript code
const LOGS_CLIENT_JS = `
// Global state
let currentPage = 1;
let totalPages = 1;
let logs = [];
let charts = {};
let currentLogData = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing logs interface');
  
  initializeDatePickers();
  loadCampaigns();
  loadLogs();
  loadStatistics();
  setupEventListeners();
  
  // Auto-refresh every 30 seconds
  setInterval(() => {
    loadLogs();
    loadStatistics();
  }, 30000);
});

// Initialize date pickers
function initializeDatePickers() {
  flatpickr('.datepicker', {
    dateFormat: 'Y-m-d',
    maxDate: 'today'
  });
}

function setupEventListeners() {
  // Filter buttons
  document.getElementById('btn-apply-filters').addEventListener('click', applyFilters);
  document.getElementById('btn-reset-filters').addEventListener('click', resetFilters);
  
  // Action buttons
  document.getElementById('btn-export').addEventListener('click', exportLogs);
  document.getElementById('btn-clear-logs').addEventListener('click', showClearLogsModal);
  
  // Fix the refresh button
  const refreshBtn = document.getElementById('btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Refresh button clicked');
      
      // Add spinning animation
      const icon = this.querySelector('i');
      if (icon) {
        icon.classList.add('fa-spin');
      }
      
      // Disable button during refresh
      this.disabled = true;
      
      // Call both functions to refresh data
      Promise.all([loadLogs(), loadStatistics()]).then(() => {
        // Remove spinning and re-enable after completion
        if (icon) {
          icon.classList.remove('fa-spin');
        }
        this.disabled = false;
      }).catch(error => {
        console.error('Error refreshing:', error);
        if (icon) {
          icon.classList.remove('fa-spin');
        }
        this.disabled = false;
      });
    });
  }
  
  // Pagination
  document.getElementById('btn-prev-page').addEventListener('click', function() {
    if (currentPage > 1) {
      currentPage--;
      loadLogs();
    }
  });
  
  document.getElementById('btn-next-page').addEventListener('click', function() {
    if (currentPage < totalPages) {
      currentPage++;
      loadLogs();
    }
  });
  
  // Log detail modal close button
  const closeDetailBtn = document.getElementById('btn-close-detail');
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Close detail button clicked');
      closeLogDetailModal();
    });
  }
  
  // Close modal when clicking outside
  const logDetailModal = document.getElementById('log-detail-modal');
  if (logDetailModal) {
    logDetailModal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeLogDetailModal();
      }
    });
  }
  
  // JSON toggle button
  const toggleJsonBtn = document.getElementById('btn-toggle-json');
  if (toggleJsonBtn) {
    toggleJsonBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Toggle JSON button clicked');
      toggleJsonView();
    });
  }
  
  // Clear logs modal
  document.getElementById('btn-cancel-clear').addEventListener('click', function() {
    document.getElementById('clear-logs-modal').classList.add('hidden');
  });
  
  document.getElementById('btn-confirm-clear').addEventListener('click', confirmClearLogs);
  
  // Enter key on search
  document.getElementById('filter-search').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') applyFilters();
  });
}

// Close log detail modal
function closeLogDetailModal() {
  const modal = document.getElementById('log-detail-modal');
  if (modal) {
    modal.classList.add('hidden');
    // Reset to formatted view
    document.getElementById('log-detail-content').classList.remove('hidden');
    document.getElementById('log-json-content').classList.add('hidden');
    document.getElementById('json-toggle-text').textContent = 'View Raw JSON';
    currentLogData = null;
  }
}

// Load campaigns for dropdown
async function loadCampaigns() {
  try {
    const response = await fetch('/api/campaigns/list');
    const data = await response.json();
    
    const select = document.getElementById('filter-campaign');
    select.innerHTML = '<option value="all">All Campaigns</option>';
    
    data.campaigns.forEach(campaign => {
      const option = document.createElement('option');
      option.value = campaign.id;
      option.textContent = campaign.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading campaigns:', error);
  }
}

// Load logs
async function loadLogs() {
  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: 100,
      campaign: document.getElementById('filter-campaign').value,
      type: document.getElementById('filter-type').value,
      decision: document.getElementById('filter-decision').value,
      tag: document.getElementById('filter-tag').value,
      startDate: document.getElementById('filter-start-date').value,
      endDate: document.getElementById('filter-end-date').value,
      search: document.getElementById('filter-search').value
    });
    
    const response = await fetch(\`/api/logs?\${params}\`);
    const data = await response.json();
    
    logs = data.logs;
    currentPage = data.pagination.page;
    totalPages = data.pagination.totalPages;
    
    renderLogsTable();
    updatePagination(data.pagination);
    
  } catch (error) {
    console.error('Error loading logs:', error);
    showError('Failed to load logs');
  }
}

// Load statistics
async function loadStatistics() {
  try {
    // Get summary stats
    const summaryResponse = await fetch('/api/logs/summary');
    const summary = await summaryResponse.json();
    
    // Update stat cards
    document.getElementById('stat-total').textContent = summary.total.toLocaleString();
    document.getElementById('stat-conversion').textContent = summary.conversionRate + '%';
    document.getElementById('stat-blocked').textContent = summary.blocked.toLocaleString();
    document.getElementById('stat-first10').textContent = summary.first10.toLocaleString();
    document.getElementById('stat-24h-total').textContent = summary.last24Hours.total.toLocaleString();
    
    // Update daily traffic chart
    updateDailyTrafficChart(summary.dailyStats);
    
    // Get campaign stats
    const campaignResponse = await fetch('/api/logs/by-campaign?days=7');
    const campaignData = await campaignResponse.json();
    updateCampaignChart(campaignData.campaigns);
    
  } catch (error) {
    console.error('Error loading statistics:', error);
  }
}

// Render logs table
function renderLogsTable() {
  const tbody = document.getElementById('logs-table-body');
  
  if (logs.length === 0) {
    tbody.innerHTML = \`
      <tr>
        <td colspan="9" class="px-6 py-4 text-center text-gray-500">
          No logs found
        </td>
      </tr>
    \`;
    return;
  }
  
  tbody.innerHTML = logs.map(log => \`
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        \${formatDateTime(log.timestamp)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        \${log.campaignName || '-'}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        \${log.launchNumber !== undefined ? log.launchNumber : '-'}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        \${getTypeBadge(log.type)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        \${formatLocation(log)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        \${formatOS(log.os, log.osVersion)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        \${getDecisionBadge(log.decision)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap">
        \${formatTags(log.tags)}
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <button onclick="viewLogDetail('\${log.id}')" class="text-blue-600 hover:text-blue-900">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  \`).join('');
}

// Update pagination
function updatePagination(pagination) {
  document.getElementById('logs-start').textContent = ((pagination.page - 1) * pagination.limit + 1).toLocaleString();
  document.getElementById('logs-end').textContent = Math.min(pagination.page * pagination.limit, pagination.total).toLocaleString();
  document.getElementById('logs-total').textContent = pagination.total.toLocaleString();
  document.getElementById('logs-count').textContent = pagination.total.toLocaleString();
  document.getElementById('current-page').textContent = pagination.page;
  document.getElementById('total-pages').textContent = pagination.totalPages;
  
  // Enable/disable buttons
  document.getElementById('btn-prev-page').disabled = pagination.page === 1;
  document.getElementById('btn-next-page').disabled = pagination.page === pagination.totalPages;
}

// View log detail
async function viewLogDetail(logId) {
  try {
    const response = await fetch('/api/logs/' + logId);
    const log = await response.json();
    
    // Store current log data for JSON view
    currentLogData = log;
    
    const content = document.getElementById('log-detail-content');
    let html = '<div class="space-y-6">';
    
    // Basic Info
    html += '<div>';
    html += '<h4 class="font-semibold text-gray-900 mb-3">Basic Information</h4>';
    html += '<dl class="grid grid-cols-2 gap-4">';
    html += '<div>';
    html += '<dt class="text-sm font-medium text-gray-500">Log ID</dt>';
    html += '<dd class="mt-1 text-sm text-gray-900">' + log.id + '</dd>';
    html += '</div>';
    html += '<div>';
    html += '<dt class="text-sm font-medium text-gray-500">Timestamp</dt>';
    html += '<dd class="mt-1 text-sm text-gray-900">' + formatDateTime(log.timestamp) + '</dd>';
    html += '</div>';
    html += '<div>';
    html += '<dt class="text-sm font-medium text-gray-500">Type</dt>';
    html += '<dd class="mt-1">' + getTypeBadge(log.type) + '</dd>';
    html += '</div>';
    html += '<div>';
    html += '<dt class="text-sm font-medium text-gray-500">Decision</dt>';
    html += '<dd class="mt-1">' + getDecisionBadge(log.decision) + '</dd>';
    html += '</div>';
    html += '</dl>';
    html += '</div>';
    
    // Campaign Info
    if (log.campaignId) {
      html += '<div>';
      html += '<h4 class="font-semibold text-gray-900 mb-3">Campaign Information</h4>';
      html += '<dl class="grid grid-cols-2 gap-4">';
      html += '<div>';
      html += '<dt class="text-sm font-medium text-gray-500">Campaign Name</dt>';
      html += '<dd class="mt-1 text-sm text-gray-900">' + (log.campaignName || 'Unknown') + '</dd>';
      html += '</div>';
      html += '<div>';
      html += '<dt class="text-sm font-medium text-gray-500">Campaign ID</dt>';
      html += '<dd class="mt-1 text-sm text-gray-900 font-mono">' + log.campaignId + '</dd>';
      html += '</div>';
      
      if (log.launchNumber !== undefined) {
        html += '<div>';
        html += '<dt class="text-sm font-medium text-gray-500">Launch Number</dt>';
        html += '<dd class="mt-1 text-sm text-gray-900">' + log.launchNumber + '</dd>';
        html += '</div>';
      }
      
      html += '</dl>';
      html += '</div>';
    }
    
    // Location Info
    html += '<div>';
    html += '<h4 class="font-semibold text-gray-900 mb-3">Location Information</h4>';
    html += '<dl class="grid grid-cols-2 gap-4">';
    html += '<div>';
    html += '<dt class="text-sm font-medium text-gray-500">IP Address</dt>';
    html += '<dd class="mt-1 text-sm text-gray-900">' + (log.ip || 'Unknown') + '</dd>';
    html += '</div>';
    html += '<div>';
    html += '<dt class="text-sm font-medium text-gray-500">Country</dt>';
    html += '<dd class="mt-1 text-sm text-gray-900">' + (log.country || 'Unknown') + '</dd>';
    html += '</div>';
    
    if (log.region) {
      html += '<div>';
      html += '<dt class="text-sm font-medium text-gray-500">Region</dt>';
      html += '<dd class="mt-1 text-sm text-gray-900">' + log.region + '</dd>';
      html += '</div>';
    }
    
    if (log.city) {
      html += '<div>';
      html += '<dt class="text-sm font-medium text-gray-500">City</dt>';
      html += '<dd class="mt-1 text-sm text-gray-900">' + log.city + '</dd>';
      html += '</div>';
    }
    
    html += '</dl>';
    html += '</div>';
    
    // Device Info
    html += '<div>';
    html += '<h4 class="font-semibold text-gray-900 mb-3">Device Information</h4>';
    html += '<dl class="space-y-3">';
    html += '<div>';
    html += '<dt class="text-sm font-medium text-gray-500">Operating System</dt>';
    html += '<dd class="mt-1 text-sm text-gray-900">' + formatOS(log.os, log.osVersion) + '</dd>';
    html += '</div>';
    html += '<div>';
    html += '<dt class="text-sm font-medium text-gray-500">User Agent</dt>';
    html += '<dd class="mt-1 text-sm text-gray-900 break-all bg-gray-50 p-2 rounded">' + (log.userAgent || 'Unknown') + '</dd>';
    html += '</div>';
    
    if (log.referer) {
      html += '<div>';
      html += '<dt class="text-sm font-medium text-gray-500">Referrer</dt>';
      html += '<dd class="mt-1 text-sm text-gray-900 break-all">' + log.referer + '</dd>';
      html += '</div>';
    }
    
    html += '</dl>';
    html += '</div>';
    
    // Request Info
    if (log.url || log.params) {
      html += '<div>';
      html += '<h4 class="font-semibold text-gray-900 mb-3">Request Information</h4>';
      html += '<dl class="space-y-3">';
      
      if (log.url) {
        html += '<div>';
        html += '<dt class="text-sm font-medium text-gray-500">URL</dt>';
        html += '<dd class="mt-1 text-sm text-gray-900 break-all bg-gray-50 p-2 rounded">' + log.url + '</dd>';
        html += '</div>';
      }
      
      if (log.params && Object.keys(log.params).length > 0) {
        html += '<div>';
        html += '<dt class="text-sm font-medium text-gray-500">Parameters</dt>';
        html += '<dd class="mt-1 text-sm text-gray-900">';
        html += '<dl class="mt-2 space-y-1">';
        
        for (const key in log.params) {
          if (log.params.hasOwnProperty(key)) {
            html += '<div class="flex">';
            html += '<dt class="font-medium mr-2">' + key + ':</dt>';
            html += '<dd>' + (log.params[key] || 'null') + '</dd>';
            html += '</div>';
          }
        }
        
        html += '</dl>';
        html += '</dd>';
        html += '</div>';
      }
      
      html += '</dl>';
      html += '</div>';
    }
    
    // Tags
    if (log.tags && log.tags.length > 0) {
      html += '<div>';
      html += '<h4 class="font-semibold text-gray-900 mb-3">Tags</h4>';
      html += '<div>' + formatTags(log.tags) + '</div>';
      html += '</div>';
    }
    
    html += '</div>';
    
    content.innerHTML = html;
    
    // Update JSON content
    const jsonContentElement = document.getElementById('log-json-content');
    jsonContentElement.textContent = JSON.stringify(log, null, 2);
    
    // Reset view to formatted
    document.getElementById('log-detail-content').classList.remove('hidden');
    document.getElementById('log-json-content').classList.add('hidden');
    document.getElementById('json-toggle-text').textContent = 'View Raw JSON';
    
    // Show modal
    document.getElementById('log-detail-modal').classList.remove('hidden');
    
  } catch (error) {
    console.error('Error loading log detail:', error);
    alert('Error loading log details');
  }
}

// Toggle between formatted and JSON view
function toggleJsonView() {
  const detailContent = document.getElementById('log-detail-content');
  const jsonContent = document.getElementById('log-json-content');
  const toggleText = document.getElementById('json-toggle-text');
  
  if (!detailContent || !jsonContent || !toggleText) {
    console.error('Could not find required elements for JSON toggle');
    return;
  }
  
  if (detailContent.classList.contains('hidden')) {
    // Show formatted view
    detailContent.classList.remove('hidden');
    jsonContent.classList.add('hidden');
    toggleText.textContent = 'View Raw JSON';
  } else {
    // Show JSON view
    detailContent.classList.add('hidden');
    jsonContent.classList.remove('hidden');
    toggleText.textContent = 'View Formatted';
  }
}

// Make viewLogDetail available globally for onclick handlers
window.viewLogDetail = viewLogDetail;

// Update daily traffic chart
function updateDailyTrafficChart(dailyStats) {
  const ctx = document.getElementById('daily-traffic-chart').getContext('2d');
  
  if (charts.dailyTraffic) {
    charts.dailyTraffic.destroy();
  }
  
  charts.dailyTraffic = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dailyStats.map(d => formatDate(d.date)),
      datasets: [{
        label: 'Passed',
        data: dailyStats.map(d => d.passed),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.3
      }, {
        label: 'Blocked',
        data: dailyStats.map(d => d.blocked),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// Update campaign chart
function updateCampaignChart(campaigns) {
  const ctx = document.getElementById('campaign-performance-chart').getContext('2d');
  
  if (charts.campaigns) {
    charts.campaigns.destroy();
  }
  
  // Get top 10 campaigns
  const topCampaigns = campaigns.slice(0, 10);
  
  charts.campaigns = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topCampaigns.map(c => c.name),
      datasets: [{
        label: 'Total Clicks',
        data: topCampaigns.map(c => c.total),
        backgroundColor: 'rgba(99, 102, 241, 0.8)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// Apply filters
function applyFilters() {
  currentPage = 1;
  loadLogs();
}

// Reset filters
function resetFilters() {
  document.getElementById('filter-campaign').value = 'all';
  document.getElementById('filter-type').value = 'all';
  document.getElementById('filter-decision').value = 'all';
  document.getElementById('filter-tag').value = 'all';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  document.getElementById('filter-search').value = '';
  
  currentPage = 1;
  loadLogs();
}

// Export logs
function exportLogs() {
  const params = new URLSearchParams({
    campaign: document.getElementById('filter-campaign').value,
    type: document.getElementById('filter-type').value,
    decision: document.getElementById('filter-decision').value,
    tag: document.getElementById('filter-tag').value,
    startDate: document.getElementById('filter-start-date').value,
    endDate: document.getElementById('filter-end-date').value,
    search: document.getElementById('filter-search').value
  });
  
  window.open(\`/api/logs/export?\${params}\`, '_blank');
}

// Show clear logs modal
function showClearLogsModal() {
  document.getElementById('clear-logs-modal').classList.remove('hidden');
}

// Confirm clear logs
async function confirmClearLogs() {
  const days = parseInt(document.getElementById('clear-days-input').value);
  
  if (!days || days < 1) {
    alert('Please enter a valid number of days');
    return;
  }
  
  try {
    const response = await fetch('/api/logs/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert(data.message);
      document.getElementById('clear-logs-modal').classList.add('hidden');
      loadLogs();
      loadStatistics();
    } else {
      alert(data.error || 'Failed to clear logs');
    }
  } catch (error) {
    console.error('Error clearing logs:', error);
    alert('Failed to clear logs');
  }
}

// Helper functions
function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString();
}

function formatLocation(log) {
  const parts = [log.country];
  if (log.city) parts.push(log.city);
  return parts.join(', ') || 'Unknown';
}

function formatOS(os, version) {
  if (!os || os === 'unknown') return 'Unknown';
  
  const osNames = {
    ios: 'iOS',
    android: 'Android',
    windows: 'Windows',
    macos: 'macOS'
  };
  
  const name = osNames[os] || os;
  return version ? \`\${name} \${version}\` : name;
}

function getTypeBadge(type) {
  const badges = {
    click: '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Click</span>',
    validation: '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Validation</span>',
    pending: '<span class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Pending</span>'
  };
  return badges[type] || \`<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">\${type}</span>\`;
}

function getDecisionBadge(decision) {
  if (decision === 'blackhat') {
    return '<span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Passed</span>';
  } else if (decision === 'whitehat') {
    return '<span class="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Blocked</span>';
  }
  return '<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Unknown</span>';
}

function formatTags(tags) {
  if (!tags || tags.length === 0) return '-';
  
  return tags.map(tag => {
    if (tag === 'first10') {
      return '<span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">First 10</span>';
    }
    return \`<span class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">\${tag}</span>\`;
  }).join(' ');
}

function showError(message) {
  const tbody = document.getElementById('logs-table-body');
  tbody.innerHTML = \`
    <tr>
      <td colspan="9" class="px-6 py-4 text-center text-red-500">
        <i class="fas fa-exclamation-triangle mr-2"></i>\${message}
      </td>
    </tr>
  \`;
}
`;

// HTML template
const LOGS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TikTok Ad Cloaker - Click Logs</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/flatpickr/4.6.13/flatpickr.min.js"></script>
  <style>
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .fade-in {
      animation: fadeIn 0.3s ease-in;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .chart-container {
      position: relative;
      height: 300px;
    }
    #log-detail-modal {
      z-index: 9999;
    }
    .modal-content {
      max-height: 90vh;
      overflow-y: auto;
    }
  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div class="flex h-screen bg-gray-100">
    <!-- Sidebar -->
    <div class="bg-gray-800 text-white w-64 flex-shrink-0">
      <div class="p-4 text-xl font-bold">Ad Cloaker Admin</div>
      <nav class="mt-8">
        <a href="https://dashboard.maximillillianh.workers.dev" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-chart-line mr-2"></i> Dashboard
        </a>
        <a href="https://campaigns.maximillillianh.workers.dev" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-bullhorn mr-2"></i> Campaigns
        </a>
        <a href="https://sparks.maximillillianh.workers.dev" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-fire mr-2"></i> Sparks
        </a>
        <a href="https://comments.maximillillianh.workers.dev" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-comments mr-2"></i> Comment Bot
        </a>
        <a href="https://bcgen.maximillillianh.workers.dev" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-users mr-2"></i> BC Generator
        </a>
        <a href="https://shopifystores.maximillillianh.workers.dev" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-store mr-2"></i> Shopify Stores
        </a>
        <a href="https://templates.maximillillianh.workers.dev" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-file-code mr-2"></i> Templates
        </a>
        <a href="https://logs.maximillillianh.workers.dev" class="block py-2.5 px-4 rounded transition duration-200 bg-gray-700 hover:bg-gray-700">
          <i class="fas fa-list mr-2"></i> Logs
        </a>
        <a href="https://settings.maximillillianh.workers.dev" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-cog mr-2"></i> Settings
        </a>
      </nav>
    </div>
    
    <!-- Main Content -->
    <div class="flex-1 overflow-x-hidden overflow-y-auto">
      <div class="p-6">
        <!-- Header -->
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-gray-800">Click Tracking Logs</h1>
          <p class="text-gray-600 mt-1">Monitor and analyze your TikTok ad campaign performance</p>
        </div>
        
        <!-- Statistics Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <!-- Total Clicks -->
          <div class="stat-card text-white rounded-lg shadow-lg p-6 fade-in">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-white opacity-75 text-sm">Total Clicks</p>
                <p class="text-3xl font-bold" id="stat-total">0</p>
                <p class="text-sm opacity-75 mt-1">Last 24h: <span id="stat-24h-total">0</span></p>
              </div>
              <i class="fas fa-mouse-pointer text-4xl opacity-50"></i>
            </div>
          </div>
          
          <!-- Conversion Rate -->
          <div class="bg-green-500 text-white rounded-lg shadow-lg p-6 fade-in">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-green-100 text-sm">Conversion Rate</p>
                <p class="text-3xl font-bold" id="stat-conversion">0%</p>
                <p class="text-sm text-green-100 mt-1">Passed validation</p>
              </div>
              <i class="fas fa-percentage text-4xl opacity-50"></i>
            </div>
          </div>
          
          <!-- Blocked Clicks -->
          <div class="bg-red-500 text-white rounded-lg shadow-lg p-6 fade-in">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-red-100 text-sm">Blocked Clicks</p>
                <p class="text-3xl font-bold" id="stat-blocked">0</p>
                <p class="text-sm text-red-100 mt-1">Failed validation</p>
              </div>
              <i class="fas fa-shield-alt text-4xl opacity-50"></i>
            </div>
          </div>
          
          <!-- First 10 Clicks -->
          <div class="bg-blue-500 text-white rounded-lg shadow-lg p-6 fade-in">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-blue-100 text-sm">First 10 Clicks</p>
                <p class="text-3xl font-bold" id="stat-first10">0</p>
                <p class="text-sm text-blue-100 mt-1">Testing phase</p>
              </div>
              <i class="fas fa-flag text-4xl opacity-50"></i>
            </div>
          </div>
        </div>
        
        <!-- Filters Section -->
        <div class="bg-white rounded-lg shadow mb-6 p-6">
          <h2 class="text-lg font-semibold mb-4">Filter Logs</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <!-- Campaign Filter -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Campaign</label>
              <select id="filter-campaign" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Campaigns</option>
              </select>
            </div>
            
            <!-- Type Filter -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select id="filter-type" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Types</option>
                <option value="click">Successful Clicks</option>
                <option value="validation">Failed Validations</option>
                <option value="pending">Initial Checks</option>
              </select>
            </div>
            
            <!-- Decision Filter -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Decision</label>
              <select id="filter-decision" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Decisions</option>
                <option value="blackhat">Passed (Real Users)</option>
                <option value="whitehat">Blocked (Bots/Invalid)</option>
              </select>
            </div>
            
            <!-- Tag Filter -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <select id="filter-tag" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Tags</option>
                <option value="first10">First 10 Clicks</option>
              </select>
            </div>
            
            <!-- Date Range -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="text" id="filter-start-date" class="datepicker w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Select date">
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="text" id="filter-end-date" class="datepicker w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Select date">
            </div>
            
            <!-- Search -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input type="text" id="filter-search" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="IP, country, city...">
            </div>
            
            <!-- Action Buttons -->
            <div class="flex items-end space-x-2">
              <button id="btn-apply-filters" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                <i class="fas fa-filter mr-2"></i>Apply
              </button>
              <button id="btn-reset-filters" class="bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors">
                <i class="fas fa-undo"></i>
              </button>
            </div>
          </div>
          
          <!-- Quick Actions -->
          <div class="mt-4 pt-4 border-t flex justify-between items-center">
            <div class="text-sm text-gray-600">
              <span id="logs-count">0</span> logs found
            </div>
            <div class="space-x-2">
              <button id="btn-export" class="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                <i class="fas fa-download mr-2"></i>Export CSV
              </button>
              <button id="btn-clear-logs" class="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                <i class="fas fa-trash mr-2"></i>Clear Old Logs
              </button>
              <button id="btn-refresh" class="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                <i class="fas fa-sync-alt mr-2"></i>Refresh
              </button>
            </div>
          </div>
        </div>
        
        <!-- Charts Section -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <!-- Daily Traffic Chart -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold mb-4">Daily Traffic (Last 7 Days)</h3>
            <div class="chart-container">
              <canvas id="daily-traffic-chart"></canvas>
            </div>
          </div>
          
          <!-- Campaign Performance Chart -->
          <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold mb-4">Top Campaigns</h3>
            <div class="chart-container">
              <canvas id="campaign-performance-chart"></canvas>
            </div>
          </div>
        </div>
        
        <!-- Logs Table -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-semibold">Recent Clicks</h3>
          </div>
          
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Launch</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OS</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Decision</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody id="logs-table-body" class="bg-white divide-y divide-gray-200">
                <tr>
                  <td colspan="9" class="px-6 py-4 text-center text-gray-500">
                    <i class="fas fa-spinner fa-spin mr-2"></i>Loading logs...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Pagination -->
          <div class="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div class="text-sm text-gray-700">
              Showing <span id="logs-start">0</span> to <span id="logs-end">0</span> of <span id="logs-total">0</span> results
            </div>
            <div class="flex space-x-2">
              <button id="btn-prev-page" class="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                <i class="fas fa-chevron-left"></i>
              </button>
              <span class="px-3 py-1 text-sm font-medium text-gray-700">
                Page <span id="current-page">1</span> of <span id="total-pages">1</span>
              </span>
              <button id="btn-next-page" class="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                <i class="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Log Detail Modal -->
  <div id="log-detail-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full modal-content">
        <div class="sticky top-0 bg-white flex items-center justify-between px-6 py-4 border-b">
          <h3 class="text-lg font-semibold">Log Details</h3>
          <div class="flex items-center space-x-3">
            <button id="btn-toggle-json" class="text-blue-600 hover:text-blue-800 text-sm font-medium">
              <i class="fas fa-code mr-1"></i>
              <span id="json-toggle-text">View Raw JSON</span>
            </button>
            <button id="btn-close-detail" class="text-gray-400 hover:text-gray-600">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>
        <div id="log-detail-content" class="px-6 py-4">
          <!-- Log details will be inserted here -->
        </div>
        <pre id="log-json-content" class="hidden px-6 py-4 bg-gray-50 text-sm">
          <!-- Raw JSON will be inserted here -->
        </pre>
      </div>
    </div>
  </div>
  
  <!-- Clear Logs Modal -->
  <div id="clear-logs-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
    <div class="flex items-center justify-center min-h-screen p-4">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div class="px-6 py-4 border-b">
          <h3 class="text-lg font-semibold">Clear Old Logs</h3>
        </div>
        <div class="px-6 py-4">
          <p class="text-gray-600 mb-4">Delete logs older than the specified number of days:</p>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Days to keep</label>
            <input type="number" id="clear-days-input" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value="30" min="1">
          </div>
          <p class="text-sm text-gray-500">This action cannot be undone.</p>
        </div>
        <div class="px-6 py-4 border-t flex justify-end space-x-3">
          <button id="btn-cancel-clear" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button id="btn-confirm-clear" class="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg">
            Clear Logs
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <script src="/logs-client.js"></script>
</body>
</html>`;

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    handleRequest,
    createLog,
    listLogs,
    getLog,
    getAllLogs,
    detectOSFromUserAgent
  };
}