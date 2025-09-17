/**
 * CommentBot.js - Modified to work with local SQL database for comment groups
 * 
 * This version uses local SQL database instead of external API for comment groups
 * while maintaining support for other tikhub.info endpoints
 */

// Import SQL functions
import { executeQuery } from '../SQL/SQL.js';
// Import admin check function from Auth
import { isAdminUser } from '../Auth/Auth.js';
// Import queue functions
import { 
  initializeQueueTables,
  createJob,
  getJob,
  getUserJobs,
  cancelJob,
  getJobLogs,
  getQueueStats
} from './CommentBotQueue.js';

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
 * Save order progress to D1 database
 */
async function saveOrderProgress(request, env, orderId, userId, teamId) {
  try {
    const data = await request.json();
    
    // Verify the order belongs to this user/team
    let verifyQuery;
    let verifyParams;
    
    if (teamId) {
      verifyQuery = 'SELECT order_id FROM orders WHERE order_id = ? AND team_id = ?';
      verifyParams = [orderId, teamId];
    } else {
      verifyQuery = 'SELECT order_id FROM orders WHERE order_id = ? AND user_id = ?';
      verifyParams = [orderId, userId];
    }
    
    const verifyResult = await executeQuery(env.COMMENT_BOT_DB, verifyQuery, verifyParams);
    
    if (!verifyResult.success || verifyResult.data.length === 0) {
      return jsonResponse({ error: 'Order not found or access denied' }, 404);
    }
    
    // Create the order_progress table if it doesn't exist
    await initializeOrderProgressTable(env);
    
    // Insert or update the progress data
    const progressData = JSON.stringify(data.progress);
    
    const query = `
      INSERT INTO order_progress (order_id, progress_data, saved_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(order_id) 
      DO UPDATE SET 
        progress_data = excluded.progress_data,
        saved_at = datetime('now')
    `;
    
    const result = await env.COMMENT_BOT_DB.prepare(query)
      .bind(orderId, progressData)
      .run();
    
    // Update the order status if provided
    if (data.status === 'completed' && data.completed_at) {
      // First check if completed_at column exists, if not just update status
      try {
        const updateOrderQuery = `
          UPDATE orders 
          SET status = ?, updated_at = datetime('now')
          WHERE order_id = ?
        `;
        
        const updateResult = await env.COMMENT_BOT_DB.prepare(updateOrderQuery)
          .bind(data.status, orderId)
          .run();
      } catch (updateError) {
        // Continue anyway - progress was saved
      }
    }
    return jsonResponse({
      success: true,
      message: 'Progress saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving order progress:', error);
    console.error('Error stack:', error.stack);
    return jsonResponse({ 
      error: 'Failed to save progress', 
      details: error.message,
      stack: error.stack
    }, 500);
  }
}

/**
 * Initialize order progress table
 */
async function initializeOrderProgressTable(env) {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS order_progress (
      order_id TEXT PRIMARY KEY,
      progress_data TEXT,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  try {
    await env.COMMENT_BOT_DB.prepare(createTableQuery).run();
  } catch (error) {
    console.error('Error creating order_progress table:', error);
  }
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
        team_id VARCHAR(255),
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
        team_id VARCHAR(255),
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
    
    // Add team_id column to existing tables if it doesn't exist
    try {
      await env.COMMENT_BOT_DB.prepare(`
        ALTER TABLE comment_groups ADD COLUMN team_id VARCHAR(255)
      `).run();
    } catch (e) {
      // Column might already exist
    }
    
    try {
      await env.COMMENT_BOT_DB.prepare(`
        ALTER TABLE orders ADD COLUMN team_id VARCHAR(255)
      `).run();
    } catch (e) {
      // Column might already exist
    }
    
    // Create indices for team_id
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_comment_groups_team_id ON comment_groups(team_id)
    `).run();
    
    await env.COMMENT_BOT_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_orders_team_id ON orders(team_id)
    `).run();
    
    // // console.log('Comment group and orders tables initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing comment group tables:', error);
    return false;
  }
}

/**
 * Get user's team ID from the database
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user's ID
 * @returns {Promise<string|null>} - The team ID or null if not in a team
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
  let userId = session?.user?.id;
  if (!userId) {
    return jsonResponse({ error: 'Unauthorized - No user ID found' }, 401);
  }
  
  // Initialize tables if needed (this will only create them if they don't exist)
  await initializeCommentGroupTables(env);
  await initializeQueueTables(env);
  await initializeOrderProgressTable(env);
  
  // Get user's team ID
  const teamId = await getUserTeamId(env, userId);
  
  // Get the query parameters
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const path = url.pathname;
  
  try {
    // Handle POST, PUT, DELETE requests based on path first (regardless of type parameter)
    if (request.method === 'POST') {
      // Save order progress endpoint
      // Match pattern: /api/commentbot/orders/{orderId}/save-progress
      const saveProgressMatch = path.match(/^\/api\/commentbot\/orders\/([^\/]+)\/save-progress$/);
      if (saveProgressMatch) {
        const orderId = saveProgressMatch[1];
        return await saveOrderProgress(request, env, orderId, userId, teamId);
      }
      
      if (path === '/api/commentbot/comment-groups') {
        return await createCommentGroup(request, env, userId, teamId);
      }
          
          if (path === '/api/commentbot/create-order') {
            // Use queue system for order processing
            return await createOrderWithQueue(request, env, userId, teamId);
          }
          
          if (path === '/api/commentbot/create-job') {
            return await createJobEndpoint(request, env, userId, teamId);
          }
          
          
          if (path === '/api/commentbot/cancel-job') {
            const jobId = url.searchParams.get('job_id');
            if (!jobId) {
              return jsonResponse({ error: 'Job ID is required' }, 400);
            }
            return await cancelJobEndpoint(jobId, env, userId, teamId);
          }
          
          if (path === '/api/commentbot/check-accounts') {
            const accountType = url.searchParams.get('type');
            if (!accountType) {
              return jsonResponse({ error: 'Account type is required' }, 400);
            }
            return await checkAccounts(accountType);
          }
          
          // Manual trigger for processing queue (for testing)
          if (path === '/api/commentbot/process-queue') {
            try {
              console.log('[MANUAL] Processing queue...');
              const { processCronJobs } = await import('./CommentBotWorker.js');
              const processedCount = await processCronJobs(env, 1);
              
              return jsonResponse({
                success: true,
                message: `Processed ${processedCount} job(s)`,
                processedCount: processedCount
              });
            } catch (error) {
              console.error('[MANUAL] Queue processing error:', error);
              return jsonResponse({
                success: false,
                error: error.message
              }, 500);
            }
          }
          
          // Test endpoint to debug API calls and queue
          if (path === '/api/commentbot/test-api') {
            const testMode = url.searchParams.get('mode') || 'direct'; // 'direct' or 'queue'
            const orderData = await request.json();
            
            if (testMode === 'direct') {
              // Test direct API call
              try {
                // Build the exact API data structure
                let apiData = {
                  post_id: orderData.post_id,
                  like_count: orderData.like_count || 0,
                  save_count: orderData.save_count || 0
                };
                
                // Add comment data if provided
                if (orderData.comment_data) {
                  apiData.comment_data = orderData.comment_data;
                }
                
                console.log('[TEST] Direct API call with data:', JSON.stringify(apiData, null, 2));
                
                const response = await fetchAPI('/api/orders/create', {
                  method: 'POST',
                  body: JSON.stringify(apiData)
                });
                
                console.log('[TEST] API Response:', JSON.stringify(response, null, 2));
                
                // Poll status once to see current state
                if (response.order_id) {
                  await new Promise(resolve => setTimeout(resolve, 5000));
                  const statusResponse = await fetchAPI(`/api/orders/${response.order_id}/status`);
                  console.log('[TEST] Status Response:', JSON.stringify(statusResponse, null, 2));
                  
                  return jsonResponse({
                    success: true,
                    apiResponse: response,
                    statusResponse: statusResponse,
                    requestSent: apiData
                  });
                }
                
                return jsonResponse({
                  success: true,
                  apiResponse: response,
                  requestSent: apiData
                });
              } catch (error) {
                console.error('[TEST] API Error:', error);
                return jsonResponse({
                  success: false,
                  error: error.message,
                  requestSent: orderData
                });
              }
            } else {
              // Test via queue
              return await createOrderWithQueue(request, env, userId, teamId);
            }
          }
    }
    
    // Handle GET requests with type parameter
    if (request.method === 'GET' && type) {
      switch(type) {
        case 'comment-groups':
          return await getCommentGroups(request, env, userId, teamId);
        case 'comment-group-detail':
          const groupId = url.searchParams.get('id');
          if (!groupId) {
            return jsonResponse({ error: 'Comment Group ID is required' }, 400);
          }
          return await getCommentGroupDetail(groupId, env, userId, teamId);
        case 'account-pools':
          return await getAccountPools();
        case 'order-status':
          const orderId = url.searchParams.get('order_id');
          if (!orderId) {
            return jsonResponse({ error: 'Order ID is required' }, 400);
          }
          return await getOrderStatus(orderId, env, userId, teamId);
        case 'orders':
          return await getOrders(request, env, userId, teamId);
        case 'jobs':
          return await getJobs(request, env, userId, teamId);
        case 'job-status':
          const jobId = url.searchParams.get('job_id');
          if (!jobId) {
            return jsonResponse({ error: 'Job ID is required' }, 400);
          }
          return await getJobStatus(jobId, env, userId, teamId);
        case 'job-logs':
          const jobLogId = url.searchParams.get('job_id');
          if (!jobLogId) {
            return jsonResponse({ error: 'Job ID is required' }, 400);
          }
          return await getJobLogsEndpoint(jobLogId, env, userId, teamId);
        case 'queue-stats':
          return await getQueueStatsEndpoint(env);
      }
    }
        
        // Handle PUT requests for updating comment groups
        if (request.method === 'PUT' && url.pathname.match(/^\/api\/commentbot\/comment-groups\/\d+$/)) {
          return await updateCommentGroup(request, env, userId, teamId);
        }
        
        // Handle DELETE requests for deleting comment groups
        if (request.method === 'DELETE' && url.pathname.match(/^\/api\/commentbot\/comment-groups\/\d+$/)) {
          return await deleteCommentGroup(request, env, userId, teamId);
        }
        
        // Handle GET requests for checking account status
        if (request.method === 'GET' && url.pathname === '/api/commentbot/check-status') {
          const accountType = url.searchParams.get('type');
          if (!accountType) {
            return jsonResponse({ error: 'Account type is required' }, 400);
          }
          return await getAccountCheckStatus(accountType);
        }
        
        // Handle GET requests for logs (admin only)
        if (request.method === 'GET' && url.pathname === '/api/commentbot/logs') {
          // Check if user is admin based on email and not a virtual assistant
          const userEmail = session?.user?.email;
          const isVirtualAssistant = session?.user?.isVirtualAssistant;
          const isAdmin = userEmail && isAdminUser(userEmail) && !isVirtualAssistant;
          
          if (!isAdmin) {
            return jsonResponse({ error: 'Unauthorized - Admin access required' }, 403);
          }
          return await getCommentBotLogs(request, env);
        }
        
        // Handle GET requests for exporting logs (admin only)
        if (request.method === 'GET' && url.pathname === '/api/commentbot/logs/export') {
          // Check if user is admin based on email and not a virtual assistant
          const userEmail = session?.user?.email;
          const isVirtualAssistant = session?.user?.isVirtualAssistant;
          const isAdmin = userEmail && isAdminUser(userEmail) && !isVirtualAssistant;
          
          if (!isAdmin) {
            return jsonResponse({ error: 'Unauthorized - Admin access required' }, 403);
          }
          return await exportCommentBotLogs(request, env);
        }
        
    // If no specific type is requested, return error
    console.log('Unhandled request:', request.method, url.pathname, 'type:', type);
    return jsonResponse({ 
      error: 'Invalid request type or method',
      details: {
        method: request.method,
        path: url.pathname,
        type: type
      }
    }, 400);
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
    
    // Get response text
    const responseText = await response.text();
    
    // Try to parse as JSON
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      if (!response.ok) {
        throw new Error(`API error: Status ${response.status}, Body: ${responseText}`);
      }
      // If response is OK but not JSON, return the text
      return responseText;
    }
    
    if (!response.ok) {
      const errorMessage = responseData.error || responseData.message || JSON.stringify(responseData);
      throw new Error(`API error: ${errorMessage}`);
    }
    
    return responseData;
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
 * @param {string|null} teamId - The team ID to filter by (if user is in a team)
 */
