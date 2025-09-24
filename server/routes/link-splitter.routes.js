import { handleLinkSplitter } from '../features/link-splitter/link-splitter.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function registerLinkSplitterRoutes(app) {
  return async function(request, env, path) {
    if (path.startsWith('/l/')) {
      return handleLinkSplitter(request, env, path, null);
    }

    if (path.startsWith('/api/link-splitter')) {
      return requireAuth(request, env, async (req, env, session) => {
        return handleLinkSplitter(req, env, path, session);
      });
    }

    return null;
  };
}

export default registerLinkSplitterRoutes;