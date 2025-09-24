import { handleSparkData } from '../features/sparks/sparks.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function registerSparksRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/sparks')) {
      return requireAuth(request, env, async (req, env, session) => {
        req.ctx = { ...req.ctx, session };
        return handleSparkData(req, env);
      });
    }
    return null;
  };
}

export default registerSparksRoutes;