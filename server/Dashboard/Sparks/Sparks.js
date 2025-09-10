/**
 * Sparks API Handler
 * Manages all spark-related API endpoints for TikTok ad campaigns
 */

/**
 * Initialize sparks table if it doesn't exist
 */
async function initializeSparksTable(db) {
  try {
    // First check if table exists and what columns it has
    const tableInfo = await db.prepare(`PRAGMA table_info(sparks)`).all();
    
    if (tableInfo.results && tableInfo.results.length > 0) {
      // Table exists, check if it has the old schema (with data column)
      const hasDataColumn = tableInfo.results.some(col => col.name === 'data');
      const hasNameColumn = tableInfo.results.some(col => col.name === 'name');
      
      const hasUserIdColumn = tableInfo.results.some(col => col.name === 'user_id');
      
      if (hasDataColumn && !hasNameColumn) {
        console.log('Migrating sparks table from old schema to new schema...');
        
        // Create new table with proper schema
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS sparks_new (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            team_id TEXT,
            name TEXT NOT NULL,
            tiktok_link TEXT NOT NULL,
            spark_code TEXT NOT NULL,
            offer TEXT NOT NULL,
            offer_name TEXT,
            thumbnail TEXT,
            status TEXT DEFAULT 'active',
            traffic INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
        
        // Migrate data from old table
        const oldData = await db.prepare('SELECT * FROM sparks').all();
        for (const row of oldData.results || []) {
          try {
            const sparkData = JSON.parse(row.data);
            await db.prepare(`
              INSERT INTO sparks_new 
              (id, user_id, name, tiktok_link, spark_code, offer, offer_name, thumbnail, 
               status, traffic, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              row.id,
              row.user_id || 'default_user', // Use existing user_id or default
              sparkData.name || 'Untitled Spark',
              sparkData.tiktokLink || '',
              sparkData.sparkCode || '',
              sparkData.offer || '',
              sparkData.offerName || null,
              sparkData.thumbnail || null,
              sparkData.status || 'active',
              sparkData.traffic || 0,
              sparkData.createdAt || row.created_at,
              sparkData.updatedAt || row.updated_at
            ).run();
          } catch (e) {
            console.error(`Failed to migrate spark ${row.id}:`, e);
          }
        }
        
        // Drop old table and rename new table
        await db.prepare('DROP TABLE sparks').run();
        await db.prepare('ALTER TABLE sparks_new RENAME TO sparks').run();
        
        console.log('Migration completed successfully');
      } else if (!hasUserIdColumn) {
        // Table exists with new schema but missing user_id column
        console.log('Table exists but missing user_id column, will add it later...');
      }
    } else {
      // Table doesn't exist, create it with new schema
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS sparks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          team_id TEXT,
          name TEXT NOT NULL,
          creator TEXT DEFAULT '',
          type TEXT DEFAULT 'auto',
          tiktok_link TEXT NOT NULL,
          spark_code TEXT NOT NULL,
          offer TEXT NOT NULL,
          offer_name TEXT,
          thumbnail TEXT,
          status TEXT DEFAULT 'active',
          traffic INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    }

    // Create indexes for better performance
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sparks_status ON sparks(status)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sparks_offer ON sparks(offer)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sparks_created ON sparks(created_at)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_sparks_user_id ON sparks(user_id)
    `).run();
    
    // Add user_id, team_id, creator, and type columns if they don't exist (for existing tables)
    try {
      // Check if columns exist
      const tableInfo = await db.prepare(`PRAGMA table_info(sparks)`).all();
      const hasUserIdColumn = tableInfo.results.some(col => col.name === 'user_id');
      const hasTeamIdColumn = tableInfo.results.some(col => col.name === 'team_id');
      const hasCreatorColumn = tableInfo.results.some(col => col.name === 'creator');
      const hasTypeColumn = tableInfo.results.some(col => col.name === 'type');
      
      if (!hasUserIdColumn) {
        console.log('Adding user_id column to existing sparks table...');
        await db.prepare(`ALTER TABLE sparks ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        console.log('Added user_id column to sparks table');
        
        // Update existing rows to have a default user_id
        await db.prepare(`UPDATE sparks SET user_id = 'default_user' WHERE user_id IS NULL`).run();
        console.log('Updated existing sparks with default user_id');
      }
      
      if (!hasTeamIdColumn) {
        console.log('Adding team_id column to existing sparks table...');
        await db.prepare(`ALTER TABLE sparks ADD COLUMN team_id TEXT`).run();
        console.log('Added team_id column to sparks table');
      }
      
      if (!hasCreatorColumn) {
        console.log('Adding creator column to existing sparks table...');
        await db.prepare(`ALTER TABLE sparks ADD COLUMN creator TEXT DEFAULT ''`).run();
        console.log('Added creator column to sparks table');
      }
      
      if (!hasTypeColumn) {
        console.log('Adding type column to existing sparks table...');
        await db.prepare(`ALTER TABLE sparks ADD COLUMN type TEXT DEFAULT 'auto'`).run();
        console.log('Added type column to sparks table');
      }
    } catch (error) {
      console.error('Error checking/adding columns:', error);
      // Continue execution as this might not be critical
    }

    // Create trigger to automatically update the updated_at timestamp
    await db.prepare(`
      CREATE TRIGGER IF NOT EXISTS update_sparks_timestamp 
      AFTER UPDATE ON sparks
      BEGIN
        UPDATE sparks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `).run();

    console.log('Sparks table initialized successfully');
    return true;
  } catch (error) {
    console.error('Sparks table initialization error:', error);
    return false;
  }
}

/**
 * Get user's team ID from the database
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
 * Extract user_id and team_id from session
 */
async function getUserInfoFromSession(request, env) {
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
    
    // Fallback to cookie-based session extraction
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
    const teamId = await getUserTeamId(env, userId);
    
    return { userId, teamId };
  } catch (error) {
    console.error('Error extracting user info from session:', error);
    throw new Error('Authentication required');
  }
}

/**
 * Check if user has access to a spark
 */
async function checkSparkAccess(db, env, sparkId, userId, teamId) {
  try {
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        return await db.prepare(
          `SELECT * FROM sparks WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(sparkId, ...memberIds, teamId).first();
      } else {
        return await db.prepare(
          'SELECT * FROM sparks WHERE id = ? AND team_id = ?'
        ).bind(sparkId, teamId).first();
      }
    } else {
      return await db.prepare(
        'SELECT * FROM sparks WHERE id = ? AND user_id = ?'
      ).bind(sparkId, userId).first();
    }
  } catch (error) {
    console.error('Error checking spark access:', error);
    return null;
  }
}

/**
 * Main handler for all spark-related API requests
 */
export async function handleSparkData(request, env) {
  // Initialize database reference
  const db = env.DASHBOARD_DB;
  
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
  
  if (!db) {
    console.error('Database connection not found in environment');
    return new Response(
      JSON.stringify({ error: 'Database connection error' }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }
  
  // Ensure sparks table exists
  try {
    await initializeSparksTable(db);
  } catch (error) {
    console.error('Failed to initialize sparks table:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Database initialization error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        } 
      }
    );
  }
  
  // Parse URL and HTTP method
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/sparks', '');
  const method = request.method;
  
  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }
  
  try {
    // List Sparks
    if (path === '' && method === 'GET') {
      return await listSparks(request, db, corsHeaders, env);
    }
    
    // Create Spark
    if (path === '' && method === 'POST') {
      return await createSpark(request, db, corsHeaders, env);
    }
    
    // Get Spark Details
    if (path.match(/^\/[\w-]+$/) && method === 'GET') {
      const sparkId = path.substring(1); // Remove leading slash
      return await getSpark(sparkId, request, db, corsHeaders, env);
    }
    
    // Update Spark
    if (path.match(/^\/[\w-]+$/) && method === 'PUT') {
      const sparkId = path.substring(1); // Remove leading slash
      return await updateSpark(sparkId, request, db, corsHeaders, env);
    }
    
    // Delete Spark
    if (path.match(/^\/[\w-]+$/) && method === 'DELETE') {
      const sparkId = path.substring(1); // Remove leading slash
      return await deleteSpark(sparkId, request, db, corsHeaders, env);
    }
    
    // Toggle Spark Status
    if (path.match(/^\/[\w-]+\/toggle-status$/) && method === 'PUT') {
      const sparkId = path.substring(1).split('/')[0]; // Extract ID from path
      return await toggleSparkStatus(sparkId, request, db, corsHeaders, env);
    }
    
    // Get Spark Stats
    if (path.match(/^\/[\w-]+\/stats$/) && method === 'GET') {
      const sparkId = path.substring(1).split('/')[0]; // Extract ID from path
      return await getSparkStats(sparkId, request, db, corsHeaders, env);
    }
    
    // Extract TikTok Thumbnail
    if (path === '/extract-tiktok-thumbnail' && method === 'POST') {
      return await extractTikTokThumbnail(request, corsHeaders);
    }
    
    // Proxy TikTok thumbnail
    if (path.startsWith('/proxy/tiktok-thumbnail/')) {
      const videoId = path.replace('/proxy/tiktok-thumbnail/', '');
      return await proxyTikTokThumbnail(videoId);
    }
    
    // Unknown endpoint
    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { 
        status: 404, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error in handleSparkData:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
}

/**
 * Extract TikTok thumbnail from video URL
 */
async function extractTikTokThumbnail(request, corsHeaders) {
  try {
    const { tiktokUrl } = await request.json();
    
    if (!tiktokUrl) {
      return new Response(
        JSON.stringify({ error: 'TikTok URL is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Extract video ID from TikTok URL
    const videoId = extractTikTokVideoId(tiktokUrl);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Invalid TikTok URL format' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Return the proxy URL that will fetch the actual thumbnail
    const thumbnailUrl = `/api/sparks/proxy/tiktok-thumbnail/${videoId}`;
    
    return new Response(
      JSON.stringify({
        success: true,
        thumbnailUrl: thumbnailUrl,
        videoId: videoId
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error extracting TikTok thumbnail:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to extract thumbnail',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
}

/**
 * Proxy TikTok thumbnail - this function actually fetches a real frame from the video
 */
async function proxyTikTokThumbnail(videoId) {
  try {
    // Method 1: Try the direct TikTok thumbnail URL pattern
    const directUrl = `https://www.tiktok.com/api/img/?itemId=${videoId}&location=0`;
    
    try {
      const directResponse = await fetch(directUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (directResponse.ok) {
        return new Response(await directResponse.arrayBuffer(), {
          headers: {
            'Content-Type': directResponse.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }
    } catch (directError) {
      console.error('Error fetching direct TikTok thumbnail:', directError);
    }
    
    // Method 2: Try the TikTok video embed endpoint
    const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
    
    const embedResponse = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!embedResponse.ok) {
      throw new Error(`Failed to fetch TikTok embed page: ${embedResponse.status}`);
    }
    
    const html = await embedResponse.text();
    
    // Extract the cover image URL using regex
    // Look for multiple possible patterns
    const patterns = [
      /"cover":"([^"]+)"/,
      /"thumbnailUrl":"([^"]+)"/,
      /"poster":"([^"]+)"/,
      /<meta property="og:image" content="([^"]+)"/,
      /\\"coverUrl\\":\\"([^\\]+)\\"/
    ];
    
    let imageUrl = null;
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        imageUrl = match[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
        break;
      }
    }
    
    if (imageUrl) {
      // Fetch the actual image
      const imgResponse = await fetch(imageUrl);
      
      if (imgResponse.ok) {
        return new Response(await imgResponse.arrayBuffer(), {
          headers: {
            'Content-Type': imgResponse.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }
    }
    
    // Method 3: Try the TikTok OEmbed API
    const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@tiktok/video/${videoId}`;
    
    try {
      const oembedResponse = await fetch(oembedUrl);
      
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        
        if (oembedData.thumbnail_url) {
          const thumbnailResponse = await fetch(oembedData.thumbnail_url);
          
          if (thumbnailResponse.ok) {
            return new Response(await thumbnailResponse.arrayBuffer(), {
              headers: {
                'Content-Type': thumbnailResponse.headers.get('Content-Type') || 'image/jpeg',
                'Cache-Control': 'public, max-age=86400'
              }
            });
          }
        }
      }
    } catch (oembedError) {
      console.error('Error fetching TikTok oembed data:', oembedError);
    }
    
    // Generate a custom thumbnail with the TikTok video ID if all else fails
    return generateCustomThumbnail(videoId);
    
  } catch (error) {
    console.error('Error proxying TikTok thumbnail:', error);
    
    // Generate a custom thumbnail as a last resort
    return generateCustomThumbnail(videoId);
  }
}

/**
 * Generate a custom thumbnail with TikTok video ID
 */
async function generateCustomThumbnail(videoId) {
  try {
    // Create a basic SVG with the TikTok video ID
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
        <rect width="600" height="400" fill="#1F1F1F"/>
        <text x="300" y="180" font-family="Arial" font-size="24" fill="#FFFFFF" text-anchor="middle">TikTok Video</text>
        <text x="300" y="220" font-family="Arial" font-size="16" fill="#FFFFFF" text-anchor="middle">${videoId}</text>
        <path d="M300,260 L330,290 L300,320 L270,290 Z" fill="#EE1D52"/>
      </svg>
    `;
    
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    console.error('Error generating custom thumbnail:', error);
    
    // Return a 1x1 transparent pixel as a last resort
    const transparentPixel = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
      0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xFF, 0xFF, 0xFF, 0x21, 0xF9, 0x04, 0x01, 0x00,
      0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
      0x01, 0x00, 0x3B
    ]);
    
    return new Response(transparentPixel, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  }
}

/**
 * List sparks with pagination and filtering
 */
async function listSparks(request, db, corsHeaders, env) {
  try {
    // First ensure the table has user_id column
    try {
      const tableInfo = await db.prepare(`PRAGMA table_info(sparks)`).all();
      const hasUserIdColumn = tableInfo.results?.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        console.log('Sparks table missing user_id column, adding it now...');
        await db.prepare(`ALTER TABLE sparks ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        await db.prepare(`UPDATE sparks SET user_id = 'default_user' WHERE user_id IS NULL`).run();
      }
    } catch (e) {
      console.error('Error checking/adding user_id column:', e);
    }
    
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'all';
    
    // Build the query - filter by team members if in a team
    let query = 'SELECT * FROM sparks WHERE ';
    const params = [];
    
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        query += `(user_id IN (${memberIds.map(() => '?').join(',')}) OR team_id = ?)`;
        params.push(...memberIds, teamId);
      } else {
        query += 'team_id = ?';
        params.push(teamId);
      }
    } else {
      // Only show user's own sparks
      query += 'user_id = ?';
      params.push(userId);
    }
    
    // Apply search filter
    if (search) {
      query += ' AND (name LIKE ? OR spark_code LIKE ? OR offer_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    // Apply status filter
    if (status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    
    // Add ordering
    query += ' ORDER BY created_at DESC';
    
    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await db.prepare(countQuery).bind(...params).first();
    const totalSparks = countResult.count;
    
    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);
    
    // Execute query
    const result = await db.prepare(query).bind(...params).all();
    const sparks = result.results || [];
    
    const totalPages = Math.ceil(totalSparks / limit);
    
    return new Response(
      JSON.stringify({
        success: true,
        sparks,
        total: totalSparks,
        page,
        limit,
        totalPages
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error listing sparks:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to list sparks',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
}

/**
 * Get a specific spark by ID
 */
async function getSpark(sparkId, request, db, corsHeaders, env) {
  try {
    // First ensure the table has user_id column
    try {
      const tableInfo = await db.prepare(`PRAGMA table_info(sparks)`).all();
      const hasUserIdColumn = tableInfo.results?.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        console.log('Sparks table missing user_id column, adding it now...');
        await db.prepare(`ALTER TABLE sparks ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        await db.prepare(`UPDATE sparks SET user_id = 'default_user' WHERE user_id IS NULL`).run();
      }
    } catch (e) {
      console.error('Error checking/adding user_id column:', e);
    }
    
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    // Check if user has access to the spark
    const spark = await checkSparkAccess(db, env, sparkId, userId, teamId);
    
    if (!spark) {
      return new Response(
        JSON.stringify({ error: 'Spark not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        spark
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error getting spark:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to get spark',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
}

/**
 * Create a new spark
 */
async function createSpark(request, db, corsHeaders, env) {
  try {
    // First ensure the table has user_id column
    try {
      const tableInfo = await db.prepare(`PRAGMA table_info(sparks)`).all();
      const hasUserIdColumn = tableInfo.results?.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        console.log('Sparks table missing user_id column, adding it now...');
        await db.prepare(`ALTER TABLE sparks ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        await db.prepare(`UPDATE sparks SET user_id = 'default_user' WHERE user_id IS NULL`).run();
      }
    } catch (e) {
      console.error('Error checking/adding user_id column:', e);
    }
    
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    const sparkData = await request.json();
    
    // Validate required fields
    if (!sparkData.name) {
      return new Response(
        JSON.stringify({ error: 'Spark name is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    if (!sparkData.tiktokLink) {
      return new Response(
        JSON.stringify({ error: 'TikTok video link is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    if (!sparkData.sparkCode) {
      return new Response(
        JSON.stringify({ error: 'Spark code is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    
    // Generate ID if not provided (8 characters alphanumeric)
    const id = sparkData.id || 'spark' + Math.random().toString(36).substring(2, 10);
    const status = sparkData.status || 'active';
    
    // Get offer name from templates table
    let offerName = sparkData.offer; // Default to offer ID
    try {
      // Check if templates table exists
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT DEFAULT 'general',
          html TEXT NOT NULL,
          version INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      
      // Check template with team permissions
      let template;
      if (teamId) {
        // If user is in a team, get all team members
        const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
        const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
        
        if (teamMembersResult.results && teamMembersResult.results.length > 0) {
          const memberIds = teamMembersResult.results.map(m => m.user_id);
          const placeholders = memberIds.map(() => '?').join(',');
          template = await db.prepare(
            `SELECT name FROM templates WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
          ).bind(sparkData.offer, ...memberIds, teamId).first();
        } else {
          template = await db.prepare(
            'SELECT name FROM templates WHERE id = ? AND team_id = ?'
          ).bind(sparkData.offer, teamId).first();
        }
      } else {
        template = await db.prepare('SELECT name FROM templates WHERE id = ? AND user_id = ?')
          .bind(sparkData.offer, userId)
          .first();
      }
      
      if (template) {
        offerName = template.name;
      } else {
        // Fallback offer names
        const offerNames = {
          'cash750': 'Cash ($750)',
          'cashapp': 'Cash App',
          'walmart': 'Walmart Gift Card',
          'iphone': 'iPhone 15 Pro',
          'macbook': 'MacBook Pro',
          'paypal750': 'PayPal ($750)'
        };
        offerName = offerNames[sparkData.offer] || sparkData.offer;
      }
    } catch (templateError) {
      console.error('Error fetching template:', templateError);
      // Use fallback offer names
      const offerNames = {
        'cash750': 'Cash ($750)',
        'cashapp': 'Cash App',
        'walmart': 'Walmart Gift Card',
        'iphone': 'iPhone 15 Pro',
        'macbook': 'MacBook Pro',
        'paypal750': 'PayPal ($750)'
      };
      offerName = offerNames[sparkData.offer] || sparkData.offer;
    }
    
    // Set thumbnail if not provided
    let thumbnail = sparkData.thumbnail;
    if (!thumbnail) {
      const videoId = extractTikTokVideoId(sparkData.tiktokLink);
      if (videoId) {
        thumbnail = `/api/sparks/proxy/tiktok-thumbnail/${videoId}`;
      } else {
        thumbnail = getFallbackThumbnail();
      }
    } else if (thumbnail.startsWith('/proxy/tiktok-thumbnail/')) {
      // Update old thumbnail URLs
      thumbnail = `/api/sparks${thumbnail}`;
    }
    
    // Insert into database
    await db.prepare(`
      INSERT INTO sparks 
      (id, user_id, team_id, name, creator, type, tiktok_link, spark_code, offer, offer_name, thumbnail, status, traffic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId,
      teamId,
      sparkData.name,
      sparkData.creator || '',  // Empty string for "None"
      sparkData.type || 'auto',
      sparkData.tiktokLink,
      sparkData.sparkCode,
      sparkData.offer || '',
      offerName,
      thumbnail,
      status,
      0
    ).run();
    
    // Fetch the created spark
    const createdSpark = await checkSparkAccess(db, env, id, userId, teamId);
    
    return new Response(
      JSON.stringify({
        success: true,
        spark: createdSpark
      }),
      { 
        status: 201, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error creating spark:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to create spark',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
}

/**
 * Update an existing spark
 */
async function updateSpark(sparkId, request, db, corsHeaders, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    const sparkData = await request.json();
    
    // Check if user has access to the spark
    const existingSpark = await checkSparkAccess(db, env, sparkId, userId, teamId);
    
    if (!existingSpark) {
      return new Response(
        JSON.stringify({ error: 'Spark not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Validate required fields
    if (!sparkData.name) {
      return new Response(
        JSON.stringify({ error: 'Spark name is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    if (!sparkData.tiktokLink) {
      return new Response(
        JSON.stringify({ error: 'TikTok video link is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    if (!sparkData.sparkCode) {
      return new Response(
        JSON.stringify({ error: 'Spark code is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    
    // Handle offer name update
    let offerName = existingSpark.offer_name;
    if (sparkData.offer !== existingSpark.offer) {
      try {
        // Check template with team permissions
        let template;
        if (teamId) {
          // If user is in a team, get all team members
          const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
          const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
          
          if (teamMembersResult.results && teamMembersResult.results.length > 0) {
            const memberIds = teamMembersResult.results.map(m => m.user_id);
            const placeholders = memberIds.map(() => '?').join(',');
            template = await db.prepare(
              `SELECT name FROM templates WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
            ).bind(sparkData.offer, ...memberIds, teamId).first();
          } else {
            template = await db.prepare(
              'SELECT name FROM templates WHERE id = ? AND team_id = ?'
            ).bind(sparkData.offer, teamId).first();
          }
        } else {
          template = await db.prepare('SELECT name FROM templates WHERE id = ? AND user_id = ?')
            .bind(sparkData.offer, userId)
            .first();
        }
        
        if (template) {
          offerName = template.name;
        } else {
          // Fallback offer names
          const offerNames = {
            'cash750': 'Cash ($750)',
            'cashapp': 'Cash App',
            'walmart': 'Walmart Gift Card',
            'iphone': 'iPhone 15 Pro',
            'macbook': 'MacBook Pro',
            'paypal750': 'PayPal ($750)'
          };
          offerName = offerNames[sparkData.offer] || sparkData.offer;
        }
      } catch (templateError) {
        console.error('Error fetching template:', templateError);
        // Use fallback offer names
        const offerNames = {
          'cash750': 'Cash ($750)',
          'cashapp': 'Cash App',
          'walmart': 'Walmart Gift Card',
          'iphone': 'iPhone 15 Pro',
          'macbook': 'MacBook Pro',
          'paypal750': 'PayPal ($750)'
        };
        offerName = offerNames[sparkData.offer] || sparkData.offer;
      }
    }
    
    // Handle thumbnail update
    let thumbnail = sparkData.thumbnail || existingSpark.thumbnail;
    if (sparkData.tiktokLink !== existingSpark.tiktok_link) {
      const videoId = extractTikTokVideoId(sparkData.tiktokLink);
      if (videoId) {
        thumbnail = `/api/sparks/proxy/tiktok-thumbnail/${videoId}`;
      } else {
        thumbnail = getFallbackThumbnail();
      }
    }
    
    // Update the spark
    await db.prepare(`
      UPDATE sparks 
      SET name = ?, creator = ?, type = ?, tiktok_link = ?, spark_code = ?, 
          offer = ?, offer_name = ?, thumbnail = ?, status = ?
      WHERE id = ?
    `).bind(
      sparkData.name,
      sparkData.creator !== undefined ? sparkData.creator : (existingSpark.creator || ''),  // Preserve existing or use empty string
      sparkData.type || existingSpark.type || 'auto',
      sparkData.tiktokLink,
      sparkData.sparkCode,
      sparkData.offer || '',
      offerName,
      thumbnail,
      sparkData.status || existingSpark.status,
      sparkId
    ).run();
    
    // Fetch the updated spark
    const updatedSpark = await db.prepare('SELECT * FROM sparks WHERE id = ?')
      .bind(sparkId)
      .first();
    
    return new Response(
      JSON.stringify({
        success: true,
        spark: updatedSpark
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error updating spark:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to update spark',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
}

/**
 * Delete a spark
 */
async function deleteSpark(sparkId, request, db, corsHeaders, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    // Check if user has access to the spark
    const existingSpark = await checkSparkAccess(db, env, sparkId, userId, teamId);
    
    if (!existingSpark) {
      return new Response(
        JSON.stringify({ error: 'Spark not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Delete the spark
    await db.prepare('DELETE FROM sparks WHERE id = ?').bind(sparkId).run();
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Spark deleted successfully' 
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error deleting spark:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to delete spark',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
}

/**
 * Toggle spark status (active/inactive)
 */
async function toggleSparkStatus(sparkId, request, db, corsHeaders, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    // Check if user has access to the spark
    const spark = await checkSparkAccess(db, env, sparkId, userId, teamId);
    
    if (!spark) {
      return new Response(
        JSON.stringify({ error: 'Spark not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Toggle status
    const newStatus = spark.status === 'active' ? 'inactive' : 'active';
    
    await db.prepare('UPDATE sparks SET status = ? WHERE id = ?')
      .bind(newStatus, sparkId)
      .run();
    
    // Fetch updated spark
    const updatedSpark = await db.prepare('SELECT * FROM sparks WHERE id = ?')
      .bind(sparkId)
      .first();
    
    return new Response(
      JSON.stringify({
        success: true,
        spark: updatedSpark
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error toggling spark status:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to toggle spark status',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
}

/**
 * Get spark statistics (placeholder for now)
 */
async function getSparkStats(sparkId, request, db, corsHeaders, env) {
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    // Get spark to ensure it exists - using team permissions
    const spark = await checkSparkAccess(db, env, sparkId, userId, teamId);
    
    if (!spark) {
      return new Response(
        JSON.stringify({ error: 'Spark not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // TODO: Implement actual stats logic when campaigns table is migrated
    // For now, return placeholder stats
    const stats = {
      sparkId: sparkId,
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalTraffic: spark.traffic || 0,
      lastUsed: null
    };
    
    return new Response(
      JSON.stringify({
        success: true,
        stats
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error getting spark stats:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to get spark stats',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  }
}

/**
 * Helper function to extract TikTok video ID from URL
 */
function extractTikTokVideoId(url) {
  try {
    // Handle various TikTok URL formats
    // https://www.tiktok.com/@username/video/1234567890123456789
    // https://vm.tiktok.com/XXXXXXXXX/
    // https://m.tiktok.com/v/1234567890123456789
    
    const patterns = [
      /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
      /tiktok\.com\/v\/(\d+)/,
      /vm\.tiktok\.com\/(\w+)/,
      /m\.tiktok\.com\/v\/(\d+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting TikTok video ID:', error);
    return null;
  }
}

/**
 * Get fallback thumbnail URL
 */
function getFallbackThumbnail() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjMUYxRjFGIi8+CjxwYXRoIGQ9Ik0yMDAgMTUwTDI1MCAyMDBMMjAwIDI1MEwxNTAgMjAwWiIgZmlsbD0iI0VFMUQ1MiIvPgo8L3N2Zz4=';
}