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
    } catch (error) {
      console.error('Error handling user_id column:', error);
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
 * Extract user_id from session
 */
async function getUserIdFromSession(request, env) {
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
    
    return session.user_id;
  } catch (error) {
    console.error('Error extracting user_id from session:', error);
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
    
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'all';
    const region = url.searchParams.get('region') || 'all';
    const offset = (page - 1) * limit;
    
    // Build query conditions - always include user_id filter
    let whereConditions = ['user_id = ?'];
    let params = [userId];
    
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
    const campaigns = (result.results || []).map(campaign => ({
      ...campaign,
      regions: JSON.parse(campaign.regions || '[]'),
      launches: JSON.parse(campaign.launches || '{}'),
      isActive: campaign.is_active === 1,
      tiktokStoreId: campaign.tiktok_store_id,
      redirectStoreId: campaign.redirect_store_id,
      templateId: campaign.template_id,
      redirectType: campaign.redirect_type,
      customRedirectLink: campaign.custom_redirect_link,
      affiliateLink: campaign.affiliate_link,
      maxLaunchNumber: campaign.max_launch_number,
      totalLaunches: campaign.total_launches,
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at
    }));
    
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
    
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    const campaign = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
    ).bind(campaignId, userId).first();
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found', campaignId }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const formattedCampaign = {
      ...campaign,
      regions: JSON.parse(campaign.regions || '[]'),
      launches: JSON.parse(campaign.launches || '{}'),
      isActive: campaign.is_active === 1,
      tiktokStoreId: campaign.tiktok_store_id,
      redirectStoreId: campaign.redirect_store_id,
      templateId: campaign.template_id,
      redirectType: campaign.redirect_type,
      customRedirectLink: campaign.custom_redirect_link,
      affiliateLink: campaign.affiliate_link,
      maxLaunchNumber: campaign.max_launch_number,
      totalLaunches: campaign.total_launches,
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at
    };
    
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
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
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
        id, user_id, name, description, regions, tiktok_store_id, redirect_store_id,
        template_id, redirect_type, custom_redirect_link, affiliate_link,
        status, is_active, traffic, launches, max_launch_number, total_launches
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      campaignId,
      userId,
      campaignData.name,
      campaignData.description || null,
      JSON.stringify(campaignData.regions),
      campaignData.tiktokStoreId,
      campaignData.redirectStoreId || null,
      campaignData.templateId || null,
      campaignData.redirectType || 'template',
      campaignData.customRedirectLink || null,
      campaignData.affiliateLink || null,
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
      affiliateLink: created.affiliate_link,
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
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    // Check if campaign exists and belongs to user
    const existingCampaign = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
    ).bind(campaignId, userId).first();
    
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
      WHERE id = ? AND user_id = ?
    `).bind(
      campaignData.name,
      campaignData.description || null,
      JSON.stringify(campaignData.regions),
      campaignData.tiktokStoreId || existingCampaign.tiktok_store_id,
      campaignData.redirectStoreId || null,
      campaignData.templateId || null,
      campaignData.redirectType || 'template',
      campaignData.customRedirectLink || null,
      campaignData.affiliateLink || null,
      campaignData.status || existingCampaign.status,
      campaignData.isActive !== false ? 1 : 0,
      campaignData.launches ? JSON.stringify(campaignData.launches) : existingCampaign.launches,
      campaignData.maxLaunchNumber !== undefined ? campaignData.maxLaunchNumber : existingCampaign.max_launch_number,
      campaignData.totalLaunches !== undefined ? campaignData.totalLaunches : existingCampaign.total_launches,
      campaignId,
      userId
    ).run();
    
    // Fetch and return the updated campaign
    const updated = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
    ).bind(campaignId, userId).first();
    
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
      affiliateLink: updated.affiliate_link,
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
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    // Check if campaign exists and belongs to user
    const existingCampaign = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
    ).bind(campaignId, userId).first();
    
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
      'DELETE FROM campaigns WHERE id = ? AND user_id = ?'
    ).bind(campaignId, userId).run();
    
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
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    const existingCampaign = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
    ).bind(campaignId, userId).first();
    
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
      WHERE id = ? AND user_id = ?
    `).bind(newIsActive, newStatus, campaignId, userId).run();
    
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
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    const existingCampaign = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
    ).bind(campaignId, userId).first();
    
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
      WHERE id = ? AND user_id = ?
    `).bind(status, isActive, campaignId, userId).run();
    
    // Fetch and return the updated campaign
    const updated = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
    ).bind(campaignId, userId).first();
    
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
      affiliateLink: updated.affiliate_link,
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
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    const requestData = await request.json();
    const { action, launchData } = requestData;
    
    console.log(`Managing launches for campaign ${campaignId}: ${action}`);
    
    const campaign = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
    ).bind(campaignId, userId).first();
    
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
      WHERE id = ? AND user_id = ?
    `).bind(
      JSON.stringify(launches),
      maxLaunchNumber,
      Object.keys(launches).length,
      campaignId,
      userId
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
  
  // Redirect logic based on campaign configuration
  function performRedirect() {
    if (!serverData) return;
    
    const device = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 
                  /Android/i.test(navigator.userAgent) ? 'android' : 'all';
    const region = serverData.region || 'US';
    
    let redirectUrl = null;
    
    if (serverData.redirectType === 'custom' && serverData.customRedirectUrl) {
      redirectUrl = serverData.customRedirectUrl;
    } else if (serverData.redirectStoreDomain) {
      const offerPageHandle = 'offer-' + campaignId + '-' + launchNumber;
      redirectUrl = 'https://' + serverData.redirectStoreDomain + '/pages/' + offerPageHandle;
    }
    
    if (redirectUrl) {
      // Add tracking parameters
      const separator = redirectUrl.includes('?') ? '&' : '?';
      const finalUrl = redirectUrl + separator + 'utm_source=tiktok&utm_campaign=' + campaignId;
      
      console.log('Redirecting to:', finalUrl);
      window.location.href = finalUrl;
    } else {
      console.error('No redirect URL configured');
      document.getElementById('loading-container').innerHTML = '<p>Configuration error. Please try again later.</p>';
    }
  }
  
  // Fetch campaign data from the server
  fetch(window.location.origin + '/api/campaigns/client/' + campaignId + '/' + launchNumber)
    .then(function(response) { 
      return response.json(); 
    })
    .then(function(data) {
      console.log('Received server data:', data);
      serverData = data;
      
      // Always redirect after getting server data
      performRedirect();
    })
    .catch(function(error) {
      console.error('Error fetching campaign data:', error);
      document.getElementById('loading-container').innerHTML = '<p>Error loading campaign. Please try again.</p>';
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
  const affiliateLinks = ${JSON.stringify(affiliateLinks || {})};
  
  // Get user's region
  const region = (new URLSearchParams(window.location.search)).get('region') || 'US';
  const device = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 
                /Android/i.test(navigator.userAgent) ? 'android' : 'all';
  
  // Function to get the best matching affiliate link
  function getAffiliateLink() {
    // Try device-specific link first
    const deviceKey = region + '_' + device;
    if (affiliateLinks[deviceKey]) {
      return affiliateLinks[deviceKey];
    }
    
    // Fall back to region default
    if (affiliateLinks[region]) {
      return affiliateLinks[region];
    }
    
    // Fall back to any available link
    const anyLink = Object.values(affiliateLinks).find(link => link && link.length > 0);
    return anyLink || '#';
  }
  
  // Replace all affiliate links on page load
  document.addEventListener('DOMContentLoaded', function() {
    const affiliateLink = getAffiliateLink();
    console.log('Using affiliate link:', affiliateLink);
    
    // Replace all links with class 'affiliate-link' or containing 'AFFILIATE_LINK'
    document.querySelectorAll('a.affiliate-link, a[href*="AFFILIATE_LINK"]').forEach(function(link) {
      link.href = affiliateLink;
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
    
    // Also replace any text instances of AFFILIATE_LINK
    document.body.innerHTML = document.body.innerHTML.replace(/AFFILIATE_LINK/g, affiliateLink);
  });
})();
</script>
`;
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
  
  // Function to hide Shopify elements
  function hideShopifyElements() {
    const style = document.createElement('style');
    style.textContent = \`
      /* Hide Shopify UI elements */
      .shopify-section, 
      .shopify-section-header,
      .shopify-section-footer,
      header, 
      footer, 
      .header, 
      .footer,
      .announcement-bar,
      .site-header,
      .site-footer,
      .cookie-banner,
      [id*="shopify-"],
      [class*="shopify-"],
      .skip-to-content-link {
        display: none !important;
      }
      
      /* Reset body styling */
      body {
        margin: 0 !important;
        padding: 0 !important;
      }
      
      /* Show only the offer content */
      #offer-content {
        display: block !important;
        visibility: visible !important;
      }
    \`;
    document.head.appendChild(style);
    
    // Remove initial hide
    const initialHide = document.getElementById('initial-hide');
    if (initialHide) {
      initialHide.remove();
    }
    
    // Make HTML visible
    document.documentElement.style.visibility = 'visible';
  }
  
  // Run immediately and on DOM ready
  hideShopifyElements();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideShopifyElements);
  }
})();
</script>
`;
}

/**
 * Build offer page content with template and scripts
 */
function buildOfferPageContent({ templateHTML, campaign, campaignId, launchNumber }) {
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
// Store affiliate links globally
window.affiliateLinks = ${JSON.stringify(campaign.affiliateLinks || {})};
</script>
${affiliateLinksScript}
`;
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
      'X-Shopify-Access-Token': store.admin_api_token,
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
        'X-Shopify-Access-Token': store.admin_api_token,
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
        'X-Shopify-Access-Token': store.admin_api_token,
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
    
    if (!redirectStore.admin_api_token) {
      throw new Error('Redirect store is missing Admin API token');
    }
    
    console.log(`Creating offer page on redirect store: ${redirectStore.store_name || redirectStore.store_url}`);
    
    // Get the template HTML
    const templateHTML = await getTemplateHTML(db, campaign.template_id);
    
    // Generate page handle for redirect store
    const offerPageHandle = `offer-${campaignId}-${launchNumber}`;
    
    // Build the offer page content with template and hide CSS
    const offerPageContent = buildOfferPageContent({
      templateHTML,
      campaign,
      campaignId,
      launchNumber
    });
    
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
        'X-Shopify-Access-Token': redirectStore.admin_api_token,
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
          'X-Shopify-Access-Token': redirectStore.admin_api_token,
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
          'X-Shopify-Access-Token': redirectStore.admin_api_token,
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
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
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
    
    // Fetch campaign data
    const campaign = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
    ).bind(campaignId, userId).first();
    
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
      WHERE id = ? AND user_id = ?
    `).bind(JSON.stringify(launches), maxLaunchNumber, campaignId, userId).run();
    
    // Get TikTok store details
    const tiktokStore = await db.prepare(
      'SELECT * FROM shopify_stores WHERE id = ? AND user_id = ?'
    ).bind(campaign.tiktok_store_id, userId).first();
    
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
    if (!tiktokStore.admin_api_token) {
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
      const campaignData = {
        ...campaign,
        regions: JSON.parse(campaign.regions || '[]'),
        affiliateLinks: JSON.parse(campaign.affiliate_links || '{}'),
        redirectType: campaign.redirect_type,
        customRedirectUrl: campaign.custom_redirect_link
      };
      
      const tiktokPageResult = await createTikTokValidationPage(
        tiktokStore, 
        campaignData, 
        campaignId, 
        launch, 
        pageHandle
      );
      console.log('TikTok store page created/updated:', tiktokPageResult);
      
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
    
    // Parse regions and affiliate links
    const regions = JSON.parse(campaign.regions || '[]');
    const affiliateLinks = JSON.parse(campaign.affiliate_links || '{}');
    
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