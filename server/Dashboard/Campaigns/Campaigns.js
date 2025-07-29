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
        launches TEXT DEFAULT '{}', -- JSON object of launches
        max_launch_number INTEGER DEFAULT 0,
        total_launches INTEGER DEFAULT 1,
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
      "0": { isActive: true, createdAt: new Date().toISOString(), generatedAt: null }
    };
    
    // Insert campaign
    await db.prepare(`
      INSERT INTO campaigns (
        id, user_id, team_id, name, description, regions, tiktok_store_id, redirect_store_id,
        template_id, redirect_type, custom_redirect_link, affiliate_link,
        status, is_active, traffic, launches, max_launch_number, total_launches
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      JSON.stringify(launches),
      0, // maxLaunchNumber
      1  // totalLaunches
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
    
    // Validate required fields
    if (!campaignData.name || !campaignData.regions || campaignData.regions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
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
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      campaignData.name,
      campaignData.description || null,
      JSON.stringify(campaignData.regions),
      campaignData.tiktokStoreId || existingCampaign.tiktok_store_id,
      campaignData.redirectStoreId || null,
      campaignData.templateId || null,
      campaignData.redirectType || 'template',
      campaignData.customRedirectLink || null,
      campaignData.affiliateLinks ? JSON.stringify(campaignData.affiliateLinks) : null,
      campaignData.status || existingCampaign.status,
      campaignData.isActive !== false ? 1 : 0,
      campaignData.launches ? JSON.stringify(campaignData.launches) : existingCampaign.launches,
      campaignData.maxLaunchNumber !== undefined ? campaignData.maxLaunchNumber : existingCampaign.max_launch_number,
      campaignData.totalLaunches !== undefined ? campaignData.totalLaunches : existingCampaign.total_launches,
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
          isActive: true,
          createdAt: new Date().toISOString(),
          generatedAt: null
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

// Cloaking functionality has been moved to cloaker-worker.js
// The following functions are now handled by the external cloaker service:
// - generatePageContent
// - getTemplateHTML  
// - generateAffiliateLinksScript
// - generateHideShopifyElementsCSS
// - buildOfferPageContent
// - createTikTokValidationPage
// - createRedirectStoreOfferPage



// Configuration for cloaker service will be passed from env in the handler

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
        isActive: true,
        createdAt: new Date().toISOString()
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
      // Call the cloaker worker to create/update pages
      console.log('Calling cloaker worker to generate pages...');
      
      // Parse campaign data for the cloaker
      const campaignData = {
        ...campaign,
        name: campaign.name,
        regions: JSON.parse(campaign.regions || '[]'),
        affiliateLinks: JSON.parse(campaign.affiliate_link || '{}'),
        redirectType: campaign.redirect_type,
        customRedirectUrl: campaign.custom_redirect_link
      };
      
      // Get redirect store if needed
      let redirectStore = null;
      if (campaign.redirect_type !== 'custom' && campaign.redirect_store_id) {
        // Fetch redirect store with team permissions
        if (teamId) {
          const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
          const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
          
          if (teamMembersResult.results && teamMembersResult.results.length > 0) {
            const memberIds = teamMembersResult.results.map(m => m.user_id);
            const placeholders = memberIds.map(() => '?').join(',');
            redirectStore = await db.prepare(
              `SELECT * FROM shopify_stores WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
            ).bind(campaign.redirect_store_id, ...memberIds, teamId).first();
          } else {
            redirectStore = await db.prepare(
              'SELECT * FROM shopify_stores WHERE id = ? AND team_id = ?'
            ).bind(campaign.redirect_store_id, teamId).first();
          }
        } else {
          redirectStore = await db.prepare(
            'SELECT * FROM shopify_stores WHERE id = ? AND user_id = ?'
          ).bind(campaign.redirect_store_id, userId).first();
        }
        
        if (redirectStore) {
          // Format redirect store data for cloaker
          redirectStore = {
            id: redirectStore.id,
            storeName: redirectStore.store_name,
            storeUrl: redirectStore.store_url,
            accessToken: redirectStore.access_token
          };
        }
      }
      
      // Get template HTML if needed
      let templateHTML = null;
      if (campaign.template_id) {
        templateHTML = await getTemplateHTML(db, campaign.template_id);
      }
      
      // Format TikTok store data for cloaker
      const tiktokStoreData = {
        id: tiktokStore.id,
        storeName: tiktokStore.store_name,
        storeUrl: tiktokStore.store_url,
        accessToken: tiktokStore.access_token
      };
      
      // Call cloaker API
      const CLOAKER_WORKER_URL = env.CLOAKER_WORKER_URL || 'https://cloaker.maximillianfreakyads.workers.dev';
      console.log('Calling cloaker at:', `${CLOAKER_WORKER_URL}/generate-pages`);
      
      const cloakerResponse = await fetch(`${CLOAKER_WORKER_URL}/generate-pages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          campaign: campaignData,
          campaignId: campaignId,
          launchNumber: launch,
          tiktokStore: tiktokStoreData,
          redirectStore: redirectStore,
          templateHTML: templateHTML
        })
      });
      
      if (!cloakerResponse.ok) {
        const errorText = await cloakerResponse.text();
        console.error('Cloaker API error details:', {
          status: cloakerResponse.status,
          statusText: cloakerResponse.statusText,
          url: `${CLOAKER_WORKER_URL}/generate-pages`,
          errorText: errorText
        });
        throw new Error(`Cloaker API error: ${cloakerResponse.status} - ${errorText}`);
      }
      
      const cloakerResult = await cloakerResponse.json();
      console.log('Cloaker API response:', cloakerResult);
      
      return new Response(JSON.stringify({
        success: true,
        campaignId: campaignId,
        launchNumber: launch,
        link: cloakerResult.link || linkUrl,
        displayLink: cloakerResult.link || linkUrl,
        message: 'Link generated and Shopify pages updated successfully',
        pageHandle: cloakerResult.pageHandle || pageHandle,
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
 * Main handler function for campaign endpoints
 */
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
