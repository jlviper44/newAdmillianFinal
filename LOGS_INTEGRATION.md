# Logs Worker Integration

This document describes how the logsWorker (Cloudflare Worker for click tracking) has been integrated into the dashboard.

## Integration Overview

The logsWorker.js file has been integrated as a module within the existing dashboard infrastructure:

1. **Server-side Handler**: `/server/Dashboard/Logs/Logs.js`
   - Proxies requests to the Cloudflare Workers logs API
   - Handles authentication through the existing auth middleware

2. **Frontend Component**: `/src/views/Dashboard/components/Logs/LogsView.vue`
   - Vue.js component using Vuetify for UI consistency
   - Displays logs data with filtering, pagination, and statistics

3. **API Service**: `/src/services/logsAPI.js`
   - Handles all frontend API calls related to logs
   - Provides a clean interface for the Vue component

4. **Routing Integration**:
   - Added to Dashboard sidebar navigation
   - Protected route requiring authentication
   - Accessible at `/dashboard` → Logs tab

## API Endpoints

All endpoints are prefixed with `/api/logs` and require authentication:

- `GET /api/logs` - List logs with filtering and pagination
- `GET /api/logs/:id` - Get single log details
- `GET /api/logs/summary` - Get summary statistics
- `GET /api/logs/by-campaign` - Get logs grouped by campaign
- `GET /api/logs/by-type` - Get logs grouped by type
- `POST /api/logs/clear` - Clear old logs
- `GET /api/logs/export` - Export logs as CSV
- `GET /api/logs/campaigns/list` - Get campaigns list for filtering

## Features Integrated

- **Statistics Dashboard**: Total clicks, conversion rate, blocked clicks, first 10 clicks
- **Filtering**: By campaign, type, decision, tags, date range, and search
- **Data Table**: Sortable columns with pagination
- **Log Details**: View detailed information for each log entry
- **Export**: Download filtered logs as CSV
- **Maintenance**: Clear old logs functionality

## Authentication

The logs module is protected by the existing authentication system:
- Uses `requireAuth` middleware in the server
- Only accessible to authenticated users with dashboard access
- Session-based authentication with cookies

## Note

The original logsWorker.js remains as a standalone Cloudflare Worker. The integration proxies requests to this worker while adding authentication and integrating with the dashboard UI.