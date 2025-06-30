/**
 * Logs handler for the Dashboard
 * Provides logs functionality with local data
 */

/**
 * Handle logs API requests
 */
export async function handleLogsData(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    // Special handling for campaigns list endpoint
    if (path === '/api/logs/campaigns/list') {
      return getCampaignsList(request, env);
    }
    
    // For now, return mock data for other logs endpoints
    // Since the external logs worker is not accessible in development
    
    if (path === '/api/logs/summary') {
      return new Response(
        JSON.stringify({
          total: 0,
          conversionRate: 0,
          blocked: 0,
          first10: 0,
          last24Hours: {
            total: 0,
            passed: 0,
            blocked: 0
          }
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (path === '/api/logs') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      
      return new Response(
        JSON.stringify({
          logs: [],
          pagination: {
            total: 0,
            page: page,
            limit: limit,
            totalPages: 0
          }
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // For other endpoints, return empty data
    return new Response(
      JSON.stringify({ 
        message: 'Logs endpoint not implemented in development mode',
        data: []
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
  } catch (error) {
    console.error('Error handling logs request:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch logs data',
        message: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Get campaigns list from the campaigns table
 */
export async function getCampaignsList(request, env) {
  try {
    const db = env.DASHBOARD_DB;
    
    // Get user_id from session
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
      throw new Error('Invalid or expired session');
    }
    
    const userId = session.user_id;
    
    // Fetch campaigns for this user
    const campaigns = await db.prepare(
      'SELECT id, name FROM campaigns WHERE user_id = ? ORDER BY name ASC'
    ).bind(userId).all();
    
    const campaignsList = (campaigns.results || []).map(campaign => ({
      id: campaign.id,
      name: campaign.name
    }));
    
    return new Response(
      JSON.stringify({ 
        campaigns: campaignsList
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error fetching campaigns list:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch campaigns list',
        message: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export default {
  handleLogsData,
  getCampaignsList
};