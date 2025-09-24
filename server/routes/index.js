import { registerAuthRoutes } from './auth.routes.js';
import { registerCampaignsRoutes } from './campaigns.routes.js';
import { registerSparksRoutes } from './sparks.routes.js';
import { registerTemplatesRoutes } from './templates.routes.js';
import { registerShopifyStoresRoutes } from './shopify-stores.routes.js';
import { registerMetricsRoutes } from './metrics.routes.js';
import { registerLogsRoutes } from './logs.routes.js';
import { registerLinkSplitterRoutes } from './link-splitter.routes.js';
import { registerCommentBotRoutes } from './comment-bot.routes.js';
import { registerAdLaunchesRoutes } from './ad-launches.routes.js';
import { registerErrorLogsRoutes } from './error-logs.routes.js';
import { registerTeamsRoutes } from './teams.routes.js';
import { registerBCGenRoutes } from './bcgen.routes.js';
import { registerSQLRoutes } from './sql.routes.js';

export async function handleApiRoutes(request, env, path) {
  if (path.startsWith('/api/auth') || path.startsWith('/auth/')) {
    const authRoutes = registerAuthRoutes();
    return await authRoutes(request, env, path);
  }

  if (path.startsWith('/api/affiliate') || path === '/api/sql/raw') {
    const metricsRoutes = registerMetricsRoutes();
    return await metricsRoutes(request, env, path);
  }

  if (path.startsWith('/api/sql')) {
    const sqlRoutes = registerSQLRoutes();
    return await sqlRoutes(request, env, path);
  }

  if (path.startsWith('/api/teams')) {
    const teamsRoutes = registerTeamsRoutes();
    return await teamsRoutes(request, env, path);
  }

  if (path.startsWith('/api/commentbot')) {
    const commentBotRoutes = registerCommentBotRoutes();
    return await commentBotRoutes(request, env, path);
  }

  if (path.startsWith('/api/bcgen')) {
    const bcgenRoutes = registerBCGenRoutes();
    return await bcgenRoutes(request, env, path);
  }

  if (path.startsWith('/api/metrics')) {
    const metricsRoutes = registerMetricsRoutes();
    return await metricsRoutes(request, env, path);
  }

  if (path.startsWith('/api/sparks')) {
    const sparksRoutes = registerSparksRoutes();
    return await sparksRoutes(request, env, path);
  }

  if (path.startsWith('/api/templates')) {
    const templatesRoutes = registerTemplatesRoutes();
    return await templatesRoutes(request, env, path);
  }

  if (path.startsWith('/api/shopify-stores')) {
    const shopifyStoresRoutes = registerShopifyStoresRoutes();
    return await shopifyStoresRoutes(request, env, path);
  }

  if (path.startsWith('/api/campaigns')) {
    const campaignsRoutes = registerCampaignsRoutes();
    return await campaignsRoutes(request, env, path);
  }

  if (path.startsWith('/api/logs')) {
    const logsRoutes = registerLogsRoutes();
    return await logsRoutes(request, env, path);
  }

  if (path.startsWith('/api/link-splitter')) {
    const linkSplitterRoutes = registerLinkSplitterRoutes();
    return await linkSplitterRoutes(request, env, path);
  }

  if (path.startsWith('/api/error-logs')) {
    const errorLogsRoutes = registerErrorLogsRoutes();
    return await errorLogsRoutes(request, env, path);
  }

  if (path.startsWith('/api/ad-launches') ||
      path.startsWith('/api/tracker') ||
      path.startsWith('/api/timeclock') ||
      path.startsWith('/api/clock-') ||
      path.startsWith('/api/payroll') ||
      path.startsWith('/api/va-rates') ||
      path.startsWith('/api/launch-entry') ||
      path.startsWith('/api/time-entry')) {
    const adLaunchesRoutes = registerAdLaunchesRoutes();
    return await adLaunchesRoutes(request, env, path);
  }

  return null;
}

export function handleShortLinks(request, env, path) {
  if (path.startsWith('/l/') && !path.startsWith('/link-splitter')) {
    const linkSplitterRoutes = registerLinkSplitterRoutes();
    return linkSplitterRoutes(request, env, path);
  }
  return null;
}