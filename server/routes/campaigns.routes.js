import handleCampaignsAPI from '../features/campaigns/campaigns.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerCampaignsRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/campaigns')) {
      try {
        if (path.includes('/api/campaigns/client/')) {
          return await handleCampaignsAPI(request, env, path);
        }

        return requireAuth(request, env, async (req, env, session) => {
          req.ctx = { ...req.ctx, session };
          console.log('[Routes] Setting session context for campaigns:', {
            hasSession: !!session,
            userId: session?.user_id || session?.user?.id,
            isVirtualAssistant: session?.user?.isVirtualAssistant
          });
          return handleCampaignsAPI(req, env, path);
        });
      } catch (error) {
        await logRouteError(error, 'campaigns', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerCampaignsRoutes;