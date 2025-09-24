const ADMIN_EMAILS = [
  'justin.m.lee.dev@gmail.com',
  'cranapplellc@gmail.com',
  'vl@black.com',
  'sackjulisa@gmail.com',
  'alexuvaro00@gmail.com',
  'kevinpuxingzhou@gmail.com',
  'antonloth79028@gmail.com'
];

export function isAdminUser(userEmail) {
  return ADMIN_EMAILS.includes(userEmail);
}

function getSessionIdFromCookie(request) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;

  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

async function getSession(db, sessionId) {
  try {
    const session = await db.prepare(
      'SELECT * FROM sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP'
    ).bind(sessionId).first();

    if (!session) return null;

    if (session.user_data) {
      try {
        session.user = JSON.parse(session.user_data);
      } catch (e) {
        console.error('Failed to parse user data:', e);
        session.user = {};
      }
    }

    return session;
  } catch (error) {
    console.error('Error fetching session:', error);
    return null;
  }
}

export async function requireAuth(request, env, handler) {
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

  const userData = session.user_data ? JSON.parse(session.user_data) : {};
  const virtualAssistantMode = userData.virtualAssistantMode;

  console.log('[AUTH MIDDLEWARE] Session data:', {
    hasVAMode: !!virtualAssistantMode,
    targetUserId: virtualAssistantMode?.targetUserId,
    currentUserId: session.user_id,
    url: request.url
  });

  if (virtualAssistantMode && virtualAssistantMode.targetUserId) {
    const targetUserId = virtualAssistantMode.targetUserId;

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

    const targetSessionQuery = `
      SELECT * FROM sessions
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const targetSession = await env.USERS_DB.prepare(targetSessionQuery)
      .bind(targetUserId)
      .first();

    console.log('[AUTH MIDDLEWARE] Target user lookup:', {
      targetUserId,
      found: !!targetSession,
      hasAccessToken: !!targetSession?.access_token
    });

    if (targetSession && targetSession.access_token) {
      try {
        const targetUserData = JSON.parse(targetSession.user_data);

        // Replace the entire session object with the target user's session
        session = {
          ...targetSession,
          user_id: targetUserId,
          user: {
            id: targetUserId,
            ...targetUserData,
            isVirtualAssistant: true,
            assistingFor: targetUserData.email,
            originalUserId: session.user.id,
            originalEmail: session.user.email
          }
        };

        console.log('Virtual assistant mode - acting as:', {
          targetUserId,
          vaEmail: session.user.originalEmail,
          targetUserEmail: targetUserData.email,
          sessionUserIdSet: session.user_id
        });
      } catch (e) {
        console.error('Failed to parse target user data:', e);
      }
    }
  }

  console.log('[AUTH MIDDLEWARE] Final session before handler:', {
    user_id: session.user_id,
    user_id_from_user: session.user?.id,
    isVA: session.user?.isVirtualAssistant
  });

  return handler(request, env, session);
}