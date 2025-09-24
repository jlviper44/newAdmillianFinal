import { getSession, getSessionIdFromCookie, fetchAllMemberships } from './session.service.js';
import { isAdminUser } from './auth.config.js';
import { getUserTeam } from './auth.handlers.js';

export async function getVirtualAssistantAccounts(env, userEmail) {
  try {
    if (!userEmail) {
      console.log('No user email provided for virtual assistant check');
      return [];
    }

    const query = `
      SELECT
        user_id,
        expires_at,
        status,
        created_at,
        has_comment_bot_access,
        has_dashboard_access,
        has_bc_gen_access,
        dashboard_metrics,
        dashboard_campaigns,
        dashboard_launches,
        dashboard_sparks,
        dashboard_templates,
        dashboard_shopify,
        dashboard_logs,
        dashboard_link_splitter
      FROM virtual_assistants
      WHERE LOWER(email) = LOWER(?)
        AND status = 'active'
        AND expires_at > datetime('now')
    `;

    const result = await env.USERS_DB.prepare(query).bind(userEmail).all();

    if (!result.results || result.results.length === 0) {
        return [];
    }

    const accounts = [];
    for (const row of result.results) {
      try {
        const sessionQuery = `
          SELECT user_data
          FROM sessions
          WHERE user_id = ?
          ORDER BY updated_at DESC
          LIMIT 1
        `;

        const sessionResult = await env.USERS_DB.prepare(sessionQuery)
          .bind(row.user_id)
          .first();

        if (sessionResult && sessionResult.user_data) {
          const userData = JSON.parse(sessionResult.user_data);
          accounts.push({
            user_id: row.user_id,
            email: userData.email || 'Unknown',
            name: userData.name || 'Unknown',
            expires_at: row.expires_at,
            status: row.status,
            created_at: row.created_at,
            has_comment_bot_access: row.has_comment_bot_access,
            has_dashboard_access: row.has_dashboard_access,
            has_bc_gen_access: row.has_bc_gen_access,
            dashboard_metrics: row.dashboard_metrics,
            dashboard_campaigns: row.dashboard_campaigns,
            dashboard_launches: row.dashboard_launches,
            dashboard_sparks: row.dashboard_sparks,
            dashboard_templates: row.dashboard_templates,
            dashboard_shopify: row.dashboard_shopify,
            dashboard_logs: row.dashboard_logs,
            dashboard_link_splitter: row.dashboard_link_splitter
          });
        } else {
        }
      } catch (e) {
        console.error('Error processing virtual assistant record:', e);
      }
    }

    return accounts;
  } catch (error) {
    console.error('Error fetching virtual assistant accounts:', error);
    return [];
  }
}

