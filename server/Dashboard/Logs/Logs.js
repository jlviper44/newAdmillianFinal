/**
 * Logs handler for the Dashboard
 * Provides logs functionality with local D1 database storage
 */

import { initializeLogsTable } from './initLogsTable.js';

/**
 * Handle logs API requests
 */
export async function handleLogsData(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  console.log('Logs API called:', { 
    path, 
    method, 
    hasLogsDB: !!env.LOGS_DB,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries())
  });
  
  // Initialize logs table if needed
  if (env.LOGS_DB) {
    const initialized = await initializeLogsTable(env);
    console.log('Logs table initialization result:', initialized);
  } else {
    console.error('LOGS_DB not available in environment');
    return new Response(
      JSON.stringify({ error: 'Database not configured' }),
      { 
        status: 503,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
  
  try {
    // Handle CORS preflight for public endpoint
    if (method === 'OPTIONS' && path === '/api/logs/public') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    
    // Route to appropriate handler based on path and method
    if (method === 'POST' && (path === '/api/logs' || path === '/api/logs/public')) {
      return createLog(request, env);
    }
    
    if (method === 'GET' && path === '/api/logs') {
      return getLogs(request, env);
    }
    
    if (method === 'GET' && path === '/api/logs/summary') {
      return getLogsSummary(request, env);
    }
    
    if (method === 'GET' && path === '/api/logs/campaigns/list') {
      return getCampaignsList(request, env);
    }
    
    if (method === 'GET' && path === '/api/logs/by-campaign') {
      return getLogsByCampaign(request, env);
    }
    
    if (method === 'GET' && path === '/api/logs/by-type') {
      return getLogsByType(request, env);
    }
    
    if (method === 'GET' && path === '/api/logs/traffic-by-launch') {
      return getTrafficByLaunch(request, env);
    }
    
    if (method === 'GET' && path.match(/^\/api\/logs\/[^\/]+$/)) {
      const id = path.split('/').pop();
      return getLogById(request, env, id);
    }
    
    if (method === 'POST' && path === '/api/logs/clear') {
      return clearOldLogs(request, env);
    }
    
    if (method === 'POST' && path === '/api/logs/fix-first10') {
      return fixFirst10Tags(request, env);
    }
    
    if (method === 'POST' && path === '/api/logs/export') {
      return exportLogs(request, env);
    }
    
    if (method === 'GET' && path === '/api/logs/test') {
      return testLogsDatabase(request, env);
    }
    
    // Unknown endpoint
    return new Response(
      JSON.stringify({ error: 'Unknown logs endpoint' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error handling logs request:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to handle logs request',
        message: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Create a new log entry
 */
async function createLog(request, env) {
  if (!env.LOGS_DB) {
    return new Response(
      JSON.stringify({ error: 'LOGS_DB not configured' }),
      { status: 500, headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      } }
    );
  }
  
  try {
    let logData;
    try {
      const text = await request.text();
      console.log('Raw request body:', text);
      logData = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
    
    console.log('Parsed log data:', logData);
    
    // Validate required fields
    if (!logData.campaignId) {
      console.error('Missing required field: campaignId');
      return new Response(
        JSON.stringify({ error: 'Missing required field: campaignId' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
    
    // Get campaign name if not provided
    let campaignName = logData.campaignName;
    if (!campaignName && logData.campaignId) {
      const campaign = await env.DASHBOARD_DB.prepare(
        'SELECT name FROM campaigns WHERE id = ?'
      ).bind(logData.campaignId).first();
      campaignName = campaign?.name || 'Unknown Campaign';
    }
    
    // Insert log entry
    const result = await env.LOGS_DB.prepare(`
      INSERT INTO logs (
        campaignId, campaignName, launchNumber, type, decision,
        ip, country, region, city, timezone, continent,
        timestamp, userAgent, referer, url, redirectUrl,
        os, params, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      logData.campaignId,
      campaignName,
      logData.launchNumber || 0,
      logData.type,
      logData.decision,
      logData.ip || null,
      logData.country || null,
      logData.region || null,
      logData.city || null,
      logData.timezone || null,
      logData.continent || null,
      logData.timestamp || new Date().toISOString(),
      logData.userAgent || null,
      logData.referer || null,
      logData.url || null,
      logData.redirectUrl || null,
      logData.os || null,
      JSON.stringify(logData.params || {}),
      JSON.stringify(logData.tags || [])
    ).run();
    
    // Check if this is one of the first 10 clicks and tag it
    if (logData.type === 'click' && logData.decision === 'blackhat') {
      const clickCount = await env.LOGS_DB.prepare(`
        SELECT COUNT(*) as count FROM logs 
        WHERE campaignId = ? AND launchNumber = ? 
        AND type = 'click' AND decision = 'blackhat'
      `).bind(logData.campaignId, logData.launchNumber || 0).first();
      
      if (clickCount.count <= 10) {
        const tags = logData.tags || [];
        if (!tags.includes('first10')) {
          tags.push('first10');
          await env.LOGS_DB.prepare(
            'UPDATE logs SET tags = ? WHERE id = ?'
          ).bind(JSON.stringify(tags), result.meta.last_row_id).run();
        }
      }
    }
    
    // Update campaign traffic counts
    if (env.DASHBOARD_DB && logData.campaignId && (logData.type === 'click' || logData.type === 'validation' || logData.type === 'disabled')) {
      try {
        console.log('Updating campaign traffic:', {
          campaignId: logData.campaignId,
          type: logData.type,
          decision: logData.decision,
          launchNumber: logData.launchNumber
        });
        const { updateCampaignTraffic } = await import('../Campaigns/Campaigns.js');
        
        // Determine traffic type based on log type and decision
        let trafficType;
        if (logData.type === 'disabled') {
          trafficType = 'disabled'; // Disabled launches have their own category
        } else {
          trafficType = logData.decision === 'blackhat' ? 'passed' : 'blocked';
        }
        
        await updateCampaignTraffic(
          env.DASHBOARD_DB, 
          logData.campaignId, 
          trafficType,
          logData.launchNumber || 0
        );
        
        // Auto-enable logic for disabled launches
        if (logData.type === 'disabled' && logData.launchNumber !== undefined) {
          try {
            // Get campaign data with launches and threshold
            const campaign = await env.DASHBOARD_DB.prepare(
              'SELECT launches, disabled_clicks_threshold FROM campaigns WHERE id = ?'
            ).bind(logData.campaignId).first();
            
            if (campaign) {
              const launches = JSON.parse(campaign.launches || '{}');
              const launchKey = logData.launchNumber.toString();
              const threshold = campaign.disabled_clicks_threshold !== undefined ? campaign.disabled_clicks_threshold : 10;
              
              // Check if this launch exists and is disabled
              if (launches[launchKey] && !launches[launchKey].isActive && threshold > 0) {
                const disabledClicks = launches[launchKey].trafficDisabled || 0;
                
                console.log(`Launch ${launchKey} has ${disabledClicks} disabled clicks, threshold is ${threshold}`);
                
                // If disabled clicks have reached or exceeded the threshold, auto-enable
                if (disabledClicks >= threshold) {
                  console.log(`Auto-enabling launch ${launchKey} after reaching ${disabledClicks} disabled clicks`);
                  
                  // Enable the launch
                  launches[launchKey].isActive = true;
                  launches[launchKey].autoEnabledAt = new Date().toISOString();
                  launches[launchKey].autoEnabledAfterClicks = disabledClicks;
                  // Set generatedAt timestamp (equivalent to clicking "Refresh & Copy")
                  launches[launchKey].generatedAt = new Date().toISOString();
                  
                  // Update the campaign with the enabled launch
                  await env.DASHBOARD_DB.prepare(
                    'UPDATE campaigns SET launches = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
                  ).bind(JSON.stringify(launches), logData.campaignId).run();
                  
                  console.log(`Successfully auto-enabled launch ${launchKey} for campaign ${logData.campaignId}`);
                  
                  // Update the Shopify page to reflect the enabled status
                  try {
                    console.log('Updating Shopify page for auto-enabled launch...');
                    
                    // Get the full campaign data
                    const fullCampaign = await env.DASHBOARD_DB.prepare(
                      'SELECT * FROM campaigns WHERE id = ?'
                    ).bind(logData.campaignId).first();
                    
                    if (fullCampaign && fullCampaign.tiktok_store_id) {
                      // Get TikTok store details
                      const tiktokStore = await env.DASHBOARD_DB.prepare(
                        'SELECT * FROM shopify_stores WHERE id = ?'
                      ).bind(fullCampaign.tiktok_store_id).first();
                      
                      if (tiktokStore && tiktokStore.access_token) {
                        // Import the necessary functions from Campaigns module
                        const { updateTikTokPageContent } = await import('../Campaigns/Campaigns.js');
                        
                        // Parse campaign data for page update
                        const campaignData = {
                          ...fullCampaign,
                          regions: JSON.parse(fullCampaign.regions || '[]'),
                          affiliateLinks: JSON.parse(fullCampaign.affiliate_link || '{}'),
                          redirectType: fullCampaign.redirect_type,
                          customRedirectUrl: fullCampaign.custom_redirect_link,
                          name: fullCampaign.name
                        };
                        
                        const pageHandle = `cloak-${logData.campaignId}-${launchKey}`;
                        
                        console.log('Calling updateTikTokPageContent with:', {
                          storeUrl: tiktokStore.store_url,
                          campaignId: logData.campaignId,
                          launchKey: launchKey,
                          pageHandle: pageHandle,
                          isActive: true
                        });
                        
                        // Update the page with enabled content
                        const updateResult = await updateTikTokPageContent(
                          tiktokStore,
                          campaignData,
                          logData.campaignId,
                          parseInt(launchKey),
                          pageHandle,
                          true // isActive = true
                        );
                        
                        console.log('updateTikTokPageContent result:', updateResult);
                        console.log(`Shopify page updated for auto-enabled launch ${launchKey}`);
                        
                        // Also update redirect store page if needed
                        if (fullCampaign.redirect_type !== 'custom' && fullCampaign.redirect_store_id) {
                          try {
                            console.log('Creating/updating redirect store offer page...');
                            const { createRedirectStoreOfferPage } = await import('../Campaigns/Campaigns.js');
                            
                            const redirectPageResult = await createRedirectStoreOfferPage(
                              env.DASHBOARD_DB,
                              campaignData,
                              logData.campaignId,
                              parseInt(launchKey)
                            );
                            console.log('Redirect store offer page created/updated:', redirectPageResult);
                          } catch (redirectError) {
                            console.error('Failed to update redirect store page:', redirectError);
                          }
                        }
                      } else {
                        console.warn('TikTok store not found or missing access token - cannot update page');
                      }
                    }
                  } catch (pageUpdateError) {
                    console.error('Failed to update Shopify page after auto-enable:', pageUpdateError);
                    // Don't fail the whole operation if page update fails
                  }
                }
              }
            }
          } catch (autoEnableError) {
            console.error('Failed to check/perform auto-enable:', autoEnableError);
            // Don't fail the whole request if auto-enable fails
          }
        }
      } catch (trafficError) {
        console.error('Failed to update campaign traffic:', trafficError);
      }
    }
    
    console.log('Log created successfully:', result.meta.last_row_id);
    return new Response(
      JSON.stringify({ success: true, id: result.meta.last_row_id }),
      { status: 200, headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      } }
    );
  } catch (error) {
    console.error('Error creating log:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create log', message: error.message }),
      { status: 500, headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      } }
    );
  }
}

/**
 * Get logs with pagination and filters
 */
async function getLogs(request, env) {
  if (!env.LOGS_DB) {
    return new Response(
      JSON.stringify({ logs: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 0 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = (page - 1) * limit;
    
    // Build query with filters
    let whereConditions = [];
    let bindParams = [];
    
    const campaignId = url.searchParams.get('campaignId');
    if (campaignId) {
      whereConditions.push('campaignId = ?');
      bindParams.push(campaignId);
    }
    
    const type = url.searchParams.get('type');
    if (type) {
      whereConditions.push('type = ?');
      bindParams.push(type);
    }
    
    const decision = url.searchParams.get('decision');
    if (decision) {
      whereConditions.push('decision = ?');
      bindParams.push(decision);
    }
    
    const startDate = url.searchParams.get('startDate');
    if (startDate) {
      whereConditions.push('timestamp >= ?');
      bindParams.push(startDate);
    }
    
    const endDate = url.searchParams.get('endDate');
    if (endDate) {
      whereConditions.push('timestamp <= ?');
      bindParams.push(endDate);
    }
    
    const search = url.searchParams.get('search');
    if (search) {
      whereConditions.push('(ip LIKE ? OR userAgent LIKE ? OR referer LIKE ? OR url LIKE ?)');
      const searchPattern = `%${search}%`;
      bindParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM logs ${whereClause}`;
    const countResult = await env.LOGS_DB.prepare(countQuery).bind(...bindParams).first();
    const total = countResult.total;
    
    // Get logs
    const logsQuery = `
      SELECT * FROM logs ${whereClause} 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    const logsResult = await env.LOGS_DB.prepare(logsQuery).bind(...bindParams, limit, offset).all();
    
    // Parse JSON fields
    const logs = (logsResult.results || []).map(log => ({
      ...log,
      params: log.params ? JSON.parse(log.params) : {},
      tags: log.tags ? JSON.parse(log.tags) : []
    }));
    
    return new Response(
      JSON.stringify({
        logs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting logs:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get logs', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get logs summary statistics
 */
async function getLogsSummary(request, env) {
  if (!env.LOGS_DB) {
    return new Response(
      JSON.stringify({
        total: 0,
        conversionRate: 0,
        blocked: 0,
        first10: 0,
        last24Hours: { total: 0, passed: 0, blocked: 0 }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Get total clicks
    const totalResult = await env.LOGS_DB.prepare(
      'SELECT COUNT(*) as count FROM logs WHERE type = "click"'
    ).first();
    const total = totalResult.count;
    
    // Get passed clicks (blackhat)
    const passedResult = await env.LOGS_DB.prepare(
      'SELECT COUNT(*) as count FROM logs WHERE type = "click" AND decision = "blackhat"'
    ).first();
    const passed = passedResult.count;
    
    // Get blocked clicks (whitehat)
    const blockedResult = await env.LOGS_DB.prepare(
      'SELECT COUNT(*) as count FROM logs WHERE type = "validation" AND decision = "whitehat"'
    ).first();
    const blocked = blockedResult.count;
    
    // Get first10 tagged logs
    const first10Result = await env.LOGS_DB.prepare(
      'SELECT COUNT(*) as count FROM logs WHERE tags LIKE "%first10%"'
    ).first();
    const first10 = first10Result.count;
    
    // Get last 24 hours stats
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const last24TotalResult = await env.LOGS_DB.prepare(
      'SELECT COUNT(*) as count FROM logs WHERE timestamp >= ?'
    ).bind(yesterday).first();
    
    const last24PassedResult = await env.LOGS_DB.prepare(
      'SELECT COUNT(*) as count FROM logs WHERE timestamp >= ? AND type = "click" AND decision = "blackhat"'
    ).bind(yesterday).first();
    
    const last24BlockedResult = await env.LOGS_DB.prepare(
      'SELECT COUNT(*) as count FROM logs WHERE timestamp >= ? AND type = "validation" AND decision = "whitehat"'
    ).bind(yesterday).first();
    
    const conversionRate = total > 0 ? (passed / total) * 100 : 0;
    
    return new Response(
      JSON.stringify({
        total,
        conversionRate: conversionRate.toFixed(2),
        blocked,
        first10,
        last24Hours: {
          total: last24TotalResult.count,
          passed: last24PassedResult.count,
          blocked: last24BlockedResult.count
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting logs summary:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get logs summary', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get logs grouped by campaign
 */
async function getLogsByCampaign(request, env) {
  if (!env.LOGS_DB) {
    return new Response(
      JSON.stringify({ campaigns: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const result = await env.LOGS_DB.prepare(`
      SELECT 
        campaignId,
        campaignName,
        COUNT(*) as total,
        SUM(CASE WHEN type = 'click' AND decision = 'blackhat' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN type = 'validation' AND decision = 'whitehat' THEN 1 ELSE 0 END) as blocked
      FROM logs
      GROUP BY campaignId, campaignName
      ORDER BY total DESC
    `).all();
    
    const campaigns = (result.results || []).map(row => ({
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      total: row.total,
      passed: row.passed,
      blocked: row.blocked,
      conversionRate: row.total > 0 ? ((row.passed / row.total) * 100).toFixed(2) : 0
    }));
    
    return new Response(
      JSON.stringify({ campaigns }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting logs by campaign:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get logs by campaign', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get traffic count by campaign and launch
 */
async function getTrafficByLaunch(request, env) {
  if (!env.LOGS_DB) {
    return new Response(
      JSON.stringify({ traffic: {} }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const url = new URL(request.url);
    const campaignId = url.searchParams.get('campaignId');
    
    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get traffic count for each launch
    const result = await env.LOGS_DB.prepare(`
      SELECT 
        launchNumber,
        COUNT(*) as traffic
      FROM logs
      WHERE campaignId = ? 
        AND type = 'click' 
        AND decision = 'blackhat'
      GROUP BY launchNumber
      ORDER BY launchNumber ASC
    `).bind(campaignId).all();
    
    // Convert to object format for easy lookup
    const traffic = {};
    (result.results || []).forEach(row => {
      traffic[row.launchNumber] = row.traffic;
    });
    
    return new Response(
      JSON.stringify({ traffic }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting traffic by launch:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get traffic by launch', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get logs grouped by type
 */
async function getLogsByType(request, env) {
  if (!env.LOGS_DB) {
    return new Response(
      JSON.stringify({ types: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const result = await env.LOGS_DB.prepare(`
      SELECT 
        type,
        decision,
        COUNT(*) as count
      FROM logs
      GROUP BY type, decision
      ORDER BY count DESC
    `).all();
    
    const types = (result.results || []).map(row => ({
      type: row.type,
      decision: row.decision,
      count: row.count
    }));
    
    return new Response(
      JSON.stringify({ types }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting logs by type:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get logs by type', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get a single log by ID
 */
async function getLogById(request, env, id) {
  if (!env.LOGS_DB) {
    return new Response(
      JSON.stringify({ error: 'Log not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const log = await env.LOGS_DB.prepare(
      'SELECT * FROM logs WHERE id = ?'
    ).bind(id).first();
    
    if (!log) {
      return new Response(
        JSON.stringify({ error: 'Log not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse JSON fields
    log.params = log.params ? JSON.parse(log.params) : {};
    log.tags = log.tags ? JSON.parse(log.tags) : [];
    
    return new Response(
      JSON.stringify(log),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting log by ID:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get log', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Clear old logs (older than 30 days)
 */
async function clearOldLogs(request, env) {
  if (!env.LOGS_DB) {
    return new Response(
      JSON.stringify({ error: 'LOGS_DB not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const result = await env.LOGS_DB.prepare(
      'DELETE FROM logs WHERE timestamp < ?'
    ).bind(thirtyDaysAgo).run();
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: result.meta.changes 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error clearing old logs:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to clear old logs', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Fix first10 tags for campaigns
 */
async function fixFirst10Tags(request, env) {
  if (!env.LOGS_DB) {
    return new Response(
      JSON.stringify({ error: 'LOGS_DB not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    // Get all unique campaign/launch combinations
    const campaigns = await env.LOGS_DB.prepare(`
      SELECT DISTINCT campaignId, launchNumber 
      FROM logs 
      WHERE type = 'click' AND decision = 'blackhat'
    `).all();
    
    let updatedCount = 0;
    
    for (const campaign of campaigns.results) {
      // Get first 10 clicks for this campaign/launch
      const first10 = await env.LOGS_DB.prepare(`
        SELECT id, tags FROM logs 
        WHERE campaignId = ? AND launchNumber = ? 
        AND type = 'click' AND decision = 'blackhat'
        ORDER BY timestamp ASC
        LIMIT 10
      `).bind(campaign.campaignId, campaign.launchNumber).all();
      
      for (const log of first10.results) {
        const tags = log.tags ? JSON.parse(log.tags) : [];
        if (!tags.includes('first10')) {
          tags.push('first10');
          await env.LOGS_DB.prepare(
            'UPDATE logs SET tags = ? WHERE id = ?'
          ).bind(JSON.stringify(tags), log.id).run();
          updatedCount++;
        }
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: updatedCount 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fixing first10 tags:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fix first10 tags', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Export logs as CSV
 */
async function exportLogs(request, env) {
  if (!env.LOGS_DB) {
    return new Response(
      JSON.stringify({ error: 'LOGS_DB not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  try {
    const { filters } = await request.json();
    
    // Build query with filters (similar to getLogs)
    let whereConditions = [];
    let bindParams = [];
    
    if (filters?.campaignId) {
      whereConditions.push('campaignId = ?');
      bindParams.push(filters.campaignId);
    }
    
    if (filters?.type) {
      whereConditions.push('type = ?');
      bindParams.push(filters.type);
    }
    
    if (filters?.decision) {
      whereConditions.push('decision = ?');
      bindParams.push(filters.decision);
    }
    
    if (filters?.startDate) {
      whereConditions.push('timestamp >= ?');
      bindParams.push(filters.startDate);
    }
    
    if (filters?.endDate) {
      whereConditions.push('timestamp <= ?');
      bindParams.push(filters.endDate);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const query = `SELECT * FROM logs ${whereClause} ORDER BY timestamp DESC`;
    const result = await env.LOGS_DB.prepare(query).bind(...bindParams).all();
    
    // Convert to CSV
    const logs = result.results || [];
    if (logs.length === 0) {
      return new Response('No logs found', { status: 404 });
    }
    
    // CSV headers
    const headers = [
      'ID', 'Campaign ID', 'Campaign Name', 'Launch Number', 'Type', 'Decision',
      'IP', 'Country', 'Region', 'City', 'Timezone', 'Continent',
      'Timestamp', 'User Agent', 'Referer', 'URL', 'Redirect URL',
      'OS', 'Parameters', 'Tags', 'Created At'
    ];
    
    // CSV rows
    const rows = logs.map(log => [
      log.id,
      log.campaignId,
      log.campaignName,
      log.launchNumber,
      log.type,
      log.decision,
      log.ip,
      log.country,
      log.region,
      log.city,
      log.timezone,
      log.continent,
      log.timestamp,
      log.userAgent,
      log.referer,
      log.url,
      log.redirectUrl,
      log.os,
      log.params,
      log.tags,
      log.created_at
    ]);
    
    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape cells containing commas or quotes
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
    ].join('\n');
    
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="logs-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting logs:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to export logs', message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get campaigns list from the campaigns table
 */
export async function getCampaignsList(request, env) {
  try {
    const db = env.DASHBOARD_DB;
    
    // Get user_id from session
    const sessionCookie = request.headers.get('Cookie');
    if (!sessionCookie) {
      throw new Error('No session cookie found');
    }
    
    const sessionId = sessionCookie.split('session=')[1]?.split(';')[0];
    if (!sessionId) {
      throw new Error('No session ID found in cookie');
    }
    
    const session = await env.USERS_DB.prepare(
      'SELECT user_id FROM sessions WHERE session_id = ? AND expires_at > datetime("now")'
    ).bind(sessionId).first();
    
    if (!session) {
      throw new Error('Invalid or expired session');
    }
    
    const userId = session.user_id;
    
    // Fetch campaigns for this user
    const campaigns = await db.prepare(
      'SELECT id, name FROM campaigns WHERE user_id = ? ORDER BY name ASC'
    ).bind(userId).all();
    
    const campaignsList = (campaigns.results || []).map(campaign => ({
      id: campaign.id,
      name: campaign.name
    }));
    
    return new Response(
      JSON.stringify({ campaigns: campaignsList }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error fetching campaigns list:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch campaigns list',
        message: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Test database connection and create a test log
 */
async function testLogsDatabase(request, env) {
  const results = {
    hasLogsDB: !!env.LOGS_DB,
    hasDashboardDB: !!env.DASHBOARD_DB,
    tableExists: false,
    canInsert: false,
    canQuery: false,
    testLogId: null,
    error: null
  };
  
  try {
    if (!env.LOGS_DB) {
      results.error = 'LOGS_DB not bound';
      return new Response(JSON.stringify(results), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    // Check if table exists
    try {
      const tableCheck = await env.LOGS_DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='logs'"
      ).first();
      results.tableExists = !!tableCheck;
    } catch (e) {
      results.error = 'Failed to check table: ' + e.message;
    }
    
    // Try to insert a test log
    try {
      const testLog = await env.LOGS_DB.prepare(`
        INSERT INTO logs (
          campaignId, campaignName, launchNumber, type, decision,
          ip, country, timestamp, userAgent, url, params, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        'test-campaign',
        'Test Campaign',
        0,
        'test',
        'test',
        '127.0.0.1',
        'TEST',
        new Date().toISOString(),
        'Test User Agent',
        'https://test.com',
        JSON.stringify({ test: true }),
        JSON.stringify(['test'])
      ).run();
      
      results.canInsert = true;
      results.testLogId = testLog.meta.last_row_id;
    } catch (e) {
      results.error = 'Failed to insert: ' + e.message;
    }
    
    // Try to query logs
    try {
      const logs = await env.LOGS_DB.prepare(
        'SELECT COUNT(*) as count FROM logs'
      ).first();
      results.canQuery = true;
      results.logCount = logs.count;
    } catch (e) {
      results.error = 'Failed to query: ' + e.message;
    }
    
  } catch (error) {
    results.error = error.message;
  }
  
  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export default {
  handleLogsData,
  getCampaignsList
};