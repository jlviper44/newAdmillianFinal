import BCGen from '../features/bcgen/bcgen.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerBCGenRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/bcgen')) {
      try {
        return requireAuth(request, env, async (req, env, session) => {
          const bcgen = new BCGen(env);
          await bcgen.initializeTables();
          return bcgen.handle(req, session);
        });
      } catch (error) {
        await logRouteError(error, 'bcgen', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerBCGenRoutes;