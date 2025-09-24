// Cloudflare Workers-compatible error storage using D1 database
import { isAdminUser } from '../../middleware/auth.middleware.js';

export class ErrorStorage {
  constructor(db) {
    this.db = db;
  }

  async initTable() {
    try {
      await this.db.prepare(`
        CREATE TABLE IF NOT EXISTS error_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          source TEXT NOT NULL,
          error_message TEXT,
          error_name TEXT,
          error_code TEXT,
          error_stack TEXT,
          metadata TEXT,
          environment TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      // Create index for better query performance
      await this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp
        ON error_logs(timestamp)
      `).run();

      await this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_error_logs_source
        ON error_logs(source)
      `).run();
    } catch (error) {
      console.error('Failed to initialize error_logs table:', error);
    }
  }

  async logError(error, source = 'cloudflare', metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      source,
      error_message: error.message || error.toString(),
      error_name: error.name || 'Error',
      error_code: error.code || null,
      error_stack: error.stack || null,
      metadata: JSON.stringify(metadata),
      environment: 'production'
    };

    try {
      await this.db.prepare(`
        INSERT INTO error_logs (
          timestamp, source, error_message, error_name,
          error_code, error_stack, metadata, environment
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        logEntry.timestamp,
        logEntry.source,
        logEntry.error_message,
        logEntry.error_name,
        logEntry.error_code,
        logEntry.error_stack,
        logEntry.metadata,
        logEntry.environment
      ).run();

      return logEntry;
    } catch (writeError) {
      console.error('Failed to write error log:', writeError);
      throw writeError;
    }
  }

  async getErrors(filters = {}) {
    const { source, startDate, endDate, limit = 100 } = filters;

    let query = 'SELECT * FROM error_logs WHERE 1=1';
    const params = [];

    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }

    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    try {
      const result = await this.db.prepare(query).bind(...params).all();

      // Parse metadata JSON and format response
      return result.results.map(row => ({
        id: row.id,
        timestamp: row.timestamp,
        source: row.source,
        error: {
          message: row.error_message,
          name: row.error_name,
          code: row.error_code,
          stack: row.error_stack
        },
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        environment: row.environment
      }));
    } catch (error) {
      console.error('Failed to fetch error logs:', error);
      return [];
    }
  }

  async getRecentErrors(limit = 100) {
    return this.getErrors({ limit });
  }

  async clearOldLogs(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      await this.db.prepare(`
        DELETE FROM error_logs
        WHERE timestamp < ?
      `).bind(cutoffDate.toISOString()).run();
    } catch (error) {
      console.error('Failed to clear old logs:', error);
    }
  }
}

// Cloudflare Error Handler
export class CloudflareErrorHandler {
  constructor(errorStorage) {
    this.errorStorage = errorStorage;
  }

  async handleWorkerError(error, context = {}) {
    const errorData = {
      type: 'worker_error',
      url: context.url,
      method: context.method,
      headers: context.headers,
      cf: context.cf,
      workerId: context.workerId
    };

    return await this.errorStorage.logError(error, 'cloudflare-worker', errorData);
  }

  async handleD1Error(error, context = {}) {
    const errorData = {
      type: 'd1_error',
      database: context.database,
      query: context.query,
      params: context.params,
      operation: context.operation
    };

    return await this.errorStorage.logError(error, 'cloudflare-d1', errorData);
  }

  async handleKVError(error, context = {}) {
    const errorData = {
      type: 'kv_error',
      namespace: context.namespace,
      key: context.key,
      operation: context.operation
    };

    return await this.errorStorage.logError(error, 'cloudflare-kv', errorData);
  }

  async handleR2Error(error, context = {}) {
    const errorData = {
      type: 'r2_error',
      bucket: context.bucket,
      key: context.key,
      operation: context.operation
    };

    return await this.errorStorage.logError(error, 'cloudflare-r2', errorData);
  }

  async handleDurableObjectError(error, context = {}) {
    const errorData = {
      type: 'durable_object_error',
      objectName: context.objectName,
      id: context.id,
      operation: context.operation
    };

    return await this.errorStorage.logError(error, 'cloudflare-do', errorData);
  }

  async handleAPIError(error, context = {}) {
    const errorData = {
      type: 'api_error',
      endpoint: context.endpoint,
      statusCode: context.statusCode,
      response: context.response,
      requestId: context.requestId
    };

    return await this.errorStorage.logError(error, 'cloudflare-api', errorData);
  }
}

