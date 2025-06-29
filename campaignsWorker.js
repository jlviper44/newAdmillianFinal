addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Get Cloudflare's GEO data from the request
  const cfData = request.cf || {};
  
  // Allow API endpoints that are used by the validation pages
  const publicApiPaths = [
    '/api/campaigns/client/',
    '/api/test-geo'
  ];
  
  const isPublicApi = publicApiPaths.some(publicPath => path.startsWith(publicPath));
  
  // Check if this is the login endpoint
  if (path === '/login' && request.method === 'POST') {
    return handleLogin(request);
  }
  
  // For all other requests (except public APIs), check if user is logged in
  if (!isPublicApi && path !== '/login') {
    const isValid = await isSessionValid(request);
    
    if (!isValid) {
      // Return login page
      return new Response(LOGIN_HTML, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache'
        }
      });
    }
  }
  
  // Log GEO data for debugging (remove in production)
  console.log('Cloudflare GEO Data:', {
    country: cfData.country,
    region: cfData.region,
    city: cfData.city,
    continent: cfData.continent,
    timezone: cfData.timezone,
    colo: cfData.colo
  });
  
  // Handle API requests with CF data
  if (path.startsWith('/api/')) {
    return await handleApiRequest(request, path, cfData);
  }
  
  // Default: serve main HTML for campaign management UI
  return new Response(CAMPAIGNS_HTML, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache'
    }
  });
}


async function handleApiRequest(request, path, cfData) {
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };

  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    let response = null;
    
    // Route API endpoints
    switch (true) {
      // Campaign list and create
      case path === '/api/campaigns' && request.method === 'GET':
        response = await listCampaigns(request);
        break;
        
      case path === '/api/campaigns' && request.method === 'POST':
        response = await createCampaign(request);
        break;
        
      // Generate link endpoint
      case path === '/api/campaigns/generate-link' && request.method === 'POST':
        response = await generateCampaignLink(request);
        break;
        
      // ADD THIS NEW CASE: GEO test endpoint
      case path === '/api/test-geo' && request.method === 'GET':
        response = new Response(JSON.stringify({
          success: true,
          geo: {
            country: cfData.country || 'Unknown',
            region: cfData.region || 'Unknown',
            city: cfData.city || 'Unknown',
            continent: cfData.continent || 'Unknown',
            timezone: cfData.timezone || 'Unknown',
            latitude: cfData.latitude,
            longitude: cfData.longitude,
            postalCode: cfData.postalCode,
            asn: cfData.asn,
            colo: cfData.colo
          },
          headers: {
            'cf-ipcountry': request.headers.get('cf-ipcountry'),
            'cf-connecting-ip': request.headers.get('cf-connecting-ip'),
            'x-forwarded-for': request.headers.get('x-forwarded-for')
          }
        }), {
          status: 200,
          headers: corsHeaders
        });
        break;
        
      // LOGOUT ENDPOINT
      case path === '/api/logout' && request.method === 'POST':
        const cookie = request.headers.get('Cookie');
        if (cookie) {
          const sessionMatch = cookie.match(/session=([^;]+)/);
          if (sessionMatch) {
            await CAMPAIGNS.delete(`session_${sessionMatch[1]}`);
          }
        }
        response = new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
          }
        });
        break;
        
      // FIND THIS CASE in handleApiRequest and UPDATE it:
      case path.match(/^\/api\/campaigns\/client\/([^\/]+)\/([^\/]+)$/) !== null:
        const clientMatch = path.match(/^\/api\/campaigns\/client\/([^\/]+)\/([^\/]+)$/);
        // Pass cfData AND request as parameters
        response = await getCampaignDataForClient(clientMatch[1], clientMatch[2], cfData, request);
        break;
        
      // Store, template, and spark lists
      case path === '/api/stores/list' && request.method === 'GET':
        response = await listStoresForDropdown();
        break;
        
      case path === '/api/templates/list' && request.method === 'GET':
        response = await listTemplatesForDropdown();
        break;
        
      case path === '/api/sparks/list' && request.method === 'GET':
        response = await listSparksForDropdown();
        break;
        
      // Campaign-specific endpoints
      default:
        const campaignMatch = path.match(/^\/api\/campaigns\/([^\/]+)(.*)$/);
        if (campaignMatch) {
          const campaignId = campaignMatch[1];
          const subPath = campaignMatch[2] || '';
                    
          switch (true) {
            case (subPath === '' || subPath === '/') && request.method === 'GET':
              response = await getCampaign(campaignId);
              break;
              
            case (subPath === '' || subPath === '/') && request.method === 'PUT':
              response = await updateCampaign(campaignId, request);
              break;
              
            case (subPath === '' || subPath === '/') && request.method === 'DELETE':
              response = await deleteCampaign(campaignId);
              break;
              
            case subPath === '/toggle-active' && request.method === 'PUT':
              response = await toggleCampaignActive(campaignId);
              break;
              
            case subPath === '/manage-launches' && request.method === 'PUT':
              response = await manageCampaignLaunches(campaignId, request);
              break;
              
            case subPath === '/status' && request.method === 'PUT':
              response = await toggleCampaignStatus(campaignId, request);
              break;
          }
        }
        break;
    }
    
    // If no response was set, return 404
    if (!response) {
      response = new Response(
        JSON.stringify({ 
          error: 'Endpoint not found',
          path: path,
          method: request.method
        }),
        {
          status: 404,
          headers: corsHeaders
        }
      );
    }
    
    // Ensure CORS headers are added to all responses
    const responseHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('API Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        path: path,
        method: request.method
      }),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}


// ========================================
// ADD THESE CONSTANTS AT THE TOP OF YOUR FILE
// ========================================
const LOGIN_PASSWORD = 'gV9F5YjQR#r^1X2^F6Hd'; // CHANGE THIS!
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// ========================================
// ADD THESE NEW FUNCTIONS
// ========================================
function generateSessionToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function isSessionValid(request) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return false;
  
  const sessionMatch = cookie.match(/session=([^;]+)/);
  if (!sessionMatch) return false;
  
  const sessionToken = sessionMatch[1];
  const storedSession = await CAMPAIGNS.get(`session_${sessionToken}`, 'json');
  
  if (!storedSession) return false;
  
  // Check if session is expired
  if (Date.now() - storedSession.createdAt > SESSION_DURATION) {
    await CAMPAIGNS.delete(`session_${sessionToken}`);
    return false;
  }
  
  return true;
}

async function handleLogin(request) {
  try {
    const { password } = await request.json();
    
    if (password === LOGIN_PASSWORD) {
      // Generate session token
      const sessionToken = generateSessionToken();
      
      // Store session in KV
      await CAMPAIGNS.put(`session_${sessionToken}`, JSON.stringify({
        createdAt: Date.now(),
        ip: request.headers.get('CF-Connecting-IP') || 'unknown'
      }), {
        expirationTtl: 86400 // 24 hours
      });
      
      // Return success with session cookie
      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
        }
      });
    } else {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid password' 
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid request' 
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// ========================================
// ADD THIS LOGIN HTML CONSTANT
// ========================================
const LOGIN_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - TikTok Ad Cloaker</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center">
  <div class="max-w-md w-full">
    <div class="bg-white rounded-lg shadow-lg p-8">
      <div class="text-center mb-8">
        <i class="fas fa-shield-alt text-6xl text-blue-500 mb-4"></i>
        <h1 class="text-2xl font-bold text-gray-800">Ad Cloaker Admin</h1>
        <p class="text-gray-600 mt-2">Please enter your password to continue</p>
      </div>
      
      <form id="login-form" method="POST" action="/login">
        <div class="mb-6">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="password">
            Password
          </label>
          <div class="relative">
            <input 
              class="shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
              id="password" 
              name="password"
              type="password" 
              placeholder="Enter password"
              required
              autofocus
            >
            <button type="button" id="toggle-password" class="absolute right-3 top-3 text-gray-500 hover:text-gray-700">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </div>
        
        <div id="error-message" class="mb-4 text-red-500 text-sm hidden"></div>
        
        <button 
          type="submit" 
          id="login-button"
          class="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline transition duration-200"
        >
          <span id="button-text">Login</span>
          <i id="button-spinner" class="fas fa-spinner fa-spin hidden"></i>
        </button>
      </form>
      
      <div class="mt-6 text-center text-sm text-gray-600">
        <i class="fas fa-lock mr-1"></i> Secure connection
      </div>
    </div>
  </div>
  
  <script>
    // Toggle password visibility
    document.getElementById('toggle-password').addEventListener('click', function() {
      const passwordInput = document.getElementById('password');
      const icon = this.querySelector('i');
      
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    });
    
    // Handle form submission
    document.getElementById('login-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const password = document.getElementById('password').value;
      const errorMessage = document.getElementById('error-message');
      const button = document.getElementById('login-button');
      const buttonText = document.getElementById('button-text');
      const buttonSpinner = document.getElementById('button-spinner');
      
      // Reset error message
      errorMessage.classList.add('hidden');
      
      // Show loading state
      button.disabled = true;
      buttonText.textContent = 'Logging in...';
      buttonSpinner.classList.remove('hidden');
      
      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          // Redirect to main page
          window.location.href = '/';
        } else {
          // Show error message
          errorMessage.textContent = data.error || 'Invalid password';
          errorMessage.classList.remove('hidden');
          
          // Shake the form
          document.querySelector('.bg-white').classList.add('animate-pulse');
          setTimeout(() => {
            document.querySelector('.bg-white').classList.remove('animate-pulse');
          }, 500);
        }
      } catch (error) {
        errorMessage.textContent = 'An error occurred. Please try again.';
        errorMessage.classList.remove('hidden');
      } finally {
        // Reset button state
        button.disabled = false;
        buttonText.textContent = 'Login';
        buttonSpinner.classList.add('hidden');
      }
    });
    
    // Focus on password field
    document.getElementById('password').focus();
  </script>
