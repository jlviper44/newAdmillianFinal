import { handleTeams } from '../features/teams/teams.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerTeamsRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/teams')) {
      try {
        return requireAuth(request, env, async (req, env) => {
          return handleTeams(req, env);
        });
      } catch (error) {
        await logRouteError(error, 'teams', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerTeamsRoutes;