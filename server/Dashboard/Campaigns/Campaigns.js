/**
 * Campaigns API Handler
 * Manages all campaign-related API endpoints using native SQL
 */

/**
 * Initialize campaigns table if it doesn't exist
 */
async function initializeCampaignsTable(db) {
  try {
    // Create campaigns table with proper schema
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        team_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        regions TEXT NOT NULL, -- JSON array of regions
        tiktok_store_id TEXT NOT NULL,
        redirect_store_id TEXT,
        template_id TEXT,
        redirect_type TEXT DEFAULT 'template', -- 'template' or 'custom'
        custom_redirect_link TEXT,
        affiliate_link TEXT,
        status TEXT DEFAULT 'active', -- 'active', 'paused', 'completed'
        is_active BOOLEAN DEFAULT 1,
        traffic INTEGER DEFAULT 0,
        traffic_passed INTEGER DEFAULT 0, -- Blackhat/redirected traffic
        traffic_blocked INTEGER DEFAULT 0, -- Whitehat/blocked traffic
        traffic_disabled INTEGER DEFAULT 0, -- Disabled launch visits
        launches TEXT DEFAULT '{}', -- JSON object of launches
        max_launch_number INTEGER DEFAULT 0,
        total_launches INTEGER DEFAULT 1,
        disabled_clicks_threshold INTEGER DEFAULT 10, -- Auto-enable after X disabled clicks
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Add user_id column if it doesn't exist (for existing tables)
    try {
      // Check if user_id column exists
      const tableInfo = await db.prepare(`PRAGMA table_info(campaigns)`).all();
      const hasUserIdColumn = tableInfo.results && tableInfo.results.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        // Add user_id column with default value
        await db.prepare(`ALTER TABLE campaigns ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        console.log('Added user_id column to campaigns table');
        
        // Update any NULL user_id values to 'default_user'
        await db.prepare(`UPDATE campaigns SET user_id = 'default_user' WHERE user_id IS NULL`).run();
        console.log('Updated NULL user_id values to default_user');
      }
      
      // Check if team_id column exists
      const hasTeamIdColumn = tableInfo.results && tableInfo.results.some(col => col.name === 'team_id');
      if (!hasTeamIdColumn) {
        await db.prepare(`ALTER TABLE campaigns ADD COLUMN team_id TEXT`).run();
        console.log('Added team_id column to campaigns table');
      }
      
      // Check if traffic_passed column exists
      const hasTrafficPassedColumn = tableInfo.results && tableInfo.results.some(col => col.name === 'traffic_passed');
      if (!hasTrafficPassedColumn) {
        await db.prepare(`ALTER TABLE campaigns ADD COLUMN traffic_passed INTEGER DEFAULT 0`).run();
        console.log('Added traffic_passed column to campaigns table');
      }
      
      // Check if traffic_blocked column exists
      const hasTrafficBlockedColumn = tableInfo.results && tableInfo.results.some(col => col.name === 'traffic_blocked');
      if (!hasTrafficBlockedColumn) {
        await db.prepare(`ALTER TABLE campaigns ADD COLUMN traffic_blocked INTEGER DEFAULT 0`).run();
        console.log('Added traffic_blocked column to campaigns table');
      }
      
      // Check if traffic_disabled column exists
      const hasTrafficDisabledColumn = tableInfo.results && tableInfo.results.some(col => col.name === 'traffic_disabled');
      if (!hasTrafficDisabledColumn) {
        await db.prepare(`ALTER TABLE campaigns ADD COLUMN traffic_disabled INTEGER DEFAULT 0`).run();
        console.log('Added traffic_disabled column to campaigns table');
      }
      
      // Check if disabledClicksThreshold column exists
      const hasDisabledClicksThresholdColumn = tableInfo.results && tableInfo.results.some(col => col.name === 'disabled_clicks_threshold');
      if (!hasDisabledClicksThresholdColumn) {
        await db.prepare(`ALTER TABLE campaigns ADD COLUMN disabled_clicks_threshold INTEGER DEFAULT 10`).run();
        console.log('Added disabled_clicks_threshold column to campaigns table');
      }
    } catch (error) {
      console.error('Error handling user_id/team_id columns:', error);
    }
    
    console.log('Campaigns table initialized successfully');
  } catch (error) {
    console.error('Error initializing campaigns table:', error);
    throw error;
  }
}

/**
 * Generate a unique ID for campaigns
 */
function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Get user's team ID from the database
 */
async function getUserTeamId(env, userId) {
  try {
    const result = await env.USERS_DB.prepare(
      'SELECT team_id FROM team_members WHERE user_id = ?'
    ).bind(userId).first();
    
    return result?.team_id || null;
  } catch (error) {
    console.error('Error getting user team ID:', error);
    return null;
  }
}

/**
 * Get user info from user_id
 */
async function getUserInfo(env, userId) {
  try {
    // First try to get from team_members which has name and email
    const teamMemberResult = await env.USERS_DB.prepare(
      'SELECT user_email, user_name FROM team_members WHERE user_id = ?'
    ).bind(userId).first();
    
    if (teamMemberResult) {
      return {
        email: teamMemberResult.user_email,
        name: teamMemberResult.user_name || teamMemberResult.user_email
      };
    }
    
    // Fallback to sessions table
    const sessionResult = await env.USERS_DB.prepare(
      'SELECT user_data FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(userId).first();
    
    if (sessionResult && sessionResult.user_data) {
      const userData = JSON.parse(sessionResult.user_data);
      return {
        email: userData.email,
        name: userData.name || userData.email || 'Unknown'
      };
    }
    
    return { email: 'Unknown', name: 'Unknown' };
  } catch (error) {
    console.error('Error getting user info:', error);
    return { email: 'Unknown', name: 'Unknown' };
  }
}

/**
 * Check if user has access to a campaign
 */
async function checkCampaignAccess(db, env, campaignId, userId, teamId) {
  try {
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        return await db.prepare(
          `SELECT * FROM campaigns WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaignId, ...memberIds, teamId).first();
      } else {
        return await db.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND team_id = ?'
        ).bind(campaignId, teamId).first();
      }
    } else {
      return await db.prepare(
        'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
      ).bind(campaignId, userId).first();
    }
  } catch (error) {
    console.error('Error checking campaign access:', error);
    return null;
  }
}

/**
 * Extract user_id and team_id from session
 */
async function getUserInfoFromSession(request, env) {
  try {
    // First check if session is available in request context (for virtual assistant support)
    if (request.ctx && request.ctx.session) {
      const session = request.ctx.session;
      const userId = session.user_id || session.user?.id;
      if (userId) {
        const teamId = await getUserTeamId(env, userId);
        return { userId, teamId };
      }
    }
    
    // Fallback to cookie-based session
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
    const teamId = await getUserTeamId(env, userId);
    
    return { userId, teamId };
  } catch (error) {
    console.error('Error extracting user info from session:', error);
    throw new Error('Authentication required');
  }
}

/**
 * List all campaigns with filtering and pagination
 */
async function listCampaigns(db, request, env) {
  try {
    // First ensure the table has user_id column
    try {
      const tableInfo = await db.prepare(`PRAGMA table_info(campaigns)`).all();
      const hasUserIdColumn = tableInfo.results?.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        console.log('campaigns table missing user_id column, adding it now...');
        await db.prepare(`ALTER TABLE campaigns ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        await db.prepare(`UPDATE campaigns SET user_id = 'default_user' WHERE user_id IS NULL`).run();
      }
    } catch (e) {
      console.error('Error checking/adding user_id column:', e);
    }
    
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'all';
    const region = url.searchParams.get('region') || 'all';
    const offset = (page - 1) * limit;
    
    // Build query conditions - filter by team members if in a team
    let whereConditions = [];
    let params = [];
    
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        whereConditions.push(`(user_id IN (${memberIds.map(() => '?').join(',')}) OR team_id = ?)`);
        params.push(...memberIds, teamId);
      } else {
        whereConditions.push('team_id = ?');
        params.push(teamId);
      }
    } else {
      // Only show user's own campaigns
      whereConditions.push('user_id = ?');
      params.push(userId);
    }
    
    if (search) {
      whereConditions.push('(name LIKE ? OR id LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (status !== 'all') {
      whereConditions.push('status = ?');
      params.push(status);
    }
    
    if (region !== 'all') {
      // Since regions is stored as a JSON array, we need to search within it
      // Using LIKE operator for compatibility with Cloudflare D1
      whereConditions.push(`regions LIKE ?`);
      params.push(`%"${region}"%`);
    }
    
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    // Log query details for debugging
    console.log('Campaign query filters:', {
      search,
      status,
      region,
      whereClause,
      params
    });
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM campaigns ${whereClause}`;
    const countResult = await db.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;
    
    // Get paginated results
    const query = `
      SELECT * FROM campaigns 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    
    const result = await db.prepare(query).bind(...params).all();
    let campaigns = (result.results || []).map(campaign => ({
      ...campaign,
      regions: JSON.parse(campaign.regions || '[]'),
      launches: JSON.parse(campaign.launches || '{}'),
      isActive: campaign.is_active === 1,
      tiktokStoreId: campaign.tiktok_store_id,
      redirectStoreId: campaign.redirect_store_id,
      templateId: campaign.template_id,
      redirectType: campaign.redirect_type,
      customRedirectLink: campaign.custom_redirect_link,
      affiliateLinks: campaign.affiliate_link ? JSON.parse(campaign.affiliate_link) : {},
      maxLaunchNumber: campaign.max_launch_number,
      totalLaunches: campaign.total_launches,
      traffic: campaign.traffic || 0,
      trafficPassed: campaign.traffic_passed || 0,
      trafficBlocked: campaign.traffic_blocked || 0,
      trafficDisabled: campaign.traffic_disabled || 0,
      disabledClicksThreshold: campaign.disabled_clicks_threshold !== undefined ? campaign.disabled_clicks_threshold : 10,
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at
    }));
    
    // If user is in a team, add creator information to each campaign
    if (teamId) {
      // Get unique user IDs
      const uniqueUserIds = [...new Set(result.results.map(c => c.user_id))];
      
      // Fetch user info for all creators
      const userInfoMap = {};
      for (const creatorId of uniqueUserIds) {
        userInfoMap[creatorId] = await getUserInfo(env, creatorId);
      }
      
      // Add creator info to campaigns
      campaigns = campaigns.map((campaign, index) => ({
        ...campaign,
        creator: userInfoMap[result.results[index].user_id] || { name: 'Unknown', email: 'Unknown' }
      }));
    }
    
    return new Response(
      JSON.stringify({
        campaigns,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }),
      {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    console.error('Error listing campaigns:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to list campaigns',
        message: error.message,
        campaigns: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Get a single campaign by ID
 */
async function getCampaign(db, campaignId, request, env) {
  try {
    console.log('Getting campaign:', campaignId);
    
    // First ensure the table has user_id column
    try {
      const tableInfo = await db.prepare(`PRAGMA table_info(campaigns)`).all();
      const hasUserIdColumn = tableInfo.results?.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        console.log('campaigns table missing user_id column, adding it now...');
        await db.prepare(`ALTER TABLE campaigns ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        await db.prepare(`UPDATE campaigns SET user_id = 'default_user' WHERE user_id IS NULL`).run();
      }
    } catch (e) {
      console.error('Error checking/adding user_id column:', e);
    }
    
    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    let campaign;
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        campaign = await db.prepare(
          `SELECT * FROM campaigns WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaignId, ...memberIds, teamId).first();
      } else {
        campaign = await db.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND team_id = ?'
        ).bind(campaignId, teamId).first();
      }
    } else {
      campaign = await db.prepare(
        'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
      ).bind(campaignId, userId).first();
    }
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found', campaignId }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    let formattedCampaign = {
      ...campaign,
      regions: JSON.parse(campaign.regions || '[]'),
      launches: JSON.parse(campaign.launches || '{}'),
      isActive: campaign.is_active === 1,
      tiktokStoreId: campaign.tiktok_store_id,
      redirectStoreId: campaign.redirect_store_id,
      templateId: campaign.template_id,
      redirectType: campaign.redirect_type,
      customRedirectLink: campaign.custom_redirect_link,
      affiliateLinks: campaign.affiliate_link ? JSON.parse(campaign.affiliate_link) : {},
      maxLaunchNumber: campaign.max_launch_number,
      totalLaunches: campaign.total_launches,
      traffic: campaign.traffic || 0,
      trafficPassed: campaign.traffic_passed || 0,
      trafficBlocked: campaign.traffic_blocked || 0,
      trafficDisabled: campaign.traffic_disabled || 0,
      disabledClicksThreshold: campaign.disabled_clicks_threshold !== undefined ? campaign.disabled_clicks_threshold : 10,
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at
    };
    
    // Add creator information if user is in a team
    if (teamId && campaign.user_id) {
      const creatorInfo = await getUserInfo(env, campaign.user_id);
      formattedCampaign.creator = creatorInfo;
    }
    
    return new Response(
      JSON.stringify(formattedCampaign),
      {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get campaign',
        message: error.message 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

/**
 * Create a new campaign
 */
async function createCampaign(db, request, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    const campaignData = await request.json();
    
    // Validate required fields
    if (!campaignData.name || !campaignData.regions || campaignData.regions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields (name and at least one region)' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (!campaignData.tiktokStoreId) {
      return new Response(
        JSON.stringify({ error: 'TikTok store is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Validate redirect configuration
    if (campaignData.redirectType === 'custom') {
      if (!campaignData.customRedirectLink) {
        return new Response(
          JSON.stringify({ error: 'Custom redirect link is required for custom redirect type' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      try {
        const customUrl = new URL(campaignData.customRedirectLink);
        if (customUrl.protocol !== 'https:') {
          return new Response(
            JSON.stringify({ error: 'Custom redirect link must use HTTPS protocol' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'Invalid custom redirect link URL format' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    } else {
      // Template is required for non-custom redirects
      if (!campaignData.templateId) {
        return new Response(
          JSON.stringify({ error: 'Template is required for template-based campaigns' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      if (!campaignData.redirectStoreId) {
        return new Response(
          JSON.stringify({ error: 'Redirect store is required for template-based campaigns' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
    
    // Generate ID if not provided
    const campaignId = campaignData.id || generateId();
    
    // Initialize launches
    const launches = campaignData.launches || {
      "0": { isActive: false, createdAt: new Date().toISOString(), generatedAt: null, trafficPassed: 0, trafficBlocked: 0, trafficDisabled: 0 }
    };
    
    // Insert campaign
    await db.prepare(`
      INSERT INTO campaigns (
        id, user_id, team_id, name, description, regions, tiktok_store_id, redirect_store_id,
        template_id, redirect_type, custom_redirect_link, affiliate_link,
        status, is_active, traffic, traffic_passed, traffic_blocked, traffic_disabled, launches, max_launch_number, total_launches, disabled_clicks_threshold
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      campaignId,
      userId,
      teamId,
      campaignData.name,
      campaignData.description || null,
      JSON.stringify(campaignData.regions),
      campaignData.tiktokStoreId,
      campaignData.redirectStoreId || null,
      campaignData.templateId || null,
      campaignData.redirectType || 'template',
      campaignData.customRedirectLink || null,
      campaignData.affiliateLinks ? JSON.stringify(campaignData.affiliateLinks) : null,
      campaignData.status || 'active',
      campaignData.isActive !== false ? 1 : 0,
      0, // traffic starts at 0
      0, // traffic_passed starts at 0
      0, // traffic_blocked starts at 0
      0, // traffic_disabled starts at 0
      JSON.stringify(launches),
      0, // maxLaunchNumber
      1,  // totalLaunches
      10  // disabled_clicks_threshold defaults to 10
    ).run();
    
    // Fetch and return the created campaign
    const created = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
    ).bind(campaignId, userId).first();
    
    const response = {
      ...created,
      regions: JSON.parse(created.regions),
      launches: JSON.parse(created.launches),
      isActive: created.is_active === 1,
      tiktokStoreId: created.tiktok_store_id,
      redirectStoreId: created.redirect_store_id,
      templateId: created.template_id,
      redirectType: created.redirect_type,
      customRedirectLink: created.custom_redirect_link,
      affiliateLinks: created.affiliate_link ? JSON.parse(created.affiliate_link) : {},
      maxLaunchNumber: created.max_launch_number,
      totalLaunches: created.total_launches,
      traffic: created.traffic || 0,
      trafficPassed: created.traffic_passed || 0,
      trafficBlocked: created.traffic_blocked || 0,
      createdAt: created.created_at,
      updatedAt: created.updated_at
    };
    
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create campaign',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Update an existing campaign
 */
async function updateCampaign(db, campaignId, request, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    // Check if campaign exists and user has permission
    let existingCampaign;
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        existingCampaign = await db.prepare(
          `SELECT * FROM campaigns WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaignId, ...memberIds, teamId).first();
      } else {
        existingCampaign = await db.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND team_id = ?'
        ).bind(campaignId, teamId).first();
      }
    } else {
      existingCampaign = await db.prepare(
        'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
      ).bind(campaignId, userId).first();
    }
    
    if (!existingCampaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const campaignData = await request.json();
    
    // For partial updates, use existing values if not provided
    if (campaignData.name !== undefined || campaignData.regions !== undefined) {
      // Only validate if these fields are being updated
      if (campaignData.name !== undefined && !campaignData.name) {
        return new Response(
          JSON.stringify({ error: 'Name cannot be empty' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      if (campaignData.regions !== undefined && (!campaignData.regions || campaignData.regions.length === 0)) {
        return new Response(
          JSON.stringify({ error: 'At least one region is required' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
    
    // Update campaign
    await db.prepare(`
      UPDATE campaigns SET
        name = ?,
        description = ?,
        regions = ?,
        tiktok_store_id = ?,
        redirect_store_id = ?,
        template_id = ?,
        redirect_type = ?,
        custom_redirect_link = ?,
        affiliate_link = ?,
        status = ?,
        is_active = ?,
        launches = ?,
        max_launch_number = ?,
        total_launches = ?,
        disabled_clicks_threshold = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      campaignData.name !== undefined ? campaignData.name : existingCampaign.name,
      campaignData.description !== undefined ? campaignData.description : existingCampaign.description,
      campaignData.regions !== undefined ? JSON.stringify(campaignData.regions) : existingCampaign.regions,
      campaignData.tiktokStoreId !== undefined ? campaignData.tiktokStoreId : existingCampaign.tiktok_store_id,
      campaignData.redirectStoreId !== undefined ? campaignData.redirectStoreId : existingCampaign.redirect_store_id,
      campaignData.templateId !== undefined ? campaignData.templateId : existingCampaign.template_id,
      campaignData.redirectType !== undefined ? campaignData.redirectType : existingCampaign.redirect_type,
      campaignData.customRedirectLink !== undefined ? campaignData.customRedirectLink : existingCampaign.custom_redirect_link,
      campaignData.affiliateLinks !== undefined ? JSON.stringify(campaignData.affiliateLinks) : existingCampaign.affiliate_link,
      campaignData.status !== undefined ? campaignData.status : existingCampaign.status,
      campaignData.isActive !== undefined ? (campaignData.isActive ? 1 : 0) : existingCampaign.is_active,
      campaignData.launches ? JSON.stringify(campaignData.launches) : existingCampaign.launches,
      campaignData.maxLaunchNumber !== undefined ? campaignData.maxLaunchNumber : existingCampaign.max_launch_number,
      campaignData.totalLaunches !== undefined ? campaignData.totalLaunches : existingCampaign.total_launches,
      campaignData.disabledClicksThreshold !== undefined ? campaignData.disabledClicksThreshold : (existingCampaign.disabled_clicks_threshold || 0),
      campaignId
    ).run();
    
    // Fetch and return the updated campaign
    // Use the same logic as the permission check to fetch the updated campaign
    let updated;
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        updated = await db.prepare(
          `SELECT * FROM campaigns WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaignId, ...memberIds, teamId).first();
      } else {
        updated = await db.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND team_id = ?'
        ).bind(campaignId, teamId).first();
      }
    } else {
      updated = await db.prepare(
        'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
      ).bind(campaignId, userId).first();
    }
    
    const response = {
      ...updated,
      regions: JSON.parse(updated.regions),
      launches: JSON.parse(updated.launches),
      isActive: updated.is_active === 1,
      tiktokStoreId: updated.tiktok_store_id,
      redirectStoreId: updated.redirect_store_id,
      templateId: updated.template_id,
      redirectType: updated.redirect_type,
      customRedirectLink: updated.custom_redirect_link,
      affiliateLinks: updated.affiliate_link ? JSON.parse(updated.affiliate_link) : {},
      maxLaunchNumber: updated.max_launch_number,
      totalLaunches: updated.total_launches,
      traffic: updated.traffic || 0,
      trafficPassed: updated.traffic_passed || 0,
      trafficBlocked: updated.traffic_blocked || 0,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    };
    
    return new Response(
      JSON.stringify(response),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update campaign',
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
 * Delete a campaign
 */
async function deleteCampaign(db, campaignId, request, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    // Check if campaign exists and user has access
    const existingCampaign = await checkCampaignAccess(db, env, campaignId, userId, teamId);
    
    if (!existingCampaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Delete campaign
    await db.prepare(
      'DELETE FROM campaigns WHERE id = ?'
    ).bind(campaignId).run();
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Campaign deleted successfully',
        campaignId: campaignId
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete campaign',
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
 * Toggle campaign active status
 */
async function toggleCampaignActive(db, campaignId, request, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    // Check if campaign exists and user has access
    const existingCampaign = await checkCampaignAccess(db, env, campaignId, userId, teamId);
    
    if (!existingCampaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const newIsActive = existingCampaign.is_active === 1 ? 0 : 1;
    const newStatus = newIsActive ? 'active' : 'paused';
    
    await db.prepare(`
      UPDATE campaigns SET 
        is_active = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(newIsActive, newStatus, campaignId).run();
    
    return new Response(
      JSON.stringify({
        success: true,
        campaignId,
        isActive: newIsActive === 1,
        status: newStatus
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to toggle campaign active state',
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
 * Update campaign status
 */
async function toggleCampaignStatus(db, campaignId, request, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    // Check if campaign exists and user has permission
    let existingCampaign;
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        existingCampaign = await db.prepare(
          `SELECT * FROM campaigns WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaignId, ...memberIds, teamId).first();
      } else {
        existingCampaign = await db.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND team_id = ?'
        ).bind(campaignId, teamId).first();
      }
    } else {
      existingCampaign = await db.prepare(
        'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
      ).bind(campaignId, userId).first();
    }
    
    if (!existingCampaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const { status } = await request.json();
    
    if (!['draft', 'active', 'paused', 'completed'].includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const isActive = status === 'active' ? 1 : 0;
    
    await db.prepare(`
      UPDATE campaigns SET 
        status = ?,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(status, isActive, campaignId).run();
    
    // Fetch and return the updated campaign
    // Use the same logic as the permission check to fetch the updated campaign
    let updated;
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        updated = await db.prepare(
          `SELECT * FROM campaigns WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaignId, ...memberIds, teamId).first();
      } else {
        updated = await db.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND team_id = ?'
        ).bind(campaignId, teamId).first();
      }
    } else {
      updated = await db.prepare(
        'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
      ).bind(campaignId, userId).first();
    }
    
    const response = {
      ...updated,
      regions: JSON.parse(updated.regions),
      launches: JSON.parse(updated.launches),
      isActive: updated.is_active === 1,
      tiktokStoreId: updated.tiktok_store_id,
      redirectStoreId: updated.redirect_store_id,
      templateId: updated.template_id,
      redirectType: updated.redirect_type,
      customRedirectLink: updated.custom_redirect_link,
      affiliateLinks: updated.affiliate_link ? JSON.parse(updated.affiliate_link) : {},
      maxLaunchNumber: updated.max_launch_number,
      totalLaunches: updated.total_launches,
      traffic: updated.traffic || 0,
      trafficPassed: updated.traffic_passed || 0,
      trafficBlocked: updated.traffic_blocked || 0,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at
    };
    
    return new Response(
      JSON.stringify(response),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update campaign status',
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
 * Manage campaign launches (add, toggle)
 */
async function manageCampaignLaunches(db, campaignId, request, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    const requestData = await request.json();
    const { action, launchData } = requestData;
    
    console.log(`Managing launches for campaign ${campaignId}: ${action}`);
    
    // Fetch campaign with team permission check
    let campaign;
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        campaign = await db.prepare(
          `SELECT * FROM campaigns WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaignId, ...memberIds, teamId).first();
      } else {
        campaign = await db.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND team_id = ?'
        ).bind(campaignId, teamId).first();
      }
    } else {
      campaign = await db.prepare(
        'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
      ).bind(campaignId, userId).first();
    }
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    let launches = JSON.parse(campaign.launches || '{}');
    let maxLaunchNumber = campaign.max_launch_number || 0;
    let result = {};
    
    switch (action) {
      case 'add':
        const newLaunchNumber = maxLaunchNumber + 1;
        launches[newLaunchNumber] = {
          isActive: false,
          createdAt: new Date().toISOString(),
          generatedAt: null,
          trafficPassed: 0,
          trafficBlocked: 0,
          trafficDisabled: 0
        };
        maxLaunchNumber = newLaunchNumber;
        
        result = {
          action: 'added',
          launchNumber: newLaunchNumber,
          totalLaunches: Object.keys(launches).length
        };
        break;
        
      case 'toggle':
        const launchNum = parseInt(launchData.launchNumber);
        if (launches[launchNum]) {
          launches[launchNum].isActive = !launches[launchNum].isActive;
          result = {
            action: 'toggled',
            launchNumber: launchNum,
            isActive: launches[launchNum].isActive
          };
          
          // Update the TikTok store page when toggling
          try {
            // Get TikTok store details
            const tiktokStore = await db.prepare(
              'SELECT * FROM shopify_stores WHERE id = ?'
            ).bind(campaign.tiktok_store_id).first();
            
            if (tiktokStore && tiktokStore.access_token) {
              console.log(`Updating TikTok store page for launch ${launchNum} - isActive: ${launches[launchNum].isActive}`);
              
              const pageHandle = `cloak-${campaignId}-${launchNum}`;
              
              // Parse campaign data for page update
              const campaignData = {
                ...campaign,
                regions: JSON.parse(campaign.regions || '[]'),
                affiliateLinks: JSON.parse(campaign.affiliate_link || '{}'),
                redirectType: campaign.redirect_type,
                customRedirectUrl: campaign.custom_redirect_link
              };
              
              // Update the TikTok store page
              await updateTikTokPageContent(
                tiktokStore,
                campaignData,
                campaignId,
                launchNum,
                pageHandle,
                launches[launchNum].isActive
              );
              
              console.log(`TikTok store page updated successfully for launch ${launchNum}`);
            } else {
              console.warn('TikTok store not found or missing access token - cannot update page');
            }
          } catch (updateError) {
            console.error('Error updating TikTok store page:', updateError);
            // Don't fail the whole operation if page update fails
          }
        } else {
          throw new Error(`Launch ${launchNum} not found`);
        }
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Update campaign with new launches
    await db.prepare(`
      UPDATE campaigns SET 
        launches = ?,
        max_launch_number = ?,
        total_launches = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      JSON.stringify(launches),
      maxLaunchNumber,
      Object.keys(launches).length,
      campaignId
    ).run();
    
    return new Response(JSON.stringify({
      success: true,
      campaignId: campaignId,
      result: result,
      launches: launches
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error managing campaign launches:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to manage campaign launches',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Generate page content for TikTok validation page
 */
function generatePageContent(campaign, campaignId, launchNumber) {
  const loadingScreenHTML = `
<div id="loading-container" style="
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
">
  <div style="text-align: center;">
    <div class="spinner" style="
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-left-color: #000;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    "></div>
    <p style="
      color: #666;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 16px;
      margin: 0;
    ">Loading...</p>
  </div>
</div>

<style>
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .shopify-section, header, footer, .header, .footer {
    display: none !important;
  }
  
  body {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
`;

  const trackingScript = `
<script>
(function() {
  // Extract campaign info from URL
  const pathMatch = window.location.pathname.match(/\\/pages\\/cloak-([^-]+)-(\\d+)/);
  if (!pathMatch) {
    console.error('Invalid page URL format');
    return;
  }
  
  const campaignId = pathMatch[1];
  const launchNumber = pathMatch[2];
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const ttclid = urlParams.get('ttclid');
  const testMode = urlParams.get('test') === 'true';
  
  // Store server-provided data
  let serverData = null;
  
  // Validation checks
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasTtclid = ttclid && ttclid.length > 0;
  
  // Check referrer
  let isTikTokReferrer = false;
  if (testMode) {
    isTikTokReferrer = true;
    console.log('TEST MODE: Skipping referrer check');
  } else {
    isTikTokReferrer = document.referrer.includes('tiktok.com') || 
                       document.referrer === '' || 
                       document.referrer.includes('tiktokv.com') ||
                       document.referrer.includes('tiktokcdn.com');
  }
  
  console.log('Validation results:', { 
    isMobile, 
    hasTtclid, 
    isTikTokReferrer,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    testMode 
  });
  
  // First, fetch campaign data to get server information
  var timestamp = new Date().getTime();
  var apiUrl = 'https://cranads.com/api/campaigns/client/' + campaignId + '/' + launchNumber + '?t=' + timestamp;
  console.log('Fetching campaign data from:', apiUrl);
  fetch(apiUrl)
    .then(function(response) { 
      console.log('Campaign data response status:', response.status);
      if (!response.ok) {
        throw new Error('Failed to fetch campaign data: ' + response.status);
      }
      return response.json(); 
    })
    .then(function(data) {
      console.log('Campaign data received:', data);
      // Store the server data
      serverData = data;
      
      // Check if campaign/launch is active
      if (data.error) {
        console.error('API Error:', data.error);
        throw new Error(data.error);
      }
      
      if (!data.isActive) {
        console.log('Campaign is not active (campaign level)');
        throw new Error('Campaign is not active. Please activate the campaign first.');
      }
      
      if (data.launch && !data.launch.isActive) {
        console.log('Launch is disabled (launch level)');
        throw new Error('Launch is disabled. Please enable the launch.');
      }
      
      // Check validations
      if (!isMobile || !hasTtclid || !isTikTokReferrer) {
        console.log('Validation failed, staying on page');
        
        // Log failed validation
        const failureReason = !isMobile ? 'not_mobile' : !hasTtclid ? 'no_ttclid' : 'invalid_referrer';
        
        // Send log for failed validation
        const logData = {
          campaignId: campaignId,
          launchNumber: launchNumber,
          type: 'validation',
          decision: 'whitehat',
          ip: serverData.clientIP || 'unknown',
          country: serverData.geoData?.country || 'unknown',
          region: serverData.geoData?.region || null,
          city: serverData.geoData?.city || null,
          timezone: serverData.geoData?.timezone || null,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          referer: document.referrer,
          url: window.location.href,
          params: {
            ttclid: ttclid,
            test: testMode,
            failureReason: failureReason
          }
        };
        
        // Send log to server - always use fetch for better debugging
        console.log('Sending whitehat log:', logData);
        fetch('https://cranads.com/api/logs/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData),
          keepalive: true
        })
        .then(function(response) {
          console.log('Log response status:', response.status);
          return response.text();
        })
        .then(function(text) {
          console.log('Log response body:', text);
          try {
            const data = JSON.parse(text);
            console.log('Log saved with ID:', data.id);
          } catch (e) {
            console.log('Response was not JSON:', text);
          }
        })
        .catch(function(err) {
          console.error('Failed to send log:', err);
        });
        
        // Show default content
        document.getElementById('loading-container').style.display = 'none';
        document.querySelectorAll('.shopify-section, header, footer, .header, .footer').forEach(function(el) {
          el.style.display = '';
        });
        document.body.style.overflow = '';
        return;
      }
      
      // Validation passed, continue with redirect
      console.log('All validations passed, processing redirect...');
      
      if (data.error) {
        console.error('Failed to fetch campaign data:', data.error);
        document.getElementById('loading-container').style.display = 'none';
        return;
      }
      
      // Get GEO data from server response
      const geoData = data.geoData || {};
      const country = geoData.country || 'US';
      const os = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'android';
      
      console.log('Server-detected GEO:', {
        country: country,
        region: geoData.region,
        city: geoData.city,
        timezone: geoData.timezone,
        continent: geoData.continent
      });
      
      let redirectUrl;
      
      // Check redirect type
      if (data.redirectType === 'custom' && data.customRedirectLink) {
        // Custom redirect
        try {
          redirectUrl = new URL(data.customRedirectLink);
          console.log('Using custom redirect');
        } catch (e) {
          console.error('Invalid custom redirect URL:', data.customRedirectLink);
          return;
        }
      } else if (data.redirectStoreDomain) {
        // Template/Shopify redirect
        const redirectPageHandle = 'offer-' + campaignId + '-' + launchNumber;
        redirectUrl = new URL('https://' + data.redirectStoreDomain + '/pages/' + redirectPageHandle);
        console.log('Redirecting to offer page on redirect store:', data.redirectStoreDomain);
      } else {
        console.error('No redirect store domain found');
        document.getElementById('loading-container').style.display = 'none';
        return;
      }
      
      // Add tracking parameters (no more IP passing)
      redirectUrl.searchParams.set('s1', campaignId);
      redirectUrl.searchParams.set('s2', launchNumber);
      
      // Pass ttclid
      if (ttclid) {
        redirectUrl.searchParams.set('ttclid', ttclid);
      }
      
      // For template redirects, pass additional data (but not IP)
      if (data.redirectType !== 'custom') {
        redirectUrl.searchParams.set('os', os);
        redirectUrl.searchParams.set('geo', country);
        
        if (geoData.region) {
          redirectUrl.searchParams.set('region', geoData.region);
        }
        if (geoData.city) {
          redirectUrl.searchParams.set('city', geoData.city);
        }
        if (geoData.timezone) {
          redirectUrl.searchParams.set('tz', encodeURIComponent(geoData.timezone));
        }
      }
      
      console.log('Redirecting to:', redirectUrl.href);
      
      // Log successful click before redirect
      const successLogData = {
        campaignId: campaignId,
        launchNumber: launchNumber,
        type: 'click',
        decision: 'blackhat',
        ip: serverData.clientIP || 'unknown',
        country: country || 'unknown',
        region: geoData.region || null,
        city: geoData.city || null,
        timezone: geoData.timezone || null,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referer: document.referrer,
        url: window.location.href,
        redirectUrl: redirectUrl.href,
        os: os,
        params: {
          ttclid: ttclid,
          test: testMode,
          redirectType: data.redirectType
        }
      };
      
      // Function to perform the redirect
      function performRedirect() {
        console.log('Performing redirect to:', redirectUrl.href);
        window.location.href = redirectUrl.href;
      }
      
      // Log and redirect - always use fetch for better debugging
      console.log('Sending blackhat click log:', successLogData);
      fetch('https://cranads.com/api/logs/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(successLogData),
        keepalive: true
      })
      .then(function(response) {
        console.log('Click log response status:', response.status);
        return response.text();
      })
      .then(function(text) {
        console.log('Click log response body:', text);
        try {
          const data = JSON.parse(text);
          console.log('Click log saved with ID:', data.id);
        } catch (e) {
          console.log('Response was not JSON:', text);
        }
        performRedirect();
      })
      .catch(function(err) {
        console.error('Failed to log click:', err);
        performRedirect();
      });
    })
    .catch(function(error) {
      console.error('Redirect error:', error);
      console.error('Error details:', error.message, error.stack);
      // Hide loading and show normal page
      document.getElementById('loading-container').style.display = 'none';
      document.querySelectorAll('.shopify-section, header, footer, .header, .footer').forEach(function(el) {
        el.style.display = '';
      });
      document.body.style.overflow = '';
    });
})();
</script>
`;

  return loadingScreenHTML + trackingScript;
}

/**
 * Get template HTML from database
 */
async function getTemplateHTML(db, templateId) {
  let templateHTML = '<h1>Special Offer</h1><p>Loading your exclusive deal...</p>';
  
  if (!templateId) {
    console.log('No template ID configured for campaign, using default');
    return templateHTML;
  }
  
  try {
    const template = await db.prepare(
      'SELECT * FROM templates WHERE id = ?'
    ).bind(templateId).first();
    
    if (template && template.html) {
      console.log(`Template found: ${templateId}`);
      return template.html;
    } else {
      console.log(`Template not found or has no HTML: ${templateId}`);
    }
  } catch (error) {
    console.error(`Error fetching template ${templateId}:`, error);
  }
  
  return templateHTML;
}

/**
 * Generate affiliate links replacement script
 */
function generateAffiliateLinksScript(affiliateLinks) {
  return `
<script>
(function() {
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const os = urlParams.get('os') || 'unknown';
  const geo = urlParams.get('geo') || 'US';
  const region = urlParams.get('region');
  const city = urlParams.get('city');
  const timezone = urlParams.get('tz');
  const s1 = urlParams.get('s1'); // campaign ID
  const s2 = urlParams.get('s2'); // launch number
  const ttclid = urlParams.get('ttclid'); // TikTok Click ID - this is s3
  
  console.log('Offer page - Location data:', { 
    geo: geo, 
    region: region,
    city: city,
    timezone: timezone ? decodeURIComponent(timezone) : 'not provided',
    os: os, 
    s1: s1, 
    s2: s2, 
    ttclid: ttclid
  });
  
  // Affiliate links data
  const affiliateLinks = ${JSON.stringify(affiliateLinks)};
  
  // Debug: Log available affiliate links
  console.log('Available affiliate links:', affiliateLinks);
  console.log('Looking for geo:', geo, 'with OS:', os);
  
  // Select the best matching affiliate link
  let affiliateLink = selectAffiliateLink(affiliateLinks, geo, os);
  
  console.log('Selected affiliate link:', affiliateLink);
  console.log('Selection logic used:', getSelectionLogic(affiliateLinks, geo, os));
  
  if (affiliateLink) {
    try {
      // Build the final URL with only s1, s2, and s3 (ttclid)
      const finalUrl = buildFinalAffiliateUrl(affiliateLink, { 
        s1, 
        s2, 
        s3: ttclid
      });
      console.log('Final affiliate URL:', finalUrl);
      
      // Replace all {{AFFILIATE_LINK}} placeholders
      replaceAffiliateLinkPlaceholders(finalUrl);
      
      // Track the redirect for analytics
      trackRedirect(geo, os, region, city);
      
    } catch (error) {
      console.error('Error processing affiliate link:', error);
    }
  } else {
    console.error('No affiliate link found for geo:', geo, 'os:', os);
    // Fallback to first available link
    const fallbackLink = Object.values(affiliateLinks)[0];
    if (fallbackLink) {
      console.warn('Using fallback link:', fallbackLink);
      const finalUrl = buildFinalAffiliateUrl(fallbackLink, { 
        s1, 
        s2, 
        s3: ttclid
      });
      replaceAffiliateLinkPlaceholders(finalUrl);
    }
  }
  
  // Helper function to explain selection logic
  function getSelectionLogic(links, geo, os) {
    const osLower = os ? os.toLowerCase() : 'unknown';
    const geoUpper = geo ? geo.toUpperCase() : 'US';
    
    if (links[geoUpper + '_' + osLower]) return 'Exact match (normalized): ' + geoUpper + '_' + osLower;
    if (links[geoUpper + '_' + os]) return 'Exact match (uppercase geo): ' + geoUpper + '_' + os;
    if (links[geoUpper]) return 'Country match (uppercase): ' + geoUpper;
    if (links[geo + '_' + osLower]) return 'Exact match (original case): ' + geo + '_' + osLower;
    if (links[geo]) return 'Country match (original case): ' + geo;
    if (links['US']) return 'Default US fallback';
    return 'First available link';
  }
  
  // Helper function to select the best matching affiliate link
  function selectAffiliateLink(links, geo, os) {
    // Normalize OS to lowercase for matching
    const osLower = os ? os.toLowerCase() : 'unknown';
    // Normalize geo to uppercase for matching
    const geoUpper = geo ? geo.toUpperCase() : 'US';
    
    // Try different combinations in priority order
    return links[geoUpper + '_' + osLower] ||     // e.g., US_ios
           links[geoUpper + '_' + os] ||          // e.g., US_iOS (fallback for exact case)
           links[geoUpper] ||                     // e.g., US (standard link)
           links[geo + '_' + osLower] ||          // Original case with lowercase OS
           links[geo] ||                          // Original case
           links['US'] ||                         // Default to US
           Object.values(links)[0];               // Any available link
  }
  
  // Simplified: Only add s1, s2, and s3 parameters
  function buildFinalAffiliateUrl(baseUrl, params) {
    const url = new URL(baseUrl);
    
    // Add only the essential tracking parameters
    if (params.s1) url.searchParams.set('s1', params.s1); // Campaign ID
    if (params.s2) url.searchParams.set('s2', params.s2); // Launch Number
    if (params.s3) url.searchParams.set('s3', params.s3); // ttclid
    
    // Optionally add geo for affiliate's reference (not as s-parameter)
    url.searchParams.set('geo', geo);
    if (region) url.searchParams.set('region', region);

    return url.href;
  }
  
  // Helper function to replace all affiliate link placeholders
  function replaceAffiliateLinkPlaceholders(finalUrl) {
    // Replace in text content
    document.body.innerHTML = document.body.innerHTML.replace(/{{AFFILIATE_LINK}}/g, finalUrl);
    
    // Update direct links
    document.querySelectorAll('a.affiliate-link, a[href*="{{AFFILIATE_LINK}}"]').forEach(link => {
      link.href = finalUrl;
    });
    
    // Update buttons with onclick events
    document.querySelectorAll('button[onclick*="{{AFFILIATE_LINK}}"]').forEach(button => {
      button.onclick = function() { 
        window.location.href = finalUrl; 
      };
    });
    
    // Update any data attributes
    document.querySelectorAll('[data-href*="{{AFFILIATE_LINK}}"]').forEach(element => {
      element.dataset.href = finalUrl;
    });
  }
  
  // Track redirect for analytics (internal use only)
  function trackRedirect(geo, os, region, city) {
    console.log('Redirect tracked:', {
      timestamp: new Date().toISOString(),
      geo: geo,
      os: os,
      region: region,
      city: city,
      campaign: s1,
      launch: s2,
      ttclid: ttclid
    });
  }
  
  // Make functions available globally for the nuclear option
  window.selectAffiliateLink = selectAffiliateLink;
  window.buildFinalAffiliateUrl = buildFinalAffiliateUrl;
  window.replaceAffiliateLinkPlaceholders = replaceAffiliateLinkPlaceholders;
  window.affiliateLinks = affiliateLinks;
})();
</script>`;
}

/**
 * Generate CSS to hide Shopify UI elements
 */
function generateHideShopifyElementsCSS() {
  return `
<!-- Initial hide everything -->
<style id="initial-hide">
  html { visibility: hidden !important; }
</style>

<script>
(function() {
  'use strict';
  
  // Function to completely replace page content
  function nukeAndRebuild() {
    console.log('Nuclear option: Replacing entire page content');
    
    // Get the offer content
    const offerContent = document.getElementById('offer-content');
    if (!offerContent) {
      console.error('Offer content not found!');
      return;
    }
    
    // Clone the offer content to preserve it
    const offerClone = offerContent.cloneNode(true);
    
    // Get the affiliate script if it exists
    const affiliateScripts = [];
    document.querySelectorAll('script').forEach(script => {
      if (script.textContent.includes('affiliateLinks') || 
          script.textContent.includes('AFFILIATE_LINK') ||
          script.textContent.includes('selectAffiliateLink')) {
        affiliateScripts.push(script.cloneNode(true));
      }
    });
    
    // Save the current page title
    const pageTitle = document.title;
    
    // Complete nuclear option - rebuild the entire document
    document.documentElement.innerHTML = \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${pageTitle}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 100%;
      height: 100%;
      overflow-x: hidden;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }
    
    #offer-content {
      width: 100%;
      min-height: 100vh;
      display: block;
    }
    
    /* Ensure images are responsive */
    #offer-content img {
      max-width: 100%;
      height: auto;
    }
    
    /* Basic responsive container */
    .container {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
  </style>
</head>
<body>
  <div id="offer-wrapper"></div>
</body>
</html>
\`;
    
    // Wait for the new document to be ready
    setTimeout(() => {
      // Get the new wrapper
      const wrapper = document.getElementById('offer-wrapper');
      if (wrapper) {
        // Append the cloned offer content
        wrapper.appendChild(offerClone);
        
        // Re-add affiliate scripts
        affiliateScripts.forEach(script => {
          document.body.appendChild(script);
        });
        
        // Re-run affiliate link replacement
        if (window.selectAffiliateLink && window.buildFinalAffiliateUrl && window.replaceAffiliateLinkPlaceholders) {
          // Get URL parameters again
          const urlParams = new URLSearchParams(window.location.search);
          const os = urlParams.get('os') || 'unknown';
          const geo = urlParams.get('geo') || 'US';
          const s1 = urlParams.get('s1');
          const s2 = urlParams.get('s2');
          const ttclid = urlParams.get('ttclid');
          
          // Re-run the affiliate link logic
          if (window.affiliateLinks) {
            const affiliateLink = window.selectAffiliateLink(window.affiliateLinks, geo, os);
            if (affiliateLink) {
              const finalUrl = window.buildFinalAffiliateUrl(affiliateLink, { s1, s2, s3: ttclid });
              window.replaceAffiliateLinkPlaceholders(finalUrl);
            }
          }
        }
        
        // Make the page visible
        document.documentElement.style.visibility = 'visible';
      }
    }, 10);
  }
  
  // Alternative approach - less nuclear but still aggressive
  function aggressiveHide() {
    console.log('Aggressive hide: Clearing all except offer content');
    
    // Get offer content
    const offerContent = document.getElementById('offer-content');
    if (!offerContent) {
      console.error('Offer content not found!');
      return;
    }
    
    // Clone it
    const offerClone = offerContent.cloneNode(true);
    
    // Clear the body
    document.body.innerHTML = '';
    
    // Add back the offer content
    document.body.appendChild(offerClone);
    
    // Re-run any scripts that were in the offer content
    const scripts = offerClone.getElementsByTagName('script');
    Array.from(scripts).forEach(oldScript => {
      const newScript = document.createElement('script');
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
    
    // Apply clean styles
    const cleanStyles = document.createElement('style');
    cleanStyles.textContent = \`
      body {
        margin: 0 !important;
        padding: 0 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      
      #offer-content {
        width: 100%;
        min-height: 100vh;
      }
      
      /* Remove any Shopify-injected styles */
      body::before,
      body::after {
        display: none !important;
      }
    \`;
    document.head.appendChild(cleanStyles);
    
    // Show the page
    document.documentElement.style.visibility = 'visible';
  }
  
  // Decide which approach to use based on the page structure
  function initializeNuclearOption() {
    // Wait a bit for the page to load
    setTimeout(() => {
      const offerContent = document.getElementById('offer-content');
      
      if (!offerContent) {
        console.error('Cannot find offer content - aborting nuclear option');
        document.documentElement.style.visibility = 'visible';
        return;
      }
      
      // Check if there are many Shopify elements
      const shopifyElements = document.querySelectorAll(
        '.shopify-section, .header, .footer, .announcement-bar, [id*="shopify-section"]'
      );
      
      if (shopifyElements.length > 5) {
        // Too many Shopify elements - use nuclear option
        nukeAndRebuild();
      } else {
        // Fewer elements - use aggressive hide
        aggressiveHide();
      }
    }, 100);
  }
  
  // Start the process
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNuclearOption);
  } else {
    initializeNuclearOption();
  }
})();
</script>`;
}

/**
 * Build offer page content with template and scripts
 */
function buildOfferPageContent({ templateHTML, campaign, campaignId, launchNumber }) {
  // Generate affiliate links script
  const affiliateLinksScript = generateAffiliateLinksScript(campaign.affiliateLinks || {});
  const hideShopifyElementsCSS = generateHideShopifyElementsCSS();
  
  return `
${hideShopifyElementsCSS}

<!-- Offer Content Container -->
<div id="offer-content">
${templateHTML}
</div>

<!-- Affiliate Link Replacement Script -->
<script>
// Store affiliate links globally for the nuclear option
window.affiliateLinks = ${JSON.stringify(campaign.affiliateLinks || {})};
</script>
${affiliateLinksScript}
`;
}

/**
 * Generate disabled page content
 */
function generateDisabledPageContent(campaignId, launchNumber) {
  return `
<!-- Campaign Launch Disabled -->
<!-- This page has been temporarily disabled -->
<!-- Only tracking code will be executed -->
<script>
(function() {
  // Basic tracking for disabled launch
  var campaignId = "${campaignId}";
  var launchNumber = ${launchNumber};
  
  console.log('Disabled launch tracking - Campaign:', campaignId, 'Launch:', launchNumber);
  
  // Get query parameters
  var urlParams = new URLSearchParams(window.location.search);
  var ttclid = urlParams.get('ttclid');
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Simple log data without needing server data first
  var logData = {
    campaignId: campaignId,
    launchNumber: launchNumber,
    type: 'disabled',
    decision: 'whitehat',
    ip: 'pending',
    country: 'unknown',
    region: null,
    city: null,
    timezone: null,
    continent: null,
    userAgent: navigator.userAgent,
    referer: document.referrer,
    url: window.location.href,
    os: null,
    params: {
      ttclid: ttclid,
      from: urlParams.get('from'),
      mobile: isMobile,
      failureReason: 'Launch disabled'
    }
  };
  
  console.log('Sending disabled launch log:', logData);
  
  // First try to get server data for better tracking info
  var timestamp = new Date().getTime();
  fetch('https://cranads.com/api/campaigns/client/' + campaignId + '/' + launchNumber + '?t=' + timestamp)
    .then(function(response) {
      console.log('Server data response:', response.status);
      return response.json();
    })
    .then(function(data) {
      // Update log data with server info if available
      if (data && data.clientIP) {
        logData.ip = data.clientIP;
      }
      if (data && data.geoData) {
        logData.country = data.geoData.country || 'unknown';
        logData.region = data.geoData.region || null;
        logData.city = data.geoData.city || null;
        logData.timezone = data.geoData.timezone || null;
        logData.continent = data.geoData.continent || null;
      }
      if (data && data.os) {
        logData.os = data.os;
      }
    })
    .catch(function(error) {
      console.log('Could not fetch server data:', error);
    })
    .finally(function() {
      // Send log regardless of whether we got server data
      console.log('Sending log with data:', logData);
      fetch('https://cranads.com/api/logs/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
        keepalive: true
      })
      .then(function(response) {
        console.log('Log sent, status:', response.status);
        return response.text();
      })
      .then(function(responseText) {
        console.log('Log response:', responseText);
      })
      .catch(function(error) {
        console.error('Failed to send log:', error);
      });
    });
})();
</script>
`;
}

/**
 * Update TikTok page content based on launch status
 */
async function updateTikTokPageContent(store, campaign, campaignId, launchNumber, pageHandle, isActive) {
  try {
    // Ensure domain format is correct
    let apiDomain = store.store_url.replace(/^https?:\/\//, '');
    if (!apiDomain.includes('.myshopify.com')) {
      apiDomain = `${apiDomain}.myshopify.com`;
    }
    
    // Check if page exists
    const checkUrl = `https://${apiDomain}/admin/api/2024-01/pages.json?handle=${pageHandle}`;
    console.log('Checking for existing TikTok page:', checkUrl);
    
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!checkResponse.ok) {
      throw new Error(`Failed to check page existence: ${checkResponse.status}`);
    }
    
    const data = await checkResponse.json();
    if (!data.pages || data.pages.length === 0) {
      if (!isActive) {
        // For disabled launches, we don't need to update a non-existent page
        console.log(`Page ${pageHandle} not found - skipping update for disabled launch`);
        return { success: true, message: 'Page does not exist, no update needed for disabled launch' };
      } else {
        // For enabling a launch, we need to create the page
        console.log(`Page ${pageHandle} not found - creating page for enabled launch`);
        
        const pageContent = generatePageContent(campaign, campaignId, launchNumber);
        const createPageData = {
          page: {
            title: `${campaign.name} - Launch ${launchNumber}`,
            handle: pageHandle,
            body_html: pageContent,
            published: true,
            template_suffix: null
          }
        };
        
        const createUrl = `https://${apiDomain}/admin/api/2024-01/pages.json`;
        const createResponse = await fetch(createUrl, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': store.access_token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(createPageData)
        });
        
        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          throw new Error(`Failed to create page: ${createResponse.status} - ${errorText}`);
        }
        
        const result = await createResponse.json();
        console.log(`Page created successfully: ${pageHandle}`);
        return result;
      }
    }
    
    const pageId = data.pages[0].id;
    
    // Generate appropriate content based on active status
    let pageContent;
    if (isActive) {
      // Generate full redirect content
      pageContent = generatePageContent(campaign, campaignId, launchNumber);
    } else {
      // Generate minimal tracking content without redirect
      pageContent = generateDisabledPageContent(campaignId, launchNumber);
    }
    
    // Update the page
    const updateData = {
      page: {
        body_html: pageContent
      }
    };
    
    console.log(`Updating page ${pageHandle} (ID: ${pageId}) - Active: ${isActive}`);
    
    const updateResponse = await fetch(`https://${apiDomain}/admin/api/2024-01/pages/${pageId}.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update page: ${updateResponse.status} - ${errorText}`);
    }
    
    const result = await updateResponse.json();
    console.log(`Page updated successfully: ${pageHandle}`);
    return result;
    
  } catch (error) {
    console.error('Error updating TikTok page content:', error);
    throw error;
  }
}

/**
 * Create or update TikTok validation page on Shopify
 */
async function createTikTokValidationPage(store, campaign, campaignId, launchNumber, pageHandle) {
  const pageContent = generatePageContent(campaign, campaignId, launchNumber);
  
  const pageData = {
    page: {
      title: `${campaign.name} - Launch ${launchNumber}`,
      handle: pageHandle,
      body_html: pageContent,
      published: true,
      template_suffix: null
    }
  };
  
  // Ensure domain format is correct
  let apiDomain = store.store_url.replace(/^https?:\/\//, '');
  if (!apiDomain.includes('.myshopify.com')) {
    apiDomain = `${apiDomain}.myshopify.com`;
  }
  
  // First check if page already exists
  const checkUrl = `https://${apiDomain}/admin/api/2024-01/pages.json?handle=${pageHandle}`;
  console.log('Checking for existing TikTok page:', checkUrl);
  
  const checkResponse = await fetch(checkUrl, {
    headers: {
      'X-Shopify-Access-Token': store.access_token,
      'Content-Type': 'application/json'
    }
  });
  
  let existingPageId = null;
  if (checkResponse.ok) {
    const data = await checkResponse.json();
    if (data.pages && data.pages.length > 0) {
      existingPageId = data.pages[0].id;
      console.log('Found existing TikTok page with ID:', existingPageId);
    }
  }
  
  if (existingPageId) {
    // Update existing page
    console.log('Updating existing TikTok page:', existingPageId);
    const updateResponse = await fetch(`https://${apiDomain}/admin/api/2024-01/pages/${existingPageId}.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pageData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update TikTok page: ${updateResponse.status} - ${errorText}`);
    }
    
    return await updateResponse.json();
  } else {
    // Create new page
    console.log('Creating new TikTok page');
    const createResponse = await fetch(`https://${apiDomain}/admin/api/2024-01/pages.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pageData)
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create TikTok page: ${createResponse.status} - ${errorText}`);
    }
    
    return await createResponse.json();
  }
}

/**
 * Create or update redirect store offer page on Shopify
 */
async function createRedirectStoreOfferPage(db, campaign, campaignId, launchNumber) {
  try {
    // Validate inputs
    if (!campaign) {
      throw new Error('Campaign object is required');
    }
    
    if (!campaign.redirect_store_id) {
      throw new Error('No redirect store configured for campaign');
    }
    
    // Fetch redirect store details
    const redirectStore = await db.prepare(
      'SELECT * FROM shopify_stores WHERE id = ?'
    ).bind(campaign.redirect_store_id).first();
    
    if (!redirectStore) {
      throw new Error(`Redirect store not found: ${campaign.redirect_store_id}`);
    }
    
    if (!redirectStore.access_token) {
      throw new Error('Redirect store is missing Admin API token');
    }
    
    console.log(`Creating offer page on redirect store: ${redirectStore.store_name || redirectStore.store_url}`);
    console.log('Campaign template_id:', campaign.template_id);
    
    // Get the template HTML
    const templateHTML = await getTemplateHTML(db, campaign.template_id);
    console.log('Template HTML length:', templateHTML ? templateHTML.length : 0);
    
    // Generate page handle for redirect store
    const offerPageHandle = `offer-${campaignId}-${launchNumber}`;
    
    // Build the offer page content with template and hide CSS
    const offerPageContent = buildOfferPageContent({
      templateHTML,
      campaign,
      campaignId,
      launchNumber
    });
    
    // Validate content is not empty
    if (!offerPageContent || offerPageContent.trim() === '') {
      console.error('Error: Offer page content is empty');
      throw new Error('Failed to generate offer page content');
    }
    
    console.log('Offer page content length:', offerPageContent.length);
    console.log('Offer page content preview:', offerPageContent.substring(0, 200) + '...');
    
    // Create page data
    const pageData = {
      page: {
        title: `${campaign.name} - Offer ${launchNumber}`,
        handle: offerPageHandle,
        body_html: offerPageContent,
        published: true,
        template_suffix: null
      }
    };
    
    // Ensure domain format is correct
    let apiDomain = redirectStore.store_url.replace(/^https?:\/\//, '');
    if (!apiDomain.includes('.myshopify.com')) {
      apiDomain = `${apiDomain}.myshopify.com`;
    }
    
    // Check if page already exists
    const checkUrl = `https://${apiDomain}/admin/api/2024-01/pages.json?handle=${offerPageHandle}`;
    console.log('Checking for existing redirect page:', checkUrl);
    
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'X-Shopify-Access-Token': redirectStore.access_token,
        'Content-Type': 'application/json'
      }
    });
    
    let existingPageId = null;
    if (checkResponse.ok) {
      const data = await checkResponse.json();
      if (data.pages && data.pages.length > 0) {
        existingPageId = data.pages[0].id;
        console.log('Found existing redirect page with ID:', existingPageId);
      }
    }
    
    if (existingPageId) {
      // Update existing page
      console.log('Updating existing redirect page:', existingPageId);
      const updateResponse = await fetch(`https://${apiDomain}/admin/api/2024-01/pages/${existingPageId}.json`, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': redirectStore.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pageData)
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update redirect page: ${updateResponse.status} - ${errorText}`);
      }
      
      const result = await updateResponse.json();
      console.log(`Offer page updated successfully: ${offerPageHandle}`);
      return result;
    } else {
      // Create new page
      console.log('Creating new redirect page');
      const createResponse = await fetch(`https://${apiDomain}/admin/api/2024-01/pages.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': redirectStore.access_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pageData)
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create redirect page: ${createResponse.status} - ${errorText}`);
      }
      
      const result = await createResponse.json();
      console.log(`Offer page created successfully: ${offerPageHandle}`);
      return result;
    }
    
  } catch (error) {
    console.error('Error in createRedirectStoreOfferPage:', error);
    throw error;
  }
}

/**
 * Generate campaign link
 * Creates/updates Shopify pages and returns the link
 */
async function generateCampaignLink(db, request, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    const requestData = await request.json();
    const { campaignId, launchNumber } = requestData;
        
    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const launch = launchNumber !== undefined ? launchNumber : 0;
    
    // Validate launch number is not negative
    if (launch < 0) {
      return new Response(
        JSON.stringify({ error: 'Launch number must be non-negative' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Fetch campaign data with team permission check
    let campaign;
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        campaign = await db.prepare(
          `SELECT * FROM campaigns WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaignId, ...memberIds, teamId).first();
      } else {
        campaign = await db.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND team_id = ?'
        ).bind(campaignId, teamId).first();
      }
    } else {
      campaign = await db.prepare(
        'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
      ).bind(campaignId, userId).first();
    }
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ 
          error: 'Campaign not found',
          campaignId: campaignId
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate launch number doesn't exceed total launches
    if (launch >= campaign.total_launches) {
      return new Response(
        JSON.stringify({ 
          error: `Launch number ${launch} exceeds maximum allowed launches (${campaign.total_launches})` 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const launches = JSON.parse(campaign.launches || '{}');
    
    // Update launch info
    if (!launches[launch.toString()]) {
      launches[launch.toString()] = {
        isActive: false,
        createdAt: new Date().toISOString(),
        trafficPassed: 0,
        trafficBlocked: 0,
        trafficDisabled: 0
      };
    }
    
    // Update the generatedAt timestamp
    launches[launch.toString()].generatedAt = new Date().toISOString();
    
    // Update max_launch_number if this is a higher launch number
    const maxLaunchNumber = Math.max(campaign.max_launch_number || 0, launch);
    
    // Save the updated campaign
    await db.prepare(`
      UPDATE campaigns SET 
        launches = ?,
        max_launch_number = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(JSON.stringify(launches), maxLaunchNumber, campaignId).run();
    
    // Get TikTok store details with team permission check
    let tiktokStore;
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        tiktokStore = await db.prepare(
          `SELECT * FROM shopify_stores WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaign.tiktok_store_id, ...memberIds, teamId).first();
      } else {
        tiktokStore = await db.prepare(
          'SELECT * FROM shopify_stores WHERE id = ? AND team_id = ?'
        ).bind(campaign.tiktok_store_id, teamId).first();
      }
    } else {
      tiktokStore = await db.prepare(
        'SELECT * FROM shopify_stores WHERE id = ? AND user_id = ?'
      ).bind(campaign.tiktok_store_id, userId).first();
    }
    
    if (!tiktokStore) {
      return new Response(
        JSON.stringify({ error: 'TikTok store not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Ensure store URL is properly formatted
    let storeUrl = tiktokStore.store_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!storeUrl.includes('.myshopify.com') && !storeUrl.includes('.')) {
      storeUrl = `${storeUrl}.myshopify.com`;
    }
    
    // Check if store has admin API token
    if (!tiktokStore.access_token) {
      return new Response(
        JSON.stringify({ error: 'Store is missing admin API token. Please update the store configuration.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate the link with proper store URL
    const pageHandle = `cloak-${campaignId}-${launch}`;
    const linkUrl = `https://${storeUrl}/pages/${pageHandle}`;
    
    try {
      // Step 1: ALWAYS create/update the validation/redirect page on TikTok store
      // This ensures any campaign changes (like affiliate links) are reflected
      console.log('Creating/updating TikTok store validation page with latest campaign data...');
      
      // Parse campaign data for page creation
      // IMPORTANT: Use the updated launches object, not the original campaign.launches
      const campaignData = {
        ...campaign,
        launches: JSON.stringify(launches), // Use the updated launches
        regions: JSON.parse(campaign.regions || '[]'),
        affiliateLinks: JSON.parse(campaign.affiliate_link || '{}'),
        redirectType: campaign.redirect_type,
        customRedirectUrl: campaign.custom_redirect_link
      };
      
      // Check if launch is active
      const isLaunchActive = launches[launch.toString()] && launches[launch.toString()].isActive;
      
      if (isLaunchActive) {
        // Create/update page with full redirect content
        const tiktokPageResult = await createTikTokValidationPage(
          tiktokStore, 
          campaignData, 
          campaignId, 
          launch, 
          pageHandle
        );
        console.log('TikTok store page created/updated:', tiktokPageResult);
      } else {
        // For disabled launches, we need to create the page with disabled content
        console.log('Creating/updating TikTok store page with disabled content...');
        
        // First check if page exists
        const checkUrl = `https://${storeUrl}/admin/api/2024-01/pages.json?handle=${pageHandle}`;
        const checkResponse = await fetch(checkUrl, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': tiktokStore.access_token,
            'Content-Type': 'application/json'
          }
        });
        
        const checkData = await checkResponse.json();
        const pageExists = checkData.pages && checkData.pages.length > 0;
        
        if (pageExists) {
          // Page exists, update it with disabled content
          const updateResult = await updateTikTokPageContent(
            tiktokStore,
            campaignData,
            campaignId,
            launch,
            pageHandle,
            false
          );
          console.log('Existing page updated with disabled content');
        } else {
          // Page doesn't exist, create it with disabled content
          const disabledPageContent = generateDisabledPageContent(campaignId, launch);
          const createPageData = {
            page: {
              title: `${campaign.name} - Launch ${launch}`,
              handle: pageHandle,
              body_html: disabledPageContent,
              published: true,
              template_suffix: null
            }
          };
          
          const createUrl = `https://${storeUrl}/admin/api/2024-01/pages.json`;
          const createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: {
              'X-Shopify-Access-Token': tiktokStore.access_token,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(createPageData)
          });
          
          if (!createResponse.ok) {
            throw new Error(`Failed to create disabled page: ${createResponse.status}`);
          }
          
          console.log('New page created with disabled content');
        }
      }
      
      // Step 2: If not using custom redirect, ALWAYS create/update the offer page on redirect store
      if (campaign.redirect_type !== 'custom' && campaign.redirect_store_id) {
        try {
          console.log('Creating/updating redirect store offer page with latest campaign data...');
          const redirectPageResult = await createRedirectStoreOfferPage(
            db, 
            campaignData, 
            campaignId, 
            launch
          );
          console.log('Redirect store offer page created/updated:', redirectPageResult);
        } catch (offerError) {
          console.error('Warning: Could not create/update offer page on redirect store:', offerError);
          // Don't fail the whole operation if offer page creation fails
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        campaignId: campaignId,
        launchNumber: launch,
        link: linkUrl,
        displayLink: linkUrl,
        message: 'Link generated and Shopify pages updated successfully',
        pageHandle: pageHandle,
        refreshed: true,
        storeUrl: storeUrl
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (pageCreationError) {
      console.error('Error creating/updating Shopify pages:', pageCreationError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create/update Shopify pages',
          message: pageCreationError.message,
          link: linkUrl // Still return the link even if page creation failed
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error) {
    console.error('Error generating campaign link:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate campaign link',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Update campaign traffic counts
 * This is called when logging clicks to update the traffic counters
 */
async function updateCampaignTraffic(db, campaignId, trafficType, launchNumber = null) {
  try {
    // Update campaign-level traffic
    let updateQuery;
    
    if (trafficType === 'passed' || trafficType === 'blackhat') {
      // Update passed traffic (successful redirects)
      updateQuery = `
        UPDATE campaigns 
        SET traffic_passed = traffic_passed + 1,
            traffic = traffic + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
    } else if (trafficType === 'disabled') {
      // Update disabled traffic (disabled launch visits)
      updateQuery = `
        UPDATE campaigns 
        SET traffic_disabled = traffic_disabled + 1,
            traffic = traffic + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
    } else if (trafficType === 'blocked' || trafficType === 'whitehat') {
      // Update blocked traffic (validation failures)
      updateQuery = `
        UPDATE campaigns 
        SET traffic_blocked = traffic_blocked + 1,
            traffic = traffic + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
    } else {
      // Just update total traffic
      updateQuery = `
        UPDATE campaigns 
        SET traffic = traffic + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
    }
    
    await db.prepare(updateQuery).bind(campaignId).run();
    
    // Update per-launch traffic if launch number is provided
    if (launchNumber !== null) {
      // Get current launches data and disabled clicks threshold
      const campaign = await db.prepare('SELECT launches, disabled_clicks_threshold FROM campaigns WHERE id = ?').bind(campaignId).first();
      if (campaign) {
        const launches = JSON.parse(campaign.launches || '{}');
        const launchKey = launchNumber.toString();
        
        // Initialize launch if it doesn't exist
        if (!launches[launchKey]) {
          launches[launchKey] = {
            isActive: true,
            createdAt: new Date().toISOString(),
            trafficPassed: 0,
            trafficBlocked: 0
          };
        }
        
        // Initialize traffic fields if they don't exist (for existing launches)
        if (typeof launches[launchKey].trafficPassed === 'undefined') {
          launches[launchKey].trafficPassed = 0;
        }
        if (typeof launches[launchKey].trafficBlocked === 'undefined') {
          launches[launchKey].trafficBlocked = 0;
        }
        if (typeof launches[launchKey].trafficDisabled === 'undefined') {
          launches[launchKey].trafficDisabled = 0;
        }
        
        // Update traffic counts
        if (trafficType === 'passed' || trafficType === 'blackhat') {
          launches[launchKey].trafficPassed = launches[launchKey].trafficPassed + 1;
        } else if (trafficType === 'disabled') {
          launches[launchKey].trafficDisabled = launches[launchKey].trafficDisabled + 1;
        } else if (trafficType === 'blocked' || trafficType === 'whitehat') {
          launches[launchKey].trafficBlocked = launches[launchKey].trafficBlocked + 1;
        }
        
        // Save updated launches data
        await db.prepare('UPDATE campaigns SET launches = ? WHERE id = ?')
          .bind(JSON.stringify(launches), campaignId)
          .run();
      }
    }
    
    console.log(`Updated traffic for campaign ${campaignId}, launch ${launchNumber}: ${trafficType}`);
    return { success: true };
    
  } catch (error) {
    console.error('Error updating campaign traffic:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get campaign data for client-side tracking
 * This endpoint doesn't require authentication
 */
async function getCampaignDataForClient(db, campaignId, launchNumber, request) {
  try {
    // Fetch campaign from database (no user_id check for public access)
    const campaign = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ?'
    ).bind(campaignId).first();
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if launch exists
    const launches = JSON.parse(campaign.launches || '{}');
    if (!launches[launchNumber.toString()]) {
      return new Response(
        JSON.stringify({ error: 'Launch not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get redirect store domain if using Shopify redirect
    let redirectStoreDomain = null;
    if (campaign.redirect_store_id) {
      const redirectStore = await db.prepare(
        'SELECT store_url FROM shopify_stores WHERE id = ?'
      ).bind(campaign.redirect_store_id).first();
      
      if (redirectStore && redirectStore.store_url) {
        redirectStoreDomain = redirectStore.store_url.replace(/^https?:\/\//, '');
        if (!redirectStoreDomain.includes('.myshopify.com') && !redirectStoreDomain.includes('.')) {
          redirectStoreDomain = `${redirectStoreDomain}.myshopify.com`;
        }
      }
    }
    
    // Get client IP from Cloudflare headers
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                    request.headers.get('X-Forwarded-For') || 
                    request.headers.get('X-Real-IP') || 
                    'unknown';
    
    // Get user's region from Cloudflare headers
    const country = request.headers.get('CF-IPCountry') || 'US';
    const region = request.headers.get('CF-Region') || null;
    const city = request.headers.get('CF-City') || null;
    const timezone = request.headers.get('CF-Timezone') || null;
    const continent = request.headers.get('CF-Continent') || null;
    
    // Parse regions and affiliate links
    const regions = JSON.parse(campaign.regions || '[]');
    const affiliateLinks = JSON.parse(campaign.affiliate_link || '{}');
    
    // Return campaign data for client
    return new Response(JSON.stringify({
      campaignId: campaign.id,
      name: campaign.name,
      redirectType: campaign.redirect_type,
      customRedirectUrl: campaign.custom_redirect_link,
      redirectStoreDomain: redirectStoreDomain,
      region: regions.includes(country) ? country : 'US',
      affiliateLinks: affiliateLinks,
      isActive: campaign.is_active === 1,
      launch: {
        number: parseInt(launchNumber),
        isActive: launches[launchNumber.toString()].isActive
      },
      clientIP: clientIP,
      geoData: {
        country: country,
        region: region,
        city: city,
        timezone: timezone,
        continent: continent
      }
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('Error fetching campaign data for client:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch campaign data',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Get campaign traffic statistics
 */
async function getCampaignTrafficStats(db, campaignId, request, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    // Fetch campaign with permission check
    let campaign;
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        campaign = await db.prepare(
          `SELECT id, name, traffic, traffic_passed, traffic_blocked, traffic_disabled FROM campaigns WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaignId, ...memberIds, teamId).first();
      } else {
        campaign = await db.prepare(
          'SELECT id, name, traffic, traffic_passed, traffic_blocked, traffic_disabled FROM campaigns WHERE id = ? AND team_id = ?'
        ).bind(campaignId, teamId).first();
      }
    } else {
      campaign = await db.prepare(
        'SELECT id, name, traffic, traffic_passed, traffic_blocked, traffic_disabled FROM campaigns WHERE id = ? AND user_id = ?'
      ).bind(campaignId, userId).first();
    }
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Calculate percentages
    const total = campaign.traffic || 0;
    const passed = campaign.traffic_passed || 0;
    const blocked = campaign.traffic_blocked || 0;
    const disabled = campaign.traffic_disabled || 0;
    
    const stats = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      traffic: {
        total: total,
        passed: passed,
        blocked: blocked,
        disabled: disabled,
        passedPercentage: total > 0 ? ((passed / total) * 100).toFixed(2) : '0.00',
        blockedPercentage: total > 0 ? ((blocked / total) * 100).toFixed(2) : '0.00',
        disabledPercentage: total > 0 ? ((disabled / total) * 100).toFixed(2) : '0.00'
      }
    };
    
    return new Response(JSON.stringify(stats), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('Error getting campaign traffic stats:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get traffic statistics',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Main handler function for campaign endpoints
 */
// Export functions for use by other modules
export { updateCampaignTraffic, updateTikTokPageContent, createRedirectStoreOfferPage };

export default async function handleCampaignsAPI(request, env, path) {
  const db = env.DASHBOARD_DB;
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
  
  // Handle OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }
  
  // Initialize table on first request
  await initializeCampaignsTable(db);
  
  // Extract campaign ID from path if present
  const pathParts = path.split('/').filter(p => p);
  const campaignId = pathParts[2]; // /api/campaigns/{id}
  const subPath = pathParts[3]; // /api/campaigns/{id}/{subpath}
  
  console.log('Campaigns API called:', {
    path,
    method: request.method,
    pathParts,
    campaignId,
    subPath,
    pathPartsLength: pathParts.length
  });
  
  try {
    // Route to appropriate handler based on method and path
    switch (true) {
      // List campaigns
      case path === '/api/campaigns' && request.method === 'GET':
        return await listCampaigns(db, request, env);
      
      // Create campaign
      case path === '/api/campaigns' && request.method === 'POST':
        return await createCampaign(db, request, env);
      
      // Generate link
      case path === '/api/campaigns/generate-link' && request.method === 'POST':
        return await generateCampaignLink(db, request, env);
      
      // Get single campaign - match pattern /api/campaigns/{id}
      case pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'campaigns' && request.method === 'GET' && campaignId && !subPath:
        return await getCampaign(db, campaignId, request, env);
      
      // Update campaign
      case pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'campaigns' && request.method === 'PUT' && campaignId && !subPath:
        return await updateCampaign(db, campaignId, request, env);
      
      // Delete campaign
      case pathParts.length === 3 && pathParts[0] === 'api' && pathParts[1] === 'campaigns' && request.method === 'DELETE' && campaignId && !subPath:
        return await deleteCampaign(db, campaignId, request, env);
      
      // Toggle active status
      case subPath === 'toggle-active' && request.method === 'POST':
        return await toggleCampaignActive(db, campaignId, request, env);
      
      // Update status
      case subPath === 'status' && request.method === 'PUT':
        return await toggleCampaignStatus(db, campaignId, request, env);
      
      // Manage launches
      case subPath === 'launches' && request.method === 'POST':
        return await manageCampaignLaunches(db, campaignId, request, env);
      
      // Get traffic statistics
      case subPath === 'traffic-stats' && request.method === 'GET':
        return await getCampaignTrafficStats(db, campaignId, request, env);
      
      // Client endpoint for tracking - /api/campaigns/client/{campaignId}/{launchNumber}
      case pathParts[2] === 'client' && pathParts.length === 5 && request.method === 'GET':
        const clientCampaignId = pathParts[3];
        const launchNumber = pathParts[4];
        return await getCampaignDataForClient(db, clientCampaignId, launchNumber, request);
      
      default:
        console.log('No matching route found for:', {
          path,
          method: request.method,
          pathParts,
          campaignId
        });
        return new Response(
          JSON.stringify({ 
            error: 'Endpoint not found',
            path,
            method: request.method,
            pathParts,
            campaignId
          }),
          { 
            status: 404, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            } 
          }
        );
    }
  } catch (error) {
    console.error('Campaign API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }
}
