// Auth.js - OAuth authentication system for Cloudflare Workers
import { executeQuery } from '../SQL/SQL.js';

// Hard-coded admin users who bypass payment requirements (using emails)
const ADMIN_EMAILS = [
  'justin.m.lee.dev@gmail.com', 
  'cranapplellc@gmail.com',
  'vl@black.com',
  'sackjulisa@gmail.com',
  'alexuvaro00@gmail.com',
  'kevinpuxingzhou@gmail.com'
]; // Update these with actual admin emails

// Pricing constants (price per credit)
const COMMENT_BOT_CREDIT_PRICE = 3.00; // $2 per credit
const BC_GEN_CREDIT_PRICE = 2.00; // $2 per credit
const VIRTUAL_ASSISTANT_CREDIT_PRICE = 50.00; // $50 per credit

// Helper function to check if a user is an admin by email
function isAdminUser(userEmail) {
  return ADMIN_EMAILS.includes(userEmail);
}

/**
 * Initialize authentication tables in D1 database
 * @param {Object} env - Environment bindings with DB
 */
async function initializeAuthTables(env) {
  try {
    // Create sessions table in USERS_DB
    await env.USERS_DB.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        user_data TEXT NOT NULL,
        state VARCHAR(255),
        access_token TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Create indices for better performance
    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at 
      ON sessions(expires_at)
    `).run();
    
    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id 
      ON sessions(user_id)
    `).run();
    
    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sessions_created_at 
      ON sessions(created_at)
    `).run();
    
    // Create virtual assistants table without foreign key constraint
    await env.USERS_DB.prepare(`
      CREATE TABLE IF NOT EXISTS virtual_assistants (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        has_comment_bot_access BOOLEAN DEFAULT 0,
        has_dashboard_access BOOLEAN DEFAULT 0,
        has_bc_gen_access BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `).run();
    
    // Create indices for virtual assistants
    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_virtual_assistants_user_id 
      ON virtual_assistants(user_id)
    `).run();
    
    await env.USERS_DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_virtual_assistants_expires_at 
      ON virtual_assistants(expires_at)
    `).run();
    
    // Migrate existing virtual assistants to add role columns if they don't exist
    await migrateVirtualAssistantsRoles(env);
    
    return true;
  } catch (error) {
    console.error('Error initializing auth tables:', error);
    return false;
  }
}

// Migrate virtual assistants table to add role columns
async function migrateVirtualAssistantsRoles(env) {
  try {
    // Check if role columns exist by trying to query them
    const testQuery = `
      SELECT has_comment_bot_access, has_dashboard_access, has_bc_gen_access 
      FROM virtual_assistants 
      LIMIT 1
    `;
    
    try {
      await env.USERS_DB.prepare(testQuery).first();
      // Columns exist, no migration needed
      return;
    } catch (error) {
      // Columns don't exist, need to add them
      console.log('Migrating virtual_assistants table to add role columns...');
      
      // Add has_comment_bot_access column with default true for backward compatibility
      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants 
          ADD COLUMN has_comment_bot_access BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
        // Column might already exist
      }
      
      // Add has_dashboard_access column with default true for backward compatibility
      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants 
          ADD COLUMN has_dashboard_access BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
        // Column might already exist
      }
      
      // Add has_bc_gen_access column with default true for backward compatibility
      try {
        await env.USERS_DB.prepare(`
          ALTER TABLE virtual_assistants 
          ADD COLUMN has_bc_gen_access BOOLEAN DEFAULT 1
        `).run();
      } catch (e) {
        // Column might already exist
      }
      
      // Update existing records to have full access for backward compatibility
      await env.USERS_DB.prepare(`
        UPDATE virtual_assistants 
        SET has_comment_bot_access = 1,
            has_dashboard_access = 1,
            has_bc_gen_access = 1
        WHERE has_comment_bot_access IS NULL 
           OR has_dashboard_access IS NULL 
           OR has_bc_gen_access IS NULL
      `).run();
      
      console.log('Virtual assistants migration completed successfully');
    }
  } catch (error) {
    console.error('Error during virtual assistants migration:', error);
    // Non-critical error, continue
  }
}

// Generate random string for OAuth state
function generateRandomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate session ID
function generateSessionId() {
  return `sess_${generateRandomString(32)}`;
}

/**
 * Fetch all memberships with pagination support
 * @param {string} accessToken - The user's access token
 * @param {number} perPage - Number of items per page (default 10, max 123 based on API docs)
 * @returns {Promise<Array>} - All memberships combined from all pages
 */
async function fetchAllMemberships(accessToken, perPage = 100) {
  let allMemberships = [];
  let currentPage = 1;
  let hasMorePages = true;
  
  while (hasMorePages) {
    try {
      const url = `https://api.whop.com/api/v5/me/memberships?page=${currentPage}&per=${perPage}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch memberships page ${currentPage}:`, response.status);
        break;
      }
      
      const data = await response.json();
      
      if (data.data && Array.isArray(data.data)) {
        allMemberships = allMemberships.concat(data.data);
      }
      
      // Check pagination info
      if (data.pagination) {
        const { current_page, total_pages, next_page } = data.pagination;
        hasMorePages = current_page < total_pages && next_page !== null;
        currentPage = next_page || currentPage + 1;
      } else {
        // If no pagination info, assume no more pages
        hasMorePages = false;
      }
      
      // Safety check to prevent infinite loops
      if (currentPage > 100) {
        console.warn('Reached maximum page limit (100), stopping pagination');
        break;
      }
    } catch (error) {
      console.error(`Error fetching memberships page ${currentPage}:`, error);
      break;
    }
  }
  
  return allMemberships;
}

// Get session from database
async function getSession(db, sessionId) {
  const query = 'SELECT * FROM sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP';
  const result = await executeQuery(db, query, [sessionId]);
  
  if (result.success && result.data.length > 0) {
    const session = result.data[0];
    session.user = JSON.parse(session.user_data);
    return session;
  }
  return null;
}

// Create or update session
async function setSession(db, sessionId, data, expiresIn = 24 * 60 * 60 * 1000) {
  const expiresAt = new Date(Date.now() + expiresIn).toISOString();
  const userData = JSON.stringify(data.user || {});
  
  const query = `
    INSERT INTO sessions (session_id, user_id, user_data, state, access_token, expires_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(session_id) DO UPDATE SET
      user_id = excluded.user_id,
      user_data = excluded.user_data,
      state = excluded.state,
      access_token = excluded.access_token,
      expires_at = excluded.expires_at,
      updated_at = CURRENT_TIMESTAMP
  `;
  
  const params = [
    sessionId,
    data.user?.id || '',
    userData,
    data.state || null,
    data.accessToken || null,
    expiresAt
  ];
  
  return await executeQuery(db, query, params);
}

// Delete session
async function deleteSession(db, sessionId) {
  const query = 'DELETE FROM sessions WHERE session_id = ?';
  return await executeQuery(db, query, [sessionId]);
}

// Clean expired sessions
async function cleanExpiredSessions(db) {
  const query = 'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP';
  return await executeQuery(db, query);
}

// Get session ID from cookie
function getSessionIdFromCookie(request) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  
  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

// Create session cookie
function createSessionCookie(sessionId, secure = false) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
  return `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}${secure ? '; Secure' : ''}`;
}

// OAuth signin handler
async function handleSignin(request, env) {
  // Check if required environment variables are set
  if (!env.WHOP_OAUTH_CLIENT_ID || !env.WHOP_OAUTH_CLIENT_SECRET) {
    console.error('Missing required environment variables:', {
      hasClientId: !!env.WHOP_OAUTH_CLIENT_ID,
      hasClientSecret: !!env.WHOP_OAUTH_CLIENT_SECRET,
      hasNextAuthUrl: !!env.NEXTAUTH_URL
    });
    return new Response(JSON.stringify({ error: 'Configuration error: Missing OAuth credentials' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if there's an existing session
  let sessionId = getSessionIdFromCookie(request);
  let existingSession = null;
  
  if (sessionId) {
    existingSession = await getSession(env.USERS_DB, sessionId);
  }
  
  // Generate new session if no valid existing session
  if (!existingSession) {
    sessionId = generateSessionId();
  }
  
  const state = generateRandomString();
  
  // Store state in session for CSRF protection
  await setSession(env.USERS_DB, sessionId, { state });
  
  // Include session ID in state for callback (as backup if cookie doesn't work)
  const stateWithSession = `${state}.${sessionId}`;
  
  // Determine the correct redirect URI based on the request origin
  const url = new URL(request.url);
  const origin = request.headers.get('origin') || `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/auth/callback/whop`;
  
  console.log('OAuth redirect URI:', {
    origin: origin,
    redirectUri: redirectUri,
    envUrl: env.NEXTAUTH_URL
  });
  
  // Build OAuth authorization URL with frontend callback
  const params = new URLSearchParams({
    client_id: env.WHOP_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid',
    state: stateWithSession
  });
  
  const authUrl = `https://whop.com/oauth?${params.toString()}`;
  
  console.log('OAuth signin:', {
    sessionId: sessionId,
    state: state,
    stateWithSession: stateWithSession,
    isNewSession: !existingSession
  });
  
  // Return the auth URL as JSON instead of redirecting
  return new Response(JSON.stringify({ authUrl }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': createSessionCookie(sessionId, env.NODE_ENV === 'production')
    }
  });
}

// OAuth callback handler
async function handleCallback(request, env) {
  let code, stateParam;
  
  // Handle both GET (from OAuth provider) and POST (from frontend)
  if (request.method === 'GET') {
    const url = new URL(request.url);
    code = url.searchParams.get('code');
    stateParam = url.searchParams.get('state');
  } else if (request.method === 'POST') {
    const body = await request.json();
    code = body.code;
    stateParam = body.state;
  } else {
    return new Response('Method not allowed', { status: 405 });
  }
  
  if (!code || !stateParam) {
    console.error('Missing parameters:', { hasCode: !!code, hasState: !!stateParam });
    return new Response('Missing required parameters', { status: 400 });
  }
  
  // Extract state and session ID from state parameter
  const [state, sessionIdFromState] = stateParam.split('.');
  let sessionId = getSessionIdFromCookie(request) || sessionIdFromState;
  
  // console.log('Callback received:', { 
  //   method: request.method,
  //   code: code?.substring(0, 10), 
  //   state, 
  //   sessionIdFromCookie: getSessionIdFromCookie(request),
  //   sessionIdFromState,
  //   finalSessionId: sessionId 
  // });
  
  if (!sessionId) {
    console.error('No session ID found in cookie or state');
    return new Response('Session not found', { status: 400 });
  }
  
  // Verify state parameter
  const session = await getSession(env.USERS_DB, sessionId);
  console.log('Session validation:', { 
    sessionExists: !!session, 
    sessionState: session?.state, 
    receivedState: state,
    sessionId: sessionId,
    method: request.method
  });
  
  if (!session || session.state !== state) {
    console.error('State mismatch:', { 
      sessionState: session?.state, 
      receivedState: state,
      sessionId: sessionId,
      sessionExists: !!session
    });
    return new Response('Invalid state parameter', { status: 400 });
  }
  
  try {
    // Determine the correct redirect URI based on the request
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || `${url.protocol}//${url.host}`;
    const redirectUri = `${origin}/auth/callback/whop`;
    
    console.log('Token exchange:', {
      redirectUri: redirectUri,
      origin: origin,
      method: request.method
    });
    
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    });
    
    // Create authorization header
    const authString = `${env.WHOP_OAUTH_CLIENT_ID}:${env.WHOP_OAUTH_CLIENT_SECRET}`;
    const authHeader = 'Basic ' + btoa(authString);
    console.log(authHeader);
    // console.log('Token exchange request:', {
    //   url: 'https://api.whop.com/api/v5/oauth/token',
    //   redirectUri: `${env.NEXTAUTH_URL}/auth/callback/whop`,
    //   hasClientId: !!env.WHOP_OAUTH_CLIENT_ID,
    //   hasClientSecret: !!env.WHOP_OAUTH_CLIENT_SECRET,
    //   clientIdLength: env.WHOP_OAUTH_CLIENT_ID?.length,
    //   body: tokenParams.toString()
    // });
    
    const tokenResponse = await fetch('https://api.whop.com/api/v5/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': authHeader
      },
      body: tokenParams.toString()
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return new Response('Authentication failed', { status: 401 });
    }
    
    const tokens = await tokenResponse.json();
    
    // Fetch user info
    const userResponse = await fetch('https://api.whop.com/api/v5/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });
    
    if (!userResponse.ok) {
      console.error('Failed to fetch user info');
      return new Response('Failed to fetch user info', { status: 401 });
    }
    
    const userInfo = await userResponse.json();
    
    // Update session with user data
    await setSession(env.USERS_DB, sessionId, {
      user: {
        id: userInfo.id,
        name: userInfo.username,
        email: userInfo.email,
        image: userInfo.profile_pic_url
      },
      accessToken: tokens.access_token
    });
    
    // Return response based on request method
    if (request.method === 'POST') {
      // For frontend POST requests, return JSON
      return new Response(JSON.stringify({ 
        success: true,
        user: {
          id: userInfo.id,
          name: userInfo.username,
          email: userInfo.email,
          image: userInfo.profile_pic_url
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': createSessionCookie(sessionId, env.NODE_ENV === 'production')
        }
      });
    } else {
      // For direct GET requests (shouldn't happen with frontend route)
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/',
          'Set-Cookie': createSessionCookie(sessionId, env.NODE_ENV === 'production')
        }
      });
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response('Authentication error', { status: 500 });
  }
}

// Logout handler
async function handleLogout(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (sessionId) {
    await deleteSession(env.USERS_DB, sessionId);
  }
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    }
  });
}

// Helper function to get user's team
async function getUserTeam(env, userId) {
  try {
    const query = `
      SELECT t.id, t.name, t.description
      FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE tm.user_id = ?
    `;
    
    const result = await env.USERS_DB.prepare(query).bind(userId).first();
    return result || null;
  } catch (error) {
    console.error('Error fetching user team:', error);
    return null;
  }
}

// Helper function to get accounts where user is a virtual assistant
async function getVirtualAssistantAccounts(env, userEmail) {
  try {
    if (!userEmail) {
      console.log('No user email provided for virtual assistant check');
      return [];
    }
    
    // Simplified query for D1 compatibility with roles
    const query = `
      SELECT 
        user_id, 
        expires_at, 
        status,
        created_at,
        has_comment_bot_access,
        has_dashboard_access,
        has_bc_gen_access
      FROM virtual_assistants
      WHERE LOWER(email) = LOWER(?) 
        AND status = 'active'
        AND expires_at > datetime('now')
    `;
    
    const result = await env.USERS_DB.prepare(query).bind(userEmail).all();
    
    if (!result.results || result.results.length === 0) {
        return [];
    }
    
    
    // For each virtual assistant record, fetch the user data
    const accounts = [];
    for (const row of result.results) {
      try {
        // Get the most recent session for this user
        const sessionQuery = `
          SELECT user_data 
          FROM sessions 
          WHERE user_id = ? 
          ORDER BY updated_at DESC 
          LIMIT 1
        `;
        
        const sessionResult = await env.USERS_DB.prepare(sessionQuery)
          .bind(row.user_id)
          .first();
        
        if (sessionResult && sessionResult.user_data) {
          const userData = JSON.parse(sessionResult.user_data);
          accounts.push({
            user_id: row.user_id,
            email: userData.email || 'Unknown',
            name: userData.name || 'Unknown',
            expires_at: row.expires_at,
            status: row.status,
            created_at: row.created_at,
            has_comment_bot_access: row.has_comment_bot_access,
            has_dashboard_access: row.has_dashboard_access,
            has_bc_gen_access: row.has_bc_gen_access
          });
        } else {
        }
      } catch (e) {
        console.error('Error processing virtual assistant record:', e);
      }
    }
    
    return accounts;
  } catch (error) {
    console.error('Error fetching virtual assistant accounts:', error);
    return [];
  }
}

