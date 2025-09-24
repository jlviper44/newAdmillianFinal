import { handleAdLaunches } from '../features/ad-launches/ad-launches.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

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
      return requireAuth(request, env, async (req, env, session) => {
        req.ctx = { ...req.ctx, session };
        return handleAdLaunches(req, env);
      });
    }
    return null;
  };
}

export default registerAdLaunchesRoutes;