export default {
  async fetch(request, env, ctx) {
    // ====================================
    // ENVIRONMENT VARIABLES & CONFIGURATION
    // ====================================
    const SHEETDB_API_URL = env.SHEETDB_API_URL || 'https://sheetdb.io/api/v1/zb48wyyweh0rp';
    const ADMIN_API_KEY = env.ADMIN_API_KEY;
    const MASTER_ADMIN_EMAIL = env.MASTER_ADMIN_EMAIL;
    const USERS_KV = env.USERS_KV;
    const ORDERS_KV = env.ORDERS_KV;
    const REFUND_REQUESTS_KV = env.REFUND_REQUESTS_KV;
    
    // ====================================
    // CONSTANTS
    // ====================================
    const USER_TIERS = {
      bronze: {
        name: 'Bronze',
        dailyLimit: 25,
        price: 175,
        color: '#CD7F32',
        refundLimit: 2
      },
      silver: {
        name: 'Silver',
        dailyLimit: 50,
        price: 325,
        color: '#C0C0C0',
        refundLimit: 5
      },
      gold: {
        name: 'Gold',
        dailyLimit: 100,
        price: 600,
        color: '#FFD700',
        refundLimit: 12
      }
    };
    
    const ACCOUNT_PRICE = 2;
    
    const COUNTRY_SHEETS = {
      'netherlands': 'Netherlands',
      'saudi arabia': 'Saudi',
      'canada': 'Canada',
      'france': 'France',
      'germany': 'Germany',
      'switzerland': 'Switzerland',
      'sweden': 'Sweden',
      'usa': 'USA',
      'usa auto': 'USA-Autopay'
    };
    
    const CORS_HEADERS = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Email API Configuration
    const EMAIL_API_KEY = 'fe37d01598bf639df353742c376579f904458c4423f90db4d4911bcfa0184539';
    const EMAIL_API_URL = 'https://aws.cubemmo.net/api/get_code';
    
    // ====================================
    // MAIN REQUEST HANDLER
    // ====================================
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      // Route handling
      const routes = {
        // Public routes
        '/': () => handleHomePage(),
        '/api/login': () => handleLogin(request, env),
        '/api/availability': () => handleCheckAvailability(env),
        '/api/verify-session': () => handleVerifySession(request, env),
        '/api/logout': () => handleLogout(request, env),

        // User routes
        '/api/create-order': () => handleCreateOrder(request, env),
        '/api/check-email': () => handleCheckEmail(request, env),
        '/api/refund-request': () => handleRefundRequest(request, env),
        '/api/user-refunds': () => handleGetUserRefunds(request, env),
        
        // Admin routes
        '/admin': () => handleAdminPanel(),
        '/api/admin/users': () => handleAdminUsers(request, env),
        '/api/admin/create-user': () => handleCreateUser(request, env),
        '/api/admin/update-user': () => handleUpdateUser(request, env),
        '/api/admin/delete-user': () => handleDeleteUser(request, env),
        '/api/admin/reset-password': () => handleResetPassword(request, env),
        '/api/admin/orders': () => handleGetOrders(request, env),
        '/api/admin/fulfill': () => handleFulfillOrder(request, env),
        '/api/admin/revert-order': () => handleRevertOrder(request, env),
        '/api/admin/stats': () => handleGetStats(request, env),
        '/api/admin/refund-requests': () => handleGetRefundRequests(request, env),
        '/api/admin/approve-refund': () => handleApproveRefund(request, env),
        '/api/admin/reject-refund': () => handleRejectRefund(request, env)

      
      };
      
      // Dynamic routes
      if (path.startsWith('/api/user-orders/')) {
        return handleGetUserOrders(request, env);
      } else if (path.startsWith('/api/order-status/')) {
        return handleGetOrderStatus(request, env);
      }
      
      // Static routes
      const handler = routes[path];
      if (handler) {
        return handler();
      }
      
      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });
      
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
    
    // ====================================
    // UTILITY FUNCTIONS
    // ====================================
    
    // Password hashing
    async function hashPassword(password) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    }
    
    // Generate random password
    function generateRandomPassword() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
      let password = '';
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    }
    
    // Check subscription status
    function isSubscriptionActive(lastPaymentDate) {
      if (!lastPaymentDate) return false;
      const lastPayment = new Date(lastPaymentDate);
      const now = new Date();
      const daysDiff = Math.floor((now - lastPayment) / (1000 * 60 * 60 * 24));
      return daysDiff <= 7;
    }
    
    // Get days until subscription expires
    function getDaysUntilExpiry(lastPaymentDate) {
      if (!lastPaymentDate) return 0;
      const lastPayment = new Date(lastPaymentDate);
      const now = new Date();
      const daysDiff = Math.floor((now - lastPayment) / (1000 * 60 * 60 * 24));
      return Math.max(0, 7 - daysDiff);
    }
    
    // ====================================
    // AUTHENTICATION HANDLERS
    // ====================================
    
    async function handleLogin(request, env) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const body = await request.json();
      const { username, password } = body;
      
      if (!username || !password) {
        return new Response(JSON.stringify({ error: 'Username and password required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const userData = await USERS_KV.get(`user:${username}`);
      if (!userData) {
        return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const user = JSON.parse(userData);
      const hashedPassword = await hashPassword(password);
      
      if (user.password !== hashedPassword) {
        return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      if (!isSubscriptionActive(user.lastPaymentDate)) {
        return new Response(JSON.stringify({ error: 'Your subscription has expired. Please renew to continue.' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      // Generate session token
      const sessionToken = generateSessionToken();
      const sessionData = {
        username: user.username,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      };
      
      // Store session
      await USERS_KV.put(`session:${sessionToken}`, JSON.stringify(sessionData), {
        expirationTtl: 7 * 24 * 60 * 60 // 7 days in seconds
      });
      
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `usage:${username}:${today}`;
      const todayUsage = parseInt(await USERS_KV.get(usageKey) || '0');
      
      return new Response(JSON.stringify({ 
        success: true,
        sessionToken,
        user: {
          username: user.username,
          name: user.name,
          email: user.email,
          tier: user.tier,
          status: user.status,
          todayUsage,
          remainingToday: USER_TIERS[user.tier].dailyLimit - todayUsage,
          daysUntilExpiry: getDaysUntilExpiry(user.lastPaymentDate)
        }
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    async function handleVerifySession(request, env) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'No session token provided' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const sessionToken = authHeader.substring(7);
      const sessionData = await USERS_KV.get(`session:${sessionToken}`);
      
      if (!sessionData) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const session = JSON.parse(sessionData);
      
      // Check if session is expired
      if (new Date(session.expiresAt) < new Date()) {
        await USERS_KV.delete(`session:${sessionToken}`);
        return new Response(JSON.stringify({ error: 'Session expired' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      // Get user data
      const userData = await USERS_KV.get(`user:${session.username}`);
      if (!userData) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const user = JSON.parse(userData);
      
      if (!isSubscriptionActive(user.lastPaymentDate)) {
        return new Response(JSON.stringify({ error: 'Your subscription has expired. Please renew to continue.' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `usage:${session.username}:${today}`;
      const todayUsage = parseInt(await USERS_KV.get(usageKey) || '0');
      
      return new Response(JSON.stringify({ 
        success: true,
        user: {
          username: user.username,
          name: user.name,
          email: user.email,
          tier: user.tier,
          status: user.status,
          todayUsage,
          remainingToday: USER_TIERS[user.tier].dailyLimit - todayUsage,
          daysUntilExpiry: getDaysUntilExpiry(user.lastPaymentDate)
        }
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
    
    async function handleLogout(request, env) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const sessionToken = authHeader.substring(7);
      await USERS_KV.delete(`session:${sessionToken}`);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }

    function generateSessionToken() {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let token = '';
      for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return token;
    }
    
    // ====================================
    // INVENTORY MANAGEMENT
    // ====================================
    
    async function handleCheckAvailability(env) {
      // Check cache first
      const cacheKey = 'availability:all';
      const cachedData = await USERS_KV.get(cacheKey);
      
      if (cachedData) {
        const cached = JSON.parse(cachedData);
        // Cache is valid for 5 minutes
        if (new Date(cached.timestamp) > new Date(Date.now() - 5 * 60 * 1000)) {
          return new Response(JSON.stringify({ availability: cached.data }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }
      }
      
      try {
        const availability = {};
        
        for (const [countryKey, sheetName] of Object.entries(COUNTRY_SHEETS)) {
          try {
            const response = await fetch(`${SHEETDB_API_URL}?sheet=${encodeURIComponent(sheetName)}`);
            
            if (!response.ok) {
              console.log(`Failed to fetch sheet for ${sheetName}`);
              continue;
            }
            
            const data = await response.json();
            
            if (data && Array.isArray(data) && data.length > 0) {
              availability[countryKey] = data.length;
            }
          } catch (sheetError) {
            console.error(`Error fetching ${sheetName} sheet:`, sheetError);
          }
        }
        
        // Cache the result
        await USERS_KV.put(cacheKey, JSON.stringify({
          data: availability,
          timestamp: new Date().toISOString()
        }), {
          expirationTtl: 300 // 5 minutes
        });
        
        return new Response(JSON.stringify({ availability }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error checking availability:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch availability', 
          details: error.message 
        }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }
    
    
    // ====================================
    // ORDER MANAGEMENT
    // ====================================
    
    async function handleCreateOrder(request, env) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const body = await request.json();
      const { items, username, customerInfo } = body;
      
      // Validate user
      const userData = await USERS_KV.get(`user:${username}`);
      if (!userData) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const user = JSON.parse(userData);
      
      // Check user status and subscription
      if (user.status !== 'active') {
        return new Response(JSON.stringify({ error: 'User account is not active' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      if (!isSubscriptionActive(user.lastPaymentDate)) {
        return new Response(JSON.stringify({ error: 'Your subscription has expired. Please renew to continue.' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      // Calculate total accounts
      const totalAccounts = items.reduce((sum, item) => sum + item.quantity, 0);
      
      // Check daily limit
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `usage:${username}:${today}`;
      const todayUsage = parseInt(await USERS_KV.get(usageKey) || '0');
      const tierLimit = USER_TIERS[user.tier].dailyLimit;
      
      if (todayUsage + totalAccounts > tierLimit) {
        return new Response(JSON.stringify({ 
          error: `Daily limit exceeded. You have ${tierLimit - todayUsage} accounts remaining today.`,
          limit: tierLimit,
          used: todayUsage,
          remaining: tierLimit - todayUsage
        }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      // Create order
      const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const orderData = {
        orderId,
        items,
        username,
        customerInfo,
        totalAccounts,
        totalPrice: totalAccounts * ACCOUNT_PRICE,
        status: 'pending',
        userTier: user.tier,
        createdAt: new Date().toISOString(),
        accountData: []
      };
      
      // Store order
      await ORDERS_KV.put(orderId, JSON.stringify(orderData), { expirationTtl: 86400 * 30 });
      
      // Update daily usage
      await USERS_KV.put(usageKey, String(todayUsage + totalAccounts), { expirationTtl: 86400 });
      
      // Auto-fulfill order
      try {
        const fulfillResult = await fulfillOrder(orderData, env);
        if (fulfillResult.success) {
          orderData.status = 'fulfilled';
          orderData.fulfilledAt = new Date().toISOString();
          orderData.accounts = fulfillResult.accounts;
          orderData.accountData = fulfillResult.accountData;
          await ORDERS_KV.put(orderId, JSON.stringify(orderData));
        }
      } catch (fulfillError) {
        console.error('Auto-fulfillment failed:', fulfillError);
      }
      
      return new Response(JSON.stringify({ 
        orderId,
        totalAccounts,
        totalPrice: totalAccounts * ACCOUNT_PRICE,
        remainingToday: tierLimit - (todayUsage + totalAccounts),
        message: 'Order created successfully'
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
    
    async function fulfillOrder(order, env) {
      const fulfilledAccounts = [];
      const accountData = [];
      
      for (const item of order.items) {
        const region = item.region.toLowerCase();
        const sheetName = COUNTRY_SHEETS[region];
        
        if (!sheetName) {
          throw new Error(`Unknown region: ${region}`);
        }
        
        const response = await fetch(`${SHEETDB_API_URL}?sheet=${encodeURIComponent(sheetName)}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ${sheetName} sheet`);
        }
        
        const data = await response.json();
        
        if (!data || data.length < item.quantity) {
          throw new Error(`Not enough accounts in ${sheetName}. Available: ${data.length}, Requested: ${item.quantity}`);
        }
        
        const accountsToMove = [];
        
        for (let i = 0; i < item.quantity && i < data.length; i++) {
          const row = data[i];
          fulfilledAccounts.push({
            region: region,
            username: row.Username,
            passTiktok: row.PassTiktok,
            mail: row.Mail,
            cookies: row.Cookies,
            code2fa: row.Code2fa,
            country: sheetName
          });
          
          accountData.push({
            ...row,
            originalSheet: sheetName
          });
          
          accountsToMove.push(row.Username);
        }
        
        // Move accounts to Sold sheet
        for (const username of accountsToMove) {
          try {
            const fullRowData = data.find(row => row.Username === username);
            
            const soldData = {
              ...fullRowData,
              SoldTo: order.username,
              SoldToName: order.customerInfo?.name || 'Unknown',
              SoldDate: new Date().toISOString(),
              OrderId: order.orderId
            };
            
            await fetch(`${SHEETDB_API_URL}?sheet=Sold`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: soldData })
            });
            
            await fetch(
              `${SHEETDB_API_URL}/Username/${encodeURIComponent(username)}?sheet=${encodeURIComponent(sheetName)}`,
              {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
              }
            );
          } catch (error) {
            console.error(`Error processing account ${username}:`, error);
          }
        }
      }
      
      return {
        success: true,
        accounts: fulfilledAccounts,
        accountData: accountData
      };
    }
    
    async function handleGetUserOrders(request, env) {
      const url = new URL(request.url);
      const username = decodeURIComponent(url.pathname.split('/').pop());
      
      if (!username) {
        return new Response(JSON.stringify({ error: 'Username required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const ordersList = await ORDERS_KV.list({ prefix: 'ORDER-' });
        const userOrders = [];
        
        for (const key of ordersList.keys) {
          const orderData = await ORDERS_KV.get(key.name);
          if (orderData) {
            const order = JSON.parse(orderData);
            if (order.username === username) {
              userOrders.push({
                orderId: order.orderId,
                status: order.status,
                createdAt: order.createdAt,
                totalAccounts: order.totalAccounts,
                totalPrice: order.totalPrice,
                items: order.items,
                fulfilledAt: order.fulfilledAt
              });
            }
          }
        }
        
        userOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        return new Response(JSON.stringify({ orders: userOrders }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error fetching user orders:', error);
        return new Response(JSON.stringify({ error: 'Failed to get orders' }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }
    
    async function handleGetOrderStatus(request, env) {
      const url = new URL(request.url);
      const orderId = url.pathname.split('/').pop();
      
      if (!orderId) {
        return new Response(JSON.stringify({ error: 'Order ID required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const orderData = await ORDERS_KV.get(orderId);
        if (!orderData) {
          return new Response(JSON.stringify({ error: 'Order not found' }), {
            status: 404,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }
        
        const order = JSON.parse(orderData);
        
        const response = {
          order: {
            orderId: order.orderId,
            status: order.status,
            createdAt: order.createdAt,
            totalAccounts: order.totalAccounts,
            items: order.items,
            totalPrice: order.totalPrice
          }
        };
        
        if (order.status === 'fulfilled' && order.accounts) {
          response.order.accounts = order.accounts;
          response.order.fulfilledAt = order.fulfilledAt;
        }
        
        return new Response(JSON.stringify(response), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error fetching order status:', error);
        return new Response(JSON.stringify({ error: 'Failed to get order status' }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // ====================================
    // EMAIL CHECKING
    // ====================================
    
    async function handleCheckEmail(request, env) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const body = await request.json();
      const { email, username } = body;
      
      if (!email || !username) {
        return new Response(JSON.stringify({ error: 'Email and username required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const userData = await USERS_KV.get(`user:${username}`);
      if (!userData) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const user = JSON.parse(userData);
      
      if (!isSubscriptionActive(user.lastPaymentDate)) {
        return new Response(JSON.stringify({ error: 'Your subscription has expired' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const apiUrl = `${EMAIL_API_URL}?api_key=${EMAIL_API_KEY}&mail=${encodeURIComponent(email)}&all=true`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error('Failed to check email');
        }
        
        const emailContent = await response.text();
        
        let parsedContent;
        try {
          parsedContent = JSON.parse(emailContent);
        } catch (e) {
          parsedContent = null;
        }
        
        const checkLog = {
          username,
          email,
          checkedAt: new Date().toISOString(),
          success: true
        };
        
        const logKey = `email-check:${username}:${Date.now()}`;
        await USERS_KV.put(logKey, JSON.stringify(checkLog), { expirationTtl: 86400 * 30 });
        
        return new Response(JSON.stringify({ 
          success: true,
          content: emailContent,
          parsed: parsedContent
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Email check error:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to check email',
          details: error.message 
        }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // ====================================
    // REFUND MANAGEMENT
    // ====================================
    
    async function handleRefundRequest(request, env) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const body = await request.json();
      const { username, orderId, accountUsername, reason } = body;
      
      if (!username || !orderId || !accountUsername || !reason) {
        return new Response(JSON.stringify({ error: 'All fields are required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const userData = await USERS_KV.get(`user:${username}`);
      if (!userData) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const user = JSON.parse(userData);
      const userRefundLimit = USER_TIERS[user.tier].refundLimit;
      
      // Check refund limits
      const refundsList = await REFUND_REQUESTS_KV.list({ prefix: `refund:${username}:` });
      const approvedRefunds = [];
      
      for (const key of refundsList.keys) {
        const refundData = await REFUND_REQUESTS_KV.get(key.name);
        if (refundData) {
          const refund = JSON.parse(refundData);
          if (refund.status === 'approved') {
            approvedRefunds.push(refund);
          }
        }
      }
      
      if (approvedRefunds.length >= userRefundLimit) {
        return new Response(JSON.stringify({ 
          error: `Refund limit reached. ${user.tier} tier allows ${userRefundLimit} refunds.`,
          used: approvedRefunds.length,
          limit: userRefundLimit
        }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const orderData = await ORDERS_KV.get(orderId);
      if (!orderData) {
        return new Response(JSON.stringify({ error: 'Order not found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const order = JSON.parse(orderData);
      
      if (order.username !== username) {
        return new Response(JSON.stringify({ error: 'Order does not belong to user' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      // Check 24-hour window
      const orderDate = new Date(order.createdAt);
      const now = new Date();
      const hoursDiff = Math.floor((now - orderDate) / (1000 * 60 * 60));
      
      if (hoursDiff > 24) {
        return new Response(JSON.stringify({ error: 'Refund requests must be made within 24 hours of order' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      if (order.status !== 'fulfilled') {
        return new Response(JSON.stringify({ error: 'Only fulfilled orders can be refunded' }), {
          status: 403,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const account = order.accounts.find(acc => acc.username === accountUsername);
      if (!account) {
        return new Response(JSON.stringify({ error: 'Account not found in order' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const existingRequestKey = `refund:${username}:${orderId}:${accountUsername}`;
      const existingRequest = await REFUND_REQUESTS_KV.get(existingRequestKey);
      
      if (existingRequest) {
        const existing = JSON.parse(existingRequest);
        if (existing.status === 'pending') {
          return new Response(JSON.stringify({ error: 'A refund request for this account is already pending' }), {
            status: 403,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }
      }
      
      const refundRequest = {
        id: existingRequestKey,
        username,
        orderId,
        accountUsername,
        accountDetails: account,
        reason,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        userTier: user.tier,
        customerName: user.name
      };
      
      await REFUND_REQUESTS_KV.put(existingRequestKey, JSON.stringify(refundRequest), { expirationTtl: 86400 * 30 });
      
      console.log(`New refund request from ${username} for order ${orderId}`);
      
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Refund request submitted successfully',
        refundId: existingRequestKey
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
    
    async function handleGetUserRefunds(request, env) {
      const url = new URL(request.url);
      const username = url.searchParams.get('username');
      
      if (!username) {
        return new Response(JSON.stringify({ error: 'Username required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const refundsList = await REFUND_REQUESTS_KV.list({ prefix: `refund:${username}:` });
        const refunds = [];
        
        for (const key of refundsList.keys) {
          const refundData = await REFUND_REQUESTS_KV.get(key.name);
          if (refundData) {
            refunds.push(JSON.parse(refundData));
          }
        }
        
        refunds.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
        
        const userData = await USERS_KV.get(`user:${username}`);
        const user = userData ? JSON.parse(userData) : null;
        const refundLimit = user ? USER_TIERS[user.tier].refundLimit : 0;
        
        const approvedCount = refunds.filter(r => r.status === 'approved').length;
        
        return new Response(JSON.stringify({ 
          refunds,
          limit: refundLimit,
          used: approvedCount,
          remaining: refundLimit - approvedCount
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error fetching user refunds:', error);
        return new Response(JSON.stringify({ error: 'Failed to get refunds' }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // ====================================
    // ADMIN USER MANAGEMENT
    // ====================================
    
    async function handleAdminUsers(request, env) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const usersList = await USERS_KV.list({ prefix: 'user:' });
      const users = [];
      
      for (const key of usersList.keys) {
        const userData = await USERS_KV.get(key.name);
        if (userData) {
          const user = JSON.parse(userData);
          const today = new Date().toISOString().split('T')[0];
          const usageKey = `usage:${user.username}:${today}`;
          const todayUsage = parseInt(await USERS_KV.get(usageKey) || '0');
          
          users.push({
            ...user,
            todayUsage,
            tierInfo: USER_TIERS[user.tier],
            daysUntilExpiry: getDaysUntilExpiry(user.lastPaymentDate),
            subscriptionActive: isSubscriptionActive(user.lastPaymentDate)
          });
        }
      }
      
      return new Response(JSON.stringify({ users }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
    
    async function handleCreateUser(request, env) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const body = await request.json();
      const { username, name, tier, password } = body;
      
      if (!username || !name || !tier || !password || !USER_TIERS[tier]) {
        return new Response(JSON.stringify({ error: 'All fields are required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const existingUser = await USERS_KV.get(`user:${username}`);
      if (existingUser) {
        return new Response(JSON.stringify({ error: 'Username already exists' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const hashedPassword = await hashPassword(password);
      
      const userData = {
        username,
        name,
        tier,
        password: hashedPassword,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastPaymentDate: new Date().toISOString(),
        totalOrders: 0,
        totalAccounts: 0
      };
      
      await USERS_KV.put(`user:${username}`, JSON.stringify(userData));
      
      return new Response(JSON.stringify({ 
        success: true,
        user: userData
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
    
    async function handleUpdateUser(request, env) {
      if (request.method !== 'PUT') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const body = await request.json();
      const { username, updates } = body;
      
      const userData = await USERS_KV.get(`user:${username}`);
      if (!userData) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const user = JSON.parse(userData);
      
      if (updates.password) {
        delete updates.password;
      }
      
      const updatedUser = { ...user, ...updates };
      
      await USERS_KV.put(`user:${username}`, JSON.stringify(updatedUser));
      
      return new Response(JSON.stringify({ 
        success: true,
        user: updatedUser
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
    
    async function handleResetPassword(request, env) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const body = await request.json();
      const { username } = body;
      
      const userData = await USERS_KV.get(`user:${username}`);
      if (!userData) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      const user = JSON.parse(userData);
      const newPassword = generateRandomPassword();
      const hashedPassword = await hashPassword(newPassword);
      
      user.password = hashedPassword;
      await USERS_KV.put(`user:${username}`, JSON.stringify(user));
      
      return new Response(JSON.stringify({ 
        success: true,
        tempPassword: newPassword,
        message: `Password reset for ${username}. New password: ${newPassword}`
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
    
    async function handleDeleteUser(request, env) {
      if (request.method !== 'DELETE') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const url = new URL(request.url);
      const username = url.searchParams.get('username');
      
      if (!username) {
        return new Response(JSON.stringify({ error: 'Username required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      await USERS_KV.delete(`user:${username}`);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
    
    // ====================================
    // ADMIN ORDER MANAGEMENT
    // ====================================
    
    async function handleGetOrders(request, env) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const ordersList = await ORDERS_KV.list({ prefix: 'ORDER-' });
      const orders = [];
      
      for (const key of ordersList.keys) {
        const orderData = await ORDERS_KV.get(key.name);
        if (orderData) {
          orders.push(JSON.parse(orderData));
        }
      }
      
      orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return new Response(JSON.stringify({ orders }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
    
    async function handleFulfillOrder(request, env) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const body = await request.json();
      const { orderId } = body;
      
      try {
        const orderData = await ORDERS_KV.get(orderId);
        if (!orderData) {
          throw new Error('Order not found');
        }
        
        const order = JSON.parse(orderData);
        const fulfillResult = await fulfillOrder(order, env);
        
        order.status = 'fulfilled';
        order.fulfilledAt = new Date().toISOString();
        order.accounts = fulfillResult.accounts;
        order.accountData = fulfillResult.accountData;
        
        await ORDERS_KV.put(orderId, JSON.stringify(order));
        
        const userData = await USERS_KV.get(`user:${order.username}`);
        if (userData) {
          const user = JSON.parse(userData);
          user.totalOrders = (user.totalOrders || 0) + 1;
          user.totalAccounts = (user.totalAccounts || 0) + order.totalAccounts;
          await USERS_KV.put(`user:${order.username}`, JSON.stringify(user));
        }
        
        return new Response(JSON.stringify({ 
          success: true,
          orderId,
          accounts: fulfillResult.accounts,
          message: 'Order fulfilled successfully'
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fulfill order: ' + error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }
    
    async function handleRevertOrder(request, env) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const body = await request.json();
      const { orderId } = body;
      
      try {
        const orderData = await ORDERS_KV.get(orderId);
        if (!orderData) {
          throw new Error('Order not found');
        }
        
        const order = JSON.parse(orderData);
        
        if (order.status !== 'fulfilled') {
          throw new Error('Only fulfilled orders can be reverted');
        }
        
        if (!order.accountData || order.accountData.length === 0) {
          throw new Error('No account data available for reversion');
        }
        
        let revertedCount = 0;
        for (const account of order.accountData) {
          try {
            await fetch(`${SHEETDB_API_URL}/Username/${encodeURIComponent(account.Username)}?sheet=Sold`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
            });
            
            const { originalSheet, ...accountDataWithoutSheet } = account;
            await fetch(`${SHEETDB_API_URL}?sheet=${encodeURIComponent(originalSheet)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: accountDataWithoutSheet })
            });
            
            revertedCount++;
          } catch (error) {
            console.error(`Failed to revert account ${account.Username}:`, error);
          }
        }
        
        order.status = 'reverted';
        order.revertedAt = new Date().toISOString();
        order.revertedCount = revertedCount;
        await ORDERS_KV.put(orderId, JSON.stringify(order));
        
        const today = new Date().toISOString().split('T')[0];
        const usageKey = `usage:${order.username}:${today}`;
        const currentUsage = parseInt(await USERS_KV.get(usageKey) || '0');
        const newUsage = Math.max(0, currentUsage - order.totalAccounts);
        await USERS_KV.put(usageKey, String(newUsage), { expirationTtl: 86400 });
        
        const userData = await USERS_KV.get(`user:${order.username}`);
        if (userData) {
          const user = JSON.parse(userData);
          user.totalOrders = Math.max(0, (user.totalOrders || 0) - 1);
          user.totalAccounts = Math.max(0, (user.totalAccounts || 0) - order.totalAccounts);
          await USERS_KV.put(`user:${order.username}`, JSON.stringify(user));
        }
        
        return new Response(JSON.stringify({ 
          success: true,
          message: `Order reverted successfully. ${revertedCount} accounts restored.`,
          revertedCount
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to revert order: ' + error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // ====================================
    // ADMIN STATISTICS
    // ====================================
    
    async function handleGetStats(request, env) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const usersList = await USERS_KV.list({ prefix: 'user:' });
      const tierCounts = { bronze: 0, silver: 0, gold: 0 };
      let totalUsers = 0;
      let activeSubscriptions = 0;
      let expiringToday = 0;
      
      for (const key of usersList.keys) {
        const userData = await USERS_KV.get(key.name);
        if (userData) {
          const user = JSON.parse(userData);
          tierCounts[user.tier]++;
          totalUsers++;
          
          if (isSubscriptionActive(user.lastPaymentDate)) {
            activeSubscriptions++;
            const daysLeft = getDaysUntilExpiry(user.lastPaymentDate);
            if (daysLeft === 0) {
              expiringToday++;
            }
          }
        }
      }
      
      const ordersList = await ORDERS_KV.list({ prefix: 'ORDER-' });
      const today = new Date().toISOString().split('T')[0];
      let todayOrders = 0;
      let totalBCsSold = 0;
      let totalBCsReverted = 0;
      let totalBCsRefunded = 0;
      
      for (const key of ordersList.keys) {
        const orderData = await ORDERS_KV.get(key.name);
        if (orderData) {
          const order = JSON.parse(orderData);
          
          if (order.createdAt.startsWith(today)) {
            todayOrders++;
          }
          
          if (order.status === 'fulfilled') {
            totalBCsSold += order.totalAccounts;
            if (order.refundedAccounts) {
              totalBCsRefunded += order.refundedAccounts;
              totalBCsSold -= order.refundedAccounts;
            }
          } else if (order.status === 'reverted') {
            totalBCsReverted += order.totalAccounts;
          }
        }
      }
      
      let pendingRefunds = 0;
      let approvedRefunds = 0;
      let rejectedRefunds = 0;
      
      if (REFUND_REQUESTS_KV) {
        const refundsList = await REFUND_REQUESTS_KV.list({ prefix: 'refund:' });
        
        for (const key of refundsList.keys) {
          const refundData = await REFUND_REQUESTS_KV.get(key.name);
          if (refundData) {
            const refund = JSON.parse(refundData);
            if (refund.status === 'pending') pendingRefunds++;
            else if (refund.status === 'approved') approvedRefunds++;
            else if (refund.status === 'rejected') rejectedRefunds++;
          }
        }
      }
      
      return new Response(JSON.stringify({ 
        stats: {
          totalUsers,
          activeSubscriptions,
          expiringToday,
          tierCounts,
          todayOrders,
          totalBCsSold,
          totalBCsReverted,
          totalBCsRefunded,
          pendingRefunds,
          approvedRefunds,
          rejectedRefunds,
          potentialMonthlyRevenue: (tierCounts.bronze * USER_TIERS.bronze.price) + 
                                   (tierCounts.silver * USER_TIERS.silver.price) + 
                                   (tierCounts.gold * USER_TIERS.gold.price)
        }
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
    
    // ====================================
    // ADMIN REFUND MANAGEMENT
    // ====================================
    
    async function handleGetRefundRequests(request, env) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const url = new URL(request.url);
      const status = url.searchParams.get('status') || 'all';
      
      try {
        const refundsList = await REFUND_REQUESTS_KV.list({ prefix: 'refund:' });
        const refunds = [];
        
        for (const key of refundsList.keys) {
          const refundData = await REFUND_REQUESTS_KV.get(key.name);
          if (refundData) {
            const refund = JSON.parse(refundData);
            if (status === 'all' || refund.status === status) {
              refunds.push(refund);
            }
          }
        }
        
        refunds.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
        
        return new Response(JSON.stringify({ refunds }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error fetching refund requests:', error);
        return new Response(JSON.stringify({ error: 'Failed to get refund requests' }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }
    
    async function handleApproveRefund(request, env) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const body = await request.json();
      const { refundId, adminUsername } = body;
      
      if (!refundId || !adminUsername) {
        return new Response(JSON.stringify({ error: 'Refund ID and admin username required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const refundData = await REFUND_REQUESTS_KV.get(refundId);
        if (!refundData) {
          throw new Error('Refund request not found');
        }
        
        const refund = JSON.parse(refundData);
        
        if (refund.status !== 'pending') {
          throw new Error(`Refund request is already ${refund.status}`);
        }
        
        refund.status = 'approved';
        refund.approvedBy = adminUsername;
        refund.approvedAt = new Date().toISOString();
        
        const updateResponse = await fetch(
          `${SHEETDB_API_URL}/Username/${encodeURIComponent(refund.accountUsername)}?sheet=Sold`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: {
                Status: 'Refunded',
                RefundDate: new Date().toISOString()
              }
            })
          }
        );
        
        if (!updateResponse.ok) {
          console.error('Failed to update Sold sheet status');
        }
        
        const orderData = await ORDERS_KV.get(refund.orderId);
        if (orderData) {
          const order = JSON.parse(orderData);
          
          if (order.accounts) {
            const accountIndex = order.accounts.findIndex(acc => acc.username === refund.accountUsername);
            if (accountIndex !== -1) {
              order.accounts[accountIndex].refunded = true;
              order.accounts[accountIndex].refundedAt = new Date().toISOString();
            }
          }
          
          order.refundedAccounts = (order.refundedAccounts || 0) + 1;
          
          await ORDERS_KV.put(refund.orderId, JSON.stringify(order));
        }
        
        await REFUND_REQUESTS_KV.put(refundId, JSON.stringify(refund));
        
        console.log(`Refund approved by ${adminUsername} for ${refund.username}`);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Refund approved successfully'
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to approve refund: ' + error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }
    
    async function handleRejectRefund(request, env) {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
      }
      
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${ADMIN_API_KEY}`) {
        return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
      }
      
      const body = await request.json();
      const { refundId, adminUsername, rejectionReason } = body;
      
      if (!refundId || !adminUsername || !rejectionReason) {
        return new Response(JSON.stringify({ error: 'All fields are required' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const refundData = await REFUND_REQUESTS_KV.get(refundId);
        if (!refundData) {
          throw new Error('Refund request not found');
        }
        
        const refund = JSON.parse(refundData);
        
        if (refund.status !== 'pending') {
          throw new Error(`Refund request is already ${refund.status}`);
        }
        
        refund.status = 'rejected';
        refund.rejectedBy = adminUsername;
        refund.rejectedAt = new Date().toISOString();
        refund.rejectionReason = rejectionReason;
        
        await REFUND_REQUESTS_KV.put(refundId, JSON.stringify(refund));
        
        console.log(`Refund rejected by ${adminUsername} for ${refund.username}`);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Refund rejected'
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to reject refund: ' + error.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // ====================================
    // PAGE HANDLERS
    // ====================================
    
    // Homepage handler is defined separately below
    // Admin panel handler is defined separately below
  }
};

//Admin Page UI
function handleAdminPanel() {
      const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TikTok Sales Admin Panel</title>
      <style>
        /* CSS Variables */
        :root {
          --bg-primary: #0a0a0a;
          --bg-secondary: #1a1a1a;
          --bg-tertiary: #252525;
          --bg-card: #1f1f1f;
          --text-primary: #ffffff;
          --text-secondary: #e0e0e0;
          --text-muted: #888888;
          --accent-primary: #667eea;
          --accent-secondary: #764ba2;
          --admin-accent: #f50057;
          --success: #4CAF50;
          --warning: #ff9800;
          --danger: #f44336;
          --info: #2196F3;
          --bronze: #CD7F32;
          --silver: #C0C0C0;
          --gold: #FFD700;
          --border-color: #333333;
          --border-radius: 12px;
          --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        /* Reset and Base */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: var(--bg-primary);
          color: var(--text-secondary);
          line-height: 1.6;
          overflow-x: hidden;
        }
        
        /* Animations */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        /* Layout */
        .admin-layout {
          display: flex;
          min-height: 100vh;
        }
        
        /* Sidebar */
        .sidebar {
          width: 280px;
          background: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          padding: 30px 20px;
          position: fixed;
          height: 100vh;
          overflow-y: auto;
          z-index: 100;
        }
        
        .sidebar-header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 1px solid var(--border-color);
        }
        
        .sidebar-header h1 {
          font-size: 1.8em;
          background: linear-gradient(135deg, var(--admin-accent), var(--accent-secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 10px;
        }
        
        .sidebar-header p {
          color: var(--text-muted);
          font-size: 0.9em;
        }
        
        /* Navigation */
        .nav-menu {
          list-style: none;
        }
        
        .nav-item {
          margin-bottom: 5px;
        }
        
        .nav-link {
          display: flex;
          align-items: center;
          padding: 12px 20px;
          color: var(--text-secondary);
          text-decoration: none;
          border-radius: 8px;
          transition: var(--transition);
          font-weight: 500;
          gap: 12px;
        }
        
        .nav-link:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          transform: translateX(5px);
        }
        
        .nav-link.active {
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          color: white;
        }
        
        .nav-icon {
          width: 20px;
          text-align: center;
        }
        
        /* Main Content */
        .main-content {
          flex: 1;
          margin-left: 280px;
          padding: 30px;
          animation: fadeIn 0.6s ease-out;
        }
        
        /* Header */
        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border-color);
        }
        
        .content-header h2 {
          font-size: 2.5em;
          font-weight: 700;
          color: var(--text-primary);
        }
        
        /* Cards */
        .card {
          background: var(--bg-secondary);
          border-radius: var(--border-radius);
          padding: 30px;
          margin-bottom: 30px;
          border: 1px solid var(--border-color);
          transition: var(--transition);
          position: relative;
          overflow: hidden;
        }
        
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }
        
        .card-title {
          font-size: 1.3em;
          font-weight: 600;
          color: var(--text-primary);
        }
        
        /* Stats Grid */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 25px;
          margin-bottom: 40px;
        }
        
        .stat-card {
          background: var(--bg-card);
          padding: 30px;
          border-radius: var(--border-radius);
          border: 1px solid var(--border-color);
          text-align: center;
          transition: var(--transition);
          position: relative;
          overflow: hidden;
        }
        
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
          transform: scaleX(0);
          transition: transform 0.3s ease;
        }
        
        .stat-card:hover::before {
          transform: scaleX(1);
        }
        
        .stat-card:hover {
          transform: translateY(-5px);
          border-color: var(--accent-primary);
        }
        
        .stat-icon {
          font-size: 3em;
          margin-bottom: 15px;
          opacity: 0.8;
        }
        
        .stat-label {
          color: var(--text-muted);
          font-size: 0.9em;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 10px;
        }
        
        .stat-value {
          font-size: 2.8em;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
        }
        
        .stat-change {
          margin-top: 10px;
          font-size: 0.9em;
          font-weight: 500;
        }
        
        .stat-change.positive {
          color: var(--success);
        }
        
        .stat-change.negative {
          color: var(--danger);
        }
        
        /* Tables */
        .table-container {
          background: var(--bg-secondary);
          border-radius: var(--border-radius);
          overflow: hidden;
          border: 1px solid var(--border-color);
        }
        
        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 25px 30px;
          border-bottom: 1px solid var(--border-color);
        }
        
        .table-search {
          position: relative;
          width: 300px;
        }
        
        .table-search input {
          width: 100%;
          padding: 10px 40px 10px 15px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 14px;
        }
        
        .table-search-icon {
          position: absolute;
          right: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        thead {
          background: var(--bg-tertiary);
        }
        
        th {
          padding: 18px 20px;
          text-align: left;
          font-weight: 600;
          color: var(--text-muted);
          font-size: 0.85em;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border-color);
        }
        
        td {
          padding: 18px 20px;
          border-bottom: 1px solid rgba(51, 51, 51, 0.5);
          color: var(--text-secondary);
        }
        
        tbody tr {
          transition: var(--transition);
        }
        
        tbody tr:hover {
          background: rgba(102, 126, 234, 0.05);
        }
        
        /* Badges */
        .badge {
          display: inline-block;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.8em;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .badge-bronze {
          background: var(--bronze);
          color: #333;
        }
        
        .badge-silver {
          background: var(--silver);
          color: #333;
        }
        
        .badge-gold {
          background: var(--gold);
          color: #333;
        }
        
        .badge-success {
          background: var(--success);
          color: white;
        }
        
        .badge-warning {
          background: var(--warning);
          color: white;
        }
        
        .badge-danger {
          background: var(--danger);
          color: white;
        }
        
        .badge-info {
          background: var(--info);
          color: white;
        }
        
        /* Buttons */
        .btn {
          display: inline-block;
          padding: 12px 24px;
          background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: var(--transition);
          text-decoration: none;
          text-align: center;
        }
        
        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }
        
        .btn:active {
          transform: translateY(0);
        }
        
        .btn:disabled {
          background: var(--text-muted);
          cursor: not-allowed;
          transform: none;
        }
        
        .btn-secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }
        
        .btn-secondary:hover {
          background: #333333;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }
        
        .btn-success {
          background: var(--success);
        }
        
        .btn-warning {
          background: var(--warning);
        }
        
        .btn-danger {
          background: var(--danger);
        }
        
        .btn-info {
          background: var(--info);
        }
        
        .btn-sm {
          padding: 8px 16px;
          font-size: 13px;
        }
        
        .btn-group {
          display: flex;
          gap: 8px;
        }
        
        /* Forms */
        .form-group {
          margin-bottom: 25px;
        }
        
        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: var(--text-secondary);
          font-size: 0.95em;
        }
        
        input[type="text"],
        input[type="password"],
        input[type="email"],
        input[type="number"],
        select,
        textarea {
          width: 100%;
          padding: 12px 16px;
          background: var(--bg-tertiary);
          border: 2px solid transparent;
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 15px;
          transition: var(--transition);
          font-family: inherit;
        }
        
        input:focus,
        select:focus,
        textarea:focus {
          outline: none;
          border-color: var(--accent-primary);
          background: var(--bg-primary);
        }
        
        /* Modal */
        .modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          z-index: 1000;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(5px);
        }
        
        .modal.active {
          display: flex;
          animation: fadeIn 0.3s ease-out;
        }
        
        .modal-content {
          background: var(--bg-secondary);
          padding: 40px;
          border-radius: var(--border-radius);
          max-width: 600px;
          width: 90%;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          border: 1px solid var(--border-color);
        }
        
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border-color);
        }
        
        .modal-header h3 {
          font-size: 1.6em;
          color: var(--text-primary);
        }
        
        .close-modal {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 28px;
          cursor: pointer;
          transition: var(--transition);
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        
        .close-modal:hover {
          color: var(--text-primary);
          background: var(--bg-tertiary);
        }
        
        /* Loading */
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px;
          color: var(--text-muted);
        }
        
        .loading::after {
          content: '';
          width: 24px;
          height: 24px;
          border: 3px solid var(--text-muted);
          border-top-color: transparent;
          border-radius: 50%;
          margin-left: 12px;
          animation: spin 0.8s linear infinite;
        }
        
        /* Status Messages */
        .toast {
          position: fixed;
          top: 30px;
          right: 30px;
          padding: 16px 24px;
          border-radius: 8px;
          font-weight: 500;
          z-index: 2000;
          animation: slideInRight 0.3s ease-out;
          display: none;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        
        .toast.show {
          display: block;
        }
        
        .toast.success {
          background: var(--success);
          color: white;
        }
        
        .toast.error {
          background: var(--danger);
          color: white;
        }
        
        .toast.info {
          background: var(--info);
          color: white;
        }
        
        /* Order Details */
        .order-details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .detail-item {
          background: var(--bg-tertiary);
          padding: 20px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
        }
        
        .detail-label {
          color: var(--text-muted);
          font-size: 0.85em;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        
        .detail-value {
          color: var(--text-primary);
          font-size: 1.1em;
          font-weight: 600;
        }
        
        /* Refund Request Card */
        .refund-card {
          background: var(--bg-tertiary);
          padding: 25px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          margin-bottom: 20px;
          transition: var(--transition);
        }
        
        .refund-card:hover {
          border-color: var(--accent-primary);
          transform: translateY(-2px);
        }
        
        .refund-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        
        .refund-info {
          flex: 1;
        }
        
        .refund-reason {
          background: var(--bg-secondary);
          padding: 15px;
          border-radius: 8px;
          margin: 15px 0;
          border-left: 4px solid var(--warning);
        }
        
        /* Tier Selection */
        .tier-selector {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-bottom: 25px;
        }
        
        .tier-option {
          background: var(--bg-tertiary);
          padding: 20px;
          border-radius: 8px;
          border: 2px solid var(--border-color);
          text-align: center;
          cursor: pointer;
          transition: var(--transition);
        }
        
        .tier-option:hover {
          border-color: var(--accent-primary);
          transform: translateY(-2px);
        }
        
        .tier-option.selected {
          border-color: var(--accent-primary);
          background: rgba(102, 126, 234, 0.1);
        }
        
        .tier-option h4 {
          margin-bottom: 10px;
          font-size: 1.2em;
        }
        
        .tier-option.bronze h4 { color: var(--bronze); }
        .tier-option.silver h4 { color: var(--silver); }
        .tier-option.gold h4 { color: var(--gold); }
        
        .tier-details {
          color: var(--text-muted);
          font-size: 0.9em;
        }
        
        /* Password Display */
        .password-display {
          background: var(--bg-tertiary);
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          margin-top: 20px;
          border: 2px solid var(--success);
        }
        
        .password-display code {
          display: block;
          background: var(--bg-primary);
          padding: 15px;
          border-radius: 6px;
          font-size: 1.3em;
          color: var(--success);
          margin: 15px 0;
          font-family: 'Courier New', monospace;
          letter-spacing: 2px;
        }
        
        /* Responsive */
        @media (max-width: 1024px) {
          .sidebar {
            transform: translateX(-100%);
            transition: transform 0.3s ease;
          }
          
          .sidebar.open {
            transform: translateX(0);
          }
          
          .main-content {
            margin-left: 0;
          }
          
          .mobile-menu-toggle {
            display: block;
          }
        }
        
        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          
          .content-header {
            flex-direction: column;
            gap: 20px;
          }
          
          .table-container {
            overflow-x: auto;
          }
          
          table {
            min-width: 600px;
          }
          
          .btn-group {
            flex-direction: column;
          }
        }
        
        /* Mobile Menu Toggle */
        .mobile-menu-toggle {
          display: none;
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 101;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
        }
        
        /* Overlay */
        .sidebar-overlay {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 99;
        }
        
        .sidebar-overlay.active {
          display: block;
        }
        
        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 60px;
          color: var(--text-muted);
        }
        
        .empty-state-icon {
          font-size: 4em;
          opacity: 0.3;
          margin-bottom: 20px;
        }
        
        .empty-state-text {
          font-size: 1.1em;
          margin-bottom: 20px;
        }
        
        /* Utility Classes */
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-muted { color: var(--text-muted); }
        .mt-10 { margin-top: 10px; }
        .mt-20 { margin-top: 20px; }
        .mt-30 { margin-top: 30px; }
        .mb-10 { margin-bottom: 10px; }
        .mb-20 { margin-bottom: 20px; }
        .mb-30 { margin-bottom: 30px; }
        .hidden { display: none !important; }
      </style>
    </head>
    <body>
      <div class="admin-layout">
        <!-- Mobile Menu Toggle -->
        <button class="mobile-menu-toggle" onclick="toggleSidebar()">
          <span style="font-size: 24px;">☰</span>
        </button>
        
        <!-- Sidebar Overlay -->
        <div class="sidebar-overlay" onclick="closeSidebar()"></div>
        
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-header">
            <h1>Admin Panel</h1>
            <p>TikTok Sales Management</p>
          </div>
          
          <nav>
            <ul class="nav-menu">
              <li class="nav-item">
                <a href="#" class="nav-link active" onclick="showSection('dashboard')">
                  <span class="nav-icon">📊</span>
                  Dashboard
                </a>
              </li>
              <li class="nav-item">
                <a href="#" class="nav-link" onclick="showSection('users')">
                  <span class="nav-icon">👥</span>
                  Users
                </a>
              </li>
              <li class="nav-item">
                <a href="#" class="nav-link" onclick="showSection('orders')">
                  <span class="nav-icon">📦</span>
                  Orders
                </a>
              </li>
              <li class="nav-item">
                <a href="#" class="nav-link" onclick="showSection('refunds')">
                  <span class="nav-icon">💸</span>
                  Refunds
                </a>
              </li>
            </ul>
          </nav>
          
          <div style="position: absolute; bottom: 30px; left: 20px; right: 20px;">
            <button onclick="logout()" class="btn btn-danger" style="width: 100%;">
              Sign Out
            </button>
          </div>
        </aside>
        
        <!-- Main Content -->
        <main class="main-content">
          <!-- Auth Section -->
          <div id="authSection" class="card" style="max-width: 500px; margin: 100px auto;">
            <h2 class="text-center mb-30">Admin Authentication</h2>
            <div class="form-group">
              <label class="form-label">Admin API Key</label>
              <input type="password" id="apiKey" placeholder="Enter your API key">
            </div>
            <button onclick="authenticate()" class="btn" style="width: 100%;">
              Authenticate
            </button>
          </div>
          
          <!-- Admin Panel -->
          <div id="adminPanel" class="hidden">
            <!-- Dashboard Section -->
            <section id="dashboardSection" class="section active">
              <div class="content-header">
                <h2>Dashboard Overview</h2>
                <button onclick="refreshStats()" class="btn btn-secondary">
                  Refresh Stats
                </button>
              </div>
              
              <div class="stats-grid" id="statsGrid">
                <div class="loading">Loading statistics</div>
              </div>
              
              <!-- Recent Activity -->
              <div class="card">
                <div class="card-header">
                  <h3 class="card-title">Recent Activity</h3>
                </div>
                <div id="recentActivity">
                  <div class="loading">Loading activity</div>
                </div>
              </div>
            </section>
            
            <!-- Users Section -->
            <section id="usersSection" class="section hidden">
              <div class="content-header">
                <h2>User Management</h2>
                <button onclick="showCreateUserModal()" class="btn">
                  + Create User
                </button>
              </div>
              
              <div class="table-container">
                <div class="table-header">
                  <div class="table-search">
                    <input type="text" id="userSearch" placeholder="Search users..." onkeyup="filterUsers()">
                    <span class="table-search-icon">🔍</span>
                  </div>
                  <select id="userFilter" onchange="filterUsers()" style="width: 150px;">
                    <option value="">All Tiers</option>
                    <option value="bronze">Bronze</option>
                    <option value="silver">Silver</option>
                    <option value="gold">Gold</option>
                  </select>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Name</th>
                      <th>Tier</th>
                      <th>Status</th>
                      <th>Subscription</th>
                      <th>Usage Today</th>
                      <th>Total Orders</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="usersTableBody">
                    <tr><td colspan="8" class="loading">Loading users</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
            
            <!-- Orders Section -->
            <section id="ordersSection" class="section hidden">
              <div class="content-header">
                <h2>Order Management</h2>
                <div style="display: flex; gap: 10px;">
                  <select id="orderFilter" onchange="filterOrders()" style="width: 150px;">
                    <option value="">All Orders</option>
                    <option value="pending">Pending</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="reverted">Reverted</option>
                  </select>
                </div>
              </div>
              
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>User</th>
                      <th>Tier</th>
                      <th>Accounts</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody id="ordersTableBody">
                    <tr><td colspan="8" class="loading">Loading orders</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
            
            <!-- Refunds Section -->
            <section id="refundsSection" class="section hidden">
              <div class="content-header">
                <h2>Refund Requests</h2>
                <select id="refundFilter" onchange="loadRefundRequests()" style="width: 150px;">
                  <option value="all">All Requests</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              <div id="refundsList">
                <div class="loading">Loading refund requests</div>
              </div>
            </section>
          </div>
        </main>
      </div>
      
      <!-- Create User Modal -->
      <div id="createUserModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Create New User</h3>
            <button class="close-modal" onclick="closeModal('createUserModal')">&times;</button>
          </div>
          <form onsubmit="createUser(event)">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" id="newUsername" required pattern="[a-zA-Z0-9_]{3,20}">
            </div>
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" id="newName" required>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" id="newPassword" required minlength="6">
            </div>
            <div class="form-group">
              <label class="form-label">Select Tier</label>
              <div class="tier-selector">
                <div class="tier-option" onclick="selectTier('bronze')">
                  <h4>Bronze</h4>
                  <div class="tier-details">
                    25 accounts/day<br>
                    $175/month
                  </div>
                </div>
                <div class="tier-option" onclick="selectTier('silver')">
                  <h4>Silver</h4>
                  <div class="tier-details">
                    50 accounts/day<br>
                    $325/month
                  </div>
                </div>
                <div class="tier-option" onclick="selectTier('gold')">
                  <h4>Gold</h4>
                  <div class="tier-details">
                    100 accounts/day<br>
                    $600/month
                  </div>
                </div>
              </div>
              <input type="hidden" id="newTier" required>
            </div>
            <button type="submit" class="btn" style="width: 100%;">Create User</button>
          </form>
        </div>
      </div>
      
      <!-- Password Reset Modal -->
      <div id="passwordModal" class="modal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Password Reset</h3>
            <button class="close-modal" onclick="closeModal('passwordModal')">&times;</button>
          </div>
          <div id="passwordContent"></div>
        </div>
      </div>
      
      <!-- Toast Notification -->
      <div id="toast" class="toast"></div>
      
      <script>
        // Global Variables
        let API_KEY = '';
        let currentSection = 'dashboard';
        let allUsers = [];
        let allOrders = [];
        
        // Check saved API key on load
        window.addEventListener('load', () => {
          const savedKey = localStorage.getItem('adminApiKey');
          if (savedKey) {
            API_KEY = savedKey;
            showAdminPanel();
          }
        });
        
        // Authenticate
        function authenticate() {
          const apiKey = document.getElementById('apiKey').value;
          if (!apiKey) {
            showToast('Please enter API key', 'error');
            return;
          }
          
          API_KEY = apiKey;
          localStorage.setItem('adminApiKey', API_KEY);
          showAdminPanel();
        }
        
        // Show Admin Panel
        function showAdminPanel() {
          document.getElementById('authSection').classList.add('hidden');
          document.getElementById('adminPanel').classList.remove('hidden');
          loadInitialData();
        }
        
        // Load Initial Data
        function loadInitialData() {
          loadStats();
          loadUsers();
          loadOrders();
        }
        
        // Show Section
        function showSection(section) {
          // Update nav
          document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
          });
          event.target.classList.add('active');
          
          // Hide all sections
          document.querySelectorAll('.section').forEach(sec => {
            sec.classList.add('hidden');
          });
          
          // Show selected section
          document.getElementById(section + 'Section').classList.remove('hidden');
          currentSection = section;
          
          // Load section data
          if (section === 'dashboard') loadStats();
          if (section === 'users') loadUsers();
          if (section === 'orders') loadOrders();
          if (section === 'refunds') loadRefundRequests();
          
          // Close mobile sidebar
          closeSidebar();
        }
        
        // Load Stats
        async function loadStats() {
          const statsGrid = document.getElementById('statsGrid');
          statsGrid.innerHTML = '<div class="loading">Loading statistics</div>';
          
          try {
            const response = await fetch('/api/admin/stats', {
              headers: { 'Authorization': 'Bearer ' + API_KEY }
            });
            
            if (!response.ok) throw new Error('Failed to load stats');
            
            const data = await response.json();
            const stats = data.stats;
            
            statsGrid.innerHTML = \`
              <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-label">Total Users</div>
                <div class="stat-value">\${stats.totalUsers}</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">✅</div>
                <div class="stat-label">Active Subscriptions</div>
                <div class="stat-value">\${stats.activeSubscriptions}</div>
                <div class="stat-change \${stats.activeSubscriptions > stats.totalUsers * 0.8 ? 'positive' : 'negative'}">
                  \${Math.round((stats.activeSubscriptions / stats.totalUsers) * 100)}% active
                </div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">⚠️</div>
                <div class="stat-label">Expiring Today</div>
                <div class="stat-value">\${stats.expiringToday}</div>
              </div>
              <div class="stat-card" style="border-color: var(--bronze);">
                <div class="stat-icon" style="color: var(--bronze);">🥉</div>
                <div class="stat-label">Bronze Users</div>
                <div class="stat-value">\${stats.tierCounts.bronze}</div>
              </div>
              <div class="stat-card" style="border-color: var(--silver);">
                <div class="stat-icon" style="color: var(--silver);">🥈</div>
                <div class="stat-label">Silver Users</div>
                <div class="stat-value">\${stats.tierCounts.silver}</div>
              </div>
              <div class="stat-card" style="border-color: var(--gold);">
                <div class="stat-icon" style="color: var(--gold);">🥇</div>
                <div class="stat-label">Gold Users</div>
                <div class="stat-value">\${stats.tierCounts.gold}</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">📦</div>
                <div class="stat-label">Today's Orders</div>
                <div class="stat-value">\${stats.todayOrders}</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">💳</div>
                <div class="stat-label">Accounts Sold</div>
                <div class="stat-value">\${stats.totalBCsSold}</div>
              </div>
              <div class="stat-card">
                <div class="stat-icon">💰</div>
                <div class="stat-label">Monthly Revenue</div>
                <div class="stat-value">$\${stats.potentialMonthlyRevenue.toLocaleString()}</div>
              </div>
              <div class="stat-card" style="border-color: var(--warning);">
                <div class="stat-icon" style="color: var(--warning);">⏳</div>
                <div class="stat-label">Pending Refunds</div>
                <div class="stat-value">\${stats.pendingRefunds || 0}</div>
              </div>
              <div class="stat-card" style="border-color: var(--danger);">
                <div class="stat-icon" style="color: var(--danger);">↩️</div>
                <div class="stat-label">Total Refunded</div>
                <div class="stat-value">\${stats.totalBCsRefunded}</div>
              </div>
              <div class="stat-card" style="border-color: #9C27B0;">
                <div class="stat-icon" style="color: #9C27B0;">🔄</div>
                <div class="stat-label">Reverted</div>
                <div class="stat-value">\${stats.totalBCsReverted}</div>
              </div>
            \`;
            
            // Load recent activity
            loadRecentActivity();
            
          } catch (error) {
            statsGrid.innerHTML = '<div class="empty-state"><p>Failed to load statistics</p></div>';
            showToast('Failed to load stats', 'error');
          }
        }
        
        // Load Recent Activity
        function loadRecentActivity() {
          const activity = document.getElementById('recentActivity');
          // Simulate recent activity - you can implement actual activity tracking
          activity.innerHTML = \`
            <div class="empty-state">
              <div class="empty-state-icon">📊</div>
              <p class="empty-state-text">Activity tracking coming soon</p>
            </div>
          \`;
        }
        
        // Load Users
        async function loadUsers() {
          const tbody = document.getElementById('usersTableBody');
          tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading users</td></tr>';
          
          try {
            const response = await fetch('/api/admin/users', {
              headers: { 'Authorization': 'Bearer ' + API_KEY }
            });
            
            if (!response.ok) throw new Error('Failed to load users');
            
            const data = await response.json();
            allUsers = data.users;
            displayUsers(allUsers);
            
          } catch (error) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">Failed to load users</td></tr>';
            showToast('Failed to load users', 'error');
          }
        }
        
        // Display Users
        function displayUsers(users) {
          const tbody = document.getElementById('usersTableBody');
          
          if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No users found</td></tr>';
            return;
          }
          
          tbody.innerHTML = users.map(user => {
            let subBadge = '';
            if (!user.subscriptionActive) {
              subBadge = '<span class="badge badge-danger">EXPIRED</span>';
            } else if (user.daysUntilExpiry === 0) {
              subBadge = '<span class="badge badge-warning">EXPIRES TODAY</span>';
            } else {
              subBadge = \`<span class="badge badge-success">\${user.daysUntilExpiry} days left</span>\`;
            }
            
            return \`
              <tr>
                <td>\${user.username}</td>
                <td>\${user.name}</td>
                <td><span class="badge badge-\${user.tier}">\${user.tier.toUpperCase()}</span></td>
                <td><span class="badge badge-\${user.status === 'active' ? 'success' : 'danger'}">\${user.status.toUpperCase()}</span></td>
                <td>\${subBadge}</td>
                <td>\${user.todayUsage} / \${user.tierInfo.dailyLimit}</td>
                <td>\${user.totalOrders || 0}</td>
                <td>
                  <div class="btn-group">
                    <button onclick="resetPassword('\${user.username}')" class="btn btn-warning btn-sm">Reset Pass</button>
                    <button onclick="updateSubscription('\${user.username}')" class="btn btn-info btn-sm">Update Sub</button>
                    <button onclick="deleteUser('\${user.username}')" class="btn btn-danger btn-sm">Delete</button>
                  </div>
                </td>
              </tr>
            \`;
          }).join('');
        }
        
        // Filter Users
        function filterUsers() {
          const search = document.getElementById('userSearch').value.toLowerCase();
          const tier = document.getElementById('userFilter').value;
          
          const filtered = allUsers.filter(user => {
            const matchesSearch = user.username.toLowerCase().includes(search) || 
                                 user.name.toLowerCase().includes(search);
            const matchesTier = !tier || user.tier === tier;
            return matchesSearch && matchesTier;
          });
          
          displayUsers(filtered);
        }
        
        // Load Orders
        async function loadOrders() {
          const tbody = document.getElementById('ordersTableBody');
          tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading orders</td></tr>';
          
          try {
            const response = await fetch('/api/admin/orders', {
              headers: { 'Authorization': 'Bearer ' + API_KEY }
            });
            
            if (!response.ok) throw new Error('Failed to load orders');
            
            const data = await response.json();
            allOrders = data.orders;
            displayOrders(allOrders);
            
          } catch (error) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">Failed to load orders</td></tr>';
            showToast('Failed to load orders', 'error');
          }
        }
        
        // Display Orders
        function displayOrders(orders) {
          const tbody = document.getElementById('ordersTableBody');
          
          if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No orders found</td></tr>';
            return;
          }
          
          tbody.innerHTML = orders.map(order => {
            const statusColors = {
              pending: 'warning',
              fulfilled: 'success',
              reverted: 'danger',
              refunded: 'info'
            };
            
            return \`
              <tr>
                <td style="font-size: 0.85em;">\${order.orderId}</td>
                <td>\${order.username}</td>
                <td><span class="badge badge-\${order.userTier}">\${order.userTier.toUpperCase()}</span></td>
                <td>\${order.totalAccounts}</td>
                <td>$\${order.totalPrice}</td>
                <td><span class="badge badge-\${statusColors[order.status]}">\${order.status.toUpperCase()}</span></td>
                <td>\${new Date(order.createdAt).toLocaleDateString()}</td>
                <td>
                  \${order.status === 'pending' ? 
                    \`<button onclick="fulfillOrder('\${order.orderId}')" class="btn btn-success btn-sm">Fulfill</button>\` :
                    order.status === 'fulfilled' ?
                    \`<button onclick="revertOrder('\${order.orderId}')" class="btn btn-warning btn-sm">Revert</button>\` :
                    ''
                  }
                </td>
              </tr>
            \`;
          }).join('');
        }
        
        // Filter Orders
        function filterOrders() {
          const status = document.getElementById('orderFilter').value;
          const filtered = status ? allOrders.filter(order => order.status === status) : allOrders;
          displayOrders(filtered);
        }
        
        // Load Refund Requests
        async function loadRefundRequests() {
          const refundsList = document.getElementById('refundsList');
          refundsList.innerHTML = '<div class="loading">Loading refund requests</div>';
          
          const filter = document.getElementById('refundFilter').value;
          
          try {
            const response = await fetch('/api/admin/refund-requests?status=' + filter, {
              headers: { 'Authorization': 'Bearer ' + API_KEY }
            });
            
            if (!response.ok) throw new Error('Failed to load refunds');
            
            const data = await response.json();
            
            if (!data.refunds || data.refunds.length === 0) {
              refundsList.innerHTML = \`
                <div class="empty-state">
                  <div class="empty-state-icon">💸</div>
                  <p class="empty-state-text">No refund requests found</p>
                </div>
              \`;
              return;
            }
            
            refundsList.innerHTML = data.refunds.map(refund => {
              const statusColors = {
                pending: 'warning',
                approved: 'success',
                rejected: 'danger'
              };
              
              return \`
                <div class="refund-card">
                  <div class="refund-header">
                    <div class="refund-info">
                      <h4>Refund Request #\${refund.id}</h4>
                      <p class="text-muted">\${new Date(refund.requestedAt).toLocaleString()}</p>
                      <p><strong>User:</strong> \${refund.username} (\${refund.customerName})</p>
                      <p><strong>Order:</strong> \${refund.orderId}</p>
                      <p><strong>Account:</strong> \${refund.accountUsername}</p>
                    </div>
                    <div>
                      <span class="badge badge-\${refund.userTier}">\${refund.userTier.toUpperCase()}</span>
                      <span class="badge badge-\${statusColors[refund.status]}" style="margin-left: 10px;">
                        \${refund.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div class="refund-reason">
                    <strong>Reason:</strong> \${refund.reason}
                  </div>
                  
                  \${refund.status === 'pending' ? \`
                    <div class="btn-group mt-20">
                      <button onclick="approveRefund('\${refund.id}')" class="btn btn-success">Approve</button>
                      <button onclick="rejectRefund('\${refund.id}')" class="btn btn-danger">Reject</button>
                    </div>
                  \` : \`
                    <div class="mt-20">
                      \${refund.status === 'approved' ? 
                        \`<p class="text-muted">Approved by \${refund.approvedBy} on \${new Date(refund.approvedAt).toLocaleString()}</p>\` :
                        \`<p class="text-muted">Rejected by \${refund.rejectedBy} on \${new Date(refund.rejectedAt).toLocaleString()}<br>
                        Reason: \${refund.rejectionReason}</p>\`
                      }
                    </div>
                  \`}
                </div>
              \`;
            }).join('');
            
          } catch (error) {
            refundsList.innerHTML = '<div class="empty-state"><p>Failed to load refund requests</p></div>';
            showToast('Failed to load refunds', 'error');
          }
        }
        
        // Create User
        async function createUser(event) {
          event.preventDefault();
          
          const userData = {
            username: document.getElementById('newUsername').value,
            name: document.getElementById('newName').value,
            password: document.getElementById('newPassword').value,
            tier: document.getElementById('newTier').value
          };
          
          if (!userData.tier) {
            showToast('Please select a tier', 'error');
            return;
          }
          
          try {
            const response = await fetch('/api/admin/create-user', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
              showToast('User created successfully', 'success');
              closeModal('createUserModal');
              loadUsers();
              loadStats();
              event.target.reset();
              document.querySelectorAll('.tier-option').forEach(opt => opt.classList.remove('selected'));
            } else {
              showToast(data.error || 'Failed to create user', 'error');
            }
          } catch (error) {
            showToast('Failed to create user', 'error');
          }
        }
        
        // Select Tier
        function selectTier(tier) {
          document.querySelectorAll('.tier-option').forEach(opt => opt.classList.remove('selected'));
          event.target.closest('.tier-option').classList.add('selected');
          document.getElementById('newTier').value = tier;
        }
        
        // Reset Password
        async function resetPassword(username) {
          if (!confirm(\`Reset password for \${username}?\`)) return;
          
          try {
            const response = await fetch('/api/admin/reset-password', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ username })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
              const content = \`
                <div class="password-display">
                  <p style="color: var(--success); margin-bottom: 20px;">✅ Password reset successfully!</p>
                  <p><strong>Username:</strong></p>
                  <code>\${username}</code>
                  <p style="margin-top: 20px;"><strong>New Password:</strong></p>
                  <code>\${data.tempPassword}</code>
                  <p style="color: var(--warning); margin-top: 20px;">⚠️ Save this password - it won't be shown again!</p>
                </div>
                <button onclick="closeModal('passwordModal')" class="btn btn-secondary" style="width: 100%; margin-top: 20px;">Close</button>
              \`;
              
              document.getElementById('passwordContent').innerHTML = content;
              document.getElementById('passwordModal').classList.add('active');
            } else {
              showToast(data.error || 'Failed to reset password', 'error');
            }
          } catch (error) {
            showToast('Failed to reset password', 'error');
          }
        }
        
        // Update Subscription
        async function updateSubscription(username) {
          if (!confirm(\`Reset subscription for \${username}? This will add 7 days.\`)) return;
          
          try {
            const response = await fetch('/api/admin/update-user', {
              method: 'PUT',
              headers: {
                'Authorization': 'Bearer ' + API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                username,
                updates: { lastPaymentDate: new Date().toISOString() }
              })
            });
            
            if (response.ok) {
              showToast('Subscription updated successfully', 'success');
              loadUsers();
              loadStats();
            } else {
              showToast('Failed to update subscription', 'error');
            }
          } catch (error) {
            showToast('Failed to update subscription', 'error');
          }
        }
        
        // Delete User
        async function deleteUser(username) {
          if (!confirm(\`Are you sure you want to delete user: \${username}?\`)) return;
          
          try {
            const response = await fetch('/api/admin/delete-user?username=' + username, {
              method: 'DELETE',
              headers: { 'Authorization': 'Bearer ' + API_KEY }
            });
            
            if (response.ok) {
              showToast('User deleted successfully', 'success');
              loadUsers();
              loadStats();
            } else {
              showToast('Failed to delete user', 'error');
            }
          } catch (error) {
            showToast('Failed to delete user', 'error');
          }
        }
        
        // Fulfill Order
        async function fulfillOrder(orderId) {
          if (!confirm(\`Fulfill order \${orderId}?\`)) return;
          
          try {
            const response = await fetch('/api/admin/fulfill', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ orderId })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
              showToast('Order fulfilled successfully', 'success');
              loadOrders();
              loadStats();
            } else {
              showToast(data.error || 'Failed to fulfill order', 'error');
            }
          } catch (error) {
            showToast('Failed to fulfill order', 'error');
          }
        }
        
        // Revert Order
        async function revertOrder(orderId) {
          if (!confirm(\`Revert order \${orderId}? This will restore accounts to inventory.\`)) return;
          
          try {
            const response = await fetch('/api/admin/revert-order', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ orderId })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
              showToast(data.message, 'success');
              loadOrders();
              loadStats();
            } else {
              showToast(data.error || 'Failed to revert order', 'error');
            }
          } catch (error) {
            showToast('Failed to revert order', 'error');
          }
        }
        
        // Approve Refund
        async function approveRefund(refundId) {
          const adminUsername = prompt('Enter your admin username:');
          if (!adminUsername) return;
          
          if (!confirm('Approve this refund request?')) return;
          
          try {
            const response = await fetch('/api/admin/approve-refund', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ refundId, adminUsername })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
              showToast('Refund approved successfully', 'success');
              loadRefundRequests();
              loadStats();
            } else {
              showToast(data.error || 'Failed to approve refund', 'error');
            }
          } catch (error) {
            showToast('Failed to approve refund', 'error');
          }
        }
        
        // Reject Refund
        async function rejectRefund(refundId) {
          const adminUsername = prompt('Enter your admin username:');
          if (!adminUsername) return;
          
          const rejectionReason = prompt('Enter rejection reason:');
          if (!rejectionReason || rejectionReason.trim().length < 10) {
            showToast('Please provide a detailed reason', 'error');
            return;
          }
          
          if (!confirm('Reject this refund request?')) return;
          
          try {
            const response = await fetch('/api/admin/reject-refund', {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer ' + API_KEY,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                refundId, 
                adminUsername, 
                rejectionReason: rejectionReason.trim() 
              })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
              showToast('Refund rejected', 'info');
              loadRefundRequests();
            } else {
              showToast(data.error || 'Failed to reject refund', 'error');
            }
          } catch (error) {
            showToast('Failed to reject refund', 'error');
          }
        }
        
        // Refresh Stats
        function refreshStats() {
          showToast('Refreshing statistics...', 'info');
          loadStats();
        }
        
        // Show Create User Modal
        function showCreateUserModal() {
          document.getElementById('createUserModal').classList.add('active');
        }
        
        // Close Modal
        function closeModal(modalId) {
          document.getElementById(modalId).classList.remove('active');
        }
        
        // Toggle Sidebar (Mobile)
        function toggleSidebar() {
          const sidebar = document.getElementById('sidebar');
          const overlay = document.querySelector('.sidebar-overlay');
          sidebar.classList.toggle('open');
          overlay.classList.toggle('active');
        }
        
        // Close Sidebar
        function closeSidebar() {
          const sidebar = document.getElementById('sidebar');
          const overlay = document.querySelector('.sidebar-overlay');
          sidebar.classList.remove('open');
          overlay.classList.remove('active');
        }
        
        // Show Toast
        function showToast(message, type = 'info') {
          const toast = document.getElementById('toast');
          toast.textContent = message;
          toast.className = 'toast ' + type + ' show';
          
          setTimeout(() => {
            toast.classList.remove('show');
          }, 3000);
        }
        
        // Logout
        function logout() {
          localStorage.removeItem('adminApiKey');
          location.reload();
        }
      </script>
    </body>
    </html>`;
      
      return new Response(html, {
        headers: { 'Content-Type': 'text/html' }
      });
    }


//Home Page UI
function handleHomePage() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TikTok Account Portal</title>
  <style>
    /* CSS Variables */
    :root {
      --bg-primary: #0a0a0a;
      --bg-secondary: #1a1a1a;
      --bg-tertiary: #252525;
      --bg-card: #1f1f1f;
      --text-primary: #ffffff;
      --text-secondary: #e0e0e0;
      --text-muted: #888888;
      --accent-primary: #667eea;
      --accent-secondary: #764ba2;
      --success: #4CAF50;
      --warning: #ff9800;
      --danger: #f44336;
      --info: #2196F3;
      --border-color: #333333;
      --border-radius: 12px;
      --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    /* Reset */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-secondary);
      line-height: 1.6;
      overflow-x: hidden;
    }
    
    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    @keyframes slideIn {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    
    /* Container */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      animation: fadeIn 0.6s ease-out;
    }
    
    /* Header */
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding: 40px 0;
      background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .header h1 {
      font-size: 3.5em;
      font-weight: 800;
      letter-spacing: -2px;
      margin-bottom: 10px;
    }
    
    .header p {
      font-size: 1.2em;
      -webkit-text-fill-color: var(--text-muted);
    }
    
    /* Cards */
    .card {
      background: var(--bg-secondary);
      border-radius: var(--border-radius);
      padding: 30px;
      margin-bottom: 30px;
      border: 1px solid var(--border-color);
      transition: var(--transition);
      position: relative;
      overflow: hidden;
    }
    
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
      transform: scaleX(0);
      transition: transform 0.3s ease;
    }
    
    .card:hover::before {
      transform: scaleX(1);
    }
    
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.1);
    }
    
    /* Forms */
    .form-group {
      margin-bottom: 25px;
    }
    
    .form-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: var(--text-secondary);
      font-size: 0.95em;
    }
    
    input[type="text"],
    input[type="password"],
    input[type="number"],
    select,
    textarea {
      width: 100%;
      padding: 14px 18px;
      background: var(--bg-tertiary);
      border: 2px solid transparent;
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 16px;
      transition: var(--transition);
      font-family: inherit;
    }
    
    input:focus,
    select:focus,
    textarea:focus {
      outline: none;
      border-color: var(--accent-primary);
      background: var(--bg-primary);
    }
    
    /* Buttons */
    .btn {
      display: inline-block;
      padding: 14px 28px;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition);
      text-decoration: none;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.2);
      transition: left 0.3s ease;
    }
    
    .btn:hover::before {
      left: 100%;
    }
    
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
    
    .btn:active {
      transform: translateY(0);
    }
    
    .btn:disabled {
      background: var(--text-muted);
      cursor: not-allowed;
      transform: none;
    }
    
    .btn-secondary {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    
    .btn-secondary:hover {
      background: #333333;
    }
    
    .btn-success { background: var(--success); }
    .btn-warning { background: var(--warning); }
    .btn-danger { background: var(--danger); }
    .btn-info { background: var(--info); }
    
    .btn-sm {
      padding: 8px 16px;
      font-size: 14px;
    }
    
    .btn-block {
      display: block;
      width: 100%;
    }
    
    /* Tabs */
    .tabs {
      display: flex;
      gap: 5px;
      margin-bottom: 30px;
      background: var(--bg-secondary);
      padding: 5px;
      border-radius: 10px;
    }
    
    .tab {
      flex: 1;
      padding: 12px 24px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition);
      border-radius: 6px;
      position: relative;
    }
    
    .tab.active {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    
    .tab:hover:not(.active) {
      color: var(--text-secondary);
    }
    
    .tab-content {
      display: none;
      animation: fadeIn 0.4s ease-out;
    }
    
    .tab-content.active {
      display: block;
    }
    
    /* User Dashboard */
    .user-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      padding: 20px;
      background: var(--bg-secondary);
      border-radius: var(--border-radius);
      border: 1px solid var(--border-color);
    }
    
    .user-info {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    
    .user-avatar {
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      color: white;
    }
    
    .user-details h2 {
      font-size: 1.5em;
      margin-bottom: 5px;
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: var(--bg-card);
      padding: 25px;
      border-radius: var(--border-radius);
      border: 1px solid var(--border-color);
      text-align: center;
      transition: var(--transition);
      position: relative;
      overflow: hidden;
    }
    
    .stat-card::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--accent-primary);
      transform: scaleX(0);
      transition: transform 0.3s ease;
    }
    
    .stat-card:hover::after {
      transform: scaleX(1);
    }
    
    .stat-card:hover {
      transform: translateY(-5px);
      border-color: var(--accent-primary);
    }
    
    .stat-label {
      color: var(--text-muted);
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    
    .stat-value {
      font-size: 2.5em;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
    }
    
    .stat-progress {
      margin-top: 15px;
      height: 6px;
      background: var(--bg-tertiary);
      border-radius: 3px;
      overflow: hidden;
    }
    
    .stat-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
      transition: width 0.6s ease;
    }
    
    /* Badges */
    .badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .badge-bronze {
      background: linear-gradient(135deg, #CD7F32, #8B4513);
      color: white;
    }
    
    .badge-silver {
      background: linear-gradient(135deg, #C0C0C0, #808080);
      color: #333;
    }
    
    .badge-gold {
      background: linear-gradient(135deg, #FFD700, #FFA500);
      color: #333;
    }
    
    /* Region Grid */
    .region-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    
    .region-card {
      background: var(--bg-card);
      border: 2px solid var(--border-color);
      border-radius: 10px;
      padding: 20px;
      text-align: center;
      transition: var(--transition);
      position: relative;
      overflow: hidden;
      pointer-events: none;
    }
    
    .region-card::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, var(--accent-primary) 0%, transparent 70%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    
    .region-card:hover::before {
      opacity: 0.1;
    }

    .region-card > * {
      pointer-events: auto;
    }
    
    .region-card:hover {
      border-color: var(--accent-primary);
      transform: translateY(-3px);
    }
    
    .region-flag {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    
    .region-name {
      font-weight: 600;
      margin-bottom: 10px;
      color: var(--text-primary);
    }
    
    .region-availability {
      color: var(--text-muted);
      font-size: 0.9em;
      margin-bottom: 10px;
    }
    
    .region-availability.in-stock {
      color: var(--success);
    }
    
    .region-input {
      width: 90px !important;
      padding: 8px !important;
      text-align: center;
      background: #252525 !important;
      border: 2px solid #667eea !important;
      border-radius: 6px;
      color: #ffffff !important;
      font-weight: 600;
      font-size: 18px !important;
      margin: 15px auto 0 !important;
      display: block !important;
      cursor: text !important;
      transition: all 0.3s ease;
      -webkit-appearance: none;
      -moz-appearance: textfield;
      position: relative;
      z-index: 10;
      pointer-events: auto !important;
    }
    
    .region-input:hover,
    .region-input:focus {
      border-color: #764ba2 !important;
      background: #1a1a1a !important;
      outline: none !important;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3) !important;
    }
    
    .region-input::-webkit-inner-spin-button,
    .region-input::-webkit-outer-spin-button {
      opacity: 1 !important;
      height: 30px !important;
      cursor: pointer !important;
    }
    
    /* Order List */
    .order-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .order-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 25px;
      transition: var(--transition);
    }
    
    .order-card:hover {
      border-color: var(--accent-primary);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.1);
    }
    
    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }
    
    .order-id {
      font-weight: 600;
      color: var(--text-primary);
      font-size: 1.1em;
    }
    
    .order-date {
      color: var(--text-muted);
      font-size: 0.9em;
      margin-top: 5px;
    }
    
    .order-status {
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
    }
    
    .order-status.fulfilled {
      background: var(--success);
      color: white;
    }
    
    .order-status.pending {
      background: var(--warning);
      color: white;
    }
    
    .order-items {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .order-item-badge {
      background: var(--bg-tertiary);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.9em;
      color: var(--text-secondary);
    }
    
    /* Account Display */
    .accounts-container {
      margin-top: 20px;
      display: none;
    }
    
    .accounts-container.show {
      display: block;
      animation: fadeIn 0.4s ease-out;
    }
    
    .account-card {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 15px;
      transition: var(--transition);
    }
    
    .account-card:hover {
      border-color: var(--accent-primary);
    }
    
    .account-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .account-title {
      font-weight: 600;
      color: var(--success);
    }
    
    .account-details {
      font-family: 'Courier New', monospace;
      font-size: 0.95em;
      color: var(--text-secondary);
    }
    
    .account-details .detail-row {
      display: flex;
      margin: 8px 0;
      align-items: center;
    }
    
    .detail-label {
      font-weight: 600;
      color: var(--text-muted);
      min-width: 100px;
    }
    
    .detail-value {
      flex: 1;
      color: var(--text-primary);
      word-break: break-all;
    }
    
    /* Modal */
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(5px);
    }
    
    .modal.active {
      display: flex;
      animation: fadeIn 0.3s ease-out;
    }
    
    .modal-content {
      background: var(--bg-secondary);
      padding: 40px;
      border-radius: var(--border-radius);
      max-width: 900px;
      width: 90%;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      border: 1px solid var(--border-color);
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .modal-header h2 {
      font-size: 1.8em;
      color: var(--text-primary);
    }
    
    .close-modal {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 32px;
      cursor: pointer;
      transition: var(--transition);
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }
    
    .close-modal:hover {
      color: var(--text-primary);
      background: var(--bg-tertiary);
    }
    
    /* Email Display */
    .email-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .email-item {
      background: var(--bg-tertiary);
      padding: 25px;
      border-radius: 10px;
      border: 1px solid var(--border-color);
      transition: var(--transition);
    }
    
    .email-item:hover {
      border-color: var(--accent-primary);
    }
    
    .email-meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid var(--border-color);
    }
    
    .email-from {
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .email-date {
      color: var(--text-muted);
      font-size: 0.9em;
    }
    
    .email-subject {
      color: var(--accent-primary);
      font-weight: 600;
      margin-bottom: 20px;
      font-size: 1.1em;
    }
    
    .email-code-box {
      background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05));
      border: 2px solid var(--success);
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      margin: 20px 0;
    }
    
    .email-code-label {
      color: var(--text-muted);
      font-size: 0.9em;
      margin-bottom: 10px;
    }
    
    .email-code {
      font-size: 2.5em;
      font-weight: 700;
      color: var(--success);
      font-family: 'Courier New', monospace;
      letter-spacing: 5px;
    }
    
    .email-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
    }
    
    .email-content-full {
      margin-top: 20px;
      background: var(--bg-primary);
      padding: 20px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      max-height: 400px;
      overflow-y: auto;
    }
    
    .email-iframe {
      width: 100%;
      height: 400px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: white;
    }
    
    /* Loading States */
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: var(--text-muted);
    }
    
    .loading::after {
      content: '';
      width: 20px;
      height: 20px;
      border: 2px solid var(--text-muted);
      border-top-color: transparent;
      border-radius: 50%;
      margin-left: 10px;
      animation: spin 0.8s linear infinite;
    }
    
    /* Status Messages */
    .status-message {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 24px;
      border-radius: 8px;
      font-weight: 500;
      z-index: 2000;
      animation: slideIn 0.3s ease-out;
      display: none;
    }
    
    .status-message.show {
      display: block;
    }
    
    .status-message.success {
      background: var(--success);
      color: white;
    }
    
    .status-message.error {
      background: var(--danger);
      color: white;
    }
    
    .status-message.info {
      background: var(--info);
      color: white;
    }
    
    /* TOTP Container */
    .totp-container {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 10px;
      background: var(--bg-tertiary);
      border-radius: 8px;
      border: 1px solid var(--border-color);
    }

    /* TOTP Code Display */
    .totp-code {
      font-size: 1.8em !important;
      font-weight: 700 !important;
      font-family: 'Courier New', monospace !important;
      letter-spacing: 3px !important;
      padding: 10px 20px !important;
      background: var(--bg-primary) !important;
      border: 2px solid var(--success) !important;
      border-radius: 8px !important;
      color: var(--success) !important;
      min-width: 140px;
      text-align: center;
      transition: all 0.3s ease;
    }

    .totp-code.totp-active {
      animation: codeGenerated 0.5s ease;
    }

    .totp-code.totp-error {
      color: var(--danger) !important;
      border-color: var(--danger) !important;
    }

    /* TOTP Timer */
    .totp-timer {
      font-size: 1.2em;
      font-weight: 600;
      color: var(--text-secondary);
      min-width: 35px;
      text-align: center;
      padding: 5px 10px;
      background: var(--bg-primary);
      border-radius: 6px;
      border: 1px solid var(--border-color);
    }

    .totp-timer.totp-expiring {
      color: var(--warning) !important;
      border-color: var(--warning) !important;
      animation: pulse 1s infinite;
    }

    /* TOTP Row Styling */
    .totp-row {
      background: linear-gradient(135deg, rgba(76, 175, 80, 0.05), rgba(76, 175, 80, 0.02));
      padding: 15px !important;
      border-radius: 10px;
      margin: 15px -10px !important;
      border: 1px solid rgba(76, 175, 80, 0.2);
    }

    /* Animations */
    @keyframes codeGenerated {
      0% {
        transform: scale(0.95);
        opacity: 0.5;
      }
      50% {
        transform: scale(1.05);
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    @keyframes pulse {
      0% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
      100% {
        opacity: 1;
      }
    }
    
    /* Utility Classes */
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .mt-10 { margin-top: 10px; }
    .mt-20 { margin-top: 20px; }
    .mt-30 { margin-top: 30px; }
    .mb-10 { margin-bottom: 10px; }
    .mb-20 { margin-bottom: 20px; }
    .mb-30 { margin-bottom: 30px; }
    .hidden { display: none !important; }
    
    /* Responsive Design */
    @media (max-width: 768px) {
      .container {
        padding: 15px;
      }
      
      .header h1 {
        font-size: 2.5em;
      }
      
      .user-header {
        flex-direction: column;
        text-align: center;
      }
      
      .user-info {
        flex-direction: column;
      }
      
      .stats-grid {
        grid-template-columns: 1fr;
      }
      
      .region-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
      
      .order-header {
        flex-direction: column;
        gap: 10px;
      }
      
      .tabs {
        flex-direction: column;
      }
      
      .modal-content {
        padding: 20px;
      }
      
      .totp-container {
        flex-direction: column;
        gap: 10px;
      }
      
      .totp-code {
        font-size: 1.5em !important;
        letter-spacing: 2px !important;
      }
      
      .totp-timer {
        order: -1;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>TikTok Account Portal</h1>
    <p>Premium Account Management System</p>
  </div>
  
  <div class="container">
    <div id="loginSection" class="card">
      <h2 class="text-center mb-30">Welcome Back</h2>
      <form id="loginForm" onsubmit="handleLogin(event)">
        <div class="form-group">
          <label class="form-label">Username</label>
          <input type="text" id="username" placeholder="Enter your username" required>
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <input type="password" id="password" placeholder="Enter your password" required>
        </div>
        <button type="submit" class="btn btn-block">Sign In</button>
      </form>
    </div>
    
    <div id="userDashboard" class="hidden">
      <div class="user-header">
        <div class="user-info">
          <div class="user-avatar" id="userAvatar">U</div>
          <div class="user-details">
            <h2 id="userName">User</h2>
            <span id="userTierBadge" class="badge"></span>
          </div>
        </div>
        <button onclick="logout()" class="btn btn-secondary">Sign Out</button>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Daily Limit</div>
          <div class="stat-value" id="dailyLimit">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Used Today</div>
          <div class="stat-value" id="usedToday">0</div>
          <div class="stat-progress">
            <div class="stat-progress-fill" id="progressBar"></div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Remaining</div>
          <div class="stat-value" id="remaining">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Subscription</div>
          <div class="stat-value" id="daysLeft">0</div>
          <div class="stat-label mt-10" id="subStatus">days left</div>
        </div>
      </div>
      
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>Refund Quota</h3>
          <span id="refundQuota" style="color: var(--text-muted);">Loading...</span>
        </div>
      </div>
      
      <div class="tabs">
        <button class="tab active" onclick="switchTab('shop')">Shop</button>
        <button class="tab" onclick="switchTab('orders')">My Orders</button>
      </div>
      
      <div id="shopTab" class="tab-content active">
        <div class="region-grid" id="regionGrid">
        </div>
        <button onclick="processOrder()" id="orderButton" class="btn btn-block">
          Place Order
        </button>
      </div>
      
      <div id="ordersTab" class="tab-content">
        <div class="order-list" id="ordersList">
          <div class="loading">Loading orders</div>
        </div>
      </div>
    </div>
  </div>
  
  <div id="emailModal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Email Messages</h2>
        <button class="close-modal" onclick="closeEmailModal()">&times;</button>
      </div>
      <div id="emailModalContent">
        <div class="loading">Loading emails</div>
      </div>
    </div>
  </div>
  
  <div id="statusMessage" class="status-message"></div>
  
  <script>
    // Global Variables
    let currentUser = null;
    let userRefunds = [];
    
    const regions = [
      { id: 'netherlands', name: 'Netherlands', flag: '🇳🇱' },
      { id: 'saudi arabia', name: 'Saudi Arabia', flag: '🇸🇦' },
      { id: 'canada', name: 'Canada', flag: '🇨🇦' },
      { id: 'france', name: 'France', flag: '🇫🇷' },
      { id: 'germany', name: 'Germany', flag: '🇩🇪' },
      { id: 'switzerland', name: 'Switzerland', flag: '🇨🇭' },
      { id: 'sweden', name: 'Sweden', flag: '🇸🇪' },
      { id: 'usa', name: 'United States', flag: '🇺🇸' },
      { id: 'usa auto', name: 'USA Auto', flag: '🇺🇸' }
    ];
    
    const USER_TIERS = {
      bronze: { dailyLimit: 25, refundLimit: 2 },
      silver: { dailyLimit: 50, refundLimit: 5 },
      gold: { dailyLimit: 100, refundLimit: 12 }
    };
    
    // TOTP (Time-based One-Time Password) Implementation
    class TOTP {
      static base32ToHex(base32) {
        const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        let bits = "";
        let hex = "";
        
        // Remove spaces and uppercase
        base32 = base32.replace(/\s/g, '').toUpperCase();
        
        for (let i = 0; i < base32.length; i++) {
          const val = base32chars.indexOf(base32.charAt(i));
          if (val === -1) throw new Error("Invalid base32 character");
          bits += val.toString(2).padStart(5, '0');
        }
        
        for (let i = 0; i + 8 <= bits.length; i += 8) {
          const chunk = bits.substring(i, i + 8);
          hex += parseInt(chunk, 2).toString(16).padStart(2, '0');
        }
        
        return hex;
      }
      
      static async generateTOTP(secret, timeStep = 30) {
        try {
          // Convert base32 secret to hex
          const hexSecret = this.base32ToHex(secret);
          
          // Get current time counter
          const counter = Math.floor(Date.now() / 1000 / timeStep);
          
          // Convert counter to 8-byte buffer
          const counterBuffer = new ArrayBuffer(8);
          const counterView = new DataView(counterBuffer);
          counterView.setBigUint64(0, BigInt(counter), false);
          
          // Convert hex secret to buffer
          const secretBuffer = new Uint8Array(hexSecret.match(/.{2}/g).map(byte => parseInt(byte, 16)));
          
          // Import secret as HMAC key
          const key = await crypto.subtle.importKey(
            'raw',
            secretBuffer,
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
          );
          
          // Generate HMAC
          const signature = await crypto.subtle.sign('HMAC', key, counterBuffer);
          const signatureArray = new Uint8Array(signature);
          
          // Dynamic truncation
          const offset = signatureArray[signatureArray.length - 1] & 0xf;
          const code = (
            ((signatureArray[offset] & 0x7f) << 24) |
            ((signatureArray[offset + 1] & 0xff) << 16) |
            ((signatureArray[offset + 2] & 0xff) << 8) |
            (signatureArray[offset + 3] & 0xff)
          ) % 1000000;
          
          // Pad with leading zeros
          return code.toString().padStart(6, '0');
        } catch (error) {
          console.error('TOTP generation error:', error);
          return null;
        }
      }
      
      static getTimeRemaining(timeStep = 30) {
        const seconds = Math.floor(Date.now() / 1000);
        return timeStep - (seconds % timeStep);
      }
    }
    
    // Initialize
    document.addEventListener('DOMContentLoaded', function() {
      initializeRegions();
      document.getElementById('username').focus();
    });
    
    // Initialize Regions
    function initializeRegions() {
      const grid = document.getElementById('regionGrid');
      let html = '';
      
      regions.forEach(function(region) {
        html += '<div class="region-card">' +
          '<div class="region-flag">' + region.flag + '</div>' +
          '<div class="region-name">' + region.name + '</div>' +
          '<div class="region-availability" id="avail-' + region.id + '">Checking...</div>' +
          '<input type="number" class="region-input" id="' + region.id + '" min="0" value="0">' +
        '</div>';
      });
      
      grid.innerHTML = html;
      
      document.querySelectorAll('.region-input').forEach(function(input) {
        // Prevent event bubbling from the input to the card
        input.addEventListener('click', function(e) {
          e.stopPropagation();
          this.focus();
          this.select();
        });
        
        // Also stop propagation for mousedown to ensure click works
        input.addEventListener('mousedown', function(e) {
          e.stopPropagation();
        });
        
        input.addEventListener('change', function(e) {
          updateOrderButton();
        });
        
        input.addEventListener('input', function(e) {
          updateOrderButton();
        });
      });
    }
    
    // Update order button text
    function updateOrderButton() {
      const button = document.getElementById('orderButton');
      let total = 0;
      
      document.querySelectorAll('.region-input').forEach(function(input) {
        total += parseInt(input.value) || 0;
      });
      
      if (total > 0) {
        button.textContent = 'Place Order (' + total + ' accounts)';
      } else {
        button.textContent = 'Place Order';
      }
    }
    
    // Handle Login
    async function handleLogin(event) {
      event.preventDefault();
      
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.user) {
          currentUser = data.user;
          showDashboard();
          checkAvailability();
          loadRefundStatus();
        } else {
          showStatus(data.error || 'Login failed', 'error');
        }
      } catch (error) {
        showStatus('Connection error', 'error');
      }
    }
    
    // Show Dashboard
    function showDashboard() {
      document.getElementById('loginSection').classList.add('hidden');
      document.getElementById('userDashboard').classList.remove('hidden');
      
      // Update user info
      const firstLetter = currentUser.name.charAt(0).toUpperCase();
      document.getElementById('userAvatar').textContent = firstLetter;
      document.getElementById('userName').textContent = currentUser.name;
      
      const tierBadge = document.getElementById('userTierBadge');
      tierBadge.textContent = currentUser.tier.toUpperCase();
      tierBadge.className = 'badge badge-' + currentUser.tier;
      
      // Update stats
      const tierInfo = USER_TIERS[currentUser.tier];
      document.getElementById('dailyLimit').textContent = tierInfo.dailyLimit;
      document.getElementById('usedToday').textContent = currentUser.todayUsage;
      document.getElementById('remaining').textContent = currentUser.remainingToday;
      
      // Update progress bar
      const progress = (currentUser.todayUsage / tierInfo.dailyLimit) * 100;
      document.getElementById('progressBar').style.width = progress + '%';
      
      // Update subscription
      document.getElementById('daysLeft').textContent = currentUser.daysUntilExpiry;
      const subStatus = document.getElementById('subStatus');
      if (currentUser.daysUntilExpiry === 0) {
        subStatus.textContent = 'Expires today!';
        subStatus.style.color = 'var(--warning)';
      } else if (currentUser.daysUntilExpiry < 0) {
        subStatus.textContent = 'Expired';
        subStatus.style.color = 'var(--danger)';
      } else {
        subStatus.textContent = 'days remaining';
      }
    }
    
    // Check Availability
    async function checkAvailability() {
      try {
        const response = await fetch('/api/availability');
        const data = await response.json();
        
        // Reset all
        document.querySelectorAll('.region-availability').forEach(elem => {
          elem.textContent = '0 available';
          elem.classList.remove('in-stock');
        });
        
        // Update with actual data
        if (data.availability) {
          Object.entries(data.availability).forEach(([region, count]) => {
            const elem = document.getElementById('avail-' + region);
            if (elem) {
              elem.textContent = count + ' available';
              if (count > 0) elem.classList.add('in-stock');
            }
          });
        }
      } catch (error) {
        console.error('Failed to check availability');
      }
    }
    
    // Load Refund Status
    async function loadRefundStatus() {
      try {
        const response = await fetch('/api/user-refunds?username=' + currentUser.username);
        const data = await response.json();
        
        document.getElementById('refundQuota').innerHTML = \`
          <strong>\${data.used} / \${data.limit}</strong> used 
          <span style="color: var(--success);">(\${data.remaining} remaining)</span>
        \`;
        
        currentUser.remainingRefunds = data.remaining;
        userRefunds = data.refunds || [];
      } catch (error) {
        document.getElementById('refundQuota').textContent = 'Error loading';
      }
    }
    
    // Switch Tabs
    function switchTab(tab) {
      // Clean up any running TOTP intervals
      cleanupTOTPIntervals();
      
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      event.target.classList.add('active');
      
      if (tab === 'shop') {
        document.getElementById('shopTab').classList.add('active');
      } else if (tab === 'orders') {
        document.getElementById('ordersTab').classList.add('active');
        loadOrders();
      }
    }
    
    // Process Order
    async function processOrder() {
      const items = [];
      document.querySelectorAll('.region-input').forEach(input => {
        const quantity = parseInt(input.value || 0);
        if (quantity > 0) {
          items.push({
            region: input.id,
            quantity: quantity
          });
        }
      });
      
      if (items.length === 0) {
        showStatus('Please select at least one account', 'error');
        return;
      }
      
      const button = document.getElementById('orderButton');
      button.disabled = true;
      button.textContent = 'Processing...';
      
      try {
        const response = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            username: currentUser.username,
            customerInfo: { name: currentUser.name }
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.orderId) {
          showStatus('Order created successfully!', 'success');
          
          // Update stats
          currentUser.remainingToday = data.remainingToday;
          const tierInfo = USER_TIERS[currentUser.tier];
          document.getElementById('remaining').textContent = currentUser.remainingToday;
          document.getElementById('usedToday').textContent = tierInfo.dailyLimit - currentUser.remainingToday;
          
          // Update progress
          const progress = ((tierInfo.dailyLimit - currentUser.remainingToday) / tierInfo.dailyLimit) * 100;
          document.getElementById('progressBar').style.width = progress + '%';
          
          // Reset inputs
          document.querySelectorAll('.region-input').forEach(input => input.value = 0);
          updateOrderButton();
          checkAvailability();
          
          // Switch to orders tab
          setTimeout(() => {
            document.querySelector('.tab:nth-child(2)').click();
          }, 1500);
        } else {
          showStatus(data.error || 'Order failed', 'error');
        }
      } catch (error) {
        showStatus('Connection error', 'error');
      } finally {
        button.disabled = false;
        button.textContent = 'Place Order';
      }
    }
    
    // Load Orders
    async function loadOrders() {
      const ordersList = document.getElementById('ordersList');
      ordersList.innerHTML = '<div class="loading">Loading orders</div>';
      
      try {
        const response = await fetch('/api/user-orders/' + encodeURIComponent(currentUser.username));
        const data = await response.json();
        
        if (data.orders && data.orders.length > 0) {
          let html = '';
          
          data.orders.forEach(order => {
            const date = new Date(order.createdAt).toLocaleString();
            const statusClass = order.status === 'fulfilled' ? 'fulfilled' : 'pending';
            
            html += \`
              <div class="order-card">
                <div class="order-header">
                  <div>
                    <div class="order-id">Order #\${order.orderId}</div>
                    <div class="order-date">\${date}</div>
                  </div>
                  <div class="text-right">
                    <div class="order-status \${statusClass}">\${order.status.toUpperCase()}</div>
                    <div class="order-date">\${order.totalAccounts} accounts • $\${order.totalPrice}</div>
                  </div>
                </div>
                <div class="order-items">
                  \${order.items.map(item => \`
                    <span class="order-item-badge">\${item.quantity}x \${item.region}</span>
                  \`).join('')}
                </div>
                \${order.status === 'fulfilled' ? \`
                  <button onclick="toggleAccounts('\${order.orderId}')" class="btn btn-secondary btn-block">
                    View Accounts
                  </button>
                  <div id="accounts-\${order.orderId}" class="accounts-container"></div>
                \` : '<p class="text-center" style="color: var(--text-muted);">Order is being processed...</p>'}
              </div>
            \`;
          });
          
          ordersList.innerHTML = html;
        } else {
          ordersList.innerHTML = \`
            <div class="card text-center">
              <p style="color: var(--text-muted); margin-bottom: 20px;">No orders yet</p>
              <button onclick="document.querySelector('.tab:first-child').click()" class="btn">
                Start Shopping
              </button>
            </div>
          \`;
        }
      } catch (error) {
        ordersList.innerHTML = '<div class="card text-center"><p style="color: var(--danger);">Failed to load orders</p></div>';
      }
    }
    
    // Toggle Accounts Display
    async function toggleAccounts(orderId) {
      const container = document.getElementById('accounts-' + orderId);
      
      if (container.classList.contains('show')) {
        container.classList.remove('show');
        return;
      }
      
      container.innerHTML = '<div class="loading">Loading accounts</div>';
      container.classList.add('show');
      
      try {
        const response = await fetch('/api/order-status/' + orderId);
        const data = await response.json();
        
        if (data.order && data.order.accounts) {
          displayAccounts(data.order, container);
        } else {
          container.innerHTML = '<p class="text-center" style="color: var(--text-muted);">No accounts available</p>';
        }
      } catch (error) {
        container.innerHTML = '<p class="text-center" style="color: var(--danger);">Failed to load accounts</p>';
      }
    }
    
    // Display Accounts with TOTP Support
    function displayAccounts(order, container) {
      const orderDate = new Date(order.createdAt);
      const now = new Date();
      const hoursDiff = Math.floor((now - orderDate) / (1000 * 60 * 60));
      const canRefund = hoursDiff <= 24;
      
      let html = '';
      
      order.accounts.forEach((acc, index) => {
        const hasRefundRequest = userRefunds.some(
          r => r.orderId === order.orderId && r.accountUsername === acc.username
        );
        const refundRequest = hasRefundRequest ? userRefunds.find(
          r => r.orderId === order.orderId && r.accountUsername === acc.username
        ) : null;
        
        html += \`
          <div class="account-card \${acc.refunded ? 'refunded' : ''}">
            <div class="account-header">
              <div class="account-title">Account #\${index + 1} - \${acc.country}</div>
              \${getRefundBadge(acc, refundRequest, canRefund, order.orderId)}
            </div>
            <div class="account-details">
              <div class="detail-row">
                <span class="detail-label">Username:</span>
                <span class="detail-value">\${acc.username}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Password:</span>
                <span class="detail-value">
                  \${acc.passTiktok}
                  <button onclick="navigator.clipboard.writeText('\${acc.passTiktok.replace(/'/g, "\\\\'")}').then(() => showStatus('Password copied!', 'success'))" class="btn btn-success btn-sm" style="margin-left: 10px;">Copy Password</button>
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">
                  \${acc.mail}
                  <button onclick="navigator.clipboard.writeText('\${acc.mail}').then(() => showStatus('Email copied!', 'success'))" class="btn btn-success btn-sm" style="margin-left: 10px;">Copy Email</button>
                  <button class="btn btn-info btn-sm" style="margin-left: 10px;" onclick="checkEmailDirect('\${acc.mail}')">
                    Check Email
                  </button>
                </span>
              </div>
              \${acc.code2fa ? \`
                <div class="detail-row">
                  <span class="detail-label">2FA Secret:</span>
                  <span class="detail-value">
                    <code style="background: var(--bg-primary); padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: var(--text-muted);">\${acc.code2fa}</code>
                    <button onclick="navigator.clipboard.writeText('\${acc.code2fa}').then(() => showStatus('2FA secret copied!', 'success'))" class="btn btn-secondary btn-sm" style="margin-left: 10px;">Copy Secret</button>
                  </span>
                </div>
                <div class="detail-row totp-row">
                  <span class="detail-label">2FA Login Code:</span>
                  <span class="detail-value">
                    <div class="totp-container">
                      <code id="totp-\${order.orderId}-\${index}" class="totp-code">------</code>
                      <div class="totp-timer" id="timer-\${order.orderId}-\${index}">30s</div>
                      <button onclick="copyTOTP('\${order.orderId}', \${index})" class="btn btn-success btn-sm">Copy Code</button>
                      <button onclick="refreshTOTP('\${order.orderId}', \${index}, '\${acc.code2fa}')" class="btn btn-info btn-sm">Refresh</button>
                    </div>
                  </span>
                </div>
              \` : \`
                <div class="detail-row">
                  <span class="detail-label">2FA:</span>
                  <span class="detail-value"><span style="color: var(--text-muted);">Not configured</span></span>
                </div>
              \`}
              <div class="detail-row">
                <span class="detail-label">Cookies:</span>
                <div style="display: flex; align-items: flex-start; gap: 10px; margin-top: 5px;">
                  <textarea id="cookies-\${order.orderId}-\${index}" class="detail-value" style="background: var(--bg-primary); border: 1px solid var(--border-color); padding: 8px; border-radius: 6px; min-height: 60px; width: 100%; flex: 1;" readonly>\${acc.cookies || 'N/A'}</textarea>
                  <button class="btn btn-success btn-sm" onclick="copyCookies('\${order.orderId}', \${index})" style="white-space: nowrap;">
                    Copy Cookies
                  </button>
                </div>
              </div>
            </div>
            \${refundRequest && refundRequest.status === 'rejected' ? 
              \`<p style="color: var(--danger); margin-top: 10px; font-size: 0.9em;">
                Rejection reason: \${refundRequest.rejectionReason}
              </p>\` : ''
            }
          </div>
        \`;
      });
      
      if (!canRefund && !order.accounts.some(acc => acc.refunded)) {
        html += \`
          <div class="card" style="background: rgba(255, 152, 0, 0.1); border-color: var(--warning);">
            <p class="text-center" style="color: var(--warning);">
              ⚠️ Refund period has expired (24 hours)
            </p>
          </div>
        \`;
      } else if (currentUser.remainingRefunds === 0) {
        html += \`
          <div class="card" style="background: rgba(244, 67, 54, 0.1); border-color: var(--danger);">
            <p class="text-center" style="color: var(--danger);">
              ⚠️ You have reached your refund limit
            </p>
          </div>
        \`;
      }
      
      html += \`
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button onclick="downloadAccounts('\${order.orderId}')" class="btn btn-success" style="flex: 1;">
            Download All Accounts
          </button>
          <button onclick="copyAllCookies('\${order.orderId}')" class="btn btn-info" style="flex: 1;">
            Copy All Cookies
          </button>
          <button onclick="generateAllTOTP('\${order.orderId}')" class="btn btn-warning" style="flex: 1;">
            Generate All 2FA Codes
          </button>
        </div>
      \`;
      
      container.innerHTML = html;
      
      // Auto-generate TOTP codes for accounts with 2FA
      setTimeout(() => {
        order.accounts.forEach((acc, index) => {
          if (acc.code2fa) {
            generateTOTPForAccount(order.orderId, index, acc.code2fa);
          }
        });
      }, 100);
    }
    
    // TOTP Functions
    async function generateTOTPForAccount(orderId, index, secret) {
      const totpElement = document.getElementById(\`totp-\${orderId}-\${index}\`);
      const timerElement = document.getElementById(\`timer-\${orderId}-\${index}\`);
      
      if (!totpElement || !timerElement) return;
      
      const updateTOTP = async () => {
        const code = await TOTP.generateTOTP(secret);
        if (code) {
          totpElement.textContent = code;
          totpElement.classList.add('totp-active');
        } else {
          totpElement.textContent = 'ERROR';
          totpElement.classList.add('totp-error');
        }
      };
      
      const updateTimer = () => {
        const remaining = TOTP.getTimeRemaining();
        timerElement.textContent = \`\${remaining}s\`;
        
        if (remaining <= 5) {
          timerElement.classList.add('totp-expiring');
        } else {
          timerElement.classList.remove('totp-expiring');
        }
        
        if (remaining === 30) {
          updateTOTP();
        }
      };
      
      // Initial generation
      updateTOTP();
      updateTimer();
      
      // Update timer every second
      const interval = setInterval(updateTimer, 1000);
      
      // Store interval ID for cleanup
      if (!window.totpIntervals) window.totpIntervals = {};
      window.totpIntervals[\`\${orderId}-\${index}\`] = interval;
    }

    function refreshTOTP(orderId, index, secret) {
      generateTOTPForAccount(orderId, index, secret);
      showStatus('2FA code refreshed!', 'success');
    }

    function copyTOTP(orderId, index) {
      const totpElement = document.getElementById(\`totp-\${orderId}-\${index}\`);
      if (!totpElement) {
        showStatus('Failed to find 2FA code', 'error');
        return;
      }
      
      const code = totpElement.textContent;
      if (code === '------' || code === 'ERROR') {
        showStatus('No valid 2FA code to copy', 'error');
        return;
      }
      
      navigator.clipboard.writeText(code).then(() => {
        showStatus('2FA login code copied!', 'success');
      }).catch(() => {
        fallbackCopy(code);
      });
    }

    function generateAllTOTP(orderId) {
      const container = document.getElementById('accounts-' + orderId);
      const accountCards = container.querySelectorAll('.account-card');
      let generated = 0;
      
      accountCards.forEach((card, index) => {
        const totpRow = card.querySelector('.totp-row');
        if (totpRow) {
          const button = card.querySelector('button[onclick*="refreshTOTP"]');
          if (button) {
            button.click();
            generated++;
          }
        }
      });
      
      if (generated > 0) {
        showStatus(\`Generated \${generated} 2FA codes!\`, 'success');
      } else {
        showStatus('No 2FA codes to generate', 'info');
      }
    }

    // Cleanup intervals when switching tabs or logging out
    function cleanupTOTPIntervals() {
      if (window.totpIntervals) {
        Object.values(window.totpIntervals).forEach(interval => clearInterval(interval));
        window.totpIntervals = {};
      }
    }

    // Copy All 2FA Codes
    function copyAll2FACodes(orderId) {
      const container = document.getElementById('accounts-' + orderId);
      const totpElements = container.querySelectorAll('.totp-code');
      
      let all2FACodes = [];
      totpElements.forEach((elem, index) => {
        const code = elem.textContent;
        if (code && code !== '------' && code !== 'ERROR') {
          all2FACodes.push(\`Account #\${index + 1}: \${code}\`);
        }
      });
      
      if (all2FACodes.length === 0) {
        showStatus('No 2FA codes to copy', 'error');
        return;
      }
      
      const combined2FACodes = all2FACodes.join('\\n');
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(combined2FACodes).then(() => {
          showStatus(\`Copied \${all2FACodes.length} 2FA codes!\`, 'success');
        }).catch(() => {
          fallbackCopy(combined2FACodes);
        });
      } else {
        fallbackCopy(combined2FACodes);
      }
    }
    
    // Get Refund Badge
    function getRefundBadge(acc, refundRequest, canRefund, orderId) {
      if (acc.refunded) {
        return '<span class="badge" style="background: var(--danger); color: white;">REFUNDED</span>';
      } else if (refundRequest) {
        const colors = {
          pending: 'var(--warning)',
          approved: 'var(--success)',
          rejected: 'var(--danger)'
        };
        return \`<span class="badge" style="background: \${colors[refundRequest.status]}; color: white;">
          REFUND \${refundRequest.status.toUpperCase()}
        </span>\`;
      } else if (canRefund && currentUser.remainingRefunds > 0) {
        return \`<button onclick="requestRefund('\${orderId}', '\${acc.username}')" class="btn btn-warning btn-sm">
          Request Refund
        </button>\`;
      }
      return '';
    }
    
    // Copy Cookies
    function copyCookies(orderId, accountIndex) {
      const textarea = document.getElementById(\`cookies-\${orderId}-\${accountIndex}\`);
      if (!textarea) {
        showStatus('Failed to find cookies', 'error');
        return;
      }
      
      const cookies = textarea.value;
      
      if (!cookies || cookies === 'N/A') {
        showStatus('No cookies to copy', 'error');
        return;
      }
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(cookies).then(() => {
          showStatus('Cookies copied to clipboard!', 'success');
          
          // Visual feedback
          const button = event.target;
          const originalText = button.textContent;
          button.textContent = 'Copied!';
          button.style.background = 'var(--success)';
          
          setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
          }, 2000);
        }).catch(() => {
          fallbackCopy(cookies);
        });
      } else {
        fallbackCopy(cookies);
      }
    }
    
    // Copy All Cookies
    function copyAllCookies(orderId) {
      const container = document.getElementById('accounts-' + orderId);
      const textareas = container.querySelectorAll('textarea[id^="cookies-"]');
      
      let allCookies = [];
      textareas.forEach((textarea, index) => {
        const cookies = textarea.value;
        if (cookies && cookies !== 'N/A') {
          allCookies.push(\`Account #\${index + 1}:\\n\${cookies}\`);
        }
      });
      
      if (allCookies.length === 0) {
        showStatus('No cookies to copy', 'error');
        return;
      }
      
      const combinedCookies = allCookies.join('\\n\\n---\\n\\n');
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(combinedCookies).then(() => {
          showStatus(\`Copied cookies from \${allCookies.length} accounts!\`, 'success');
        }).catch(() => {
          fallbackCopy(combinedCookies);
        });
      } else {
        fallbackCopy(combinedCookies);
      }
    }
    
    // Direct Email Check (Single Click)
    async function checkEmailDirect(email) {
      // Show modal immediately
      const modal = document.getElementById('emailModal');
      const content = document.getElementById('emailModalContent');
      modal.classList.add('active');
      content.innerHTML = '<div class="loading">Loading emails</div>';
      
      try {
        const response = await fetch('/api/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email,
            username: currentUser.username
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          if (data.parsed && data.parsed.success && data.parsed.data) {
            displayEmails(data.parsed.data);
          } else {
            content.innerHTML = \`
              <div class="card">
                <pre style="white-space: pre-wrap; color: var(--text-secondary);">\${data.content || 'No content found'}</pre>
              </div>
            \`;
          }
        } else {
          content.innerHTML = \`
            <div class="card text-center">
              <p style="color: var(--danger);">\${data.error || 'Failed to check email'}</p>
            </div>
          \`;
        }
      } catch (error) {
        content.innerHTML = \`
          <div class="card text-center">
            <p style="color: var(--danger);">Connection error</p>
          </div>
        \`;
      }
    }
    
    // Display Emails
    function displayEmails(emails) {
      const content = document.getElementById('emailModalContent');
      
      if (!emails || emails.length === 0) {
        content.innerHTML = '<div class="card text-center"><p style="color: var(--text-muted);">No emails found</p></div>';
        return;
      }
      
      let html = '<div class="email-list">';
      
      emails.forEach((email, index) => {
        const date = new Date(email.date).toLocaleString();
        const hasCode = email.code && email.code !== 'null' && email.code !== 'title';
        
        html += \`
          <div class="email-item">
            <div class="email-meta">
              <div>
                <div class="email-from">\${email.from || 'Unknown Sender'}</div>
                <div class="email-date">\${date}</div>
              </div>
              <span class="badge badge-info">Email #\${index + 1}</span>
            </div>
            
            <div class="email-subject">\${email.subject || 'No Subject'}</div>
            
            \${hasCode ? \`
              <div class="email-code-box">
                <div class="email-code-label">Verification Code</div>
                <div class="email-code">\${email.code}</div>
              </div>
            \` : ''}
            
            \${email.link ? \`
              <div class="mt-20">
                <a href="\${email.link}" target="_blank" class="btn btn-info btn-sm">
                  Open Link
                </a>
              </div>
            \` : ''}
            
            <div class="email-actions">
              <button onclick="toggleContent('content-\${index}')" class="btn btn-secondary btn-sm">
                View Full Content
              </button>
              \${hasCode ? \`
                <button onclick="copyCode('\${email.code}')" class="btn btn-success btn-sm">
                  Copy Code
                </button>
              \` : ''}
            </div>
            
            <div id="content-\${index}" class="email-content-full hidden">
              \${email.contents ? 
                (email.contents.includes('<html') ? 
                  \`<iframe class="email-iframe" srcdoc="\${escapeHtml(email.contents)}"></iframe>\` :
                  \`<pre style="white-space: pre-wrap; color: var(--text-secondary);">\${escapeHtml(email.contents)}</pre>\`
                ) : 
                '<p style="color: var(--text-muted);">No content available</p>'
              }
            </div>
          </div>
        \`;
      });
      
      html += '</div>';
      content.innerHTML = html;
    }
    
    // Toggle Content
    function toggleContent(id) {
      const content = document.getElementById(id);
      if (content) {
        content.classList.toggle('hidden');
        event.target.textContent = content.classList.contains('hidden') ? 
          'View Full Content' : 'Hide Content';
      }
    }
    
    // Copy Code
    function copyCode(code) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
          showStatus('Code copied!', 'success');
        }).catch(() => {
          fallbackCopy(code);
        });
      } else {
        fallbackCopy(code);
      }
    }
    
    // Fallback Copy
    function fallbackCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      
      try {
        document.execCommand('copy');
        showStatus('Copied!', 'success');
      } catch (err) {
        showStatus('Failed to copy', 'error');
      }
      
      document.body.removeChild(textarea);
    }
    
    // Request Refund
    async function requestRefund(orderId, accountUsername) {
      const reason = prompt('Please provide a reason for the refund (minimum 10 characters):');
      
      if (!reason || reason.trim().length < 10) {
        showStatus('Please provide a detailed reason', 'error');
        return;
      }
      
      try {
        const response = await fetch('/api/refund-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: currentUser.username,
            orderId,
            accountUsername,
            reason: reason.trim()
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          showStatus('Refund request submitted', 'success');
          loadOrders();
          loadRefundStatus();
        } else {
          showStatus(data.error || 'Request failed', 'error');
        }
      } catch (error) {
        showStatus('Connection error', 'error');
      }
    }
    
    // Download Accounts
    function downloadAccounts(orderId) {
      const container = document.getElementById('accounts-' + orderId);
      const accounts = [];
      
      container.querySelectorAll('.account-card').forEach((card, index) => {
        const getDetail = (label) => {
          const row = Array.from(card.querySelectorAll('.detail-row')).find(
            r => r.querySelector('.detail-label').textContent.includes(label)
          );
          if (!row) return '';
          
          // Special handling for 2FA Secret
          if (label === '2FA Secret') {
            const codeElement = row.querySelector('code');
            return codeElement ? codeElement.textContent.trim() : 'N/A';
          }
          
          // For other fields, get the text content but clean it up
          const valueElement = row.querySelector('.detail-value');
          if (!valueElement) return '';
          
          // Get the first text node or the text before any buttons
          const textContent = valueElement.childNodes[0];
          if (textContent && textContent.nodeType === Node.TEXT_NODE) {
            return textContent.textContent.trim();
          }
          
          // Fallback: get all text and split by button text
          return valueElement.textContent.split('Copy')[0].trim();
        };
        
        // Get current TOTP code if available
        const totpElement = document.getElementById(\`totp-\${orderId}-\${index}\`);
        const currentTOTP = totpElement && totpElement.textContent !== '------' ? totpElement.textContent : 'N/A';
        
        accounts.push(
          \`Account #\${index + 1}\\n\` +
          \`Username: \${getDetail('Username')}\\n\` +
          \`Password: \${getDetail('Password')}\\n\` +
          \`Email: \${getDetail('Email').split(' ')[0]}\\n\` +
          \`2FA Secret: \${getDetail('2FA Secret')}\\n\` +
          \`Current 2FA Code: \${currentTOTP}\\n\` +
          \`Cookies: \${card.querySelector('textarea')?.value || 'N/A'}\\n\` +
          \`--------------------\`
        );
      });
      
      const blob = new Blob([accounts.join('\\n\\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`tiktok-accounts-\${orderId}.txt\`;
      a.click();
      URL.revokeObjectURL(url);
      
      showStatus('Accounts downloaded with 2FA codes!', 'success');
    }
    
    // Close Email Modal
    function closeEmailModal() {
      document.getElementById('emailModal').classList.remove('active');
    }
    
    // Show Status
    function showStatus(message, type = 'info') {
      const status = document.getElementById('statusMessage');
      status.textContent = message;
      status.className = 'status-message ' + type + ' show';
      
      setTimeout(() => {
        status.classList.remove('show');
      }, 3000);
    }
    
    // Logout
    function logout() {
      // Clean up any running TOTP intervals
      cleanupTOTPIntervals();
      
      currentUser = null;
      document.getElementById('userDashboard').classList.add('hidden');
      document.getElementById('loginSection').classList.remove('hidden');
      document.getElementById('loginForm').reset();
      showStatus('Signed out successfully', 'info');
    }
    
    // Escape HTML
    function escapeHtml(unsafe) {
      return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  </script>
</body>
</html>`;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}