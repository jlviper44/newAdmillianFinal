import { handleLinkSplitter } from '../features/link-splitter/link-splitter.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerLinkSplitterRoutes(app) {
  return async function(request, env, path) {
    if (path.startsWith('/l/')) {
      try {
        return await handleLinkSplitter(request, env, path, null);
      } catch (error) {
        await logRouteError(error, 'link-splitter', request, env);
        throw error;
      }
    }

    if (path.startsWith('/api/link-splitter')) {
      try {
        return requireAuth(request, env, async (req, env, session) => {
          return handleLinkSplitter(req, env, path, session);
        });
      } catch (error) {
        await logRouteError(error, 'link-splitter', request, env);
        throw error;
      }
    }

    return null;
  };
}

export default registerLinkSplitterRoutes;