// Main handler function for API requests
export async function handleErrorLogs(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const session = request.ctx?.session;

  // Check admin permission using the same method as Auth.js
  const isAdmin = session?.user?.isAdmin === true || (session?.user?.email && isAdminUser(session.user.email));
  if (!session || !isAdmin) {
    console.log('Access denied - session:', {
      hasSession: !!session,
      userEmail: session?.user?.email,
      userIsAdmin: session?.user?.isAdmin
    });
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Initialize error storage with D1 database
  const errorStorage = new ErrorStorage(env.DASHBOARD_DB);
  await errorStorage.initTable(); // Ensure table is created
  const errorHandler = new CloudflareErrorHandler(errorStorage);

  try {
    // GET /api/error-logs - Get error logs with filters
    if (path === '/api/error-logs' && request.method === 'GET') {
      const filters = {
        source: url.searchParams.get('source'),
        startDate: url.searchParams.get('startDate'),
        endDate: url.searchParams.get('endDate'),
        limit: parseInt(url.searchParams.get('limit')) || 100
      };

      const errors = await errorStorage.getErrors(filters);
      return new Response(JSON.stringify(errors), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /api/error-logs/recent - Get recent errors
    if (path === '/api/error-logs/recent' && request.method === 'GET') {
      const errors = await errorStorage.getRecentErrors();
      return new Response(JSON.stringify(errors), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/error-logs - Log a new error
    if (path === '/api/error-logs' && request.method === 'POST') {
      const body = await request.json();
      const { error, source, metadata } = body;

      const logEntry = await errorStorage.logError(
        error,
        source || 'api',
        metadata
      );

      return new Response(JSON.stringify(logEntry), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/error-logs/cloudflare/worker - Log worker error
    if (path === '/api/error-logs/cloudflare/worker' && request.method === 'POST') {
      const body = await request.json();
      const { error, context } = body;

      const logEntry = await errorHandler.handleWorkerError(error, context);

      return new Response(JSON.stringify(logEntry), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/error-logs/cloudflare/d1 - Log D1 error
    if (path === '/api/error-logs/cloudflare/d1' && request.method === 'POST') {
      const body = await request.json();
      const { error, context } = body;

      const logEntry = await errorHandler.handleD1Error(error, context);

      return new Response(JSON.stringify(logEntry), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/error-logs/cloudflare/kv - Log KV error
    if (path === '/api/error-logs/cloudflare/kv' && request.method === 'POST') {
      const body = await request.json();
      const { error, context } = body;

      const logEntry = await errorHandler.handleKVError(error, context);

      return new Response(JSON.stringify(logEntry), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // DELETE /api/error-logs/cleanup - Clear old logs
    if (path === '/api/error-logs/cleanup' && request.method === 'DELETE') {
      const daysToKeep = parseInt(url.searchParams.get('days')) || 30;
      await errorStorage.clearOldLogs(daysToKeep);

      return new Response(JSON.stringify({ message: `Cleared logs older than ${daysToKeep} days` }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/error-logs/test - Generate a test error
    if (path === '/api/error-logs/test' && request.method === 'POST') {
      // Create a test error
      const testError = new Error('Test error for Error Logs system');
      testError.code = 'TEST_ERROR';

      await errorStorage.logError(testError, 'test', {
        timestamp: new Date().toISOString(),
        message: 'This is a test error generated from the admin panel'
      });

      return new Response(JSON.stringify({ message: 'Test error logged successfully' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/error-logs/sync-cloudflare - Sync Cloudflare logs
    if (path === '/api/error-logs/sync-cloudflare' && request.method === 'POST') {
      const { CloudflareLogReader } = await import('./cloudflare-log-reader.service.js');
      const logReader = new CloudflareLogReader(env);

      const result = await logReader.syncLogs();

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST /api/error-logs/ingest - Ingest Logpush data (no auth required for Cloudflare)
    if (path === '/api/error-logs/ingest' && request.method === 'POST') {
      const { handleLogpushIngest } = await import('./cloudflare-log-reader.service.js');
      return handleLogpushIngest(request, env);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error handling error logs request:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Export cloudflareErrorHandler for use in error handling middleware