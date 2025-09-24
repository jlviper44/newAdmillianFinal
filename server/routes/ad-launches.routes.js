import { handleAdLaunches } from '../features/ad-launches/ad-launches.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerAdLaunchesRoutes() {
  return async function(request, env, path) {
    const isPayrollRoute = path.startsWith('/api/tracker') ||
        path.startsWith('/api/timeclock') ||
        path.startsWith('/api/clock-') ||
        path.startsWith('/api/payroll') ||
        path.startsWith('/api/va-rates') ||
        path.startsWith('/api/launch-entry') ||
        path.startsWith('/api/time-entry') ||
        path === '/api/generate-weekly-payroll';

    if (isPayrollRoute) {
      try {
        return requireAuth(request, env, async (req, env, session) => {
          req.ctx = { ...req.ctx, session };
          return handleAdLaunches(req, env);
        });
      } catch (error) {
        await logRouteError(error, 'ad-launches', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerAdLaunchesRoutes;