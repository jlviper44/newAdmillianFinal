# Cloaking System Simplification Checklist

## Overview
This checklist outlines the steps to simplify the cloaking system by removing automatic device detection, validation logic, and logging from Shopify pages. The new system will simply redirect all visitors when manually enabled. The logs API endpoint will be preserved for other system logging needs.

## Current System Issues to Address
- [ ] Complex validation logic (device detection, ttclid, referrer checks)
- [ ] Automatic logging of all visitor data
- [ ] Multiple decision points for redirect logic
- [ ] Unnecessary tracking and analytics

## Simplification Tasks

### 1. Remove Validation Logic from campaignWorker.js
- [ ] Remove mobile device detection (`isMobile` check at line 1280)
- [ ] Remove TikTok click ID validation (`hasTtclid` check at line 1281)
- [ ] Remove referrer validation (`isTikTokReferrer` check at lines 1284-1293)
- [ ] Remove validation conditional block (lines 1314-1354)
- [ ] Remove all console.log statements related to validation

### 2. Remove Logging Functionality from Shopify Pages Only
- [ ] Keep the `/api/logs` endpoint handler intact for other uses
- [ ] Remove all fetch calls to `/api/logs` from Shopify page script (lines 1467-1481)
- [ ] Remove the beacon logging from Shopify page script (lines 1459-1465)
- [ ] Remove success/failure log data construction from page script (lines 1320-1339, 1430-1446)
- [ ] Remove the `trackRedirect` function if unused (lines 1157-1164)
- [ ] Keep server-side logging infrastructure in `server/Dashboard/Logs/Logs.js` for other logging needs

### 3. Simplify Redirect Flow
- [ ] Remove the loading screen display logic
- [ ] Make the page immediately redirect when accessed
- [ ] Keep only the redirect URL construction logic:
  - Custom redirect: Use `customRedirectLink` directly
  - Template redirect: Use `offer-{campaignId}-{launchNumber}` page
- [ ] Preserve URL parameter passing (ttclid, s1, s2, etc.)

### 4. Update Page Generation
- [ ] Simplify `generatePageContent` function (line 1207)
- [ ] Remove validation JavaScript from the page template
- [ ] Create a simple auto-redirect HTML template:
  ```html
  <script>
    // Extract campaign info and redirect immediately
    window.location.href = redirectUrl;
  </script>
  ```

### 5. Add Manual Enable/Disable Control
- [ ] Add `isEnabled` field to campaign schema
- [ ] Add toggle switch in campaign dashboard UI
- [ ] Update campaign create/edit forms to include enable/disable option
- [ ] Make the redirect page check if campaign is enabled before redirecting
- [ ] If disabled, show a simple "Page not available" message

### 6. Database/API Updates
- [ ] Update campaign model to include `isEnabled` boolean field
- [ ] Update Campaigns.js API to handle enable/disable status
- [ ] Keep logs-related API endpoints for other logging purposes
- [ ] Update campaign worker to check enabled status

### 7. Frontend Updates (Dashboard)
- [ ] Add enable/disable toggle to campaign list view
- [ ] Add enable/disable control to campaign edit modal
- [ ] Remove logs/analytics views if they exist
- [ ] Update campaign status indicators

### 8. Clean Up Unused Code
- [ ] Remove `advancedSettings` (blockedUserAgents, bot trap, OS versions)
- [ ] Remove GEO/IP detection code if not needed for redirect parameters
- [ ] Remove test mode logic
- [ ] Remove all validation-related functions

## Testing Checklist
- [ ] Test that redirects work immediately without validation
- [ ] Test manual enable/disable functionality
- [ ] Test that disabled campaigns show "not available" message
- [ ] Test custom redirect links work correctly
- [ ] Test template redirects work correctly
- [ ] Verify URL parameters are passed through correctly
- [ ] Verify no logs are being created from Shopify page visits
- [ ] Verify logs API endpoint still works for other purposes

## Rollback Plan
- [ ] Keep backup of current campaignWorker.js
- [ ] Keep backup of current Campaigns.js
- [ ] Document current validation rules for reference
- [ ] Test in staging environment first

## Benefits After Simplification
- ✅ No device/browser discrimination
- ✅ Faster redirects (no validation delay)
- ✅ Simpler codebase to maintain
- ✅ Manual control over campaign availability
- ✅ No unnecessary data logging from Shopify pages
- ✅ Reduced server load (no logging from page visits)
- ✅ Logs API preserved for other system logging needs

## Notes
- The simplified system will redirect ALL visitors when enabled
- No automatic blocking based on device type or referrer
- Campaign owners have full manual control via enable/disable toggle
- Consider keeping basic URL parameter passing for tracking purposes