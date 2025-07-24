import { handleCommentBotData } from './CommentBot/CommentBot';
import { handleAuth, requireAuth, cleanExpiredSessions } from './Auth/Auth';
import { handleSQLData } from './SQL/SQL';
import BCGen from './BCGen/BCGen';
import { handleMetricsRequest, Metrics } from './Dashboard/Metrics/Metrics';
import { handleSparkData } from './Dashboard/Sparks/Sparks';
import { handleTemplateData } from './Dashboard/Templates/Templates';
import { handleShopifyStoresData } from './Dashboard/ShopifyStores/ShopifyStores';
import handleCampaignsAPI from './Dashboard/Campaigns/Campaigns';
import { handleLogsData } from './Dashboard/Logs/Logs';
import { handleTeams } from './Teams/Teams';

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
      
      // Handle auth callback route - serve Vue app for client-side routing
      if (path === '/auth/callback/whop' || path.startsWith('/auth/callback/')) {
        console.log('Auth callback route detected:', { 
          path, 
          hasAssets: !!env.ASSETS,
          envKeys: Object.keys(env)
        });
        
        if (env.ASSETS) {
          const indexRequest = new Request(new URL('/index.html', request.url), request);
          return env.ASSETS.fetch(indexRequest);
        } else {
          // If no ASSETS, return a helpful error with debugging info
          return new Response(
            `Vue app not found. ASSETS binding may be missing.\n\n` +
            `Available env bindings: ${Object.keys(env).join(', ')}\n\n` +
            `Make sure you:\n` +
            `1. Run 'npm run build' to build the Vue app\n` +
            `2. Deploy with 'npx wrangler deploy' (not 'wrangler dev')\n` +
            `3. Or test locally with 'npx wrangler dev'`,
            { 
              status: 500,
              headers: { 'Content-Type': 'text/plain' }
            }
          );
        }
      }
      
      // Route Metrics/Affiliate API requests - MUST BE BEFORE GENERIC SQL HANDLER
      if (path.startsWith('/api/affiliate') || path === '/api/sql/raw') {
        // Initialize Metrics tables if needed
        await Metrics.initializeTables(env);
        return handleMetricsRequest(request, env, path);
      }
      
      // Route SQL API requests
      if (path.startsWith('/api/sql')) {
        return handleSQLData(request, env);
      }
      
      // Route Teams API requests (protected)
      if (path.startsWith('/api/teams')) {
        return requireAuth(request, env, async (req, env) => {
          return handleTeams(req, env);
        });
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
      
      // Route Dashboard Metrics management requests (protected)
      if (path.startsWith('/api/metrics')) {
        return requireAuth(request, env, async (req, env, session) => {
          await Metrics.initializeTables(env);
          return handleMetricsRequest(req, env, path, session);
        });
      }
      
      // Route Sparks API requests (protected)
      if (path.startsWith('/api/sparks')) {
        return requireAuth(request, env, async (req, env, session) => {
          return handleSparkData(req, env);
        });
      }
      
      // Route Templates API requests (protected)
      if (path.startsWith('/api/templates')) {
        return requireAuth(request, env, async (req, env, session) => {
          return handleTemplateData(req, env);
        });
      }
      
      // Route Shopify Stores API requests (protected)
      if (path.startsWith('/api/shopify-stores')) {
        return requireAuth(request, env, async (req, env, session) => {
          return handleShopifyStoresData(req, env);
        });
      }
      
      // Route Campaigns API requests
      if (path.startsWith('/api/campaigns')) {
        // Client endpoints are public (no auth required)
        if (path.includes('/api/campaigns/client/')) {
          return handleCampaignsAPI(request, env, path);
        }
        // All other campaign endpoints require auth
        return requireAuth(request, env, async (req, env) => {
          return handleCampaignsAPI(req, env, path);
        });
      }
      
      // Route Logs API requests (protected)
      if (path.startsWith('/api/logs')) {
        return requireAuth(request, env, async (req, env) => {
          return handleLogsData(req, env);
        });
      }
      
      // For any other route, serve the Vue app
      console.log('Fallback route handler:', { path, hasAssets: !!env.ASSETS });
      
      if (env.ASSETS) {
        // For SPA routes (like /auth/callback/whop), we need to serve index.html
        // Check if the request is for a specific file (has extension) or a route
        const hasFileExtension = path.includes('.') && !path.endsWith('/');
        
        console.log('Route details:', { path, hasFileExtension });
        
        if (!hasFileExtension) {
          // This is a route, not a file - serve index.html
          const indexRequest = new Request(new URL('/index.html', request.url), request);
          console.log('Serving index.html for SPA route:', path);
          return env.ASSETS.fetch(indexRequest);
        }
        
        // For actual files, serve them directly
        console.log('Serving file directly:', path);
        return env.ASSETS.fetch(request);
      } else {
        // Fallback for development or if ASSETS is not available
        console.log('No ASSETS binding found, returning 404');
        return new Response('Not found - ASSETS binding missing', { status: 404 });
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