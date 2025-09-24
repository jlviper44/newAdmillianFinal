/**
 * Advanced Analytics Features from LinkSplit.ts
 * Complete implementation of all special analytics capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ============= ADVANCED ANALYTICS TYPES =============

/**
 * Advanced Analytics structure with all metrics
 */
export const AdvancedAnalyticsTypes = {
  userEngagement: {
    activeUsers: { daily: 0, weekly: 0, monthly: 0 },
    userRetention: { day7: 0, day30: 0, day90: 0 },
    sessionMetrics: { avgDuration: 0, avgPagesPerSession: 0 },
    topUsers: []
  },
  projectPerformance: {
    totalProjects: 0,
    activeProjects: 0,
    projectGrowth: { weekly: 0, monthly: 0 },
    topPerformingProjects: []
  },
  systemHealth: {
    uptime: 99.9,
    responseTime: { avg: 0, p95: 0, p99: 0 },
    errorRate: 0,
    activeSessions: 0
  },
  businessMetrics: {
    totalClicks: 0,
    conversionRate: 0,
    revenueImpact: 0,
    geographicDistribution: {},
    deviceBreakdown: {}
  }
};

// ============= ACTIVITY LOGGING SYSTEM =============

/**
 * Activity Log Entry structure
 */
export class ActivityLogger {
  constructor(env) {
    this.env = env;
  }

  async logActivity(userId, userEmail, userRole, action, resourceType, resourceId, resourceName, details, request) {
    const entry = {
      id: uuidv4(),
      timestamp: Date.now(),
      userId,
      userEmail,
      userRole,
      action,
      resourceType, // 'project' | 'group' | 'user' | 'team' | 'link' | 'auth' | 'webhook' | 'api_key' | 'activity_log'
      resourceId,
      resourceName,
      details,
      ipAddress: this.getClientIp(request),
      userAgent: request.headers.get('User-Agent'),
      sessionId: this.getSessionId(request)
    };

    // Store in D1 database
    await this.env.LINKSPLITTER_DB.prepare(`
      INSERT INTO activity_logs (
        id, timestamp, user_id, user_email, user_role, action,
        resource_type, resource_id, resource_name, details,
        ip_address, user_agent, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      entry.id,
      entry.timestamp,
      entry.userId,
      entry.userEmail,
      entry.userRole,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      entry.resourceName,
      JSON.stringify(entry.details),
      entry.ipAddress,
      entry.userAgent,
      entry.sessionId
    ).run();

    // Trigger webhooks for activity
    await this.triggerActivityWebhooks(entry);

    return entry;
  }

  async getActivityLogs(filters = {}) {
    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    const params = [];

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(new Date(filters.startDate).getTime());
    }
    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(new Date(filters.endDate).getTime());
    }
    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }
    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }
    if (filters.resourceType) {
      query += ' AND resource_type = ?';
      params.push(filters.resourceType);
    }

    query += ' ORDER BY timestamp DESC';
    
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    const result = await this.env.LINKSPLITTER_DB.prepare(query)
      .bind(...params)
      .all();

    return result.results;
  }

  getClientIp(request) {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For')?.split(',')[0] || 
           'unknown';
  }

  getSessionId(request) {
    // Extract session ID from cookie or generate new one
    const cookie = request.headers.get('Cookie');
    const sessionMatch = cookie?.match(/session_id=([^;]+)/);
    return sessionMatch ? sessionMatch[1] : uuidv4();
  }

  async triggerActivityWebhooks(entry) {
    // Trigger webhooks for activity events
    const webhooks = await this.env.LINKSPLITTER_DB.prepare(
      'SELECT * FROM webhooks WHERE is_active = 1 AND events LIKE ?'
    ).bind(`%activity.${entry.action}%`).all();

    for (const webhook of webhooks.results) {
      await this.deliverWebhook(webhook, 'activity', entry);
    }
  }

  async deliverWebhook(webhook, eventType, payload) {
    // Implementation in WebhookManager
  }
}

// ============= FRAUD DETECTION & IP REPUTATION =============

/**
 * Enhanced Fraud Detection with IP Reputation
 */
export class EnhancedFraudDetection {
  constructor(env) {
    this.env = env;
  }

  async calculateFraudScore(request, cf, userAgent) {
    let score = 0;
    const ip = this.getClientIp(request);

    // 1. Check IP reputation
    const ipRep = await this.getIpReputation(ip);
    if (ipRep) {
      if (ipRep.isBlacklisted) return 100;
      score += ipRep.fraudScore;
    }

    // 2. Check for VPN/Proxy
    if (this.isVpnOrProxy(cf)) {
      score += 30;
    }

    // 3. Check bot patterns
    if (this.detectBot(userAgent)) {
      score += 40;
    }

    // 4. Check click velocity
    const clickVelocity = await this.getClickVelocity(ip);
    if (clickVelocity > 10) score += 20; // More than 10 clicks per minute
    if (clickVelocity > 30) score += 30; // More than 30 clicks per minute

    // 5. Check session anomalies
    const sessionAnomaly = await this.detectSessionAnomaly(request);
    if (sessionAnomaly) score += 25;

    // 6. Check geographic anomalies
    if (await this.hasGeographicAnomaly(ip, cf)) {
      score += 15;
    }

    // 7. Check device fingerprint consistency
    const fingerprintScore = await this.checkFingerprint(request);
    score += fingerprintScore;

    return Math.min(100, score);
  }

  async getIpReputation(ip) {
    const result = await this.env.LINKSPLITTER_DB.prepare(
      'SELECT * FROM ip_reputation WHERE ip_address = ?'
    ).bind(ip).first();

    if (!result) {
      // Create new reputation entry
      await this.env.LINKSPLITTER_DB.prepare(`
        INSERT INTO ip_reputation (
          ip_address, first_seen, last_seen, clicks, fraud_score, is_blacklisted
        ) VALUES (?, ?, ?, 1, 0, 0)
      `).bind(ip, Date.now(), Date.now()).run();
      return null;
    }

    // Update last seen and clicks
    await this.env.LINKSPLITTER_DB.prepare(`
      UPDATE ip_reputation 
      SET last_seen = ?, clicks = clicks + 1
      WHERE ip_address = ?
    `).bind(Date.now(), ip).run();

    return result;
  }

  async updateIpReputation(ip, fraudData) {
    const currentRep = await this.getIpReputation(ip) || { fraud_score: 0 };
    
    // Update fraud score based on behavior
    let newScore = currentRep.fraud_score;
    if (fraudData.isBot || fraudData.fraudScore > 70) {
      newScore = Math.min(100, newScore + 10);
    }

    const isBlacklisted = newScore > 80;

    await this.env.LINKSPLITTER_DB.prepare(`
      UPDATE ip_reputation 
      SET fraud_score = ?, is_blacklisted = ?
      WHERE ip_address = ?
    `).bind(newScore, isBlacklisted ? 1 : 0, ip).run();
  }

  detectBot(userAgent) {
    if (!userAgent) return true;
    
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /facebookexternalhit/i, /whatsapp/i, /telegram/i,
      /slackbot/i, /discord/i, /curl/i, /wget/i,
      /python/i, /java/i, /perl/i, /ruby/i,
      /headless/i, /phantom/i, /selenium/i
    ];

    return botPatterns.some(pattern => pattern.test(userAgent));
  }

  isVpnOrProxy(cf) {
    // Check Cloudflare's threat score and other indicators
    const threatScore = parseInt(cf?.threatScore || 0);
    const isHostingProvider = cf?.asOrganization?.toLowerCase().includes('hosting') ||
                             cf?.asOrganization?.toLowerCase().includes('cloud') ||
                             cf?.asOrganization?.toLowerCase().includes('vpn');
    
    return threatScore > 30 || isHostingProvider;
  }

  async getClickVelocity(ip) {
    const oneMinuteAgo = Date.now() - 60000;
    const result = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT COUNT(*) as count 
      FROM analytics_events 
      WHERE ip_address = ? AND created_at > ?
    `).bind(ip, new Date(oneMinuteAgo).toISOString()).first();

    return result?.count || 0;
  }

  async detectSessionAnomaly(request) {
    // Check for session inconsistencies
    const sessionId = this.getSessionId(request);
    const ip = this.getClientIp(request);

    const sessionData = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT DISTINCT ip_address, user_agent 
      FROM analytics_events 
      WHERE session_id = ?
      LIMIT 10
    `).bind(sessionId).all();

    // Check if session has multiple IPs or user agents
    const uniqueIps = new Set(sessionData.results.map(r => r.ip_address));
    const uniqueUAs = new Set(sessionData.results.map(r => r.user_agent));

    return uniqueIps.size > 2 || uniqueUAs.size > 2;
  }

  async hasGeographicAnomaly(ip, cf) {
    // Check for impossible geographic movements
    const recentLocations = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT DISTINCT country_code, city, created_at
      FROM analytics_events
      WHERE ip_address = ?
      ORDER BY created_at DESC
      LIMIT 2
    `).bind(ip).all();

    if (recentLocations.results.length < 2) return false;

    const [current, previous] = recentLocations.results;
    const timeDiff = new Date(current.created_at) - new Date(previous.created_at);
    
    // If country changed in less than 1 hour, it's suspicious
    if (current.country_code !== previous.country_code && timeDiff < 3600000) {
      return true;
    }

    return false;
  }

  async checkFingerprint(request) {
    // Check device fingerprint consistency
    const fingerprint = request.headers.get('X-Fingerprint');
    if (!fingerprint) return 10; // No fingerprint is suspicious

    const ip = this.getClientIp(request);
    const existingFingerprints = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT DISTINCT fingerprint_id 
      FROM analytics_events 
      WHERE ip_address = ?
      LIMIT 10
    `).bind(ip).all();

    // Multiple fingerprints from same IP is suspicious
    if (existingFingerprints.results.length > 3) {
      return 20;
    }

    return 0;
  }

  getClientIp(request) {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For')?.split(',')[0] || 
           'unknown';
  }

  getSessionId(request) {
    const cookie = request.headers.get('Cookie');
    const sessionMatch = cookie?.match(/session_id=([^;]+)/);
    return sessionMatch ? sessionMatch[1] : null;
  }
}

// ============= REAL-TIME ACTIVE USERS TRACKING =============

/**
 * Real-time Active Users Tracking
 */
export class ActiveUsersTracker {
  constructor(env) {
    this.env = env;
    this.ACTIVE_USER_TTL = 300; // 5 minutes
  }

  async trackActiveUser(projectId, sessionId, ip, userAgent) {
    const key = `active:${projectId}:${sessionId || ip + userAgent}`;
    
    // Store with 5-minute TTL in KV
    await this.env.LINKS_CONFIG.put(key, JSON.stringify({
      timestamp: Date.now(),
      ip,
      userAgent,
      sessionId
    }), { 
      expirationTtl: this.ACTIVE_USER_TTL 
    });

    // Also track in D1 for analytics
    await this.env.LINKSPLITTER_DB.prepare(`
      INSERT OR REPLACE INTO active_sessions (
        project_id, session_id, ip_address, user_agent, last_activity
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(projectId, sessionId, ip, userAgent, new Date().toISOString()).run();
  }

  async getActiveUsers(projectId) {
    // Get from KV (real-time)
    const list = await this.env.LINKS_CONFIG.list({ 
      prefix: `active:${projectId}:` 
    });
    
    const activeUsers = list.keys.length;

    // Also get unique sessions from D1 (backup)
    const dbResult = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT COUNT(DISTINCT session_id) as count
      FROM active_sessions
      WHERE project_id = ?
      AND last_activity > datetime('now', '-5 minutes')
    `).bind(projectId).first();

    return Math.max(activeUsers, dbResult?.count || 0);
  }

  async getGlobalActiveUsers() {
    // Get all active sessions across all projects
    const result = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT COUNT(DISTINCT session_id) as count
      FROM active_sessions
      WHERE last_activity > datetime('now', '-5 minutes')
    `).first();

    return result?.count || 0;
  }

  async cleanupInactiveSessions() {
    // Remove sessions older than 5 minutes
    await this.env.LINKSPLITTER_DB.prepare(`
      DELETE FROM active_sessions
      WHERE last_activity < datetime('now', '-5 minutes')
    `).run();
  }
}

// ============= A/B TESTING STATISTICAL ANALYSIS =============

/**
 * A/B Testing Statistical Analysis
 */
export class ABTestingAnalyzer {
  /**
   * Calculate statistical significance for A/B test
   */
  calculateStatisticalSignificance(control, variant) {
    // Calculate conversion rates
    const controlRate = control.clicks > 0 ? control.conversions / control.clicks : 0;
    const variantRate = variant.clicks > 0 ? variant.conversions / variant.clicks : 0;
    
    // Calculate pooled standard error
    const pooledRate = (control.clicks + variant.clicks) > 0 ? 
      (control.conversions + variant.conversions) / (control.clicks + variant.clicks) : 0;
    const pooledSE = Math.sqrt(pooledRate * (1 - pooledRate) * (1/control.clicks + 1/variant.clicks));
    
    // Calculate z-score
    const zScore = pooledSE > 0 ? (variantRate - controlRate) / pooledSE : 0;
    
    // Calculate p-value (two-tailed test)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
    
    // Calculate confidence level
    const confidence = (1 - pValue) * 100;
    
    // Determine significance (95% confidence level)
    const isSignificant = pValue < 0.05;
    
    // Calculate lift
    const lift = controlRate > 0 ? ((variantRate - controlRate) / controlRate) * 100 : 0;
    
    return {
      variant: 'variant',
      clicks: variant.clicks,
      conversions: variant.conversions,
      conversionRate: variantRate * 100,
      confidence,
      isSignificant,
      pValue,
      lift
    };
  }

  /**
   * Normal distribution CDF approximation
   */
  normalCDF(x) {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   */
  erf(x) {
    // Approximation with maximum error of 1.5e-7
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Analyze A/B test results
   */
  async analyzeABTest(env, projectId) {
    // Get test configuration
    const project = await env.LINKSPLITTER_DB.prepare(
      'SELECT ab_testing FROM link_projects WHERE id = ?'
    ).bind(projectId).first();

    if (!project?.ab_testing) return null;

    const abConfig = JSON.parse(project.ab_testing);
    if (!abConfig.enabled) return null;

    const results = [];
    
    // Get control variant stats
    const controlStats = await env.LINKSPLITTER_DB.prepare(`
      SELECT 
        COUNT(*) as clicks,
        SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END) as conversions
      FROM analytics_events
      WHERE project_id = ? AND variant_id = 'control'
    `).bind(projectId).first();

    // Analyze each variant against control
    for (const variant of abConfig.variants) {
      const variantStats = await env.LINKSPLITTER_DB.prepare(`
        SELECT 
          COUNT(*) as clicks,
          SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END) as conversions
        FROM analytics_events
        WHERE project_id = ? AND variant_id = ?
      `).bind(projectId, variant.id).first();

      if (variantStats.clicks > 0) {
        const result = this.calculateStatisticalSignificance(controlStats, variantStats);
        result.variantId = variant.id;
        result.variantName = variant.name;
        results.push(result);
      }
    }

    // Determine winner if any variant is significant
    const winner = results.find(r => r.isSignificant && r.lift > 0);
    
    return {
      results,
      winner: winner?.variantId || null,
      confidence: winner?.confidence || 0,
      recommendation: this.getRecommendation(results, abConfig)
    };
  }

  getRecommendation(results, config) {
    const significantResults = results.filter(r => r.isSignificant);
    
    if (significantResults.length === 0) {
      const totalClicks = results.reduce((sum, r) => sum + r.clicks, 0);
      if (totalClicks < config.minSampleSize) {
        return 'Need more data. Continue testing.';
      }
      return 'No significant difference detected. Consider ending test.';
    }

    const bestResult = significantResults.reduce((best, current) => 
      current.lift > best.lift ? current : best
    );

    if (bestResult.lift > 0) {
      return `Variant ${bestResult.variantName} is winning with ${bestResult.lift.toFixed(1)}% lift. Consider implementing.`;
    }

    return 'Control is performing better. Keep current implementation.';
  }
}

// ============= WEBHOOK MANAGEMENT SYSTEM =============

/**
 * Webhook Management System
 */
export class WebhookManager {
  constructor(env) {
    this.env = env;
  }

  async createWebhook(webhook) {
    const fullWebhook = {
      ...webhook,
      id: uuidv4(),
      createdAt: Date.now(),
      failureCount: 0,
      lastTriggered: null
    };

    await this.env.LINKSPLITTER_DB.prepare(`
      INSERT INTO webhooks (
        id, name, url, events, secret, is_active,
        created_at, failure_count, headers, retry_policy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fullWebhook.id,
      fullWebhook.name,
      fullWebhook.url,
      JSON.stringify(fullWebhook.events),
      fullWebhook.secret,
      fullWebhook.isActive ? 1 : 0,
      fullWebhook.createdAt,
      fullWebhook.failureCount,
      JSON.stringify(fullWebhook.headers || {}),
      JSON.stringify(fullWebhook.retryPolicy || {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      })
    ).run();

    return fullWebhook;
  }

  async triggerWebhook(webhook, eventType, payload) {
    if (!webhook.isActive) return;

    const event = {
      id: uuidv4(),
      webhookId: webhook.id,
      eventType,
      payload,
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending'
    };

    // Store webhook event
    await this.env.LINKSPLITTER_DB.prepare(`
      INSERT INTO webhook_events (
        id, webhook_id, event_type, payload, created_at, attempts, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.id,
      event.webhookId,
      event.eventType,
      JSON.stringify(event.payload),
      event.createdAt,
      event.attempts,
      event.status
    ).run();

    // Deliver webhook
    await this.deliverWebhook(webhook, event);
  }

  async deliverWebhook(webhook, event) {
    try {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'User-Agent': 'LinkSplitter/1.0',
        'X-Webhook-Signature': this.generateWebhookSignature(webhook.secret, JSON.stringify(event.payload)),
        'X-Webhook-Event': event.eventType,
        'X-Webhook-ID': webhook.id
      });

      // Add custom headers
      if (webhook.headers) {
        const customHeaders = JSON.parse(webhook.headers);
        Object.entries(customHeaders).forEach(([key, value]) => {
          headers.append(key, value);
        });
      }

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event: event.eventType,
          timestamp: event.createdAt,
          data: event.payload,
          webhookId: webhook.id
        })
      });

      if (response.ok) {
        // Update webhook last triggered
        await this.env.LINKSPLITTER_DB.prepare(`
          UPDATE webhooks 
          SET last_triggered = ? 
          WHERE id = ?
        `).bind(Date.now(), webhook.id).run();

        // Update event status
        await this.env.LINKSPLITTER_DB.prepare(`
          UPDATE webhook_events 
          SET status = 'delivered' 
          WHERE id = ?
        `).bind(event.id).run();
      } else {
        // Handle retry
        await this.handleWebhookRetry(webhook, event);
      }
    } catch (error) {
      console.error('Webhook delivery error:', error);
      await this.handleWebhookRetry(webhook, event);
    }
  }

  async handleWebhookRetry(webhook, event) {
    const retryPolicy = JSON.parse(webhook.retry_policy || '{}');
    
    if (event.attempts >= retryPolicy.maxRetries) {
      // Mark as failed
      await this.env.LINKSPLITTER_DB.prepare(`
        UPDATE webhook_events 
        SET status = 'failed' 
        WHERE id = ?
      `).bind(event.id).run();

      // Update failure count
      await this.env.LINKSPLITTER_DB.prepare(`
        UPDATE webhooks 
        SET failure_count = failure_count + 1 
        WHERE id = ?
      `).bind(webhook.id).run();

      return;
    }

    // Schedule retry
    const delay = retryPolicy.initialDelay * Math.pow(retryPolicy.backoffMultiplier, event.attempts);
    
    await this.env.LINKSPLITTER_DB.prepare(`
      UPDATE webhook_events 
      SET status = 'retrying', attempts = attempts + 1, next_retry = ?
      WHERE id = ?
    `).bind(Date.now() + delay, event.id).run();

    // In production, use a queue or scheduled job for retry
    setTimeout(() => this.deliverWebhook(webhook, event), delay);
  }

  generateWebhookSignature(secret, payload) {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  async getWebhooks() {
    const result = await this.env.LINKSPLITTER_DB.prepare(
      'SELECT * FROM webhooks ORDER BY created_at DESC'
    ).all();
    return result.results;
  }

  async getWebhook(webhookId) {
    return await this.env.LINKSPLITTER_DB.prepare(
      'SELECT * FROM webhooks WHERE id = ?'
    ).bind(webhookId).first();
  }

  async updateWebhook(webhookId, updates) {
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = Object.values(updates);
    
    await this.env.LINKSPLITTER_DB.prepare(
      `UPDATE webhooks SET ${fields} WHERE id = ?`
    ).bind(...values, webhookId).run();
  }

  async deleteWebhook(webhookId) {
    await this.env.LINKSPLITTER_DB.prepare(
      'DELETE FROM webhooks WHERE id = ?'
    ).bind(webhookId).run();
  }
}

