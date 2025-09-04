import { Router } from '@cloudflare/workers-types';
import { v4 as uuidv4 } from 'uuid';
import UAParser from 'ua-parser-js';
import crypto from 'crypto';

const analyticsRouter = new Router();

// ============= UTILITIES =============

/**
 * Generate event ID
 */
const generateEventId = () => uuidv4();

/**
 * Generate session ID
 */
const generateSessionId = () => uuidv4();

/**
 * Hash IP address for privacy
 */
const hashIpAddress = (ip) => {
  return crypto.createHash('sha256').update(ip).digest('hex');
};

/**
 * Parse user agent for device and browser info
 */
const parseUserAgent = (userAgent) => {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  return {
    device_type: result.device.type || 'desktop',
    device_brand: result.device.vendor,
    device_model: result.device.model,
    browser_name: result.browser.name,
    browser_version: result.browser.version,
    browser_engine: result.engine.name,
    os_name: result.os.name,
    os_version: result.os.version
  };
};

/**
 * Extract UTM parameters from URL
 */
const extractUtmParams = (url) => {
  const urlObj = new URL(url);
  return {
    utm_source: urlObj.searchParams.get('utm_source'),
    utm_medium: urlObj.searchParams.get('utm_medium'),
    utm_campaign: urlObj.searchParams.get('utm_campaign'),
    utm_term: urlObj.searchParams.get('utm_term'),
    utm_content: urlObj.searchParams.get('utm_content')
  };
};

/**
 * Detect referrer type
 */
const detectReferrerType = (referrer) => {
  if (!referrer) return 'direct';
  
  const socialDomains = ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest'];
  const searchEngines = ['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex'];
  const emailDomains = ['gmail', 'outlook', 'yahoo', 'mail'];
  
  const domain = new URL(referrer).hostname.toLowerCase();
  
  if (searchEngines.some(engine => domain.includes(engine))) return 'search';
  if (socialDomains.some(social => domain.includes(social))) return 'social';
  if (emailDomains.some(email => domain.includes(email))) return 'email';
  
  return 'referral';
};

/**
 * Get client IP address
 */
const getClientIp = (request) => {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0] || 
         'unknown';
};

/**
 * Get geo location from Cloudflare headers
 */
const getGeoLocation = (request) => {
  return {
    country_code: request.cf?.country || null,
    country_name: request.cf?.countryName || null,
    region_code: request.cf?.region || null,
    region_name: request.cf?.regionName || null,
    city: request.cf?.city || null,
    postal_code: request.cf?.postalCode || null,
    latitude: request.cf?.latitude || null,
    longitude: request.cf?.longitude || null,
    timezone: request.cf?.timezone || null,
    isp: request.cf?.asOrganization || null
  };
};

/**
 * Calculate initial fraud score
 */
const calculateFraudScore = async (env, request, ipAddress) => {
  let score = 0;
  
  // Check if IP is in fraud database
  const fraudRecord = await env.LINKSPLITTER_DB.prepare(
    'SELECT * FROM fraud_scores WHERE ip_address = ?'
  ).bind(ipAddress).first();
  
  if (fraudRecord) {
    score = fraudRecord.base_score;
    
    if (fraudRecord.vpn_detected) score += 20;
    if (fraudRecord.proxy_detected) score += 20;
    if (fraudRecord.tor_detected) score += 30;
    if (fraudRecord.hosting_provider) score += 15;
  }
  
  // Check Cloudflare threat score
  const threatScore = parseInt(request.cf?.threatScore || 0);
  if (threatScore > 30) score += Math.min(threatScore, 50);
  
  // Check for bot indicators
  const botManagement = request.cf?.botManagement;
  if (botManagement?.verifiedBot) {
    score = Math.max(score, 80);
  }
  
  return Math.min(score, 100);
};

/**
 * Detect if request is from a bot
 */
