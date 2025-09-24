// virtual-assistant.service.js - Virtual Assistant Management Service
// Extracted from Auth.js for better code organization

import { executeQuery } from '../features/sql/sql.controller.js';

// Pricing constant
const VIRTUAL_ASSISTANT_CREDIT_PRICE = 50.00; // $50 per credit

// Hard-coded admin users who bypass payment requirements (using emails)
const ADMIN_EMAILS = [
  'justin.m.lee.dev@gmail.com',
  'cranapplellc@gmail.com',
  'vl@black.com',
  'sackjulisa@gmail.com',
  'alexuvaro00@gmail.com',
  'kevinpuxingzhou@gmail.com',
  'antonloth79028@gmail.com'
];

// Helper function to check if a user is an admin by email
function isAdminUser(userEmail) {
  return ADMIN_EMAILS.includes(userEmail);
}

// Helper function to generate random strings
function generateRandomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get session ID from cookie
function getSessionIdFromCookie(request) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;

  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
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

/**
 * Fetch all memberships with pagination support
 * @param {string} accessToken - The user's access token
 * @param {number} perPage - Number of items per page (default 100, max 123 based on API docs)
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

/**
 * Get virtual assistant accounts for a user
 * @param {Object} env - Environment bindings
 * @param {string} userEmail - Email of the virtual assistant
 * @returns {Promise<Array>} - Array of accounts where user is a virtual assistant
 */
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
        has_bc_gen_access,
        dashboard_metrics,
        dashboard_campaigns,
        dashboard_launches,
        dashboard_sparks,
        dashboard_templates,
        dashboard_shopify,
        dashboard_logs,
        dashboard_link_splitter
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
            has_bc_gen_access: row.has_bc_gen_access,
            dashboard_metrics: row.dashboard_metrics,
            dashboard_campaigns: row.dashboard_campaigns,
            dashboard_launches: row.dashboard_launches,
            dashboard_sparks: row.dashboard_sparks,
            dashboard_templates: row.dashboard_templates,
            dashboard_shopify: row.dashboard_shopify,
            dashboard_logs: row.dashboard_logs,
            dashboard_link_splitter: row.dashboard_link_splitter
          });
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

/**
 * Get virtual assistants for a user
 */
export async function handleGetVirtualAssistants(request, env) {
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
             dashboard_metrics, dashboard_campaigns, dashboard_launches, dashboard_sparks,
             dashboard_templates, dashboard_shopify, dashboard_logs,
             dashboard_link_splitter,
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
        has_bc_gen_access: assistant.has_bc_gen_access === 1,
        // Dashboard permissions
        dashboard_metrics: assistant.dashboard_metrics === 1,
        dashboard_campaigns: assistant.dashboard_campaigns === 1,
        dashboard_launches: assistant.dashboard_launches === 1,
        dashboard_sparks: assistant.dashboard_sparks === 1,
        dashboard_templates: assistant.dashboard_templates === 1,
        dashboard_shopify: assistant.dashboard_shopify === 1,
        dashboard_logs: assistant.dashboard_logs === 1,
        dashboard_link_splitter: assistant.dashboard_link_splitter === 1
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

/**
 * Add virtual assistant handler
 * Note: This function requires handleCheckAccess and handleUseCredits to be imported from Auth.js
 */
export async function handleAddVirtualAssistant(request, env, { handleCheckAccess, handleUseCredits }) {
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
    const {
      email,
      hasCommentBotAccess = false,
      hasDashboardAccess = false,
      hasBCGenAccess = false,
      // Dashboard permissions - no defaults, use what's sent
      dashboardMetrics,
      dashboardCampaigns,
      dashboardLaunches,
      dashboardSparks,
      dashboardTemplates,
      dashboardShopify,
      dashboardLogs,
      dashboardLinkSplitter
    } = await request.json();

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
        dashboard_metrics, dashboard_campaigns, dashboard_launches, dashboard_sparks,
        dashboard_templates, dashboard_shopify, dashboard_logs,
        dashboard_link_splitter,
        created_at, expires_at
      )
      VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await env.USERS_DB.prepare(insertQuery)
      .bind(
        id, session.user.id, email,
        hasCommentBotAccess ? 1 : 0,
        hasDashboardAccess ? 1 : 0,
        hasBCGenAccess ? 1 : 0,
        dashboardMetrics === true ? 1 : 0,
        dashboardCampaigns === true ? 1 : 0,
        dashboardLaunches === true ? 1 : 0,
        dashboardSparks === true ? 1 : 0,
        dashboardTemplates === true ? 1 : 0,
        dashboardShopify === true ? 1 : 0,
        dashboardLogs === true ? 1 : 0,
        dashboardLinkSplitter === true ? 1 : 0,
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
        has_comment_bot_access: hasCommentBotAccess === true,
        has_dashboard_access: hasDashboardAccess === true,
        has_bc_gen_access: hasBCGenAccess === true,
        dashboard_metrics: dashboardMetrics === true,
        dashboard_campaigns: dashboardCampaigns === true,
        dashboard_launches: dashboardLaunches === true,
        dashboard_sparks: dashboardSparks === true,
        dashboard_templates: dashboardTemplates === true,
        dashboard_shopify: dashboardShopify === true,
        dashboard_logs: dashboardLogs === true,
        dashboard_link_splitter: dashboardLinkSplitter === true,
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

/**
 * Extend virtual assistant time handler
 * Note: This function requires handleCheckAccess and handleUseCredits to be imported from Auth.js
 */
export async function handleExtendVirtualAssistant(request, env, { handleCheckAccess, handleUseCredits }) {
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

/**
 * Edit virtual assistant email handler
 */
export async function handleEditVirtualAssistant(request, env) {
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
    const {
      assistantId,
      newEmail,
      hasCommentBotAccess = false,
      hasDashboardAccess = false,
      hasBCGenAccess = false,
      // Dashboard permissions - no defaults, use what's sent
      dashboardMetrics,
      dashboardCampaigns,
      dashboardLaunches,
      dashboardSparks,
      dashboardTemplates,
      dashboardShopify,
      dashboardLogs,
      dashboardLinkSplitter
    } = await request.json();

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
          has_bc_gen_access = ?,
          dashboard_metrics = ?,
          dashboard_campaigns = ?,
          dashboard_launches = ?,
          dashboard_sparks = ?,
          dashboard_templates = ?,
          dashboard_shopify = ?,
          dashboard_logs = ?,
          dashboard_link_splitter = ?
      WHERE id = ? AND user_id = ?
    `;

    await env.USERS_DB.prepare(updateQuery)
      .bind(
        newEmail,
        hasCommentBotAccess ? 1 : 0,
        hasDashboardAccess ? 1 : 0,
        hasBCGenAccess ? 1 : 0,
        dashboardMetrics === true ? 1 : 0,
        dashboardCampaigns === true ? 1 : 0,
        dashboardLaunches === true ? 1 : 0,
        dashboardSparks === true ? 1 : 0,
        dashboardTemplates === true ? 1 : 0,
        dashboardShopify === true ? 1 : 0,
        dashboardLogs === true ? 1 : 0,
        dashboardLinkSplitter === true ? 1 : 0,
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

/**
 * Remove virtual assistant handler
 */
export async function handleRemoveVirtualAssistant(request, env) {
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

/**
 * Get virtual assistant accounts handler
 */
export async function handleGetVirtualAssistantAccounts(request, env) {
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

/**
 * Get virtual assistant data handler
 */
export async function handleGetVirtualAssistantData(request, env) {
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

/**
 * Start virtual assistant mode
 */
export async function handleStartVirtualAssistantMode(request, env) {
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

/**
 * End virtual assistant mode
 */
export async function handleEndVirtualAssistantMode(request, env) {
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