</body>
</html>
`;

async function getCampaignDataForClient(campaignId, launchNumber, cfData, request) {
  try {
    // Fetch campaign from KV store
    const campaign = await CAMPAIGNS.get(campaignId, 'json');
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get the actual client IP address from Cloudflare headers
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                    request.headers.get('X-Forwarded-For') || 
                    request.headers.get('X-Real-IP') ||
                    'unknown';
    
    // Get redirect store domain if using Shopify redirect
    let redirectStoreDomain = null;
    if (campaign.redirectStoreId) {
      const redirectStore = await SHOPIFY_STORES.get(campaign.redirectStoreId, 'json');
      if (redirectStore && redirectStore.domain) {
        redirectStoreDomain = redirectStore.domain.replace(/^https?:\/\//, '');
        if (!redirectStoreDomain.includes('.myshopify.com') && !redirectStoreDomain.includes('.')) {
          redirectStoreDomain = `${redirectStoreDomain}.myshopify.com`;
        }
      }
    }
    
    // Build comprehensive GEO data from Cloudflare
    const geoData = {
      country: cfData.country || 'US',
      region: cfData.region || null,
      city: cfData.city || null,
      continent: cfData.continent || null,
      latitude: cfData.latitude || null,
      longitude: cfData.longitude || null,
      postalCode: cfData.postalCode || null,
      timezone: cfData.timezone || null,
      asn: cfData.asn || null,
      colo: cfData.colo || null,
      ip: clientIP // Include IP in geo data
    };
    
    // Log this access for monitoring (but DON'T log the click here - let client handle it)
    console.log(`Campaign ${campaignId} accessed:`, {
      campaignId: campaignId,
      launchNumber: launchNumber,
      country: geoData.country,
      region: geoData.region,
      city: geoData.city,
      ip: clientIP,
      userAgent: request.headers.get('User-Agent')?.substring(0, 50) + '...'
    });
    
    // REMOVE the server-side logClick call - let the client handle all logging
    // await logClick(campaignId, launchNumber, cfData, request, 'pending', null);
    
    // Build the response data for client-side validation
    const responseData = {
      // Campaign configuration
      redirectType: campaign.redirectType || 'shopify',
      customRedirectLink: campaign.customRedirectLink || null,
      affiliateLinks: campaign.affiliateLinks || {},
      regions: campaign.regions || [],
      
      // Advanced settings for validation
      advancedSettings: campaign.advancedSettings || {
        iosVersion: 16,
        androidVersion: 12,
        blockedUserAgents: [],
        enableBotTrap: false
      },
      
      // Store information
      redirectStoreId: campaign.redirectStoreId,
      redirectStoreDomain: redirectStoreDomain,
      templateId: campaign.templateId,
      
      // GEO and IP data from server
      geoData: geoData,
      clientIP: clientIP,
      
      // Additional metadata
      campaignName: campaign.name,
      isActive: campaign.isActive !== false,
      status: campaign.status || 'active'
    };
    
    // Return the campaign data with proper CORS headers
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error) {
    console.error('Error in getCampaignDataForClient:', error);
    
    // Return a proper error response
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch campaign data',
        message: error.message,
        campaignId: campaignId,
        launchNumber: launchNumber
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
}

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
  let apiDomain = store.domain.replace(/^https?:\/\//, '');
  if (!apiDomain.includes('.myshopify.com')) {
    apiDomain = `${apiDomain}.myshopify.com`;
  }
  
  // First check if page already exists
  const checkUrl = `https://${apiDomain}/admin/api/2024-01/pages.json?handle=${pageHandle}`;
  console.log('Checking for existing TikTok page:', checkUrl);
  
  const checkResponse = await fetch(checkUrl, {
    headers: {
      'X-Shopify-Access-Token': store.adminApiToken,
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
        'X-Shopify-Access-Token': store.adminApiToken,
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
        'X-Shopify-Access-Token': store.adminApiToken,
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

async function generateCampaignLink(request) {
  try {
    const requestData = await request.json();
    const { campaignId, launchNumber } = requestData;
        
    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const launch = launchNumber !== undefined ? launchNumber : 0;
    
    // Fetch fresh campaign data to ensure we have the latest updates
    const campaign = await CAMPAIGNS.get(campaignId, 'json');
    if (!campaign) {
      return new Response(
        JSON.stringify({ 
          error: 'Campaign not found',
          campaignId: campaignId
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get TikTok store details
    const tiktokStore = await SHOPIFY_STORES.get(campaign.tiktokStoreId, 'json');
    if (!tiktokStore) {
      return new Response(
        JSON.stringify({ error: 'TikTok store not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!tiktokStore.adminApiToken) {
      return new Response(
        JSON.stringify({ error: 'Store is missing admin API token. Please update the store configuration.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Ensure domain doesn't have protocol
    let tiktokStoreDomain = tiktokStore.domain.replace(/^https?:\/\//, '');
    if (!tiktokStoreDomain.includes('.myshopify.com') && !tiktokStoreDomain.includes('.')) {
      tiktokStoreDomain = `${tiktokStoreDomain}.myshopify.com`;
    }
    
    const pageHandle = `cloak-${campaignId}-${launch}`;
    const shopifyPageUrl = `https://${tiktokStoreDomain}/pages/${pageHandle}`;
    
    try {
      // Step 1: ALWAYS create/update the validation/redirect page on TikTok store
      // This ensures any campaign changes (like affiliate links) are reflected
      console.log('Creating/updating TikTok store validation page with latest campaign data...');
      const tiktokPageResult = await createTikTokValidationPage(tiktokStore, campaign, campaignId, launch, pageHandle);
      console.log('TikTok store page created/updated:', tiktokPageResult);
      
      // Step 2: If not using custom redirect, ALWAYS create/update the offer page on redirect store
      if (campaign.redirectType !== 'custom' && campaign.redirectStoreId) {
        try {
          console.log('Creating/updating redirect store offer page with latest campaign data...');
          const redirectPageResult = await createRedirectStoreOfferPage(campaign, campaignId, launch);
          console.log('Redirect store offer page created/updated:', redirectPageResult);
        } catch (offerError) {
          console.error('Warning: Could not create/update offer page on redirect store:', offerError);
          // Don't fail the whole operation if offer page creation fails
        }
      }
      
      // Update launch info
      if (!campaign.launches) {
        campaign.launches = {};
      }
      
      if (!campaign.launches[launch.toString()]) {
        campaign.launches[launch.toString()] = {
          isActive: true,
          createdAt: new Date().toISOString()
        };
      }
      
      // Always update the generatedAt timestamp to indicate the page was refreshed
      campaign.launches[launch.toString()].generatedAt = new Date().toISOString();
      campaign.launches[launch.toString()].shopifyPageId = tiktokPageResult.page.id;
      campaign.updatedAt = new Date().toISOString();
      
      // Save the updated campaign
      await CAMPAIGNS.put(campaignId, JSON.stringify(campaign));
      
      return new Response(JSON.stringify({
        success: true,
        campaignId: campaignId,
        launchNumber: launch,
        link: shopifyPageUrl,
        displayLink: shopifyPageUrl,
        message: campaign.redirectType === 'custom' ? 
          'TikTok validation page updated with latest campaign settings' : 
          'Pages updated on both TikTok and Redirect stores with latest campaign settings',
        pageId: tiktokPageResult.page.id,
        refreshed: true // Indicate that the pages were refreshed
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('Error creating/updating Shopify pages:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create/update Shopify pages',
          message: error.message,
          details: 'Please check that the stores have valid Admin API tokens.'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error) {
    console.error('Error generating campaign link:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate campaign link',
        message: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function createRedirectStoreOfferPage(campaign, campaignId, launchNumber) {
  try {
    // Validate inputs
    if (!campaign) {
      throw new Error('Campaign object is required');
    }
    
    if (!campaign.redirectStoreId) {
      throw new Error('No redirect store configured for campaign');
    }
    
    // Fetch redirect store details
    const redirectStore = await SHOPIFY_STORES.get(campaign.redirectStoreId, 'json');
    
    if (!redirectStore) {
      throw new Error(`Redirect store not found: ${campaign.redirectStoreId}`);
    }
    
    if (!redirectStore.adminApiToken) {
      throw new Error('Redirect store is missing Admin API token');
    }
    
    console.log(`Creating offer page on redirect store: ${redirectStore.name || redirectStore.domain}`);
    
    // Get the template HTML
    const templateHTML = await getTemplateHTML(campaign.templateId);
    
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
    let apiDomain = redirectStore.domain.replace(/^https?:\/\//, '');
    if (!apiDomain.includes('.myshopify.com')) {
      apiDomain = `${apiDomain}.myshopify.com`;
    }
    
    // Check if page already exists
    const checkUrl = `https://${apiDomain}/admin/api/2024-01/pages.json?handle=${offerPageHandle}`;
    console.log('Checking for existing redirect page:', checkUrl);
    
    const checkResponse = await fetch(checkUrl, {
      headers: {
        'X-Shopify-Access-Token': redirectStore.adminApiToken,
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
          'X-Shopify-Access-Token': redirectStore.adminApiToken,
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
          'X-Shopify-Access-Token': redirectStore.adminApiToken,
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

async function getTemplateHTML(templateId) {
  let templateHTML = '<h1>Special Offer</h1><p>Loading your exclusive deal...</p>';
  
  if (!templateId) {
    console.log('No template ID configured for campaign, using default');
    return templateHTML;
  }
  
  try {
    const template = await TEMPLATES.get(templateId, 'json');
    
    if (template && template.html) {
      console.log(`Template found: ${templateId}`);
      return template.html;
    } else {
      console.log(`Template not found or has no HTML: ${templateId}`);
    }
  } catch (error) {
    console.error(`Error fetching template ${templateId}:`, error);
  }
  
  return templateHTML;
}

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

// Simplified generateAffiliateLinksScript without s4 and s5
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
    return links[geo + '_' + os] || 
           links[geo] || 
           links['US'] ||
           Object.values(links)[0];
  }
  
  // Simplified: Only add s1, s2, and s3 parameters
  function buildFinalAffiliateUrl(baseUrl, params) {
    const url = new URL(baseUrl);
    
    // Add only the essential tracking parameters
    if (params.s1) url.searchParams.set('s1', params.s1); // Campaign ID
    if (params.s2) url.searchParams.set('s2', params.s2); // Launch Number
    if (params.s3) url.searchParams.set('s3', params.s3); // ttclid
    
    // Optionally add geo for affiliate's reference (not as s-parameter)
    url.searchParams.set('geo', geo);
    if (region) url.searchParams.set('region', region);

    return url.href;
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

// Simplified generatePageContent without passing IP for s4
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
  fetch('https://campaigns.maximillillianh.workers.dev/api/campaigns/client/' + campaignId + '/' + launchNumber)
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
        
        const logData = {
          campaignId: campaignId,
          launchNumber: launchNumber,
          type: 'validation',
          decision: 'whitehat',
          ip: serverData.clientIP || 'unknown',
          country: serverData.geoData?.country || 'Unknown',
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
        
        // Log the validation failure
        if (navigator.sendBeacon) {
          navigator.sendBeacon('https://logs.maximillillianh.workers.dev/api/logs', 
            new Blob([JSON.stringify(logData)], {type: 'application/json'}));
        }
        
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
        continent: geoData.continent,
        ip: serverData.clientIP
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
      
      // Add tracking parameters (no more IP passing)
      redirectUrl.searchParams.set('s1', campaignId);
      redirectUrl.searchParams.set('s2', launchNumber);
      
      // Pass ttclid
      if (ttclid) {
        redirectUrl.searchParams.set('ttclid', ttclid);
      }
      
      // For template redirects, pass additional data (but not IP)
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
      
      // Log successful redirect
      const successLogData = {
        campaignId: campaignId,
        launchNumber: launchNumber,
        type: 'click',
        decision: 'blackhat',
        ip: serverData.clientIP || 'unknown',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referer: document.referrer,
        url: window.location.href,
        redirectUrl: redirectUrl.href,
        os: os,
        country: country,
        region: geoData.region,
        city: geoData.city,
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
      if (navigator.sendBeacon) {
        const beaconSent = navigator.sendBeacon(
          'https://logs.maximillillianh.workers.dev/api/logs',
          new Blob([JSON.stringify(successLogData)], {type: 'application/json'})
        );
        console.log('Beacon sent:', beaconSent);
        setTimeout(performRedirect, 50);
      } else {
        fetch('https://logs.maximillillianh.workers.dev/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(successLogData),
          keepalive: true
        })
        .then(() => {
          console.log('Click logged successfully');
          performRedirect();
        })
        .catch(err => {
          console.error('Failed to log redirect:', err);
          performRedirect();
        });
      }
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
              const finalUrl = window.buildFinalAffiliateUrl(affiliateLink, { s1, s2, ttclid });
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

async function listCampaigns(request) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || 'all';
    
    const campaignsKV = await CAMPAIGNS.list();
    let campaigns = [];
    
    for (const key of campaignsKV.keys) {
      try {
        const campaign = await CAMPAIGNS.get(key.name, 'json');
        if (campaign && campaign.id) {
          campaigns.push(campaign);
        }
      } catch (error) {
        console.error(`Error fetching campaign ${key.name}:`, error);
      }
    }
    
    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      campaigns = campaigns.filter(campaign => 
        (campaign.name && campaign.name.toLowerCase().includes(searchLower)) ||
        (campaign.id && campaign.id.toLowerCase().includes(searchLower))
      );
    }
    
    if (status !== 'all') {
      campaigns = campaigns.filter(campaign => campaign.status === status);
    }
    
    // Sort by created date (newest first)
    campaigns.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    
    // Paginate
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCampaigns = campaigns.slice(startIndex, endIndex);
    
    return new Response(
      JSON.stringify({
        campaigns: paginatedCampaigns,
        total: campaigns.length,
        page,
        limit,
        totalPages: Math.ceil(campaigns.length / limit)
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error listing campaigns:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to list campaigns',
        message: error.message,
        campaigns: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function getCampaign(campaignId) {
  try {
    const campaign = await CAMPAIGNS.get(campaignId, 'json');
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new Response(
      JSON.stringify(campaign),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get campaign',
        message: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function createCampaign(request) {
  try {
    const campaignData = await request.json();
    
    // Validate required fields
    if (!campaignData.name || !campaignData.regions || campaignData.regions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields (name and at least one region)' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Validate redirect configuration
    if (campaignData.redirectType === 'custom') {
      if (!campaignData.customRedirectLink) {
        return new Response(
          JSON.stringify({ error: 'Custom redirect link is required for custom redirect type' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      try {
        const customUrl = new URL(campaignData.customRedirectLink);
        if (customUrl.protocol !== 'https:') {
          return new Response(
            JSON.stringify({ error: 'Custom redirect link must use HTTPS protocol' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'Invalid custom redirect link URL format' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    } else {
      // Template is required for non-custom redirects
      if (!campaignData.templateId) {
        return new Response(
          JSON.stringify({ error: 'Template is required for template-based campaigns' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
    
    // Generate ID if not provided
    if (!campaignData.id) {
      campaignData.id = generateId();
    }
    
    // Add metadata
    campaignData.createdAt = new Date().toISOString();
    campaignData.updatedAt = new Date().toISOString();
    campaignData.status = campaignData.status || 'active';
    campaignData.isActive = campaignData.isActive !== false;
    campaignData.traffic = 0;
    
    // Initialize launches
    if (!campaignData.launches) {
      campaignData.launches = {
        "0": { isActive: true, createdAt: new Date().toISOString(), generatedAt: null }
      };
      campaignData.maxLaunchNumber = 0;
      campaignData.totalLaunches = 1;
    }
    
    // Save campaign
    await CAMPAIGNS.put(campaignData.id, JSON.stringify(campaignData));
    
    return new Response(JSON.stringify(campaignData), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create campaign',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function updateCampaign(campaignId, request) {
  try {
    const existingCampaign = await CAMPAIGNS.get(campaignId, 'json');
    
    if (!existingCampaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const campaignData = await request.json();
    
    // Validate required fields
    if (!campaignData.name || !campaignData.regions || campaignData.regions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Merge with existing data
    const updatedCampaign = {
      ...existingCampaign,
      ...campaignData,
      id: campaignId,
      updatedAt: new Date().toISOString(),
      traffic: existingCampaign.traffic,
      createdAt: existingCampaign.createdAt
    };
    
    await CAMPAIGNS.put(campaignId, JSON.stringify(updatedCampaign));
    
    return new Response(
      JSON.stringify(updatedCampaign),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update campaign',
        message: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function deleteCampaign(campaignId) {
  try {
    const existingCampaign = await CAMPAIGNS.get(campaignId, 'json');
    
    if (!existingCampaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Delete campaign
    await CAMPAIGNS.delete(campaignId);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Campaign deleted successfully',
        campaignId: campaignId
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to delete campaign',
        message: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function toggleCampaignActive(campaignId) {
  try {
    const existingCampaign = await CAMPAIGNS.get(campaignId, 'json');
    
    if (!existingCampaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    existingCampaign.isActive = !existingCampaign.isActive;
    existingCampaign.status = existingCampaign.isActive ? 'active' : 'paused';
    existingCampaign.updatedAt = new Date().toISOString();
    
    await CAMPAIGNS.put(campaignId, JSON.stringify(existingCampaign));
    
    return new Response(
      JSON.stringify({
        success: true,
        campaignId,
        isActive: existingCampaign.isActive,
        status: existingCampaign.status
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to toggle campaign active state',
        message: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function toggleCampaignStatus(campaignId, request) {
  try {
    const existingCampaign = await CAMPAIGNS.get(campaignId, 'json');
    
    if (!existingCampaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const { status } = await request.json();
    
    if (!['active', 'paused', 'completed'].includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Invalid status' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    existingCampaign.status = status;
    existingCampaign.updatedAt = new Date().toISOString();
    
    if (status === 'paused' || status === 'completed') {
      existingCampaign.isActive = false;
    } else if (status === 'active') {
      existingCampaign.isActive = true;
    }
    
    await CAMPAIGNS.put(campaignId, JSON.stringify(existingCampaign));
    
    return new Response(
      JSON.stringify(existingCampaign),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update campaign status',
        message: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function manageCampaignLaunches(campaignId, request) {
  try {
    const requestData = await request.json();
    const { action, launchData } = requestData;
    
    console.log(`Managing launches for campaign ${campaignId}: ${action}`);
    
    const campaign = await CAMPAIGNS.get(campaignId, 'json');
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!campaign.launches) {
      campaign.launches = {
        0: { isActive: true, createdAt: new Date().toISOString(), generatedAt: null }
      };
      campaign.maxLaunchNumber = 0;
      campaign.totalLaunches = 1;
    }
    
    let result = {};
    
    switch (action) {
      case 'add':
        const newLaunchNumber = (campaign.maxLaunchNumber || 0) + 1;
        campaign.launches[newLaunchNumber] = {
          isActive: true,
          createdAt: new Date().toISOString(),
          generatedAt: null
        };
        campaign.maxLaunchNumber = newLaunchNumber;
        campaign.totalLaunches = Object.keys(campaign.launches).length;
        
        result = {
          action: 'added',
          launchNumber: newLaunchNumber,
          totalLaunches: campaign.totalLaunches
        };
        break;
        
      case 'toggle':
        const launchNum = parseInt(launchData.launchNumber);
        if (campaign.launches[launchNum]) {
          campaign.launches[launchNum].isActive = !campaign.launches[launchNum].isActive;
          result = {
            action: 'toggled',
            launchNumber: launchNum,
            isActive: campaign.launches[launchNum].isActive
          };
        } else {
          throw new Error(`Launch ${launchNum} not found`);
        }
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    campaign.updatedAt = new Date().toISOString();
    await CAMPAIGNS.put(campaignId, JSON.stringify(campaign));
    
    return new Response(JSON.stringify({
      success: true,
      campaignId: campaignId,
      result: result,
      launches: campaign.launches
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error managing campaign launches:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to manage campaign launches',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function listStoresForDropdown() {
  try {
    const storesKV = await SHOPIFY_STORES.list();
    let stores = [];
    
    for (const key of storesKV.keys) {
      if (key.name.startsWith('subdomain_')) continue;
      
      try {
        const store = await SHOPIFY_STORES.get(key.name, 'json');
        if (store && store.id) {
          stores.push({
            id: store.id,
            name: store.name,
            domain: store.domain
          });
        }
      } catch (error) {
        console.error(`Error fetching store ${key.name}:`, error);
      }
    }
    
    stores.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return new Response(
      JSON.stringify({ 
        success: true,
        stores,
        count: stores.length
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to list stores',
        message: error.message,
        success: false,
        stores: []
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function listTemplatesForDropdown() {
  try {
    const templatesKV = await TEMPLATES.list();
    let templates = [];
    
    for (const key of templatesKV.keys) {
      try {
        const template = await TEMPLATES.get(key.name, 'json');
        if (template) {
          templates.push({
            id: template.id,
            name: template.name,
            category: template.category || ''
          });
        }
      } catch (error) {
        console.error(`Error fetching template ${key.name}:`, error);
      }
    }
    
    templates.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return new Response(
      JSON.stringify({ 
        templates,
        count: templates.length,
        success: true
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to list templates',
        message: error.message,
        templates: []
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function listSparksForDropdown() {
  try {
    if (typeof SPARKS === 'undefined') {
      return new Response(
        JSON.stringify({ 
          sparks: [{ id: 'default', name: 'Default Spark' }],
          count: 1,
          success: true
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const sparksKV = await SPARKS.list();
    let sparks = [];
    
    for (const key of sparksKV.keys) {
      try {
        const spark = await SPARKS.get(key.name, 'json');
        if (spark && spark.id && spark.name) {
          sparks.push({
            id: spark.id,
            name: spark.name
          });
        }
      } catch (error) {
        console.error(`Error fetching spark ${key.name}:`, error);
      }
    }
    
    if (sparks.length === 0) {
      sparks.push({ id: 'default', name: 'Default Spark' });
    }
    
    sparks.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    return new Response(
      JSON.stringify({ 
        sparks,
        count: sparks.length,
        success: true
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        sparks: [{ id: 'default', name: 'Default Spark' }],
        count: 1,
        success: true
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

function generateId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ========================================
// REPLACE YOUR ENTIRE CAMPAIGNS_HTML CONSTANT WITH THIS
// ========================================
const CAMPAIGNS_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TikTok Ad Cloaker - Campaigns</title>
  <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    /* Style for required fields */
    .required-field {
      border-left: 3px solid #f56565 !important;
    }
    
    /* Add a red asterisk after required field labels */
    label[for="campaign-name"]::after,
    label[for="tiktok-store"]::after,
    label[for="redirect-store"]::after,
    label[for="campaign-spark"]::after,
    label[for="campaign-template"]::after {
      content: " *";
      color: #f56565;
    }
    
    /* Expandable row styles */
    .launch-sub-row {
      background-color: #f9fafb !important;
      border-left: 4px solid #3b82f6;
    }
    
    .campaign-row {
      cursor: pointer;
    }
    
    .campaign-row:hover {
      background-color: #f3f4f6;
    }
    
    /* Launch management styles */
    .launch-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .launch-active {
      background-color: #dcfce7;
      color: #166534;
    }
    
    .launch-disabled {
      background-color: #f3f4f6;
      color: #6b7280;
    }

  </style>
</head>
<body class="bg-gray-100 min-h-screen">
  <div class="flex h-screen bg-gray-100">
    <!-- Sidebar -->
    <div class="bg-gray-800 text-white w-64 flex-shrink-0">
      <div class="p-4 text-xl font-bold">Ad Cloaker Admin</div>
      <nav class="mt-8">
        <a href="https://dashboard.admillian.com" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-chart-line mr-2"></i> Dashboard
        </a>
        <a href="https://campaigns.maximillillianh.workers.devm" class="block py-2.5 px-4 rounded transition duration-200 bg-gray-700 hover:bg-gray-700">
          <i class="fas fa-bullhorn mr-2"></i> Campaigns
        </a>
        <a href="https://sparks.admillian.com" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-fire mr-2"></i> Sparks
        </a>
        <a href="https://comments.admillian.com" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-comments mr-2"></i> Comment Bot
        </a>
        <a href="https://bcgen.admillian.com" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-users mr-2"></i> BC Generator
        </a>
        <a href="https://shopifystores.admillian.com" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-store mr-2"></i> Shopify Stores
        </a>
        <a href="https://templates.admillian.com" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-file-code mr-2"></i> Templates
        </a>
        <a href="https://logs.maximillillianh.workers.dev" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-list mr-2"></i> Logs
        </a>
        <a href="https://settings.admillian.com" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-cog mr-2"></i> Settings
        </a>
        <a href="#" id="logout-link" class="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-700">
          <i class="fas fa-sign-out-alt mr-2"></i> Logout
        </a>
      </nav>
    </div>
    
    <!-- Main Content -->
    <div class="flex-1 overflow-x-hidden overflow-y-auto">
      <div class="p-6">
        <div class="flex justify-between items-center mb-6">
          <h1 class="text-2xl font-bold">Campaigns</h1>
          <button id="create-campaign-btn" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            <i class="fas fa-plus mr-2"></i> Create Campaign
          </button>
        </div>
        
        <!-- Campaign Search/Filter -->
        <div class="bg-white rounded-lg shadow p-4 mb-6">
          <div class="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
            <div class="flex-1">
              <input type="text" id="campaign-search" placeholder="Search campaigns..." class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="flex items-center space-x-2">
              <select id="campaign-status-filter" class="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
              <button id="campaign-search-btn" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                <i class="fas fa-search"></i>
              </button>
            </div>
          </div>
        </div>
        
        <!-- Bulk Actions Container -->
        <div id="bulk-actions-container" class="bg-white rounded-lg shadow p-4 mb-6 hidden">
          <div class="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
            <div class="flex-1">
              <span class="font-semibold"><span id="selected-count">0</span> campaigns selected</span>
            </div>
            <div class="flex items-center space-x-2">
              <select id="bulk-action-select" class="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Choose action...</option>
                <option value="status-active">Set Status: Active</option>
                <option value="status-paused">Set Status: Paused</option>
                <option value="status-completed">Set Status: Completed</option>
                <option value="toggle-active">Toggle Active State</option>
                <option value="delete">Delete Selected</option>
              </select>
              <button id="apply-bulk-action" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Apply
              </button>
              <button id="cancel-bulk-selection" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>

        <!-- Campaigns Table -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="min-w-full bg-white">
            <thead>
              <tr class="bg-gray-100">
                <th class="py-3 px-4 text-left w-12">
                  <input type="checkbox" id="select-all-campaigns" class="form-checkbox rounded">
                </th>
                <th class="py-3 px-6 text-left">Campaign Name & Launches</th>
                <th class="py-3 px-6 text-left">TikTok Store</th>
                <th class="py-3 px-6 text-left">Redirect Store</th>
                <th class="py-3 px-6 text-left">Regions</th>
                <th class="py-3 px-6 text-left">Traffic</th>
                <th class="py-3 px-6 text-left">Status</th>
                <th class="py-3 px-6 text-left">Active</th>
                <th class="py-3 px-6 text-left">Actions</th>
              </tr>
            </thead>
            <tbody id="campaigns-list">
              <tr class="text-center">
                <td colspan="9" class="py-4">Loading campaigns...</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination -->
        <div class="flex justify-between items-center mt-6">
          <div class="text-gray-600">
            Showing <span id="campaigns-showing">0</span> of <span id="campaigns-total">0</span> campaigns
          </div>
          <div class="flex space-x-2">
            <button id="prev-page" class="px-4 py-2 border rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Previous</button>
            <button id="next-page" class="px-4 py-2 border rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Campaign Modal -->
  <div id="campaign-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50">
    <div class="bg-white rounded-lg shadow max-w-4xl w-full max-h-screen overflow-y-auto">
      <div class="flex justify-between items-center border-b p-4">
        <h2 class="text-xl font-bold" id="campaign-modal-title">Create Campaign</h2>
        <button id="close-campaign-modal" class="text-gray-500 hover:text-gray-700">
          <i class="fas fa-times"></i>
        </button>
      </div>
      
      <div class="p-6">
        <form id="campaign-form">
          <input type="hidden" id="campaign-id">
          
          <!-- Basic Info -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold mb-4 border-b pb-2">Basic Information</h3>
            
            <div class="grid grid-cols-1 gap-4">
              <div>
                <label class="block text-gray-700 text-sm font-bold mb-2" for="campaign-name">
                  Campaign Name
                </label>
                <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="campaign-name" type="text" placeholder="Campaign Name" required>
              </div>
              <div>
                <label class="block text-gray-700 text-sm font-bold mb-2" for="campaign-spark">
                  Spark
                </label>
                <select class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="campaign-spark" required>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Store Selection -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold mb-4 border-b pb-2">Store Selection</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-gray-700 text-sm font-bold mb-2" for="tiktok-store">
                  TikTok Shopify Store
                </label>
                <select class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="tiktok-store" required>
                </select>
              </div>
              
              <div>
                <label class="block text-gray-700 text-sm font-bold mb-2" for="redirect-store">
                  Redirect Shopify Store
                </label>
                <select class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="redirect-store" required>
                </select>
              </div>
            </div>
          </div>
          
          <!-- Region Selection -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold mb-4 border-b pb-2">Target Regions & Affiliate Links</h3>
            
            <div class="grid grid-cols-1 gap-4 mb-4">
              <div class="flex flex-wrap gap-4">
                <div class="flex items-center">
                  <input type="checkbox" id="region-us" name="regions" value="US" class="region-checkbox mr-2">
                  <label for="region-us">United States (US)</label>
                </div>
                <div class="flex items-center">
                  <input type="checkbox" id="region-ca" name="regions" value="CA" class="region-checkbox mr-2">
                  <label for="region-ca">Canada (CA)</label>
                </div>
                <div class="flex items-center">
                  <input type="checkbox" id="region-gb" name="regions" value="GB" class="region-checkbox mr-2">
                  <label for="region-gb">United Kingdom (GB)</label>
                </div>
                <div class="flex items-center">
                  <input type="checkbox" id="region-au" name="regions" value="AU" class="region-checkbox mr-2">
                  <label for="region-au">Australia (AU)</label>
                </div>
              </div>
            </div>
            
            <!-- Affiliate Links -->
            <div id="affiliate-links-container" class="grid grid-cols-1 gap-4">
              <div id="affiliate-link-us" class="hidden">
                <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-us-input">
                  US Standard Affiliate Link
                </label>
                <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-us-input" type="url" placeholder="https://example.com/affiliate?id=1234">
                
                <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-us-ios-input">
                      US iOS Affiliate Link (Optional)
                    </label>
                    <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-us-ios-input" type="url" placeholder="https://example.com/affiliate?id=1234&s1=iOS">
                  </div>
                  <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-us-android-input">
                      US Android Affiliate Link (Optional)
                    </label>
                    <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-us-android-input" type="url" placeholder="https://example.com/affiliate?id=1234&s1=Android">
                  </div>
                </div>
              </div>
              
              <div id="affiliate-link-ca" class="hidden">
                <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-ca-input">
                  Canada Standard Affiliate Link
                </label>
                <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-ca-input" type="url" placeholder="https://example.com/affiliate?id=1234">
                
                <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-ca-ios-input">
                      Canada iOS Affiliate Link (Optional)
                    </label>
                    <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-ca-ios-input" type="url" placeholder="https://example.com/affiliate?id=1234&s1=iOS">
                  </div>
                  <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-ca-android-input">
                      Canada Android Affiliate Link (Optional)
                    </label>
                    <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-ca-android-input" type="url" placeholder="https://example.com/affiliate?id=1234&s1=Android">
                  </div>
                </div>
              </div>
              
              <div id="affiliate-link-gb" class="hidden">
                <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-gb-input">
                  UK Standard Affiliate Link
                </label>
                <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-gb-input" type="url" placeholder="https://example.com/affiliate?id=1234">
                
                <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-gb-ios-input">
                      UK iOS Affiliate Link (Optional)
                    </label>
                    <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-gb-ios-input" type="url" placeholder="https://example.com/affiliate?id=1234&s1=iOS">
                  </div>
                  <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-gb-android-input">
                      UK Android Affiliate Link (Optional)
                    </label>
                    <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-gb-android-input" type="url" placeholder="https://example.com/affiliate?id=1234&s1=Android">
                  </div>
                </div>
              </div>
              
              <div id="affiliate-link-au" class="hidden">
                <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-au-input">
                  Australia Standard Affiliate Link
                </label>
                <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-au-input" type="url" placeholder="https://example.com/affiliate?id=1234">
                
                <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-au-ios-input">
                      Australia iOS Affiliate Link (Optional)
                    </label>
                    <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-au-ios-input" type="url" placeholder="https://example.com/affiliate?id=1234&s1=iOS">
                  </div>
                  <div>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="affiliate-link-au-android-input">
                      Australia Android Affiliate Link (Optional)
                    </label>
                    <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="affiliate-link-au-android-input" type="url" placeholder="https://example.com/affiliate?id=1234&s1=Android">
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Custom Redirect Option -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold mb-4 border-b pb-2">Redirect Options</h3>
            
            <div class="grid grid-cols-1 gap-4">
              <div>
                <label class="block text-gray-700 text-sm font-bold mb-2">
                  Redirect Type
                </label>
                <select class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="redirect-type">
                  <option value="shopify">Shopify Page with Template</option>
                  <option value="custom">Custom Direct Link</option>
                </select>
              </div>
              
              <div id="custom-redirect-container" class="hidden">
                <label class="block text-gray-700 text-sm font-bold mb-2" for="custom-redirect-link">
                  Custom Redirect Link
                </label>
                <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="custom-redirect-link" type="url" placeholder="https://example.com/landing-page">
<p class="text-sm text-gray-500 mt-1">This link will be used instead of creating a Shopify page. All tracking parameters will be appended. Must use HTTPS.</p>
              </div>
            </div>
          </div>

          <!-- Template Selection -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold mb-4 border-b pb-2">Template Selection <span class="text-red-500">*</span></h3>
            
            <div class="grid grid-cols-1 gap-4">
              <div>
                <label class="block text-gray-700 text-sm font-bold mb-2" for="campaign-template">
                  Landing Page Template <span class="text-red-500"></span>
                </label>
                <select class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" id="campaign-template" required>
                  <option value="">Select Template (Required)</option>
                  <!-- Template options will be added dynamically -->
                </select>
                <p class="text-sm text-gray-500 mt-1">The landing page template is required for proper redirect handling.</p>
              </div>
            </div>
          </div>
          
          
          
          <!-- Form Actions -->
          <div class="flex justify-end space-x-4">
            <button type="button" id="cancel-campaign" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              Cancel
            </button>
            <button type="submit" id="save-campaign-btn" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
              Save Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  
  <!-- Launch Management Modal -->
  <div id="launch-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50 p-4">
    <div class="bg-white rounded-lg shadow w-full max-w-4xl h-full max-h-[80vh] flex flex-col">
      <!-- Fixed Header -->
      <div class="flex justify-between items-center border-b p-4 flex-shrink-0 bg-white rounded-t-lg">
        <h2 class="text-xl font-bold">Manage Launches</h2>
        <button id="close-launch-modal" class="text-gray-500 hover:text-gray-700 p-2">
          <i class="fas fa-times text-lg"></i>
        </button>
      </div>
      
      <!-- Fixed Campaign Info and Add Section -->
      <div class="p-6 border-b border-gray-200 flex-shrink-0 bg-white">
        <div id="launch-campaign-header">
          <!-- Campaign header will be inserted here -->
        </div>
        
        <div id="launch-add-section" class="mt-4">
          <!-- Add launches section will be inserted here -->
        </div>
      </div>
      
      <!-- Scrollable Launches List -->
      <div class="flex-1 min-h-0 flex flex-col bg-gray-50">
        <div class="p-4 border-b border-gray-200 flex-shrink-0 bg-white">
          <h4 class="text-lg font-semibold text-gray-900">Existing Launches</h4>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <div id="launch-existing-section">
            <div class="text-center py-8">
              <p class="text-gray-500 text-lg">Loading launches...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    // Global variables
    let currentPage = 1;
    let totalPages = 1;
    let campaignsData = [];
    let currentCampaignForLaunches = null;
    
    // Universal clipboard function with focus handling
    async function copyToClipboard(text) {
      if (!text) {
        throw new Error('No text provided to copy');
      }
      
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        try {
          // Focus the document to ensure clipboard access
          window.focus();
          document.body.focus();
          
          await navigator.clipboard.writeText(text);
          return;
        } catch (err) {
          console.warn('Modern clipboard failed, trying fallback:', err);
          // Fall through to fallback method
        }
      }
      
      // Fallback method for older browsers or when clipboard API fails
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        textArea.setAttribute('readonly', '');
        textArea.setAttribute('aria-hidden', 'true');
        
        document.body.appendChild(textArea);
        
        // Focus and select
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, textArea.value.length);
        
        // Execute copy command
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('execCommand copy failed');
        }
      } catch (fallbackErr) {
        console.error('Fallback clipboard method also failed:', fallbackErr);
        throw new Error('Unable to copy to clipboard. Please copy manually: ' + text.substring(0, 50) + '...');
      }
    }
    
    // Fetch campaigns from API
    async function fetchCampaigns(page = 1, filters = {}) {
      try {
        let url = '/api/campaigns?page=' + page;
        
        if (filters.search) {
          url += '&search=' + encodeURIComponent(filters.search);
        }
        
        if (filters.status && filters.status !== 'all') {
          url += '&status=' + encodeURIComponent(filters.status);
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        campaignsData = data.campaigns;
        totalPages = data.totalPages;
        currentPage = data.page;
        
        updateCampaignsTable();
        updatePagination(data.total);
      } catch (error) {
        console.error('Error fetching campaigns:', error);
        document.getElementById('campaigns-list').innerHTML = '<tr><td colspan="9" class="py-4 text-center text-red-500">Error loading campaigns</td></tr>';
      }
    }

    // Simplified fetch sparks function
    async function fetchSparks() {
      try {
        const response = await fetch('/api/sparks/list');
        const sparkSelect = document.getElementById('campaign-spark');
        sparkSelect.innerHTML = '<option value="">Select Spark</option>';
        
        if (!response.ok) {
          sparkSelect.innerHTML += '<option value="" disabled>Error loading sparks</option>';
          return;
        }
        
        const data = await response.json();
        
        if (!data.sparks || !Array.isArray(data.sparks) || data.sparks.length === 0) {
          sparkSelect.innerHTML += '<option value="" disabled>No sparks available</option>';
          return;
        }
        
        data.sparks.forEach(spark => {
          const option = document.createElement('option');
          option.value = spark.id;
          option.textContent = spark.name;
          sparkSelect.appendChild(option);
        });
      } catch (error) {
        const sparkSelect = document.getElementById('campaign-spark');
        if (sparkSelect) {
          sparkSelect.innerHTML = '<option value="">Select Spark</option>';
          sparkSelect.innerHTML += '<option value="" disabled>Error loading sparks</option>';
        }
      }
    }
    
    // Fetch stores function
    async function fetchStores() {
      try {
        console.log('Fetching stores...');
        
        const response = await fetch('/api/stores/list?t=' + Date.now());
        
        console.log('Fetch response status:', response.status);
        
        if (!response.ok) {
          throw new Error("Failed to fetch stores: " + response.status + " " + response.statusText);
        }
        
        const data = await response.json();
        console.log('Stores data received:', data);
        
        if (!data.success) {
          throw new Error(data.message || 'Unknown error fetching stores');
        }
        
        if (!data.stores || !Array.isArray(data.stores)) {
          throw new Error('Invalid stores data received');
        }
        
        updateStoreDropdowns(data.stores);
        
        if (data.stores.length === 0) {
          console.warn('No stores found. Please create stores first.');
          const tiktokStoreSelect = document.getElementById('tiktok-store');
          const redirectStoreSelect = document.getElementById('redirect-store');
          
          if (tiktokStoreSelect) {
            tiktokStoreSelect.innerHTML = '<option value="">No stores available. Please create stores first.</option>';
          }
          
          if (redirectStoreSelect) {
            redirectStoreSelect.innerHTML = '<option value="">No stores available. Please create stores first.</option>';
          }
        }
      } catch (error) {
        console.error('Error fetching stores:', error);
        
        const tiktokStoreSelect = document.getElementById('tiktok-store');
        const redirectStoreSelect = document.getElementById('redirect-store');
        
        const errorMessage = "Error: " + error.message + ". Please refresh or check store configuration.";
        
        if (tiktokStoreSelect) {
          tiktokStoreSelect.innerHTML = '<option value="">' + errorMessage + '</option>';
        }
        
        if (redirectStoreSelect) {
          redirectStoreSelect.innerHTML = '<option value="">' + errorMessage + '</option>';
        }
      }
    }
    
    // Update store dropdowns
    function updateStoreDropdowns(stores) {
      const tiktokStoreSelect = document.getElementById('tiktok-store');
      const redirectStoreSelect = document.getElementById('redirect-store');

      stores.forEach(store => {
        const tiktokOption = document.createElement('option');
        tiktokOption.value = store.id;
        tiktokOption.textContent = store.name;
        tiktokStoreSelect.appendChild(tiktokOption);
        
        const redirectOption = document.createElement('option');
        redirectOption.value = store.id;
        redirectOption.textContent = store.name;
        redirectStoreSelect.appendChild(redirectOption);
      });
      
      tiktokStoreSelect.addEventListener('change', () => {
        const selectedTiktokStoreId = tiktokStoreSelect.value;
        
        redirectStoreSelect.innerHTML = '<option value="">Select Redirect Store</option>';
        
        stores.forEach(store => {
          if (store.id === selectedTiktokStoreId) return;
          
          const redirectOption = document.createElement('option');
          redirectOption.value = store.id;
          redirectOption.textContent = store.name;
          redirectStoreSelect.appendChild(redirectOption);
        });
      });
    }
    
    // Fetch templates for dropdown
    async function fetchTemplates() {
      try {
        console.log('Fetching templates...');
        const templateSelect = document.getElementById('campaign-template');
        
        templateSelect.innerHTML = '<option value="">Loading templates...</option>';
        templateSelect.disabled = true;
        
        const response = await fetch('/api/templates/list?t=' + Date.now());
        
        if (!response.ok) {
          throw new Error('Failed to fetch templates: ' + response.status);
        }
        
        const data = await response.json();
        console.log('Templates response:', data);
        
        templateSelect.innerHTML = '<option value="">Select Template (Required)</option>';
        
        if (!data.templates || !Array.isArray(data.templates) || data.templates.length === 0) {
          templateSelect.innerHTML = '<option value="">No templates available</option>';
          templateSelect.disabled = true;
          console.warn('No templates found');
          return;
        }
        
        data.templates.forEach(function(template) {
          const option = document.createElement('option');
          option.value = template.id;
          option.textContent = template.name + (template.category ? ' (' + template.category + ')' : '');
          templateSelect.appendChild(option);
        });
        
        templateSelect.disabled = false;
        templateSelect.classList.add('required-field');
        
        console.log('Added ' + data.templates.length + ' templates to dropdown');
      } catch (error) {
        console.error('Error fetching templates:', error);
        
        const templateSelect = document.getElementById('campaign-template');
        templateSelect.innerHTML = '<option value="">Error loading templates</option>';
        templateSelect.disabled = true;
      }
    }
    
    // Update campaigns table - simplified without expandable launch rows
    function updateCampaignsTable() {
      const campaignsListEl = document.getElementById('campaigns-list');
      
      if (campaignsData.length === 0) {
        campaignsListEl.innerHTML = '<tr><td colspan="9" class="py-4 text-center">No campaigns found</td></tr>';
        return;
      }
      
      let html = '';
      
      campaignsData.forEach(campaign => {
        const regions = campaign.regions ? campaign.regions.join(', ') : '-';
        
        // Main campaign row only (no expansion)
        html += '<tr class="border-b hover:bg-gray-50" data-campaign-id="' + campaign.id + '">';
        
        // Checkbox column
        html += '<td class="py-3 px-4">' +
          '<input type="checkbox" class="form-checkbox rounded campaign-checkbox" data-id="' + campaign.id + '">' +
          '</td>';
        
          // Campaign name column with launch info (no expand button)
          html += '<td class="py-3 px-6">' + 
            '<div>' +
              '<div class="font-medium">' + (campaign.name || '-') + '</div>' + 
              '<div class="text-xs text-gray-500">' + campaign.id + '</div>' + 
              (campaign.sparkName ? '<div class="text-xs text-blue-500"><i class="fas fa-bolt mr-1"></i>' + campaign.sparkName + '</div>' : '') +
              (campaign.redirectType === 'custom' ? '<div class="text-xs text-orange-500"><i class="fas fa-external-link-alt mr-1"></i>Custom Redirect</div>' : '') +
              '<div class="text-xs text-purple-600 mt-1">';
        

            
        // Show launch summary
        if (campaign.launches && Object.keys(campaign.launches).length > 0) {
          const totalLaunches = Object.keys(campaign.launches).length;
          const activeLaunches = Object.values(campaign.launches).filter(l => l.isActive).length;
          html += '<i class="fas fa-rocket mr-1"></i>' + activeLaunches + '/' + totalLaunches + ' launches active';
        } else {
          html += '<i class="fas fa-rocket mr-1"></i>1 launch (default)';
        }
        
        html += '</div>' +
          '</div>' +
          '</td>';
        
        // TikTok Store column  
        html += '<td class="py-3 px-6">' + (campaign.tiktokStoreName || campaign.tiktokStoreId || '-') + '</td>';
        
        // Redirect Store column
        html += '<td class="py-3 px-6">' + (campaign.redirectStoreName || campaign.redirectStoreId || '-') + '</td>';
        
        // Regions column
        html += '<td class="py-3 px-6">' + regions + '</td>';
        
        // Traffic column
        html += '<td class="py-3 px-6">' + (campaign.traffic || 0) + '</td>';
        
        // Status column with badge
        let statusBadge = '';
        if (campaign.status === 'active') {
          statusBadge = '<span class="bg-green-100 text-green-600 py-1 px-2 rounded-full text-xs cursor-pointer status-toggle" data-id="' + campaign.id + '" data-status="active">Active</span>';
        } else if (campaign.status === 'paused') {
          statusBadge = '<span class="bg-yellow-100 text-yellow-600 py-1 px-2 rounded-full text-xs cursor-pointer status-toggle" data-id="' + campaign.id + '" data-status="paused">Paused</span>';
        } else if (campaign.status === 'completed') {
          statusBadge = '<span class="bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs cursor-pointer status-toggle" data-id="' + campaign.id + '" data-status="completed">Completed</span>';
        } else {
          statusBadge = '<span class="bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">-</span>';
        }
        html += '<td class="py-3 px-6">' + statusBadge + '</td>';
        
        // Active toggle switch column
        const isActive = campaign.isActive !== false;
        const activeSwitch = isActive ? 
          '<label class="inline-flex items-center cursor-pointer"><input type="checkbox" class="sr-only active-toggle" data-id="' + campaign.id + '" checked><div class="relative w-11 h-6 bg-green-500 rounded-full"><div class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform transform translate-x-5"></div></div></label>' : 
          '<label class="inline-flex items-center cursor-pointer"><input type="checkbox" class="sr-only active-toggle" data-id="' + campaign.id + '"><div class="relative w-11 h-6 bg-gray-300 rounded-full"><div class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform"></div></div></label>';
        html += '<td class="py-3 px-6">' + activeSwitch + '</td>';
        
        // Actions column
        html += '<td class="py-3 px-6">';
        html += '<div class="flex items-center space-x-3">';
        html += '<button class="text-purple-500 hover:text-purple-700 manage-launches" data-id="' + campaign.id + '" title="Manage Launches"><i class="fas fa-rocket"></i></button>';
        html += '<button class="text-green-500 hover:text-green-700 edit-campaign" data-id="' + campaign.id + '" title="Edit Campaign"><i class="fas fa-edit"></i></button>';
        html += '<button class="text-red-500 hover:text-red-700 delete-campaign" data-id="' + campaign.id + '" title="Delete Campaign"><i class="fas fa-trash"></i></button>';
        html += '</div>';
        html += '</td>';
        
        html += '</tr>';
      });
      
      campaignsListEl.innerHTML = html;
      
      // Add event listeners
      document.querySelectorAll('.edit-campaign').forEach(button => {
        button.addEventListener('click', () => editCampaign(button.dataset.id));
      });
      
      document.querySelectorAll('.delete-campaign').forEach(button => {
        button.addEventListener('click', () => deleteCampaign(button.dataset.id));
      });
      
      document.querySelectorAll('.manage-launches').forEach(button => {
        button.addEventListener('click', () => manageLaunches(button.dataset.id));
      });
      
      document.querySelectorAll('.status-toggle').forEach(badge => {
        badge.addEventListener('click', () => toggleStatus(badge.dataset.id, badge.dataset.status));
      });
      
      document.querySelectorAll('.active-toggle').forEach(toggle => {
        toggle.addEventListener('change', () => toggleCampaignActive(toggle.dataset.id));
      });
      
      setupBulkSelectionHandlers();
    }
    
    async function generateLaunchLink(campaignId, launchNumber) {
  try {
    const response = await fetch('/api/campaigns/generate-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        campaignId: campaignId,
        launchNumber: launchNumber || 0,
        params: {
          utm_source: 'tiktok',
          utm_medium: 'cpc',
          utm_campaign: campaignId
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Server error: ' + response.status);
    }
    
    const data = await response.json();
    
    if (data.success && data.link) {
      await copyToClipboard(data.link);
      alert('Subdomain copied to clipboard: ' + data.link);
    } else {
      throw new Error('No link generated');
    }
  } catch (error) {
    console.error('Error generating launch link:', error);
    alert('Error generating link: ' + error.message);
  }
}
    
    // Toggle launch from modal
    async function toggleLaunchFromModal(campaignId, launchNumber) {
      try {
        // Get the current campaign
        const campaignResponse = await fetch('/api/campaigns/' + campaignId);
        if (!campaignResponse.ok) {
          throw new Error('Failed to fetch campaign');
        }
        
        const campaign = await campaignResponse.json();
        
        // Toggle the launch state
        if (campaign.launches && campaign.launches[launchNumber]) {
          campaign.launches[launchNumber].isActive = !campaign.launches[launchNumber].isActive;
          campaign.updatedAt = new Date().toISOString();
          
          // Update the campaign
          const updateResponse = await fetch('/api/campaigns/' + campaignId, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(campaign)
          });
          
          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            throw new Error(errorData.message || 'Failed to update campaign');
          }
          
          // Refresh modal content
          await manageLaunches(campaignId);
          
          // Refresh main table
          fetchCampaigns(currentPage, {
            search: document.getElementById('campaign-search').value,
            status: document.getElementById('campaign-status-filter').value
          });
        } else {
          throw new Error('Launch ' + launchNumber + ' not found');
        }
      } catch (error) {
        console.error('Error toggling launch:', error);
        alert('Error toggling launch state: ' + error.message);
      }
    }
    
    async function addNewLaunches(campaignId, count) {
      try {
        const button = document.getElementById('add-launches-btn');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Adding...';
        button.disabled = true;
        
        // Get the current campaign with fresh data
        const campaignResponse = await fetch('/api/campaigns/' + campaignId + '?t=' + Date.now());
        if (!campaignResponse.ok) {
          throw new Error('Failed to fetch campaign');
        }
        
        const campaign = await campaignResponse.json();
        
        // Initialize launches if not present
        if (!campaign.launches) {
          campaign.launches = {
            "0": { isActive: true, createdAt: new Date().toISOString(), generatedAt: null }
          };
          campaign.maxLaunchNumber = 0;
          campaign.totalLaunches = 1;
        }
        
        // Fix any data inconsistencies
        const actualLaunchCount = Object.keys(campaign.launches).length;
        if (campaign.totalLaunches !== actualLaunchCount) {
          campaign.totalLaunches = actualLaunchCount;
        }
        
        // Find the actual max launch number from existing launches
        const existingLaunchNumbers = Object.keys(campaign.launches).map(k => parseInt(k));
        const currentMaxLaunch = existingLaunchNumbers.length > 0 ? Math.max(...existingLaunchNumbers) : -1;
        
        // Also check if maxLaunchNumber needs correction
        if (campaign.maxLaunchNumber !== undefined && campaign.maxLaunchNumber < currentMaxLaunch) {
          campaign.maxLaunchNumber = currentMaxLaunch;
        }
        
        // Add new launches
        const newLaunches = [];
        for (let i = 1; i <= count; i++) {
          const newLaunchNumber = currentMaxLaunch + i;
          // Use string keys to match the existing format
          campaign.launches[newLaunchNumber.toString()] = {
            isActive: true,
            createdAt: new Date().toISOString(),
            generatedAt: null
          };
          newLaunches.push(newLaunchNumber);
        }
        
        // Update campaign metadata
        campaign.maxLaunchNumber = currentMaxLaunch + count;
        campaign.totalLaunches = Object.keys(campaign.launches).length;
        campaign.updatedAt = new Date().toISOString();
        
        // Update the campaign - send complete campaign data
        const updateResponse = await fetch('/api/campaigns/' + campaignId, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify(campaign)
        });
        
        if (!updateResponse.ok) {
          const responseText = await updateResponse.text();
          throw new Error('Failed to update campaign: ' + responseText);
        }
        
        // Verify the update by fetching the campaign again
        const verifyResponse = await fetch('/api/campaigns/' + campaignId + '?t=' + Date.now() + '&nocache=true');
        if (verifyResponse.ok) {
          const updatedCampaign = await verifyResponse.json();
          
          // Check if the new launches were actually added
          const verifiedLaunchKeys = Object.keys(updatedCampaign.launches || {});
          const missingLaunches = newLaunches.filter(num => !verifiedLaunchKeys.includes(num.toString()));
          
          if (missingLaunches.length > 0) {
            console.error('ERROR: Launches were not saved properly! Missing:', missingLaunches);
            throw new Error('Launches were not saved. This might be a server-side issue.');
          }
        }
        
        // Show success message
        alert('Successfully added ' + count + ' new launch(es): ' + newLaunches.join(', '));
        
        // Reset button
        button.innerHTML = originalText;
        button.disabled = false;
        
        // Refresh the modal with fresh data
        await manageLaunches(campaignId);
        
        // Also refresh the main table
        fetchCampaigns(currentPage, {
          search: document.getElementById('campaign-search').value,
          status: document.getElementById('campaign-status-filter').value
        });
        
      } catch (error) {
        console.error('Error adding launches:', error);
        alert('Error adding launches: ' + error.message);
        
        // Reset button on error
        const button = document.getElementById('add-launches-btn');
        if (button) {
          button.innerHTML = '<i class="fas fa-plus mr-1"></i> Add Launches';
          button.disabled = false;
        }
      }
    }
    
    
    // Update the manageLaunches function to show refresh indication
    async function manageLaunches(campaignId) {
      try {
        currentCampaignForLaunches = campaignId;
        
        // Fetch fresh campaign details with timestamp to avoid caching
        const response = await fetch('/api/campaigns/' + campaignId + '?t=' + Date.now());
        if (!response.ok) {
          throw new Error('Failed to fetch campaign details');
        }
        
        const campaign = await response.json();
        
        // Initialize launches if not present
        if (!campaign.launches || Object.keys(campaign.launches).length === 0) {
          campaign.launches = {
            0: { isActive: true, createdAt: new Date().toISOString(), generatedAt: null }
          };
          
          // Update the campaign with the default launch
          const updateResponse = await fetch('/api/campaigns/' + campaignId, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(campaign)
          });
          
          if (!updateResponse.ok) {
            console.error('Failed to initialize default launch');
          }
        }
        
        // Build launch management interface
        const campaignHeader = document.getElementById('launch-campaign-header');
        const addSection = document.getElementById('launch-add-section');
        const existingSection = document.getElementById('launch-existing-section');
        
        // Campaign info header
        let headerHtml = '<div class="bg-blue-50 p-4 rounded-lg border border-blue-200">';
        headerHtml += '<h3 class="text-lg font-semibold text-blue-900 mb-1">' + campaign.name + '</h3>';
        headerHtml += '<p class="text-sm text-blue-700">Campaign ID: ' + campaign.id + '</p>';
        headerHtml += '<p class="text-sm text-blue-600">Total Launches: ' + Object.keys(campaign.launches).length + '</p>';
        headerHtml += '<div class="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">';
        headerHtml += '<p class="text-xs text-yellow-800"><i class="fas fa-info-circle mr-1"></i>';
        headerHtml += 'The "Generate Link" button will create/refresh the Shopify pages with the latest campaign settings, including any updated affiliate links.</p>';
        headerHtml += '</div>';
        headerHtml += '</div>';
        
        // Add new launch section
        let addHtml = '<div class="bg-green-50 p-4 rounded-lg border border-green-200">';
        addHtml += '<h4 class="text-md font-semibold text-green-900 mb-3">Add New Launches</h4>';
        addHtml += '<div class="flex items-center space-x-3">';
        addHtml += '<label class="text-sm font-medium text-green-800">Count:</label>';
        addHtml += '<input type="number" id="new-launch-count" min="1" max="10" value="1" class="border border-green-300 rounded px-2 py-1 w-20 text-sm">';
        addHtml += '<button id="add-launches-btn" class="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-1 rounded text-sm transition-colors">';
        addHtml += '<i class="fas fa-plus mr-1"></i> Add Launches';
        addHtml += '</button>';
        addHtml += '</div>';
        addHtml += '</div>';
        
        // Build existing launches display
        const sortedLaunches = Object.keys(campaign.launches)
          .map(function(k) { return parseInt(k); })
          .sort(function(a, b) { return a - b; });
        
        let existingHtml = '';
        
        if (sortedLaunches.length > 0) {
          existingHtml += '<div class="grid grid-cols-1 gap-3">';
          
          sortedLaunches.forEach(function(launchNum) {
            const launch = campaign.launches[launchNum];
            
            const statusClass = launch.isActive ? 'text-green-700' : 'text-gray-600';
            const bgClass = launch.isActive ? 'bg-green-100 border-green-300' : 'bg-gray-100 border-gray-300';
            const badgeClass = launch.isActive ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-700';
            
            existingHtml += '<div class="flex items-center justify-between p-4 ' + bgClass + ' rounded-lg border">';
            existingHtml += '<div class="flex items-center space-x-4">';
            existingHtml += '<span class="text-lg font-semibold">Launch ' + launchNum + (launchNum === 0 ? ' (Default)' : '') + '</span>';
            existingHtml += '<span class="px-3 py-1 rounded-full text-sm font-medium ' + badgeClass + '">' + (launch.isActive ? 'Active' : 'Disabled') + '</span>';
            
            if (launch.createdAt) {
              existingHtml += '<span class="text-sm text-gray-600">Created: ' + new Date(launch.createdAt).toLocaleDateString() + '</span>';
            }
            
            if (launch.generatedAt) {
              const genDate = new Date(launch.generatedAt);
              const now = new Date();
              const hoursSinceGen = Math.floor((now - genDate) / (1000 * 60 * 60));
              
              existingHtml += '<span class="text-sm text-gray-600">Last refreshed: ' + genDate.toLocaleDateString() + ' ' + genDate.toLocaleTimeString();
              
              if (hoursSinceGen < 1) {
                existingHtml += ' <span class="text-green-600">(Recently updated)</span>';
              } else if (hoursSinceGen < 24) {
                existingHtml += ' <span class="text-blue-600">(' + hoursSinceGen + 'h ago)</span>';
              } else {
                const daysSinceGen = Math.floor(hoursSinceGen / 24);
                existingHtml += ' <span class="text-orange-600">(' + daysSinceGen + 'd ago)</span>';
              }
              
              existingHtml += '</span>';
            } else {
              existingHtml += '<span class="text-sm text-orange-600">Not yet generated</span>';
            }
            
            existingHtml += '</div>';
            existingHtml += '<div class="flex items-center space-x-3">';
            
            // Updated button text and title
            const buttonText = launch.generatedAt ? 
              '<i class="fas fa-sync mr-2"></i>Refresh & Copy' : 
              '<i class="fas fa-link mr-2"></i>Generate Link';
            const buttonTitle = launch.generatedAt ? 
              'Refresh Shopify pages with latest settings and copy link' : 
              'Generate Shopify pages and copy link';
            
            existingHtml += '<button class="generate-link-btn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors" data-launch="' + launchNum + '" data-campaign="' + campaignId + '" title="' + buttonTitle + '">';
            existingHtml += buttonText;
            existingHtml += '</button>';
            
            existingHtml += '<button class="toggle-launch-btn bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors" data-launch="' + launchNum + '" data-campaign="' + campaignId + '" title="Toggle Active State">';
            existingHtml += '<i class="fas fa-toggle-' + (launch.isActive ? 'on' : 'off') + ' mr-2"></i>' + (launch.isActive ? 'Disable' : 'Enable');
            existingHtml += '</button>';
            existingHtml += '</div>';
            existingHtml += '</div>';
          });
          
          existingHtml += '</div>';
        } else {
          existingHtml += '<div class="text-center py-8">';
          existingHtml += '<i class="fas fa-rocket text-gray-400 text-4xl mb-4"></i>';
          existingHtml += '<p class="text-gray-600 text-lg">No launches found</p>';
          existingHtml += '<p class="text-gray-500">Click "Add Launches" to create your first launch</p>';
          existingHtml += '</div>';
        }
        
        // Insert content into sections
        campaignHeader.innerHTML = headerHtml;
        addSection.innerHTML = addHtml;
        existingSection.innerHTML = existingHtml;
        
        // Add event listeners
        document.getElementById('add-launches-btn').addEventListener('click', async function() {
          const count = parseInt(document.getElementById('new-launch-count').value) || 1;
          await addNewLaunches(campaignId, count);
        });
        
        document.querySelectorAll('.toggle-launch-btn').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            const launchNum = parseInt(btn.dataset.launch);
            const campaignId = btn.dataset.campaign;
            await toggleLaunchFromModal(campaignId, launchNum);
          });
        });
        
        document.querySelectorAll('.generate-link-btn').forEach(function(btn) {
          btn.addEventListener('click', async function() {
            const launchNum = parseInt(btn.dataset.launch);
            const campaignId = btn.dataset.campaign;
            await generateLinkFromModal(campaignId, launchNum);
          });
        });
        
        // Show modal
        document.getElementById('launch-modal').classList.remove('hidden');
        
      } catch (error) {
        console.error('Error managing launches:', error);
        alert('Error loading launch management: ' + error.message);
      }
    }
    

    async function generateLinkFromModal(campaignId, launchNumber) {
      try {
        const selector = '[data-launch="' + launchNumber + '"] .generate-link-btn';
        const button = document.querySelector(selector);
        if (button) {
          const originalText = button.innerHTML;
          // Show different message if refreshing vs first generation
          const isRefresh = originalText.includes('Refresh');
          button.innerHTML = isRefresh ? 
            '<i class="fas fa-spinner fa-spin mr-2"></i>Refreshing pages...' :
            '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';
          button.disabled = true;
        }
        
        // Prepare request data
        const requestData = {
          campaignId: campaignId,
          launchNumber: launchNumber,
          params: {
            utm_source: 'tiktok',
            utm_medium: 'cpc',
            utm_campaign: campaignId
          }
        };
        
        const response = await fetch('/api/campaigns/generate-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
        
        // Try to get response body regardless of status
        let responseData;
        const responseText = await response.text();
        
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('Failed to parse response as JSON:', parseError);
          responseData = { error: responseText };
        }
        
        if (!response.ok) {
          const errorMessage = responseData.message || responseData.error || 'Server error: ' + response.status;
          throw new Error(errorMessage);
        }
        
        if (responseData.success && responseData.link) {
          await copyToClipboard(responseData.link);
          
          if (button) {
            // Show different success message based on whether it was a refresh
            const successMessage = responseData.refreshed ? 
              '<i class="fas fa-check mr-2"></i>Refreshed & Copied!' :
              '<i class="fas fa-check mr-2"></i>Generated & Copied!';
            
            button.innerHTML = successMessage;
            button.style.backgroundColor = '#28a745';
            
            // Also show a more detailed alert for refresh operations
            if (responseData.refreshed) {
              setTimeout(() => {
                alert('Shopify pages have been refreshed with the latest campaign settings, including any updated affiliate links. The link has been copied to your clipboard.');
              }, 100);
            }
            
            setTimeout(function() {
              button.innerHTML = '<i class="fas fa-sync mr-2"></i>Refresh & Copy';
              button.style.backgroundColor = '';
              button.disabled = false;
            }, 3000);
          }
          
          // Refresh the modal to show updated timestamp
          await manageLaunches(campaignId);
          
          // Refresh the main table
          fetchCampaigns(currentPage, {
            search: document.getElementById('campaign-search').value,
            status: document.getElementById('campaign-status-filter').value
          });
        } else {
          throw new Error('No link generated - response missing success or link property');
        }
      } catch (error) {
        console.error('Error generating link:', error);
        
        // Show more informative error message
        let userMessage = 'Error generating link: ' + error.message;
        
        // Check for specific error types
        if (error.message.includes('store is missing admin API token')) {
          userMessage = 'Error: The TikTok store is missing its Admin API token. Please update the store configuration in Shopify Stores admin.';
        } else if (error.message.includes('store not found')) {
          userMessage = 'Error: One of the configured stores was not found. Please check the campaign configuration.';
        } else if (error.message.includes('Launch') && error.message.includes('does not exist')) {
          userMessage = 'Error: ' + error.message + '. Please use the "Add Launches" button first.';
        }
        
        alert(userMessage);
        
        const selector = '[data-launch="' + launchNumber + '"] .generate-link-btn';
        const button = document.querySelector(selector);
        if (button) {
          const wasRefresh = button.innerHTML.includes('Refreshing');
          button.innerHTML = wasRefresh ? 
            '<i class="fas fa-sync mr-2"></i>Refresh & Copy' :
            '<i class="fas fa-link mr-2"></i>Generate Link';
          button.disabled = false;
        }
      }
    }
    
    
    // Update pagination
    function updatePagination(total) {
      document.getElementById('campaigns-showing').textContent = campaignsData.length;
      document.getElementById('campaigns-total').textContent = total;
      
      const prevButton = document.getElementById('prev-page');
      const nextButton = document.getElementById('next-page');
      
      prevButton.disabled = currentPage <= 1;
      nextButton.disabled = currentPage >= totalPages;
    }
    
    // Set up region checkboxes
    function setupRegionCheckboxes() {
      document.querySelectorAll('.region-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
          const region = this.value;
          const linkDiv = document.getElementById('affiliate-link-' + region.toLowerCase());
          
          if (this.checked) {
            linkDiv.classList.remove('hidden');
          } else {
            linkDiv.classList.add('hidden');
          }
        });
      });
    }
    
  
    
  function setupRedirectTypeSelector() {
    const redirectTypeSelect = document.getElementById('redirect-type');
    const customRedirectContainer = document.getElementById('custom-redirect-container');
    const templateSelect = document.getElementById('campaign-template');
    
    redirectTypeSelect.addEventListener('change', function() {
      if (this.value === 'custom') {
        customRedirectContainer.classList.remove('hidden');
        // Make template not required for custom redirect
        templateSelect.removeAttribute('required');
        templateSelect.classList.remove('required-field');
      } else {
        customRedirectContainer.classList.add('hidden');
        // Make template required again for Shopify redirect
        templateSelect.setAttribute('required', 'required');
        templateSelect.classList.add('required-field');
      }
    });
  }
  
  // Toggle campaign active state

    // Toggle campaign active state
    async function toggleCampaignActive(id) {
      try {
        const response = await fetch('/api/campaigns/' + id + '/toggle-active', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        
        if (response.ok) {
          fetchCampaigns(currentPage, {
            search: document.getElementById('campaign-search').value,
            status: document.getElementById('campaign-status-filter').value
          });
        } else {
          const data = await response.json();
          alert(data.message || 'Error toggling campaign active state');
        }
      } catch (error) {
        console.error('Error toggling campaign active state:', error);
        alert('Error toggling campaign active state');
      }
    }
    
    async function editCampaign(id) {
      try {
        console.log('Loading campaign details for ID: ' + id);
        const response = await fetch('/api/campaigns/' + id);
        
        if (!response.ok) {
          throw new Error('API returned status ' + response.status);
        }
        
        const campaign = await response.json();
        console.log('Campaign data loaded:', campaign);
        
        // Set basic form values with null checks
        const campaignIdEl = document.getElementById('campaign-id');
        if (campaignIdEl) campaignIdEl.value = campaign.id || '';
        
        const campaignNameEl = document.getElementById('campaign-name');
        if (campaignNameEl) campaignNameEl.value = campaign.name || '';
        
        const tiktokStoreEl = document.getElementById('tiktok-store');
        if (tiktokStoreEl) tiktokStoreEl.value = campaign.tiktokStoreId || '';
        
        const redirectStoreEl = document.getElementById('redirect-store');
        if (redirectStoreEl) redirectStoreEl.value = campaign.redirectStoreId || '';
        
        const campaignSparkEl = document.getElementById('campaign-spark');
        if (campaignSparkEl) campaignSparkEl.value = campaign.sparkId || '';
        
        // Set redirect type and show/hide appropriate fields
        const redirectType = campaign.redirectType || 'shopify';
        const redirectTypeEl = document.getElementById('redirect-type');
        if (redirectTypeEl) redirectTypeEl.value = redirectType;
        
        const customRedirectContainer = document.getElementById('custom-redirect-container');
        const campaignTemplateEl = document.getElementById('campaign-template');
        
        if (redirectType === 'custom') {
          if (customRedirectContainer) customRedirectContainer.classList.remove('hidden');
          
          const customRedirectLinkEl = document.getElementById('custom-redirect-link');
          if (customRedirectLinkEl) customRedirectLinkEl.value = campaign.customRedirectLink || '';
          
          // Template is not required for custom redirect
          if (campaignTemplateEl) {
            campaignTemplateEl.removeAttribute('required');
            campaignTemplateEl.value = campaign.templateId || '';
          }
        } else {
          if (customRedirectContainer) customRedirectContainer.classList.add('hidden');
          
          if (campaignTemplateEl) {
            campaignTemplateEl.setAttribute('required', 'required');
            campaignTemplateEl.value = campaign.templateId || '';
          }
        }
        
        // Reset all region checkboxes and affiliate link inputs
        document.querySelectorAll('.region-checkbox').forEach(checkbox => {
          checkbox.checked = false;
          const region = checkbox.value;
          const regionContainer = document.getElementById('affiliate-link-' + region.toLowerCase());
          if (regionContainer) regionContainer.classList.add('hidden');
        });
        
        // Set selected regions and affiliate links
        if (campaign.regions && campaign.regions.length > 0) {
          campaign.regions.forEach(region => {
            const checkbox = document.getElementById('region-' + region.toLowerCase());
            if (checkbox) {
              checkbox.checked = true;
              const regionContainer = document.getElementById('affiliate-link-' + region.toLowerCase());
              if (regionContainer) regionContainer.classList.remove('hidden');
              
              // Set standard affiliate link
              if (campaign.affiliateLinks && campaign.affiliateLinks[region]) {
                const standardLinkInput = document.getElementById('affiliate-link-' + region.toLowerCase() + '-input');
                if (standardLinkInput) {
                  standardLinkInput.value = campaign.affiliateLinks[region];
                }
              }
              
              // Set iOS affiliate link
              if (campaign.affiliateLinks && campaign.affiliateLinks[region + '_ios']) {
                const iosLinkInput = document.getElementById('affiliate-link-' + region.toLowerCase() + '-ios-input');
                if (iosLinkInput) {
                  iosLinkInput.value = campaign.affiliateLinks[region + '_ios'];
                }
              }
              
              // Set Android affiliate link
              if (campaign.affiliateLinks && campaign.affiliateLinks[region + '_android']) {
                const androidLinkInput = document.getElementById('affiliate-link-' + region.toLowerCase() + '-android-input');
                if (androidLinkInput) {
                  androidLinkInput.value = campaign.affiliateLinks[region + '_android'];
                }
              }
            }
          });
        }
        
        // Set initial clicks value if the element exists
        const initialClicksEl = document.getElementById('initial-clicks');
        if (initialClicksEl) {
          if (campaign.initialClicks !== undefined) {
            initialClicksEl.value = campaign.initialClicks;
          } else {
            initialClicksEl.value = 10;
          }
        }
        
        // Update modal title and show
        const modalTitleEl = document.getElementById('campaign-modal-title');
        if (modalTitleEl) modalTitleEl.textContent = 'Edit Campaign';
        
        const campaignModal = document.getElementById('campaign-modal');
        if (campaignModal) campaignModal.classList.remove('hidden');
        
      } catch (error) {
        console.error('Error fetching campaign:', error);
        alert('Error loading campaign details: ' + (error.message || 'Unknown error'));
      }
    }

    // Delete campaign
    async function deleteCampaign(id) {
      if (!confirm('Are you sure you want to delete this campaign and all associated Shopify pages?')) {
        return;
      }
      
      try {
        const response = await fetch('/api/campaigns/' + id, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete campaign: ' + response.status);
        }
        
        const result = await response.json();
        
        if (result.success) {
          alert('Campaign deleted successfully');
          fetchCampaigns(currentPage, {
            search: document.getElementById('campaign-search').value,
            status: document.getElementById('campaign-status-filter').value
          });
        } else {
          alert(result.message || 'Error deleting campaign');
        }
      } catch (error) {
        console.error('Error deleting campaign:', error);
        alert('Error deleting campaign: ' + error.message);
      }
    }

    // Toggle campaign status
    async function toggleStatus(id, currentStatus) {
      let newStatus = 'active';
      
      if (currentStatus === 'active') {
        newStatus = 'paused';
      } else if (currentStatus === 'paused') {
        newStatus = 'completed';
      } else if (currentStatus === 'completed') {
        newStatus = 'active';
      }
      
      try {
        const response = await fetch('/api/campaigns/' + id + '/status', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
          fetchCampaigns(currentPage, {
            search: document.getElementById('campaign-search').value,
            status: document.getElementById('campaign-status-filter').value
          });
        } else {
          const data = await response.json();
          alert(data.message || 'Error updating campaign status');
        }
      } catch (error) {
        console.error('Error updating campaign status:', error);
        alert('Error updating campaign status');
      }
    }
    

    // Set up bulk selection handlers
    function setupBulkSelectionHandlers() {
      const selectAllCheckbox = document.getElementById('select-all-campaigns');
      if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
          const isChecked = this.checked;
          document.querySelectorAll('.campaign-checkbox').forEach(checkbox => {
            checkbox.checked = isChecked;
          });
          updateBulkActionsVisibility();
        });
      }
      
      document.querySelectorAll('.campaign-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateBulkActionsVisibility);
      });
      
      document.getElementById('apply-bulk-action').addEventListener('click', applyBulkAction);
      
      document.getElementById('cancel-bulk-selection').addEventListener('click', () => {
        document.querySelectorAll('.campaign-checkbox').forEach(checkbox => {
          checkbox.checked = false;
        });
        if (selectAllCheckbox) {
          selectAllCheckbox.checked = false;
        }
        updateBulkActionsVisibility();
      });
    }

    // Update bulk actions container visibility
    function updateBulkActionsVisibility() {
      const selectedCheckboxes = document.querySelectorAll('.campaign-checkbox:checked');
      const bulkActionsContainer = document.getElementById('bulk-actions-container');
      const selectedCountEl = document.getElementById('selected-count');
      
      if (selectedCheckboxes.length > 0) {
        bulkActionsContainer.classList.remove('hidden');
        selectedCountEl.textContent = selectedCheckboxes.length;
      } else {
        bulkActionsContainer.classList.add('hidden');
      }
    }

    // Bulk operations
    async function bulkDeleteCampaign(campaignId) {
      const response = await fetch('/api/campaigns/' + campaignId, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Server error: ' + response.status);
      }
      
      return await response.json();
    }

    async function bulkSetCampaignStatus(campaignId, status) {
      const response = await fetch('/api/campaigns/' + campaignId + '/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Server error: ' + response.status);
      }
      
      return await response.json();
    }

    async function bulkToggleCampaignActive(campaignId) {
      const response = await fetch('/api/campaigns/' + campaignId + '/toggle-active', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Server error: ' + response.status);
      }
      
      return await response.json();
    }

    // Apply bulk action
    async function applyBulkAction() {
      const selectedAction = document.getElementById('bulk-action-select').value;
      const selectedCampaigns = Array.from(
        document.querySelectorAll('.campaign-checkbox:checked')
      ).map(checkbox => checkbox.dataset.id);
      
      if (!selectedAction) {
        alert('Please select an action to perform');
        return;
      }
      
      if (selectedCampaigns.length === 0) {
        alert('No campaigns selected');
        return;
      }
      
      console.log('Applying ' + selectedAction + ' to ' + selectedCampaigns.length + ' campaigns');
      
      if (selectedAction === 'delete') {
        if (!confirm('Are you sure you want to delete ' + selectedCampaigns.length + ' selected campaigns? This cannot be undone.')) {
          return;
        }
      }
      
      try {
        const applyButton = document.getElementById('apply-bulk-action');
        const originalText = applyButton.innerHTML;
        applyButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
        applyButton.disabled = true;
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const campaignId of selectedCampaigns) {
          try {
            if (selectedAction === 'delete') {
              await bulkDeleteCampaign(campaignId);
            } else if (selectedAction.startsWith('status-')) {
              const status = selectedAction.replace('status-', '');
              await bulkSetCampaignStatus(campaignId, status);
            } else if (selectedAction === 'toggle-active') {
              await bulkToggleCampaignActive(campaignId);
            }
            successCount++;
          } catch (error) {
            console.error('Error processing campaign ' + campaignId + ':', error);
            errorCount++;
          }
        }
        
        applyButton.innerHTML = originalText;
        applyButton.disabled = false;
        
        if (errorCount === 0) {
          alert('Successfully processed all ' + successCount + ' campaigns');
        } else {
          alert('Processed ' + successCount + ' campaigns successfully. Failed to process ' + errorCount + ' campaigns.');
        }
        
        fetchCampaigns(currentPage, {
          search: document.getElementById('campaign-search').value,
          status: document.getElementById('campaign-status-filter').value
        });
        
        document.getElementById('select-all-campaigns').checked = false;
        document.getElementById('bulk-actions-container').classList.add('hidden');
        
      } catch (error) {
        console.error('Error applying bulk action:', error);
        alert('Error applying bulk action: ' + error.message);
        
        const applyButton = document.getElementById('apply-bulk-action');
        applyButton.innerHTML = 'Apply';
        applyButton.disabled = false;
      }
    }
    
    async function saveCampaign(e) {
      console.log('Save campaign function triggered');
      
      if (e) {
        e.preventDefault();
      }
      
      try {
        var saveButton = document.querySelector('#campaign-form button[type="submit"]');
        if (saveButton) {
          var originalText = saveButton.innerHTML;
          saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
          saveButton.disabled = true;
        }
        
        var campaignId = document.getElementById('campaign-id').value;
        console.log('Campaign operation: ' + (campaignId ? 'Update existing' : 'Create new') + ' campaign');
        
        // Validate basic data
        var campaignName = document.getElementById('campaign-name').value;
        var tiktokStoreId = document.getElementById('tiktok-store').value;
        var redirectStoreId = document.getElementById('redirect-store').value;
        var sparkId = document.getElementById('campaign-spark').value;
        
        if (!campaignName) {
          throw new Error('Campaign name is required');
        }
        if (!tiktokStoreId) {
          throw new Error('TikTok store selection is required');
        }
        if (!redirectStoreId) {
          throw new Error('Redirect store selection is required');
        }
        if (!sparkId) {
          throw new Error('Spark selection is required');
        }
        
        // Get redirect type
        var redirectType = document.getElementById('redirect-type').value;
        var customRedirectLink = '';
        var templateId = document.getElementById('campaign-template').value;
        
        // Validate based on redirect type
        if (redirectType === 'custom') {
          customRedirectLink = document.getElementById('custom-redirect-link').value;
          if (!customRedirectLink) {
            throw new Error('Custom redirect link is required when using custom redirect type');
          }
          // Validate URL format and HTTPS requirement
          try {
            var customUrl = new URL(customRedirectLink);
            if (customUrl.protocol !== 'https:') {
              throw new Error('Custom redirect link must use HTTPS protocol');
            }
          } catch (e) {
            if (e.message && e.message.includes('HTTPS')) {
              throw e;
            }
            throw new Error('Invalid custom redirect link URL format');
          }
          // Template is optional for custom redirect
          templateId = templateId || null;
        } else {
          // Template is required for Shopify redirect
          if (!templateId) {
            throw new Error('Template selection is required for Shopify redirect');
          }
        }
        
        console.log('Base validation passed');
        
        // Collect regions and affiliate links
        var selectedRegions = [];
        var affiliateLinks = {};
        var hasAtLeastOneRegionWithLinks = false;
        
        document.querySelectorAll('.region-checkbox:checked').forEach(function(checkbox) {
          var region = checkbox.value;
          console.log('Processing region: ' + region);
          selectedRegions.push(region);
          
          var regionLower = region.toLowerCase();
          var standardLinkInput = document.getElementById('affiliate-link-' + regionLower + '-input');
          if (standardLinkInput && standardLinkInput.value) {
            affiliateLinks[region] = standardLinkInput.value;
            console.log('- Standard link found for ' + region);
          }
          
          var iosLinkInput = document.getElementById('affiliate-link-' + regionLower + '-ios-input');
          if (iosLinkInput && iosLinkInput.value) {
            affiliateLinks[region + '_ios'] = iosLinkInput.value;
            console.log('- iOS link found for ' + region);
          }
          
          var androidLinkInput = document.getElementById('affiliate-link-' + regionLower + '-android-input');
          if (androidLinkInput && androidLinkInput.value) {
            affiliateLinks[region + '_android'] = androidLinkInput.value;
            console.log('- Android link found for ' + region);
          }
          
          if (
            (standardLinkInput && standardLinkInput.value) || 
            (iosLinkInput && iosLinkInput.value) || 
            (androidLinkInput && androidLinkInput.value)
          ) {
            hasAtLeastOneRegionWithLinks = true;
          } else {
            console.error('No affiliate links found for region: ' + region);
          }
        });
        
        if (selectedRegions.length === 0) {
          throw new Error('At least one region must be selected');
        }
        
        if (!hasAtLeastOneRegionWithLinks) {
          throw new Error('Each selected region must have at least one affiliate link type (Standard, iOS, or Android)');
        }
        
        console.log('Region validation passed, found ' + selectedRegions.length + ' regions with valid links');
        
        // Initialize advanced settings with defaults (since these elements don't exist in the form)
        var advancedSettings = {
          iosVersion: 16,
          androidVersion: 12,
          blockedUserAgents: [],
          enableBotTrap: false
        };
        
        // Check if advanced settings elements exist before accessing them
        var iosVersionEl = document.getElementById('ios-version');
        if (iosVersionEl && iosVersionEl.value) {
          advancedSettings.iosVersion = parseInt(iosVersionEl.value) || 16;
        }
        
        var androidVersionEl = document.getElementById('android-version');
        if (androidVersionEl && androidVersionEl.value) {
          advancedSettings.androidVersion = parseInt(androidVersionEl.value) || 12;
        }
        
        var blockedUserAgentsEl = document.getElementById('blocked-user-agents');
        if (blockedUserAgentsEl && blockedUserAgentsEl.value) {
          advancedSettings.blockedUserAgents = blockedUserAgentsEl.value.split(',')
            .map(function(ua) { return ua.trim(); })
            .filter(function(ua) { return ua.length > 0; });
        }
        
        var enableBotTrapEl = document.getElementById('enable-bot-trap');
        if (enableBotTrapEl) {
          advancedSettings.enableBotTrap = enableBotTrapEl.checked;
        }
        
        // Get initialClicks setting with default
        var initialClicks = 10;
        var initialClicksInput = document.getElementById('initial-clicks');
        
        if (initialClicksInput && initialClicksInput.value && initialClicksInput.value.trim() !== '') {
          var parsedClicks = parseInt(initialClicksInput.value.trim(), 10);
          if (!isNaN(parsedClicks) && parsedClicks >= 0) {
            initialClicks = parsedClicks;
          }
        }
        
        console.log('Using initialClicks value:', initialClicks);
        
        // Gather campaign data
        var campaignData = {
          name: campaignName,
          tiktokStoreId: tiktokStoreId,
          redirectStoreId: redirectStoreId,
          templateId: templateId,
          sparkId: sparkId,
          regions: selectedRegions,
          affiliateLinks: affiliateLinks,
          showWhitehat: true,
          status: 'active',
          advancedSettings: advancedSettings,
          initialClicks: initialClicks,
          redirectType: redirectType,
          customRedirectLink: customRedirectLink
        };
        
        console.log('Campaign data prepared', JSON.stringify(campaignData));
        
        // Make API call
        var url = campaignId ? '/api/campaigns/' + campaignId : '/api/campaigns';
        var method = campaignId ? 'PUT' : 'POST';
        
        if (campaignId) {
          campaignData.id = campaignId;
        }
        
        console.log('Sending API request to ' + url + ' with method ' + method);
        
        var response = await fetch(url, {
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(campaignData)
        });
        
        console.log('API response received, status: ' + response.status);
        
        if (response.ok) {
          var result = await response.json();
          console.log('Campaign saved successfully', result);
          
          document.getElementById('campaign-modal').classList.add('hidden');
          
          // Refresh the campaigns list
          fetchCampaigns(currentPage, {
            search: document.getElementById('campaign-search').value,
            status: document.getElementById('campaign-status-filter').value
          });
          
          alert('Campaign saved successfully');
        } else {
          try {
            var errorData = await response.json();
            console.error('API error response:', errorData);
            throw new Error(errorData.message || errorData.error || 'Server error: ' + response.status);
          } catch (parseError) {
            throw new Error('Error saving campaign: ' + response.status);
          }
        }
      } catch (error) {
        console.error('Save campaign error:', error);
        alert(error.message || 'Error saving campaign');
      } finally {
        var saveButton = document.querySelector('#campaign-form button[type="submit"]');
        if (saveButton) {
          saveButton.innerHTML = 'Save Campaign';
          saveButton.disabled = false;
        }
      }
    }
    
    // Initialize when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
      fetchCampaigns();
      fetchStores();
      fetchTemplates();
      fetchSparks();
      
      setupRegionCheckboxes();
      setupRedirectTypeSelector();

      // Search functionality
      document.getElementById('campaign-search-btn').addEventListener('click', () => {
        const search = document.getElementById('campaign-search').value;
        const status = document.getElementById('campaign-status-filter').value;
        
        fetchCampaigns(1, { search, status });
      });
      
      document.getElementById('campaign-search').addEventListener('keyup', e => {
        if (e.key === 'Enter') {
          const search = e.target.value;
          const status = document.getElementById('campaign-status-filter').value;
          
          fetchCampaigns(1, { search, status });
        }
      });
      
      document.getElementById('campaign-status-filter').addEventListener('change', e => {
        const search = document.getElementById('campaign-search').value;
        const status = e.target.value;
        
        fetchCampaigns(1, { search, status });
      });
      
      // Pagination
      document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
          const search = document.getElementById('campaign-search').value;
          const status = document.getElementById('campaign-status-filter').value;
          
          fetchCampaigns(currentPage - 1, { search, status });
        }
      });
      
      document.getElementById('next-page').addEventListener('click', () => {
        if (currentPage < totalPages) {
          const search = document.getElementById('campaign-search').value;
          const status = document.getElementById('campaign-status-filter').value;
          
          fetchCampaigns(currentPage + 1, { search, status });
        }
      });
      
      // Modal handlers
      document.getElementById('create-campaign-btn').addEventListener('click', () => {
        document.getElementById('campaign-form').reset();
        document.getElementById('campaign-id').value = '';
        document.getElementById('campaign-modal-title').textContent = 'Create Campaign';
        
        document.querySelectorAll('.region-checkbox').forEach(checkbox => {
          checkbox.checked = false;
          const region = checkbox.value;
          document.getElementById('affiliate-link-' + region.toLowerCase()).classList.add('hidden');
        });
        
        
        document.getElementById('campaign-modal').classList.remove('hidden');
      });
      
      document.getElementById('close-campaign-modal').addEventListener('click', () => {
        document.getElementById('campaign-modal').classList.add('hidden');
      });
      
      document.getElementById('cancel-campaign').addEventListener('click', () => {
        document.getElementById('campaign-modal').classList.add('hidden');
      });
      

      
      document.getElementById('campaign-form').addEventListener('submit', saveCampaign);
      
      // Launch modal events
      document.getElementById('close-launch-modal').addEventListener('click', () => {
        document.getElementById('launch-modal').classList.add('hidden');
      });
      
      // Logout functionality
      document.getElementById('logout-link').addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (confirm('Are you sure you want to logout?')) {
          try {
            const response = await fetch('/api/logout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              window.location.href = '/';
            }
          } catch (error) {
            console.error('Logout error:', error);
          }
        }
      });
    });
  </script>
</body>
</html>
`;