async function getCommentGroups(request, env, userId, teamId) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // Query comment groups from local database
    // If user is in a team, show:
    // 1. All comment groups created by team members (including pre-existing ones)
    // 2. All comment groups explicitly marked with the team_id
    // Otherwise, only show user's own comment groups
    let query, params;
    
    if (teamId) {
      // First get all team member IDs
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await executeQuery(env.USERS_DB, teamMembersQuery, [teamId]);
      
      if (teamMembersResult.success && teamMembersResult.data.length > 0) {
        const memberIds = teamMembersResult.data.map(m => m.user_id);
        
        query = `
          SELECT 
            cg.id,
            cg.name,
            cg.description,
            cg.created_at,
            cg.updated_at,
            cg.legends,
            cg.user_id,
            cg.team_id,
            json_array_length(cg.legends) as legend_count
          FROM comment_groups cg
          WHERE cg.user_id IN (${memberIds.map(() => '?').join(',')})
             OR cg.team_id = ?
          ORDER BY cg.created_at DESC
          LIMIT ? OFFSET ?
        `;
        params = [...memberIds, teamId, limit, offset];
      } else {
        // Fallback if no members found
        query = `
          SELECT 
            cg.id,
            cg.name,
            cg.description,
            cg.created_at,
            cg.updated_at,
            cg.legends,
            cg.user_id,
            cg.team_id,
            json_array_length(cg.legends) as legend_count
          FROM comment_groups cg
          WHERE cg.team_id = ?
          ORDER BY cg.created_at DESC
          LIMIT ? OFFSET ?
        `;
        params = [teamId, limit, offset];
      }
    } else {
      query = `
        SELECT 
          cg.id,
          cg.name,
          cg.description,
          cg.created_at,
          cg.updated_at,
          cg.legends,
          cg.user_id,
          json_array_length(cg.legends) as legend_count
        FROM comment_groups cg
        WHERE cg.user_id = ?
        ORDER BY cg.created_at DESC
        LIMIT ? OFFSET ?
      `;
      params = [userId, limit, offset];
    }
    
    const result = await executeQuery(env.COMMENT_BOT_DB, query, params);
    
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
    
    // If this is a team query, fetch creator information from USERS_DB
    if (teamId && commentGroups.length > 0) {
      // Get unique user IDs
      const userIds = [...new Set(commentGroups.map(g => g.user_id).filter(id => id))];
      
      if (userIds.length > 0) {
        try {
          // Fetch user data from sessions in USERS_DB
          // We look for any session (even expired) to get user info
          const userQuery = `
            SELECT 
              user_id,
              user_data,
              MAX(created_at) as latest_session
            FROM sessions 
            WHERE user_id IN (${userIds.map(() => '?').join(',')})
            GROUP BY user_id
          `;
          
          const userResult = await executeQuery(env.USERS_DB, userQuery, userIds);
          
          if (userResult.success) {
            // Create a map of user data
            const userMap = {};
            userResult.data.forEach(row => {
              try {
                const userData = JSON.parse(row.user_data);
                userMap[row.user_id] = {
                  id: row.user_id,
                  name: userData.name || userData.email,
                  email: userData.email
                };
              } catch (e) {
                console.error('Error parsing user data:', e);
              }
            });
            
            // Add creator info to comment groups
            commentGroups.forEach(group => {
              group.creator = userMap[group.user_id] || null;
            });
          }
        } catch (e) {
          console.error('Error fetching creator data:', e);
          // Continue without creator data
        }
      }
    }
    
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
 * @param {string|null} teamId - The team ID to filter by (if user is in a team)
 */
