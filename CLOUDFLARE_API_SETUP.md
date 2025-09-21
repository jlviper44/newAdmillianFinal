# Cloudflare API Setup for Error Logs

## Getting Your Cloudflare API Credentials

To enable automatic syncing of Cloudflare errors to your Error Logs dashboard, you need to configure the following credentials in `wrangler.jsonc`:

### 1. Cloudflare API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Custom token" template
4. Configure permissions:
   - **Account Permissions**:
     - Account Analytics: Read
     - Workers Scripts: Read
     - Workers Tail: Read
   - **Zone Permissions**:
     - Zone: Read
     - Analytics: Read
     - Logs: Read
5. Set Account Resources: Include → Your account
6. Set Zone Resources: Include → Specific zone → Select your zone
7. Click "Continue to summary" and "Create Token"
8. Copy the token and replace `YOUR_CLOUDFLARE_API_TOKEN_HERE` in wrangler.jsonc

### 2. Zone ID

1. Go to your Cloudflare dashboard
2. Select your domain
3. On the right sidebar, find "Zone ID"
4. Copy it and replace `YOUR_ZONE_ID_HERE` in wrangler.jsonc

### 3. Account ID (Already Set)

The Account ID is already configured in your wrangler.jsonc file.

## Configuration in wrangler.jsonc

```json
"vars": {
  // ... other variables ...

  // Cloudflare API credentials for error log syncing
  "CLOUDFLARE_API_TOKEN": "your-api-token-here",
  "CLOUDFLARE_ACCOUNT_ID": "8868b34a10c0236d2dea39a05ff01a01",
  "CLOUDFLARE_ZONE_ID": "your-zone-id-here"
}
```

## Testing the Configuration

After setting up the credentials:

1. Deploy your changes: `npm run deploy`
2. Go to Settings → Error Logs in your admin dashboard
3. Click the "Sync Cloudflare" button
4. Check if errors are being fetched successfully

## Security Notes

- Never commit your actual API token to version control
- Use environment-specific configurations for development/production
- The API token should have minimal required permissions (read-only analytics and logs)