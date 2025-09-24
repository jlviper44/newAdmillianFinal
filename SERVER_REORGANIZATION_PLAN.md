# Server Reorganization Plan

## Current Problems

- **500-line index.js** with massive routing logic
- **Inconsistent structure**: Some features in `/Dashboard`, some at root level
- **LinkSplitter has 8 files** with SQL schemas mixed in with code
- **No clear separation**: routes, controllers, services, models all mixed together
- **Hard to navigate**: Deep nesting makes it difficult to find and modify code

## Current Structure

```
server/
├── index.js (496 lines - routing hell)
├── Auth/
├── BCGen/
├── CommentBot/
├── Dashboard/
│   ├── AdLaunches/
│   ├── Campaigns/
│   ├── LinkSplitter/ (8 files + SQL schemas)
│   ├── Logs/
│   ├── Metrics/
│   ├── ShopifyStores/
│   ├── Sparks/
│   └── Templates/
├── ErrorLogs/
├── SQL/
├── Teams/
└── utils/
```

## Proposed Structure

```
server/
├── index.js                    # Thin entry point (~50 lines)
│
├── routes/                     # All route definitions
│   ├── index.js               # Route aggregator
│   ├── auth.routes.js
│   ├── campaigns.routes.js
│   ├── link-splitter.routes.js
│   ├── sparks.routes.js
│   ├── comment-bot.routes.js
│   ├── ad-launches.routes.js
│   ├── metrics.routes.js
│   ├── teams.routes.js
│   ├── templates.routes.js
│   ├── shopify-stores.routes.js
│   ├── logs.routes.js
│   ├── error-logs.routes.js
│   ├── bcgen.routes.js
│   └── sql.routes.js
│
├── features/                   # Business logic by domain
│   ├── auth/
│   │   ├── auth.controller.js
│   │   ├── auth.service.js
│   │   └── session.service.js
│   │
│   ├── campaigns/
│   │   ├── campaigns.controller.js
│   │   ├── campaigns.service.js
│   │   ├── launches.service.js
│   │   └── utils.js
│   │
│   ├── link-splitter/
│   │   ├── link-splitter.controller.js
│   │   ├── analytics.service.js
│   │   ├── analytics-aggregation.service.js
│   │   ├── advanced-analytics.service.js
│   │   ├── fraud-detection.service.js
│   │   └── geo-location.service.js
│   │
│   ├── sparks/
│   │   ├── sparks.controller.js
│   │   ├── sparks.service.js
│   │   ├── invoice-management.service.js
│   │   └── payment-settings.service.js
│   │
│   ├── comment-bot/
│   │   ├── comment-bot.controller.js
│   │   ├── comment-bot.service.js
│   │   └── comment-bot.worker.js
│   │
│   ├── ad-launches/
│   │   ├── ad-launches.controller.js
│   │   ├── ad-launches.service.js
│   │   └── payroll.service.js
│   │
│   ├── error-logs/
│   │   ├── error-logs.controller.js
│   │   ├── error-storage.service.js
│   │   ├── cloudflare-log-reader.service.js
│   │   └── error-handler.service.js
│   │
│   ├── metrics/
│   │   ├── metrics.controller.js
│   │   └── metrics.service.js
│   │
│   ├── teams/
│   │   ├── teams.controller.js
│   │   └── teams.service.js
│   │
│   ├── templates/
│   │   ├── templates.controller.js
│   │   └── templates.service.js
│   │
│   ├── shopify-stores/
│   │   ├── shopify-stores.controller.js
│   │   └── shopify-stores.service.js
│   │
│   ├── logs/
│   │   ├── logs.controller.js
│   │   └── logs.service.js
│   │
│   ├── bcgen/
│   │   ├── bcgen.controller.js
│   │   └── bcgen.service.js
│   │
│   └── sql/
│       ├── sql.controller.js
│       └── sql.service.js
│
├── middleware/                 # Shared middleware
│   ├── auth.middleware.js     # requireAuth, isAdmin
│   └── error.middleware.js    # Error capture & logging
│
├── database/                   # All DB schemas separated
│   ├── migrations/
│   └── schemas/
│       ├── auth.sql
│       ├── link-splitter.sql
│       ├── advanced-analytics.sql
│       ├── analytics.sql
│       ├── sparks.sql
│       ├── campaigns.sql
│       └── ...
│
├── jobs/                       # Cron & background jobs
│   ├── scheduler.js           # Main scheduled task handler
│   ├── payroll.job.js         # Weekly payroll generation
│   ├── comment-bot.job.js     # Comment bot queue processor
│   └── background.job.js      # Background job processor
│
└── shared/                     # Shared utilities
    └── utils/
        ├── error-capture.js
        ├── log-error.js
        └── ...
```

## Key Changes

### 1. **index.js** → Thin entry point
- Just bootstraps app
- Delegates to routes
- Sets up jobs
- No routing logic (~50 lines max)

### 2. **routes/** → Clean route definitions
- Each feature has its own route file
- Routes only define paths and middleware
- Delegate to controllers
- Easy to see all endpoints at a glance

### 3. **features/** → Domain-driven organization
- Each feature in its own folder
- **Controllers**: Handle requests/responses
- **Services**: Business logic
- Clear single responsibility

### 4. **middleware/** → Extract common logic
- `requireAuth` → `auth.middleware.js`
- `isAdmin` → `auth.middleware.js`
- Error capture → `error.middleware.js`

### 5. **database/** → SQL separated from code
- All `.sql` files in one place
- Organized by feature
- No SQL mixed with JS

### 6. **jobs/** → Scheduled tasks isolated
- Cron jobs separated from routes
- Background workers isolated
- Clear job scheduling logic

## Benefits

✅ **Each file < 300 lines** - easier to understand and modify
✅ **Clear responsibility boundaries** - know exactly where to look
✅ **Easy to find/modify features** - everything for a feature in one place
✅ **Claude can navigate confidently** - consistent structure
✅ **Testable units** - controllers and services can be tested independently
✅ **Scalable** - easy to add new features without touching existing code

## Migration Strategy

### Phase 1: Setup Structure (Low Risk)
1. Create new folder structure
2. Create middleware files (extract from Auth)
3. Move SQL schemas to database/

### Phase 2: Migrate One Feature (Test Pattern)
1. Start with **LinkSplitter** (most files, clear boundaries)
2. Create routes/link-splitter.routes.js
3. Create features/link-splitter/ with controller + services
4. Update index.js to use new route
5. Test thoroughly

### Phase 3: Migrate Remaining Features (Repeat Pattern)
1. Auth
2. Campaigns
3. Sparks
4. Comment Bot
5. Ad Launches
6. Error Logs
7. Metrics
8. Teams
9. Templates
10. Shopify Stores
11. Logs
12. BCGen
13. SQL

### Phase 4: Final Cleanup
1. Slim down index.js to ~50 lines
2. Move cron jobs to jobs/
3. Remove old Dashboard/ folder
4. Update imports across codebase

## File Naming Conventions

- **Routes**: `feature-name.routes.js`
- **Controllers**: `feature-name.controller.js`
- **Services**: `descriptive-name.service.js`
- **Middleware**: `purpose.middleware.js`
- **Jobs**: `task-name.job.js`

## Import Examples

### Before
```javascript
import { handleLinkSplitter } from './Dashboard/LinkSplitter/LinkSplitterHandler';
```

### After
```javascript
import linkSplitterRoutes from './routes/link-splitter.routes';
```

## Implementation Checklist

### Phase 1: Setup Structure (Low Risk)
- [x] Create `/server/routes/` directory
- [x] Create `/server/features/` directory
- [x] Create `/server/middleware/` directory
- [x] Create `/server/database/schemas/` directory
- [x] Create `/server/jobs/` directory
- [x] Create `/server/shared/utils/` directory
- [x] Extract `requireAuth`, `isAdmin` → `/server/middleware/auth.middleware.js`
- [x] Extract error capture → `/server/middleware/error.middleware.js`
- [x] Move all `.sql` files to `/server/database/schemas/`

### Phase 2: Migrate LinkSplitter (Test Pattern) ✅ COMPLETE
- [x] Create `/server/features/link-splitter/` directory
- [x] Create `link-splitter.controller.js` (move logic from LinkSplitterHandler.js)
- [x] Create `analytics.service.js` (move from AnalyticsAPI.js)
- [x] Create `analytics-aggregation.service.js` (move from AnalyticsAggregation.js)
- [x] Create `advanced-analytics.service.js` (move from AdvancedAnalyticsFeatures.js)
- [x] Create `fraud-detection.service.js` (move from FraudDetectionService.js)
- [x] Create `geo-location.service.js` (move from GeoLocationService.js)
- [x] Create `/server/routes/link-splitter.routes.js`
- [x] Update `index.js` to use new route
- [x] Test all LinkSplitter endpoints
- [x] Delete old `/server/Dashboard/LinkSplitter/` files

### Phase 3: Migrate Auth ✅ COMPLETE
- [x] Create `/server/features/auth/` directory
- [x] Create `auth.controller.js`
- [x] Create `auth.service.js`
- [x] Create `/server/routes/auth.routes.js`
- [x] Update `index.js` imports
- [x] Test auth endpoints
- [ ] Delete old `/server/Auth/` files (keep for now - service still references it)

### Phase 4: Migrate Campaigns ✅ COMPLETE
- [x] Create `/server/features/campaigns/` directory
- [x] Create `campaigns.controller.js`
- [x] Create `launches.service.js`
- [x] Create `utils.js`
- [x] Create `/server/routes/campaigns.routes.js`
- [x] Update `index.js` imports
- [x] Test campaign endpoints
- [x] Delete old `/server/Dashboard/Campaigns/` files

### Phase 5-9: Migrate Sparks, Templates, Shopify, Metrics, Logs ✅ COMPLETE
- [x] Create feature directories
- [x] Create controllers and services
- [x] Create route files
- [x] Update `index.js` imports
- [x] Fix import paths
- [x] Test build
- [x] Delete old Dashboard folders