async function getCommentGroupDetail(groupId, env, userId, teamId) {
  try {
    // Get comment group details
    let groupQuery;
    let params;
    
    if (teamId) {
      // If user is in a team, first get all team member IDs
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await executeQuery(env.USERS_DB, teamMembersQuery, [teamId]);
      
      if (teamMembersResult.success && teamMembersResult.data.length > 0) {
        const memberIds = teamMembersResult.data.map(m => m.user_id);
        
        // Allow access if comment group is created by any team member OR has the team_id
        groupQuery = `
          SELECT * FROM comment_groups 
          WHERE id = ? 
          AND (user_id IN (${memberIds.map(() => '?').join(',')}) OR team_id = ?)
        `;
        params = [groupId, ...memberIds, teamId];
      } else {
        // Fallback if no members found
        groupQuery = `SELECT * FROM comment_groups WHERE id = ? AND team_id = ?`;
        params = [groupId, teamId];
      }
    } else {
      // Only allow access to user's own comment groups
      groupQuery = `SELECT * FROM comment_groups WHERE id = ? AND user_id = ?`;
      params = [groupId, userId];
    }
    
    const groupResult = await executeQuery(env.COMMENT_BOT_DB, groupQuery, params);
    
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
    
    // If user is in a team, fetch creator information
    let creatorInfo = null;
    if (teamId && commentGroup.user_id) {
      try {
        // Fetch user data from sessions in USERS_DB
        const userQuery = `
          SELECT 
            user_id,
            user_data,
            MAX(created_at) as latest_session
          FROM sessions 
          WHERE user_id = ?
          GROUP BY user_id
        `;
        
        const userResult = await executeQuery(env.USERS_DB, userQuery, [commentGroup.user_id]);
        
        if (userResult.success && userResult.data.length > 0) {
          try {
            const userData = JSON.parse(userResult.data[0].user_data);
            creatorInfo = {
              id: userResult.data[0].user_id,
              name: userData.name || userData.email,
              email: userData.email
            };
          } catch (e) {
            console.error('Error parsing user data:', e);
          }
        }
      } catch (error) {
        console.error('Error fetching creator info:', error);
      }
    }
    
    return jsonResponse({
      success: true,
      commentGroup: {
        ...commentGroup,
        legends: transformedLegends,
        creator: creatorInfo
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
 * @param {string|null} teamId - The team ID to associate with the comment group (if user is in a team)
 */
async function createCommentGroup(request, env, userId, teamId) {
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
        INSERT INTO comment_groups (user_id, team_id, name, description, legends)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const groupResult = await env.COMMENT_BOT_DB.prepare(insertGroupQuery)
        .bind(userId, teamId, groupData.name, groupData.description || null, JSON.stringify(legendsData))
        .run();
      
      const groupId = groupResult.meta.last_row_id;
      
      // Return the created group with its details
      return await getCommentGroupDetail(groupId, env, userId, teamId);
      
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
 * @param {string|null} teamId - The team ID to verify ownership (if user is in a team)
 */
async function updateCommentGroup(request, env, userId, teamId) {
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
      // Check if comment group exists and user has permission
      let checkQuery;
      let checkParams;
      
      if (teamId) {
        // If user is in a team, first get all team member IDs
        const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
        const teamMembersResult = await executeQuery(env.USERS_DB, teamMembersQuery, [teamId]);
        
        if (teamMembersResult.success && teamMembersResult.data.length > 0) {
          const memberIds = teamMembersResult.data.map(m => m.user_id);
          
          // Allow update if comment group is created by any team member OR has the team_id
          checkQuery = `
            SELECT id FROM comment_groups 
            WHERE id = ? 
            AND (user_id IN (${memberIds.map(() => '?').join(',')}) OR team_id = ?)
          `;
          checkParams = [groupId, ...memberIds, teamId];
        } else {
          // Fallback if no members found
          checkQuery = `SELECT id FROM comment_groups WHERE id = ? AND team_id = ?`;
          checkParams = [groupId, teamId];
        }
      } else {
        // Only allow update to user's own comment groups
        checkQuery = `SELECT id FROM comment_groups WHERE id = ? AND user_id = ?`;
        checkParams = [groupId, userId];
      }
      
      const checkResult = await executeQuery(env.COMMENT_BOT_DB, checkQuery, checkParams);
      
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
      return await getCommentGroupDetail(groupId, env, userId, teamId);
      
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
 * @param {string|null} teamId - The team ID to verify ownership (if user is in a team)
 */
async function deleteCommentGroup(request, env, userId, teamId) {
  try {
    // Get group ID from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const groupId = pathParts[pathParts.length - 1];
    
    if (!groupId || isNaN(groupId)) {
      return jsonResponse({ error: 'Invalid comment group ID' }, 400);
    }
    
    // Check if comment group exists and user has permission
    let checkQuery;
    let checkParams;
    
    if (teamId) {
      // If user is in a team, first get all team member IDs
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await executeQuery(env.USERS_DB, teamMembersQuery, [teamId]);
      
      if (teamMembersResult.success && teamMembersResult.data.length > 0) {
        const memberIds = teamMembersResult.data.map(m => m.user_id);
        
        // Allow delete if comment group is created by any team member OR has the team_id
        checkQuery = `
          SELECT id FROM comment_groups 
          WHERE id = ? 
          AND (user_id IN (${memberIds.map(() => '?').join(',')}) OR team_id = ?)
        `;
        checkParams = [groupId, ...memberIds, teamId];
      } else {
        // Fallback if no members found
        checkQuery = `SELECT id FROM comment_groups WHERE id = ? AND team_id = ?`;
        checkParams = [groupId, teamId];
      }
    } else {
      // Only allow delete of user's own comment groups
      checkQuery = `SELECT id FROM comment_groups WHERE id = ? AND user_id = ?`;
      checkParams = [groupId, userId];
    }
    
    const checkResult = await executeQuery(env.COMMENT_BOT_DB, checkQuery, checkParams);
    
    if (!checkResult.success || checkResult.data.length === 0) {
      return jsonResponse({ error: 'Comment group not found' }, 404);
    }
    
    // First, update any orders that reference this comment group
    // Set their comment_group_id to NULL to avoid foreign key constraint errors
    const updateOrdersQuery = `UPDATE orders SET comment_group_id = NULL WHERE comment_group_id = ?`;
    await env.COMMENT_BOT_DB.prepare(updateOrdersQuery).bind(groupId).run();
    
    // Now delete the comment group (legends are stored as JSON within the table)
    const deleteQuery = `DELETE FROM comment_groups WHERE id = ?`;
    await env.COMMENT_BOT_DB.prepare(deleteQuery).bind(groupId).run();
    
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
 * @param {string|null} teamId - The team ID to associate with the order (if user is in a team)
 */
async function createOrder(request, env, userId, teamId) {
  try {
    // Store origin for later use in jsonResponse
    if (request.headers.get('Origin')) {
      globalThis.originForCors = request.headers.get('Origin');
    }
    
    // Parse request body
    const orderData = await request.json();
    
    console.log('[CREATE ORDER] Received payload:', JSON.stringify(orderData, null, 2));
    
    const targetUserId = userId;
    const targetTeamId = teamId;
    
    // Validate required fields
    if (!orderData.post_id) {
      return jsonResponse({ error: 'TikTok post ID is required' }, 400);
    }
    
    // Validate TikTok post ID format - must be exactly 19 digits
    const postIdStr = String(orderData.post_id).trim();
    if (!/^\d{19}$/.test(postIdStr)) {
      return jsonResponse({ 
        error: 'Invalid TikTok post ID format. Must be exactly 19 digits (e.g., 7532583896517463327)' 
      }, 400);
    }
    
    // Ensure at least one interaction type is specified
    if (
      (!orderData.like_count || orderData.like_count <= 0) && 
      (!orderData.save_count || orderData.save_count <= 0) && 
      (!orderData.comment_group_id) &&
      (!orderData.comment_data)
    ) {
      return jsonResponse({ 
        error: 'At least one interaction type (like, save, or comment) must be specified' 
      }, 400);
    }
    
    // Prepare API data (use validated post ID)
    let apiData = {
      post_id: postIdStr,
      like_count: orderData.like_count || 0,
      save_count: orderData.save_count || 0
    };
    
    // If comment_data is provided directly, use it
    if (orderData.comment_data) {
      apiData.comment_data = orderData.comment_data;
      console.log('[CREATE ORDER] Using direct comment_data:', JSON.stringify(apiData.comment_data, null, 2));
    }
    // Otherwise, if comment_group_id is provided, fetch comment group details and format them
    else if (orderData.comment_group_id) {
      // Get comment group details and verify user has access
      let groupQuery;
      let groupParams;
      
      if (targetTeamId) {
        // If user is in a team, first get all team member IDs
        const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
        const teamMembersResult = await executeQuery(env.USERS_DB, teamMembersQuery, [targetTeamId]);
        
        if (teamMembersResult.success && teamMembersResult.data.length > 0) {
          const memberIds = teamMembersResult.data.map(m => m.user_id);
          
          // Allow using comment groups created by any team member OR with the team_id
          groupQuery = `
            SELECT * FROM comment_groups 
            WHERE id = ? 
            AND (user_id IN (${memberIds.map(() => '?').join(',')}) OR team_id = ?)
          `;
          groupParams = [orderData.comment_group_id, ...memberIds, targetTeamId];
        } else {
          // Fallback if no members found
          groupQuery = `SELECT * FROM comment_groups WHERE id = ? AND team_id = ?`;
          groupParams = [orderData.comment_group_id, targetTeamId];
        }
      } else {
        // Only allow using user's own comment groups
        groupQuery = `SELECT * FROM comment_groups WHERE id = ? AND user_id = ?`;
        groupParams = [orderData.comment_group_id, targetUserId];
      }
      
      const groupResult = await executeQuery(env.COMMENT_BOT_DB, groupQuery, groupParams);
      
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
      
      console.log('[DEBUG] Raw legendsData from DB:', JSON.stringify(legendsData, null, 2));
      
      // Build comment_data with legends and conversations
      const legends = legendsData.map(legend => {
        // Format conversations to match the new API structure
        const conversations = (legend.conversations || []).map((conv, index) => ({
          user: String.fromCharCode(65 + (index % 3)), // A, B, C pattern
          text: conv.comment_text || conv.text || '' // Handle both old and new field names
        }));
        
        return {
          conversations: conversations
        };
      });
      
      // Add comment_data to API payload
      apiData.comment_data = {
        legends: legends
      };
      
      console.log('[DEBUG] Final comment_data being sent:', JSON.stringify(apiData.comment_data, null, 2));
    }
    
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
            team_id,
            order_id,
            post_id,
            status,
            like_count,
            save_count,
            comment_group_id,
            message,
            api_created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const dbResult = await env.COMMENT_BOT_DB.prepare(insertOrderQuery)
          .bind(
            targetUserId,
            targetTeamId,
            createdOrder.order_id,
            createdOrder.post_id || orderData.post_id,
            createdOrder.status || 'pending',
            orderData.like_count || 0,
            orderData.save_count || 0,
            orderData.comment_group_id || null,
            createdOrder.message || null,
            createdOrder.created_at || new Date().toISOString()
          )
          .run();
      } catch (dbError) {
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
 * @param {string|null} teamId - The team ID to filter by (if user is in a team)
 */
async function getOrders(request, env, userId, teamId) {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status') || null;
    
    // Build query based on filters
    // If user is in a team, show all orders from team members
    // Otherwise, only show user's own orders
    let query;
    let params;
    
    if (teamId) {
      // First get all team member IDs
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await executeQuery(env.USERS_DB, teamMembersQuery, [teamId]);
      
      if (teamMembersResult.success && teamMembersResult.data.length > 0) {
        const memberIds = teamMembersResult.data.map(m => m.user_id);
        
        query = `
          SELECT 
            o.*,
            cg.name as comment_group_name
          FROM orders o
          LEFT JOIN comment_groups cg ON o.comment_group_id = cg.id
          WHERE o.user_id IN (${memberIds.map(() => '?').join(',')})
             OR o.team_id = ?
        `;
        params = [...memberIds, teamId];
      } else {
        // Fallback if no members found
        query = `
          SELECT 
            o.*,
            cg.name as comment_group_name
          FROM orders o
          LEFT JOIN comment_groups cg ON o.comment_group_id = cg.id
          WHERE o.team_id = ?
        `;
        params = [teamId];
      }
    } else {
      query = `
        SELECT 
          o.*,
          cg.name as comment_group_name
        FROM orders o
        LEFT JOIN comment_groups cg ON o.comment_group_id = cg.id
        WHERE o.user_id = ?
      `;
      params = [userId];
    }
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
    let countQuery = teamId 
      ? 'SELECT COUNT(*) as total FROM orders WHERE team_id = ?'
      : 'SELECT COUNT(*) as total FROM orders WHERE user_id = ?';
    const countParams = teamId ? [teamId] : [userId];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    
    const countResult = await executeQuery(env.COMMENT_BOT_DB, countQuery, countParams);
    const total = countResult.success && countResult.data.length > 0 ? countResult.data[0].total : 0;
    
    // Get the orders
    let orders = result.data;
    
    // If this is a team query, fetch creator information from USERS_DB
    if (teamId && orders.length > 0) {
      // Get unique user IDs
      const userIds = [...new Set(orders.map(o => o.user_id).filter(id => id))];
      
      if (userIds.length > 0) {
        try {
          // Fetch user data from sessions in USERS_DB
          // We look for any session (even expired) to get user info
          const userQuery = `
            SELECT 
              user_id,
              user_data,
              MAX(created_at) as latest_session
            FROM sessions 
            WHERE user_id IN (${userIds.map(() => '?').join(',')})
            GROUP BY user_id
          `;
          
          const userResult = await executeQuery(env.USERS_DB, userQuery, userIds);
          
          if (userResult.success) {
            // Create a map of user data
            const userMap = {};
            userResult.data.forEach(row => {
              try {
                const userData = JSON.parse(row.user_data);
                userMap[row.user_id] = {
                  id: row.user_id,
                  name: userData.name || userData.email,
                  email: userData.email
                };
              } catch (e) {
                console.error('Error parsing user data:', e);
              }
            });
            
            // Add creator info to orders
            orders = orders.map(order => ({
              ...order,
              creator: userMap[order.user_id] || null
            }));
          }
        } catch (e) {
          console.error('Error fetching creator data:', e);
          // Continue without creator data
        }
      }
    }
    
    // Fetch saved progress data for these orders
    let orderProgress = {};
    if (orders.length > 0) {
      const orderIds = orders.map(o => o.order_id);
      const progressQuery = `
        SELECT order_id, progress_data 
        FROM order_progress 
        WHERE order_id IN (${orderIds.map(() => '?').join(',')})
      `;
      
      try {
        const progressResult = await executeQuery(env.COMMENT_BOT_DB, progressQuery, orderIds);
        if (progressResult.success) {
          progressResult.data.forEach(row => {
            try {
              orderProgress[row.order_id] = JSON.parse(row.progress_data);
            } catch (e) {
              console.error('Error parsing progress data:', e);
            }
          });
        }
      } catch (e) {
        console.error('Error fetching saved progress:', e);
        // Continue without saved progress data
      }
    }
    
    return jsonResponse({
      success: true,
      orders: orders,
      orderProgress: orderProgress,
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
 * @param {string|null} teamId - The team ID to verify ownership (if user is in a team)
 */
async function getOrderStatus(orderId, env = null, userId = null, teamId = null) {
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
      const orderQuery = teamId ? `
        SELECT 
          o.*,
          cg.name as comment_group_name
        FROM orders o
        LEFT JOIN comment_groups cg ON o.comment_group_id = cg.id
        WHERE o.order_id = ? AND o.team_id = ?
      ` : `
        SELECT 
          o.*,
          cg.name as comment_group_name
        FROM orders o
        LEFT JOIN comment_groups cg ON o.comment_group_id = cg.id
        WHERE o.order_id = ? AND o.user_id = ?
      `;
      
      const params = teamId ? [orderId, teamId] : [orderId, userId];
      const result = await executeQuery(env.COMMENT_BOT_DB, orderQuery, params);
      
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

/**
 * Get Comment Bot logs for admin users
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 */
async function getCommentBotLogs(request, env) {
  try {
    // Initialize tables if needed
    await initializeCommentGroupTables(env);
    
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    // Allow limit up to 1000, default to 50
    let limit = parseInt(url.searchParams.get('limit') || '50');
    limit = Math.min(limit, 1000); // Cap at 1000
    const search = url.searchParams.get('search') || '';
    const statusFilter = url.searchParams.get('status') || '';
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';
    const offset = (page - 1) * limit;
    
    // Build query conditions
    let whereConditions = [];
    let params = [];
    
    if (search) {
      whereConditions.push(`(o.order_id LIKE ? OR o.post_id LIKE ? OR o.user_id LIKE ?)`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    // Note: We don't filter by status in the SQL query anymore since we compute 
    // the actual status from progress data. We'll filter after processing.
    
    if (startDate) {
      whereConditions.push('o.created_at >= ?');
      params.push(startDate + ' 00:00:00');
    }
    
    if (endDate) {
      whereConditions.push('o.created_at <= ?');
      params.push(endDate + ' 23:59:59');
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM orders o
      LEFT JOIN comment_groups cg ON o.comment_group_id = cg.id
      ${whereClause}
    `;
    
    const countResult = await executeQuery(env.COMMENT_BOT_DB, countQuery, params);
    let total = countResult.success && countResult.data.length > 0 ? countResult.data[0].total : 0;
    
    // Get logs - if filtering by status or dates, we need to get all records first,
    // then filter/paginate after computing actual status
    let logsQuery;
    if ((statusFilter && statusFilter !== 'all') || startDate || endDate) {
      // Get all records matching filters (no pagination yet for date/status filtering)
      logsQuery = `
        SELECT 
          o.*,
          cg.name as comment_group_name,
          op.progress_data
        FROM orders o
        LEFT JOIN comment_groups cg ON o.comment_group_id = cg.id
        LEFT JOIN order_progress op ON o.order_id = op.order_id
        ${whereClause}
        ORDER BY o.created_at DESC
      `;
    } else {
      // Normal paginated query when not filtering by status or dates
      logsQuery = `
        SELECT 
          o.*,
          cg.name as comment_group_name,
          op.progress_data
        FROM orders o
        LEFT JOIN comment_groups cg ON o.comment_group_id = cg.id
        LEFT JOIN order_progress op ON o.order_id = op.order_id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `;
      params.push(limit, offset);
    }
    
    const logsResult = await executeQuery(env.COMMENT_BOT_DB, logsQuery, params);
    
    // Process logs to compute actual status and add user emails
    if (logsResult.success && logsResult.data.length > 0) {
      // First, identify orders without progress data
      const ordersWithoutProgress = logsResult.data.filter(log => 
        log.status === 'completed' && !log.progress_data
      );
      
      // Fetch progress data from API for orders that don't have it
      if (ordersWithoutProgress.length > 0) {
        console.log(`Found ${ordersWithoutProgress.length} orders without progress data, fetching from API...`);
        
        // Process in batches of 5 to avoid overwhelming the API
        const batchSize = 5;
        for (let i = 0; i < ordersWithoutProgress.length; i += batchSize) {
          const batch = ordersWithoutProgress.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (log) => {
            try {
              // Fetch status from API
              const orderStatus = await fetchAPI(`/api/orders/${log.order_id}/status`);
              
              if (orderStatus && orderStatus.progress) {
                // Save progress to database
                const progressData = JSON.stringify(orderStatus.progress);
                const saveProgressQuery = `
                  INSERT INTO order_progress (order_id, progress_data, saved_at)
                  VALUES (?, ?, datetime('now'))
                  ON CONFLICT(order_id) DO UPDATE SET
                    progress_data = excluded.progress_data,
                    saved_at = excluded.saved_at
                `;
                
                try {
                  await env.COMMENT_BOT_DB.prepare(saveProgressQuery)
                    .bind(log.order_id, progressData)
                    .run();
                  
                  // Add progress data to the log object
                  log.progress_data = progressData;
                  console.log(`Saved progress data for order ${log.order_id}`);
                } catch (saveError) {
                  console.error(`Error saving progress for order ${log.order_id}:`, saveError);
                }
              }
            } catch (apiError) {
              console.error(`Error fetching progress for order ${log.order_id}:`, apiError);
            }
          }));
        }
      }
      
      // Get user emails from USERS_DB
      const userIds = [...new Set(logsResult.data.map(log => log.user_id))];
      const userEmailsQuery = `
        SELECT user_id, user_email
        FROM team_members
        WHERE user_id IN (${userIds.map(() => '?').join(',')})
      `;
      
      const userEmailsResult = await executeQuery(env.USERS_DB, userEmailsQuery, userIds);
      const userEmailMap = {};
      
      if (userEmailsResult.success) {
        userEmailsResult.data.forEach(user => {
          userEmailMap[user.user_id] = user.user_email;
        });
      }
      
      // Process each log to add user email and compute actual status
      logsResult.data.forEach(log => {
        log.user_email = userEmailMap[log.user_id] || null;
        
        // Compute actual status from progress data if available
        if (log.status === 'completed' && log.progress_data) {
          try {
            const progress = JSON.parse(log.progress_data);
            
            // Calculate totals across all interaction types
            let totalRequested = 0;
            let totalCompleted = 0;
            let totalFailed = 0;
            
            ['like', 'save', 'comment'].forEach(type => {
              if (progress[type] && progress[type].total > 0) {
                totalRequested += progress[type].total || 0;
                totalCompleted += progress[type].completed || 0;
                totalFailed += progress[type].failed || 0;
              }
            });
            
            // Determine actual status based on progress
            if (totalRequested > 0) {
              if (totalCompleted === 0 && totalFailed > 0) {
                // Everything failed
                log.status = 'failed';
              } else if (totalFailed > 0 && totalCompleted > 0) {
                // Mixed results - keep as completed but could show partial in UI
                log.status = 'completed';
                log.partial_failure = true;
                log.success_rate = Math.round((totalCompleted / totalRequested) * 100);
              }
              // else keep as completed (all successful)
            }
          } catch (e) {
            // If we can't parse progress, keep original status
            console.error('Error parsing progress data for order', log.order_id, e);
          }
        }
        
        // Remove progress_data from response to reduce payload size
        delete log.progress_data;
      });
      
      // Filter by status if specified (after computing actual status)
      if (statusFilter && statusFilter !== 'all') {
        logsResult.data = logsResult.data.filter(log => log.status === statusFilter);
      }
      
      // If we fetched all records (for status or date filtering), apply pagination now
      if ((statusFilter && statusFilter !== 'all') || startDate || endDate) {
        // Update total for proper pagination
        total = logsResult.data.length;
        // Apply pagination to results
        const start = offset;
        const end = offset + limit;
        logsResult.data = logsResult.data.slice(start, end);
      }
    }
    
    
    // Get basic stats from orders table
    const statsQuery = `
      SELECT 
        COUNT(*) as totalOrders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completedOrders,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failedOrders,
        COUNT(CASE WHEN status IN ('processing', 'pending') THEN 1 END) as activeOrders
      FROM orders
    `;
    
    const statsResult = await executeQuery(env.COMMENT_BOT_DB, statsQuery, []);
    let stats = statsResult.success && statsResult.data.length > 0 ? statsResult.data[0] : {
      totalOrders: 0,
      completedOrders: 0,
      failedOrders: 0,
      activeOrders: 0
    };
    
    // For completed orders, check progress data to identify actual failures
    // This is needed because legacy orders may have been marked as 'completed' even when failed
    if (stats.completedOrders > 0) {
      const progressCheckQuery = `
        SELECT 
          o.order_id,
          o.status,
          op.progress_data
        FROM orders o
        LEFT JOIN order_progress op ON o.order_id = op.order_id
        WHERE o.status = 'completed'
      `;
      
      const progressResult = await executeQuery(env.COMMENT_BOT_DB, progressCheckQuery, []);
      
      if (progressResult.success && progressResult.data.length > 0) {
        let actualFailed = 0;
        let actualCompleted = 0;
        
        for (const order of progressResult.data) {
          if (order.progress_data) {
            try {
              const progress = JSON.parse(order.progress_data);
              
              // Calculate totals across all interaction types
              let totalRequested = 0;
              let totalCompleted = 0;
              let totalFailed = 0;
              
              ['like', 'save', 'comment'].forEach(type => {
                if (progress[type] && progress[type].total > 0) {
                  totalRequested += progress[type].total || 0;
                  totalCompleted += progress[type].completed || 0;
                  totalFailed += progress[type].failed || 0;
                }
              });
              
              // Determine if this order actually failed
              if (totalRequested > 0 && totalCompleted === 0 && totalFailed > 0) {
                actualFailed++;
              } else {
                actualCompleted++;
              }
            } catch (e) {
              // If we can't parse progress, count as completed
              actualCompleted++;
            }
          } else {
            // No progress data, count as completed
            actualCompleted++;
          }
        }
        
        // Update stats with actual values
        stats.completedOrders = actualCompleted;
        stats.failedOrders = stats.failedOrders + actualFailed;
      }
    }
    
    return jsonResponse({
      success: true,
      logs: logsResult.success ? logsResult.data : [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats
    });
  } catch (error) {
    console.error('Error fetching comment bot logs:', error);
    console.error('Error stack:', error.stack);
    return jsonResponse({ 
      error: 'Failed to fetch logs', 
      details: error.message,
      stack: error.stack
    }, 500);
  }
}

/**
 * Export Comment Bot logs as CSV for admin users
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 */
async function exportCommentBotLogs(request, env) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search') || '';
    const statusFilter = url.searchParams.get('status') || '';
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';
    
    // Build query conditions
    let whereConditions = [];
    let params = [];
    
    if (search) {
      whereConditions.push(`(o.order_id LIKE ? OR o.post_id LIKE ? OR o.user_id LIKE ?)`);
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    // Note: We don't filter by status in the SQL query anymore since we compute 
    // the actual status from progress data. We'll filter after processing.
    
    if (startDate) {
      whereConditions.push('o.created_at >= ?');
      params.push(startDate + ' 00:00:00');
    }
    
    if (endDate) {
      whereConditions.push('o.created_at <= ?');
      params.push(endDate + ' 23:59:59');
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Get all logs for export, including progress data
    const logsQuery = `
      SELECT 
        o.*,
        cg.name as comment_group_name,
        op.progress_data
      FROM orders o
      LEFT JOIN comment_groups cg ON o.comment_group_id = cg.id
      LEFT JOIN order_progress op ON o.order_id = op.order_id
      ${whereClause}
      ORDER BY o.created_at DESC
    `;
    
    const logsResult = await executeQuery(env.COMMENT_BOT_DB, logsQuery, params);
    
    if (!logsResult.success || logsResult.data.length === 0) {
      return jsonResponse({ error: 'No logs found to export' }, 404);
    }
    
    // First, identify orders without progress data
    const ordersWithoutProgress = logsResult.data.filter(log => 
      log.status === 'completed' && !log.progress_data
    );
    
    // Fetch progress data from API for orders that don't have it
    if (ordersWithoutProgress.length > 0) {
      console.log(`Export: Found ${ordersWithoutProgress.length} orders without progress data, fetching from API...`);
      
      // Process in batches of 5 to avoid overwhelming the API
      const batchSize = 5;
      for (let i = 0; i < ordersWithoutProgress.length; i += batchSize) {
        const batch = ordersWithoutProgress.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (log) => {
          try {
            // Fetch status from API
            const orderStatus = await fetchAPI(`/api/orders/${log.order_id}/status`);
            
            if (orderStatus && orderStatus.progress) {
              // Save progress to database
              const progressData = JSON.stringify(orderStatus.progress);
              const saveProgressQuery = `
                INSERT INTO order_progress (order_id, progress_data, saved_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(order_id) DO UPDATE SET
                  progress_data = excluded.progress_data,
                  saved_at = excluded.saved_at
              `;
              
              try {
                await env.COMMENT_BOT_DB.prepare(saveProgressQuery)
                  .bind(log.order_id, progressData)
                  .run();
                
                // Add progress data to the log object
                log.progress_data = progressData;
                console.log(`Export: Saved progress data for order ${log.order_id}`);
              } catch (saveError) {
                console.error(`Export: Error saving progress for order ${log.order_id}:`, saveError);
              }
            }
          } catch (apiError) {
            console.error(`Export: Error fetching progress for order ${log.order_id}:`, apiError);
          }
        }));
      }
    }
    
    // Get user emails from USERS_DB for the logs
    const userIds = [...new Set(logsResult.data.map(log => log.user_id))];
    const userEmailsQuery = `
      SELECT user_id, user_email
      FROM team_members
      WHERE user_id IN (${userIds.map(() => '?').join(',')})
    `;
    
    const userEmailsResult = await executeQuery(env.USERS_DB, userEmailsQuery, userIds);
    const userEmailMap = {};
    
    if (userEmailsResult.success) {
      userEmailsResult.data.forEach(user => {
        userEmailMap[user.user_id] = user.user_email;
      });
    }
    
    // Process logs to add user emails and compute actual status
    logsResult.data.forEach(log => {
      log.user_identifier = userEmailMap[log.user_id] || log.user_id;
      
      // Compute actual status from progress data if available
      if (log.status === 'completed' && log.progress_data) {
        try {
          const progress = JSON.parse(log.progress_data);
          
          // Calculate totals across all interaction types
          let totalRequested = 0;
          let totalCompleted = 0;
          let totalFailed = 0;
          
          ['like', 'save', 'comment'].forEach(type => {
            if (progress[type] && progress[type].total > 0) {
              totalRequested += progress[type].total || 0;
              totalCompleted += progress[type].completed || 0;
              totalFailed += progress[type].failed || 0;
            }
          });
          
          // Determine actual status based on progress
          if (totalRequested > 0) {
            if (totalCompleted === 0 && totalFailed > 0) {
              // Everything failed
              log.status = 'failed';
            } else if (totalFailed > 0 && totalCompleted > 0) {
              // Mixed results - show with success rate
              log.status = `completed (${Math.round((totalCompleted / totalRequested) * 100)}% success)`;
            }
            // else keep as completed (all successful)
          }
        } catch (e) {
          // If we can't parse progress, keep original status
        }
      }
      
      // Remove progress_data from CSV export
      delete log.progress_data;
    });
    
    // Filter by status if specified
    if (statusFilter && statusFilter !== 'all') {
      // For filtering, check if status matches (handling partial success statuses)
      logsResult.data = logsResult.data.filter(log => {
        if (statusFilter === 'failed') {
          return log.status === 'failed';
        } else if (statusFilter === 'completed') {
          return log.status === 'completed' || log.status.includes('completed');
        } else {
          return log.status === statusFilter;
        }
      });
      
      if (logsResult.data.length === 0) {
        return jsonResponse({ error: 'No logs found matching the filter criteria' }, 404);
      }
    }
    
    // Generate CSV
    const csvHeaders = [
      'Created At',
      'Order ID',
      'Post ID',
      'User',
      'Team ID',
      'Status',
      'Like Count',
      'Save Count',
      'Comment Group',
      'Message'
    ];
    
    const csvRows = [csvHeaders.join(',')];
    
    for (const log of logsResult.data) {
      const row = [
        log.created_at,
        log.order_id,
        log.post_id,
        log.user_identifier,
        log.team_id || '',
        log.status,
        log.like_count || 0,
        log.save_count || 0,
        log.comment_group_name || '',
        log.message ? `"${log.message.replace(/"/g, '""')}"` : ''
      ];
      csvRows.push(row.join(','));
    }
    
    const csv = csvRows.join('\n');
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="commentbot-logs-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting comment bot logs:', error);
    return jsonResponse({ 
      error: 'Failed to export logs', 
      details: error.message 
    }, 500);
  }
}

/**
 * Create an order using the queue system
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID
 * @param {string|null} teamId - The team ID
 */
async function createOrderWithQueue(request, env, userId, teamId) {
  
  try {
    // Parse request body
    const orderData = await request.json();
    
    // Validate required fields
    if (!orderData.post_id) {
      return jsonResponse({ error: 'TikTok post ID is required' }, 400);
    }
    
    // Validate TikTok post ID format
    const postIdStr = String(orderData.post_id).trim();
    if (!/^\d{19}$/.test(postIdStr)) {
      return jsonResponse({ 
        error: 'Invalid TikTok post ID format. Must be exactly 19 digits' 
      }, 400);
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
    
    // Prepare comment data if comment group is selected
    let commentData = null;
    if (orderData.comment_group_id) {
      // Get comment group details
      let groupQuery;
      let groupParams;
      
      if (teamId) {
        const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
        const teamMembersResult = await executeQuery(env.USERS_DB, teamMembersQuery, [teamId]);
        
        if (teamMembersResult.success && teamMembersResult.data.length > 0) {
          const memberIds = teamMembersResult.data.map(m => m.user_id);
          groupQuery = `
            SELECT * FROM comment_groups 
            WHERE id = ? 
            AND (user_id IN (${memberIds.map(() => '?').join(',')}) OR team_id = ?)
          `;
          groupParams = [orderData.comment_group_id, ...memberIds, teamId];
        } else {
          groupQuery = `SELECT * FROM comment_groups WHERE id = ? AND team_id = ?`;
          groupParams = [orderData.comment_group_id, teamId];
        }
      } else {
        groupQuery = `SELECT * FROM comment_groups WHERE id = ? AND user_id = ?`;
        groupParams = [orderData.comment_group_id, userId];
      }
      
      const groupResult = await executeQuery(env.COMMENT_BOT_DB, groupQuery, groupParams);
      
      if (!groupResult.success || groupResult.data.length === 0) {
        return jsonResponse({ error: 'Comment group not found' }, 404);
      }
      
      const commentGroup = groupResult.data[0];
      
      // Parse legends and format for API
      let legendsData = [];
      try {
        legendsData = JSON.parse(commentGroup.legends || '[]');
      } catch (e) {
        console.error('Error parsing legends JSON:', e);
      }
      
      // Build comment_data
      const legends = legendsData.map(legend => {
        const conversations = (legend.conversations || []).map((conv, index) => ({
          user: String.fromCharCode(65 + (index % 3)), // A, B, C pattern
          text: conv.comment_text
        }));
        
        return {
          conversations: conversations
        };
      });
      
      commentData = {
        legends: legends
      };
    }
    
    // Create a job in the queue
    const job = await createJob(env, {
      userId: userId,
      teamId: teamId,
      type: 'create_order',
      payload: {
        post_id: postIdStr,
        like_count: orderData.like_count || 0,
        save_count: orderData.save_count || 0,
        comment_group_id: orderData.comment_group_id || null,
        comment_data: commentData,
        save_to_db: true
      },
      priority: orderData.priority || 0
    });
    
    
    const response = {
      success: true,
      job: {
        job_id: job.job_id,
        status: job.status,
        queue_position: job.queue_position,
        estimated_completion_time: job.estimatedCompletionTime
      },
      message: 'Order has been queued for processing'
    };
    
    
    return jsonResponse(response);
  } catch (error) {
    console.error('Error creating order with queue:', error);
    return jsonResponse({ 
      error: 'Failed to queue order', 
      details: error.message 
    }, 500);
  }
}

/**
 * Get jobs for the user
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID
 * @param {string|null} teamId - The team ID
 */
async function getJobs(request, env, userId, teamId) {
  
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status') || null;
    
    
    const filters = {
      limit,
      offset,
      status
    };
    
    const jobs = await getUserJobs(env, userId, teamId, filters);
    
    return jsonResponse({
      success: true,
      jobs: jobs,
      pagination: {
        limit,
        offset,
        total: jobs.length
      }
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return jsonResponse({ 
      error: 'Failed to fetch jobs', 
      details: error.message 
    }, 500);
  }
}

/**
 * Get job status
 * @param {string} jobId - Job ID
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID
 * @param {string|null} teamId - The team ID
 */
async function getJobStatus(jobId, env, userId, teamId) {
  try {
    const job = await getJob(env, jobId, userId, teamId);
    
    if (!job) {
      return jsonResponse({ error: 'Job not found' }, 404);
    }
    
    return jsonResponse({
      success: true,
      job: job
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    return jsonResponse({ 
      error: 'Failed to fetch job status', 
      details: error.message 
    }, 500);
  }
}

/**
 * Get job logs
 * @param {string} jobId - Job ID
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID
 * @param {string|null} teamId - The team ID
 */
async function getJobLogsEndpoint(jobId, env, userId, teamId) {
  try {
    // Verify job ownership
    const job = await getJob(env, jobId, userId, teamId);
    
    if (!job) {
      return jsonResponse({ error: 'Job not found' }, 404);
    }
    
    const logs = await getJobLogs(env, jobId);
    
    return jsonResponse({
      success: true,
      logs: logs
    });
  } catch (error) {
    console.error('Error fetching job logs:', error);
    return jsonResponse({ 
      error: 'Failed to fetch job logs', 
      details: error.message 
    }, 500);
  }
}

/**
 * Cancel a job
 * @param {string} jobId - Job ID
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID
 * @param {string|null} teamId - The team ID
 */
async function cancelJobEndpoint(jobId, env, userId, teamId) {
  try {
    const cancelled = await cancelJob(env, jobId, userId, teamId);
    
    if (!cancelled) {
      return jsonResponse({ error: 'Unable to cancel job' }, 400);
    }
    
    return jsonResponse({
      success: true,
      message: 'Job cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    return jsonResponse({ 
      error: 'Failed to cancel job', 
      details: error.message 
    }, 500);
  }
}

/**
 * Create a generic job
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @param {string} userId - The user ID
 * @param {string|null} teamId - The team ID
 */
async function createJobEndpoint(request, env, userId, teamId) {
  try {
    const jobData = await request.json();
    
    if (!jobData.type) {
      return jsonResponse({ error: 'Job type is required' }, 400);
    }
    
    if (!jobData.payload) {
      return jsonResponse({ error: 'Job payload is required' }, 400);
    }
    
    const job = await createJob(env, {
      userId: userId,
      teamId: teamId,
      type: jobData.type,
      payload: jobData.payload,
      priority: jobData.priority || 0,
      maxAttempts: jobData.maxAttempts || 3
    });
    
    return jsonResponse({
      success: true,
      job: job
    });
  } catch (error) {
    console.error('Error creating job:', error);
    return jsonResponse({ 
      error: 'Failed to create job', 
      details: error.message 
    }, 500);
  }
}

/**
 * Get queue statistics
 * @param {Object} env - Environment bindings
 */
async function getQueueStatsEndpoint(env) {
  try {
    const stats = await getQueueStats(env);
    
    return jsonResponse({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    return jsonResponse({ 
      error: 'Failed to fetch queue stats', 
      details: error.message 
    }, 500);
  }
}