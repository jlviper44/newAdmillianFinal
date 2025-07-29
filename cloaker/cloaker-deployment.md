# Cloaker Worker Deployment Guide

## Overview
The cloaker functionality has been extracted into a standalone Cloudflare Worker that handles:
- TikTok validation page generation
- Offer page generation with affiliate links
- Shopify page creation/updates
- Client data serving
- Log forwarding

## Files
- `cloaker-worker.js` - The standalone cloaker worker
- `cloaker-wrangler.toml` - Cloudflare Worker configuration

## Deployment Steps

### 1. Deploy the Cloaker Worker

```bash
# Deploy to production
wrangler deploy cloaker-worker.js --config cloaker-wrangler.toml --env production

# Or deploy to development
wrangler deploy cloaker-worker.js --config cloaker-wrangler.toml --env development
```

### 2. Note the Worker URL
After deployment, you'll get a URL like:
- Production: `https://cloaker.YOUR-SUBDOMAIN.workers.dev`
- Development: `http://localhost:8788`

### 3. Update Main Application Environment

Add the cloaker URL to your main application's environment:

```bash
# In your main app's wrangler.toml or .env file
CLOAKER_WORKER_URL = "https://cloaker.YOUR-SUBDOMAIN.workers.dev"
```

### 4. Update Client-Side Scripts

The validation pages now fetch data from the cloaker worker at:
```
https://cloaker.YOUR-SUBDOMAIN.workers.dev/api/campaigns/client/{campaignId}/{launchNumber}
```

This URL is already configured in the generated validation pages.

## How It Works

### API Flow

1. **Generate Link Request** (Main App → Cloaker)
   - Main app calls `POST /generate-pages` on cloaker
   - Passes campaign data, store credentials, and template HTML
   - Cloaker creates/updates Shopify pages
   - Returns the generated link

2. **Client Data Request** (Validation Page → Cloaker → Main App)
   - Validation page requests data from cloaker
   - Cloaker forwards request to main app with geo headers
   - Returns campaign data with geo information

3. **Logging** (Validation Page → Main App)
   - Validation pages send logs directly to main app
   - Endpoint: `https://cranads.com/api/logs/public`

### Integration Points

1. **Main App Changes**:
   - Removed all cloaking functions from `Campaigns.js`
   - `generateCampaignLink` now calls cloaker API
   - `getCampaignDataForClient` remains for cloaker to call

2. **Cloaker Endpoints**:
   - `POST /generate-pages` - Creates/updates Shopify pages
   - `GET /api/campaigns/client/:id/:launch` - Serves campaign data
   - `POST /log` - Forwards logs (currently unused, logs go direct)

## Configuration

The cloaker uses these environment variables (set in wrangler.toml):
- `MAIN_APP_URL` - Your main application URL
- `LOG_ENDPOINT` - Where to send logs
- `CAMPAIGN_WORKER_URL` - The cloaker's own URL (for client scripts)

## Testing

1. Deploy the cloaker worker
2. Update your main app with the cloaker URL
3. Create a campaign and generate a link
4. Test the validation page with `?test=true` parameter
5. Check logs in main app

## Rollback

If needed, the old cloaking code is preserved in git history. The main changes were:
- Lines 1146-1627 removed from `Campaigns.js` (cloaking functions)
- `generateCampaignLink` updated to call cloaker API (lines 1335-1420)

## Security Notes

- The cloaker has no authentication - it trusts the main app
- Store credentials are passed per-request (not stored)
- Template HTML is passed per-request
- Client endpoint is public (as before)
- Logs still go directly to main app