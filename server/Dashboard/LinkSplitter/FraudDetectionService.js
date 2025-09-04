/**
 * Fraud Detection and Bot Scoring Service for LinkSplitter
 * Advanced fraud prevention and bot detection algorithms
 */

import crypto from 'crypto';

/**
 * Main fraud detection class
 */
export class FraudDetectionService {
  constructor(env) {
    this.env = env;
    this.suspiciousPatterns = this.initializeSuspiciousPatterns();
    this.botSignatures = this.initializeBotSignatures();
  }
  
  /**
   * Calculate comprehensive fraud score for a request
   */
  async calculateFraudScore(request, eventData) {
    const scores = {
      ip: 0,
      behavior: 0,
      device: 0,
      network: 0,
      pattern: 0,
      velocity: 0
    };
    
    // 1. IP Reputation Score
    scores.ip = await this.getIpReputationScore(eventData.ip_address);
    
    // 2. Behavioral Analysis Score
    scores.behavior = await this.analyzeBehavior(eventData);
    
    // 3. Device Fingerprint Score
    scores.device = this.analyzeDevice(eventData);
    
    // 4. Network Analysis Score
    scores.network = await this.analyzeNetwork(request, eventData);
    
    // 5. Pattern Recognition Score
    scores.pattern = this.detectSuspiciousPatterns(eventData);
    
    // 6. Click Velocity Score
    scores.velocity = await this.analyzeClickVelocity(eventData);
    
    // Calculate weighted total score
    const totalScore = this.calculateWeightedScore(scores);
    
    // Store fraud analysis
    await this.storeFraudAnalysis(eventData, scores, totalScore);
    
    return {
      score: Math.min(Math.round(totalScore), 100),
      components: scores,
      threat_level: this.getThreatLevel(totalScore),
      action: this.getRecommendedAction(totalScore)
    };
  }
  
  /**
   * Get IP reputation score
   */
  async getIpReputationScore(ipAddress) {
    let score = 0;
    
    // Check if IP is in our fraud database
    const fraudRecord = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT * FROM fraud_scores 
      WHERE ip_address = ?
    `).bind(ipAddress).first();
    
    if (fraudRecord) {
      score = fraudRecord.base_score;
      
      // Add penalties for known proxy/VPN indicators
      if (fraudRecord.vpn_detected) score += 20;
      if (fraudRecord.proxy_detected) score += 25;
      if (fraudRecord.tor_detected) score += 35;
      if (fraudRecord.hosting_provider) score += 15;
      
      // Consider historical behavior
      if (fraudRecord.suspicious_events > 10) score += 10;
      if (fraudRecord.blocked_events > 5) score += 15;
    } else {
      // New IP, start with neutral score
      score = 30;
    }
    
    // Check IP against known bad IP ranges
    if (this.isInBadIpRange(ipAddress)) {
      score += 30;
    }
    
    // Check for datacenter IPs
    if (await this.isDatacenterIp(ipAddress)) {
      score += 15;
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * Analyze user behavior for fraud indicators
   */
  async analyzeBehavior(eventData) {
    let score = 0;
    
    // Check session behavior
    const sessionHistory = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT 
        COUNT(*) as event_count,
        COUNT(DISTINCT clicked_url) as unique_urls,
        MIN(created_at) as first_event,
        MAX(created_at) as last_event,
        AVG(time_on_page) as avg_time_on_page
      FROM analytics_events
      WHERE session_id = ?
      AND created_at >= datetime('now', '-1 hour')
    `).bind(eventData.session_id).first();
    
    // Rapid-fire clicking (more than 10 events in 1 minute)
    if (sessionHistory.event_count > 10) {
      const duration = (new Date(sessionHistory.last_event) - new Date(sessionHistory.first_event)) / 1000;
      if (duration < 60) score += 30;
    }
    
    // No time on page (immediate bounce)
    if (eventData.time_on_page === 0) score += 10;
    
    // Suspicious scroll patterns (100% scroll in < 1 second)
    if (eventData.scroll_depth === 100 && eventData.time_on_page < 1) score += 20;
    
    // Check for JavaScript disabled (no performance metrics)
    if (!eventData.page_load_time && !eventData.dom_interactive_time) score += 15;
    
    // Check referrer consistency
    if (eventData.referrer_url) {
      const referrerMismatch = await this.checkReferrerConsistency(
        eventData.session_id,
        eventData.referrer_url
      );
      if (referrerMismatch) score += 10;
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * Analyze device fingerprint for fraud
   */
  analyzeDevice(eventData) {
    let score = 0;
    
    // Check for headless browsers
    const headlessIndicators = [
      'HeadlessChrome',
      'PhantomJS',
      'Nightmare',
      'Selenium'
    ];
    
    if (headlessIndicators.some(indicator => 
      eventData.user_agent?.includes(indicator)
    )) {
      score += 40;
    }
    
    // Check for missing or suspicious user agent
    if (!eventData.user_agent || eventData.user_agent.length < 20) {
      score += 20;
    }
    
    // Check for impossible device combinations
    if (this.hasImpossibleDeviceCombination(eventData)) {
      score += 30;
    }
    
    // Check screen resolution anomalies
    if (eventData.screen_width && eventData.screen_height) {
      // Unusual resolutions (not standard sizes)
      const resolution = `${eventData.screen_width}x${eventData.screen_height}`;
      if (!this.isStandardResolution(resolution)) {
        score += 10;
      }
      
      // Viewport larger than screen (impossible)
      if (eventData.viewport_width > eventData.screen_width ||
          eventData.viewport_height > eventData.screen_height) {
        score += 25;
      }
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * Analyze network characteristics
   */
  async analyzeNetwork(request, eventData) {
    let score = 0;
    
    // Check Cloudflare threat score
    const cfThreatScore = parseInt(request.cf?.threatScore || 0);
    score += Math.min(cfThreatScore, 50);
    
    // Check if bot detected by Cloudflare
    if (request.cf?.botManagement?.verifiedBot) {
      score += 30;
    }
    
    // Check for suspicious ASN
    const suspiciousAsns = await this.getSuspiciousAsns();
    if (suspiciousAsns.includes(request.cf?.asn)) {
      score += 20;
    }
    
    // Check for multiple IPs from same session
    const ipCount = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT COUNT(DISTINCT ip_address) as ip_count
      FROM analytics_events
      WHERE session_id = ?
    `).bind(eventData.session_id).first();
    
    if (ipCount.ip_count > 3) score += 20;
    if (ipCount.ip_count > 5) score += 30;
    
    return Math.min(score, 100);
  }
  
  /**
   * Detect suspicious patterns
   */
  detectSuspiciousPatterns(eventData) {
    let score = 0;
    
    // Check for pattern-based fraud
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(eventData)) {
        score += pattern.score;
      }
    }
    
    return Math.min(score, 100);
  }
  
  /**
   * Analyze click velocity
   */
  async analyzeClickVelocity(eventData) {
    let score = 0;
    
    // Check clicks in last minute
    const recentClicks = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT COUNT(*) as count
      FROM analytics_events
      WHERE ip_address = ?
      AND created_at >= datetime('now', '-1 minute')
    `).bind(eventData.ip_address).first();
    
    // More than 10 clicks per minute is suspicious
    if (recentClicks.count > 10) score += 20;
    if (recentClicks.count > 20) score += 30;
    if (recentClicks.count > 50) score += 50;
    
    // Check clicks in last hour
    const hourlyClicks = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT COUNT(*) as count
      FROM analytics_events
      WHERE ip_address = ?
      AND created_at >= datetime('now', '-1 hour')
    `).bind(eventData.ip_address).first();
    
    // More than 100 clicks per hour is suspicious
    if (hourlyClicks.count > 100) score += 10;
    if (hourlyClicks.count > 500) score += 20;
    if (hourlyClicks.count > 1000) score += 30;
    
    return Math.min(score, 100);
  }
  
  /**
   * Calculate weighted total score
   */
  calculateWeightedScore(scores) {
    const weights = {
      ip: 0.25,
      behavior: 0.20,
      device: 0.15,
      network: 0.20,
      pattern: 0.10,
      velocity: 0.10
    };
    
    let totalScore = 0;
    for (const [key, value] of Object.entries(scores)) {
      totalScore += value * weights[key];
    }
    
    return totalScore;
  }
  
  /**
   * Get threat level based on score
   */
  getThreatLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }
  
  /**
   * Get recommended action based on score
   */
  getRecommendedAction(score) {
    if (score >= 80) return 'block';
    if (score >= 60) return 'challenge';
    if (score >= 40) return 'monitor';
    return 'allow';
  }
  
  /**
   * Store fraud analysis for future reference
   */
  async storeFraudAnalysis(eventData, scores, totalScore) {
    try {
      await this.env.LINKSPLITTER_DB.prepare(`
        INSERT OR REPLACE INTO fraud_scores (
          ip_address,
          base_score,
          click_velocity_score,
          session_anomaly_score,
          device_switching_score,
          total_events,
          suspicious_events,
          blocked_events,
          last_updated
        ) VALUES (?, ?, ?, ?, ?, 
          COALESCE((SELECT total_events FROM fraud_scores WHERE ip_address = ?), 0) + 1,
          COALESCE((SELECT suspicious_events FROM fraud_scores WHERE ip_address = ?), 0) + ?,
          COALESCE((SELECT blocked_events FROM fraud_scores WHERE ip_address = ?), 0) + ?,
          CURRENT_TIMESTAMP
        )
      `).bind(
        eventData.ip_address,
        Math.round(totalScore),
        scores.velocity,
        scores.behavior,
        scores.device,
        eventData.ip_address,
        eventData.ip_address,
        totalScore >= 60 ? 1 : 0,
        eventData.ip_address,
        totalScore >= 80 ? 1 : 0
      ).run();
    } catch (error) {
      console.error('Error storing fraud analysis:', error);
    }
  }
  
  /**
   * Initialize suspicious patterns
   */
  initializeSuspiciousPatterns() {
    return [
      {
        name: 'rapid_country_switching',
        test: async (eventData) => {
          // Check if user switched countries in same session
          const countries = await this.env.LINKSPLITTER_DB.prepare(`
            SELECT COUNT(DISTINCT country_code) as count
            FROM analytics_events
            WHERE session_id = ?
          `).bind(eventData.session_id).first();
          return countries.count > 3;
        },
        score: 30
      },
      {
        name: 'suspicious_utm_pattern',
        test: (eventData) => {
          // Check for suspicious UTM parameters
          const utm = eventData.utm_source || '';
          return utm.includes('bot') || utm.includes('crawler') || utm.includes('scraper');
        },
        score: 20
      },
      {
        name: 'no_javascript_metrics',
        test: (eventData) => {
          // No JavaScript metrics indicates automated traffic
          return !eventData.page_load_time && 
                 !eventData.dom_interactive_time &&
                 !eventData.screen_width;
        },
        score: 15
      }
    ];
  }
  
  /**
   * Initialize bot signatures
   */
  initializeBotSignatures() {
    return {
      userAgents: [
        /bot/i, /crawler/i, /spider/i, /scraper/i,
        /facebookexternalhit/i, /whatsapp/i, /telegram/i,
        /slackbot/i, /discord/i, /curl/i, /wget/i, /python/i,
        /java/i, /perl/i, /ruby/i, /go-http-client/i
      ],
      behaviors: [
        'no_mouse_movement',
        'linear_scrolling',
        'no_random_delays',
        'consistent_timing'
      ]
    };
  }
  
  /**
   * Check if IP is in bad range
   */
  isInBadIpRange(ipAddress) {
    // Known bad IP ranges (simplified example)
    const badRanges = [
      '192.168.',  // Private network
      '10.',       // Private network
      '172.16.',   // Private network
      '127.',      // Localhost
    ];
    
    return badRanges.some(range => ipAddress.startsWith(range));
  }
  
  /**
   * Check if IP belongs to datacenter
   */
  async isDatacenterIp(ipAddress) {
    // Check against known datacenter ASNs
    const datacenterAsns = [
      15169,  // Google
      16509,  // Amazon AWS
      8075,   // Microsoft Azure
      14061,  // DigitalOcean
      20473,  // Vultr
      16276,  // OVH
    ];
    
    const result = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT as_number FROM analytics_events
      WHERE ip_address = ?
      LIMIT 1
    `).bind(ipAddress).first();
    
    return datacenterAsns.includes(result?.as_number);
  }
  
  /**
   * Check for impossible device combinations
   */
  hasImpossibleDeviceCombination(eventData) {
    // iOS with non-Safari browser (older iOS versions)
    if (eventData.os_name === 'iOS' && 
        eventData.browser_name !== 'Safari' &&
        eventData.browser_name !== 'Chrome') {
      return true;
    }
    
    // Mobile device with desktop screen size
    if (eventData.device_type === 'mobile' &&
        eventData.screen_width > 1920) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if resolution is standard
   */
  isStandardResolution(resolution) {
    const standardResolutions = [
      '1920x1080', '1366x768', '1440x900', '1536x864',
      '1280x720', '1600x900', '2560x1440', '3840x2160',
      '375x667', '414x896', '360x640', '412x915',
      '390x844', '393x852', '428x926', '384x854'
    ];
    
    return standardResolutions.includes(resolution);
  }
  
  /**
   * Check referrer consistency
   */
  async checkReferrerConsistency(sessionId, currentReferrer) {
    const previousEvent = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT referrer_url, clicked_url
      FROM analytics_events
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 1 OFFSET 1
    `).bind(sessionId).first();
    
    if (!previousEvent) return false;
    
    // Check if current referrer should match previous clicked URL
    try {
      const previousDomain = new URL(previousEvent.clicked_url).hostname;
      const currentReferrerDomain = new URL(currentReferrer).hostname;
      
      // If domains don't match and it's not a known redirect, it's suspicious
      return previousDomain !== currentReferrerDomain;
    } catch {
      return false;
    }
  }
  
  /**
   * Get list of suspicious ASNs
   */
  async getSuspiciousAsns() {
    // This could be fetched from a threat intelligence feed
    return [
      // Known proxy/VPN providers
      13335,  // Cloudflare (when used as proxy)
      9009,   // M247
      60068,  // CDN77
      201011, // Core-Backbone
      24940,  // Hetzner
    ];
  }
}

/**
 * Bot detection service
 */
export class BotDetectionService {
  constructor(env) {
    this.env = env;
  }
  
  /**
   * Comprehensive bot detection
   */
  async detectBot(request, eventData) {
    const checks = {
      userAgent: this.checkUserAgentForBot(eventData.user_agent),
      cloudflare: this.checkCloudflareBot(request),
      behavior: await this.checkBehaviorForBot(eventData),
      honeypot: this.checkHoneypot(eventData),
      fingerprint: this.checkFingerprint(eventData)
    };
    
    const isBot = Object.values(checks).some(check => check === true);
    const confidence = this.calculateBotConfidence(checks);
    
    return {
      is_bot: isBot,
      is_crawler: checks.userAgent && this.isCrawler(eventData.user_agent),
      confidence,
      checks
    };
  }
  
  /**
   * Check user agent for bot signatures
   */
  checkUserAgentForBot(userAgent) {
    if (!userAgent) return true;
    
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /facebookexternalhit/i, /whatsapp/i, /telegram/i,
      /slackbot/i, /discord/i, /curl/i, /wget/i,
      /python/i, /java/i, /perl/i, /ruby/i,
      /go-http-client/i, /axios/i, /node-fetch/i
    ];
    
    return botPatterns.some(pattern => pattern.test(userAgent));
  }
  
  /**
   * Check Cloudflare bot detection
   */
  checkCloudflareBot(request) {
    return request.cf?.botManagement?.verifiedBot || false;
  }
  
  /**
   * Check behavioral patterns for bot activity
   */
  async checkBehaviorForBot(eventData) {
    // Check for impossibly fast actions
    if (eventData.time_on_page === 0 && eventData.clicks_count > 0) {
      return true;
    }
    
    // Check for perfect linear scrolling
    if (eventData.scroll_depth === 100 && eventData.time_on_page < 2) {
      return true;
    }
    
    // Check for consistent timing patterns
    const timingPattern = await this.checkTimingPattern(eventData.session_id);
    if (timingPattern) return true;
    
    return false;
  }
  
  /**
   * Check honeypot fields
   */
  checkHoneypot(eventData) {
    // If honeypot fields are filled (should be invisible to humans)
    return eventData.custom_params?.honeypot ? true : false;
  }
  
  /**
   * Check device fingerprint anomalies
   */
  checkFingerprint(eventData) {
    // Missing critical browser APIs
    if (!eventData.screen_width || !eventData.screen_height) {
      return true;
    }
    
    // Headless browser indicators
    if (eventData.user_agent?.includes('HeadlessChrome')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if user agent is a known crawler
   */
  isCrawler(userAgent) {
    const crawlers = [
      'googlebot', 'bingbot', 'yandexbot', 'baiduspider',
      'duckduckbot', 'slurp', 'facebookexternalhit',
      'linkedinbot', 'whatsapp', 'telegram'
    ];
    
    const lowerUA = userAgent.toLowerCase();
    return crawlers.some(crawler => lowerUA.includes(crawler));
  }
  
  /**
   * Check for timing pattern anomalies
   */
  async checkTimingPattern(sessionId) {
    const events = await this.env.LINKSPLITTER_DB.prepare(`
      SELECT created_at
      FROM analytics_events
      WHERE session_id = ?
      ORDER BY created_at
      LIMIT 10
    `).bind(sessionId).all();
    
    if (events.results.length < 3) return false;
    
    // Check for perfectly consistent intervals (bot behavior)
    const intervals = [];
    for (let i = 1; i < events.results.length; i++) {
      const interval = new Date(events.results[i].created_at) - 
                       new Date(events.results[i-1].created_at);
      intervals.push(interval);
    }
    
    // If all intervals are exactly the same, it's likely a bot
    const uniqueIntervals = new Set(intervals);
    return uniqueIntervals.size === 1;
  }
  
  /**
   * Calculate bot detection confidence
   */
  calculateBotConfidence(checks) {
    const weights = {
      userAgent: 0.3,
      cloudflare: 0.3,
      behavior: 0.2,
      honeypot: 0.1,
      fingerprint: 0.1
    };
    
    let confidence = 0;
    for (const [key, value] of Object.entries(checks)) {
      if (value) confidence += weights[key];
    }
    
    return Math.round(confidence * 100);
  }
}

/**
 * Rate limiting service
 */
export class RateLimitService {
  constructor(env) {
    this.env = env;
    this.limits = {
      ip: { requests: 100, window: 60 },        // 100 requests per minute
      session: { requests: 50, window: 60 },     // 50 requests per minute
      project: { requests: 1000, window: 60 }    // 1000 requests per minute
    };
  }
  
  /**
   * Check if request should be rate limited
   */
  async checkRateLimit(identifier, type = 'ip') {
    const limit = this.limits[type];
    if (!limit) return false;
    
    const key = `ratelimit:${type}:${identifier}`;
    const now = Date.now();
    const windowStart = now - (limit.window * 1000);
    
    // Get recent requests from KV or database
    const recentRequests = await this.getRecentRequests(key, windowStart);
    
    if (recentRequests >= limit.requests) {
      await this.recordRateLimitHit(identifier, type);
      return true;
    }
    
    // Record this request
    await this.recordRequest(key, now);
    
    return false;
  }
  
  /**
   * Get count of recent requests
   */
  async getRecentRequests(key, windowStart) {
    // Simplified - in production, use Redis or KV for better performance
    try {
      const result = await this.env.LINKSPLITTER_DB.prepare(`
        SELECT COUNT(*) as count
        FROM rate_limit_log
        WHERE key = ? AND timestamp > ?
      `).bind(key, windowStart).first();
      
      return result?.count || 0;
    } catch {
      return 0;
    }
  }
  
  /**
   * Record a request for rate limiting
   */
  async recordRequest(key, timestamp) {
    try {
      await this.env.LINKSPLITTER_DB.prepare(`
        INSERT INTO rate_limit_log (key, timestamp)
        VALUES (?, ?)
      `).bind(key, timestamp).run();
      
      // Clean old entries
      await this.env.LINKSPLITTER_DB.prepare(`
        DELETE FROM rate_limit_log
        WHERE timestamp < ?
      `).bind(Date.now() - 3600000).run(); // Clean entries older than 1 hour
    } catch (error) {
      console.error('Error recording request:', error);
    }
  }
  
  /**
   * Record rate limit hit
   */
  async recordRateLimitHit(identifier, type) {
    try {
      await this.env.LINKSPLITTER_DB.prepare(`
        INSERT INTO rate_limit_violations (identifier, type, timestamp)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `).bind(identifier, type).run();
    } catch (error) {
      console.error('Error recording rate limit hit:', error);
    }
  }
}

// Schema for rate limiting tables
export const rateLimitSchema = `
CREATE TABLE IF NOT EXISTS rate_limit_log (
  key VARCHAR(255),
  timestamp BIGINT,
  INDEX idx_rate_limit_key_time (key, timestamp)
);

CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier VARCHAR(255),
  type VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_violations_identifier (identifier)
);
`;