import { handleSQLData } from '../features/sql/sql.controller.js';

export function registerSQLRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/sql')) {
      return handleSQLData(request, env);
    }
    return null;
  };
}

export default registerSQLRoutes;