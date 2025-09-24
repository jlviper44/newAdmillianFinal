import { ErrorStorage } from '../../features/error-logs/error-logs.controller.js';

export async function logRouteError(error, routeName, request, env) {
  try {
    const errorStorage = new ErrorStorage(env.DASHBOARD_DB);
    await errorStorage.logError(error, `route-${routeName}`, {
      method: request.method,
      path: new URL(request.url).pathname,
      userEmail: request.ctx?.session?.user?.email
    });
  } catch (logError) {
    console.error('Failed to log route error:', logError);
  }
}