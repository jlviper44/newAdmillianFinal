import BCGen from '../features/bcgen/bcgen.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function registerBCGenRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/bcgen')) {
      return requireAuth(request, env, async (req, env, session) => {
        const bcgen = new BCGen(env);
        await bcgen.initializeTables();
        return bcgen.handle(req, session);
      });
    }
    return null;
  };
}

export default registerBCGenRoutes;