import { handleCommentBotData } from '../features/comment-bot/comment-bot.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerCommentBotRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/commentbot')) {
      try {
        return requireAuth(request, env, handleCommentBotData);
      } catch (error) {
        await logRouteError(error, 'comment-bot', request, env);
        throw error;
      }
    }
    return null;
  };
}

export default registerCommentBotRoutes;