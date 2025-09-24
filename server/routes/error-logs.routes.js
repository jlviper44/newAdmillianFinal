import { handleErrorLogs } from '../features/error-logs/error-logs.controller.js';
import { requireAuth, isAdminUser } from '../middleware/auth.middleware.js';

export function registerErrorLogsRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/error-logs')) {
      return requireAuth(request, env, async (req, env, session) => {
        const isAdmin = session.user?.isAdmin === true || (session.user?.email && isAdminUser(session.user.email));
        if (!isAdmin) {
          console.log('Error logs access denied:', {
            userEmail: session.user?.email,
            userIsAdmin: session.user?.isAdmin,
            userId: session.user?.id
          });
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        req.ctx = { ...req.ctx, session };
        return handleErrorLogs(req, env);
      });
    }
    return null;
  };
}

export default registerErrorLogsRoutes;