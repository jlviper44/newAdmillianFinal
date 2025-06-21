// SQL.js - CRUD operations for Cloudflare Workers with direct D1 API

/**
 * Execute a raw SQL query
 * @param {D1Database} db - The D1 database instance
 * @param {string} query - SQL query to execute
 * @param {Array} params - Parameters for the query
 * @returns {Promise<Object>} - Query result
 */
async function executeQuery(db, query, params = []) {
  try {
    // console.log(`Executing query: ${query} with params:`, params);
    const result = await db.prepare(query).bind(...params).all();
    return {
      success: true,
      data: result.results,
      meta: result.meta
    };
  } catch (error) {
    console.error('SQL Execute Query Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get all records from a table
 * @param {D1Database} db - The D1 database instance
 * @param {string} tableName - Name of the table
 * @returns {Promise<Object>} - Query result with all records
 */
async function getAll(db, tableName) {
  try {
    // console.log(`Getting all records from table: ${tableName}`);
    // Removed square brackets around table name
    const query = `SELECT * FROM ${tableName}`;
    const result = await db.prepare(query).all();
    return {
      success: true,
      data: result.results,
      meta: result.meta
    };
  } catch (error) {
    console.error('SQL GetAll Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get a single record by ID
 * @param {D1Database} db - The D1 database instance
 * @param {string} tableName - Name of the table
 * @param {string} idColumn - Name of the ID column
 * @param {string|number} id - ID value to look up
 * @returns {Promise<Object>} - Query result with single record
 */
async function getById(db, tableName, idColumn, id) {
  try {
    // console.log(`Getting record from ${tableName} where ${idColumn} = ${id}`);
    // Removed square brackets around table name
    const query = `SELECT * FROM ${tableName} WHERE ${idColumn} = ?`;
    const result = await db.prepare(query).bind(id).all();
    return {
      success: true,
      data: result.results,
      meta: result.meta
    };
  } catch (error) {
    console.error('SQL GetById Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Insert a new record
 * @param {D1Database} db - The D1 database instance
 * @param {string} tableName - Name of the table
 * @param {Object} data - Record data as key-value pairs
 * @returns {Promise<Object>} - Query result
 */
async function insert(db, tableName, data) {
  try {
    // console.log(`Inserting into ${tableName}:`, data);
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = Array(values.length).fill('?').join(', ');
    
    // Removed square brackets around table name
    const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    const result = await db.prepare(query).bind(...values).run();
    
    return {
      success: true,
      data: [data],
      meta: result.meta
    };
  } catch (error) {
    console.error('SQL Insert Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update an existing record
 * @param {D1Database} db - The D1 database instance
 * @param {string} tableName - Name of the table
 * @param {string} idColumn - Name of the ID column
 * @param {string|number} id - ID value to update
 * @param {Object} data - Record data as key-value pairs
 * @returns {Promise<Object>} - Query result
 */
async function update(db, tableName, idColumn, id, data) {
  try {
    // console.log(`Updating ${tableName} where ${idColumn} = ${id}:`, data);
    const setClause = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(data), id];
    
    // Removed square brackets around table name
    const query = `UPDATE ${tableName} SET ${setClause} WHERE ${idColumn} = ?`;
    const result = await db.prepare(query).bind(...values).run();
    
    return {
      success: true,
      data: [data],
      meta: result.meta
    };
  } catch (error) {
    console.error('SQL Update Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a record
 * @param {D1Database} db - The D1 database instance
 * @param {string} tableName - Name of the table
 * @param {string} idColumn - Name of the ID column
 * @param {string|number} id - ID value to delete
 * @returns {Promise<Object>} - Query result
 */
async function deleteRecord(db, tableName, idColumn, id) {
  try {
    // console.log(`Deleting from ${tableName} where ${idColumn} = ${id}`);
    // Removed square brackets around table name
    const query = `DELETE FROM ${tableName} WHERE ${idColumn} = ?`;
    const result = await db.prepare(query).bind(id).run();
    
    return {
      success: true,
      data: [],
      meta: result.meta
    };
  } catch (error) {
    console.error('SQL Delete Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle HTTP requests for SQL operations
 * @param {Request} request - The D1 database instance
 * @param {D1Database} db - The D1 database instance
 * @returns {Response} - JSON response
 */
async function handleSQLRequest(request, db) {
  // Parse request URL and method
  const url = new URL(request.url);
  const method = request.method;
  const params = url.searchParams;
  
  // Get table and ID from URL
  const pathParts = url.pathname.split('/').filter(Boolean);
  const table = pathParts[2]; // /api/sql/tableName/[id]
  const id = pathParts[3];
  
  // console.log(`SQL Request: ${method} ${url.pathname}`);
  // console.log(`Table: ${table}, ID: ${id}`);
  
  try {
    let result;
    
    // CRUD operations based on HTTP method
    switch (method) {
      case 'GET':
        if (id) {
          // Get single record by ID
          result = await getById(db, table, params.get('idColumn') || 'ID', id);
        } else {
          // Get all records
          result = await getAll(db, table);
        }
        break;
        
      case 'POST':
        // Create new record
        const postData = await request.json();
        result = await insert(db, table, postData);
        break;
        
      case 'PUT':
        // Update existing record
        if (!id) {
          return new Response(JSON.stringify({ error: 'ID is required for updates' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const putData = await request.json();
        result = await update(db, table, params.get('idColumn') || 'ID', id, putData);
        break;
        
      case 'DELETE':
        // Delete record
        if (!id) {
          return new Response(JSON.stringify({ error: 'ID is required for deletion' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        result = await deleteRecord(db, table, params.get('idColumn') || 'ID', id);
        break;
        
      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Return response
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('SQL Request Handler Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message, 
      stack: error.stack,
      url: url.pathname,
      method: method,
      table: table,
      id: id
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
}

// Custom endpoint to run raw SQL queries
async function handleRawSQLRequest(request, db) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { query, params = [] } = await request.json();
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await executeQuery(db, query, params);
    
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('Raw SQL Request Handler Error:', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
}

/**
 * Handle CORS preflight requests
 * @returns {Response} - CORS preflight response
 */
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}

/**
 * Main handler for all SQL-related requests
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment bindings
 * @returns {Response} - JSON response
 */
async function handleSQLData(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }
  
  // Handle raw SQL query endpoint
  if (path === '/api/sql/raw') {
    return handleRawSQLRequest(request, env.COMMENT_BOT_DB);
  }
  
  // Handle regular CRUD operations
  return handleSQLRequest(request, env.COMMENT_BOT_DB);
}



export { 
  handleSQLData,
  executeQuery,
  getAll,
  getById,
  insert,
  update,
  deleteRecord,
};