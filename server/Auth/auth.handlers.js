import { getSession, setSession, deleteSession, getSessionIdFromCookie, createSessionCookie, generateSessionId, generateRandomString } from './session.service.js';

export async function handleSignin(request, env) {
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

  let sessionId = getSessionIdFromCookie(request);
  let existingSession = null;

  if (sessionId) {
    existingSession = await getSession(env.USERS_DB, sessionId);
  }

  if (!existingSession) {
    sessionId = generateSessionId();
  }

  const state = generateRandomString();
  await setSession(env.USERS_DB, sessionId, { state });
  const stateWithSession = `${state}.${sessionId}`;

  const url = new URL(request.url);
  const origin = request.headers.get('origin') || `${url.protocol}//${url.host}`;
  const redirectUri = `${origin}/auth/callback/whop`;

  console.log('OAuth redirect URI:', {
    origin: origin,
    redirectUri: redirectUri,
    envUrl: env.NEXTAUTH_URL
  });

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

  return new Response(JSON.stringify({ authUrl }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': createSessionCookie(sessionId, env.NODE_ENV === 'production')
    }
  });
}

export async function handleCallback(request, env) {
  let code, stateParam;

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

  const [state, sessionIdFromState] = stateParam.split('.');
  let sessionId = getSessionIdFromCookie(request) || sessionIdFromState;

  if (!sessionId) {
    console.error('No session ID found in cookie or state');
    return new Response('Session not found', { status: 400 });
  }

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

    const authString = `${env.WHOP_OAUTH_CLIENT_ID}:${env.WHOP_OAUTH_CLIENT_SECRET}`;
    const authHeader = 'Basic ' + btoa(authString);
    console.log(authHeader);

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

    await setSession(env.USERS_DB, sessionId, {
      user: {
        id: userInfo.id,
        name: userInfo.username,
        email: userInfo.email,
        image: userInfo.profile_pic_url
      },
      accessToken: tokens.access_token
    });

    if (request.method === 'POST') {
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

export async function handleLogout(request, env) {
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

export async function getUserTeam(env, userId) {
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