// Check access handler
async function handleCheckAccess(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ 
      user: null,
      memberships: [],
      subscriptions: {
        comment_bot: { 
          isActive: false, 
          expiresIn: 0, 
          checkoutLink: env.WHOP_COMMENT_BOT_CHECKOUT_LINK || null,
          totalCredits: 0,
          creditMemberships: []
        },
        bc_gen: { 
          isActive: false, 
          expiresIn: 0, 
          checkoutLink: env.WHOP_BC_GEN_CHECKOUT_LINK || null,
          totalCredits: 0,
          creditMemberships: []
        },
        dashboard: { 
          isActive: false, 
          expiresIn: 0, 
          checkoutLink: env.WHOP_DASHBOARD_CHECKOUT_LINK || null
        },
        virtual_assistant: {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null,
          totalCredits: 0,
          creditMemberships: []
        }
      },
      virtualAssistantFor: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  let session = await getSession(env.USERS_DB, sessionId);
  if (!session || !session.access_token) {
    return new Response(JSON.stringify({ 
      user: null,
      memberships: [],
      subscriptions: {
        comment_bot: { 
          isActive: false, 
          expiresIn: 0, 
          checkoutLink: env.WHOP_COMMENT_BOT_CHECKOUT_LINK || null,
          totalCredits: 0,
          creditMemberships: []
        },
        bc_gen: { 
          isActive: false, 
          expiresIn: 0, 
          checkoutLink: env.WHOP_BC_GEN_CHECKOUT_LINK || null,
          totalCredits: 0,
          creditMemberships: []
        },
        dashboard: { 
          isActive: false, 
          expiresIn: 0, 
          checkoutLink: env.WHOP_DASHBOARD_CHECKOUT_LINK || null
        },
        virtual_assistant: {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null,
          totalCredits: 0,
          creditMemberships: []
        }
      },
      virtualAssistantFor: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if this session is in virtual assistant mode
  const userData = session.user_data ? JSON.parse(session.user_data) : {};
  const virtualAssistantMode = userData.virtualAssistantMode;
  const targetUserId = virtualAssistantMode?.targetUserId;
  
  
  if (targetUserId) {
    
    // Verify the current user is a virtual assistant for the target user
    const vaQuery = `
      SELECT * FROM virtual_assistants 
      WHERE user_id = ? 
      AND email = ?
      AND status = 'active'
      AND expires_at > datetime('now')
    `;
    
    const vaResult = await env.USERS_DB.prepare(vaQuery)
      .bind(targetUserId, session.user.email)
      .first();
      
    if (!vaResult) {
      return new Response(JSON.stringify({ 
        error: 'Not authorized as virtual assistant for this user'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the target user's session to access their data
    const targetSessionQuery = `
      SELECT * FROM sessions 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
    
    const targetSession = await env.USERS_DB.prepare(targetSessionQuery)
      .bind(targetUserId)
      .first();
      
    if (!targetSession || !targetSession.access_token) {
      // Target user has no active session, but virtual assistant should still be able to access
      // Return basic user info without fresh subscription data
      
      // Get basic user data from any session
      const basicUserQuery = `
        SELECT user_data FROM sessions 
        WHERE user_id = ? 
        LIMIT 1
      `;
      
      const basicUserSession = await env.USERS_DB.prepare(basicUserQuery)
        .bind(targetUserId)
        .first();
        
      if (basicUserSession) {
        try {
          const userData = JSON.parse(basicUserSession.user_data);
          return new Response(JSON.stringify({ 
            user: {
              id: targetUserId,
              ...userData,
              isVirtualAssistant: true,
              assistingFor: userData.email,
              // Include VA permissions directly in user object
              vaPermissions: {
                hasCommentBotAccess: vaResult.has_comment_bot_access === 1,
                hasDashboardAccess: vaResult.has_dashboard_access === 1,
                hasBCGenAccess: vaResult.has_bc_gen_access === 1
              }
            },
            memberships: [],
            subscriptions: {
              // Grant access based on virtual assistant permissions
              comment_bot: { 
                isActive: vaResult.has_comment_bot_access === 1, 
                expiresIn: vaResult.has_comment_bot_access === 1 ? 365 : 0, 
                checkoutLink: null,
                totalCredits: vaResult.has_comment_bot_access === 1 ? 999999 : 0,
                creditMemberships: []
              },
              bc_gen: { 
                isActive: vaResult.has_bc_gen_access === 1, 
                expiresIn: vaResult.has_bc_gen_access === 1 ? 365 : 0, 
                checkoutLink: null,
                totalCredits: vaResult.has_bc_gen_access === 1 ? 999999 : 0,
                creditMemberships: []
              },
              dashboard: { 
                isActive: vaResult.has_dashboard_access === 1, 
                expiresIn: vaResult.has_dashboard_access === 1 ? 365 : 0, 
                checkoutLink: null
              },
              virtual_assistant: {
                isActive: false,
                expiresIn: 0,
                checkoutLink: null,
                totalCredits: 0,
                creditMemberships: []
              }
            },
            virtualAssistantFor: []
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          console.error('[VA] Error parsing basic user data:', e);
        }
      }
      
      return new Response(JSON.stringify({ 
        error: 'Target user not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse the target user data
    let targetUserData;
    try {
      targetUserData = JSON.parse(targetSession.user_data);
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: 'Invalid target user data'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Use the target user's session for the rest of the function with role permissions
    session = {
      ...targetSession,
      user_id: targetUserId, // Add user_id at root level for compatibility
      user: {
        id: targetUserId,
        ...targetUserData,
        isVirtualAssistant: true,
        assistingFor: targetUserData.email,
        // Include VA permissions directly in user object
        vaPermissions: {
          hasCommentBotAccess: vaResult.has_comment_bot_access === 1,
          hasDashboardAccess: vaResult.has_dashboard_access === 1,
          hasBCGenAccess: vaResult.has_bc_gen_access === 1
        }
      },
      virtualAssistantPermissions: {
        hasCommentBotAccess: vaResult.has_comment_bot_access === 1,
        hasDashboardAccess: vaResult.has_dashboard_access === 1,
        hasBCGenAccess: vaResult.has_bc_gen_access === 1
      }
    };
    
  }
  
  // Fetch user's team information
  const userTeam = session.user?.id ? await getUserTeam(env, session.user.id) : null;
  
  // Check if user is an admin - admins get unlimited access
  // For virtual assistants, check if the target user (person being assisted) is an admin
  const isAdmin = session.user && session.user.email && isAdminUser(session.user.email);
  
  // For admin users, we still need to fetch real virtual assistant credits
  if (isAdmin) {
    try {
      // Fetch all user memberships with pagination support
      const allMemberships = await fetchAllMemberships(session.access_token);
      const memberships = { data: allMemberships };
      
      // Get virtual assistant credits only
      const virtualAssistantCredits = memberships.data?.filter(m => 
        (m.metadata?.Quantity !== undefined || m.metadata?.InitialQuantity !== undefined) && 
        (m.metadata?.ProductType === 'virtual_assistant' || 
         m.product_id === env.WHOP_VIRTUAL_ASSISTANT_PRODUCT_ID)
      ) || [];
      
      const virtualAssistantTotalCredits = virtualAssistantCredits.reduce((sum, m) => {
        const quantity = m.metadata?.Quantity !== undefined ? 
          parseInt(m.metadata.Quantity) : 
          (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
        return sum + quantity;
      }, 0);
      
      return new Response(JSON.stringify({ 
        user: { ...session.user, isAdmin: true, team: userTeam },
        memberships: [],
        subscriptions: {
          comment_bot: { 
            isActive: true, 
            expiresIn: 9999, // Effectively unlimited
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year from now
            membershipId: 'admin_bypass',
            checkoutLink: null,
            totalCredits: 999999, // Unlimited credits
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'admin' }
            }]
          },
          bc_gen: { 
            isActive: true, 
            expiresIn: 9999, // Effectively unlimited
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year from now
            membershipId: 'admin_bypass',
            checkoutLink: null,
            totalCredits: 999999, // Unlimited credits
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'admin' }
            }]
          },
          dashboard: { 
            isActive: true, 
            expiresIn: 9999, // Effectively unlimited
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year from now
            membershipId: 'admin_bypass',
            checkoutLink: null
          },
          virtual_assistant: {
            isActive: false,
            expiresIn: 0,
            checkoutLink: null,
            totalCredits: 999999, // Admin unlimited credits
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'virtual_assistant' }
            }]
          }
        },
        virtualAssistantFor: await getVirtualAssistantAccounts(env, session.user?.email)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Admin fetch virtual assistant credits error:', error);
      // Fallback to 0 credits on error
      return new Response(JSON.stringify({ 
        user: { ...session.user, isAdmin: true, team: userTeam },
        memberships: [],
        subscriptions: {
          comment_bot: { 
            isActive: true, 
            expiresIn: 9999,
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
            membershipId: 'admin_bypass',
            checkoutLink: null,
            totalCredits: 999999,
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'admin' }
            }]
          },
          bc_gen: { 
            isActive: true, 
            expiresIn: 9999,
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
            membershipId: 'admin_bypass',
            checkoutLink: null,
            totalCredits: 999999,
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'admin' }
            }]
          },
          dashboard: { 
            isActive: true, 
            expiresIn: 9999,
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
            membershipId: 'admin_bypass',
            checkoutLink: null
          },
          virtual_assistant: {
            isActive: false,
            expiresIn: 0,
            checkoutLink: null,
            totalCredits: 999999, // Admin unlimited credits
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'virtual_assistant' }
            }]
          }
        },
        virtualAssistantFor: []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  try {
    // Fetch all user memberships with pagination support
    const allMemberships = await fetchAllMemberships(session.access_token);
    const membershipResponse = { ok: allMemberships.length >= 0 }; // Always considered ok if we got a response
    
    if (!membershipResponse.ok) {
      // If this is a virtual assistant request and the API call failed, grant access anyway
      if (targetUserId) {
        return new Response(JSON.stringify({ 
          user: { ...session.user, isAdmin, team: userTeam },
          memberships: [],
          subscriptions: {
            comment_bot: { 
              isActive: true, 
              expiresIn: 365,
              checkoutLink: null,
              totalCredits: 999999,
              creditMemberships: []
            },
            bc_gen: { 
              isActive: true, 
              expiresIn: 365,
              checkoutLink: null,
              totalCredits: 999999,
              creditMemberships: []
            },
            dashboard: { 
              isActive: true, 
              expiresIn: 365,
              checkoutLink: null
            },
            virtual_assistant: {
              isActive: false,
              expiresIn: 0,
              checkoutLink: null,
              totalCredits: 0,
              creditMemberships: []
            }
          },
          virtualAssistantFor: await getVirtualAssistantAccounts(env, session.user?.originalEmail || session.user?.email)
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ hasAccess: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const memberships = { data: allMemberships };
    
    if (targetUserId) {
      console.log('[VA] This is a virtual assistant request for target user:', targetUserId);
      console.log('[VA] Membership response status:', membershipResponse.status);
      console.log('[VA] First few memberships:', memberships.data?.slice(0, 3));
    }
    
    // Helper function to calculate days remaining
    const calculateDaysRemaining = (endTimestamp) => {
      if (!endTimestamp) return 0;
      const endDate = new Date(endTimestamp * 1000);
      const today = new Date();
      const diffTime = endDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };
    
    // Check Comment Bot subscription
    const commentBotMembership = memberships.data?.find(membership => 
      membership.plan_id === env.WHOP_COMMENT_BOT_PLAN_ID &&
      membership.status === 'active'
    );
    
    // Check BC Gen subscription
    const bcGenMembership = memberships.data?.find(membership => 
      membership.plan_id === env.WHOP_BC_GEN_PLAN_ID &&
      membership.status === 'active'
    );
    
    // Check Dashboard subscription
    if (targetUserId) {
      console.log('[VA] Looking for dashboard plan ID:', env.WHOP_DASHBOARD_PLAN_ID);
      console.log('[VA] Available plan IDs:', memberships.data?.map(m => m.plan_id));
    }
    const dashboardMembership = memberships.data?.find(membership => 
      membership.plan_id === env.WHOP_DASHBOARD_PLAN_ID &&
      membership.status === 'active'
    );
    
    // Calculate credits for each product type
    const commentBotCredits = memberships.data?.filter(m => 
      (m.metadata?.Quantity !== undefined || m.metadata?.InitialQuantity !== undefined) && 
      (m.metadata?.ProductType === 'comment_bot' || 
       m.product_id === env.WHOP_COMMENT_BOT_PRODUCT_ID)
    ) || [];
    
    const bcGenCredits = memberships.data?.filter(m => 
      (m.metadata?.Quantity !== undefined || m.metadata?.InitialQuantity !== undefined) && 
      (m.metadata?.ProductType === 'bc_gen' || 
       m.product_id === env.WHOP_BC_GEN_PRODUCT_ID)
    ) || [];
    
    const virtualAssistantCredits = memberships.data?.filter(m => 
      (m.metadata?.Quantity !== undefined || m.metadata?.InitialQuantity !== undefined) && 
      (m.metadata?.ProductType === 'virtual_assistant' || 
       m.product_id === env.WHOP_VIRTUAL_ASSISTANT_PRODUCT_ID)
    ) || [];
    
    // Calculate total credits for each type
    const commentBotTotalCredits = commentBotCredits.reduce((sum, m) => {
      const quantity = m.metadata?.Quantity !== undefined ? 
        parseInt(m.metadata.Quantity) : 
        (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
      return sum + quantity;
    }, 0);
    const bcGenTotalCredits = bcGenCredits.reduce((sum, m) => {
      const quantity = m.metadata?.Quantity !== undefined ? 
        parseInt(m.metadata.Quantity) : 
        (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
      return sum + quantity;
    }, 0);
    const virtualAssistantTotalCredits = virtualAssistantCredits.reduce((sum, m) => {
      const quantity = m.metadata?.Quantity !== undefined ? 
        parseInt(m.metadata.Quantity) : 
        (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
      return sum + quantity;
    }, 0);
    
    // Build subscriptions object
    const subscriptions = {
      comment_bot: {
        isActive: !!commentBotMembership,
        expiresIn: commentBotMembership ? calculateDaysRemaining(commentBotMembership.renewal_period_end) : 0,
        startDate: commentBotMembership?.renewal_period_start || null,
        endDate: commentBotMembership?.renewal_period_end || null,
        membershipId: commentBotMembership?.id || null,
        checkoutLink: env.WHOP_COMMENT_BOT_CHECKOUT_LINK || null,
        totalCredits: commentBotTotalCredits,
        creditMemberships: commentBotCredits
      },
      bc_gen: {
        isActive: !!bcGenMembership,
        expiresIn: bcGenMembership ? calculateDaysRemaining(bcGenMembership.renewal_period_end) : 0,
        startDate: bcGenMembership?.renewal_period_start || null,
        endDate: bcGenMembership?.renewal_period_end || null,
        membershipId: bcGenMembership?.id || null,
        checkoutLink: env.WHOP_BC_GEN_CHECKOUT_LINK || null,
        totalCredits: bcGenTotalCredits,
        creditMemberships: bcGenCredits
      },
      dashboard: {
        isActive: !!dashboardMembership,
        expiresIn: dashboardMembership ? calculateDaysRemaining(dashboardMembership.renewal_period_end) : 0,
        startDate: dashboardMembership?.renewal_period_start || null,
        endDate: dashboardMembership?.renewal_period_end || null,
        membershipId: dashboardMembership?.id || null,
        checkoutLink: env.WHOP_DASHBOARD_CHECKOUT_LINK || null
      },
      virtual_assistant: {
        isActive: false, // No subscription plan for virtual assistant, only credits
        expiresIn: 0,
        checkoutLink: null,
        totalCredits: virtualAssistantTotalCredits,
        creditMemberships: virtualAssistantCredits
      }
    };
    
    // Check if user is a virtual assistant for other accounts
    // If we're in virtual assistant mode, use the original email, not the target user's email
    const emailToCheck = targetUserId && session.user?.originalEmail ? session.user.originalEmail : session.user?.email;
    const virtualAssistantAccounts = await getVirtualAssistantAccounts(env, emailToCheck);
    
    // Check if current user IS a virtual assistant (logged in directly)
    // If they have virtual assistant accounts, they should only see what they have permission for
    // Note: Even if user has their own subscriptions, if they're listed as a VA, apply restrictions
    const isDirectVirtualAssistant = !targetUserId && virtualAssistantAccounts.length > 0 && !isAdmin;
    
    if (isDirectVirtualAssistant) {
      
      // Get the permissions from the first account (or merge all permissions)
      let hasAnyCommentBotAccess = false;
      let hasAnyDashboardAccess = false;
      let hasAnyBCGenAccess = false;
      
      for (const account of virtualAssistantAccounts) {
        if (account.has_comment_bot_access) hasAnyCommentBotAccess = true;
        if (account.has_dashboard_access) hasAnyDashboardAccess = true;
        if (account.has_bc_gen_access) hasAnyBCGenAccess = true;
      }
      
      // Apply restrictions based on their virtual assistant permissions
      if (!hasAnyCommentBotAccess) {
        subscriptions.comment_bot = {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null,
          totalCredits: 0,
          creditMemberships: []
        };
      }
      
      if (!hasAnyDashboardAccess) {
        subscriptions.dashboard = {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null
        };
      }
      
      if (!hasAnyBCGenAccess) {
        subscriptions.bc_gen = {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null,
          totalCredits: 0,
          creditMemberships: []
        };
      }
      
    }
    
    // Apply role-based filtering for virtual assistants
    if (targetUserId && session.virtualAssistantPermissions) {
      const perms = session.virtualAssistantPermissions;
      
      // Filter subscriptions based on permissions
      if (!perms.hasCommentBotAccess) {
        subscriptions.comment_bot = {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null,
          totalCredits: 0,
          creditMemberships: []
        };
      }
      
      if (!perms.hasDashboardAccess) {
        subscriptions.dashboard = {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null
        };
      }
      
      if (!perms.hasBCGenAccess) {
        subscriptions.bc_gen = {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null,
          totalCredits: 0,
          creditMemberships: []
        };
      }
      
    }
    
    // Mark user as virtual assistant if they are one (direct login, not assisting)
    // virtualAssistantAccounts contains accounts where this email is listed as a VA
    const isDirectlyVirtualAssistant = !targetUserId && virtualAssistantAccounts.length > 0 && !isAdmin;
    
    const responseData = { 
      user: { 
        ...session.user, 
        isAdmin: isDirectlyVirtualAssistant ? false : isAdmin, // VAs cannot be admins
        team: userTeam,
        isVirtualAssistant: isDirectlyVirtualAssistant || session.user?.isVirtualAssistant || false
      },
      memberships: memberships.data,
      subscriptions,
      virtualAssistantFor: virtualAssistantAccounts
    };
    
    
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Check access error:', error);
    return new Response(JSON.stringify({ 
      user: session?.user ? { ...session.user, isAdmin: session.user.email ? isAdminUser(session.user.email) : false, team: userTeam } : null,
      memberships: [],
      subscriptions: {
        comment_bot: { isActive: false, expiresIn: 0, checkoutLink: env.WHOP_COMMENT_BOT_CHECKOUT_LINK || null },
        bc_gen: { isActive: false, expiresIn: 0, checkoutLink: env.WHOP_BC_GEN_CHECKOUT_LINK || null },
        dashboard: { isActive: false, expiresIn: 0, checkoutLink: env.WHOP_DASHBOARD_CHECKOUT_LINK || null },
        virtual_assistant: { isActive: false, expiresIn: 0, checkoutLink: null, totalCredits: 0, creditMemberships: [] }
      },
      virtualAssistantFor: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get current user handler
async function handleGetUser(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  let session = await getSession(env.USERS_DB, sessionId);
  
  // Check if this is a virtual assistant request
  const url = new URL(request.url);
  const targetUserId = url.searchParams.get('targetUserId');
  
  if (targetUserId && session) {
    // Verify the current user is a virtual assistant for the target user
    const vaQuery = `
      SELECT * FROM virtual_assistants 
      WHERE user_id = ? 
      AND email = ?
      AND status = 'active'
      AND expires_at > datetime('now')
    `;
    
    const vaResult = await env.USERS_DB.prepare(vaQuery)
      .bind(targetUserId, session.user.email)
      .first();
      
    if (!vaResult) {
      return new Response(JSON.stringify({ 
        error: 'Not authorized as virtual assistant for this user'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the target user's session
    const targetSessionQuery = `
      SELECT * FROM sessions 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
    
    const targetSession = await env.USERS_DB.prepare(targetSessionQuery)
      .bind(targetUserId)
      .first();
      
    if (targetSession) {
      let targetUserData;
      try {
        targetUserData = JSON.parse(targetSession.user_data);
      } catch (e) {
        targetUserData = {};
      }
      
      // Return target user data with virtual assistant flag
      const userTeam = await getUserTeam(env, targetUserId);
      const validUser = {
        id: targetUserId,
        ...targetUserData,
        isVirtualAssistant: true,
        assistingFor: targetUserData.email,
        isAdmin: targetUserData.email ? isAdminUser(targetUserData.email) : false,
        team: userTeam
      };
      
      return new Response(JSON.stringify({ 
        user: validUser
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // Normal user request
  let validUser = null;
  if (session?.user && session.user.id) {
    const userTeam = await getUserTeam(env, session.user.id);
    validUser = { ...session.user, isAdmin: session.user.email ? isAdminUser(session.user.email) : false, team: userTeam };
  }
  
  return new Response(JSON.stringify({ 
    user: validUser
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}


// Create checkout handler
async function handleCreateCheckout(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { quantity = 100, productType = 'comment_bot' } = await request.json();
  
  // Validate product type
  if (!['comment_bot', 'bc_gen', 'virtual_assistant'].includes(productType)) {
    return new Response(JSON.stringify({ error: 'Invalid product type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get product ID based on type
  const productId = productType === 'comment_bot' 
    ? env.WHOP_COMMENT_BOT_PRODUCT_ID 
    : productType === 'bc_gen'
    ? env.WHOP_BC_GEN_PRODUCT_ID
    : env.WHOP_VIRTUAL_ASSISTANT_PRODUCT_ID;
  
  const productName = productType === 'comment_bot' ? 'Comment Bot' : productType === 'bc_gen' ? 'BC Gen' : 'Virtual Assistant';
  
  try {
    // Create a plan with the specified quantity
    const planResponse = await fetch('https://api.whop.com/api/v2/plans', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHOP_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_type: 'one_time',
        base_currency: 'usd',
        stock: 1,
        visibility: "hidden",
        payment_link_description: `Purchasing ${quantity} credits for ${productName}`,
        initial_price: quantity * (productType === 'comment_bot' ? COMMENT_BOT_CREDIT_PRICE : productType === 'bc_gen' ? BC_GEN_CREDIT_PRICE : VIRTUAL_ASSISTANT_CREDIT_PRICE),
        product_id: productId,
        metadata: {
          Quantity: quantity,
          InitialQuantity: quantity,
          ProductType: productType
        }
      })
    });
    
    if (!planResponse.ok) {
      const error = await planResponse.text();
      console.error('Failed to create plan:', error);
      return new Response(JSON.stringify({ error: 'Failed to create checkout' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const planData = await planResponse.json();
    
    return new Response(JSON.stringify({
      success: true,
      direct_link: planData.direct_link,
      plan_id: planData.id,
      quantity: quantity
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create checkout' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Use credits handler
async function handleUseCredits(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session || !session.access_token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const { credits, productType = 'comment_bot', assistedUserId } = await request.json();
  
  // Check if user is an admin - admins don't need to use credits
  if (session.user && session.user.email && isAdminUser(session.user.email) && !assistedUserId) {
    return new Response(JSON.stringify({ 
      success: true,
      creditsUsed: 0,
      message: 'Admin user - no credits deducted',
      updates: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (!credits || credits < 1) {
    return new Response(JSON.stringify({ error: 'Invalid credits amount' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Validate product type
  if (!['comment_bot', 'bc_gen', 'virtual_assistant'].includes(productType)) {
    return new Response(JSON.stringify({ error: 'Invalid product type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get product ID for filtering
  const productId = productType === 'comment_bot' 
    ? env.WHOP_COMMENT_BOT_PRODUCT_ID 
    : productType === 'bc_gen'
    ? env.WHOP_BC_GEN_PRODUCT_ID
    : env.WHOP_VIRTUAL_ASSISTANT_PRODUCT_ID;
  
  try {
    // Get all user's memberships with pagination support
    const allMemberships = await fetchAllMemberships(session.access_token);
    
    if (!allMemberships) {
      return new Response(JSON.stringify({ error: 'Failed to fetch memberships' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const memberships = { data: allMemberships };
    
    // Filter memberships with credits for the specific product type
    const creditMemberships = memberships.data?.filter(m => {
      // Check for Quantity (allow InitialQuantity as fallback for initial memberships)
      const quantity = m.metadata?.Quantity !== undefined ? 
        parseInt(m.metadata.Quantity) : 
        (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
      
      return quantity > 0 &&
        (m.metadata?.ProductType === productType || m.product_id === productId);
    }) || [];
    
    // Sort by quantity (ascending) to use smaller quantities first
    creditMemberships.sort((a, b) => {
      const aQuantity = a.metadata?.Quantity !== undefined ? 
        parseInt(a.metadata.Quantity) : 
        (a.metadata?.InitialQuantity !== undefined ? parseInt(a.metadata.InitialQuantity) : 0);
      const bQuantity = b.metadata?.Quantity !== undefined ? 
        parseInt(b.metadata.Quantity) : 
        (b.metadata?.InitialQuantity !== undefined ? parseInt(b.metadata.InitialQuantity) : 0);
      return aQuantity - bQuantity;
    });
    
    let remainingCredits = credits;
    const updates = [];
    
    // Calculate credit usage
    for (const membership of creditMemberships) {
      if (remainingCredits <= 0) break;
      
      // Use Quantity if available, otherwise use InitialQuantity for new memberships
      const currentQuantity = membership.metadata?.Quantity !== undefined ? 
        parseInt(membership.metadata.Quantity) : 
        (membership.metadata?.InitialQuantity !== undefined ? parseInt(membership.metadata.InitialQuantity) : 0);
      
      const toSubtract = Math.min(currentQuantity, remainingCredits);
      const newQuantity = currentQuantity - toSubtract;
      
      updates.push({
        membershipId: membership.id,
        oldQuantity: currentQuantity,
        newQuantity: newQuantity,
        creditsUsed: toSubtract,
        // If we're using InitialQuantity, we need to set Quantity for the first time
        isInitialUse: membership.metadata?.Quantity === undefined
      });
      
      remainingCredits -= toSubtract;
    }
    
    if (remainingCredits > 0) {
      console.error('Insufficient credits:', {
        productType,
        productId,
        requested: credits,
        available: credits - remainingCredits,
        creditMembershipsCount: creditMemberships.length
      });
      return new Response(JSON.stringify({ 
        error: 'Insufficient credits available',
        requested: credits,
        available: credits - remainingCredits,
        productType
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Apply updates
    const updateResults = [];
    for (const update of updates) {
      try {
        // Always update quantity, never terminate (even if it reaches 0)
        const updateResponse = await fetch(`https://api.whop.com/api/v2/memberships/${update.membershipId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.WHOP_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            metadata: {
              Quantity: update.newQuantity
            }
          })
        });
        
        updateResults.push({
          membershipId: update.membershipId,
          success: updateResponse.ok,
          action: 'updated',
          oldQuantity: update.oldQuantity,
          newQuantity: update.newQuantity,
          creditsUsed: update.creditsUsed
        });
      } catch (error) {
        updateResults.push({
          membershipId: update.membershipId,
          success: false,
          error: error.message
        });
      }
    }
    
    const allSuccessful = updateResults.every(result => result.success);
    
    return new Response(JSON.stringify({
      success: allSuccessful,
      creditsRequested: credits,
      creditsUsed: credits - remainingCredits,
      updates: updateResults
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Use credits error:', error);
    return new Response(JSON.stringify({ error: 'Failed to use credits' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Get virtual assistants handler
async function handleGetVirtualAssistants(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get user's virtual assistants with roles
    const query = `
      SELECT id, email, status, 
             has_comment_bot_access, has_dashboard_access, has_bc_gen_access,
             created_at, expires_at
      FROM virtual_assistants
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;
    
    const result = await env.USERS_DB.prepare(query).bind(session.user.id).all();
    
    
    // Update status based on expiration and convert role integers to booleans
    const now = new Date();
    const assistants = result.results.map(assistant => {
      const expiresAt = new Date(assistant.expires_at);
      if (expiresAt < now && assistant.status === 'active') {
        assistant.status = 'expired';
      }
      // Convert 0/1 to boolean for roles
      return {
        ...assistant,
        has_comment_bot_access: assistant.has_comment_bot_access === 1,
        has_dashboard_access: assistant.has_dashboard_access === 1,
        has_bc_gen_access: assistant.has_bc_gen_access === 1
      };
    });
    
    return new Response(JSON.stringify({ assistants }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get virtual assistants error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch virtual assistants' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Add virtual assistant handler
async function handleAddVirtualAssistant(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { email, hasCommentBotAccess = false, hasDashboardAccess = false, hasBCGenAccess = false } = await request.json();
    
    if (!email || !/.+@.+\..+/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if it's the user's own email
    if (session.user?.email && email.toLowerCase() === session.user.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'You cannot add yourself as a virtual assistant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user is an admin - admins bypass credit requirements
    const isAdmin = session.user?.email && isAdminUser(session.user.email);
    
    if (!isAdmin) {
      // Non-admin users need to check and use credits
      const checkAccessResponse = await handleCheckAccess(request, env);
      const accessData = await checkAccessResponse.json();
      
      const virtualAssistantCredits = accessData.subscriptions?.virtual_assistant?.totalCredits || 0;
      
      if (virtualAssistantCredits < 1) {
        return new Response(JSON.stringify({ error: 'Insufficient credits' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Use a credit
      const useCreditsResponse = await handleUseCredits(
        new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify({ credits: 1, productType: 'virtual_assistant' })
        }),
        env
      );
      
      const useCreditsData = await useCreditsResponse.json();
      
      if (!useCreditsData.success) {
        return new Response(JSON.stringify({ error: 'Failed to deduct credit' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Create virtual assistant with roles
    const id = generateRandomString(36);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    const insertQuery = `
      INSERT INTO virtual_assistants (
        id, user_id, email, status, 
        has_comment_bot_access, has_dashboard_access, has_bc_gen_access,
        created_at, expires_at
      )
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)
    `;
    
    await env.USERS_DB.prepare(insertQuery)
      .bind(
        id, session.user.id, email, 
        hasCommentBotAccess ? 1 : 0, 
        hasDashboardAccess ? 1 : 0, 
        hasBCGenAccess ? 1 : 0,
        now.toISOString(), 
        expiresAt.toISOString()
      )
      .run();
    
    return new Response(JSON.stringify({
      success: true,
      assistant: {
        id,
        email,
        status: 'active',
        hasCommentBotAccess,
        hasDashboardAccess,
        hasBCGenAccess,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Add virtual assistant error:', error);
    return new Response(JSON.stringify({ error: 'Failed to add virtual assistant' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Extend virtual assistant time handler
async function handleExtendVirtualAssistant(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { assistantId } = await request.json();
    
    if (!assistantId) {
      return new Response(JSON.stringify({ error: 'Assistant ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if user is an admin - admins bypass credit requirements
    const isAdmin = session.user?.email && isAdminUser(session.user.email);
    
    if (!isAdmin) {
      // Non-admin users need to check and use credits
      const checkAccessResponse = await handleCheckAccess(request, env);
      const accessData = await checkAccessResponse.json();
      
      const virtualAssistantCredits = accessData.subscriptions?.virtual_assistant?.totalCredits || 0;
      
      if (virtualAssistantCredits < 1) {
        return new Response(JSON.stringify({ error: 'Insufficient credits' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Get current assistant to verify ownership and get current expiration
    const getQuery = `
      SELECT expires_at
      FROM virtual_assistants
      WHERE id = ? AND user_id = ?
    `;
    
    const assistant = await env.USERS_DB.prepare(getQuery)
      .bind(assistantId, session.user.id)
      .first();
    
    if (!assistant) {
      return new Response(JSON.stringify({ error: 'Virtual assistant not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!isAdmin) {
      // Non-admin users need to use a credit
      const useCreditsResponse = await handleUseCredits(
        new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body: JSON.stringify({ credits: 1, productType: 'virtual_assistant' })
        }),
        env
      );
      
      const useCreditsData = await useCreditsResponse.json();
      
      if (!useCreditsData.success) {
        return new Response(JSON.stringify({ error: 'Failed to deduct credit' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Calculate new expiration date (add 30 days to current expiration)
    const currentExpiration = new Date(assistant.expires_at);
    const now = new Date();
    
    // If already expired, extend from today; otherwise extend from current expiration
    const baseDate = currentExpiration < now ? now : currentExpiration;
    const newExpiresAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Update the expiration date
    const updateQuery = `
      UPDATE virtual_assistants
      SET expires_at = ?
      WHERE id = ? AND user_id = ?
    `;
    
    await env.USERS_DB.prepare(updateQuery)
      .bind(newExpiresAt.toISOString(), assistantId, session.user.id)
      .run();
    
    return new Response(JSON.stringify({
      success: true,
      newExpiresAt: newExpiresAt.toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Extend virtual assistant error:', error);
    return new Response(JSON.stringify({ error: 'Failed to extend virtual assistant' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Edit virtual assistant email handler
async function handleEditVirtualAssistant(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { assistantId, newEmail, hasCommentBotAccess = false, hasDashboardAccess = false, hasBCGenAccess = false } = await request.json();
    
    if (!assistantId || !newEmail) {
      return new Response(JSON.stringify({ error: 'Assistant ID and new email required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate email format
    if (!/.+@.+\..+/.test(newEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if it's the user's own email
    if (session.user?.email && newEmail.toLowerCase() === session.user.email.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'You cannot use your own email for a virtual assistant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify ownership
    const checkQuery = `
      SELECT id FROM virtual_assistants
      WHERE id = ? AND user_id = ?
    `;
    
    const assistant = await env.USERS_DB.prepare(checkQuery)
      .bind(assistantId, session.user.id)
      .first();
    
    if (!assistant) {
      return new Response(JSON.stringify({ error: 'Virtual assistant not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update the email and roles
    const updateQuery = `
      UPDATE virtual_assistants
      SET email = ?,
          has_comment_bot_access = ?,
          has_dashboard_access = ?,
          has_bc_gen_access = ?
      WHERE id = ? AND user_id = ?
    `;
    
    await env.USERS_DB.prepare(updateQuery)
      .bind(
        newEmail, 
        hasCommentBotAccess ? 1 : 0,
        hasDashboardAccess ? 1 : 0,
        hasBCGenAccess ? 1 : 0,
        assistantId, 
        session.user.id
      )
      .run();
    
    return new Response(JSON.stringify({
      success: true,
      newEmail: newEmail
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Edit virtual assistant error:', error);
    return new Response(JSON.stringify({ error: 'Failed to edit virtual assistant' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Remove virtual assistant handler
async function handleRemoveVirtualAssistant(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const assistantId = pathParts[pathParts.length - 1];
  
  if (!assistantId) {
    return new Response(JSON.stringify({ error: 'Assistant ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Delete the virtual assistant (only if it belongs to the user)
    const deleteQuery = `
      DELETE FROM virtual_assistants 
      WHERE id = ? AND user_id = ?
    `;
    
    const result = await env.USERS_DB.prepare(deleteQuery)
      .bind(assistantId, session.user.id)
      .run();
    
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Virtual assistant not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Remove virtual assistant error:', error);
    return new Response(JSON.stringify({ error: 'Failed to remove virtual assistant' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Removed handleGetVirtualAssistantAccounts function
/*
async function handleGetVirtualAssistantAccounts(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get accounts where this user is a virtual assistant
    const accounts = await getVirtualAssistantAccounts(env, session.user.email);
    
    return new Response(JSON.stringify({ 
      success: true,
      accounts: accounts 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get virtual assistant accounts error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get virtual assistant accounts' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

*/

// Removed handleGetVirtualAssistantData function
/*
async function handleGetVirtualAssistantData(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  console.log('[VA Debug] Virtual assistant data request from:', session.user?.email);
  
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const targetUserId = pathParts[pathParts.length - 1];
  
  if (!targetUserId) {
    return new Response(JSON.stringify({ error: 'User ID required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Verify that the current user is a virtual assistant for the target user
    const verifyQuery = `
      SELECT id, expires_at FROM virtual_assistants
      WHERE user_id = ? AND email = ? AND status = 'active' AND expires_at > datetime('now')
    `;
    
    console.log('[VA Debug] Verifying access for email:', session.user.email, 'to assist user:', targetUserId);
    
    const isAssistant = await env.USERS_DB.prepare(verifyQuery)
      .bind(targetUserId, session.user.email)
      .first();
    
    console.log('[VA Debug] Assistant verification result:', isAssistant);
    
    if (!isAssistant) {
      console.log('[VA Debug] Access denied - user is not a virtual assistant for target user');
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get user details from sessions
    const userQuery = `
      SELECT user_id, user_data 
      FROM sessions 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
    const targetUserSession = await env.USERS_DB.prepare(userQuery)
      .bind(targetUserId)
      .first();
    
    if (!targetUserSession) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Parse user data
    let targetUser;
    try {
      const userData = JSON.parse(targetUserSession.user_data);
      targetUser = {
        id: targetUserSession.user_id,
        email: userData.email,
        name: userData.name,
        isAdmin: userData.email ? isAdminUser(userData.email) : false
      };
      console.log('[VA Debug] Target user data:', {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name
      });
    } catch (e) {
      console.log('[VA Debug] Error parsing user data:', e);
      return new Response(JSON.stringify({ error: 'Invalid user data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the target user's session to access their access token
    const targetSessionQuery = `
      SELECT access_token 
      FROM sessions 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
    const targetSession = await env.USERS_DB.prepare(targetSessionQuery)
      .bind(targetUserId)
      .first();
    
    if (!targetSession || !targetSession.access_token) {
      // User has no active session, return empty subscriptions
      return new Response(JSON.stringify({ 
        success: true,
        user: targetUser,
        subscriptions: {
          comment_bot: { isActive: false, expiresIn: 0, checkoutLink: null, totalCredits: 0, creditMemberships: [] },
          bc_gen: { isActive: false, expiresIn: 0, checkoutLink: null, totalCredits: 0, creditMemberships: [] },
          dashboard: { isActive: false, expiresIn: 0, checkoutLink: null },
          virtual_assistant: { isActive: false, expiresIn: 0, checkoutLink: null, totalCredits: 0, creditMemberships: [] }
        },
        virtualAssistantInfo: {
          assisting: true,
          expiresAt: isAssistant.expires_at
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Fetch all user memberships with pagination support
    const allMemberships = await fetchAllMemberships(targetSession.access_token);
    
    if (!allMemberships) {
      return new Response(JSON.stringify({ 
        success: true,
        user: targetUser,
        subscriptions: {
          comment_bot: { isActive: false, expiresIn: 0, checkoutLink: null, totalCredits: 0, creditMemberships: [] },
          bc_gen: { isActive: false, expiresIn: 0, checkoutLink: null, totalCredits: 0, creditMemberships: [] },
          dashboard: { isActive: false, expiresIn: 0, checkoutLink: null },
          virtual_assistant: { isActive: false, expiresIn: 0, checkoutLink: null, totalCredits: 0, creditMemberships: [] }
        },
        virtualAssistantInfo: {
          assisting: true,
          expiresAt: isAssistant.expires_at
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const memberships = { data: allMemberships };
    
    // Helper function to calculate days remaining
    const calculateDaysRemaining = (endTimestamp) => {
      if (!endTimestamp) return 0;
      const endDate = new Date(endTimestamp * 1000);
      const today = new Date();
      const diffTime = endDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };
    
    // Check subscriptions (same logic as handleCheckAccess)
    const commentBotMembership = memberships.data?.find(membership => 
      membership.plan_id === env.WHOP_COMMENT_BOT_PLAN_ID &&
      membership.status === 'active'
    );
    
    const bcGenMembership = memberships.data?.find(membership => 
      membership.plan_id === env.WHOP_BC_GEN_PLAN_ID &&
      membership.status === 'active'
    );
    
    const dashboardMembership = memberships.data?.find(membership => 
      membership.plan_id === env.WHOP_DASHBOARD_PLAN_ID &&
      membership.status === 'active'
    );
    
    // Calculate credits
    const commentBotCredits = memberships.data?.filter(m => 
      (m.metadata?.Quantity !== undefined || m.metadata?.InitialQuantity !== undefined) && 
      (m.metadata?.ProductType === 'comment_bot' || 
       m.product_id === env.WHOP_COMMENT_BOT_PRODUCT_ID)
    ) || [];
    
    const bcGenCredits = memberships.data?.filter(m => 
      (m.metadata?.Quantity !== undefined || m.metadata?.InitialQuantity !== undefined) && 
      (m.metadata?.ProductType === 'bc_gen' || 
       m.product_id === env.WHOP_BC_GEN_PRODUCT_ID)
    ) || [];
    
    const virtualAssistantCredits = memberships.data?.filter(m => 
      (m.metadata?.Quantity !== undefined || m.metadata?.InitialQuantity !== undefined) && 
      (m.metadata?.ProductType === 'virtual_assistant' || 
       m.product_id === env.WHOP_VIRTUAL_ASSISTANT_PRODUCT_ID)
    ) || [];
    
    // Calculate total credits
    const commentBotTotalCredits = commentBotCredits.reduce((sum, m) => {
      const quantity = m.metadata?.Quantity !== undefined ? 
        parseInt(m.metadata.Quantity) : 
        (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
      return sum + quantity;
    }, 0);
    const bcGenTotalCredits = bcGenCredits.reduce((sum, m) => {
      const quantity = m.metadata?.Quantity !== undefined ? 
        parseInt(m.metadata.Quantity) : 
        (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
      return sum + quantity;
    }, 0);
    const virtualAssistantTotalCredits = virtualAssistantCredits.reduce((sum, m) => {
      const quantity = m.metadata?.Quantity !== undefined ? 
        parseInt(m.metadata.Quantity) : 
        (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
      return sum + quantity;
    }, 0);
    
    // Build subscriptions object
    const subscriptions = {
      comment_bot: {
        isActive: !!commentBotMembership,
        expiresIn: commentBotMembership ? calculateDaysRemaining(commentBotMembership.renewal_period_end) : 0,
        startDate: commentBotMembership?.renewal_period_start || null,
        endDate: commentBotMembership?.renewal_period_end || null,
        membershipId: commentBotMembership?.id || null,
        checkoutLink: env.WHOP_COMMENT_BOT_CHECKOUT_LINK || null,
        totalCredits: commentBotTotalCredits,
        creditMemberships: commentBotCredits
      },
      bc_gen: {
        isActive: !!bcGenMembership,
        expiresIn: bcGenMembership ? calculateDaysRemaining(bcGenMembership.renewal_period_end) : 0,
        startDate: bcGenMembership?.renewal_period_start || null,
        endDate: bcGenMembership?.renewal_period_end || null,
        membershipId: bcGenMembership?.id || null,
        checkoutLink: env.WHOP_BC_GEN_CHECKOUT_LINK || null,
        totalCredits: bcGenTotalCredits,
        creditMemberships: bcGenCredits
      },
      dashboard: {
        isActive: !!dashboardMembership,
        expiresIn: dashboardMembership ? calculateDaysRemaining(dashboardMembership.renewal_period_end) : 0,
        startDate: dashboardMembership?.renewal_period_start || null,
        endDate: dashboardMembership?.renewal_period_end || null,
        membershipId: dashboardMembership?.id || null,
        checkoutLink: env.WHOP_DASHBOARD_CHECKOUT_LINK || null
      },
      virtual_assistant: {
        isActive: false,
        expiresIn: 0,
        checkoutLink: null,
        totalCredits: virtualAssistantTotalCredits,
        creditMemberships: virtualAssistantCredits
      }
    };
    
    console.log('[VA Debug] Returning assisted account data for user:', targetUser.email);
    console.log('[VA Debug] Subscription summary:', {
      comment_bot: subscriptions.comment_bot.isActive,
      bc_gen: subscriptions.bc_gen.isActive,
      dashboard: subscriptions.dashboard.isActive,
      virtual_assistant_credits: subscriptions.virtual_assistant.totalCredits
    });
    
    return new Response(JSON.stringify({ 
      success: true,
      user: targetUser,
      subscriptions: subscriptions,
      virtualAssistantInfo: {
        assisting: true,
        expiresAt: isAssistant.expires_at
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get virtual assistant data error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get virtual assistant data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
*/

// Main auth handler
async function handleAuth(request, env) {
  // Initialize tables if needed (this will only create them if they don't exist)
  await initializeAuthTables(env);
  
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Handle OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }
  
  // Route to appropriate handler
  if (pathname === '/api/auth/signin') {
    return handleSignin(request, env);
  } else if (pathname === '/api/auth/callback/whop') {
    return handleCallback(request, env);
  } else if (pathname === '/api/auth/logout') {
    return handleLogout(request, env);
  } else if (pathname === '/api/auth/check-access') {
    return handleCheckAccess(request, env);
  } else if (pathname === '/api/auth/user') {
    return handleGetUser(request, env);
  } else if (pathname === '/api/auth/create-checkout') {
    return handleCreateCheckout(request, env);
  } else if (pathname === '/api/auth/use-credits') {
    return handleUseCredits(request, env);
  } else if (pathname === '/api/auth/checkout-link') {
    return new Response(JSON.stringify({ checkoutLink: env.WHOP_COMMENT_BOT_CHECKOUT_LINK }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } else if (pathname === '/api/auth/pricing') {
    return new Response(JSON.stringify({ 
      commentBotCreditPrice: COMMENT_BOT_CREDIT_PRICE,
      bcGenCreditPrice: BC_GEN_CREDIT_PRICE,
      virtualAssistantCreditPrice: VIRTUAL_ASSISTANT_CREDIT_PRICE
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } else if (pathname === '/api/auth/virtual-assistants' && request.method === 'GET') {
    return handleGetVirtualAssistants(request, env);
  } else if (pathname === '/api/auth/virtual-assistants' && request.method === 'POST') {
    return handleAddVirtualAssistant(request, env);
  } else if (pathname === '/api/auth/virtual-assistants/extend' && request.method === 'POST') {
    return handleExtendVirtualAssistant(request, env);
  } else if (pathname === '/api/auth/virtual-assistants/edit' && request.method === 'PUT') {
    return handleEditVirtualAssistant(request, env);
  } else if (pathname.startsWith('/api/auth/virtual-assistants/') && request.method === 'DELETE') {
    return handleRemoveVirtualAssistant(request, env);
  } else if (pathname === '/api/auth/virtual-assistant/start' && request.method === 'POST') {
    return handleStartVirtualAssistantMode(request, env);
  } else if (pathname === '/api/auth/virtual-assistant/end' && request.method === 'POST') {
    return handleEndVirtualAssistantMode(request, env);
  }
  
  return new Response('Not found', { status: 404 });
}

// Start virtual assistant mode
async function handleStartVirtualAssistantMode(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { targetUserId } = await request.json();
    
    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'Target user ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify the current user is a virtual assistant for the target user
    const vaQuery = `
      SELECT * FROM virtual_assistants 
      WHERE user_id = ? 
      AND email = ?
      AND status = 'active'
      AND expires_at > datetime('now')
    `;
    
    const vaResult = await env.USERS_DB.prepare(vaQuery)
      .bind(targetUserId, session.user.email)
      .first();
      
    if (!vaResult) {
      return new Response(JSON.stringify({ 
        error: 'Not authorized as virtual assistant for this user'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Update session to include virtual assistant context
    const updateQuery = `
      UPDATE sessions 
      SET user_data = ?, updated_at = datetime('now')
      WHERE session_id = ?
    `;
    
    const userData = JSON.parse(session.user_data);
    const updatedUserData = {
      ...userData,
      virtualAssistantMode: {
        targetUserId: targetUserId,
        originalUserId: session.user.id,
        originalEmail: session.user.email,
        startedAt: new Date().toISOString()
      }
    };
    
    await env.USERS_DB.prepare(updateQuery)
      .bind(JSON.stringify(updatedUserData), sessionId)
      .run();
    
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Virtual assistant mode started',
      targetUserId: targetUserId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Start virtual assistant mode error:', error);
    return new Response(JSON.stringify({ error: 'Failed to start virtual assistant mode' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// End virtual assistant mode
async function handleEndVirtualAssistantMode(request, env) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Update session to remove virtual assistant context
    const updateQuery = `
      UPDATE sessions 
      SET user_data = ?, updated_at = datetime('now')
      WHERE session_id = ?
    `;
    
    const userData = JSON.parse(session.user_data);
    delete userData.virtualAssistantMode;
    
    await env.USERS_DB.prepare(updateQuery)
      .bind(JSON.stringify(userData), sessionId)
      .run();
    
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Virtual assistant mode ended'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('End virtual assistant mode error:', error);
    return new Response(JSON.stringify({ error: 'Failed to end virtual assistant mode' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Middleware to check authentication
async function requireAuth(request, env, handler) {
  const sessionId = getSessionIdFromCookie(request);
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  let session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if this session is in virtual assistant mode
  const userData = session.user_data ? JSON.parse(session.user_data) : {};
  const virtualAssistantMode = userData.virtualAssistantMode;
  
  if (virtualAssistantMode && virtualAssistantMode.targetUserId) {
    const targetUserId = virtualAssistantMode.targetUserId;
    
    // Verify the current user is a virtual assistant for the target user
    const vaQuery = `
      SELECT * FROM virtual_assistants 
      WHERE user_id = ? 
      AND email = ?
      AND status = 'active'
      AND expires_at > datetime('now')
    `;
    
    const vaResult = await env.USERS_DB.prepare(vaQuery)
      .bind(targetUserId, session.user.email)
      .first();
      
      
    if (!vaResult) {
      return new Response(JSON.stringify({ 
        error: 'Not authorized as virtual assistant for this user'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    
    // Get the target user's session to access their data
    const targetSessionQuery = `
      SELECT * FROM sessions 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
    
    const targetSession = await env.USERS_DB.prepare(targetSessionQuery)
      .bind(targetUserId)
      .first();
      
    if (targetSession && targetSession.access_token) {
      // Parse the target user data
      let targetUserData;
      try {
        targetUserData = JSON.parse(targetSession.user_data);
      } catch (e) {
        targetUserData = {};
      }
      
      // Use the target user's session for the rest of the function
      session = {
        ...targetSession,
        user_id: targetUserId, // Add user_id at root level for compatibility
        user: {
          id: targetUserId,
          ...targetUserData,
          isVirtualAssistant: true,
          assistingFor: targetUserData.email,
          originalUserId: session.user.id,
          originalEmail: session.user.email
        }
      };
      
    }
  }
  
  // Pass session as third parameter to handler
  return handler(request, env, session);
}

export { 
  handleAuth,
  requireAuth,
  getSession,
  cleanExpiredSessions,
  isAdminUser
};