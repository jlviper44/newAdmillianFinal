// Automatic error capture for Cloudflare Workers
// This module automatically logs errors to the Error Logs system

export function setupErrorCapture(env) {
  // Log error to the error logs system
  async function logErrorToSystem(error, context = {}) {
    try {
      // Prepare error data
      const errorData = {
        timestamp: new Date().toISOString(),
        message: error.message || error.toString(),
        name: error.name || 'Error',
        stack: error.stack,
        code: error.code,
        ...context
      };

      // Store in D1 database directly
      if (env.DASHBOARD_DB) {
        await env.DASHBOARD_DB.prepare(`
          INSERT INTO error_logs (
            timestamp,
            source,
            error_message,
            error_name,
            error_code,
            error_stack,
            metadata,
            environment
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          errorData.timestamp,
          context.source || 'worker',
          errorData.message,
          errorData.name,
          errorData.code || null,
          errorData.stack || null,
          JSON.stringify(context.metadata || {}),
          'production'
        ).run();
      }
    } catch (logError) {
      // Silently fail if we can't log the error
      console.error('Failed to log error to system:', logError);
    }
  }

  return {
    logErrorToSystem,

    // Wrap a function to automatically catch and log errors
    wrapWithErrorLogging(fn, context = {}) {
      return async (...args) => {
        try {
          return await fn(...args);
        } catch (error) {
          await logErrorToSystem(error, {
            ...context,
            functionName: fn.name,
            timestamp: new Date().toISOString()
          });
          throw error; // Re-throw to maintain original behavior
        }
      };
    },

    // Log an error manually
    async logError(error, context = {}) {
      await logErrorToSystem(error, context);
    },

    // Wrap fetch to catch network errors
    wrapFetch(originalFetch) {
      return async (request, init) => {
        try {
          const response = await originalFetch(request, init);

          // Log 5xx errors
          if (response.status >= 500) {
            await logErrorToSystem(new Error(`HTTP ${response.status} Error`), {
              source: 'fetch',
              url: typeof request === 'string' ? request : request.url,
              status: response.status,
              statusText: response.statusText,
              metadata: {
                method: init?.method || 'GET',
                headers: init?.headers
              }
            });
          }

          return response;
        } catch (error) {
          await logErrorToSystem(error, {
            source: 'fetch',
            url: typeof request === 'string' ? request : request.url,
            metadata: {
              method: init?.method || 'GET',
              headers: init?.headers
            }
          });
          throw error;
        }
      };
    }
  };
}

// Global error handler for uncaught errors
export function setupGlobalErrorHandler(env) {
  const errorCapture = setupErrorCapture(env);

  // Override global addEventListener to catch Worker errors
  const originalAddEventListener = addEventListener;

  addEventListener = function(type, listener, options) {
    if (type === 'fetch') {
      // Wrap the fetch handler
      const wrappedListener = async (event) => {
        try {
          await listener(event);
        } catch (error) {
          await errorCapture.logError(error, {
            source: 'worker-fetch',
            path: event.request.url,
            method: event.request.method,
            metadata: {
              cf: event.request.cf,
              headers: Object.fromEntries(event.request.headers)
            }
          });

          // Return error response
          event.respondWith(new Response('Internal Server Error', {
            status: 500,
            statusText: 'Internal Server Error'
          }));
        }
      };

      return originalAddEventListener.call(this, type, wrappedListener, options);
    }

    return originalAddEventListener.call(this, type, listener, options);
  };
}