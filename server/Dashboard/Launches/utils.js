/**
 * Shared utility functions for Dashboard modules
 */

/**
 * Extract user_id and team_id from session
 */
export async function getUserInfoFromSession(request, env) {
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
      throw new Error('Session not found or expired');
    }
    
    const teamId = await getUserTeamId(env, session.user_id);
    return { userId: session.user_id, teamId };
    
  } catch (error) {
    console.error('Error getting user info from session:', error);
    throw error;
  }
}

/**
 * Get user's team ID
 */
export async function getUserTeamId(env, userId) {
  try {
    const teamMember = await env.USERS_DB.prepare(
      'SELECT team_id FROM team_members WHERE user_id = ?'
    ).bind(userId).first();
    
    return teamMember ? teamMember.team_id : null;
  } catch (error) {
    console.error('Error getting user team:', error);
    return null;
  }
}

// Default export with all utility functions
export default {
  getUserInfoFromSession,
  getUserTeamId
};