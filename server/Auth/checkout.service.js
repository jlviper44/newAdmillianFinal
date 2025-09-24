import { getSessionIdFromCookie, getSession, fetchAllMemberships } from './session.service.js';
import { COMMENT_BOT_CREDIT_PRICE, BC_GEN_CREDIT_PRICE, VIRTUAL_ASSISTANT_CREDIT_PRICE, isAdminUser } from './auth.config.js';

export async function handleCreateCheckout(request, env) {
  const sessionId = getSessionIdFromCookie(request);

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const session = await getSession(env.USERS_DB, sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { quantity = 100, productType = 'comment_bot' } = await request.json();

  // Validate product type
  if (!['comment_bot', 'bc_gen', 'virtual_assistant'].includes(productType)) {
    return new Response(JSON.stringify({ error: 'Invalid product type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get product ID based on type
  const productId = productType === 'comment_bot'
    ? env.WHOP_COMMENT_BOT_PRODUCT_ID
    : productType === 'bc_gen'
    ? env.WHOP_BC_GEN_PRODUCT_ID
    : env.WHOP_VIRTUAL_ASSISTANT_PRODUCT_ID;

  const productName = productType === 'comment_bot' ? 'Comment Bot' : productType === 'bc_gen' ? 'BC Gen' : 'Virtual Assistant';

  try {
    // Create a plan with the specified quantity
    const planResponse = await fetch('https://api.whop.com/api/v2/plans', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHOP_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_type: 'one_time',
        base_currency: 'usd',
        stock: 1,
        visibility: "hidden",
        payment_link_description: `Purchasing ${quantity} credits for ${productName}`,
        initial_price: quantity * (productType === 'comment_bot' ? COMMENT_BOT_CREDIT_PRICE : productType === 'bc_gen' ? BC_GEN_CREDIT_PRICE : VIRTUAL_ASSISTANT_CREDIT_PRICE),
        product_id: productId,
        metadata: {
          Quantity: quantity,
          InitialQuantity: quantity,
          ProductType: productType
        }
      })
    });

    if (!planResponse.ok) {
      const error = await planResponse.text();
      console.error('Failed to create plan:', error);
      return new Response(JSON.stringify({ error: 'Failed to create checkout' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const planData = await planResponse.json();

    return new Response(JSON.stringify({
      success: true,
      direct_link: planData.direct_link,
      plan_id: planData.id,
      quantity: quantity
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create checkout' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleUseCredits(request, env) {
  const sessionId = getSessionIdFromCookie(request);

  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const session = await getSession(env.USERS_DB, sessionId);
  if (!session || !session.access_token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { credits, productType = 'comment_bot', assistedUserId } = await request.json();

  // Check if this is a virtual assistant in assist mode
  let targetSession = session;
  let targetAccessToken = session.access_token;

  // Check for VA mode in user_data (this is where it's actually stored)
  const userData = session.user_data ? JSON.parse(session.user_data) : {};
  const virtualAssistantMode = userData.virtualAssistantMode;
  const targetUserId = virtualAssistantMode?.targetUserId;

  if (targetUserId) {
    // VA is in assist mode - need to use the target user's credits
    console.log(`[VA Credit Use] Virtual assistant ${virtualAssistantMode.originalEmail} attempting to use credits for user ${targetUserId}`);

    // Get VA permissions from the database
    const vaQuery = `
      SELECT * FROM virtual_assistants
      WHERE user_id = ?
      AND email = ?
      AND status = 'active'
      AND expires_at > datetime('now')
    `;

    const vaEmail = virtualAssistantMode.originalEmail || session.user?.email;
    const vaResult = await env.USERS_DB.prepare(vaQuery)
      .bind(targetUserId, vaEmail)
      .first();

    if (!vaResult) {
      return new Response(JSON.stringify({
        error: 'Not authorized as virtual assistant for this user'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify VA has permission for this product type
    const vaPermissions = {
      hasCommentBotAccess: vaResult.has_comment_bot_access === 1,
      hasDashboardAccess: vaResult.has_dashboard_access === 1,
      hasBCGenAccess: vaResult.has_bc_gen_access === 1
    };
    if (productType === 'comment_bot' && !vaPermissions.hasCommentBotAccess) {
      return new Response(JSON.stringify({ error: 'Virtual assistant does not have Comment Bot access' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (productType === 'bc_gen' && !vaPermissions.hasBCGenAccess) {
      return new Response(JSON.stringify({ error: 'Virtual assistant does not have BC Gen access' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (productType === 'virtual_assistant') {
      return new Response(JSON.stringify({ error: 'Virtual assistants cannot manage other virtual assistants' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the target user's session to use their access token
    const targetSessionQuery = `
      SELECT * FROM sessions
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const targetSessionResult = await env.USERS_DB.prepare(targetSessionQuery)
      .bind(targetUserId)
      .first();

    if (!targetSessionResult) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse target user data to check if they're an admin
    let targetUserData = {};
    try {
      targetUserData = targetSessionResult.user_data ? JSON.parse(targetSessionResult.user_data) : {};
    } catch (e) {
      console.error('Error parsing target user data:', e);
    }

    // Check if target user is an admin before requiring access token
    const targetIsAdmin = targetUserData.email && isAdminUser(targetUserData.email);

    if (!targetSessionResult.access_token && !targetIsAdmin) {
      return new Response(JSON.stringify({ error: 'Target user has no active session for credit operations' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    targetSession = {
      ...targetSessionResult,
      user: targetUserData // Ensure user data is available
    };
    targetAccessToken = targetSessionResult.access_token || null;
    console.log(`[VA Credit Use] Switching to target user session. VA: ${virtualAssistantMode.originalEmail}, Target User: ${targetUserId}`);
    console.log(`[VA Credit Use] Target session has access token: ${!!targetAccessToken}`);
  }

  // Check if target user (or assisted user) is an admin - admins don't need to use credits
  // This applies whether the admin is accessing directly OR being assisted by a VA
  const targetUserEmail = targetSession.user?.email;
  if (targetUserEmail && isAdminUser(targetUserEmail)) {
    return new Response(JSON.stringify({
      success: true,
      creditsUsed: 0,
      message: assistedUserId ? 'Admin user being assisted - no credits deducted' : 'Admin user - no credits deducted',
      updates: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!credits || credits < 1) {
    return new Response(JSON.stringify({ error: 'Invalid credits amount' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Validate product type
  if (!['comment_bot', 'bc_gen', 'virtual_assistant'].includes(productType)) {
    return new Response(JSON.stringify({ error: 'Invalid product type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get product ID for filtering
  const productId = productType === 'comment_bot'
    ? env.WHOP_COMMENT_BOT_PRODUCT_ID
    : productType === 'bc_gen'
    ? env.WHOP_BC_GEN_PRODUCT_ID
    : env.WHOP_VIRTUAL_ASSISTANT_PRODUCT_ID;

  try {
    // Get all user's memberships with pagination support - using target user's token
    console.log(`[Credit Deduction] Fetching memberships with token for user: ${targetUserId || 'self'}`);
    const allMemberships = await fetchAllMemberships(targetAccessToken);

    if (!allMemberships) {
      return new Response(JSON.stringify({ error: 'Failed to fetch memberships' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const memberships = { data: allMemberships };

    // Filter memberships with credits for the specific product type
    const creditMemberships = memberships.data?.filter(m => {
      // Check for Quantity (allow InitialQuantity as fallback for initial memberships)
      const quantity = m.metadata?.Quantity !== undefined ?
        parseInt(m.metadata.Quantity) :
        (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);

      return quantity > 0 &&
        (m.metadata?.ProductType === productType || m.product_id === productId);
    }) || [];

    // Sort by quantity (ascending) to use smaller quantities first
    creditMemberships.sort((a, b) => {
      const aQuantity = a.metadata?.Quantity !== undefined ?
        parseInt(a.metadata.Quantity) :
        (a.metadata?.InitialQuantity !== undefined ? parseInt(a.metadata.InitialQuantity) : 0);
      const bQuantity = b.metadata?.Quantity !== undefined ?
        parseInt(b.metadata.Quantity) :
        (b.metadata?.InitialQuantity !== undefined ? parseInt(b.metadata.InitialQuantity) : 0);
      return aQuantity - bQuantity;
    });

    let remainingCredits = credits;
    const updates = [];

    // Calculate credit usage
    for (const membership of creditMemberships) {
      if (remainingCredits <= 0) break;

      // Use Quantity if available, otherwise use InitialQuantity for new memberships
      const currentQuantity = membership.metadata?.Quantity !== undefined ?
        parseInt(membership.metadata.Quantity) :
        (membership.metadata?.InitialQuantity !== undefined ? parseInt(membership.metadata.InitialQuantity) : 0);

      const toSubtract = Math.min(currentQuantity, remainingCredits);
      const newQuantity = currentQuantity - toSubtract;

      updates.push({
        membershipId: membership.id,
        oldQuantity: currentQuantity,
        newQuantity: newQuantity,
        creditsUsed: toSubtract,
        // If we're using InitialQuantity, we need to set Quantity for the first time
        isInitialUse: membership.metadata?.Quantity === undefined
      });

      remainingCredits -= toSubtract;
    }

    if (remainingCredits > 0) {
      console.error('Insufficient credits:', {
        productType,
        productId,
        requested: credits,
        available: credits - remainingCredits,
        creditMembershipsCount: creditMemberships.length
      });
      return new Response(JSON.stringify({
        error: 'Insufficient credits available',
        requested: credits,
        available: credits - remainingCredits,
        productType
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Apply updates
    const updateResults = [];
    for (const update of updates) {
      try {
        // Always update quantity, never terminate (even if it reaches 0)
        const updateResponse = await fetch(`https://api.whop.com/api/v2/memberships/${update.membershipId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.WHOP_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            metadata: {
              Quantity: update.newQuantity
            }
          })
        });

        updateResults.push({
          membershipId: update.membershipId,
          success: updateResponse.ok,
          action: 'updated',
          oldQuantity: update.oldQuantity,
          newQuantity: update.newQuantity,
          creditsUsed: update.creditsUsed
        });
      } catch (error) {
        updateResults.push({
          membershipId: update.membershipId,
          success: false,
          error: error.message
        });
      }
    }

    const allSuccessful = updateResults.every(result => result.success);

    return new Response(JSON.stringify({
      success: allSuccessful,
      creditsRequested: credits,
      creditsUsed: credits - remainingCredits,
      updates: updateResults
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Use credits error:', error);
    return new Response(JSON.stringify({ error: 'Failed to use credits' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}