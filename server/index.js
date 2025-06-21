import { handleCommentBotData } from './CommentBot/CommentBot';
import { handleAuth, requireAuth, cleanExpiredSessions } from './Auth/Auth';
import { handleSQLData } from './SQL/SQL';
import BCGen from './BCGen/BCGen';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // Clean expired sessions periodically (on 1% of requests)
      if (Math.random() < 0.01) {
        cleanExpiredSessions(env.USERS_DB).catch(console.error);
      }
      
      // Route authentication requests
      if (path.startsWith('/api/auth')) {
        return handleAuth(request, env);
      }
      
      // Route SQL API requests
      if (path.startsWith('/api/sql')) {
        return handleSQLData(request, env);
      }
      
      // Route Comment Bot API requests (protected)
      if (path.startsWith('/api/commentbot')) {
        return requireAuth(request, env, handleCommentBotData);
      }
      
      // Route BCGen API requests (protected)
      if (path.startsWith('/api/bcgen')) {
        return requireAuth(request, env, async (req, env, session) => {
          const bcgen = new BCGen(env);
          // Wait for table initialization
          await bcgen.initializeTables();
          return bcgen.handle(req, session);
        });
      }
      
      // For any other route, serve the Vue app
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      } else {
        // Fallback for development or if ASSETS is not available
        return new Response('Not found', { status: 404 });
      }
    } catch (error) {
      console.error(`Error handling request for ${path}: ${error.message}`);
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error', 
          message: error.message,
          path: path
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  },
};