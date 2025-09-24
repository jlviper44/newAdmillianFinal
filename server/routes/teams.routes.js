import { handleTeams } from '../features/teams/teams.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function registerTeamsRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/teams')) {
      return requireAuth(request, env, async (req, env) => {
        return handleTeams(req, env);
      });
    }
    return null;
  };
}

export default registerTeamsRoutes;