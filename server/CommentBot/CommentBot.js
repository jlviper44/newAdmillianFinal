/**
 * CommentBot.js - Modified to work with local SQL database for comment groups
 * 
 * This version uses local SQL database instead of external API for comment groups
 * while maintaining support for other tikhub.info endpoints
 */

// Import SQL functions
import { executeQuery } from '../SQL/SQL.js';

// API Configuration
const API_CONFIG = {
  baseUrl: 'https://tikhub.info',
  apiKey: 'mem'
};

// CORS Configuration for CommentBot
const CORS_CONFIG = {
  allowedOrigins: [
    'https://tikhub.info',
    '*' // Fallback wildcard
  ],
  allowedMethods: 'GET, POST, PUT, DELETE, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization, x-api-key',
  maxAge: '86400'
};

/**
 * Handle CORS for CommentBot requests
 * @param {Request} request - The incoming request
 * @returns {Response|null} - A CORS preflight response or null
 */
function handleCommentBotCors(request) {
  const origin = request.headers.get('Origin');
  const accessControlAllowOrigin = CORS_CONFIG.allowedOrigins.includes(origin) ? origin : '*';
  
  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': accessControlAllowOrigin,
        'Access-Control-Allow-Methods': CORS_CONFIG.allowedMethods,
        'Access-Control-Allow-Headers': CORS_CONFIG.allowedHeaders,
        'Access-Control-Max-Age': CORS_CONFIG.maxAge,
      }
    });
  }
  
  // For non-OPTIONS requests, return null and continue processing
  return null;
}

/**
 * Initialize comment groups tables if they don't exist
 * @param {Object} env - Environment bindings
 */
async function initializeCommentGroupTables(env) {
  try {
    // Create comment_groups table with legends JSON column
    await env.COMMENT_BOT_DB.prepare(`
      CREATE TABLE IF NOT EXISTS comment_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id VARCHAR(255),
        name TEXT NOT NULL,
        description TEXT,
        legends TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    
    // Create indices
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_comment_groups_created_at 
      ON comment_groups(created_at)
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_comment_groups_user_id 
      ON comment_groups(user_id)
    `).run();
    
    // Create orders table
    await env.COMMENT_BOT_DB.prepare(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id VARCHAR(255),
        order_id TEXT UNIQUE NOT NULL,
        post_id TEXT NOT NULL,
        status TEXT NOT NULL,
        like_count INTEGER DEFAULT 0,
        save_count INTEGER DEFAULT 0,
        comment_group_id INTEGER,
        message TEXT,
        api_created_at TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (comment_group_id) REFERENCES comment_groups(id)
      )
    `).run();
    
    // Create indices for orders table
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id)
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_orders_post_id ON orders(post_id)
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)
    `).run();
    
    // // console.log('Comment group and orders tables initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing comment group tables:', error);
    return false;
  }
}

/**
 * Handle Comment Bot data requests
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {Object} session - The user session from requireAuth middleware
 */
export async function handleCommentBotData(request, env, session) {
  // Handle CORS for CommentBot requests
  const corsResponse = handleCommentBotCors(request);
  if (corsResponse) {
    return corsResponse;
  }
  
  // Get user_id from session (passed by requireAuth middleware)
  const userId = session?.user?.id;
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized - No user ID found' }, 401);
  }
  
  // Initialize tables if needed (this will only create them if they don't exist)
  await initializeCommentGroupTables(env);
  
  // Get the query parameters
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  
  try {
    // Based on the type parameter, return different data
    switch(type) {
      case 'comment-groups':
        return await getCommentGroups(request, env, userId);
      case 'comment-group-detail':
        const groupId = url.searchParams.get('id');
        if (!groupId) {
          return jsonResponse({ error: 'Comment Group ID is required' }, 400);
        }
        return await getCommentGroupDetail(groupId, env, userId);
      case 'account-pools':
        return await getAccountPools();
      case 'order-status':
        const orderId = url.searchParams.get('order_id');
        if (!orderId) {
          return jsonResponse({ error: 'Order ID is required' }, 400);
        }
        return await getOrderStatus(orderId, env, userId);
      case 'orders':
        return await getOrders(request, env, userId);
      default:
        // Handle POST, PUT, DELETE requests based on path
        if (request.method === 'POST') {
          const path = url.pathname;
          
          if (path === '/api/commentbot/comment-groups') {
            return await createCommentGroup(request, env, userId);
          }
          
          if (path === '/api/commentbot/create-order') {
            return await createOrder(request, env, userId);
          }
          
          if (path === '/api/commentbot/check-accounts') {
            const accountType = url.searchParams.get('type');
            if (!accountType) {
              return jsonResponse({ error: 'Account type is required' }, 400);
            }
            return await checkAccounts(accountType);
          }
        }
        
        // Handle PUT requests for updating comment groups
        if (request.method === 'PUT' && url.pathname.match(/^\/api\/commentbot\/comment-groups\/\d+$/)) {
          return await updateCommentGroup(request, env, userId);
        }
        
        // Handle DELETE requests for deleting comment groups
        if (request.method === 'DELETE' && url.pathname.match(/^\/api\/commentbot\/comment-groups\/\d+$/)) {
          return await deleteCommentGroup(request, env, userId);
        }
        
        // Handle GET requests for checking account status
        if (request.method === 'GET' && url.pathname === '/api/commentbot/check-status') {
          const accountType = url.searchParams.get('type');
          if (!accountType) {
            return jsonResponse({ error: 'Account type is required' }, 400);
          }
          return await getAccountCheckStatus(accountType);
        }
        
        // If no specific type is requested, return error
        return jsonResponse({ error: 'Invalid request type or method' }, 400);
    }
  } catch (error) {
    console.error('Error in handleCommentBotData:', error);
    return jsonResponse({ 
      error: 'Internal server error', 
      message: error.message,
      stack: error.stack
    }, 500);
  }
}

/**
 * Helper function to create JSON responses with CORS headers
 * @param {Object} data - The data to send
 * @param {number} status - HTTP status code
 */
function jsonResponse(data, status = 200) {
  const origin = globalThis.originForCors || '*';
  
  return new Response(
    JSON.stringify(data),
    {
      status: status,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': CORS_CONFIG.allowedMethods,
        'Access-Control-Allow-Headers': CORS_CONFIG.allowedHeaders
      }
    }
  );
}

/**
 * Safely make API requests with proper error handling
 * Use a fetch wrapper that works with HTTP endpoints
 * @param {string} path - The API path
 * @param {Object} options - Fetch options
 */
async function fetchAPI(path, options = {}) {
  try {
    // Use a full URL with the API base
    const apiUrl = `${API_CONFIG.baseUrl}${path}`;
    
    // // console.log(`Making request to: ${apiUrl}`);
    
    const fetchOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_CONFIG.apiKey,
        ...(options.headers || {})
      }
    };
    
    // Log request details for debugging
    // // console.log('Request details:', {
    //   url: apiUrl,
    //   method: fetchOptions.method || 'GET',
    //   headers: fetchOptions.headers
    // });
    
    // Make the fetch request
    const response = await fetch(apiUrl, fetchOptions);
    
    // Log response status for debugging
    // // console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      let errorMessage;
      try {
        const errorData = await response.json();
        errorMessage = JSON.stringify(errorData);
      } catch (e) {
        errorMessage = `Status ${response.status}`;
      }
      throw new Error(`API error: ${errorMessage}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API Fetch Error: ${error.message}`);
    throw error;
  }
}


/**
 * Get all comment groups with pagination from local database
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID to filter by
 */
async function getCommentGroups(request, env, userId) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // Query comment groups from local database
    const query = `
      SELECT 
        cg.id,
        cg.name,
        cg.description,
        cg.created_at,
        cg.updated_at,
        cg.legends,
        json_array_length(cg.legends) as legend_count
      FROM comment_groups cg
      WHERE cg.user_id = ?
      ORDER BY cg.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const result = await executeQuery(env.COMMENT_BOT_DB, query, [userId, limit, offset]);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Parse the legends JSON for each comment group
    const commentGroups = result.data.map(group => {
      try {
        return {
          ...group,
          legends: JSON.parse(group.legends || '[]')
        };
      } catch (e) {
        console.error('Error parsing legends JSON:', e);
        return {
          ...group,
          legends: []
        };
      }
    });
    
    return jsonResponse({
      success: true,
      commentGroups: commentGroups
    });
  } catch (error) {
    console.error('Error fetching comment groups:', error);
    return jsonResponse({ 
      error: 'Failed to fetch comment groups', 
      details: error.message 
    }, 500);
  }
}

/**
 * Get detailed information about a specific comment group from local database
 * @param {string} groupId - The ID of the comment group to fetch
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID to verify ownership
 */
async function getCommentGroupDetail(groupId, env, userId) {
  try {
    // Get comment group details
    const groupQuery = `SELECT * FROM comment_groups WHERE id = ? AND user_id = ?`;
    const groupResult = await executeQuery(env.COMMENT_BOT_DB, groupQuery, [groupId, userId]);
    
    if (!groupResult.success || groupResult.data.length === 0) {
      return jsonResponse({ error: 'Comment group not found' }, 404);
    }
    
    const commentGroup = groupResult.data[0];
    
    // Parse the legends JSON
    let legends = [];
    try {
      legends = JSON.parse(commentGroup.legends || '[]');
    } catch (e) {
      console.error('Error parsing legends JSON:', e);
      legends = [];
    }
    
    // Transform legends to include conversations array
    const transformedLegends = legends.map(legend => ({
      ...legend,
      conversations: legend.conversations ? legend.conversations.map(conv => conv.comment_text) : []
    }));
    
    return jsonResponse({
      success: true,
      commentGroup: {
        ...commentGroup,
        legends: transformedLegends
      }
    });
  } catch (error) {
    console.error('Error fetching comment group details:', error);
    return jsonResponse({ 
      error: 'Failed to fetch comment group details', 
      details: error.message 
    }, 500);
  }
}

/**
 * Create a new comment group in local database
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID to associate with the comment group
 */
async function createCommentGroup(request, env, userId) {
  try {
    // Store origin for later use in jsonResponse
    if (request.headers.get('Origin')) {
      globalThis.originForCors = request.headers.get('Origin');
    }
    
    // Parse request body
    const groupData = await request.json();
    
    // Validate required fields
    if (!groupData.name) {
      return jsonResponse({ error: 'Comment group name is required' }, 400);
    }
    
    if (!groupData.legends || !Array.isArray(groupData.legends) || groupData.legends.length === 0) {
      return jsonResponse({ error: 'At least one legend with conversations is required' }, 400);
    }
    
    // Prepare legends data as JSON
    const legendsData = groupData.legends.map((legend, legendIndex) => {
      const conversations = (legend.conversations || []).map((conversation, convIndex) => {
        // Handle both string and object formats
        const commentText = typeof conversation === 'string' 
          ? conversation 
          : (conversation.text || '');
        
        return {
          comment_text: commentText,
          sequence_order: convIndex + 1
        };
      });
      
      return {
        id: legendIndex + 1, // Generate a simple ID for internal reference
        legend_name: legend.name || 'Legend',
        conversations: conversations
      };
    });
    
    try {
      // Insert comment group with legends as JSON
      const insertGroupQuery = `
        INSERT INTO comment_groups (user_id, name, description, legends)
        VALUES (?, ?, ?, ?)
      `;
      
      const groupResult = await env.COMMENT_BOT_DB.prepare(insertGroupQuery)
        .bind(userId, groupData.name, groupData.description || null, JSON.stringify(legendsData))
        .run();
      
      const groupId = groupResult.meta.last_row_id;
      
      // Return the created group with its details
      return await getCommentGroupDetail(groupId, env, userId);
      
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message || dbError}`);
    }
  } catch (error) {
    console.error('Error creating comment group:', error);
    return jsonResponse({ 
      error: 'Failed to create comment group', 
      details: error.message 
    }, 500);
  }
}

/**
 * Update an existing comment group in local database
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID to verify ownership
 */
