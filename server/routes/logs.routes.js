import { handleLogsData } from '../features/logs/logs.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function registerLogsRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/logs')) {
      if (path === '/api/logs/public') {
        if (request.method === 'OPTIONS') {
          return new Response(null, {
            status: 200,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Max-Age': '86400'
            }
          });
        }
        if (request.method === 'POST') {
          return handleLogsData(request, env);
        }
      }

      return requireAuth(request, env, async (req, env, session) => {
        req.ctx = { ...req.ctx, session };
        return handleLogsData(req, env);
      });
    }
    return null;
  };
}

export default registerLogsRoutes;