const detectBot = (request, userAgent) => {
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /facebookexternalhit/i, /whatsapp/i, /telegram/i,
    /slackbot/i, /discord/i, /curl/i, /wget/i
  ];
  
  const isBot = botPatterns.some(pattern => pattern.test(userAgent));
  const cfBot = request.cf?.botManagement?.verifiedBot || false;
  
  return isBot || cfBot;
};

// ============= EVENT COLLECTION ENDPOINT =============

/**
 * POST /api/analytics/event
 * Collect analytics event
 */
analyticsRouter.post('/api/analytics/event', async (request, env) => {
  try {
    const body = await request.json();
    const {
      project_id,
      event_type = 'click',
      clicked_url,
      variant_id,
      variant_name,
      custom_params,
      performance_metrics,
      engagement_metrics
    } = body;
    
    // Get request information
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get('User-Agent') || '';
    const referrer = request.headers.get('Referer') || '';
    const geoLocation = getGeoLocation(request);
    const deviceInfo = parseUserAgent(userAgent);
    const utmParams = extractUtmParams(clicked_url || referrer);
    
    // Generate IDs
    const eventId = generateEventId();
    const sessionId = body.session_id || generateSessionId();
    
    // Calculate fraud score and bot detection
    const fraudScore = await calculateFraudScore(env, request, ipAddress);
    const isBot = detectBot(request, userAgent);
    const isCrawler = request.cf?.botManagement?.verifiedBot || false;
    
    // Determine threat level
    let threatLevel = 'low';
    if (fraudScore > 70) threatLevel = 'critical';
    else if (fraudScore > 50) threatLevel = 'high';
    else if (fraudScore > 30) threatLevel = 'medium';
    
    // Prepare event data
    const eventData = {
      project_id,
      event_id: eventId,
      session_id: sessionId,
      
      // User Information
      ip_address: ipAddress,
      ip_hash: hashIpAddress(ipAddress),
      user_agent: userAgent,
      user_id: body.user_id || null,
      
      // Geographic Information
      ...geoLocation,
      
      // Device & Browser
      ...deviceInfo,
      screen_width: body.screen_width || null,
      screen_height: body.screen_height || null,
      viewport_width: body.viewport_width || null,
      viewport_height: body.viewport_height || null,
      
      // Traffic Source
      referrer_url: referrer,
      referrer_domain: referrer ? new URL(referrer).hostname : null,
      referrer_type: detectReferrerType(referrer),
      search_engine: null, // TODO: Implement search engine detection
      search_keyword: null, // TODO: Extract from referrer
      
      // UTM Parameters
      ...utmParams,
      
      // Custom Parameters
      custom_params: custom_params ? JSON.stringify(custom_params) : null,
      
      // Event Details
      event_type,
      clicked_url,
      variant_id,
      variant_name,
      
      // Performance Metrics
      page_load_time: performance_metrics?.page_load_time || null,
      dns_time: performance_metrics?.dns_time || null,
      connect_time: performance_metrics?.connect_time || null,
      response_time: performance_metrics?.response_time || null,
      dom_interactive_time: performance_metrics?.dom_interactive_time || null,
      
      // Engagement Metrics
      time_on_page: engagement_metrics?.time_on_page || null,
      scroll_depth: engagement_metrics?.scroll_depth || null,
      clicks_count: engagement_metrics?.clicks_count || null,
      
      // Fraud & Security
      fraud_score: fraudScore,
      is_bot: isBot ? 1 : 0,
      is_crawler: isCrawler ? 1 : 0,
      is_vpn: request.cf?.isEUCountry ? 0 : (fraudScore > 50 ? 1 : 0),
      is_proxy: 0, // TODO: Implement proxy detection
      is_tor: 0, // TODO: Implement Tor detection
      threat_level: threatLevel,
      fingerprint_id: body.fingerprint_id || null,
      
      // Session Information
      is_new_session: body.is_new_session || 1,
      is_bounce: body.is_bounce || 0,
      session_duration: body.session_duration || null,
      pages_in_session: body.pages_in_session || 1,
      
      // Timestamps
      client_timestamp: body.timestamp || null,
      server_timestamp: new Date().toISOString()
    };
    
    // Insert event into database
    const columns = Object.keys(eventData).join(', ');
    const placeholders = Object.keys(eventData).map(() => '?').join(', ');
    const values = Object.values(eventData);
    
    await env.LINKSPLITTER_DB.prepare(
      `INSERT INTO analytics_events (${columns}) VALUES (${placeholders})`
    ).bind(...values).run();
    
    // Update session information
    await updateSession(env, sessionId, project_id, eventData);
    
    // Update real-time counters
    await updateRealTimeCounters(env, project_id, eventData);
    
    // Check for conversions
    if (event_type === 'conversion') {
      await trackConversion(env, project_id, sessionId, eventId, body);
    }
    
    return new Response(JSON.stringify({
      success: true,
      event_id: eventId,
      session_id: sessionId,
      fraud_score: fraudScore,
      is_bot: isBot
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Analytics event error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to track event'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Update session information
 */
async function updateSession(env, sessionId, projectId, eventData) {
  const existingSession = await env.LINKSPLITTER_DB.prepare(
    'SELECT * FROM analytics_sessions WHERE id = ?'
  ).bind(sessionId).first();
  
  if (existingSession) {
    // Update existing session
    await env.LINKSPLITTER_DB.prepare(`
      UPDATE analytics_sessions 
      SET 
        end_time = CURRENT_TIMESTAMP,
        duration = (julianday(CURRENT_TIMESTAMP) - julianday(start_time)) * 86400,
        page_views = page_views + 1,
        events_count = events_count + 1,
        last_referrer = ?,
        last_utm_source = ?,
        last_utm_medium = ?,
        last_utm_campaign = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      eventData.referrer_url,
      eventData.utm_source,
      eventData.utm_medium,
      eventData.utm_campaign,
      sessionId
    ).run();
  } else {
    // Create new session
    await env.LINKSPLITTER_DB.prepare(`
      INSERT INTO analytics_sessions (
        id, project_id, user_id, ip_address,
        start_time, page_views, events_count,
        first_referrer, first_utm_source, first_utm_medium, first_utm_campaign,
        last_referrer, last_utm_source, last_utm_medium, last_utm_campaign,
        device_type, browser_name, os_name,
        country_code, region_code, city
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      projectId,
      eventData.user_id,
      eventData.ip_address,
      eventData.referrer_url,
      eventData.utm_source,
      eventData.utm_medium,
      eventData.utm_campaign,
      eventData.referrer_url,
      eventData.utm_source,
      eventData.utm_medium,
      eventData.utm_campaign,
      eventData.device_type,
      eventData.browser_name,
      eventData.os_name,
      eventData.country_code,
      eventData.region_code,
      eventData.city
    ).run();
  }
}

/**
 * Update real-time counters
 */
async function updateRealTimeCounters(env, projectId, eventData) {
  // Update project click count
  await env.LINKSPLITTER_DB.prepare(
    'UPDATE link_projects SET click_count = click_count + 1 WHERE id = ?'
  ).bind(projectId).run();
  
  // TODO: Update hourly aggregation in background
}

/**
 * Track conversion
 */
async function trackConversion(env, projectId, sessionId, eventId, data) {
  await env.LINKSPLITTER_DB.prepare(`
    INSERT INTO conversions (
      project_id, session_id, event_id,
      conversion_type, conversion_name, conversion_value,
      currency, custom_properties
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    projectId,
    sessionId,
    eventId,
    data.conversion_type || 'custom',
    data.conversion_name,
    data.conversion_value || 0,
    data.currency || 'USD',
    data.custom_properties ? JSON.stringify(data.custom_properties) : null
  ).run();
  
  // Update session conversion status
  await env.LINKSPLITTER_DB.prepare(`
    UPDATE analytics_sessions
    SET 
      has_converted = 1,
      conversion_count = conversion_count + 1,
      total_revenue = total_revenue + ?
    WHERE id = ?
  `).bind(data.conversion_value || 0, sessionId).run();
}

// ============= ANALYTICS QUERY ENDPOINTS =============

/**
 * GET /api/analytics/project/:projectId
 * Get analytics for a specific project
 */
analyticsRouter.get('/api/analytics/project/:projectId', async (request, env, params) => {
  const { projectId } = params;
  const url = new URL(request.url);
  const startDate = url.searchParams.get('start_date');
  const endDate = url.searchParams.get('end_date');
  const granularity = url.searchParams.get('granularity') || 'daily'; // hourly, daily, weekly, monthly
  
  try {
    let query;
    let tableName;
    
    switch (granularity) {
      case 'hourly':
        tableName = 'analytics_hourly';
        break;
      case 'weekly':
        tableName = 'analytics_weekly';
        break;
      case 'monthly':
        tableName = 'analytics_monthly';
        break;
      default:
        tableName = 'analytics_daily';
    }
    
    // Build query based on date range
    let whereClause = 'WHERE project_id = ?';
    const params = [projectId];
    
    if (startDate && endDate) {
      if (granularity === 'hourly') {
        whereClause += ' AND hour_timestamp BETWEEN ? AND ?';
      } else if (granularity === 'weekly') {
        whereClause += ' AND week_start BETWEEN ? AND ?';
      } else if (granularity === 'monthly') {
        whereClause += ' AND month BETWEEN ? AND ?';
      } else {
        whereClause += ' AND date BETWEEN ? AND ?';
      }
      params.push(startDate, endDate);
    }
    
    const analytics = await env.LINKSPLITTER_DB.prepare(
      `SELECT * FROM ${tableName} ${whereClause} ORDER BY ${
        granularity === 'hourly' ? 'hour_timestamp' : 
        granularity === 'weekly' ? 'week_start' :
        granularity === 'monthly' ? 'month' : 'date'
      } DESC`
    ).bind(...params).all();
    
    // Get summary statistics
    const summary = await env.LINKSPLITTER_DB.prepare(`
      SELECT 
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(DISTINCT ip_address) as unique_visitors,
        COUNT(*) as total_events,
        AVG(fraud_score) as avg_fraud_score,
        SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot_events
      FROM analytics_events
      ${whereClause}
    `).bind(...params).first();
    
    return new Response(JSON.stringify({
      success: true,
      analytics: analytics.results,
      summary
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Analytics query error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch analytics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

/**
 * GET /api/analytics/realtime/:projectId
 * Get real-time analytics for a project
 */
analyticsRouter.get('/api/analytics/realtime/:projectId', async (request, env, params) => {
  const { projectId } = params;
  
  try {
    // Get events from last hour
    const recentEvents = await env.LINKSPLITTER_DB.prepare(`
      SELECT * FROM analytics_events
      WHERE project_id = ? 
      AND created_at >= datetime('now', '-1 hour')
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(projectId).all();
    
    // Get active sessions
    const activeSessions = await env.LINKSPLITTER_DB.prepare(`
      SELECT COUNT(*) as count FROM analytics_sessions
      WHERE project_id = ?
      AND datetime(updated_at) >= datetime('now', '-30 minutes')
    `).bind(projectId).first();
    
    // Get current hour stats
    const currentHourStats = await env.LINKSPLITTER_DB.prepare(`
      SELECT 
        COUNT(*) as events_count,
        COUNT(DISTINCT session_id) as sessions_count,
        COUNT(DISTINCT ip_address) as visitors_count,
        AVG(fraud_score) as avg_fraud_score
      FROM analytics_events
      WHERE project_id = ?
      AND created_at >= datetime('now', '-1 hour')
    `).bind(projectId).first();
    
    return new Response(JSON.stringify({
      success: true,
      realtime: {
        recent_events: recentEvents.results,
        active_sessions: activeSessions.count,
        current_hour: currentHourStats
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Real-time analytics error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch real-time analytics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

export { analyticsRouter };