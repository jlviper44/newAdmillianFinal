# Cloudflare Logs Integration Setup

## Overview
The Error Logs system can now automatically fetch and display logs directly from Cloudflare, including:
- HTTP errors (4xx, 5xx status codes)
- Worker errors and exceptions
- D1 database errors
- KV store errors
- API errors

## Setup Instructions

### Step 1: Get Your Cloudflare API Credentials

1. **Get your Zone ID:**
   - Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Select your domain
   - On the Overview page, find "Zone ID" in the right sidebar
   - Copy this ID

2. **Get your Account ID:**
   - In Cloudflare Dashboard, click on your account name
   - Go to the Overview page
   - Find "Account ID" in the right sidebar
   - Copy this ID

3. **Create an API Token:**
   - Go to [My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Click "Create Token"
   - Use the "Custom token" template
   - Configure permissions:
     ```
     Zone → Analytics → Read
     Zone → Logs → Read
     Account → Workers Scripts → Read
     Account → Workers Tail → Read
     ```
   - Add Zone Resources: Include → Specific zone → Your domain
   - Click "Continue to summary" → "Create Token"
   - Copy the token (you won't see it again!)

### Step 2: Add Credentials to Wrangler

Add these to your `wrangler.jsonc` file in the `vars` section:

```jsonc
{
  // ... existing config ...
  "vars": {
    // Add these new variables
    "CLOUDFLARE_API_TOKEN": "your_api_token_here",
    "CLOUDFLARE_ZONE_ID": "your_zone_id_here",
    "CLOUDFLARE_ACCOUNT_ID": "your_account_id_here",
    // Optional: Your worker URL for Logpush
    "WORKER_URL": "https://yourdomain.com"
  }
}
```

**For Production:** Use Wrangler secrets instead:
```bash
npx wrangler secret put CLOUDFLARE_API_TOKEN
npx wrangler secret put CLOUDFLARE_ZONE_ID
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
```

### Step 3: Using the Integration

Once configured, you can:

1. **Manual Sync:** Click "Sync Cloudflare" button in the Error Logs UI
   - Fetches logs from the last hour
   - Stores them in your database

2. **Automatic Sync:** Set up a cron job
   - Add to your scheduled handler in `server/index.js`:
   ```javascript
   // Sync Cloudflare logs every hour
   if (currentMinute === 0) {
     const { CloudflareLogReader } = await import('./ErrorLogs/cloudflareLogReader.js');
     const logReader = new CloudflareLogReader(env);
     await logReader.syncLogs();
   }
   ```

3. **Real-time Logging (Advanced):** Set up Logpush
   - Cloudflare will push logs to your endpoint in real-time
   - Requires Enterprise plan or paid Logpush add-on

## What Gets Logged

### HTTP Errors (cloudflare-zone)
- All 4xx and 5xx responses
- Includes: path, method, client IP, user agent, response size

### Worker Errors (cloudflare-worker)
- Exceptions and errors in your Workers
- CPU/memory limit exceeded errors
- Includes: stack traces, worker name, duration

### Custom Errors
- Any errors you manually log using the error logging functions
- Test errors from the UI

## Viewing Logs

In the Error Logs interface, you can:
- Filter by source (cloudflare-zone, cloudflare-worker, etc.)
- Filter by date range
- View detailed error information including stack traces
- See error statistics (total, today, this week)

## Troubleshooting

### "Cloudflare API credentials not configured"
- Make sure you've added all three credentials (API_TOKEN, ZONE_ID, ACCOUNT_ID)
- Restart your dev server after adding credentials

### No logs appearing after sync
- Check that your site has had some errors in the last hour
- Verify API token has correct permissions
- Check browser console for error messages

### 403 Forbidden on sync
- Make sure you're logged in as an admin user
- Check that your API token is valid
- Verify the Zone ID matches your domain

## Testing

1. **Generate test errors:**
   - Click "Test Error" button to create sample errors
   - Visit a non-existent page on your site (404 error)
   - Trigger an error in your Worker code

2. **Sync and view:**
   - Click "Sync Cloudflare" to fetch recent errors
   - Use filters to find specific error types
   - Click on errors to view full details

## Security Notes

- API tokens are sensitive - never commit them to git
- Use Wrangler secrets for production
- The `/api/error-logs/ingest` endpoint is public (for Logpush) but only accepts valid Cloudflare log format
- All other endpoints require admin authentication

## Advanced Features

### Custom Error Sources
You can add more error sources by modifying `cloudflareLogReader.js`:
- Add new fetch methods for different Cloudflare services
- Parse and format the data
- Store using the existing `errorStorage.logError()` method

### Automated Alerts
Consider adding:
- Email notifications for critical errors
- Slack/Discord webhooks for real-time alerts
- Threshold-based alerting (e.g., >100 errors/hour)

### Analytics
The logged data can be used for:
- Error rate trends
- Most common error types
- Performance impact analysis
- User experience monitoring