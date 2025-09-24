import { handleShopifyStoresData } from '../features/shopify-stores/shopify-stores.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function registerShopifyStoresRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/shopify-stores')) {
      return requireAuth(request, env, async (req, env, session) => {
        req.ctx = { ...req.ctx, session };
        return handleShopifyStoresData(req, env);
      });
    }
    return null;
  };
}

export default registerShopifyStoresRoutes;