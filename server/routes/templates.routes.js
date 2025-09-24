import { handleTemplateData } from '../features/templates/templates.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function registerTemplatesRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/templates')) {
      return requireAuth(request, env, async (req, env, session) => {
        req.ctx = { ...req.ctx, session };
        return handleTemplateData(req, env);
      });
    }
    return null;
  };
}

export default registerTemplatesRoutes;