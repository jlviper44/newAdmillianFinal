import {
  generateShortId,
  generateId,
  detectDevice,
  detectBot,
  calculateFraudScore,
  evaluateTargeting,
  getBestMatch,
  normalizeWeights,
  generateSessionId,
  validateUrl,
  getClientIp
} from './LinkSplitter.js';

// Database schema initialization SQL - Fixed for D1/SQLite
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS link_groups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  team_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS link_projects (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  team_id TEXT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  main_url TEXT NOT NULL,
  custom_alias TEXT UNIQUE,
  safe_link TEXT,
  items TEXT,
  targeting TEXT,
  fraud_protection TEXT,
  ab_testing TEXT,
  pixel_settings TEXT,
  expires_at DATETIME,
  clicks_limit INTEGER,
  click_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  clicked_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  fraud_score INTEGER DEFAULT 0,
  is_bot INTEGER DEFAULT 0,
  is_unique INTEGER DEFAULT 1,
  response_time INTEGER,
  clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_alias ON link_projects(custom_alias);
CREATE INDEX IF NOT EXISTS idx_projects_user ON link_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_clicks_project ON link_clicks(project_id, clicked_at);
CREATE INDEX IF NOT EXISTS idx_clicks_session ON link_clicks(session_id);
`;

/**
 * Initialize database schema
 */
async function initDatabase(env) {
  if (!env.DASHBOARD_DB) {
    console.error('DASHBOARD_DB binding not found');
    return null;
  }
  
  try {
    // Execute schema creation - split by statement and filter out empty ones
    const statements = SCHEMA_SQL.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      try {
        await env.DASHBOARD_DB.prepare(statement).run();
      } catch (error) {
        // Ignore errors for CREATE INDEX IF NOT EXISTS as they might already exist
        if (!statement.includes('CREATE INDEX')) {
          console.error('Error executing statement:', statement, error);
        }
      }
    }
  } catch (error) {
    console.error('Error initializing LinkSplitter schema:', error);
  }
  
  return env.DASHBOARD_DB;
}

/**
 * Get geo data from Cloudflare request
 */
function getGeoData(request) {
  const cf = request.cf;
  if (!cf) return null;
  
  return {
    country: cf.country,
    city: cf.city,
    region: cf.region,
    timezone: cf.timezone,
    latitude: cf.latitude,
    longitude: cf.longitude
  };
}

/**
 * Handle redirect for short links
 */
async function handleRedirect(request, env) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const shortLink = pathParts[pathParts.length - 1];
  
  console.log('Handling redirect for short link:', shortLink);
  
  if (!shortLink) {
    return new Response('Not found', { status: 404 });
  }
  
  const database = await initDatabase(env);
  if (!database) {
    console.error('Database unavailable for redirect');
    return new Response('Service unavailable', { status: 503 });
  }
  
  try {
    // Look up project by custom alias
    const projectResult = await database.prepare(`
      SELECT * FROM link_projects 
      WHERE custom_alias = ? AND status = 'active'
    `).bind(shortLink).first();
    
    console.log('Project lookup result:', projectResult ? 'Found' : 'Not found');
    
    if (!projectResult) {
      // Try to find if it exists but is inactive
      const inactiveResult = await database.prepare(`
        SELECT status FROM link_projects WHERE custom_alias = ?
      `).bind(shortLink).first();
      
      if (inactiveResult) {
        console.log('Link exists but is inactive:', inactiveResult.status);
        return new Response(`Link is ${inactiveResult.status}`, { status: 404 });
      }
      
      return new Response('Link not found', { status: 404 });
    }
    
    // Parse JSON fields
    const items = JSON.parse(projectResult.items || '[]');
    const targeting = JSON.parse(projectResult.targeting || '[]');
    const fraudProtection = JSON.parse(projectResult.fraud_protection || '{}');
    
    // Handle null/string null values from database
    const safeLink = projectResult.safe_link && projectResult.safe_link !== 'null' ? projectResult.safe_link : null;
    
    console.log('Project details:', {
      alias: shortLink,
      mainUrl: projectResult.main_url,
      safeLink,
      itemsCount: items.length,
      status: projectResult.status
    });
    
    // Check if link has expired
    if (projectResult.expires_at && new Date(projectResult.expires_at) < new Date()) {
      await database.prepare('UPDATE link_projects SET status = ? WHERE id = ?')
        .bind('expired', projectResult.id)
        .run();
      return Response.redirect(safeLink || projectResult.main_url);
    }
    
    // Check click limit
    if (projectResult.clicks_limit && projectResult.click_count >= projectResult.clicks_limit) {
      return Response.redirect(safeLink || projectResult.main_url);
    }
    
    // Get client info
    const clientIp = request.headers.get('cf-connecting-ip') || 
                    request.headers.get('x-forwarded-for') || 
                    '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';
    const geoData = getGeoData(request);
    const sessionId = await generateSessionId({ 
      ip: clientIp, 
      headers: Object.fromEntries(request.headers.entries()) 
    });
    
    // Fraud detection
    const fraudScore = calculateFraudScore(
      { headers: Object.fromEntries(request.headers.entries()) },
      clientIp,
      userAgent
    );
    const isBot = detectBot(userAgent);
    
    if (fraudProtection.enabled) {
      if (fraudProtection.blockBots && isBot) {
        return Response.redirect(safeLink || projectResult.main_url);
      }
      
      if (fraudScore > (fraudProtection.suspiciousThreshold || 70)) {
        return Response.redirect(safeLink || projectResult.main_url);
      }
    }
    
    // Get best matching URL
    const bestMatch = getBestMatch(
      items,
      { 
        headers: Object.fromEntries(request.headers.entries()),
        query: Object.fromEntries(url.searchParams.entries())
      },
      geoData,
      safeLink,
      targeting
    );
    
    if (!bestMatch || !bestMatch.url) {
      console.log('No best match, redirecting to main_url:', projectResult.main_url);
      return Response.redirect(projectResult.main_url, 302);
    }
    
    // Perform redirect first, then track asynchronously to avoid blocking
    console.log('Redirecting to:', bestMatch.url);
    
    // Track click asynchronously (don't await to prevent blocking redirect)
    database.prepare(`
      INSERT INTO link_clicks (
        project_id, session_id, ip_address, user_agent, referrer,
        country, city, region, device_type, clicked_url,
        utm_source, utm_medium, utm_campaign, utm_term, utm_content,
        fraud_score, is_bot
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      projectResult.id,
      sessionId,
      clientIp,
      userAgent,
      request.headers.get('referer') || '',
      geoData?.country || '',
      geoData?.city || '',
      geoData?.region || '',
      detectDevice(userAgent),
      bestMatch.url,
      url.searchParams.get('utm_source') || '',
      url.searchParams.get('utm_medium') || '',
      url.searchParams.get('utm_campaign') || '',
      url.searchParams.get('utm_term') || '',
      url.searchParams.get('utm_content') || '',
      fraudScore,
      isBot ? 1 : 0
    ).run().catch(err => console.error('Failed to track click:', err));
    
    // Update click count asynchronously
    database.prepare('UPDATE link_projects SET click_count = click_count + 1 WHERE id = ?')
      .bind(projectResult.id)
      .run().catch(err => console.error('Failed to update click count:', err));
    
    // Return redirect immediately
    return Response.redirect(bestMatch.url, 302);
    
  } catch (error) {
    console.error('Redirect error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

/**
 * Main handler for LinkSplitter API
 */
export async function handleLinkSplitter(request, env, path, session) {
  const url = new URL(request.url);
  const method = request.method;
  
  // Initialize database
  const database = await initDatabase(env);
  if (!database) {
    return new Response(JSON.stringify({ error: 'Database unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check for redirect handling (highest priority)
  if (path.startsWith('/l/')) {
    return handleRedirect(request, env);
  }
  
  // API endpoints
  const userId = session?.user_id || session?.user?.id;
  
  if (!userId && !path.startsWith('/l/')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Groups Management
    if (path === '/api/link-splitter/groups') {
      if (method === 'GET') {
        const result = await database.prepare(`
          SELECT * FROM link_groups 
          WHERE user_id = ?
          ORDER BY created_at DESC
        `).bind(userId).all();
        
        return new Response(JSON.stringify(result.results || []), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (method === 'POST') {
        const body = await request.json();
        const { name, description, team_id } = body;
        
        if (!name) {
          return new Response(JSON.stringify({ error: 'Group name is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const groupId = generateId();
        
        await database.prepare(`
          INSERT INTO link_groups (id, user_id, team_id, name, description)
          VALUES (?, ?, ?, ?, ?)
        `).bind(groupId, userId, team_id || null, name, description || '').run();
        
        const group = await database.prepare('SELECT * FROM link_groups WHERE id = ?')
          .bind(groupId).first();
        
        return new Response(JSON.stringify(group), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Group operations
    if (path.startsWith('/api/link-splitter/groups/')) {
      const groupId = path.split('/').pop();
      
      if (method === 'PUT') {
        const body = await request.json();
        const { name, description } = body;
        
        await database.prepare(`
          UPDATE link_groups 
          SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND user_id = ?
        `).bind(name, description || '', groupId, userId).run();
        
        const updated = await database.prepare('SELECT * FROM link_groups WHERE id = ?')
          .bind(groupId).first();
        
        return new Response(JSON.stringify(updated), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (method === 'DELETE') {
        await database.prepare('DELETE FROM link_groups WHERE id = ? AND user_id = ?')
          .bind(groupId, userId).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Projects Management
    if (path === '/api/link-splitter/projects') {
      if (method === 'GET') {
        const group_id = url.searchParams.get('group_id');
        
        let query = `
          SELECT p.*, g.name as group_name 
          FROM link_projects p
          LEFT JOIN link_groups g ON p.group_id = g.id
          WHERE p.user_id = ?
        `;
        
        const params = [userId];
        
        if (group_id) {
          query += ' AND p.group_id = ?';
          params.push(group_id);
        }
        
        query += ' ORDER BY p.created_at DESC';
        
        // D1 requires all parameters to be bound at once
        const result = await database.prepare(query).bind(...params).all();
        const projects = (result.results || []).map(project => ({
          ...project,
          items: JSON.parse(project.items || '[]'),
          targeting: JSON.parse(project.targeting || '[]'),
          fraud_protection: JSON.parse(project.fraud_protection || '{}'),
          ab_testing: JSON.parse(project.ab_testing || '{}'),
          pixel_settings: JSON.parse(project.pixel_settings || '{}')
        }));
        
        return new Response(JSON.stringify(projects), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (method === 'POST') {
        const body = await request.json();
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
        } = body;
        
        // Validate required fields
        if (!name || !main_url) {
          return new Response(JSON.stringify({ error: 'Name and main URL are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Validate main URL
        const { valid, error } = validateUrl(main_url);
        if (!valid) {
          return new Response(JSON.stringify({ error: `Invalid main URL: ${error}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Generate custom alias if not provided
        const alias = custom_alias || generateShortId();
        
        // Check if alias is already taken
        const existing = await database.prepare('SELECT id FROM link_projects WHERE custom_alias = ?')
          .bind(alias).first();
        
        if (existing) {
          return new Response(JSON.stringify({ error: 'This alias is already taken' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const projectId = generateId();
        
        // Normalize weights for items
        const normalizedItems = normalizeWeights(items || []);
        
        await database.prepare(`
          INSERT INTO link_projects (
            id, group_id, team_id, user_id, name, main_url, custom_alias,
            safe_link, items, targeting, fraud_protection, ab_testing,
            pixel_settings, expires_at, clicks_limit, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
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
        ).run();
        
        const project = await database.prepare('SELECT * FROM link_projects WHERE id = ?')
          .bind(projectId).first();
        
        // Parse JSON fields
        const result = {
          ...project,
          items: JSON.parse(project.items),
          targeting: JSON.parse(project.targeting),
          fraud_protection: JSON.parse(project.fraud_protection),
          ab_testing: JSON.parse(project.ab_testing),
          pixel_settings: JSON.parse(project.pixel_settings)
        };
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Single project operations
    if (path.match(/^\/api\/link-splitter\/projects\/[^\/]+$/)) {
      const projectId = path.split('/').pop();
      
      if (method === 'GET') {
        const project = await database.prepare(`
          SELECT p.*, g.name as group_name 
          FROM link_projects p
          LEFT JOIN link_groups g ON p.group_id = g.id
          WHERE p.id = ? AND p.user_id = ?
        `).bind(projectId, userId).first();
        
        if (!project) {
          return new Response(JSON.stringify({ error: 'Project not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Parse JSON fields
        const result = {
          ...project,
          items: JSON.parse(project.items || '[]'),
          targeting: JSON.parse(project.targeting || '[]'),
          fraud_protection: JSON.parse(project.fraud_protection || '{}'),
          ab_testing: JSON.parse(project.ab_testing || '{}'),
          pixel_settings: JSON.parse(project.pixel_settings || '{}')
        };
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (method === 'PUT') {
        const body = await request.json();
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
        } = body;
        
        // Get existing project
        const project = await database.prepare('SELECT * FROM link_projects WHERE id = ? AND user_id = ?')
          .bind(projectId, userId).first();
        
        if (!project) {
          return new Response(JSON.stringify({ error: 'Project not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // If changing alias, check if it's available
        if (custom_alias && custom_alias !== project.custom_alias) {
          const existing = await database.prepare('SELECT id FROM link_projects WHERE custom_alias = ? AND id != ?')
            .bind(custom_alias, projectId).first();
          
          if (existing) {
            return new Response(JSON.stringify({ error: 'This alias is already taken' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
        
        // Normalize weights for items
        const normalizedItems = normalizeWeights(items || JSON.parse(project.items));
        
        await database.prepare(`
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
        `).bind(
          name || project.name,
          main_url || project.main_url,
          custom_alias || project.custom_alias,
          safe_link !== undefined ? safe_link : project.safe_link,
          JSON.stringify(normalizedItems),
          JSON.stringify(targeting !== undefined ? targeting : JSON.parse(project.targeting || '[]')),
          JSON.stringify(fraud_protection !== undefined ? fraud_protection : JSON.parse(project.fraud_protection || '{}')),
          JSON.stringify(ab_testing !== undefined ? ab_testing : JSON.parse(project.ab_testing || '{}')),
          JSON.stringify(pixel_settings !== undefined ? pixel_settings : JSON.parse(project.pixel_settings || '{}')),
          expires_at !== undefined ? expires_at : project.expires_at,
          clicks_limit !== undefined ? clicks_limit : project.clicks_limit,
          status || project.status,
          projectId
        ).run();
        
        const updated = await database.prepare('SELECT * FROM link_projects WHERE id = ?')
          .bind(projectId).first();
        
        // Parse JSON fields
        const result = {
          ...updated,
          items: JSON.parse(updated.items),
          targeting: JSON.parse(updated.targeting),
          fraud_protection: JSON.parse(updated.fraud_protection),
          ab_testing: JSON.parse(updated.ab_testing),
          pixel_settings: JSON.parse(updated.pixel_settings)
        };
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      if (method === 'DELETE') {
        await database.prepare('DELETE FROM link_projects WHERE id = ? AND user_id = ?')
          .bind(projectId, userId).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Duplicate project
    if (path.match(/^\/api\/link-splitter\/projects\/[^\/]+\/duplicate$/)) {
      if (method === 'POST') {
        const projectId = path.split('/')[4];
        const body = await request.json();
        const { name, custom_alias } = body;
        
        // Get original project
        const original = await database.prepare('SELECT * FROM link_projects WHERE id = ? AND user_id = ?')
          .bind(projectId, userId).first();
        
        if (!original) {
          return new Response(JSON.stringify({ error: 'Project not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const newId = generateId();
        const newAlias = custom_alias || generateShortId();
        const newName = name || `${original.name} (Copy)`;
        
        // Check if alias is available
        const existing = await database.prepare('SELECT id FROM link_projects WHERE custom_alias = ?')
          .bind(newAlias).first();
        
        if (existing) {
          return new Response(JSON.stringify({ error: 'This alias is already taken' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        await database.prepare(`
          INSERT INTO link_projects (
            id, group_id, team_id, user_id, name, main_url, custom_alias,
            safe_link, items, targeting, fraud_protection, ab_testing,
            pixel_settings, expires_at, clicks_limit, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
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
        ).run();
        
        const duplicated = await database.prepare('SELECT * FROM link_projects WHERE id = ?')
          .bind(newId).first();
        
        // Parse JSON fields
        const result = {
          ...duplicated,
          items: JSON.parse(duplicated.items),
          targeting: JSON.parse(duplicated.targeting),
          fraud_protection: JSON.parse(duplicated.fraud_protection),
          ab_testing: JSON.parse(duplicated.ab_testing),
          pixel_settings: JSON.parse(duplicated.pixel_settings)
        };
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Analytics endpoints
    if (path.match(/^\/api\/link-splitter\/analytics\/[^\/]+$/)) {
      const projectId = path.split('/')[4];
      
      // Check ownership
      const project = await database.prepare('SELECT * FROM link_projects WHERE id = ? AND user_id = ?')
        .bind(projectId, userId).first();
      
      if (!project) {
        return new Response(JSON.stringify({ error: 'Project not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const period = url.searchParams.get('period') || '7d';
      const start_date = url.searchParams.get('start_date');
      const end_date = url.searchParams.get('end_date');
      
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
      const stats = await database.prepare(`
        SELECT 
          COUNT(*) as total_clicks,
          COUNT(DISTINCT session_id) as unique_visitors,
          SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) as bot_clicks,
          AVG(fraud_score) as avg_fraud_score,
          COUNT(DISTINCT DATE(clicked_at)) as active_days
        FROM link_clicks
        WHERE project_id = ? AND clicked_at BETWEEN ? AND ?
      `).bind(projectId, startDate, endDate).first();
      
      // Get device breakdown
      const devicesResult = await database.prepare(`
        SELECT 
          device_type,
          COUNT(*) as count
        FROM link_clicks
        WHERE project_id = ? AND clicked_at BETWEEN ? AND ?
        GROUP BY device_type
        ORDER BY count DESC
      `).bind(projectId, startDate, endDate).all();
      
      // Get top countries
      const countriesResult = await database.prepare(`
        SELECT 
          country,
          COUNT(*) as count
        FROM link_clicks
        WHERE project_id = ? AND clicked_at BETWEEN ? AND ? AND country != ''
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `).bind(projectId, startDate, endDate).all();
      
      // Get top referrers
      const referrersResult = await database.prepare(`
        SELECT 
          referrer,
          COUNT(*) as count
        FROM link_clicks
        WHERE project_id = ? AND clicked_at BETWEEN ? AND ? AND referrer != ''
        GROUP BY referrer
        ORDER BY count DESC
        LIMIT 10
      `).bind(projectId, startDate, endDate).all();
      
      // Get click timeline
      const timelineResult = await database.prepare(`
        SELECT 
          DATE(clicked_at) as date,
          COUNT(*) as clicks,
          COUNT(DISTINCT session_id) as unique_visitors
        FROM link_clicks
        WHERE project_id = ? AND clicked_at BETWEEN ? AND ?
        GROUP BY DATE(clicked_at)
        ORDER BY date ASC
      `).bind(projectId, startDate, endDate).all();
      
      // Get URL performance
      const urlPerformanceResult = await database.prepare(`
        SELECT 
          clicked_url,
          COUNT(*) as clicks,
          COUNT(DISTINCT session_id) as unique_visitors
        FROM link_clicks
        WHERE project_id = ? AND clicked_at BETWEEN ? AND ?
        GROUP BY clicked_url
        ORDER BY clicks DESC
      `).bind(projectId, startDate, endDate).all();
      
      return new Response(JSON.stringify({
        stats,
        devices: devicesResult.results || [],
        countries: countriesResult.results || [],
        referrers: referrersResult.results || [],
        timeline: timelineResult.results || [],
        urlPerformance: urlPerformanceResult.results || [],
        period: { start: startDate, end: endDate }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Test & Validation endpoints
    if (path === '/api/link-splitter/test-link' && method === 'POST') {
      const body = await request.json();
      const { items, targeting, test_params } = body;
      
      // Create mock request object
      const mockReq = {
        headers: test_params?.headers || {},
        query: test_params?.query || {},
        ip: test_params?.ip || '127.0.0.1'
      };
      
      // Mock geo data for testing
      const geoData = {
        country: test_params?.country || 'US',
        city: test_params?.city || 'New York',
        region: test_params?.region || 'NY'
      };
      
      // Get best match
      const bestMatch = getBestMatch(items, mockReq, geoData, null, targeting);
      
      // Evaluate targeting rules
      const targetingResult = evaluateTargeting(targeting || [], mockReq, geoData);
      
      return new Response(JSON.stringify({
        bestMatch,
        targetingResult,
        geoData,
        device: detectDevice(mockReq.headers['user-agent']),
        fraudScore: calculateFraudScore(mockReq, mockReq.ip, mockReq.headers['user-agent'] || ''),
        isBot: detectBot(mockReq.headers['user-agent'] || '')
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/api/link-splitter/validate-url' && method === 'POST') {
      const body = await request.json();
      const { url } = body;
      
      if (!url) {
        return new Response(JSON.stringify({ valid: false, error: 'URL is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const result = validateUrl(url);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (path === '/api/link-splitter/check-alias' && method === 'POST') {
      const body = await request.json();
      const { alias, exclude_id } = body;
      
      if (!alias) {
        return new Response(JSON.stringify({ available: false, error: 'Alias is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check if alias exists
      let existing;
      if (exclude_id) {
        existing = await database.prepare('SELECT id FROM link_projects WHERE custom_alias = ? AND id != ?')
          .bind(alias, exclude_id).first();
      } else {
        existing = await database.prepare('SELECT id FROM link_projects WHERE custom_alias = ?')
          .bind(alias).first();
      }
      
      return new Response(JSON.stringify({
        available: !existing,
        alias
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Handle redirect API endpoint for Vue frontend
    if (path.startsWith('/api/link-splitter/redirect/') && method === 'GET') {
      const pathParts = path.split('/');
      const code = pathParts[pathParts.length - 1];
      
      if (!code) {
        return new Response(JSON.stringify({ error: 'Code is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Look up project by custom alias
      const projectResult = await database.prepare(`
        SELECT * FROM link_projects 
        WHERE custom_alias = ? AND status = 'active'
      `).bind(code).first();
      
      if (!projectResult) {
        return new Response(JSON.stringify({ error: 'Link not found or inactive' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Parse JSON fields
      const items = JSON.parse(projectResult.items || '[]');
      const targeting = JSON.parse(projectResult.targeting || '[]');
      const fraudProtection = JSON.parse(projectResult.fraud_protection || '{}');
      
      // Handle null/string null values from database
      const safeLink = projectResult.safe_link && projectResult.safe_link !== 'null' ? projectResult.safe_link : null;
      
      // Check if link has expired
      if (projectResult.expires_at && new Date(projectResult.expires_at) < new Date()) {
        return new Response(JSON.stringify({ 
          url: safeLink || projectResult.main_url,
          expired: true 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Check click limit
      if (projectResult.clicks_limit && projectResult.click_count >= projectResult.clicks_limit) {
        return new Response(JSON.stringify({ 
          url: safeLink || projectResult.main_url,
          limitReached: true 
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Get client info for targeting
      const clientIp = request.headers.get('cf-connecting-ip') || 
                      request.headers.get('x-forwarded-for') || 
                      '127.0.0.1';
      const userAgent = request.headers.get('user-agent') || '';
      const geoData = getGeoData(request);
      
      // Get best matching URL
      const bestMatch = getBestMatch(
        items,
        { 
          headers: Object.fromEntries(request.headers.entries()),
          query: Object.fromEntries(url.searchParams.entries())
        },
        geoData,
        safeLink,
        targeting
      );
      
      const targetUrl = bestMatch?.url || projectResult.main_url;
      
      // Track click asynchronously (don't await)
      const sessionId = await generateSessionId({ 
        ip: clientIp, 
        headers: Object.fromEntries(request.headers.entries()) 
      });
      
      database.prepare(`
        INSERT INTO link_clicks (
          project_id, session_id, ip_address, user_agent, referrer,
          country, city, region, device_type, clicked_url,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          fraud_score, is_bot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        projectResult.id,
        sessionId,
        clientIp,
        userAgent,
        request.headers.get('referer') || '',
        geoData?.country || '',
        geoData?.city || '',
        geoData?.region || '',
        detectDevice(userAgent),
        targetUrl,
        url.searchParams.get('utm_source') || '',
        url.searchParams.get('utm_medium') || '',
        url.searchParams.get('utm_campaign') || '',
        url.searchParams.get('utm_term') || '',
        url.searchParams.get('utm_content') || '',
        calculateFraudScore(
          { headers: Object.fromEntries(request.headers.entries()) },
          clientIp,
          userAgent
        ),
        detectBot(userAgent) ? 1 : 0
      ).run().catch(err => console.error('Failed to track click:', err));
      
      // Update click count asynchronously
      database.prepare('UPDATE link_projects SET click_count = click_count + 1 WHERE id = ?')
        .bind(projectResult.id)
        .run().catch(err => console.error('Failed to update click count:', err));
      
      // Return the URL for frontend to redirect to
      return new Response(JSON.stringify({ url: targetUrl }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Default response for unhandled endpoints
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('LinkSplitter API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}