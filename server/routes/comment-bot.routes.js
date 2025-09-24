import { handleCommentBotData } from '../features/comment-bot/comment-bot.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export function registerCommentBotRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/commentbot')) {
      return requireAuth(request, env, handleCommentBotData);
    }
    return null;
  };
}

export default registerCommentBotRoutes;