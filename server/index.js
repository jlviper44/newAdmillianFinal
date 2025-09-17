import { handleCommentBotData } from './CommentBot/CommentBot';
import { handleAuth, requireAuth, cleanExpiredSessions, initializeAuthTables } from './Auth/Auth';
import { handleSQLData } from './SQL/SQL';
import BCGen from './BCGen/BCGen';
import { handleMetricsRequest, Metrics } from './Dashboard/Metrics/Metrics';
import { handleSparkData } from './Dashboard/Sparks/Sparks';
import { handleTemplateData } from './Dashboard/Templates/Templates';
import { handleShopifyStoresData } from './Dashboard/ShopifyStores/ShopifyStores';
import handleCampaignsAPI from './Dashboard/Campaigns/Campaigns';
import { handleLogsData } from './Dashboard/Logs/Logs';
import { handleTeams } from './Teams/Teams';
import { handleLinkSplitter } from './Dashboard/LinkSplitter/LinkSplitterHandler';
import { handleAdLaunches } from './Dashboard/AdLaunches/AdLaunches';

// Global state for background worker
let workerRunning = false;
let lastWorkerRun = 0;

// Simple background job processor
async function processBackgroundJobs(env) {
  const now = Date.now();
  
  // Only run if it's been at least 5 seconds since last run
  if (now - lastWorkerRun < 5000) {
    return;
  }
  
  // Prevent concurrent runs
  if (workerRunning) {
    return;
  }
  
  workerRunning = true;
  lastWorkerRun = now;
  
  try {
    const { processCronJobs } = await import('./CommentBot/CommentBotWorker.js');
    const processedCount = await processCronJobs(env, 1); // Process only 1 job at a time
    
    if (processedCount > 0) {
      console.log(`Background: Processed ${processedCount} CommentBot job`);
    }
  } catch (error) {
    console.error('Background job processor error:', error);
  } finally {
    workerRunning = false;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Initialize database on first request (migrations will run once)
    if (!env.DB_INITIALIZED) {
      await initializeAuthTables(env);
      env.DB_INITIALIZED = true;
    }
    
    // Process background jobs on every request (with throttling)
    ctx.waitUntil(processBackgroundJobs(env));
    
    // PRIORITY: Handle /l/ routes before ANYTHING else, including assets
    // This ensures short links work like Bitly
    // BUT make sure to exclude /link-splitter which contains /l
    if (path.startsWith('/l/') && !path.startsWith('/link-splitter')) {
      console.log('Intercepting short link BEFORE assets:', path);
      return handleLinkSplitter(request, env, path, null);
    }
    
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
      // TEMPORARILY DISABLED - Let fallback handler deal with this
      /*
      const normalizedPath = path.toLowerCase();
      if (normalizedPath === '/auth/callback/whop' || normalizedPath.startsWith('/auth/callback/')) {
        console.log('Auth callback route detected:', { 
          path,
          normalizedPath,
          url: request.url,
          hasAssets: !!env.ASSETS,
          envKeys: Object.keys(env)
        });
        
        // Retry mechanism for iPhone Safari
        const userAgent = request.headers.get('user-agent') || '';
        const isIPhone = /iPhone|iPad|iPod/i.test(userAgent);
        let assetsAvailable = !!env.ASSETS;
        
        // If ASSETS not available and it's iPhone, retry a few times
        if (!assetsAvailable && isIPhone) {
          console.log('ASSETS not available on iPhone, attempting retries...');
          const maxRetries = 5;
          const retryDelay = 100; // ms
          
          for (let i = 0; i < maxRetries && !assetsAvailable; i++) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            assetsAvailable = !!env.ASSETS;
            console.log(`Retry ${i + 1}/${maxRetries}: ASSETS available = ${assetsAvailable}`);
          }
        }
        
        if (assetsAvailable && env.ASSETS) {
          const indexRequest = new Request(new URL('/index.html', request.url), request);
          return env.ASSETS.fetch(indexRequest);
        } else {
          // Log why we're returning an error instead of falling through
          console.error('ASSETS binding not available after retries:', {
            path,
            normalizedPath,
            isIPhone,
            assetsAvailable,
            envKeys: Object.keys(env)
          });
          
          // If no ASSETS, return a helpful error with debugging info
          return new Response(
            `Vue app not found. ASSETS binding may be missing.\n\n` +
            `Device: ${isIPhone ? 'iPhone/iPad' : 'Other'}\n` +
            `User Agent: ${userAgent}\n` +
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
      */
      
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
          req.ctx = { ...req.ctx, session };
          return handleSparkData(req, env);
        });
      }
      
      // Route Templates API requests (protected)
      if (path.startsWith('/api/templates')) {
        return requireAuth(request, env, async (req, env, session) => {
          req.ctx = { ...req.ctx, session };
          return handleTemplateData(req, env);
        });
      }
      
      // Route Shopify Stores API requests (protected)
      if (path.startsWith('/api/shopify-stores')) {
        return requireAuth(request, env, async (req, env, session) => {
          req.ctx = { ...req.ctx, session };
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
        return requireAuth(request, env, async (req, env, session) => {
          // Add session to request context for campaigns handler
          req.ctx = { ...req.ctx, session };
          console.log('[Index] Setting session context for campaigns:', {
            hasSession: !!session,
            userId: session?.user_id || session?.user?.id,
            isVirtualAssistant: session?.user?.isVirtualAssistant
          });
          return handleCampaignsAPI(req, env, path);
        });
      }
      
      // Route Logs API requests
      if (path.startsWith('/api/logs')) {
        // Public endpoint for campaign tracking (no auth required)
        if (path === '/api/logs/public') {
          // Handle CORS preflight
          if (request.method === 'OPTIONS') {
            return new Response(null, {
              status: 200,
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
              }
            });
          }
          if (request.method === 'POST') {
            return handleLogsData(request, env);
          }
        }
        // All other log endpoints require auth
        return requireAuth(request, env, async (req, env, session) => {
          req.ctx = { ...req.ctx, session };
          return handleLogsData(req, env);
        });
      }
      
      // Route LinkSplitter API requests (protected)
      if (path.startsWith('/api/link-splitter')) {
        return requireAuth(request, env, async (req, env, session) => {
          return handleLinkSplitter(req, env, path, session);
        });
      }
      
      // Route Ad Launches and Payroll API requests (protected)
      const isPayrollRoute = path.startsWith('/api/tracker') || 
          path.startsWith('/api/timeclock') || 
          path.startsWith('/api/clock-') || 
          path.startsWith('/api/payroll') || 
          path.startsWith('/api/va-rates') ||
          path.startsWith('/api/launch-entry') ||
          path.startsWith('/api/time-entry') ||
          path === '/api/generate-weekly-payroll';
      
      console.log('Checking payroll routes:', { 
        path, 
        isPayrollRoute,
        startsWithTracker: path.startsWith('/api/tracker'),
        startsWithTimeclock: path.startsWith('/api/timeclock'),
        startsWithPayroll: path.startsWith('/api/payroll'),
        isWeeklyPayroll: path === '/api/generate-weekly-payroll'
      });
      
      if (isPayrollRoute) {
        console.log('Routing to handleAdLaunches for path:', path);
        return requireAuth(request, env, async (req, env, session) => {
          req.ctx = { ...req.ctx, session };
          return handleAdLaunches(req, env);
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
        // Fallback for when ASSETS is not available
        console.log('No ASSETS binding found for path:', path);
        
        // For auth callback routes, return a basic HTML page that completes the auth flow
        if (path.startsWith('/auth/callback/')) {
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Completing authentication...</title>
            </head>
            <body>
              <div style="text-align: center; padding: 50px; font-family: system-ui;">
                <h2>Completing authentication...</h2>
                <p>If you're not redirected automatically, <a href="/">click here</a>.</p>
              </div>
              <script>
                // Try to complete the auth flow
                try {
                  const urlParams = new URLSearchParams(window.location.search);
                  const code = urlParams.get('code');
                  const state = urlParams.get('state');
                  
                  if (code && state) {
                    // Set the same flag that AuthCallback.vue sets
                    sessionStorage.setItem('auth_callback_complete', 'true');
                    
                    // Also store the parameters for the Vue app to process
                    sessionStorage.setItem('pending_auth_code', code);
                    sessionStorage.setItem('pending_auth_state', state);
                    
                    // Redirect to home page
                    window.location.href = '/';
                  }
                } catch (e) {
                  console.error('Auth callback error:', e);
                  window.location.href = '/';
                }
              </script>
            </body>
            </html>
          `;
          
          return new Response(html, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
            }
          });
        }
        
        // For other routes, return 404
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
  
  async scheduled(controller, env, ctx) {
    // Weekly payroll generation - runs every Monday at 00:15 EST (05:15 UTC)
    const currentTime = new Date();
    const currentHour = currentTime.getUTCHours();
    const currentMinute = currentTime.getUTCMinutes();
    const currentDay = currentTime.getUTCDay();
    
    console.log(`Scheduled task running at ${currentTime.toISOString()}`);
    
    // Check if it's Monday at 05:15 UTC (00:15 EST)
    if (currentDay === 1 && currentHour === 5 && currentMinute === 15) {
      console.log('Running weekly payroll generation...');
      
      try {
        // Import the generateWeeklyPayroll function from AdLaunches
        const { generateWeeklyPayroll } = await import('./Dashboard/AdLaunches/AdLaunches');
        
        // Generate weekly payroll reports
        const reports = await generateWeeklyPayroll(env);
        
        console.log(`Successfully generated ${reports.length} payroll reports`);
        
        // Also generate scheduled invoices for Sparks
        const { generateScheduledInvoices } = await import('./Dashboard/Sparks/InvoiceManagement.js');
        const invoiceResult = await generateScheduledInvoices(env.DASHBOARD_DB);
        console.log(`Generated ${invoiceResult.generated} scheduled invoices for Sparks`);
      } catch (error) {
        console.error('Failed to generate weekly payroll or invoices:', error);
      }
    }
    
    // Process comment bot queue jobs every minute
    console.log(`[CRON ${currentHour}:${currentMinute}] Processing comment bot queue jobs...`);
    
    try {
      // Import the queue worker
      const { processCronJobs } = await import('./CommentBot/CommentBotWorker');
      
      // Process only 1 job from the queue per minute
      const processedCount = await processCronJobs(env, 1);
      
      if (processedCount > 0) {
        console.log(`[CRON ${currentHour}:${currentMinute}] Successfully processed ${processedCount} comment bot job(s)`);
      } else {
        console.log(`[CRON ${currentHour}:${currentMinute}] No jobs to process`);
      }
      
      // Clean up old completed jobs (older than 7 days) - only once per hour
      if (currentMinute === 0) {
        const { cleanupOldJobs } = await import('./CommentBot/CommentBotQueue');
        const cleanedCount = await cleanupOldJobs(env);
        
        if (cleanedCount > 0) {
          console.log(`Cleaned up ${cleanedCount} old comment bot jobs`);
        }
      }
    } catch (error) {
      console.error('Failed to process comment bot queue:', error);
    }
    
    // You can add other scheduled tasks here based on the cron schedule
    // The crons are: hourly, daily at midnight, weekly on Sunday, monthly on 1st
  }
};