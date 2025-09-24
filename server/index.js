import { cleanExpiredSessions, initializeAuthTables } from './Auth/Auth';
import { handleApiRoutes, handleShortLinks } from './routes/index.js';
import { processBackgroundJobs, canProcessJob } from './jobs/background.job.js';
import { handleScheduledTasks } from './jobs/scheduler.js';
import { setupErrorCapture } from './shared/utils/errorCapture.js';

export default {
  async fetch(request, env, ctx) {
    const errorCapture = setupErrorCapture(env);

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      console.log(`[REQUEST] ${request.method} ${path}`);

      if (!env.DB_INITIALIZED) {
        console.log('[INIT] Initializing database...');
        await initializeAuthTables(env);
        env.DB_INITIALIZED = true;
        console.log('[INIT] Database initialized');
      }

      if (canProcessJob()) {
        ctx.waitUntil(processBackgroundJobs(env, ctx));
      }

      const shortLinkResult = await handleShortLinks(request, env, path);
      if (shortLinkResult) return shortLinkResult;

      try {
        if (Math.random() < 0.01) {
          cleanExpiredSessions(env.USERS_DB).catch(console.error);
        }

        const apiResult = await handleApiRoutes(request, env, path);
        if (apiResult) return apiResult;

        if (env.ASSETS) {
          return env.ASSETS.fetch(request);
        }

        return new Response('Not found - ASSETS binding missing', { status: 404 });
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
    } catch (error) {
      await errorCapture.logError(error, {
        source: 'worker-main',
        path: request.url,
        method: request.method,
        metadata: {
          headers: Object.fromEntries(request.headers),
          cf: request.cf
        }
      });

      return new Response(
        JSON.stringify({ error: 'Internal server error', message: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  },

  async scheduled(controller, env, ctx) {
    await handleScheduledTasks(controller, env, ctx);
  }
};