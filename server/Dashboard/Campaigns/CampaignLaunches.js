/**
 * Launches Management Module
 * Handles all launch-related operations for campaigns
 */

// Import helper functions
import { getUserInfoFromSession } from './launch-utils.js';

// Note: These functions need to be imported from the main Campaigns module
// They handle Shopify-specific operations
let createTikTokValidationPage, updateTikTokPageContent;

// Function to set the Shopify handlers from the Campaigns module
export function setShopifyHandlers(handlers) {
  createTikTokValidationPage = handlers.createTikTokValidationPage;
  updateTikTokPageContent = handlers.updateTikTokPageContent;
}

/**
 * Update launch ID
 */
export async function updateLaunchId(db, campaignId, oldLaunchId, request, env) {
  console.log('=== updateLaunchId called ===');
  console.log('Campaign ID:', campaignId);
  console.log('Old Launch ID:', oldLaunchId, 'Type:', typeof oldLaunchId);
  
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    // Check if campaign exists and user has permission
    let campaign;
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        campaign = await db.prepare(
          `SELECT * FROM campaigns WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaignId, ...memberIds, teamId).first();
      } else {
        campaign = await db.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND team_id = ?'
        ).bind(campaignId, teamId).first();
      }
    } else {
      campaign = await db.prepare(
        'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
      ).bind(campaignId, userId).first();
    }
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    const { newLaunchId } = await request.json();
    console.log('New Launch ID:', newLaunchId, 'Type:', typeof newLaunchId);
    
    // Prevent renaming launch 0 (default launch)
    if (oldLaunchId === '0' || oldLaunchId === 0) {
      return new Response(
        JSON.stringify({ error: 'Cannot rename the default launch (Launch 0)' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Validate new launch ID - now accepting strings
    if (!newLaunchId || typeof newLaunchId !== 'string' || newLaunchId.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Invalid new launch ID' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Validate launch ID format (alphanumeric and underscores only, no dashes)
    if (!/^[a-zA-Z0-9_]+$/.test(newLaunchId)) {
      return new Response(
        JSON.stringify({ error: 'Launch ID can only contain letters, numbers, and underscores' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Parse current launches
    let launches = JSON.parse(campaign.launches || '{}');
    console.log('Current launches:', Object.keys(launches));
    console.log('Checking for old launch:', oldLaunchId, 'Exists:', launches.hasOwnProperty(oldLaunchId));
    
    // Check if old launch exists - convert to string for consistent comparison
    const oldLaunchIdStr = oldLaunchId.toString();
    if (!launches.hasOwnProperty(oldLaunchIdStr)) {
      console.log(`Launch ${oldLaunchIdStr} not found in launches:`, Object.keys(launches));
      return new Response(
        JSON.stringify({ error: 'Launch not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Check if new launch ID already exists
    if (launches.hasOwnProperty(newLaunchId.toString())) {
      return new Response(
        JSON.stringify({ error: 'Launch ID already exists' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Move launch data to new ID
    launches[newLaunchId] = launches[oldLaunchIdStr];
    delete launches[oldLaunchIdStr];
    
    // Update max launch number if needed (only for numeric IDs)
    let maxLaunchNumber = campaign.max_launch_number || 0;
    const newLaunchIdNum = parseInt(newLaunchId);
    if (!isNaN(newLaunchIdNum) && newLaunchIdNum > maxLaunchNumber) {
      maxLaunchNumber = newLaunchIdNum;
    }
    
    // Update campaign in database
    await db.prepare(`
      UPDATE campaigns 
      SET launches = ?, max_launch_number = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(JSON.stringify(launches), maxLaunchNumber, campaignId).run();
    
    // Get the TikTok store to update Shopify pages
    const tiktokStore = await db.prepare(
      'SELECT * FROM shopify_stores WHERE id = ?'
    ).bind(campaign.tiktok_store_id).first();
    
    if (tiktokStore && tiktokStore.access_token) {
      try {
        // Delete old page
        const oldPageHandle = `${campaignId}-${oldLaunchIdStr}`;
        await deleteShopifyPage(tiktokStore, oldPageHandle);
        
        // Create new page if launch is active
        if (launches[newLaunchId].isActive) {
          const newPageHandle = `${campaignId}-${newLaunchId}`;
          
          // Get redirect store domain if using template redirect
          let redirectStoreDomain = null;
          if (campaign.redirect_type !== 'custom' && campaign.redirect_store_id) {
            const redirectStore = await db.prepare(
              'SELECT store_url FROM shopify_stores WHERE id = ?'
            ).bind(campaign.redirect_store_id).first();
            
            if (redirectStore && redirectStore.store_url) {
              redirectStoreDomain = redirectStore.store_url.replace(/^https?:\/\//, '');
              if (!redirectStoreDomain.includes('.myshopify.com')) {
                redirectStoreDomain = `${redirectStoreDomain}.myshopify.com`;
              }
            }
          }
          
          // Parse campaign data for page update
          const campaignData = {
            ...campaign,
            redirect_store_domain: redirectStoreDomain
          };
          
          await createTikTokValidationPage(tiktokStore, campaignData, campaignId, newLaunchId, newPageHandle);
        }
      } catch (error) {
        console.error('Error updating Shopify pages for launch ID change:', error);
        // Continue even if Shopify update fails
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Launch ID updated successfully',
        oldLaunchId: oldLaunchIdStr,
        newLaunchId: newLaunchId
      }),
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error updating launch ID:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update launch ID',
        message: error.message 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Delete a Shopify page by handle
 */
export async function deleteShopifyPage(store, pageHandle) {
  try {
    let apiDomain = store.store_url.replace(/^https?:\/\//, '');
    if (!apiDomain.includes('.myshopify.com')) {
      apiDomain = `${apiDomain}.myshopify.com`;
    }
    
    // First check if page exists
    const checkUrl = `https://${apiDomain}/admin/api/2024-01/pages.json?handle=${pageHandle}`;
    const checkResponse = await fetch(checkUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': store.access_token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!checkResponse.ok) {
      console.log(`Page ${pageHandle} not found or unable to access`);
      return;
    }
    
    const data = await checkResponse.json();
    if (data.pages && data.pages.length > 0) {
      const pageId = data.pages[0].id;
      
      // Delete the page
      const deleteUrl = `https://${apiDomain}/admin/api/2024-01/pages/${pageId}.json`;
      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': store.access_token
        }
      });
      
      console.log(`Deleted Shopify page: ${pageHandle}`);
    }
  } catch (error) {
    console.error('Error deleting Shopify page:', error);
    throw error;
  }
}

/**
 * Manage campaign launches (add, toggle)
 */
export async function manageCampaignLaunches(db, campaignId, request, env) {
  console.log('=== manageCampaignLaunches called ===');
  console.log('Campaign ID:', campaignId);
  console.log('Method:', request.method);
  
  try {
    // Get user_id and team_id from session
    const { userId, teamId } = await getUserInfoFromSession(request, env);
    
    const requestData = await request.json();
    const { action, launchData } = requestData;
    
    console.log(`Managing launches for campaign ${campaignId}: ${action}`);
    console.log('Launch data:', launchData);
    
    // Fetch campaign with team permission check
    let campaign;
    if (teamId) {
      // If user is in a team, get all team members
      const teamMembersQuery = 'SELECT user_id FROM team_members WHERE team_id = ?';
      const teamMembersResult = await env.USERS_DB.prepare(teamMembersQuery).bind(teamId).all();
      
      if (teamMembersResult.results && teamMembersResult.results.length > 0) {
        const memberIds = teamMembersResult.results.map(m => m.user_id);
        const placeholders = memberIds.map(() => '?').join(',');
        campaign = await db.prepare(
          `SELECT * FROM campaigns WHERE id = ? AND (user_id IN (${placeholders}) OR team_id = ?)`
        ).bind(campaignId, ...memberIds, teamId).first();
      } else {
        campaign = await db.prepare(
          'SELECT * FROM campaigns WHERE id = ? AND team_id = ?'
        ).bind(campaignId, teamId).first();
      }
    } else {
      campaign = await db.prepare(
        'SELECT * FROM campaigns WHERE id = ? AND user_id = ?'
      ).bind(campaignId, userId).first();
    }
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    let launches = JSON.parse(campaign.launches || '{}');
    let maxLaunchNumber = campaign.max_launch_number || 0;
    let result = {};
    
    switch (action) {
      case 'add':
        const newLaunchNumber = maxLaunchNumber + 1;
        launches[newLaunchNumber] = {
          isActive: false,  // New launches start disabled
          createdAt: new Date().toISOString(),
          generatedAt: null,
          trafficPassed: 0,
          trafficBlocked: 0,
          trafficDisabled: 0
        };
        maxLaunchNumber = newLaunchNumber;
        
        result = {
          action: 'added',
          launchNumber: newLaunchNumber,
          totalLaunches: Object.keys(launches).length
        };
        break;
        
      case 'toggle':
        const launchNum = launchData.launchNumber.toString(); // Keep as string
        if (launches[launchNum]) {
          launches[launchNum].isActive = !launches[launchNum].isActive;
          result = {
            action: 'toggled',
            launchNumber: launchNum,
            isActive: launches[launchNum].isActive
          };
          
          // Update the TikTok store page when toggling
          try {
            // Get TikTok store details
            const tiktokStore = await db.prepare(
              'SELECT * FROM shopify_stores WHERE id = ?'
            ).bind(campaign.tiktok_store_id).first();
            
            if (tiktokStore && tiktokStore.access_token) {
              console.log('=== SHOPIFY UPDATE START ===');
              console.log(`Updating TikTok store page for launch ${launchNum} - isActive: ${launches[launchNum].isActive}`);
              console.log('TikTok Store:', {
                id: tiktokStore.id,
                store_url: tiktokStore.store_url,
                hasToken: !!tiktokStore.access_token
              });
              console.log('Campaign data:', { 
                redirect_type: campaign.redirect_type, 
                custom_redirect_link: campaign.custom_redirect_link,
                tiktok_store_id: campaign.tiktok_store_id
              });
              
              const pageHandle = `${campaignId}-${launchNum}`;
              
              // Get redirect store domain if using template redirect
              let redirectStoreDomain = null;
              if (campaign.redirect_type !== 'custom' && campaign.redirect_store_id) {
                const redirectStore = await db.prepare(
                  'SELECT store_url FROM shopify_stores WHERE id = ?'
                ).bind(campaign.redirect_store_id).first();
                
                if (redirectStore && redirectStore.store_url) {
                  redirectStoreDomain = redirectStore.store_url.replace(/^https?:\/\//, '');
                  if (!redirectStoreDomain.includes('.myshopify.com')) {
                    redirectStoreDomain = `${redirectStoreDomain}.myshopify.com`;
                  }
                }
              }
              
              // Parse campaign data for page update
              const campaignData = {
                ...campaign,
                name: campaign.name,
                redirect_type: campaign.redirect_type,
                custom_redirect_link: campaign.custom_redirect_link,
                redirect_store_id: campaign.redirect_store_id,
                redirect_store_domain: redirectStoreDomain,
                template_id: campaign.template_id
              };
              
              // Update the TikTok store page
              await updateTikTokPageContent(
                tiktokStore,
                campaignData,
                campaignId,
                launchNum,
                pageHandle,
                launches[launchNum].isActive
              );
              
              console.log(`=== SHOPIFY UPDATE COMPLETE ===`);
              console.log(`TikTok store page updated successfully for launch ${launchNum}`);
            } else {
              console.warn('=== SHOPIFY UPDATE SKIPPED ===');
              console.warn('TikTok store not found or missing access token - cannot update page');
            }
          } catch (updateError) {
            console.error('Error updating TikTok store page:', updateError);
            // Don't fail the whole operation if page update fails
          }
        } else {
          throw new Error(`Launch ${launchNum} not found`);
        }
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Update campaign with new launches
    await db.prepare(`
      UPDATE campaigns SET 
        launches = ?,
        max_launch_number = ?,
        total_launches = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      JSON.stringify(launches),
      maxLaunchNumber,
      Object.keys(launches).length,
      campaignId
    ).run();
    
    return new Response(JSON.stringify({
      success: true,
      campaignId: campaignId,
      result: result,
      launches: launches
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

/**
 * Update campaign traffic counts
 * This is called when logging clicks to update the traffic counters
 */
export async function updateCampaignTraffic(db, campaignId, trafficType, launchNumber = null) {
  try {
    // Update campaign-level traffic
    let updateQuery;
    
    if (trafficType === 'passed' || trafficType === 'blackhat') {
      // Update passed traffic (successful redirects)
      updateQuery = `
        UPDATE campaigns 
        SET traffic_passed = traffic_passed + 1,
            traffic = traffic + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
    } else if (trafficType === 'disabled') {
      // Update disabled traffic (disabled launch visits)
      updateQuery = `
        UPDATE campaigns 
        SET traffic_disabled = traffic_disabled + 1,
            traffic = traffic + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
    } else if (trafficType === 'blocked' || trafficType === 'whitehat') {
      // Update blocked traffic (validation failures)
      updateQuery = `
        UPDATE campaigns 
        SET traffic_blocked = traffic_blocked + 1,
            traffic = traffic + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
    } else {
      // Just update total traffic
      updateQuery = `
        UPDATE campaigns 
        SET traffic = traffic + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
    }
    
    await db.prepare(updateQuery).bind(campaignId).run();
    
    // Update per-launch traffic if launch number is provided
    if (launchNumber !== null) {
      // Get current launches data and disabled clicks threshold
      const campaign = await db.prepare('SELECT launches, disabled_clicks_threshold FROM campaigns WHERE id = ?').bind(campaignId).first();
      if (campaign) {
        const launches = JSON.parse(campaign.launches || '{}');
        const launchKey = launchNumber.toString();
        
        // Initialize launch if it doesn't exist
        if (!launches[launchKey]) {
          launches[launchKey] = {
            isActive: true,
            createdAt: new Date().toISOString(),
            trafficPassed: 0,
            trafficBlocked: 0
          };
        }
        
        // Initialize traffic fields if they don't exist (for existing launches)
        if (typeof launches[launchKey].trafficPassed === 'undefined') {
          launches[launchKey].trafficPassed = 0;
        }
        if (typeof launches[launchKey].trafficBlocked === 'undefined') {
          launches[launchKey].trafficBlocked = 0;
        }
        if (typeof launches[launchKey].trafficDisabled === 'undefined') {
          launches[launchKey].trafficDisabled = 0;
        }
        
        // Update traffic counts
        if (trafficType === 'passed' || trafficType === 'blackhat') {
          launches[launchKey].trafficPassed = launches[launchKey].trafficPassed + 1;
        } else if (trafficType === 'disabled') {
          launches[launchKey].trafficDisabled = launches[launchKey].trafficDisabled + 1;
        } else if (trafficType === 'blocked' || trafficType === 'whitehat') {
          launches[launchKey].trafficBlocked = launches[launchKey].trafficBlocked + 1;
        }
        
        // Save updated launches data
        await db.prepare('UPDATE campaigns SET launches = ? WHERE id = ?')
          .bind(JSON.stringify(launches), campaignId)
          .run();
      }
    }
    
    console.log(`Updated traffic for campaign ${campaignId}, launch ${launchNumber}: ${trafficType}`);
    return { success: true };
    
  } catch (error) {
    console.error('Error updating campaign traffic:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get campaign data for client-side tracking
 * This endpoint doesn't require authentication
 */
export async function getCampaignDataForClient(db, campaignId, launchNumber, request) {
  try {
    // Fetch campaign from database (no user_id check for public access)
    const campaign = await db.prepare(
      'SELECT * FROM campaigns WHERE id = ?'
    ).bind(campaignId).first();
    
    if (!campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Check if launch exists
    const launches = JSON.parse(campaign.launches || '{}');
    if (!launches[launchNumber.toString()]) {
      return new Response(
        JSON.stringify({ error: 'Launch not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get redirect store domain if using Shopify redirect
    let redirectStoreDomain = null;
    if (campaign.redirect_store_id) {
      const redirectStore = await db.prepare(
        'SELECT store_url FROM shopify_stores WHERE id = ?'
      ).bind(campaign.redirect_store_id).first();
      
      if (redirectStore && redirectStore.store_url) {
        redirectStoreDomain = redirectStore.store_url.replace(/^https?:\/\//, '');
        if (!redirectStoreDomain.includes('.myshopify.com') && !redirectStoreDomain.includes('.')) {
          redirectStoreDomain = `${redirectStoreDomain}.myshopify.com`;
        }
      }
    }
    
    // Get client IP from Cloudflare headers
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                    request.headers.get('X-Forwarded-For') || 
                    request.headers.get('X-Real-IP') || 
                    'unknown';
    
    // Parse affiliate links
    const affiliateLinks = JSON.parse(campaign.affiliate_link || '{}');
    
    // Return campaign data for client
    return new Response(JSON.stringify({
      campaignId: campaign.id,
      name: campaign.name,
      redirect_type: campaign.redirect_type,
      custom_redirect_link: campaign.custom_redirect_link,
      redirect_store_domain: redirectStoreDomain,
      affiliateLinks: affiliateLinks,
      isActive: campaign.is_active === 1,
      isEnabled: campaign.is_enabled === 1, // Manual enable/disable status
      launch: {
        number: parseInt(launchNumber),
        isActive: launches[launchNumber.toString()].isActive
      },
      clientIP: clientIP
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('Error fetching campaign data for client:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch campaign data',
        message: error.message 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Default export with all functions
export default {
  updateLaunchId,
  deleteShopifyPage,
  manageCampaignLaunches,
  updateCampaignTraffic,
  getCampaignDataForClient,
  setShopifyHandlers
};