import { handleShopifyStoresData } from '../features/shopify-stores/shopify-stores.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerShopifyStoresRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/shopify-stores')) {
      try {
        return requireAuth(request, env, async (req, env, session) => {
          req.ctx = { ...req.ctx, session };
          return handleShopifyStoresData(req, env);
        });
      } catch (error) {
        await logRouteError(error, 'shopify-stores', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerShopifyStoresRoutes;