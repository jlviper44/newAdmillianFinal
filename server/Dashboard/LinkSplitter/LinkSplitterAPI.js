const express = require('express');
const router = express.Router();
const geoip = require('geoip-lite');
const Database = require('better-sqlite3');
const path = require('path');
const {
  generateShortId,
  generateId,
  detectDevice,
  detectBot,
  calculateFraudScore,
  checkTargetingMatch,
  evaluateTargeting,
  getBestMatch,
  normalizeWeights,
  generateSessionId,
  validateUrl,
  getClientIp
} = require('./LinkSplitter');

// Initialize database
const db = new Database(path.join(__dirname, '../../../campaigns.db'));

// Initialize database schema
const initSchema = require('fs').readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(initSchema);

// ============= MIDDLEWARE =============

/**
 * Authentication middleware
 */
const requireAuth = (req, res, next) => {
  // Use existing auth from the Dashboard
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ============= REDIRECT HANDLER =============

/**
 * Main redirect handler for short links
 */
router.get('/:shortLink', async (req, res) => {
  const { shortLink } = req.params;
  
  try {
    // Look up project by custom alias
    const project = db.prepare(`
      SELECT * FROM link_projects 
      WHERE custom_alias = ? AND status = 'active'
    `).get(shortLink);
    
    if (!project) {
      return res.status(404).send('Link not found');
    }
    
    // Parse JSON fields
    const items = JSON.parse(project.items || '[]');
    const targeting = JSON.parse(project.targeting || '[]');
    const fraudProtection = JSON.parse(project.fraud_protection || '{}');
    
    // Check if link has expired
    if (project.expires_at && new Date(project.expires_at) < new Date()) {
      // Update status
      db.prepare('UPDATE link_projects SET status = ? WHERE id = ?')
        .run('expired', project.id);
      return res.redirect(project.safe_link || project.main_url);
    }
    
    // Check click limit
    if (project.clicks_limit && project.click_count >= project.clicks_limit) {
      return res.redirect(project.safe_link || project.main_url);
    }
    
    // Get client info
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const geoData = geoip.lookup(clientIp);
    const sessionId = generateSessionId(req);
    
    // Fraud detection
    const fraudScore = calculateFraudScore(req, clientIp, userAgent);
    const isBot = detectBot(userAgent);
    
    if (fraudProtection.enabled) {
      if (fraudProtection.blockBots && isBot) {
        return res.redirect(project.safe_link || project.main_url);
      }
      
      if (fraudScore > (fraudProtection.suspiciousThreshold || 70)) {
        return res.redirect(project.safe_link || project.main_url);
      }
    }
    
    // Get best matching URL
    const bestMatch = getBestMatch(items, req, geoData, project.safe_link, targeting);
    
    if (!bestMatch || !bestMatch.url) {
      return res.redirect(project.main_url);
    }
    
    // Track click
    const clickId = db.prepare(`
      INSERT INTO link_clicks (
        project_id, session_id, ip_address, user_agent, referrer,
        country, city, region, device_type, clicked_url,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        fraud_score, is_bot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project.id,
      sessionId,
      clientIp,
      userAgent,
      req.headers['referer'] || '',
      geoData?.country || '',
      geoData?.city || '',
      geoData?.region || '',
      detectDevice(userAgent),
      bestMatch.url,
      req.query.utm_source || '',
      req.query.utm_medium || '',
      req.query.utm_campaign || '',
      req.query.utm_term || '',
      req.query.utm_content || '',
      fraudScore,
      isBot ? 1 : 0
    ).lastInsertRowid;
    
    // Update click count
    db.prepare('UPDATE link_projects SET click_count = click_count + 1 WHERE id = ?')
      .run(project.id);
    
    // Redirect to the best matching URL
    res.redirect(bestMatch.url);
    
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Internal server error');
  }
});

// ============= API ENDPOINTS =============

// Groups Management

/**
 * Get all groups for the current user
 */
router.get('/api/link-splitter/groups', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const groups = db.prepare(`
      SELECT * FROM link_groups 
      WHERE user_id = ? OR team_id IN (
        SELECT team_id FROM team_members WHERE user_id = ?
      )
      ORDER BY created_at DESC
    `).all(userId, userId);
    
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

/**
 * Create a new group
 */
router.post('/api/link-splitter/groups', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { name, description, team_id } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    
    const groupId = generateId();
    
    db.prepare(`
      INSERT INTO link_groups (id, user_id, team_id, name, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(groupId, userId, team_id || null, name, description || '');
    
    const group = db.prepare('SELECT * FROM link_groups WHERE id = ?').get(groupId);
    res.json(group);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

/**
 * Update a group
 */
router.put('/api/link-splitter/groups/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const userId = req.session.user.id;
    
    // Check ownership
    const group = db.prepare('SELECT * FROM link_groups WHERE id = ? AND user_id = ?')
      .get(id, userId);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    db.prepare(`
      UPDATE link_groups 
      SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, description || '', id);
    
    const updated = db.prepare('SELECT * FROM link_groups WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

/**
 * Delete a group
 */
router.delete('/api/link-splitter/groups/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    
    // Check ownership
    const group = db.prepare('SELECT * FROM link_groups WHERE id = ? AND user_id = ?')
      .get(id, userId);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    db.prepare('DELETE FROM link_groups WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Projects Management

/**
 * Get all projects for the current user
 */
router.get('/api/link-splitter/projects', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { group_id } = req.query;
    
    let query = `
      SELECT p.*, g.name as group_name 
      FROM link_projects p
      LEFT JOIN link_groups g ON p.group_id = g.id
      WHERE p.user_id = ? OR p.team_id IN (
        SELECT team_id FROM team_members WHERE user_id = ?
      )
    `;
    
    const params = [userId, userId];
    
    if (group_id) {
      query += ' AND p.group_id = ?';
      params.push(group_id);
    }
    
    query += ' ORDER BY p.created_at DESC';
    
    const projects = db.prepare(query).all(...params);
    
    // Parse JSON fields
    projects.forEach(project => {
      project.items = JSON.parse(project.items || '[]');
      project.targeting = JSON.parse(project.targeting || '[]');
      project.fraud_protection = JSON.parse(project.fraud_protection || '{}');
      project.ab_testing = JSON.parse(project.ab_testing || '{}');
      project.pixel_settings = JSON.parse(project.pixel_settings || '{}');
    });
    
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * Get a single project
 */
router.get('/api/link-splitter/projects/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    
    const project = db.prepare(`
      SELECT p.*, g.name as group_name 
      FROM link_projects p
      LEFT JOIN link_groups g ON p.group_id = g.id
      WHERE p.id = ? AND (p.user_id = ? OR p.team_id IN (
        SELECT team_id FROM team_members WHERE user_id = ?
      ))
    `).get(id, userId, userId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Parse JSON fields
    project.items = JSON.parse(project.items || '[]');
    project.targeting = JSON.parse(project.targeting || '[]');
    project.fraud_protection = JSON.parse(project.fraud_protection || '{}');
    project.ab_testing = JSON.parse(project.ab_testing || '{}');
    project.pixel_settings = JSON.parse(project.pixel_settings || '{}');
    
    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * Create a new project
 */
router.post('/api/link-splitter/projects', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const {
      group_id,
      team_id,
      name,
      main_url,
      custom_alias,
      safe_link,
      items,
      targeting,
      fraud_protection,
      ab_testing,
      pixel_settings,
      expires_at,
      clicks_limit
    } = req.body;
    
    // Validate required fields
    if (!name || !main_url) {
      return res.status(400).json({ error: 'Name and main URL are required' });
    }
    
    // Validate main URL
    const { valid, error } = validateUrl(main_url);
    if (!valid) {
      return res.status(400).json({ error: `Invalid main URL: ${error}` });
    }
    
    // Generate custom alias if not provided
    const alias = custom_alias || generateShortId();
    
    // Check if alias is already taken
    const existing = db.prepare('SELECT id FROM link_projects WHERE custom_alias = ?')
      .get(alias);
    
    if (existing) {
      return res.status(400).json({ error: 'This alias is already taken' });
    }
    
    const projectId = generateId();
    
    // Normalize weights for items
    const normalizedItems = normalizeWeights(items || []);
    
    db.prepare(`
      INSERT INTO link_projects (
        id, group_id, team_id, user_id, name, main_url, custom_alias,
        safe_link, items, targeting, fraud_protection, ab_testing,
        pixel_settings, expires_at, clicks_limit, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      group_id || null,
      team_id || null,
      userId,
      name,
      main_url,
      alias,
      safe_link || null,
      JSON.stringify(normalizedItems),
      JSON.stringify(targeting || []),
      JSON.stringify(fraud_protection || {}),
      JSON.stringify(ab_testing || {}),
      JSON.stringify(pixel_settings || {}),
      expires_at || null,
      clicks_limit || null,
      'active'
    );
    
    const project = db.prepare('SELECT * FROM link_projects WHERE id = ?').get(projectId);
    
    // Parse JSON fields
    project.items = JSON.parse(project.items);
    project.targeting = JSON.parse(project.targeting);
    project.fraud_protection = JSON.parse(project.fraud_protection);
    project.ab_testing = JSON.parse(project.ab_testing);
    project.pixel_settings = JSON.parse(project.pixel_settings);
    
    res.json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * Update a project
 */
router.put('/api/link-splitter/projects/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    const {
      name,
      main_url,
      custom_alias,
      safe_link,
      items,
      targeting,
      fraud_protection,
      ab_testing,
      pixel_settings,
      expires_at,
      clicks_limit,
      status
    } = req.body;
    
    // Check ownership
    const project = db.prepare('SELECT * FROM link_projects WHERE id = ? AND user_id = ?')
      .get(id, userId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // If changing alias, check if it's available
    if (custom_alias && custom_alias !== project.custom_alias) {
      const existing = db.prepare('SELECT id FROM link_projects WHERE custom_alias = ? AND id != ?')
        .get(custom_alias, id);
      
      if (existing) {
        return res.status(400).json({ error: 'This alias is already taken' });
      }
    }
    
    // Normalize weights for items
    const normalizedItems = normalizeWeights(items || JSON.parse(project.items));
    
    db.prepare(`
      UPDATE link_projects SET
        name = ?,
        main_url = ?,
        custom_alias = ?,
        safe_link = ?,
        items = ?,
        targeting = ?,
        fraud_protection = ?,
        ab_testing = ?,
        pixel_settings = ?,
        expires_at = ?,
        clicks_limit = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || project.name,
      main_url || project.main_url,
      custom_alias || project.custom_alias,
      safe_link !== undefined ? safe_link : project.safe_link,
      JSON.stringify(normalizedItems),
      JSON.stringify(targeting || JSON.parse(project.targeting)),
      JSON.stringify(fraud_protection || JSON.parse(project.fraud_protection)),
      JSON.stringify(ab_testing || JSON.parse(project.ab_testing)),
      JSON.stringify(pixel_settings || JSON.parse(project.pixel_settings)),
      expires_at !== undefined ? expires_at : project.expires_at,
      clicks_limit !== undefined ? clicks_limit : project.clicks_limit,
      status || project.status,
      id
    );
    
    const updated = db.prepare('SELECT * FROM link_projects WHERE id = ?').get(id);
    
    // Parse JSON fields
    updated.items = JSON.parse(updated.items);
    updated.targeting = JSON.parse(updated.targeting);
    updated.fraud_protection = JSON.parse(updated.fraud_protection);
    updated.ab_testing = JSON.parse(updated.ab_testing);
    updated.pixel_settings = JSON.parse(updated.pixel_settings);
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * Delete a project
 */
router.delete('/api/link-splitter/projects/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    
    // Check ownership
    const project = db.prepare('SELECT * FROM link_projects WHERE id = ? AND user_id = ?')
      .get(id, userId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    db.prepare('DELETE FROM link_projects WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

/**
 * Duplicate a project
 */
router.post('/api/link-splitter/projects/:id/duplicate', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    const { name, custom_alias } = req.body;
    
    // Get original project
    const original = db.prepare('SELECT * FROM link_projects WHERE id = ? AND user_id = ?')
      .get(id, userId);
    
    if (!original) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const newId = generateId();
    const newAlias = custom_alias || generateShortId();
    const newName = name || `${original.name} (Copy)`;
    
    // Check if alias is available
    const existing = db.prepare('SELECT id FROM link_projects WHERE custom_alias = ?')
      .get(newAlias);
    
    if (existing) {
      return res.status(400).json({ error: 'This alias is already taken' });
    }
    
    db.prepare(`
      INSERT INTO link_projects (
        id, group_id, team_id, user_id, name, main_url, custom_alias,
        safe_link, items, targeting, fraud_protection, ab_testing,
        pixel_settings, expires_at, clicks_limit, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      original.group_id,
      original.team_id,
      userId,
      newName,
      original.main_url,
      newAlias,
      original.safe_link,
      original.items,
      original.targeting,
      original.fraud_protection,
      original.ab_testing,
      original.pixel_settings,
      original.expires_at,
      original.clicks_limit,
      'active'
    );
    
    const duplicated = db.prepare('SELECT * FROM link_projects WHERE id = ?').get(newId);
    
    // Parse JSON fields
    duplicated.items = JSON.parse(duplicated.items);
    duplicated.targeting = JSON.parse(duplicated.targeting);
    duplicated.fraud_protection = JSON.parse(duplicated.fraud_protection);
    duplicated.ab_testing = JSON.parse(duplicated.ab_testing);
    duplicated.pixel_settings = JSON.parse(duplicated.pixel_settings);
    
    res.json(duplicated);
  } catch (error) {
    console.error('Error duplicating project:', error);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

// Analytics

/**
 * Get analytics for a project
 */
router.get('/api/link-splitter/analytics/:projectId', requireAuth, (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user.id;
    const { period = '7d', start_date, end_date } = req.query;
    
    // Check ownership
    const project = db.prepare('SELECT * FROM link_projects WHERE id = ? AND user_id = ?')
      .get(projectId, userId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Calculate date range
    let startDate, endDate;
    
    if (start_date && end_date) {
      startDate = start_date;
      endDate = end_date;
    } else {
      endDate = new Date().toISOString();
      const days = parseInt(period) || 7;
      startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    }
    
    // Get click statistics
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_clicks,
        COUNT(DISTINCT session_id) as unique_visitors,
        SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot_clicks,
        AVG(fraud_score) as avg_fraud_score,
        COUNT(DISTINCT DATE(clicked_at)) as active_days
      FROM link_clicks
      WHERE project_id = ? AND clicked_at BETWEEN ? AND ?
    `).get(projectId, startDate, endDate);
    
    // Get device breakdown
    const devices = db.prepare(`
      SELECT 
        device_type,
        COUNT(*) as count
      FROM link_clicks
      WHERE project_id = ? AND clicked_at BETWEEN ? AND ?
      GROUP BY device_type
      ORDER BY count DESC
    `).all(projectId, startDate, endDate);
    
    // Get top countries
    const countries = db.prepare(`
      SELECT 
        country,
        COUNT(*) as count
      FROM link_clicks
      WHERE project_id = ? AND clicked_at BETWEEN ? AND ? AND country != ''
      GROUP BY country
      ORDER BY count DESC
      LIMIT 10
    `).all(projectId, startDate, endDate);
    
    // Get top referrers
    const referrers = db.prepare(`
      SELECT 
        referrer,
        COUNT(*) as count
      FROM link_clicks
      WHERE project_id = ? AND clicked_at BETWEEN ? AND ? AND referrer != ''
      GROUP BY referrer
      ORDER BY count DESC
      LIMIT 10
    `).all(projectId, startDate, endDate);
    
    // Get click timeline
    const timeline = db.prepare(`
      SELECT 
        DATE(clicked_at) as date,
        COUNT(*) as clicks,
        COUNT(DISTINCT session_id) as unique_visitors
      FROM link_clicks
      WHERE project_id = ? AND clicked_at BETWEEN ? AND ?
      GROUP BY DATE(clicked_at)
      ORDER BY date ASC
    `).all(projectId, startDate, endDate);
    
    // Get URL performance
    const urlPerformance = db.prepare(`
      SELECT 
        clicked_url,
        COUNT(*) as clicks,
        COUNT(DISTINCT session_id) as unique_visitors
      FROM link_clicks
      WHERE project_id = ? AND clicked_at BETWEEN ? AND ?
      GROUP BY clicked_url
      ORDER BY clicks DESC
    `).all(projectId, startDate, endDate);
    
    res.json({
      stats,
      devices,
      countries,
      referrers,
      timeline,
      urlPerformance,
      period: { start: startDate, end: endDate }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * Get real-time analytics for a project
 */
router.get('/api/link-splitter/analytics/:projectId/realtime', requireAuth, (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user.id;
    
    // Check ownership
    const project = db.prepare('SELECT * FROM link_projects WHERE id = ? AND user_id = ?')
      .get(projectId, userId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get last 50 clicks
    const recentClicks = db.prepare(`
      SELECT 
        id,
        session_id,
        ip_address,
        country,
        city,
        device_type,
        clicked_url,
        referrer,
        fraud_score,
        is_bot,
        clicked_at
      FROM link_clicks
      WHERE project_id = ?
      ORDER BY clicked_at DESC
      LIMIT 50
    `).all(projectId);
    
    // Get active visitors (last 5 minutes)
    const activeVisitors = db.prepare(`
      SELECT COUNT(DISTINCT session_id) as count
      FROM link_clicks
      WHERE project_id = ? AND clicked_at > datetime('now', '-5 minutes')
    `).get(projectId);
    
    // Get clicks in last hour by minute
    const clicksByMinute = db.prepare(`
      SELECT 
        strftime('%H:%M', clicked_at) as minute,
        COUNT(*) as clicks
      FROM link_clicks
      WHERE project_id = ? AND clicked_at > datetime('now', '-1 hour')
      GROUP BY strftime('%H:%M', clicked_at)
      ORDER BY minute ASC
    `).all(projectId);
    
    res.json({
      recentClicks,
      activeVisitors: activeVisitors.count,
      clicksByMinute
    });
  } catch (error) {
    console.error('Error fetching real-time analytics:', error);
    res.status(500).json({ error: 'Failed to fetch real-time analytics' });
  }
});

/**
 * Export analytics data
 */
router.get('/api/link-splitter/analytics/:projectId/export', requireAuth, (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.session.user.id;
    const { format = 'json', start_date, end_date } = req.query;
    
    // Check ownership
    const project = db.prepare('SELECT * FROM link_projects WHERE id = ? AND user_id = ?')
      .get(projectId, userId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get all clicks for the date range
    let query = `
      SELECT * FROM link_clicks
      WHERE project_id = ?
    `;
    
    const params = [projectId];
    
    if (start_date && end_date) {
      query += ' AND clicked_at BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }
    
    query += ' ORDER BY clicked_at DESC';
    
    const clicks = db.prepare(query).all(...params);
    
    if (format === 'csv') {
      // Convert to CSV
      const csv = [
        'ID,Session ID,IP Address,Country,City,Device,URL,Referrer,UTM Source,UTM Medium,UTM Campaign,Fraud Score,Is Bot,Clicked At',
        ...clicks.map(click => [
          click.id,
          click.session_id,
          click.ip_address,
          click.country,
          click.city,
          click.device_type,
          click.clicked_url,
          click.referrer,
          click.utm_source,
          click.utm_medium,
          click.utm_campaign,
          click.fraud_score,
          click.is_bot,
          click.clicked_at
        ].join(','))
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${projectId}.csv"`);
      res.send(csv);
    } else {
      res.json(clicks);
    }
  } catch (error) {
    console.error('Error exporting analytics:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

// Testing & Validation

/**
 * Test a link configuration
 */
router.post('/api/link-splitter/test-link', requireAuth, (req, res) => {
  try {
    const { items, targeting, test_params } = req.body;
    
    // Create mock request object
    const mockReq = {
      headers: test_params?.headers || {},
      query: test_params?.query || {},
      ip: test_params?.ip || '127.0.0.1'
    };
    
    // Get geo data for test IP
    const geoData = geoip.lookup(mockReq.ip);
    
    // Get best match
    const bestMatch = getBestMatch(items, mockReq, geoData, null, targeting);
    
    // Evaluate targeting rules
    const targetingResult = evaluateTargeting(targeting || [], mockReq, geoData);
    
    res.json({
      bestMatch,
      targetingResult,
      geoData,
      device: detectDevice(mockReq.headers['user-agent']),
      fraudScore: calculateFraudScore(mockReq, mockReq.ip, mockReq.headers['user-agent'] || ''),
      isBot: detectBot(mockReq.headers['user-agent'] || '')
    });
  } catch (error) {
    console.error('Error testing link:', error);
    res.status(500).json({ error: 'Failed to test link' });
  }
});

/**
 * Validate a URL
 */
router.post('/api/link-splitter/validate-url', requireAuth, (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ valid: false, error: 'URL is required' });
    }
    
    const result = validateUrl(url);
    res.json(result);
  } catch (error) {
    console.error('Error validating URL:', error);
    res.status(500).json({ valid: false, error: 'Failed to validate URL' });
  }
});

/**
 * Check if an alias is available
 */
router.post('/api/link-splitter/check-alias', requireAuth, (req, res) => {
  try {
    const { alias, exclude_id } = req.body;
    
    if (!alias) {
      return res.status(400).json({ available: false, error: 'Alias is required' });
    }
    
    // Check if alias exists
    let query = 'SELECT id FROM link_projects WHERE custom_alias = ?';
    const params = [alias];
    
    if (exclude_id) {
      query += ' AND id != ?';
      params.push(exclude_id);
    }
    
    const existing = db.prepare(query).get(...params);
    
    res.json({
      available: !existing,
      alias
    });
  } catch (error) {
    console.error('Error checking alias:', error);
    res.status(500).json({ available: false, error: 'Failed to check alias' });
  }
});

module.exports = router;