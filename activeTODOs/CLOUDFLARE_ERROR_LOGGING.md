# Cloudflare Error Logging Implementation

## Overview
This document outlines the implementation of a comprehensive error logging system for Cloudflare-related errors in your application.

## Project Structure

```
server/
├── ErrorLogs/
│   ├── errorLogger.js          # Core error logging functionality
│   ├── cloudflareErrorHandler.js # Cloudflare-specific error handlers
│   └── errorRoutes.js          # API endpoints for error management

src/views/Dashboard/components/
└── ErrorLogs/
    └── ErrorLogsView.vue        # Admin UI for viewing error logs
```

## Backend Implementation

### 1. Error Logger (`server/ErrorLogs/errorLogger.js`)
Core logging functionality with features:
- Automatic log file creation by date
- Recent errors cache (last 100 errors)
- Filtering by source, date range
- Automatic cleanup of old logs
- JSON format for easy parsing

### 2. Cloudflare Error Handler (`server/ErrorLogs/cloudflareErrorHandler.js`)
Specialized handlers for different Cloudflare services:
- Worker errors
- D1 database errors
- KV store errors
- R2 storage errors
- Durable Objects errors
- API errors

### 3. API Routes (`server/ErrorLogs/errorRoutes.js`)
RESTful endpoints for error management:
- `GET /api/error-logs` - Fetch logs with filters
- `GET /api/error-logs/recent` - Get recent errors
- `POST /api/error-logs` - Log general errors
- `POST /api/error-logs/cloudflare/worker` - Log worker errors
- `POST /api/error-logs/cloudflare/d1` - Log D1 errors
- `POST /api/error-logs/cloudflare/kv` - Log KV errors
- `DELETE /api/error-logs/cleanup` - Clean old logs

## Frontend Implementation

### ErrorLogs Admin View (`src/views/Dashboard/components/ErrorLogs/ErrorLogsView.vue`)
Admin interface features:
- Real-time error statistics
- Filtering by source and date range
- Detailed error view with stack traces
- Color-coded error sources
- Responsive design

## Integration Steps

### Step 1: Register Routes in Main Server
Add to your main server file:
```javascript
const errorRoutes = require('./server/ErrorLogs/errorRoutes');
app.use('/api', errorRoutes);
```

### Step 2: Add Middleware for Express Errors
```javascript
const cloudflareErrorHandler = require('./server/ErrorLogs/cloudflareErrorHandler');
app.use(cloudflareErrorHandler.expressMiddleware());
```

### Step 3: Add ErrorLogs Tab to Dashboard
Update `src/views/Dashboard/Dashboard.vue`:

1. Import the component:
```javascript
import ErrorLogsView from './components/ErrorLogs/ErrorLogsView.vue';
```

2. Add to the template (admin only):
```vue
<!-- Error Logs Tab (Admin Only) -->
<div v-if="selectedTab === 'errorlogs' && isAdmin">
  <ErrorLogsView />
</div>
```

3. Add tab to navigation:
```javascript
{
  value: 'errorlogs',
  title: 'Error Logs',
  icon: 'mdi-alert-circle',
  adminOnly: true
}
```

### Step 4: Integration in Cloudflare Workers

Example worker error handling:
```javascript
export default {
  async fetch(request, env, ctx) {
    try {
      // Your worker logic
    } catch (error) {
      // Log to your server
      await fetch('https://yourapi.com/api/error-logs/cloudflare/worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.API_KEY}`
        },
        body: JSON.stringify({
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name
          },
          context: {
            url: request.url,
            method: request.method,
            headers: Object.fromEntries(request.headers),
            cf: request.cf
          }
        })
      });

      // Return error response
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
```

### Step 5: D1 Database Error Handling
```javascript
async function queryD1(env, query, params) {
  try {
    return await env.DB.prepare(query).bind(...params).all();
  } catch (error) {
    await logD1Error(error, { query, params, database: 'main' });
    throw error;
  }
}
```

## Usage Examples

### Logging Worker Errors
```javascript
const cloudflareErrorHandler = require('./server/ErrorLogs/cloudflareErrorHandler');

// In your API endpoint that processes worker requests
app.post('/worker/process', async (req, res) => {
  try {
    // Worker processing logic
  } catch (error) {
    await cloudflareErrorHandler.handleWorkerError(error, {
      url: req.body.url,
      method: req.body.method,
      workerId: req.body.workerId
    });
    res.status(500).json({ error: 'Worker processing failed' });
  }
});
```

### Logging D1 Errors
```javascript
// In your D1 query handler
async function executeD1Query(query, params) {
  try {
    // Execute D1 query
  } catch (error) {
    await cloudflareErrorHandler.handleD1Error(error, {
      database: 'production',
      query,
      params,
      operation: 'SELECT'
    });
    throw error;
  }
}
```

## Monitoring & Maintenance

### Automatic Cleanup
The system automatically maintains log files. To configure cleanup:
```javascript
// Clean logs older than 30 days (runs daily via cron)
await errorLogger.clearOldLogs(30);
```

### Error Statistics
The admin view displays:
- Total errors
- Errors today
- Errors this week
- Errors by source

### Performance Considerations
- Logs are stored as JSON files grouped by date
- Recent errors cache reduces file I/O
- Maximum 100 recent errors kept in memory
- Automatic pagination in UI (25 items per page)

## Security Notes

1. **Admin Only Access**: All error log endpoints require admin authentication
2. **Sensitive Data**: Be careful not to log sensitive information (passwords, API keys)
3. **Rate Limiting**: Consider implementing rate limiting on error logging endpoints
4. **CORS**: Configure CORS appropriately for Cloudflare Workers

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure the server has write permissions to `server/ErrorLogs/`
2. **Missing Logs**: Check if the error handler is properly integrated
3. **UI Not Loading**: Verify admin permissions and API routes are registered

### Debug Mode
Enable detailed logging:
```javascript
const errorLogger = require('./errorLogger');
errorLogger.debug = true; // Enables console output
```

## Future Enhancements

Consider implementing:
1. Email notifications for critical errors
2. Slack/Discord webhooks for real-time alerts
3. Error grouping and deduplication
4. Automated error resolution tracking
5. Performance impact analysis
6. Export functionality (CSV/PDF)
7. Error trending and analytics
8. Integration with monitoring services (Sentry, DataDog)

## Support

For issues or questions:
1. Check error logs in `server/ErrorLogs/` directory
2. Verify middleware is properly configured
3. Ensure Cloudflare Workers have correct API endpoint
4. Check browser console for frontend errors