// ============= QUICK STATS CALCULATION =============

/**
 * Calculate Quick Stats for Dashboard
 */
export async function calculateQuickStats(env) {
  try {
    // Get total projects
    const projectsResult = await env.LINKSPLITTER_DB.prepare(
      'SELECT COUNT(*) as count FROM link_projects WHERE status = "active"'
    ).first();

    // Get active users (last 5 minutes)
    const activeUsersResult = await env.LINKSPLITTER_DB.prepare(`
      SELECT COUNT(DISTINCT session_id) as count
      FROM active_sessions
      WHERE last_activity > datetime('now', '-5 minutes')
    `).first();

    // Get today's clicks
    const todayClicksResult = await env.LINKSPLITTER_DB.prepare(`
      SELECT COUNT(*) as count
      FROM analytics_events
      WHERE DATE(created_at) = DATE('now')
    `).first();

    // Get total clicks
    const totalClicksResult = await env.LINKSPLITTER_DB.prepare(
      'SELECT COUNT(*) as count FROM analytics_events'
    ).first();

    // Get conversion rate
    const conversionResult = await env.LINKSPLITTER_DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN event_type = 'conversion' THEN 1 ELSE 0 END) as conversions
      FROM analytics_events
      WHERE created_at > datetime('now', '-30 days')
    `).first();

    const conversionRate = conversionResult.total > 0 
      ? (conversionResult.conversions / conversionResult.total * 100).toFixed(2)
      : 0;

    // Get geographic distribution
    const geoResult = await env.LINKSPLITTER_DB.prepare(`
      SELECT country_code, COUNT(*) as count
      FROM analytics_events
      WHERE created_at > datetime('now', '-7 days')
      GROUP BY country_code
      ORDER BY count DESC
      LIMIT 10
    `).all();

    return {
      totalProjects: projectsResult?.count || 0,
      activeUsers: activeUsersResult?.count || 0,
      todayClicks: todayClicksResult?.count || 0,
      totalClicks: totalClicksResult?.count || 0,
      conversionRate,
      topCountries: geoResult.results
    };
  } catch (error) {
    console.error('Error calculating quick stats:', error);
    return {
      totalProjects: 0,
      activeUsers: 0,
      todayClicks: 0,
      totalClicks: 0,
      conversionRate: 0,
      topCountries: []
    };
  }
}

// ============= PERFORMANCE ANALYTICS =============

/**
 * Calculate Performance Analytics
 */
export async function calculatePerformanceAnalytics(env, projectId, timeRange = '24h') {
  const timeFilter = getTimeFilter(timeRange);
  
  // Get response time percentiles
  const performanceResult = await env.LINKSPLITTER_DB.prepare(`
    SELECT 
      AVG(response_time) as avg_response,
      MIN(response_time) as min_response,
      MAX(response_time) as max_response
    FROM analytics_performance
    WHERE project_id = ? AND timestamp > ?
  `).bind(projectId, timeFilter).first();

  // Calculate percentiles (simplified - in production use proper percentile calculation)
  const allResponseTimes = await env.LINKSPLITTER_DB.prepare(`
    SELECT response_time
    FROM analytics_events
    WHERE project_id = ? AND created_at > ?
    ORDER BY response_time
  `).bind(projectId, timeFilter).all();

  const times = allResponseTimes.results.map(r => r.response_time).filter(Boolean);
  const p50 = times[Math.floor(times.length * 0.5)] || 0;
  const p95 = times[Math.floor(times.length * 0.95)] || 0;
  const p99 = times[Math.floor(times.length * 0.99)] || 0;

  // Calculate uptime
  const downtimeResult = await env.LINKSPLITTER_DB.prepare(`
    SELECT COUNT(*) as failures
    FROM analytics_events
    WHERE project_id = ? AND created_at > ? AND response_time > 5000
  `).bind(projectId, timeFilter).first();

  const totalRequests = times.length;
  const uptime = totalRequests > 0 
    ? ((totalRequests - downtimeResult.failures) / totalRequests * 100).toFixed(2)
    : 100;

  return {
    avgResponseTime: performanceResult?.avg_response || 0,
    minResponseTime: performanceResult?.min_response || 0,
    maxResponseTime: performanceResult?.max_response || 0,
    p50,
    p95,
    p99,
    uptime,
    totalRequests
  };
}

function getTimeFilter(timeRange) {
  const now = new Date();
  switch (timeRange) {
    case '1h':
      return new Date(now.getTime() - 3600000).toISOString();
    case '24h':
      return new Date(now.getTime() - 86400000).toISOString();
    case '7d':
      return new Date(now.getTime() - 604800000).toISOString();
    case '30d':
      return new Date(now.getTime() - 2592000000).toISOString();
    default:
      return new Date(now.getTime() - 86400000).toISOString();
  }
}

// ============= EXPORT ALL SERVICES =============

export default {
  ActivityLogger,
  EnhancedFraudDetection,
  ActiveUsersTracker,
  ABTestingAnalyzer,
  WebhookManager,
  calculateQuickStats,
  calculatePerformanceAnalytics,
  AdvancedAnalyticsTypes
};