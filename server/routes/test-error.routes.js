import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerTestErrorRoutes() {
  return async function(request, env, path) {
    if (path === '/api/test-error') {
      try {
        throw new Error('This is a test error to verify error logging works!');
      } catch (error) {
        await logRouteError(error, 'test-error', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerTestErrorRoutes;