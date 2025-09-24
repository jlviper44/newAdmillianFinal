# Route Execution Tracking Plan

## Goal
Simple, lightweight error logging so you can see route errors in the Error Logs tab without using Cloudflare dashboard.

## Current State
- ✅ Error logs D1 table already exists (`error_logs`)
- ✅ Error Logs UI tab already built
- ❌ Routes don't log errors - tab stays empty
- 14 route files need error handling

## Simple Solution

Just wrap each route with try-catch and log errors to the existing D1 table.

### Step 1: Add Error Logging Helper

**File:** `server/shared/utils/logRouteError.js`

```javascript
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
```

### Step 2: Update Each Route (Pattern)

**Before:**
```javascript
export function registerCampaignsRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/campaigns')) {
      return handleCampaignsAPI(request, env, path);
    }
    return null;
  };
}
```

**After:**
```javascript
import { logRouteError } from '../shared/utils/logRouteError.js';

export function registerCampaignsRoutes() {
  return async function(request, env, path) {
    if (path.startsWith('/api/campaigns')) {
      try {
        return await handleCampaignsAPI(request, env, path);
      } catch (error) {
        await logRouteError(error, 'campaigns', request, env);
        throw error;
      }
    }
    return null;
  };
}
```

That's it. 3 lines per route.

## Routes to Update (14 files)

1. `server/routes/auth.routes.js`
2. `server/routes/campaigns.routes.js`
3. `server/routes/link-splitter.routes.js`
4. `server/routes/sparks.routes.js`
5. `server/routes/templates.routes.js`
6. `server/routes/shopify-stores.routes.js`
7. `server/routes/metrics.routes.js`
8. `server/routes/logs.routes.js`
9. `server/routes/comment-bot.routes.js`
10. `server/routes/ad-launches.routes.js`
11. `server/routes/error-logs.routes.js`
12. `server/routes/teams.routes.js`
13. `server/routes/bcgen.routes.js`
14. `server/routes/sql.routes.js`

## What You Get

### In Error Logs Tab:
- All route errors automatically logged
- Source shows which route failed (e.g., `route-campaigns`)
- Metadata includes method, path, user email
- Full error message and stack trace
- Timestamp for debugging

### In Console:
- Original error still logged
- No extra noise
- Same behavior as before

## Implementation Time

- Create helper: 5 mins
- Update all 14 routes: 15 mins
- Test: 5 mins
- **Total: 25 mins**

## Why This Works

1. ✅ Uses existing `error_logs` table - no schema changes
2. ✅ Uses existing `ErrorStorage` class - no new code
3. ✅ Minimal overhead - just a DB insert
4. ✅ Errors still propagate - doesn't break existing behavior
5. ✅ Works with existing Error Logs UI
6. ✅ No Cloudflare dashboard needed - just check the tab