### Phase 6: Migrate Comment Bot ✅ COMPLETE
- [x] Create `/server/features/comment-bot/` directory
- [x] Create `comment-bot.controller.js`
- [x] Create `comment-bot-queue.service.js`
- [x] Create `comment-bot-worker.service.js`
- [x] Create `/server/routes/comment-bot.routes.js`
- [x] Update `index.js` imports
- [x] Fix import paths (CommentBotQueue.js, CommentBotWorker.js, Auth.js, SQL.js)
- [x] Test build
- [x] Delete old `/server/CommentBot/` files

### Phase 7: Migrate Ad Launches ✅ COMPLETE
- [x] Create `/server/features/ad-launches/` directory
- [x] Create `ad-launches.controller.js`
- [x] Create `/server/routes/ad-launches.routes.js`
- [x] Update `index.js` imports
- [x] Update cron job imports
- [x] Test build
- [x] Delete old `/server/Dashboard/AdLaunches/` files

### Phase 8: Migrate Error Logs ✅ COMPLETE
- [x] Create `/server/features/error-logs/` directory
- [x] Create `error-logs.controller.js`
- [x] Create `cloudflare-log-reader.service.js`
- [x] Create `error-handler.service.js`
- [x] Create `/server/routes/error-logs.routes.js`
- [x] Update `index.js` imports
- [x] Fix import paths (cloudflareLogReader.js, errorStorage.js, Auth.js)
- [x] Test build
- [x] Delete old `/server/ErrorLogs/` files

### Phase 9: Migrate Metrics ✅ COMPLETE (Already migrated in Phase 5-9)
- [x] Create `/server/features/metrics/` directory
- [x] Create `metrics.controller.js`
- [x] Create `/server/routes/metrics.routes.js`
- [x] Update `index.js` imports
- [x] Fix SQL import path
- [x] Test build
- [x] Delete old `/server/Dashboard/Metrics/` files

### Phase 10: Migrate Teams ✅ COMPLETE
- [x] Create `/server/features/teams/` directory
- [x] Create `teams.controller.js`
- [x] Create `/server/routes/teams.routes.js`
- [x] Update `index.js` imports
- [x] Fix import paths (Auth.js, SQL.js)
- [x] Test build
- [x] Delete old `/server/Teams/` files

### Phase 11: Migrate Templates ✅ COMPLETE (Already migrated in Phase 5-9)
- [x] Create `/server/features/templates/` directory
- [x] Create `templates.controller.js`
- [x] Create `/server/routes/templates.routes.js`
- [x] Update `index.js` imports
- [x] Test build
- [x] Delete old `/server/Dashboard/Templates/` files

### Phase 12: Migrate Shopify Stores ✅ COMPLETE (Already migrated in Phase 5-9)
- [x] Create `/server/features/shopify-stores/` directory
- [x] Create `shopify-stores.controller.js`
- [x] Create `/server/routes/shopify-stores.routes.js`
- [x] Update `index.js` imports
- [x] Test build
- [x] Delete old `/server/Dashboard/ShopifyStores/` files

### Phase 13: Migrate Logs ✅ COMPLETE (Already migrated in Phase 5-9)
- [x] Create `/server/features/logs/` directory
- [x] Create `logs.controller.js`
- [x] Create `init-logs-table.service.js`
- [x] Create `/server/routes/logs.routes.js`
- [x] Update `index.js` imports
- [x] Test build
- [x] Delete old `/server/Dashboard/Logs/` files

### Phase 14: Migrate BCGen ✅ COMPLETE
- [x] Create `/server/features/bcgen/` directory
- [x] Create `bcgen.controller.js`
- [x] Create `/server/routes/bcgen.routes.js`
- [x] Update `index.js` imports
- [x] Fix Auth.js import path
- [x] Test build
- [x] Delete old `/server/BCGen/` files

### Phase 15: Migrate SQL ✅ COMPLETE
- [x] Create `/server/features/sql/` directory
- [x] Create `sql.controller.js`
- [x] Create `/server/routes/sql.routes.js`
- [x] Update `index.js` imports
- [x] Test build
- [x] Delete old `/server/SQL/` files

### Phase 16: Final Cleanup ✅ COMPLETE
- [x] Create `/server/routes/index.js` (route aggregator)
- [x] Refactor `index.js` to use route aggregator (77 lines - from 443!)
- [x] Move cron jobs to `/server/jobs/scheduler.js`
- [x] Move background processor to `/server/jobs/background.job.js`
- [x] Move shared utils to `/server/shared/utils/`
- [x] Delete old `/server/Dashboard/` directory
- [x] Delete old `/server/utils/` directory
- [x] Update all remaining imports across codebase
- [x] Run build - SUCCESS ✅

## Success Criteria

- ✅ index.js under 100 lines
- ✅ No file over 300 lines
- ✅ All SQL in database/schemas/
- ✅ Clear feature boundaries
- ✅ Consistent naming
- ✅ All tests passing