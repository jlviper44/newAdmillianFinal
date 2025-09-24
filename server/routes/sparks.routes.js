import { handleSparkData } from '../features/sparks/sparks.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerSparksRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/sparks')) {
      try {
        return requireAuth(request, env, async (req, env, session) => {
          req.ctx = { ...req.ctx, session };
          return handleSparkData(req, env);
        });
      } catch (error) {
        await logRouteError(error, 'sparks', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerSparksRoutes;