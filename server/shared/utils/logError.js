import { ErrorStorage } from '../../features/error-logs/error-logs.controller.js';

export async function logError(env, error, source = 'api', context = {}) {
  try {
    console.error(`[${source}] Error:`, error, context);

    const errorStorage = new ErrorStorage(env.DASHBOARD_DB);

    await errorStorage.initTable();

    await errorStorage.logError(error, source, {
      ...context,
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'development'
    });

    console.log(`Error logged to database: ${error.message}`);
  } catch (logError) {
    console.error('Failed to log error to database:', logError);
    console.error('Original error:', error);
  }
}

// Middleware for Express-style error handling
export function errorLoggingMiddleware(env) {
  return async (err, req, res, next) => {
    await logError(env, err, 'express-middleware', {
      url: req.url,
      method: req.method,
      headers: req.headers,
      body: req.body
    });
    next(err);
  };
}