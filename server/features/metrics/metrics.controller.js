/**
 * Metrics.js - Backend for Dashboard Metrics functionality
 * Handles Affluent API integration for clicks, conversions, and subaffiliate data
 */

import { executeQuery } from '../sql/sql.controller.js';

// API configuration
const API_CONFIG = {
  affluent: {
    baseUrl: 'https://login.affluentco.com/affiliates/api/reports',
    method: 'GET',
    endpoints: {
      clicks: '/clicks',
      conversions: '/conversions',
      subaffiliatesummary: '/subaffiliatesummary'
    }
  },
  prescott: {
    baseUrl: 'https://api.eflow.team/v1/affiliates/reporting',
    method: 'POST',
    endpoints: {
      clicks: '/clicks',
      conversions: '/conversions',
      subaffiliatesummary: '/entity'
    }
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
          api_type VARCHAR(50) NOT NULL DEFAULT 'affluent',
          api_key VARCHAR(255) NOT NULL,
          affiliate_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      
      console.log('FluentAPIs table ready');
      
      // Migration: Add api_type column if it doesn't exist
      try {
        // Check if api_type column exists by trying to query it
        await env.DASHBOARD_DB.prepare(`
          SELECT api_type FROM FluentAPIs LIMIT 1
        `).run();
        console.log('api_type column already exists');
      } catch (migrationError) {
        // Column doesn't exist, add it
        if (migrationError.message?.includes('no such column')) {
          console.log('Adding api_type column to FluentAPIs table');
          await env.DASHBOARD_DB.prepare(`
            ALTER TABLE FluentAPIs ADD COLUMN api_type VARCHAR(50) DEFAULT 'affluent'
          `).run();
          
          // Update existing records
          await env.DASHBOARD_DB.prepare(`
            UPDATE FluentAPIs SET api_type = 'affluent' WHERE api_type IS NULL
          `).run();
          
          console.log('Migration completed: api_type column added');
        }
      }
      
      // Migration: Make affiliate_id nullable for Prescott support
      // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
      try {
        // Check if we need to migrate by trying to insert a NULL affiliate_id
        const testResult = await env.DASHBOARD_DB.prepare(`
          SELECT sql FROM sqlite_master WHERE type='table' AND name='FluentAPIs'
        `).first();
        
        if (testResult && testResult.sql && testResult.sql.includes('affiliate_id VARCHAR(255) NOT NULL')) {
          console.log('Migrating FluentAPIs table to make affiliate_id nullable');
          
          // Create new table with nullable affiliate_id
          await env.DASHBOARD_DB.prepare(`
            CREATE TABLE IF NOT EXISTS FluentAPIs_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              name VARCHAR(255) NOT NULL,
              api_type VARCHAR(50) NOT NULL DEFAULT 'affluent',
              api_key VARCHAR(255) NOT NULL,
              affiliate_id VARCHAR(255),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `).run();
          
          // Copy data from old table
          await env.DASHBOARD_DB.prepare(`
            INSERT INTO FluentAPIs_new (id, user_id, name, api_type, api_key, affiliate_id, created_at, updated_at)
            SELECT id, user_id, name, 
                   COALESCE(api_type, 'affluent') as api_type, 
                   api_key, affiliate_id, created_at, updated_at
            FROM FluentAPIs
          `).run();
          
          // Drop old table
          await env.DASHBOARD_DB.prepare(`DROP TABLE FluentAPIs`).run();
          
          // Rename new table
          await env.DASHBOARD_DB.prepare(`ALTER TABLE FluentAPIs_new RENAME TO FluentAPIs`).run();
          
          console.log('Migration completed: affiliate_id is now nullable');
        }
      } catch (migrationError) {
        console.log('Migration check error (may be normal):', migrationError.message);
      }
      
      // Migration: Update any 'eflow' records to 'prescott'
      try {
        const updateResult = await env.DASHBOARD_DB.prepare(
          `UPDATE FluentAPIs SET api_type = 'prescott' WHERE api_type = 'eflow'`
        ).run();
        
        if (updateResult.meta.changes > 0) {
          console.log(`Migrated ${updateResult.meta.changes} records from 'eflow' to 'prescott'`);
        }
      } catch (updateError) {
        console.log('Error updating eflow to prescott:', updateError.message);
      }
      
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
      const { name, api_type = 'affluent', api_key, affiliate_id } = data;
      
      // Basic validation
      if (!name || !api_key || !userId) {
        return {
          success: false,
          error: 'Missing required fields: name, api_key'
        };
      }

      // Validate API type
      if (!['affluent', 'prescott'].includes(api_type)) {
        return {
          success: false,
          error: 'Invalid API type. Must be "affluent" or "prescott"'
        };
      }

      // Affiliate ID is required for Affluent, but not for Prescott
      if (api_type === 'affluent' && !affiliate_id) {
        return {
          success: false,
          error: 'Affiliate ID is required for Affluent API'
        };
      }

      const query = `
        INSERT INTO FluentAPIs (user_id, name, api_type, api_key, affiliate_id)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      // Use NULL for affiliate_id if it's not provided (Prescott case)
      const result = await executeQuery(this.env.DASHBOARD_DB, query, [userId, name, api_type, api_key, affiliate_id || null]);
      
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
   * Make request to API (supports Affluent and Prescott)
   */
  async makeApiRequest(endpoint, params, apiType = 'affluent') {
    try {
      // Validate API type
      if (!API_CONFIG[apiType]) {
        throw new Error(`Unsupported API type: ${apiType}`);
      }

      const config = API_CONFIG[apiType];
      console.log(`Making ${apiType} API request to ${endpoint} with params:`, {
        api_key: params.api_key ? `${params.api_key.substring(0, 10)}...` : 'MISSING',
        affiliate_id: params.affiliate_id || 'MISSING',
        start_date: params.start_date,
        end_date: params.end_date,
        fields: params.fields
      });

      // Handle Prescott API differently (POST with JSON body)
      if (apiType === 'prescott') {
        return this.makePrescottRequest(endpoint, params, config);
      }

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
      const url = `${config.baseUrl}${config.endpoints[endpoint]}?${queryParams.toString()}`;
      console.log(`Full ${apiType} API URL: ${url.replace(/api_key=[^&]+/, 'api_key=REDACTED')}`);
      
      // Make API request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log(`${apiType} API Response Status: ${response.status}`);

      // Check if request was successful
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${apiType} API Error Response:`, errorText);
        
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
      console.log(`${apiType} API Success Response for ${endpoint}:`, {
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
   * Make request to Prescott API
   */
  async makePrescottRequest(endpoint, params, config) {
    try {
      // Prepare Prescott-specific request body based on endpoint
      let requestBody;
      
      if (endpoint === 'clicks') {
        requestBody = {
          timezone_id: params.timezone_id || 80, // Default to UTC
          from: params.start_date,
          to: params.end_date,
          query: {
            filters: [],
            user_metrics: [],
            exclusions: [],
            metric_filters: [],
            settings: {
              campaign_data_only: false,
              ignore_fail_traffic: false,
              only_include_fail_traffic: false
            }
          }
        };
      } else if (endpoint === 'conversions') {
        requestBody = {
          timezone_id: params.timezone_id || 80, // Default to UTC
          from: params.start_date,
          to: params.end_date,
          show_events: true,
          show_conversions: true,
          query: {
            filters: [],
            search_terms: []
          }
        };
      } else {
        // Default for subaffiliatesummary and other endpoints
        requestBody = {
          timezone_id: params.timezone_id || 80, // Default to UTC
          currency_id: params.currency_id || 'USD',
          from: params.start_date,
          to: params.end_date,
          columns: this.getPrescottColumns(endpoint),
          query: {
            filters: [],
            exclusions: [],
            metric_filters: [],
            user_metrics: [],
            settings: {}
          }
        };
      }

      // Prescott doesn't use affiliate_id - it's determined by the API key

      const url = `${config.baseUrl}${config.endpoints[endpoint]}`;
      console.log(`Prescott API URL: ${url}`);
      console.log('Prescott Request Body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eflow-api-key': params.api_key
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`Prescott API Response Status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Prescott API Error Response:`, errorText);
        
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

      const data = await response.json();
      console.log(`Prescott API Success Response:`, data);

      // Transform Prescott response to match our expected format
      return {
        success: true,
        data: this.transformPrescottResponse(data, endpoint)
      };
    } catch (error) {
      console.error(`Error fetching Prescott ${endpoint} data:`, error);
      return {
        success: false,
        error: error.message || `Failed to fetch ${endpoint} data`
      };
    }
  }

  /**
   * Get appropriate columns for Prescott API based on endpoint
   */
  getPrescottColumns(endpoint) {
    // Return columns based on what data we want
    if (endpoint === 'subaffiliatesummary') {
      return [
        { column: 'sub1' }, // Sub ID
        { column: 'day' }   // Date grouping
      ];
    }
    
    // For clicks and conversions, we need offer and sub IDs too
    if (endpoint === 'clicks' || endpoint === 'conversions') {
      return [
        { column: 'hour' },  // Hourly data
        { column: 'offer' }, // Offer name
        { column: 'sub1' },  // Sub ID 1
        { column: 'sub2' }   // Sub ID 2
      ];
    }
    
    return [
      { column: 'hour' }  // Default to hourly data
    ];
  }

  /**
   * Transform Prescott response to match our expected format
   */
  transformPrescottResponse(prescottData, endpoint) {
    if (!prescottData) return [];

    // Handle clicks endpoint with new format
    if (endpoint === 'clicks' && prescottData.clicks && Array.isArray(prescottData.clicks)) {
      return {
        row_count: prescottData.clicks.length,
        data: prescottData.clicks.map(click => {
          const clickDate = new Date(click.unix_timestamp * 1000);
          const relationship = click.relationship || {};
          const offer = relationship.offer || {};
          const geo = relationship.geolocation || {};
          const device = relationship.device_information || {};
          
          return {
            click_date: clickDate.toISOString(),
            hour: clickDate.getHours(),
            transaction_id: click.transaction_id || '',
            is_unique: click.is_unique || 0,
            clicks: 1, // Each record is one click
            unique_clicks: click.is_unique || 0,
            duplicate_clicks: click.is_unique ? 0 : 1,
            offer: {
              offer_name: offer.name || '',
              offer_id: offer.network_offer_id || '',
              network_id: offer.network_id || ''
            },
            subid_1: click.sub1 || '',
            subid_2: click.sub2 || '',
            subid_3: click.sub3 || '',
            subid_4: click.sub4 || '',
            subid_5: click.sub5 || '',
            source_id: click.source_id || '',
            revenue_type: click.revenue_type || '',
            revenue: click.revenue || 0,
            referer: click.referer || '',
            user_ip: click.user_ip || '',
            country: geo.country_name || '',
            country_code: geo.country_code || '',
            city: geo.city_name || '',
            region: geo.region_name || '',
            platform: device.platform_name || '',
            browser: device.browser_name || '',
            device_type: device.device_type || '',
            is_mobile: device.is_mobile || false
          };
        })
      };
    }
    
    // Handle conversions endpoint with new format
    if (endpoint === 'conversions' && prescottData.conversions && Array.isArray(prescottData.conversions)) {
      return {
        row_count: prescottData.conversions.length,
        data: prescottData.conversions.map(conversion => {
          const conversionDate = new Date(conversion.conversion_unix_timestamp * 1000);
          const clickDate = conversion.click_unix_timestamp ? new Date(conversion.click_unix_timestamp * 1000) : null;
          const relationship = conversion.relationship || {};
          const offer = relationship.offer || {};
          
          return {
            conversion_date: conversionDate.toISOString(),
            click_date: clickDate ? clickDate.toISOString() : '',
            hour: conversionDate.getHours(),
            conversion_id: conversion.conversion_id || '',
            transaction_id: conversion.transaction_id || '',
            conversions: 1, // Each record is one conversion
            revenue: conversion.revenue || 0,
            sale_amount: conversion.sale_amount || 0,
            price: conversion.revenue || 0,
            revenue_type: conversion.revenue_type || '',
            offer_name: offer.name || '',
            offer_id: offer.network_offer_id || '',
            network_id: offer.network_id || '',
            subid_1: conversion.sub1 || '',
            subid_2: conversion.sub2 || '',
            subid_3: conversion.sub3 || '',
            subid_4: conversion.sub4 || '',
            subid_5: conversion.sub5 || '',
            source_id: conversion.source_id || '',
            country: conversion.country || '',
            city: conversion.city || '',
            region: conversion.region || '',
            platform: conversion.platform || '',
            os_version: conversion.os_version || '',
            device_type: conversion.device_type || '',
            browser: conversion.browser || '',
            language: conversion.language || '',
            is_event: conversion.is_event || false,
            event: conversion.event || '',
            session_user_ip: conversion.session_user_ip || '',
            conversion_user_ip: conversion.conversion_user_ip || '',
            isp: conversion.isp || '',
            referer: conversion.referer || '',
            order_id: conversion.order_id || '',
            coupon_code: conversion.coupon_code || ''
          };
        })
      };
    }
    
    // For legacy format support (performance/table arrays)
    if (prescottData.performance && Array.isArray(prescottData.performance)) {
      // Performance array contains pre-calculated hourly data
      return {
        row_count: prescottData.performance.length,
        data: prescottData.performance.map(item => {
          const reporting = item.reporting || {};
          
          // Generic transformation for other endpoints
          return {
            date: item.unix ? new Date(item.unix * 1000).toISOString() : '',
            clicks: reporting.total_click || reporting.unique_click || 0,
            conversions: reporting.cv || 0,
            revenue: reporting.revenue || 0,
            events: reporting.event || 0,
            cvr: reporting.cvr || 0,
            epc: reporting.rpc || 0
          };
        })
      };
    }
    
    // For summary/table data (subaffiliatesummary endpoint)
    if (prescottData.table && Array.isArray(prescottData.table)) {
      // Table array contains pre-calculated summary data
      return {
        row_count: prescottData.table.length,
        data: prescottData.table.map(item => {
          const reporting = item.reporting || {};
          
          // For subaffiliate summary
          if (endpoint === 'subaffiliatesummary') {
            return {
              sub_id: item.columns?.find(c => c.column_type === 'sub1')?.label || '',
              date: item.columns?.find(c => c.column_type === 'day')?.label || '',
              clicks: reporting.total_click || 0,
              conversions: reporting.cv || 0,
              revenue: reporting.revenue || 0,
              events: reporting.event || 0,
              epc: reporting.rpc || 0,
              cvr: reporting.cvr || 0
            };
          }
          
          // Generic table transformation
          return {
            clicks: reporting.total_click || reporting.unique_click || 0,
            conversions: reporting.cv || 0,
            revenue: reporting.revenue || 0,
            date: item.columns?.[0]?.label || '',
            sub_id: item.columns?.find(c => c.column_type === 'sub1')?.label || '',
            events: reporting.event || 0,
            cvr: reporting.cvr || 0,
            epc: reporting.rpc || 0,
            duplicate_clicks: reporting.duplicate_click || 0
          };
        })
      };
    }

    // If data structure is not recognized, return empty structure
    return { row_count: 0, data: [] };
  }

  /**
   * Legacy method for backward compatibility
   */
  async makeAffluentRequest(endpoint, params) {
    return this.makeApiRequest(endpoint, params, 'affluent');
  }

  /**
   * Get clicks data from API
   */
  async getClicks(params) {
    const apiType = params.api_type || 'affluent';
    return this.makeApiRequest('clicks', params, apiType);
  }

  /**
   * Get conversions data from API
   */
  async getConversions(params) {
    const apiType = params.api_type || 'affluent';
    return this.makeApiRequest('conversions', params, apiType);
  }

  /**
   * Get subaffiliate summary data from API
   */
  async getSubaffiliateSummary(params) {
    const apiType = params.api_type || 'affluent';
    return this.makeApiRequest('subaffiliatesummary', params, apiType);
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
  
  // Block virtual assistants from accessing metrics
  if (session?.user?.isVirtualAssistant) {
    return new Response(JSON.stringify({ error: 'Virtual assistants cannot access metrics' }), {
      status: 403,
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
            // Determine API type
            const apiType = body.api_type || 'affluent';
            const config = API_CONFIG[apiType];
            
            if (!config) {
              throw new Error(`Unsupported API type: ${apiType}`);
            }
            
            let response;
            
            if (apiType === 'prescott') {
              // Prescott uses POST with JSON body
              const testUrl = `${config.baseUrl}${config.endpoints.clicks}`;
              const requestBody = {
                timezone_id: 80,
                currency_id: 'USD',
                from: body.start_date || '2024-01-01 00:00:00',
                to: body.end_date || '2024-01-01 23:59:59',
                columns: [{ column: 'hour' }],
                query: {
                  filters: [],
                  exclusions: [],
                  metric_filters: [],
                  user_metrics: [],
                  settings: {}
                }
              };
              
              console.log(`Test URL for ${apiType}:`, testUrl);
              console.log('Test Body:', requestBody);
              
              response = await fetch(testUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-eflow-api-key': body.api_key
                },
                body: JSON.stringify(requestBody)
              });
            } else {
              // Affluent uses GET
              const testUrl = `${config.baseUrl}${config.endpoints.clicks}?api_key=${body.api_key}&affiliate_id=${body.affiliate_id}&start_date=${body.start_date || '2024-01-01 00:00:00'}&end_date=${body.end_date || '2024-01-01 23:59:59'}`;
              
              console.log(`Test URL for ${apiType} (key hidden):`, testUrl.replace(body.api_key, 'HIDDEN'));
              
              response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                }
              });
            }
            
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