async function updateCommentGroup(request, env, userId) {
  try {
    // Store origin for later use in jsonResponse
    if (request.headers.get('Origin')) {
      globalThis.originForCors = request.headers.get('Origin');
    }
    
    // Get group ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const groupId = pathParts[pathParts.length - 1];
    
    if (!groupId || isNaN(groupId)) {
      return jsonResponse({ error: 'Invalid comment group ID' }, 400);
    }
    
    // Parse request body
    const groupData = await request.json();
    
    // Validate required fields
    if (!groupData.name) {
      return jsonResponse({ error: 'Comment group name is required' }, 400);
    }
    
    if (!groupData.legends || !Array.isArray(groupData.legends) || groupData.legends.length === 0) {
      return jsonResponse({ error: 'At least one legend with conversations is required' }, 400);
    }
    
    // Prepare legends data as JSON
    const legendsData = groupData.legends.map((legend, legendIndex) => {
      const conversations = (legend.conversations || []).map((conversation, convIndex) => {
        // Handle both string and object formats
        const commentText = typeof conversation === 'string' 
          ? conversation 
          : (conversation.text || '');
        
        return {
          comment_text: commentText,
          sequence_order: convIndex + 1
        };
      });
      
      return {
        id: legendIndex + 1, // Generate a simple ID for internal reference
        legend_name: legend.name || 'Legend',
        conversations: conversations
      };
    });
    
    try {
      // Check if comment group exists and belongs to user
      const checkQuery = `SELECT id FROM comment_groups WHERE id = ? AND user_id = ?`;
      const checkResult = await executeQuery(env.COMMENT_BOT_DB, checkQuery, [groupId, userId]);
      
      if (!checkResult.success || checkResult.data.length === 0) {
        return jsonResponse({ error: 'Comment group not found' }, 404);
      }
      
      // Update comment group with new legends JSON
      const updateGroupQuery = `
        UPDATE comment_groups 
        SET name = ?, description = ?, legends = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      await env.COMMENT_BOT_DB.prepare(updateGroupQuery)
        .bind(groupData.name, groupData.description || null, JSON.stringify(legendsData), groupId)
        .run();
      
      // Return the updated group with its details
      return await getCommentGroupDetail(groupId, env, userId);
      
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message || dbError}`);
    }
  } catch (error) {
    console.error('Error updating comment group:', error);
    return jsonResponse({ 
      error: 'Failed to update comment group', 
      details: error.message 
    }, 500);
  }
}

/**
 * Delete a comment group from local database
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID to verify ownership
 */
