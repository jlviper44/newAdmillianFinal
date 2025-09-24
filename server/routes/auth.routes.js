import { handleAuth } from '../features/auth/auth.controller.js';

export function registerAuthRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/auth') || path.startsWith('/auth/')) {
      return handleAuth(request, env);
    }
    return null;
  };
}

export default registerAuthRoutes;