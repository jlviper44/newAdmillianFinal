import { executeQuery } from '../features/sql/sql.controller.js';

export function generateRandomString(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generateSessionId() {
  return `sess_${generateRandomString(32)}`;
}

export async function fetchAllMemberships(accessToken, perPage = 100) {
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

      if (data.pagination) {
        const { current_page, total_pages, next_page } = data.pagination;
        hasMorePages = current_page < total_pages && next_page !== null;
        currentPage = next_page || currentPage + 1;
      } else {
        hasMorePages = false;
      }

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

export async function getSession(db, sessionId) {
  const query = 'SELECT * FROM sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP';
  const result = await executeQuery(db, query, [sessionId]);

  if (result.success && result.data.length > 0) {
    const session = result.data[0];
    session.user = JSON.parse(session.user_data);
    return session;
  }
  return null;
}

export async function setSession(db, sessionId, data, expiresIn = 24 * 60 * 60 * 1000) {
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

export async function deleteSession(db, sessionId) {
  const query = 'DELETE FROM sessions WHERE session_id = ?';
  return await executeQuery(db, query, [sessionId]);
}

export async function cleanExpiredSessions(db) {
  const query = 'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP';
  return await executeQuery(db, query);
}

export function getSessionIdFromCookie(request) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;

  const match = cookie.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

export function createSessionCookie(sessionId, secure = false) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
  return `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}${secure ? '; Secure' : ''}`;
}