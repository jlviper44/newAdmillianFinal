/**
 * Shopify Stores API Handler
 * Manages all Shopify store-related API endpoints
 */

/**
 * Initialize shopify_stores table if it doesn't exist
 */
async function initializeShopifyStoresTable(db) {
  try {
    // Create shopify_stores table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS shopify_stores (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        store_name TEXT NOT NULL,
        store_url TEXT NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        api_key TEXT,
        api_secret TEXT,
        webhook_secret TEXT,
        status TEXT DEFAULT 'active',
        features TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Add user_id column if it doesn't exist (for existing tables)
    try {
      // Check if user_id column exists
      const tableInfo = await db.prepare(`PRAGMA table_info(shopify_stores)`).all();
      const hasUserIdColumn = tableInfo.results && tableInfo.results.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        // Add user_id column with default value
        await db.prepare(`ALTER TABLE shopify_stores ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        console.log('Added user_id column to shopify_stores table');
        
        // Update any NULL user_id values to 'default_user'
        await db.prepare(`UPDATE shopify_stores SET user_id = 'default_user' WHERE user_id IS NULL`).run();
        console.log('Updated NULL user_id values to default_user');
      }
    } catch (error) {
      console.error('Error handling user_id column:', error);
    }

    // Create indexes for better performance
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_shopify_stores_user_id ON shopify_stores(user_id)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_shopify_stores_status ON shopify_stores(status)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_shopify_stores_store_url ON shopify_stores(store_url)
    `).run();

    // Create trigger to automatically update the updated_at timestamp
    await db.prepare(`
      CREATE TRIGGER IF NOT EXISTS update_shopify_stores_timestamp 
      AFTER UPDATE ON shopify_stores
      BEGIN
        UPDATE shopify_stores SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `).run();

    console.log('Shopify stores table initialized successfully');
    return true;
  } catch (error) {
    console.error('Shopify stores table initialization error:', error);
    return false;
  }
}

/**
 * Extract user_id from session
 */
async function getUserIdFromSession(request, env) {
  try {
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
    
    return session.user_id;
  } catch (error) {
    console.error('Error extracting user_id from session:', error);
    throw new Error('Authentication required');
  }
}

/**
 * Main handler for all Shopify store-related API requests
 */
export async function handleShopifyStoresData(request, env) {
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
  
  // Ensure shopify_stores table exists
  try {
    await initializeShopifyStoresTable(db);
  } catch (error) {
    console.error('Failed to initialize shopify_stores table:', error);
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
  const path = url.pathname.replace('/api/shopify-stores', '');
  const method = request.method;
  
  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }
  
  try {
    // List Stores
    if (path === '' && method === 'GET') {
      return await listStores(request, db, env, corsHeaders);
    }
    
    // Create Store
    if (path === '' && method === 'POST') {
      return await createStore(request, db, env, corsHeaders);
    }
    
    // Get Store Details
    if (path.match(/^\/[\w-]+$/) && method === 'GET') {
      const storeId = path.substring(1);
      return await getStore(storeId, request, db, env, corsHeaders);
    }
    
    // Get Store Credentials (includes sensitive data)
    if (path.match(/^\/[\w-]+\/credentials$/) && method === 'GET') {
      const storeId = path.substring(1).split('/')[0];
      return await getStoreCredentials(storeId, request, db, env, corsHeaders);
    }
    
    // Update Store
    if (path.match(/^\/[\w-]+$/) && method === 'PUT') {
      const storeId = path.substring(1);
      return await updateStore(storeId, request, db, env, corsHeaders);
    }
    
    // Delete Store
    if (path.match(/^\/[\w-]+$/) && method === 'DELETE') {
      const storeId = path.substring(1);
      return await deleteStore(storeId, request, db, env, corsHeaders);
    }
    
    // Toggle Store Status
    if (path.match(/^\/[\w-]+\/toggle-status$/) && method === 'PUT') {
      const storeId = path.substring(1).split('/')[0];
      return await toggleStoreStatus(storeId, request, db, env, corsHeaders);
    }
    
    // Test Connection
    if (path.match(/^\/[\w-]+\/test-connection$/) && method === 'POST') {
      const storeId = path.substring(1).split('/')[0];
      return await testConnection(storeId, request, db, env, corsHeaders);
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
    console.error('Error in handleShopifyStoresData:', error);
    
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
 * List stores with pagination and filtering
 */
async function listStores(request, db, env, corsHeaders) {
  try {
    // First ensure the table has user_id column
    try {
      const tableInfo = await db.prepare(`PRAGMA table_info(shopify_stores)`).all();
      const hasUserIdColumn = tableInfo.results?.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        console.log('shopify_stores table missing user_id column, adding it now...');
        await db.prepare(`ALTER TABLE shopify_stores ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        await db.prepare(`UPDATE shopify_stores SET user_id = 'default_user' WHERE user_id IS NULL`).run();
      }
    } catch (e) {
      console.error('Error checking/adding user_id column:', e);
    }
    
    const userId = await getUserIdFromSession(request, env);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'all';
    
    // Build the query
    let query = 'SELECT id, store_name, store_url, status, features, created_at, updated_at FROM shopify_stores WHERE user_id = ?';
    const params = [userId];
    
    // Apply search filter
    if (search) {
      query += ' AND (store_name LIKE ? OR store_url LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // Apply status filter
    if (status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    
    // Add ordering
    query += ' ORDER BY created_at DESC';
    
    // Get total count
    const countQuery = query.replace('SELECT id, store_name, store_url, status, features, created_at, updated_at', 'SELECT COUNT(*) as count');
    const countResult = await db.prepare(countQuery).bind(...params).first();
    const totalStores = countResult.count;
    
    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);
    
    // Execute query
    const result = await db.prepare(query).bind(...params).all();
    const stores = result.results || [];
    
    // Parse features JSON for each store
    const processedStores = stores.map(store => ({
      ...store,
      features: store.features ? JSON.parse(store.features) : []
    }));
    
    const totalPages = Math.ceil(totalStores / limit);
    
    return new Response(
      JSON.stringify({
        success: true,
        stores: processedStores,
        total: totalStores,
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
    console.error('Error listing stores:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to list stores',
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
 * Get a specific store by ID
 */
async function getStore(storeId, request, db, env, corsHeaders) {
  try {
    // First ensure the table has user_id column
    try {
      const tableInfo = await db.prepare(`PRAGMA table_info(shopify_stores)`).all();
      const hasUserIdColumn = tableInfo.results?.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        console.log('shopify_stores table missing user_id column, adding it now...');
        await db.prepare(`ALTER TABLE shopify_stores ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        await db.prepare(`UPDATE shopify_stores SET user_id = 'default_user' WHERE user_id IS NULL`).run();
      }
    } catch (e) {
      console.error('Error checking/adding user_id column:', e);
    }
    
    const userId = await getUserIdFromSession(request, env);
    const store = await db.prepare(`
      SELECT id, store_name, store_url, status, features, metadata, created_at, updated_at 
      FROM shopify_stores 
      WHERE id = ? AND user_id = ?
    `).bind(storeId, userId).first();
    
    if (!store) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Parse JSON fields
    const processedStore = {
      ...store,
      features: store.features ? JSON.parse(store.features) : [],
      metadata: store.metadata ? JSON.parse(store.metadata) : {}
    };
    
    return new Response(
      JSON.stringify({
        success: true,
        store: processedStore
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
    console.error('Error getting store:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to get store',
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
 * Create a new store
 */
async function createStore(request, db, env, corsHeaders) {
  try {
    const userId = await getUserIdFromSession(request, env);
    const storeData = await request.json();
    
    // Validate required fields
    if (!storeData.store_name) {
      return new Response(
        JSON.stringify({ error: 'Store name is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    if (!storeData.store_url) {
      return new Response(
        JSON.stringify({ error: 'Store URL is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    
    // Normalize store URL
    let storeUrl = storeData.store_url.trim().toLowerCase();
    if (!storeUrl.startsWith('http://') && !storeUrl.startsWith('https://')) {
      storeUrl = 'https://' + storeUrl;
    }
    
    // Generate ID
    const id = 'store_' + Math.random().toString(36).substring(2, 15);
    const status = storeData.status || 'active';
    const features = JSON.stringify(storeData.features || []);
    const metadata = JSON.stringify(storeData.metadata || {});
    
    // Insert into database
    await db.prepare(`
      INSERT INTO shopify_stores 
      (id, user_id, store_name, store_url, access_token, api_key, api_secret, webhook_secret, status, features, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId,
      storeData.store_name,
      storeUrl,
      storeData.access_token || null,
      storeData.api_key || null,
      storeData.api_secret || null,
      storeData.webhook_secret || null,
      status,
      features,
      metadata
    ).run();
    
    // Fetch the created store
    const createdStore = await db.prepare(`
      SELECT id, store_name, store_url, status, features, created_at, updated_at 
      FROM shopify_stores 
      WHERE id = ? AND user_id = ?
    `).bind(id, userId).first();
    
    return new Response(
      JSON.stringify({
        success: true,
        store: {
          ...createdStore,
          features: JSON.parse(createdStore.features)
        }
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
    console.error('Error creating store:', error);
    
    // Check for unique constraint violation
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return new Response(
        JSON.stringify({
          error: 'Store URL already exists',
          message: 'A store with this URL has already been added'
        }),
        { 
          status: 409, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    return new Response(
      JSON.stringify({
        error: 'Failed to create store',
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
 * Update an existing store
 */
async function updateStore(storeId, request, db, env, corsHeaders) {
  try {
    const userId = await getUserIdFromSession(request, env);
    const storeData = await request.json();
    
    // Get existing store
    const existingStore = await db.prepare('SELECT * FROM shopify_stores WHERE id = ? AND user_id = ?')
      .bind(storeId, userId)
      .first();
    
    if (!existingStore) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
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
    if (!storeData.store_name) {
      return new Response(
        JSON.stringify({ error: 'Store name is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    if (!storeData.store_url) {
      return new Response(
        JSON.stringify({ error: 'Store URL is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Normalize store URL
    let storeUrl = storeData.store_url.trim().toLowerCase();
    if (!storeUrl.startsWith('http://') && !storeUrl.startsWith('https://')) {
      storeUrl = 'https://' + storeUrl;
    }
    
    const features = JSON.stringify(storeData.features || []);
    const metadata = JSON.stringify(storeData.metadata || {});
    
    // Update the store
    await db.prepare(`
      UPDATE shopify_stores 
      SET store_name = ?, store_url = ?, access_token = ?, api_key = ?, 
          api_secret = ?, webhook_secret = ?, status = ?, features = ?, metadata = ?
      WHERE id = ? AND user_id = ?
    `).bind(
      storeData.store_name,
      storeUrl,
      storeData.access_token || existingStore.access_token,
      storeData.api_key || existingStore.api_key,
      storeData.api_secret || existingStore.api_secret,
      storeData.webhook_secret || existingStore.webhook_secret,
      storeData.status || existingStore.status,
      features,
      metadata,
      storeId,
      userId
    ).run();
    
    // Fetch the updated store
    const updatedStore = await db.prepare(`
      SELECT id, store_name, store_url, status, features, created_at, updated_at 
      FROM shopify_stores 
      WHERE id = ? AND user_id = ?
    `).bind(storeId, userId).first();
    
    return new Response(
      JSON.stringify({
        success: true,
        store: {
          ...updatedStore,
          features: JSON.parse(updatedStore.features)
        }
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
    console.error('Error updating store:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to update store',
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
 * Delete a store
 */
async function deleteStore(storeId, request, db, env, corsHeaders) {
  try {
    const userId = await getUserIdFromSession(request, env);
    // Check if store exists
    const existingStore = await db.prepare('SELECT * FROM shopify_stores WHERE id = ? AND user_id = ?')
      .bind(storeId, userId)
      .first();
    
    if (!existingStore) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Delete the store
    await db.prepare('DELETE FROM shopify_stores WHERE id = ? AND user_id = ?').bind(storeId, userId).run();
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Store deleted successfully' 
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
    console.error('Error deleting store:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to delete store',
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
 * Toggle store status (active/inactive)
 */
async function toggleStoreStatus(storeId, request, db, env, corsHeaders) {
  try {
    const userId = await getUserIdFromSession(request, env);
    // Get current store
    const store = await db.prepare('SELECT * FROM shopify_stores WHERE id = ? AND user_id = ?')
      .bind(storeId, userId)
      .first();
    
    if (!store) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
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
    const newStatus = store.status === 'active' ? 'inactive' : 'active';
    
    await db.prepare('UPDATE shopify_stores SET status = ? WHERE id = ? AND user_id = ?')
      .bind(newStatus, storeId, userId)
      .run();
    
    // Fetch updated store
    const updatedStore = await db.prepare(`
      SELECT id, store_name, store_url, status, features, created_at, updated_at 
      FROM shopify_stores 
      WHERE id = ? AND user_id = ?
    `).bind(storeId, userId).first();
    
    return new Response(
      JSON.stringify({
        success: true,
        store: {
          ...updatedStore,
          features: JSON.parse(updatedStore.features)
        }
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
    console.error('Error toggling store status:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to toggle store status',
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
 * Get store credentials including sensitive data
 */
async function getStoreCredentials(storeId, request, db, env, corsHeaders) {
  try {
    const userId = await getUserIdFromSession(request, env);
    const store = await db.prepare(`
      SELECT id, store_name, store_url, access_token, api_key, api_secret, webhook_secret, status
      FROM shopify_stores 
      WHERE id = ? AND user_id = ?
    `).bind(storeId, userId).first();
    
    if (!store) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
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
        credentials: {
          id: store.id,
          store_name: store.store_name,
          store_url: store.store_url,
          access_token: store.access_token,
          api_key: store.api_key,
          api_secret: store.api_secret,
          webhook_secret: store.webhook_secret,
          status: store.status
        }
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
    console.error('Error getting store credentials:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to get store credentials',
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
 * Test store connection
 */
async function testConnection(storeId, request, db, env, corsHeaders) {
  try {
    const userId = await getUserIdFromSession(request, env);
    // Get store details
    const store = await db.prepare('SELECT * FROM shopify_stores WHERE id = ? AND user_id = ?')
      .bind(storeId, userId)
      .first();
    
    if (!store) {
      return new Response(
        JSON.stringify({ error: 'Store not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Test the connection by making a simple API call to Shopify
    try {
      if (!store.access_token) {
        return new Response(
          JSON.stringify({
            success: false,
            connected: false,
            error: 'No access token configured',
            details: 'Please add an access token to test the connection'
          }),
          { 
            status: 200, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        );
      }
      
      const shopifyUrl = `${store.store_url}/admin/api/2024-01/shop.json`;
      const response = await fetch(shopifyUrl, {
        headers: {
          'X-Shopify-Access-Token': store.access_token,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const shopData = await response.json();
        return new Response(
          JSON.stringify({
            success: true,
            connected: true,
            shop: {
              name: shopData.shop.name,
              domain: shopData.shop.domain,
              email: shopData.shop.email,
              plan_name: shopData.shop.plan_name
            }
          }),
          { 
            status: 200, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        );
      } else {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({
            success: false,
            connected: false,
            error: `Connection failed: ${response.status}`,
            details: errorText
          }),
          { 
            status: 200, 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        );
      }
    } catch (connectionError) {
      return new Response(
        JSON.stringify({
          success: false,
          connected: false,
          error: 'Connection failed',
          details: connectionError.message
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to test connection',
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