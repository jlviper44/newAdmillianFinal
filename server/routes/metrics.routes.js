import { handleMetricsRequest, Metrics } from '../features/metrics/metrics.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function registerMetricsRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/affiliate') || path === '/api/sql/raw') {
      await Metrics.initializeTables(env);
      return handleMetricsRequest(request, env, path);
    }

    if (path.startsWith('/api/metrics')) {
      return requireAuth(request, env, async (req, env, session) => {
        await Metrics.initializeTables(env);
        return handleMetricsRequest(req, env, path, session);
      });
    }
    return null;
  };
}

export default registerMetricsRoutes;