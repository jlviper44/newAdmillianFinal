// Auth.js - OAuth authentication system for Cloudflare Workers
import { executeQuery } from '../SQL/SQL.js';

// Hard-coded admin users who bypass payment requirements (using emails)
const ADMIN_EMAILS = [
  'justin.m.lee.dev@gmail.com', 
  'cranapplellc@gmail.com',
  'vl@black.com',
  // 'jlrockfish13@gmail.com'
]; // Update these with actual admin emails

// Pricing constants (price per credit)
const COMMENT_BOT_CREDIT_PRICE = 3.00; // $2 per credit
const BC_GEN_CREDIT_PRICE = 2.00; // $2 per credit

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
    
    return true;
  } catch (error) {
    console.error('Error initializing auth tables:', error);
    return false;
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
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = await getSession(env.USERS_DB, sessionId);
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
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Fetch user's team information
  const userTeam = session.user?.id ? await getUserTeam(env, session.user.id) : null;
  
  // Check if user is an admin - admins get unlimited access
  if (session.user && session.user.email && isAdminUser(session.user.email)) {
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
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Fetch user memberships
    const membershipResponse = await fetch('https://api.whop.com/api/v5/me/memberships', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    if (!membershipResponse.ok) {
      return new Response(JSON.stringify({ hasAccess: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const memberships = await membershipResponse.json();
    
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
    const dashboardMembership = memberships.data?.find(membership => 
      membership.plan_id === env.WHOP_DASHBOARD_PLAN_ID &&
      membership.status === 'active'
    );
    
    // Calculate credits for each product type
    const commentBotCredits = memberships.data?.filter(m => 
      m.metadata?.Quantity && 
      (m.metadata?.ProductType === 'comment_bot' || 
       m.product_id === env.WHOP_COMMENT_BOT_PRODUCT_ID)
    ) || [];
    
    const bcGenCredits = memberships.data?.filter(m => 
      m.metadata?.Quantity && 
      (m.metadata?.ProductType === 'bc_gen' || 
       m.product_id === env.WHOP_BC_GEN_PRODUCT_ID)
    ) || [];
    
    // Calculate total credits for each type
    const commentBotTotalCredits = commentBotCredits.reduce((sum, m) => 
      sum + (parseInt(m.metadata.Quantity) || 0), 0);
    const bcGenTotalCredits = bcGenCredits.reduce((sum, m) => 
      sum + (parseInt(m.metadata.Quantity) || 0), 0);
    
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
      }
    };
    
    return new Response(JSON.stringify({ 
      user: { ...session.user, isAdmin: false, team: userTeam },
      memberships: memberships.data,
      subscriptions
    }), {
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
        dashboard: { isActive: false, expiresIn: 0, checkoutLink: env.WHOP_DASHBOARD_CHECKOUT_LINK || null }
      }
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
  
  const session = await getSession(env.USERS_DB, sessionId);
  
  // Ensure we have a valid user with required fields
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
  if (!['comment_bot', 'bc_gen'].includes(productType)) {
    return new Response(JSON.stringify({ error: 'Invalid product type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get product ID based on type
  const productId = productType === 'comment_bot' 
    ? env.WHOP_COMMENT_BOT_PRODUCT_ID 
    : env.WHOP_BC_GEN_PRODUCT_ID;
  
  const productName = productType === 'comment_bot' ? 'Comment Bot' : 'BC Gen';
  
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
        initial_price: quantity * (productType === 'comment_bot' ? COMMENT_BOT_CREDIT_PRICE : BC_GEN_CREDIT_PRICE),
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
  
  const { credits, productType = 'comment_bot' } = await request.json();
  
  // Check if user is an admin - admins don't need to use credits
  if (session.user && session.user.email && isAdminUser(session.user.email)) {
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
  if (!['comment_bot', 'bc_gen'].includes(productType)) {
    return new Response(JSON.stringify({ error: 'Invalid product type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get product ID for filtering
  const productId = productType === 'comment_bot' 
    ? env.WHOP_COMMENT_BOT_PRODUCT_ID 
    : env.WHOP_BC_GEN_PRODUCT_ID;
  
  try {
    // Get user's memberships
    const membershipResponse = await fetch('https://api.whop.com/api/v5/me/memberships', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    if (!membershipResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch memberships' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const memberships = await membershipResponse.json();
    
    // Filter memberships with credits for the specific product type
    const creditMemberships = memberships.data?.filter(m => 
      m.metadata?.Quantity && 
      parseInt(m.metadata.Quantity) > 0 &&
      (m.metadata?.ProductType === productType || m.product_id === productId)
    ) || [];
    
    // Sort by quantity (ascending) to use smaller quantities first
    creditMemberships.sort((a, b) => 
      parseInt(a.metadata.Quantity) - parseInt(b.metadata.Quantity)
    );
    
    let remainingCredits = credits;
    const updates = [];
    
    // Calculate credit usage
    for (const membership of creditMemberships) {
      if (remainingCredits <= 0) break;
      
      const currentQuantity = parseInt(membership.metadata.Quantity);
      const toSubtract = Math.min(currentQuantity, remainingCredits);
      const newQuantity = currentQuantity - toSubtract;
      
      updates.push({
        membershipId: membership.id,
        oldQuantity: currentQuantity,
        newQuantity: newQuantity,
        creditsUsed: toSubtract
      });
      
      remainingCredits -= toSubtract;
    }
    
    if (remainingCredits > 0) {
      return new Response(JSON.stringify({ 
        error: 'Insufficient credits available',
        requested: credits,
        available: credits - remainingCredits
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
      bcGenCreditPrice: BC_GEN_CREDIT_PRICE
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Not found', { status: 404 });
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
  
  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
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