export async function handleCheckAccess(request, env) {
  const sessionId = getSessionIdFromCookie(request);

  if (!sessionId) {
    return new Response(JSON.stringify({
      user: null,
      memberships: [],
      subscriptions: {
        comment_bot: {
          isActive: false,
          expiresIn: 0,
          checkoutLink: env.WHOP_COMMENT_BOT_CHECKOUT_LINK || null,
          totalCredits: 0,
          creditMemberships: []
        },
        bc_gen: {
          isActive: false,
          expiresIn: 0,
          checkoutLink: env.WHOP_BC_GEN_CHECKOUT_LINK || null,
          totalCredits: 0,
          creditMemberships: []
        },
        dashboard: {
          isActive: false,
          expiresIn: 0,
          checkoutLink: env.WHOP_DASHBOARD_CHECKOUT_LINK || null
        },
        virtual_assistant: {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null,
          totalCredits: 0,
          creditMemberships: []
        }
      },
      virtualAssistantFor: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let session = await getSession(env.USERS_DB, sessionId);
  if (!session || !session.access_token) {
    return new Response(JSON.stringify({
      user: null,
      memberships: [],
      subscriptions: {
        comment_bot: {
          isActive: false,
          expiresIn: 0,
          checkoutLink: env.WHOP_COMMENT_BOT_CHECKOUT_LINK || null,
          totalCredits: 0,
          creditMemberships: []
        },
        bc_gen: {
          isActive: false,
          expiresIn: 0,
          checkoutLink: env.WHOP_BC_GEN_CHECKOUT_LINK || null,
          totalCredits: 0,
          creditMemberships: []
        },
        dashboard: {
          isActive: false,
          expiresIn: 0,
          checkoutLink: env.WHOP_DASHBOARD_CHECKOUT_LINK || null
        },
        virtual_assistant: {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null,
          totalCredits: 0,
          creditMemberships: []
        }
      },
      virtualAssistantFor: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const userData = session.user_data ? JSON.parse(session.user_data) : {};
  const virtualAssistantMode = userData.virtualAssistantMode;
  const targetUserId = virtualAssistantMode?.targetUserId;

  if (targetUserId) {
    const vaQuery = `
      SELECT * FROM virtual_assistants
      WHERE user_id = ?
      AND email = ?
      AND status = 'active'
      AND expires_at > datetime('now')
    `;

    const vaResult = await env.USERS_DB.prepare(vaQuery)
      .bind(targetUserId, session.user.email)
      .first();

    if (!vaResult) {
      return new Response(JSON.stringify({
        error: 'Not authorized as virtual assistant for this user'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const targetSessionQuery = `
      SELECT * FROM sessions
      WHERE user_id = ?
      AND access_token IS NOT NULL
      AND access_token != ''
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const targetSession = await env.USERS_DB.prepare(targetSessionQuery)
      .bind(targetUserId)
      .first();

    if (!targetSession || !targetSession.access_token) {
      const anySessionQuery = `
        SELECT * FROM sessions
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      const anySession = await env.USERS_DB.prepare(anySessionQuery)
        .bind(targetUserId)
        .first();

      if (anySession) {
        try {
          const userData = anySession.user_data ? JSON.parse(anySession.user_data) : {};
          const targetIsAdmin = userData.email && isAdminUser(userData.email);

          let storedSubscriptions = null;
          if (anySession.subscriptions) {
            try {
              storedSubscriptions = JSON.parse(anySession.subscriptions);
            } catch (e) {
            }
          }

          return new Response(JSON.stringify({
            user: {
              id: targetUserId,
              ...userData,
              isAdmin: targetIsAdmin,
              isVirtualAssistant: true,
              assistingFor: userData.email || userData.name || `User #${targetUserId}`,
              originalEmail: virtualAssistantMode.originalEmail,
              vaPermissions: {
                hasCommentBotAccess: vaResult.has_comment_bot_access === 1,
                hasDashboardAccess: vaResult.has_dashboard_access === 1,
                hasBCGenAccess: vaResult.has_bc_gen_access === 1,
                dashboardMetrics: vaResult.dashboard_metrics === 1,
                dashboardCampaigns: vaResult.dashboard_campaigns === 1,
                dashboardLaunches: vaResult.dashboard_launches === 1,
                dashboardSparks: vaResult.dashboard_sparks === 1,
                dashboardTemplates: vaResult.dashboard_templates === 1,
                dashboardShopify: vaResult.dashboard_shopify === 1,
                dashboardLogs: vaResult.dashboard_logs === 1,
                dashboardLinkSplitter: vaResult.dashboard_link_splitter === 1
              }
            },
            memberships: [],
            subscriptions: storedSubscriptions || {
              comment_bot: {
                isActive: targetIsAdmin || false,
                expiresIn: 0,
                checkoutLink: null,
                totalCredits: targetIsAdmin ? 999999 : (vaResult.has_comment_bot_access === 1 ? 999999 : 0),
                creditMemberships: [],
                hasVAPermission: vaResult.has_comment_bot_access === 1,
                isStale: true
              },
              bc_gen: {
                isActive: targetIsAdmin || false,
                expiresIn: 0,
                checkoutLink: null,
                totalCredits: targetIsAdmin ? 999999 : (vaResult.has_bc_gen_access === 1 ? 999999 : 0),
                creditMemberships: [],
                hasVAPermission: vaResult.has_bc_gen_access === 1,
                isStale: true
              },
              dashboard: {
                isActive: targetIsAdmin || false,
                expiresIn: 0,
                checkoutLink: null,
                hasVAPermission: vaResult.has_dashboard_access === 1,
                isStale: true
              },
              virtual_assistant: {
                isActive: false,
                expiresIn: 0,
                checkoutLink: null,
                totalCredits: 0,
                creditMemberships: [],
                hasVAPermission: false,
                isStale: true
              }
            },
            virtualAssistantFor: []
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (e) {
          console.error('[VA] Error parsing user data:', e);
        }
      }

      return new Response(JSON.stringify({
        error: 'Target user not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let targetUserData;
    try {
      targetUserData = JSON.parse(targetSession.user_data);
    } catch (e) {
      return new Response(JSON.stringify({
        error: 'Invalid target user data'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    session = {
      ...targetSession,
      user_id: targetUserId,
      user: {
        id: targetUserId,
        ...targetUserData,
        isVirtualAssistant: true,
        assistingFor: targetUserData.name || targetUserData.email || `User #${targetUserId}`,
        originalEmail: virtualAssistantMode.originalEmail,
        vaPermissions: {
          hasCommentBotAccess: vaResult.has_comment_bot_access === 1,
          hasDashboardAccess: vaResult.has_dashboard_access === 1,
          hasBCGenAccess: vaResult.has_bc_gen_access === 1,
          dashboardMetrics: vaResult.dashboard_metrics === 1,
          dashboardCampaigns: vaResult.dashboard_campaigns === 1,
          dashboardLaunches: vaResult.dashboard_launches === 1,
          dashboardSparks: vaResult.dashboard_sparks === 1,
          dashboardTemplates: vaResult.dashboard_templates === 1,
          dashboardShopify: vaResult.dashboard_shopify === 1,
          dashboardLogs: vaResult.dashboard_logs === 1,
          dashboardLinkSplitter: vaResult.dashboard_link_splitter === 1
        }
      },
      virtualAssistantPermissions: {
        hasCommentBotAccess: vaResult.has_comment_bot_access === 1,
        hasDashboardAccess: vaResult.has_dashboard_access === 1,
        hasBCGenAccess: vaResult.has_bc_gen_access === 1,
        dashboardMetrics: vaResult.dashboard_metrics === 1,
        dashboardCampaigns: vaResult.dashboard_campaigns === 1,
        dashboardLaunches: vaResult.dashboard_launches === 1,
        dashboardSparks: vaResult.dashboard_sparks === 1,
        dashboardTemplates: vaResult.dashboard_templates === 1,
        dashboardShopify: vaResult.dashboard_shopify === 1,
        dashboardLogs: vaResult.dashboard_logs === 1,
        dashboardLinkSplitter: vaResult.dashboard_link_splitter === 1
      }
    };
  }

  const userTeam = session.user?.id ? await getUserTeam(env, session.user.id) : null;
  const isAdmin = session.user && session.user.email && isAdminUser(session.user.email);

  if (isAdmin) {
    try {
      const allMemberships = await fetchAllMemberships(session.access_token);
      const memberships = { data: allMemberships };

      const virtualAssistantCredits = memberships.data?.filter(m =>
        (m.metadata?.Quantity !== undefined || m.metadata?.InitialQuantity !== undefined) &&
        (m.metadata?.ProductType === 'virtual_assistant' ||
         m.product_id === env.WHOP_VIRTUAL_ASSISTANT_PRODUCT_ID)
      ) || [];

      const virtualAssistantTotalCredits = virtualAssistantCredits.reduce((sum, m) => {
        const quantity = m.metadata?.Quantity !== undefined ?
          parseInt(m.metadata.Quantity) :
          (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
        return sum + quantity;
      }, 0);

      return new Response(JSON.stringify({
        user: { ...session.user, isAdmin: true, team: userTeam },
        memberships: [],
        subscriptions: {
          comment_bot: {
            isActive: true,
            expiresIn: 9999,
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
            membershipId: 'admin_bypass',
            checkoutLink: null,
            totalCredits: 999999,
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'admin' }
            }]
          },
          bc_gen: {
            isActive: true,
            expiresIn: 9999,
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
            membershipId: 'admin_bypass',
            checkoutLink: null,
            totalCredits: 999999,
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'admin' }
            }]
          },
          dashboard: {
            isActive: true,
            expiresIn: 9999,
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
            membershipId: 'admin_bypass',
            checkoutLink: null
          },
          virtual_assistant: {
            isActive: false,
            expiresIn: 0,
            checkoutLink: null,
            totalCredits: 999999,
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'virtual_assistant' }
            }]
          }
        },
        virtualAssistantFor: await getVirtualAssistantAccounts(env, session.user?.email)
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('Admin fetch virtual assistant credits error:', error);
      return new Response(JSON.stringify({
        user: { ...session.user, isAdmin: true, team: userTeam },
        memberships: [],
        subscriptions: {
          comment_bot: {
            isActive: true,
            expiresIn: 9999,
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
            membershipId: 'admin_bypass',
            checkoutLink: null,
            totalCredits: 999999,
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'admin' }
            }]
          },
          bc_gen: {
            isActive: true,
            expiresIn: 9999,
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
            membershipId: 'admin_bypass',
            checkoutLink: null,
            totalCredits: 999999,
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'admin' }
            }]
          },
          dashboard: {
            isActive: true,
            expiresIn: 9999,
            startDate: Math.floor(Date.now() / 1000),
            endDate: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
            membershipId: 'admin_bypass',
            checkoutLink: null
          },
          virtual_assistant: {
            isActive: false,
            expiresIn: 0,
            checkoutLink: null,
            totalCredits: 999999,
            creditMemberships: [{
              id: 'admin_bypass',
              metadata: { Quantity: 999999, ProductType: 'virtual_assistant' }
            }]
          }
        },
        virtualAssistantFor: []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const allMemberships = await fetchAllMemberships(session.access_token);
    const membershipResponse = { ok: allMemberships.length >= 0 };

    if (!membershipResponse.ok) {
      if (targetUserId) {
        return new Response(JSON.stringify({
          user: { ...session.user, isAdmin, team: userTeam },
          memberships: [],
          subscriptions: {
            comment_bot: {
              isActive: true,
              expiresIn: 365,
              checkoutLink: null,
              totalCredits: 999999,
              creditMemberships: []
            },
            bc_gen: {
              isActive: true,
              expiresIn: 365,
              checkoutLink: null,
              totalCredits: 999999,
              creditMemberships: []
            },
            dashboard: {
              isActive: true,
              expiresIn: 365,
              checkoutLink: null
            },
            virtual_assistant: {
              isActive: false,
              expiresIn: 0,
              checkoutLink: null,
              totalCredits: 0,
              creditMemberships: []
            }
          },
          virtualAssistantFor: await getVirtualAssistantAccounts(env, session.user?.originalEmail || session.user?.email)
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ hasAccess: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const memberships = { data: allMemberships };

    if (targetUserId) {
      console.log('[VA] This is a virtual assistant request for target user:', targetUserId);
      console.log('[VA] Membership response status:', membershipResponse.status);
      console.log('[VA] First few memberships:', memberships.data?.slice(0, 3));
    }

    const calculateDaysRemaining = (endTimestamp) => {
      if (!endTimestamp) return 0;
      const endDate = new Date(endTimestamp * 1000);
      const today = new Date();
      const diffTime = endDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    const commentBotMembership = memberships.data?.find(membership =>
      membership.plan_id === env.WHOP_COMMENT_BOT_PLAN_ID &&
      membership.status === 'active'
    );

    const bcGenMembership = memberships.data?.find(membership =>
      membership.plan_id === env.WHOP_BC_GEN_PLAN_ID &&
      membership.status === 'active'
    );

    if (targetUserId) {
      console.log('[VA] Looking for dashboard plan ID:', env.WHOP_DASHBOARD_PLAN_ID);
      console.log('[VA] Available plan IDs:', memberships.data?.map(m => m.plan_id));
    }
    const dashboardMembership = memberships.data?.find(membership =>
      membership.plan_id === env.WHOP_DASHBOARD_PLAN_ID &&
      membership.status === 'active'
    );

    const commentBotCredits = memberships.data?.filter(m =>
      (m.metadata?.Quantity !== undefined || m.metadata?.InitialQuantity !== undefined) &&
      (m.metadata?.ProductType === 'comment_bot' ||
       m.product_id === env.WHOP_COMMENT_BOT_PRODUCT_ID)
    ) || [];

    const bcGenCredits = memberships.data?.filter(m =>
      (m.metadata?.Quantity !== undefined || m.metadata?.InitialQuantity !== undefined) &&
      (m.metadata?.ProductType === 'bc_gen' ||
       m.product_id === env.WHOP_BC_GEN_PRODUCT_ID)
    ) || [];

    const virtualAssistantCredits = memberships.data?.filter(m =>
      (m.metadata?.Quantity !== undefined || m.metadata?.InitialQuantity !== undefined) &&
      (m.metadata?.ProductType === 'virtual_assistant' ||
       m.product_id === env.WHOP_VIRTUAL_ASSISTANT_PRODUCT_ID)
    ) || [];

    const commentBotTotalCredits = commentBotCredits.reduce((sum, m) => {
      const quantity = m.metadata?.Quantity !== undefined ?
        parseInt(m.metadata.Quantity) :
        (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
      return sum + quantity;
    }, 0);
    const bcGenTotalCredits = bcGenCredits.reduce((sum, m) => {
      const quantity = m.metadata?.Quantity !== undefined ?
        parseInt(m.metadata.Quantity) :
        (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
      return sum + quantity;
    }, 0);
    const virtualAssistantTotalCredits = virtualAssistantCredits.reduce((sum, m) => {
      const quantity = m.metadata?.Quantity !== undefined ?
        parseInt(m.metadata.Quantity) :
        (m.metadata?.InitialQuantity !== undefined ? parseInt(m.metadata.InitialQuantity) : 0);
      return sum + quantity;
    }, 0);

    const subscriptions = {
      comment_bot: {
        isActive: !!commentBotMembership,
        expiresIn: commentBotMembership ? calculateDaysRemaining(commentBotMembership.renewal_period_end) : 0,
        startDate: commentBotMembership?.renewal_period_start || null,
        endDate: commentBotMembership?.renewal_period_end || null,
        membershipId: commentBotMembership?.id || null,
        checkoutLink: env.WHOP_COMMENT_BOT_CHECKOUT_LINK || null,
        totalCredits: commentBotTotalCredits,
        creditMemberships: commentBotCredits
      },
      bc_gen: {
        isActive: !!bcGenMembership,
        expiresIn: bcGenMembership ? calculateDaysRemaining(bcGenMembership.renewal_period_end) : 0,
        startDate: bcGenMembership?.renewal_period_start || null,
        endDate: bcGenMembership?.renewal_period_end || null,
        membershipId: bcGenMembership?.id || null,
        checkoutLink: env.WHOP_BC_GEN_CHECKOUT_LINK || null,
        totalCredits: bcGenTotalCredits,
        creditMemberships: bcGenCredits
      },
      dashboard: {
        isActive: !!dashboardMembership,
        expiresIn: dashboardMembership ? calculateDaysRemaining(dashboardMembership.renewal_period_end) : 0,
        startDate: dashboardMembership?.renewal_period_start || null,
        endDate: dashboardMembership?.renewal_period_end || null,
        membershipId: dashboardMembership?.id || null,
        checkoutLink: env.WHOP_DASHBOARD_CHECKOUT_LINK || null
      },
      virtual_assistant: {
        isActive: false,
        expiresIn: 0,
        checkoutLink: null,
        totalCredits: virtualAssistantTotalCredits,
        creditMemberships: virtualAssistantCredits
      }
    };

    const emailToCheck = targetUserId && session.user?.originalEmail ? session.user.originalEmail : session.user?.email;
    const virtualAssistantAccounts = await getVirtualAssistantAccounts(env, emailToCheck);

    const isDirectVirtualAssistant = !targetUserId && virtualAssistantAccounts.length > 0 && !isAdmin;

    if (isDirectVirtualAssistant) {
      let hasAnyCommentBotAccess = false;
      let hasAnyDashboardAccess = false;
      let hasAnyBCGenAccess = false;

      for (const account of virtualAssistantAccounts) {
        if (account.has_comment_bot_access) hasAnyCommentBotAccess = true;
        if (account.has_dashboard_access) hasAnyDashboardAccess = true;
        if (account.has_bc_gen_access) hasAnyBCGenAccess = true;
      }

      if (!hasAnyCommentBotAccess) {
        subscriptions.comment_bot = {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null,
          totalCredits: 0,
          creditMemberships: []
        };
      }

      if (!hasAnyDashboardAccess) {
        subscriptions.dashboard = {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null
        };
      }

      if (!hasAnyBCGenAccess) {
        subscriptions.bc_gen = {
          isActive: false,
          expiresIn: 0,
          checkoutLink: null,
          totalCredits: 0,
          creditMemberships: []
        };
      }
    }

    if (targetUserId && session.virtualAssistantPermissions) {
      console.log('[VA] Before permission flags - subscriptions:', {
        comment_bot_active: subscriptions.comment_bot?.isActive,
        dashboard_active: subscriptions.dashboard?.isActive,
        bc_gen_active: subscriptions.bc_gen?.isActive
      });

      const perms = session.virtualAssistantPermissions;

      subscriptions.comment_bot.hasVAPermission = perms.hasCommentBotAccess;
      subscriptions.dashboard.hasVAPermission = perms.hasDashboardAccess;
      subscriptions.bc_gen.hasVAPermission = perms.hasBCGenAccess;

      subscriptions.virtual_assistant = {
        isActive: false,
        expiresIn: 0,
        checkoutLink: null,
        totalCredits: 0,
        creditMemberships: [],
        hasVAPermission: false
      };

      console.log('[VA] After permission flags - subscriptions:', {
        comment_bot_active: subscriptions.comment_bot?.isActive,
        dashboard_active: subscriptions.dashboard?.isActive,
        bc_gen_active: subscriptions.bc_gen?.isActive,
        permissions: perms
      });
    }

    const isDirectlyVirtualAssistant = !targetUserId && virtualAssistantAccounts.length > 0 && !isAdmin;

    const responseData = {
      user: {
        ...session.user,
        isAdmin: isDirectlyVirtualAssistant ? false : isAdmin,
        team: userTeam,
        isVirtualAssistant: isDirectlyVirtualAssistant || session.user?.isVirtualAssistant || false,
        assistingFor: session.user?.assistingFor || null
      },
      memberships: memberships.data,
      subscriptions,
      virtualAssistantFor: virtualAssistantAccounts
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Check access error:', error);
    return new Response(JSON.stringify({
      user: session?.user ? { ...session.user, isAdmin: session.user.email ? isAdminUser(session.user.email) : false, team: userTeam } : null,
      memberships: [],
      subscriptions: {
        comment_bot: { isActive: false, expiresIn: 0, checkoutLink: env.WHOP_COMMENT_BOT_CHECKOUT_LINK || null },
        bc_gen: { isActive: false, expiresIn: 0, checkoutLink: env.WHOP_BC_GEN_CHECKOUT_LINK || null },
        dashboard: { isActive: false, expiresIn: 0, checkoutLink: env.WHOP_DASHBOARD_CHECKOUT_LINK || null },
        virtual_assistant: { isActive: false, expiresIn: 0, checkoutLink: null, totalCredits: 0, creditMemberships: [] }
      },
      virtualAssistantFor: []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleGetUser(request, env) {
  const sessionId = getSessionIdFromCookie(request);

  if (!sessionId) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let session = await getSession(env.USERS_DB, sessionId);

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get('targetUserId');

  if (targetUserId && session) {
    const vaQuery = `
      SELECT * FROM virtual_assistants
      WHERE user_id = ?
      AND email = ?
      AND status = 'active'
      AND expires_at > datetime('now')
    `;

    const vaResult = await env.USERS_DB.prepare(vaQuery)
      .bind(targetUserId, session.user.email)
      .first();

    if (!vaResult) {
      return new Response(JSON.stringify({
        error: 'Not authorized as virtual assistant for this user'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const targetSessionQuery = `
      SELECT * FROM sessions
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const targetSession = await env.USERS_DB.prepare(targetSessionQuery)
      .bind(targetUserId)
      .first();

    if (targetSession) {
      let targetUserData;
      try {
        targetUserData = JSON.parse(targetSession.user_data);
      } catch (e) {
        targetUserData = {};
      }

      const userTeam = await getUserTeam(env, targetUserId);
      const validUser = {
        id: targetUserId,
        ...targetUserData,
        isVirtualAssistant: true,
        assistingFor: targetUserData.email,
        isAdmin: targetUserData.email ? isAdminUser(targetUserData.email) : false,
        team: userTeam
      };

      return new Response(JSON.stringify({
        user: validUser
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  let validUser = null;
  if (session?.user && session.user.id) {
    const userTeam = await getUserTeam(env, session.user.id);
    validUser = { ...session.user, isAdmin: session.user.email ? isAdminUser(session.user.email) : false, team: userTeam };
  }

  return new Response(JSON.stringify({
    user: validUser
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}