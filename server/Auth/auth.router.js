// auth.router.js - Main router and middleware for authentication
import { initializeAuthTables } from './auth.db.js';
import {
  COMMENT_BOT_CREDIT_PRICE,
  BC_GEN_CREDIT_PRICE,
  VIRTUAL_ASSISTANT_CREDIT_PRICE
} from './auth.config.js';
import {
  handleSignin,
  handleCallback,
  handleLogout
} from './auth.handlers.js';
import {
  handleCheckAccess,
  handleGetUser
} from './access.service.js';
import {
  handleCreateCheckout,
  handleUseCredits
} from './checkout.service.js';
import {
  handleGetVirtualAssistants,
  handleAddVirtualAssistant,
  handleExtendVirtualAssistant,
  handleEditVirtualAssistant,
  handleRemoveVirtualAssistant,
  handleStartVirtualAssistantMode,
  handleEndVirtualAssistantMode
} from './virtual-assistant.service.js';
import {
  getSession,
  getSessionIdFromCookie
} from './session.service.js';

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
  } else if (pathname === '/api/auth/callback/whop' || pathname === '/auth/callback/whop') {
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

// Middleware to check authentication
async function requireAuth(request, env, handler) {
  // Debug logging for queue endpoints
  const url = new URL(request.url);
  const type = url.searchParams.get('type');

  const sessionId = getSessionIdFromCookie(request);

  if (!sessionId) {
    console.log('requireAuth: No session ID found for:', request.url);
    return new Response(JSON.stringify({ error: 'Unauthorized - No session' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    console.log('requireAuth: Invalid session for:', request.url);
    return new Response(JSON.stringify({ error: 'Unauthorized - Invalid session' }), {
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
  requireAuth
};