import { handleMetricsRequest, Metrics } from '../features/metrics/metrics.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerMetricsRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/affiliate') || path === '/api/sql/raw') {
      try {
        await Metrics.initializeTables(env);
        return await handleMetricsRequest(request, env, path);
      } catch (error) {
        await logRouteError(error, 'metrics', request, env);
        throw error;
      }
    }

    if (path.startsWith('/api/metrics')) {
      try {
        return requireAuth(request, env, async (req, env, session) => {
          await Metrics.initializeTables(env);
          return handleMetricsRequest(req, env, path, session);
        });
      } catch (error) {
        await logRouteError(error, 'metrics', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerMetricsRoutes;