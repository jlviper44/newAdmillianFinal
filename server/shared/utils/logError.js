// Utility function to log errors to the Error Logs system
export async function logError(env, error, source = 'api', context = {}) {
  try {
    // Only log in production or if explicitly enabled
    if (env.ENVIRONMENT !== 'production' && !env.ENABLE_ERROR_LOGGING) {
      console.error(`[${source}] Error:`, error, context);
      return;
    }

    // Import error storage
    const { ErrorStorage } = await import('../ErrorLogs/errorStorage.js');
    const errorStorage = new ErrorStorage(env.DASHBOARD_DB);

    // Ensure table exists
    await errorStorage.initTable();

    // Log the error
    await errorStorage.logError(error, source, {
      ...context,
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'production'
    });

    console.log(`Error logged to database: ${error.message}`);
  } catch (logError) {
    // If error logging fails, just console log it
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