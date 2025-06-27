/**
 * Metrics.js - Backend for Dashboard Metrics functionality
 * Handles Affluent API integration for clicks, conversions, and subaffiliate data
 */

import { executeQuery } from '../../SQL/SQL.js';

// API configuration
const API_CONFIG = {
  baseUrl: 'https://login.affluentco.com/affiliates/api/reports',
  endpoints: {
    clicks: '/clicks',
    conversions: '/conversions',
    subaffiliatesummary: '/subaffiliatesummary'
  }
};

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};

/**
 * Main Metrics class for handling Dashboard metrics functionality
 */
export class Metrics {
  constructor(env) {
    this.env = env;
  }

  /**
   * Initialize metrics tables if they don't exist
   */
  static async initializeTables(env) {
    try {
      console.log('Initializing metrics tables in DASHBOARD_DB');
      
      // Create table ONLY if it doesn't exist - DO NOT DROP
      await env.DASHBOARD_DB.prepare(`
        CREATE TABLE IF NOT EXISTS FluentAPIs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          api_key VARCHAR(255) NOT NULL,
          affiliate_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      
      console.log('FluentAPIs table ready');
      return true;
    } catch (error) {
      console.error('Error initializing metrics tables:', error);
      console.error('Error details:', error.message, error.stack);
      return false;
    }
  }

  /**
   * Get all stored Fluent APIs for a specific user
   */
  async getFluentAPIs(userId) {
    try {
      // First ensure the table exists
      await Metrics.initializeTables(this.env);
      
      console.log('getFluentAPIs called with userId:', userId);
      
      const query = 'SELECT * FROM FluentAPIs WHERE user_id = ?';
      const result = await executeQuery(this.env.DASHBOARD_DB, query, [userId]);
      
      console.log('SQL query result:', result);
      
      if (result.success) {
        return {
          success: true,
          data: result.data || []
        };
      }
      
      // If table doesn't exist or is empty, return empty array
      if (result.error && result.error.includes('no such table')) {
        return {
          success: true,
          data: []
        };
      }
      
      return {
        success: false,
        error: result.error || 'Failed to fetch APIs'
      };
    } catch (error) {
      console.error('Error fetching Fluent APIs:', error);
      
      // If table doesn't exist, return empty array
      if (error.message && error.message.includes('no such table')) {
        return {
          success: true,
          data: []
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to fetch APIs'
      };
    }
  }

  /**
   * Add a new Fluent API for a specific user
   */
  async addFluentAPI(data, userId) {
    try {
      const { name, api_key, affiliate_id } = data;
      
      if (!name || !api_key || !affiliate_id || !userId) {
        return {
          success: false,
          error: 'Missing required fields: name, api_key, affiliate_id'
        };
      }

      const query = `
        INSERT INTO FluentAPIs (user_id, name, api_key, affiliate_id)
        VALUES (?, ?, ?, ?)
      `;
      
      const result = await executeQuery(this.env.DASHBOARD_DB, query, [userId, name, api_key, affiliate_id]);
      
      return {
        success: result.success,
        error: result.error
      };
    } catch (error) {
      console.error('Error adding Fluent API:', error);
      return {
        success: false,
        error: error.message || 'Failed to add API'
      };
    }
  }

  /**
   * Make request to Affluent API
   */
  async makeAffluentRequest(endpoint, params) {
    try {
      console.log(`Making Affluent API request to ${endpoint} with params:`, {
        api_key: params.api_key ? `${params.api_key.substring(0, 10)}...` : 'MISSING',
        affiliate_id: params.affiliate_id || 'MISSING',
        start_date: params.start_date,
        end_date: params.end_date,
        fields: params.fields
      });

      // Build query parameters
      const queryParams = new URLSearchParams();
      
      // Add API key as a query parameter
      queryParams.append('api_key', params.api_key);
      
      // Add date parameters
      if (params.start_date) {
        queryParams.append('start_date', params.start_date);
      }
      
      if (params.end_date) {
        queryParams.append('end_date', params.end_date);
      }
      
      // Add affiliate ID if provided
      if (params.affiliate_id) {
        queryParams.append('affiliate_id', params.affiliate_id);
      }
      
      // Handle fields parameter (array of fields to include)
      if (params.fields && Array.isArray(params.fields)) {
        params.fields.forEach(field => {
          queryParams.append('fields', field);
        });
      }

      // Build request URL
      const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints[endpoint]}?${queryParams.toString()}`;
      console.log(`Full Affluent API URL: ${url.replace(/api_key=[^&]+/, 'api_key=REDACTED')}`);
      
      // Make API request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log(`Affluent API Response Status: ${response.status}`);

      // Check if request was successful
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Affluent API Error Response:`, errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        
        throw new Error(
          errorData?.message || errorData?.error || `API request failed with status ${response.status}`
        );
      }

      // Parse and return response data
      const data = await response.json();
      console.log(`Affluent API Success Response for ${endpoint}:`, {
        dataType: typeof data,
        isArray: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : 'N/A',
        hasData: data && data.data ? 'Yes' : 'No',
        firstItem: Array.isArray(data) && data.length > 0 ? data[0] : 'No data',
        totalItems: Array.isArray(data) ? data.length : 0
      });
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error(`Error fetching ${endpoint} data:`, error);
      console.error(`Error stack:`, error.stack);
      return {
        success: false,
        error: error.message || `Failed to fetch ${endpoint} data`
      };
    }
  }

  /**
   * Get clicks data from Affluent API
   */
  async getClicks(params) {
    return this.makeAffluentRequest('clicks', params);
  }

  /**
   * Get conversions data from Affluent API
   */
  async getConversions(params) {
    return this.makeAffluentRequest('conversions', params);
  }

  /**
   * Get subaffiliate summary data from Affluent API
   */
  async getSubaffiliateSummary(params) {
    return this.makeAffluentRequest('subaffiliatesummary', params);
  }
}

/**
 * Handle metrics-related requests
 */
export async function handleMetricsRequest(request, env, path, session = null) {
  console.log('handleMetricsRequest called with path:', path);
  const metrics = new Metrics(env);
  
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: CORS_HEADERS 
    });
  }

  try {
    // Initialize tables on first request
    await Metrics.initializeTables(env);
    
    // Handle different endpoints
    // Check for DELETE requests with ID
    if (request.method === 'DELETE' && path.startsWith('/api/metrics/fluent-apis/')) {
      const userId = session?.userId || session?.user_id || session?.user?.id;
      
      if (!session || !userId) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: CORS_HEADERS
        });
      }
      
      const apiId = path.split('/').pop();
      const deleteQuery = `DELETE FROM FluentAPIs WHERE id = ? AND user_id = ?`;
      
      try {
        const result = await executeQuery(env.DASHBOARD_DB, deleteQuery, [apiId, userId]);
        
        return new Response(JSON.stringify({
          success: result.success,
          error: result.error
        }), {
          status: result.success ? 200 : 500,
          headers: CORS_HEADERS
        });
      } catch (error) {
        console.error('Delete FluentAPI error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'Failed to delete API'
        }), {
          status: 500,
          headers: CORS_HEADERS
        });
      }
    }
    
    switch (path) {
      case '/api/sql/raw':
        // Handle raw SQL query for FluentAPIs
        if (request.method === 'POST') {
          const body = await request.json();
          
          if (body.query) {
            const queryLower = body.query.toLowerCase();
            
            // Handle SELECT queries for FluentAPIs
            if (queryLower.includes('select * from fluentapis')) {
              // For raw SQL queries, we need to handle them differently
              // Since these come from non-authenticated endpoints, we'll need to get user context differently
              // For now, return empty array for non-authenticated requests
              console.log('Raw SQL query for FluentAPIs - no user context');
              return new Response(JSON.stringify([]), {
                status: 200,
                headers: CORS_HEADERS
              });
            }
            
            // Handle DELETE queries for FluentAPIs
            else if (queryLower.includes('delete from fluentapis')) {
              // Delete operations should use the authenticated endpoint
              return new Response(JSON.stringify({ 
                error: 'Please use the authenticated API endpoint for delete operations',
                hint: 'DELETE /api/metrics/fluent-apis/{id}'
              }), {
                status: 400,
                headers: CORS_HEADERS
              });
            }
            
            // For other queries, return not found
            else {
              return new Response(JSON.stringify({ 
                error: 'Query not supported',
                query: body.query
              }), {
                status: 400,
                headers: CORS_HEADERS
              });
            }
          }
        }
        break;

      case '/api/affiliate/clicks':
        if (request.method === 'POST') {
          const body = await request.json();
          console.log('Received clicks request with body:', {
            api_key: body.api_key ? `${body.api_key.substring(0, 10)}...` : 'MISSING',
            affiliate_id: body.affiliate_id || 'MISSING',
            start_date: body.start_date,
            end_date: body.end_date,
            fields: body.fields
          });
          
          const result = await metrics.getClicks(body);
          console.log('Clicks result:', {
            success: result.success,
            error: result.error,
            hasData: result.data ? 'Yes' : 'No'
          });
          
          return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 500,
            headers: CORS_HEADERS
          });
        }
        break;

      case '/api/affiliate/conversions':
        if (request.method === 'POST') {
          const body = await request.json();
          console.log('Received conversions request with body:', {
            api_key: body.api_key ? `${body.api_key.substring(0, 10)}...` : 'MISSING',
            affiliate_id: body.affiliate_id || 'MISSING',
            start_date: body.start_date,
            end_date: body.end_date,
            fields: body.fields
          });
          
          const result = await metrics.getConversions(body);
          console.log('Conversions result:', {
            success: result.success,
            error: result.error,
            hasData: result.data ? 'Yes' : 'No'
          });
          
          return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 500,
            headers: CORS_HEADERS
          });
        }
        break;

      case '/api/affiliate/subaffiliatesummary':
        if (request.method === 'POST') {
          const body = await request.json();
          console.log('Received subaffiliate request with body:', {
            api_key: body.api_key ? `${body.api_key.substring(0, 10)}...` : 'MISSING',
            affiliate_id: body.affiliate_id || 'MISSING',
            start_date: body.start_date,
            end_date: body.end_date,
            fields: body.fields
          });
          
          const result = await metrics.getSubaffiliateSummary(body);
          console.log('Subaffiliate result:', {
            success: result.success,
            error: result.error,
            hasData: result.data ? 'Yes' : 'No'
          });
          
          return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 500,
            headers: CORS_HEADERS
          });
        }
        break;

      case '/api/affiliate/test':
        // Test endpoint to verify API connectivity
        if (request.method === 'POST') {
          const body = await request.json();
          console.log('Test API endpoint called with:', body);
          
          try {
            // Make a simple test request to Affluent API
            const testUrl = `https://login.affluentco.com/affiliates/api/reports/clicks?api_key=${body.api_key}&affiliate_id=${body.affiliate_id}&start_date=${body.start_date || '2024-01-01 00:00:00'}&end_date=${body.end_date || '2024-01-01 23:59:59'}`;
            
            console.log('Test URL (key hidden):', testUrl.replace(body.api_key, 'HIDDEN'));
            
            const response = await fetch(testUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
            
            const responseText = await response.text();
            console.log('Raw response:', responseText.substring(0, 200));
            
            let data;
            try {
              data = JSON.parse(responseText);
            } catch (e) {
              data = { error: 'Invalid JSON response', text: responseText };
            }
            
            return new Response(JSON.stringify({
              success: response.ok,
              status: response.status,
              headers: Object.fromEntries(response.headers.entries()),
              data: data,
              url: testUrl.replace(body.api_key, 'HIDDEN')
            }), {
              status: 200,
              headers: CORS_HEADERS
            });
          } catch (error) {
            console.error('Test endpoint error:', error);
            return new Response(JSON.stringify({
              success: false,
              error: error.message,
              stack: error.stack
            }), {
              status: 200,
              headers: CORS_HEADERS
            });
          }
        }
        break;
        
      case '/api/metrics/debug':
        // Debug endpoint to see all APIs
        if (request.method === 'GET') {
          try {
            const allQuery = 'SELECT * FROM FluentAPIs';
            const allResult = await executeQuery(env.DASHBOARD_DB, allQuery);
            console.log('Debug - All APIs in database:', allResult);
            
            return new Response(JSON.stringify({
              success: true,
              totalCount: allResult.data?.length || 0,
              data: allResult.data || [],
              error: allResult.error
            }), {
              status: 200,
              headers: CORS_HEADERS
            });
          } catch (error) {
            return new Response(JSON.stringify({
              success: false,
              error: error.message
            }), {
              status: 500,
              headers: CORS_HEADERS
            });
          }
        }
        break;
        
      case '/api/metrics/fluent-apis':
        // Endpoint to manage Fluent APIs (requires authentication)
        console.log('Metrics fluent-apis endpoint, session:', session ? { 
          userId: session.userId, 
          user_id: session.user_id,
          hasUser: !!session.user,
          userKeys: session.user ? Object.keys(session.user) : [],
          sessionKeys: Object.keys(session)
        } : 'No session');
        
        // Check both userId and user_id (different field names)
        // The session object has user_id, not userId
        const userId = session?.user_id || session?.userId || session?.user?.id;
        
        console.log('Extracted userId:', userId);
        console.log('Using user_id field:', session?.user_id);
        
        if (!session || !userId) {
          console.log('No session or userId, returning 401');
          return new Response(JSON.stringify({ error: 'Authentication required' }), {
            status: 401,
            headers: CORS_HEADERS
          });
        }
        
        if (request.method === 'GET') {
          console.log('GET request - fetching APIs for userId:', userId);
          const result = await metrics.getFluentAPIs(userId);
          console.log('GET result:', result);
          
          return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 500,
            headers: CORS_HEADERS
          });
        } else if (request.method === 'POST') {
          console.log('POST request - adding API for userId:', userId);
          const body = await request.json();
          console.log('POST body:', body);
          const result = await metrics.addFluentAPI(body, userId);
          console.log('POST result:', result);
          
          return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 400,
            headers: CORS_HEADERS
          });
        }
        break;
    }

    // If no matching endpoint
    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: CORS_HEADERS
    });
    
  } catch (error) {
    console.error('Metrics request error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request path:', path);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      path: path,
      stack: error.stack
    }), {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

// Export for use in main index.js
export default {
  Metrics,
  handleMetricsRequest
};