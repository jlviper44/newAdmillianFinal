import handleCampaignsAPI from '../features/campaigns/campaigns.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function registerCampaignsRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/campaigns')) {
      if (path.includes('/api/campaigns/client/')) {
        return handleCampaignsAPI(request, env, path);
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
    }
    return null;
  };
}

export default registerCampaignsRoutes;