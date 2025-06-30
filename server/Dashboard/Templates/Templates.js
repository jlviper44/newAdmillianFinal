/**
 * Templates API Handler
 * Manages all template-related API endpoints using native SQL
 */

/**
 * Initialize templates table if it doesn't exist
 */
async function initializeTemplatesTable(db) {
  try {
    // First check if table exists and what columns it has
    const tableInfo = await db.prepare(`PRAGMA table_info(templates)`).all();
    
    if (tableInfo.results && tableInfo.results.length > 0) {
      // Table exists, check if it has the old schema (with data column)
      const hasDataColumn = tableInfo.results.some(col => col.name === 'data');
      const hasNameColumn = tableInfo.results.some(col => col.name === 'name');
      
      if (hasDataColumn && !hasNameColumn) {
        console.log('Migrating templates table from old schema to new schema...');
        
        // Create new table with proper schema
        await db.prepare(`
          CREATE TABLE IF NOT EXISTS templates_new (
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
        
        // Migrate data from old table
        const oldData = await db.prepare('SELECT * FROM templates').all();
        for (const row of oldData.results || []) {
          try {
            const templateData = JSON.parse(row.data);
            await db.prepare(`
              INSERT INTO templates_new (id, name, description, category, html, version, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              row.id,
              templateData.name || 'Untitled',
              templateData.description || '',
              templateData.category || 'general',
              templateData.html || '',
              templateData.version || 1,
              templateData.createdAt || row.created_at,
              templateData.updatedAt || row.updated_at
            ).run();
          } catch (e) {
            console.error(`Failed to migrate template ${row.id}:`, e);
          }
        }
        
        // Drop old table and rename new table
        await db.prepare('DROP TABLE templates').run();
        await db.prepare('ALTER TABLE templates_new RENAME TO templates').run();
        
        console.log('Migration completed successfully');
      }
    } else {
      // Table doesn't exist, create it with new schema
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS templates (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT DEFAULT 'general',
          html TEXT NOT NULL,
          version INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    }

    // Create indexes for better performance
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_templates_updated ON templates(updated_at)
    `).run();
    
    // Add user_id column if it doesn't exist (for existing tables)
    try {
      // Check if user_id column exists
      const tableInfo = await db.prepare(`PRAGMA table_info(templates)`).all();
      const hasUserIdColumn = tableInfo.results && tableInfo.results.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        // Add user_id column with default value
        await db.prepare(`ALTER TABLE templates ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        console.log('Added user_id column to templates table');
        
        // Update any NULL user_id values to 'default_user'
        await db.prepare(`UPDATE templates SET user_id = 'default_user' WHERE user_id IS NULL`).run();
        console.log('Updated NULL user_id values to default_user');
      }
    } catch (error) {
      console.error('Error handling user_id column:', error);
    }

    // Create trigger to automatically update the updated_at timestamp
    await db.prepare(`
      CREATE TRIGGER IF NOT EXISTS update_templates_timestamp 
      AFTER UPDATE ON templates
      BEGIN
        UPDATE templates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `).run();

    console.log('Templates table initialized successfully');
    return true;
  } catch (error) {
    console.error('Templates table initialization error:', error);
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
    
    // Fix: Look for 'session=' instead of 'session_id='
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
 * Main handler for all template-related API requests
 */
export async function handleTemplateData(request, env) {
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
  
  // Ensure templates table exists
  try {
    await initializeTemplatesTable(db);
  } catch (error) {
    console.error('Failed to initialize templates table:', error);
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
  const path = url.pathname;
  const method = request.method;
  
  // Handle CORS preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }
  
  try {
    // List Templates
    if (path === '/api/templates' && method === 'GET') {
      return await listTemplates(request, db, corsHeaders, env);
    }

    if (path === '/api/templates/list' && method === 'GET') {
      return await listTemplatesForDropdown(request, db, corsHeaders, env);
    }
    
    // Create Template
    if (path === '/api/templates' && method === 'POST') {
      return await createTemplate(request, db, corsHeaders, env);
    }
    
    // Get Template Details
    if (path.match(/^\/api\/templates\/[\w-]+$/) && method === 'GET') {
      const templateId = path.split('/').pop();
      return await getTemplate(templateId, request, db, corsHeaders, env);
    }
    
    // Update Template
    if (path.match(/^\/api\/templates\/[\w-]+$/) && method === 'PUT') {
      const templateId = path.split('/').pop();
      return await updateTemplate(templateId, request, db, corsHeaders, env);
    }
    
    // Delete Template
    if (path.match(/^\/api\/templates\/[\w-]+$/) && method === 'DELETE') {
      const templateId = path.split('/').pop();
      return await deleteTemplate(templateId, request, db, corsHeaders, env);
    }
    
    // Duplicate Template
    if (path.match(/^\/api\/templates\/[\w-]+\/duplicate$/) && method === 'POST') {
      const templateId = path.split('/').slice(-2)[0];
      return await duplicateTemplate(templateId, request, db, corsHeaders, env);
    }
    
    // Template Categories
    if (path === '/api/templates/categories' && method === 'GET') {
      return await getTemplateCategories(corsHeaders);
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
    console.error('Error in handleTemplateData:', error);
    
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
 * List templates with pagination and filtering
 */
async function listTemplates(request, db, corsHeaders, env) {
  try {
    console.log('listTemplates called');
    
    if (!db) {
      throw new Error('Database connection is null');
    }
    
    // First ensure the table has user_id column
    try {
      const tableInfo = await db.prepare(`PRAGMA table_info(templates)`).all();
      const hasUserIdColumn = tableInfo.results?.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        console.log('templates table missing user_id column, adding it now...');
        await db.prepare(`ALTER TABLE templates ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        await db.prepare(`UPDATE templates SET user_id = 'default_user' WHERE user_id IS NULL`).run();
      }
    } catch (e) {
      console.error('Error checking/adding user_id column:', e);
    }
    
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || 'all';
    
    console.log('Query params:', { page, limit, search, category });
    
    // Build the query - always include user_id filter
    let query = 'SELECT * FROM templates WHERE user_id = ?';
    const params = [userId];
    
    // Apply search filter
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // Apply category filter
    if (category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    
    // Add ordering
    query += ' ORDER BY created_at DESC';
    
    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    console.log('Count query:', countQuery, 'Params:', params);
    
    const countResult = await db.prepare(countQuery).bind(...params).first();
    console.log('Count result:', countResult);
    
    const totalTemplates = countResult ? countResult.count : 0;
    
    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);
    
    // Execute query
    console.log('Main query:', query, 'Params:', params);
    
    let result;
    try {
      result = await db.prepare(query).bind(...params).all();
    } catch (queryError) {
      console.error('Query execution error:', queryError);
      throw new Error(`Database query failed: ${queryError.message}`);
    }
    
    console.log('Query result:', result);
    const templates = result.results || [];
    
    const totalPages = Math.ceil(totalTemplates / limit);
    
    return new Response(
      JSON.stringify({
        templates,
        total: totalTemplates,
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
    console.error('Error listing templates:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to list templates',
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
 * Get a specific template by ID
 */
async function getTemplate(templateId, request, db, corsHeaders, env) {
  try {
    // First ensure the table has user_id column
    try {
      const tableInfo = await db.prepare(`PRAGMA table_info(templates)`).all();
      const hasUserIdColumn = tableInfo.results?.some(col => col.name === 'user_id');
      
      if (!hasUserIdColumn) {
        console.log('templates table missing user_id column, adding it now...');
        await db.prepare(`ALTER TABLE templates ADD COLUMN user_id TEXT DEFAULT 'default_user'`).run();
        await db.prepare(`UPDATE templates SET user_id = 'default_user' WHERE user_id IS NULL`).run();
      }
    } catch (e) {
      console.error('Error checking/adding user_id column:', e);
    }
    
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    const template = await db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?')
      .bind(templateId, userId)
      .first();
    
    if (!template) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
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
      JSON.stringify(template),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error getting template:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to get template',
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
 * Create a new template
 */
async function createTemplate(request, db, corsHeaders, env) {
  try {
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    const templateData = await request.json();
    
    // Validate required fields
    if (!templateData.name) {
      return new Response(
        JSON.stringify({ error: 'Template name is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    if (!templateData.html) {
      return new Response(
        JSON.stringify({ error: 'HTML content is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Generate ID if not provided
    const id = templateData.id || generateId();
    const category = templateData.category || 'general';
    const description = templateData.description || '';
    
    // Insert into database
    await db.prepare(`
      INSERT INTO templates (id, user_id, name, description, category, html, version)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId,
      templateData.name,
      description,
      category,
      templateData.html,
      1
    ).run();
    
    // Fetch the created template
    const createdTemplate = await db.prepare('SELECT * FROM templates WHERE id = ?')
      .bind(id)
      .first();
    
    return new Response(
      JSON.stringify(createdTemplate),
      { 
        status: 201, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error creating template:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to create template',
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
 * Update an existing template
 */
async function updateTemplate(templateId, request, db, corsHeaders, env) {
  try {
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    // Get existing template
    const existingTemplate = await db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?')
      .bind(templateId, userId)
      .first();
    
    if (!existingTemplate) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Get new data
    const templateData = await request.json();
    
    // Validate required fields
    if (!templateData.name) {
      return new Response(
        JSON.stringify({ error: 'Template name is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    if (!templateData.html) {
      return new Response(
        JSON.stringify({ error: 'HTML content is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Update the template
    await db.prepare(`
      UPDATE templates 
      SET name = ?, description = ?, category = ?, html = ?, version = version + 1
      WHERE id = ? AND user_id = ?
    `).bind(
      templateData.name,
      templateData.description || existingTemplate.description || '',
      templateData.category || existingTemplate.category || 'general',
      templateData.html,
      templateId,
      userId
    ).run();
    
    // Fetch the updated template
    const updatedTemplate = await db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?')
      .bind(templateId, userId)
      .first();
    
    return new Response(
      JSON.stringify(updatedTemplate),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error updating template:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to update template',
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
 * Delete a template
 */
async function deleteTemplate(templateId, request, db, corsHeaders, env) {
  try {
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    // Get existing template
    const existingTemplate = await db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?')
      .bind(templateId, userId)
      .first();
    
    if (!existingTemplate) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Check if template is used by any campaigns
    // Initialize campaigns table if needed
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        template_id TEXT,
        tiktok_store_id TEXT,
        redirect_store_id TEXT,
        spark_id TEXT,
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    const campaignCheck = await db.prepare(
      'SELECT id, name FROM campaigns WHERE template_id = ? LIMIT 1'
    ).bind(templateId).first();
    
    if (campaignCheck) {
      return new Response(
        JSON.stringify({ 
          error: 'Cannot delete template that is used by campaigns',
          message: `Template is being used by campaign: ${campaignCheck.name}` 
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Delete from database
    await db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').bind(templateId, userId).run();
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Template deleted successfully' 
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
    console.error('Error deleting template:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to delete template',
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
 * Duplicate a template
 */
async function duplicateTemplate(templateId, request, db, corsHeaders, env) {
  try {
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    // Get existing template
    const existingTemplate = await db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?')
      .bind(templateId, userId)
      .first();
    
    if (!existingTemplate) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }
    
    // Create new template with a new ID
    const newId = generateId();
    const newName = `${existingTemplate.name} (Copy)`;
    
    await db.prepare(`
      INSERT INTO templates (id, user_id, name, description, category, html, version)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newId,
      userId,
      newName,
      existingTemplate.description,
      existingTemplate.category,
      existingTemplate.html,
      1
    ).run();
    
    // Fetch the created template
    const newTemplate = await db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?')
      .bind(newId, userId)
      .first();
    
    return new Response(
      JSON.stringify(newTemplate),
      { 
        status: 201, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error duplicating template:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to duplicate template',
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
 * Get template categories
 */
async function getTemplateCategories(corsHeaders) {
  try {
    // Predefined categories
    const categories = [
      { id: 'general', name: 'General' },
      { id: 'offers', name: 'Offers' },
      { id: 'products', name: 'Products' },
      { id: 'landing', name: 'Landing Pages' },
      { id: 'sales', name: 'Sales Pages' },
      { id: 'optin', name: 'Opt-in Pages' }
    ];
    
    return new Response(
      JSON.stringify({ categories }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
  } catch (error) {
    console.error('Error getting template categories:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to get template categories',
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
 * Generate a random ID
 * @returns {string} A random 16-character hex ID
 */
function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function listTemplatesForDropdown(request, db, corsHeaders, env) {
  try {
    // Get user_id from session
    const userId = await getUserIdFromSession(request, env);
    
    // Fetch only essential data for dropdown
    const result = await db.prepare(`
      SELECT id, name, category 
      FROM templates 
      WHERE user_id = ?
      ORDER BY category, name
    `).bind(userId).all();
    
    const templates = result.results;
    
    return new Response(
      JSON.stringify({
        templates
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
    console.error('Error listing templates for dropdown:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to list templates for dropdown',
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