async function deleteCommentGroup(request, env, userId) {
  try {
    // Get group ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const groupId = pathParts[pathParts.length - 1];
    
    if (!groupId || isNaN(groupId)) {
      return jsonResponse({ error: 'Invalid comment group ID' }, 400);
    }
    
    // Check if comment group exists and belongs to user
    const checkQuery = `SELECT id FROM comment_groups WHERE id = ? AND user_id = ?`;
    const checkResult = await executeQuery(env.COMMENT_BOT_DB, checkQuery, [groupId, userId]);
    
    if (!checkResult.success || checkResult.data.length === 0) {
      return jsonResponse({ error: 'Comment group not found' }, 404);
    }
    
    // Delete comment group (legends are stored as JSON within the table)
    const deleteQuery = `DELETE FROM comment_groups WHERE id = ? AND user_id = ?`;
    await env.COMMENT_BOT_DB.prepare(deleteQuery).bind(groupId, userId).run();
    
    return jsonResponse({
      success: true,
      message: 'Comment group deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment group:', error);
    return jsonResponse({ 
      error: 'Failed to delete comment group', 
      details: error.message 
    }, 500);
  }
}

/**
 * Get information about account pools (like and comment)
 */
async function getAccountPools() {
  try {
    // Get like pool info
    const likePool = await fetchAPI(`/api/pools/like`);
    
    // Get comment pool info
    const commentPool = await fetchAPI(`/api/pools/comment-global`);
    
    return jsonResponse({
      success: true,
      pools: {
        like: likePool,
        comment: commentPool
      }
    });
  } catch (error) {
    console.error('Error fetching account pools:', error);
    return jsonResponse({ 
      error: 'Failed to fetch account pools', 
      details: error.message 
    }, 500);
  }
}

/**
 * Start checking account status
 * @param {string} accountType - Type of accounts to check (like or comment-global)
 */
async function checkAccounts(accountType) {
  try {
    let endpoint;
    if (accountType === 'like') {
      endpoint = `/api/accounts/check/like`;
    } else if (accountType === 'comment-global') {
      endpoint = `/api/accounts/check/comment-global`;
    } else {
      return jsonResponse({ error: 'Invalid account type. Must be "like" or "comment-global"' }, 400);
    }
    
    const data = await fetchAPI(endpoint, { method: 'POST' });
    
    return jsonResponse({
      success: true,
      message: `Started checking ${accountType} accounts`,
      data: data
    });
  } catch (error) {
    console.error(`Error checking ${accountType} accounts:`, error);
    return jsonResponse({ 
      error: `Failed to check ${accountType} accounts`, 
      details: error.message 
    }, 500);
  }
}

/**
 * Get account check status
 * @param {string} accountType - Type of accounts (like or comment-global)
 */
async function getAccountCheckStatus(accountType) {
  try {
    let endpoint;
    if (accountType === 'like') {
      endpoint = `/api/accounts/check/like/status`;
    } else if (accountType === 'comment-global') {
      endpoint = `/api/accounts/check/comment-global/status`;
    } else {
      return jsonResponse({ error: 'Invalid account type. Must be "like" or "comment-global"' }, 400);
    }
    
    const data = await fetchAPI(endpoint);
    
    return jsonResponse({
      success: true,
      status: data
    });
  } catch (error) {
    console.error(`Error getting ${accountType} account check status:`, error);
    return jsonResponse({ 
      error: `Failed to get ${accountType} account check status`, 
      details: error.message 
    }, 500);
  }
}

/**
 * Create a new order
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID to associate with the order
 */
async function createOrder(request, env, userId) {
  try {
    // Store origin for later use in jsonResponse
    if (request.headers.get('Origin')) {
      globalThis.originForCors = request.headers.get('Origin');
    }
    
    // Parse request body
    const orderData = await request.json();
    
    // Validate required fields
    if (!orderData.post_id) {
      return jsonResponse({ error: 'TikTok post ID is required' }, 400);
    }
    
    // Ensure at least one interaction type is specified
    if (
      (!orderData.like_count || orderData.like_count <= 0) && 
      (!orderData.save_count || orderData.save_count <= 0) && 
      (!orderData.comment_group_id)
    ) {
      return jsonResponse({ 
        error: 'At least one interaction type (like, save, or comment) must be specified' 
      }, 400);
    }
    
    // Prepare API data
    let apiData = {
      post_id: orderData.post_id,
      like_count: orderData.like_count || 0,
      save_count: orderData.save_count || 0
    };
    
    // If comment_group_id is provided, fetch comment group details and format them
    if (orderData.comment_group_id) {
      // Get comment group details and verify it belongs to the user
      const groupQuery = `SELECT * FROM comment_groups WHERE id = ? AND user_id = ?`;
      const groupResult = await executeQuery(env.COMMENT_BOT_DB, groupQuery, [orderData.comment_group_id, userId]);
      
      if (!groupResult.success || groupResult.data.length === 0) {
        return jsonResponse({ error: 'Comment group not found' }, 404);
      }
      
      const commentGroup = groupResult.data[0];
      
      // Parse the legends JSON
      let legendsData = [];
      try {
        legendsData = JSON.parse(commentGroup.legends || '[]');
      } catch (e) {
        console.error('Error parsing legends JSON:', e);
        legendsData = [];
      }
      
      // Build comment_data with legends and conversations
      const legends = legendsData.map(legend => {
        // Format conversations to match the new API structure
        const conversations = (legend.conversations || []).map((conv, index) => ({
          user: String.fromCharCode(65 + (index % 3)), // A, B, C pattern
          text: conv.comment_text
        }));
        
        return {
          conversations: conversations
        };
      });
      
      // Add comment_data to API payload
      apiData.comment_data = {
        legends: legends
      };
    }
    
    // console.log(JSON.stringify(apiData));

    // Call API to create order
    const createdOrder = await fetchAPI(
      `/api/orders/create`, 
      { 
        method: 'POST',
        body: JSON.stringify(apiData)
      }
    );
    
    // Save order to local database if API call was successful
    if (createdOrder && createdOrder.order_id) {
      try {
        const insertOrderQuery = `
          INSERT INTO orders (
            user_id,
            order_id,
            post_id,
            status,
            like_count,
            save_count,
            comment_group_id,
            message,
            api_created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await env.COMMENT_BOT_DB.prepare(insertOrderQuery)
          .bind(
            userId,
            createdOrder.order_id,
            createdOrder.post_id,
            createdOrder.status,
            orderData.like_count || 0,
            orderData.save_count || 0,
            orderData.comment_group_id || null,
            createdOrder.message || null,
            createdOrder.created_at
          )
          .run();
          
        // // console.log(`Order ${createdOrder.order_id} saved to database`);
      } catch (dbError) {
        console.error('Failed to save order to database:', dbError);
        // Continue even if database save fails - API call was successful
      }
    }
    
    return jsonResponse({
      success: true,
      order: createdOrder
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return jsonResponse({ 
      error: 'Failed to create order', 
      details: error.message 
    }, 500);
  }
}

/**
 * Get all orders from database
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID to filter by
 */
async function getOrders(request, env, userId) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status') || null;
    
    // Build query based on filters
    let query = `
      SELECT 
        o.*,
        cg.name as comment_group_name
      FROM orders o
      LEFT JOIN comment_groups cg ON o.comment_group_id = cg.id
      WHERE o.user_id = ?
    `;
    
    const params = [userId];
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const result = await executeQuery(env.COMMENT_BOT_DB, query, params);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM orders WHERE user_id = ?';
    const countParams = [userId];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    const countResult = await executeQuery(env.COMMENT_BOT_DB, countQuery, countParams);
    const total = countResult.success && countResult.data.length > 0 ? countResult.data[0].total : 0;
    
    return jsonResponse({
      success: true,
      orders: result.data,
      pagination: {
        total: total,
        limit: limit,
        offset: offset
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return jsonResponse({ 
      error: 'Failed to fetch orders', 
      details: error.message 
    }, 500);
  }
}

/**
 * Get order status from external API and update local database
 * @param {string} orderId - ID of the order to check
 * @param {Object} env - Environment bindings (optional for database update)
 * @param {string} userId - The user ID to verify ownership
 */
async function getOrderStatus(orderId, env = null, userId = null) {
  try {
    // Fetch status from external API
    const orderStatus = await fetchAPI(`/api/orders/${orderId}/status`);
    // Update local database if env is provided
    if (env && orderStatus) {
      try {
        const updateQuery = `
          UPDATE orders 
          SET 
            status = ?,
            updated_at = datetime('now')
          WHERE order_id = ?
        `;
        
        await env.COMMENT_BOT_DB.prepare(updateQuery)
          .bind(orderStatus.status, orderId)
          .run();
          
      } catch (dbError) {
        console.error('Failed to update order status in database:', dbError);
        // Continue even if database update fails
      }
    }
    
    // Fetch the complete order data from database
    if (env) {
      const orderQuery = `
        SELECT 
          o.*,
          cg.name as comment_group_name
        FROM orders o
        LEFT JOIN comment_groups cg ON o.comment_group_id = cg.id
        WHERE o.order_id = ? AND o.user_id = ?
      `;
      
      const result = await executeQuery(env.COMMENT_BOT_DB, orderQuery, [orderId, userId]);
      
      if (result.success && result.data.length > 0) {
        return jsonResponse({
          success: true,
          order: result.data[0],
          progress: orderStatus
        });
      }
    }
    
    return jsonResponse({
      success: true,
      status: orderStatus
    });
  } catch (error) {
    console.error('Error getting order status:', error);
    return jsonResponse({ 
      error: 'Failed to get order status', 
      details: error.message 
    }, 500);
  }
}