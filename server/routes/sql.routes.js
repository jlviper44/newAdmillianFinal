import { handleSQLData } from '../features/sql/sql.controller.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerSQLRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/sql')) {
      try {
        return await handleSQLData(request, env);
      } catch (error) {
        await logRouteError(error, 'sql', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerSQLRoutes;