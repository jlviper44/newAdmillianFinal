import { handleTemplateData } from '../features/templates/templates.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerTemplatesRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/templates')) {
      try {
        return requireAuth(request, env, async (req, env, session) => {
          req.ctx = { ...req.ctx, session };
          return handleTemplateData(req, env);
        });
      } catch (error) {
        await logRouteError(error, 'templates', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerTemplatesRoutes;