import { handleAuth } from '../features/auth/auth.controller.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerAuthRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/auth') || path.startsWith('/auth/')) {
      try {
        return await handleAuth(request, env);
      } catch (error) {
        await logRouteError(error, 'auth', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerAuthRoutes;