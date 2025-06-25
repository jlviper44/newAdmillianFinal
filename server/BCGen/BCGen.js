// Hard-coded admin users who bypass payment requirements
const ADMIN_USERS = ['user_uZ1HxkxpdULMs', 'user_7vMF2GI5Dz3YT'];

// Helper function to check if a user is an admin
function isAdminUser(userId) {
  return ADMIN_USERS.includes(userId);
}

export default class BCGen {
  constructor(env) {
    this.env = env;
    
    // Country to SheetDB sheet name mapping
    this.COUNTRY_SHEETS = {
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
  }

  async initializeTables() {
    try {
      // Create orders table if it doesn't exist
      await this.env.BCGEN_DB.prepare(`
        CREATE TABLE IF NOT EXISTS orders (
          orderId TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          country TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          totalPrice REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          createdAt TEXT NOT NULL,
          fulfilledAt TEXT,
          accountsData TEXT
        )
      `).run();

      // Create cache table for storing availability data
      await this.env.BCGEN_DB.prepare(`
        CREATE TABLE IF NOT EXISTS cache (
          key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )
      `).run();

      // Create indices for better performance
      await this.env.BCGEN_DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_orders_userId ON orders(userId)
      `).run();

      await this.env.BCGEN_DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)
      `).run();

      await this.env.BCGEN_DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_orders_createdAt ON orders(createdAt)
      `).run();

      return true;
    } catch (error) {
      console.error('Error initializing BCGen tables:', error);
      return false;
    }
  }

  async getAvailability() {
    try {
      const SHEETDB_API_URL = this.env.SHEETDB_API_URL || 'https://sheetdb.io/api/v1/zb48wyyweh0rp';
      
      // Try to get cached availability first
      const cacheKey = 'bcgen:availability:all';
      const cached = await this.env.BCGEN_DB.prepare(
        'SELECT data, timestamp FROM cache WHERE key = ?1'
      ).bind(cacheKey).first();
      
      if (cached && cached.timestamp) {
        const cacheAge = Date.now() - new Date(cached.timestamp).getTime();
        if (cacheAge < 300000) { // 5 minutes cache
          return { success: true, ...JSON.parse(cached.data) };
        }
      }
      
      const availability = {};
      
      // Fetch availability from each sheet
      for (const [countryKey, sheetName] of Object.entries(this.COUNTRY_SHEETS)) {
        try {
          const response = await fetch(
            `${SHEETDB_API_URL}?sheet=${sheetName}`,
            {
              headers: {
                'Accept': 'application/json',
              }
            }
          );
          
          if (response.ok) {
            const accounts = await response.json();
            availability[countryKey] = accounts.length;
          } else {
            availability[countryKey] = 0;
          }
        } catch (error) {
          console.error(`Error fetching ${sheetName}:`, error);
          availability[countryKey] = 0;
        }
      }
      
      // Cache the results
      await this.env.BCGEN_DB.prepare(`
        INSERT OR REPLACE INTO cache (key, data, timestamp)
        VALUES (?1, ?2, ?3)
      `).bind(
        cacheKey,
        JSON.stringify(availability),
        new Date().toISOString()
      ).run();

      return { success: true, ...availability };
    } catch (error) {
      console.error('Error getting availability:', error);
      return { error: 'Failed to get availability' };
    }
  }

  async createOrder(data, userId, session) {
    try {
      const { country, quantity } = data;

      if (!country || !quantity || quantity <= 0) {
        return { error: 'Invalid order parameters' };
      }

      // Check if we have a valid sheet name for this country
      const sheetName = this.COUNTRY_SHEETS[country.toLowerCase()];
      if (!sheetName) {
        return { error: 'Invalid country' };
      }

      // Check availability before creating order
      const availabilityData = await this.getAvailability();
      const availableCount = availabilityData[country.toLowerCase()] || 0;
      
      if (availableCount < quantity) {
        return { 
          error: `Insufficient accounts available. Only ${availableCount} accounts available for ${country}`,
          available: availableCount 
        };
      }

      // Generate order ID
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      // Calculate total price (using credits instead of money)
      const creditsPerAccount = 1; // 1 credit per account
      const totalCredits = quantity * creditsPerAccount;

      // Check user credits before proceeding
      // Note: Actual credit deduction happens after successful order fulfillment

      // Create order record
      const orderData = {
        orderId,
        userId,
        country,
        quantity,
        totalPrice: totalCredits,
        status: 'pending',
        createdAt: new Date().toISOString(),
        accounts: []
      };

      // Store order in database
      await this.env.BCGEN_DB.prepare(`
        INSERT INTO orders (orderId, userId, country, quantity, totalPrice, status, createdAt, accountsData)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `).bind(
        orderId,
        userId,
        country,
        quantity,
        totalCredits,
        'pending',
        orderData.createdAt,
        JSON.stringify([])
      ).run();

      // Fetch accounts from SheetDB immediately (synchronously for better UX)
      const userEmail = session?.user?.email || '';
      const fulfillmentResult = await this.fulfillOrderFromSheetDB(orderId, country, quantity, sheetName, userId, userEmail);

      if (!fulfillmentResult.success) {
        // If fulfillment failed, mark order as failed
        await this.env.BCGEN_DB.prepare(`
          UPDATE orders 
          SET status = ?1
          WHERE orderId = ?2
        `).bind('failed', orderId).run();

        return {
          error: fulfillmentResult.error || 'Failed to fulfill order',
          orderId
        };
      }

      // Deduct credits after successful fulfillment
      try {
        const creditDeductionResult = await this.deductUserCredits(session, totalCredits);
        if (creditDeductionResult.success) {
          console.log(`Successfully deducted ${totalCredits} BC Gen credits for order ${orderId}`);
        } else {
          console.error(`Failed to deduct credits for order ${orderId}:`, creditDeductionResult.error);
          // Note: Order was fulfilled successfully, so we continue despite credit deduction failure
        }
      } catch (creditError) {
        console.error('Error deducting credits:', creditError);
        // Note: Order was fulfilled successfully, so we continue despite credit deduction failure
      }

      return {
        success: true,
        orderId,
        message: 'Order created and fulfilled successfully',
        order: fulfillmentResult.order
      };
    } catch (error) {
      console.error('Error creating order:', error);
      return { error: 'Failed to create order' };
    }
  }

  async getUserOrders(userId) {
    try {
      const orders = await this.env.BCGEN_DB.prepare(`
        SELECT * FROM orders 
        WHERE userId = ?1 
        ORDER BY createdAt DESC
      `).bind(userId).all();

      // Parse accounts data for each order
      const formattedOrders = orders.results.map(order => ({
        ...order,
        accounts: order.accountsData ? JSON.parse(order.accountsData) : []
      }));

      return {
        success: true,
        orders: formattedOrders
      };
    } catch (error) {
      console.error('Error getting user orders:', error);
      console.error('Error details:', error.message);
      console.error('User ID:', userId);
      return { error: 'Failed to get orders', details: error.message };
    }
  }

  async getOrderStatus(orderId, userId) {
    try {
      const order = await this.env.BCGEN_DB.prepare(`
        SELECT * FROM orders 
        WHERE orderId = ?1 AND userId = ?2
      `).bind(orderId, userId).first();

      if (!order) {
        return { error: 'Order not found' };
      }

      // Parse accounts data
      const accounts = order.accountsData ? JSON.parse(order.accountsData) : [];

      return {
        success: true,
        order: {
          ...order,
          accounts
        }
      };
    } catch (error) {
      console.error('Error getting order status:', error);
      return { error: 'Failed to get order status' };
    }
  }

  // Deduct credits from user's BC Gen memberships
  async deductUserCredits(session, credits) {
    try {
      if (!session || !session.access_token) {
        return { error: 'No valid session for credit deduction' };
      }

      // Check if user is an admin - admins don't need to deduct credits
      if (session.user && isAdminUser(session.user.id)) {
        console.log(`Admin user ${session.user.id} - skipping credit deduction`);
        return { success: true };
      }

      // Get user's memberships from Whop
      const membershipResponse = await fetch('https://api.whop.com/api/v5/me/memberships', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!membershipResponse.ok) {
        return { error: 'Failed to fetch memberships' };
      }
      
      const memberships = await membershipResponse.json();
      
      // Filter memberships with credits for BC Gen
      const bcGenProductId = this.env.WHOP_BC_GEN_PRODUCT_ID;
      const creditMemberships = memberships.data?.filter(m => 
        m.metadata?.Quantity && 
        parseInt(m.metadata.Quantity) > 0 &&
        (m.metadata?.ProductType === 'bc_gen' || m.product_id === bcGenProductId)
      ) || [];
      
      // Sort by quantity (ascending) to use smaller quantities first
      creditMemberships.sort((a, b) => 
        parseInt(a.metadata.Quantity) - parseInt(b.metadata.Quantity)
      );
      
      let remainingCredits = credits;
      const updates = [];
      
      // Calculate credit usage
      for (const membership of creditMemberships) {
        if (remainingCredits <= 0) break;
        
        const currentQuantity = parseInt(membership.metadata.Quantity);
        const toSubtract = Math.min(currentQuantity, remainingCredits);
        const newQuantity = currentQuantity - toSubtract;
        
        updates.push({
          membershipId: membership.id,
          newQuantity: newQuantity
        });
        
        remainingCredits -= toSubtract;
      }
      
      if (remainingCredits > 0) {
        return { error: 'Insufficient credits' };
      }
      
      // Apply updates to memberships
      for (const update of updates) {
        try {
          // Use the same endpoint as Auth module
          const response = await fetch(`https://api.whop.com/api/v2/memberships/${update.membershipId}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.env.WHOP_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              metadata: {
                Quantity: update.newQuantity
              }
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to update membership ${update.membershipId}: ${response.status} - ${errorText}`);
          } else {
            console.log(`Updated membership ${update.membershipId}: ${update.newQuantity} credits remaining`);
          }
        } catch (error) {
          console.error(`Error updating membership ${update.membershipId}:`, error);
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error deducting credits:', error);
      return { error: 'Failed to deduct credits' };
    }
  }

  async refundRequest(data, userId) {
    try {
      const { orderId, accountUsername } = data;

      if (!orderId || !accountUsername) {
        return { error: 'Invalid refund parameters' };
      }

      // Get the order
      const order = await this.env.BCGEN_DB.prepare(`
        SELECT * FROM orders 
        WHERE orderId = ?1 AND userId = ?2
      `).bind(orderId, userId).first();

      if (!order) {
        return { error: 'Order not found' };
      }

      // Check if order is eligible for refund (within 24 hours)
      const orderDate = new Date(order.createdAt);
      const now = new Date();
      const hoursDiff = (now - orderDate) / (1000 * 60 * 60);

      if (hoursDiff > 24) {
        return { error: 'Refund period has expired (24 hours)' };
      }

      // Parse accounts and mark the specific account as refunded
      const accounts = order.accountsData ? JSON.parse(order.accountsData) : [];
      const accountIndex = accounts.findIndex(acc => 
        acc.Username === accountUsername || acc.username === accountUsername
      );

      if (accountIndex === -1) {
        return { error: 'Account not found in order' };
      }

      accounts[accountIndex].refunded = true;

      // Update order in database
      await this.env.BCGEN_DB.prepare(`
        UPDATE orders 
        SET accountsData = ?1 
        WHERE orderId = ?2
      `).bind(JSON.stringify(accounts), orderId).run();

      return {
        success: true,
        message: 'Refund request submitted successfully'
      };
    } catch (error) {
      console.error('Error processing refund:', error);
      return { error: 'Failed to process refund request' };
    }
  }

  // Fulfill order by fetching accounts from SheetDB
  async fulfillOrderFromSheetDB(orderId, country, quantity, sheetName, userId, userEmail) {
    try {
      const SHEETDB_API_URL = this.env.SHEETDB_API_URL || 'https://sheetdb.io/api/v1/zb48wyyweh0rp';
      
      // Fetch accounts from SheetDB
      const response = await fetch(
        `${SHEETDB_API_URL}?sheet=${sheetName}&limit=${quantity}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch accounts from SheetDB');
      }
      
      const sheetAccounts = await response.json();
      
      if (!sheetAccounts || sheetAccounts.length < quantity) {
        throw new Error('Not enough accounts available');
      }
      
      // Normalize account data for consistent field names
      const accounts = sheetAccounts.slice(0, quantity).map((account, index) => {
        return {
          Username: account.Username || account.username || '',
          Password: account.Password || account.password || account.PassTiktok || account.passTiktok || '',
          'Recovery Code': account['Recovery Code'] || account['recovery code'] || account.Code2fa || account.code2fa || '',
          Email: account.Email || account.email || account.Mail || account.mail || '',
          'Email Password': account['Email Password'] || account['email password'] || account.Passmail || '',
          cookies: account.cookies || account.Cookies || '',
          country: country,
          // Add additional fields from SheetDB
          ID: account.ID || `${orderId}-${index + 1}`,
          Name: account.Name || '',
          State: account.State || '',
          Status: account.Status || '',
          refunded: false,
          // Keep original data for deletion
          _originalUsername: account.Username || account.username || ''
        };
      });

      // Move accounts to Sold sheet and delete from source sheet
      const movedAccounts = []
      console.log(`Starting to move ${accounts.length} accounts from ${sheetName} to Sold sheet for order ${orderId}`)
      
      for (const account of accounts) {
        try {
          // Get the original account data from the sheet
          const originalIndex = accounts.indexOf(account);
          const originalAccountData = sheetAccounts[originalIndex];
          
          // Start with all original fields from the source account
          const soldData = { ...originalAccountData };
          
          // Override/add specific fields for the Sold sheet with correct column names
          soldData['SoldTo'] = userId;
          soldData['SoldToName'] = userEmail || '';
          soldData['SoldDate'] = new Date().toISOString();
          soldData['OrderId'] = orderId;
          soldData['Original Sheet'] = sheetName;
          
          // Ensure normalized fields are present (for consistency)
          soldData.Username = account.Username;
          soldData.Password = account.Password;
          soldData['Recovery Code'] = account['Recovery Code'] || '';
          soldData.Email = account.Email || '';
          soldData['Email Password'] = account['Email Password'] || '';
          soldData.cookies = account.cookies || '';
          
          console.log(`Moving account ${account._originalUsername} to Sold sheet...`)
          
          // Add to Sold sheet
          const addResponse = await fetch(
            `${SHEETDB_API_URL}?sheet=Sold`,
            {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(soldData)
            }
          )
          
          if (addResponse.ok) {
            // Delete from original sheet using the original username as identifier
            const usernameToDelete = account._originalUsername;
            if (!usernameToDelete) {
              console.error(`No username found for account to delete`);
              continue;
            }
            
            const deleteResponse = await fetch(
              `${SHEETDB_API_URL}/Username/${encodeURIComponent(usernameToDelete)}?sheet=${sheetName}`,
              {
                method: 'DELETE',
                headers: {
                  'Accept': 'application/json',
                }
              }
            )
            
            if (deleteResponse.ok) {
              movedAccounts.push(usernameToDelete)
              console.log(`Account ${usernameToDelete} moved to Sold sheet and deleted from ${sheetName}`)
            } else {
              const errorText = await deleteResponse.text();
              console.error(`Failed to delete account ${usernameToDelete} from ${sheetName}. Status: ${deleteResponse.status}, Error: ${errorText}`)
            }
          } else {
            const errorText = await addResponse.text();
            console.error(`Failed to add account ${account.Username} to Sold sheet. Status: ${addResponse.status}, Error: ${errorText}`)
          }
        } catch (error) {
          console.error(`Error moving account ${account.Username}:`, error)
        }
      }
      
      console.log(`Successfully moved ${movedAccounts.length} of ${accounts.length} accounts to Sold sheet`)
      
      // Clear availability cache since we modified the sheets
      const cacheKey = 'bcgen:availability:all'
      await this.env.BCGEN_DB.prepare('DELETE FROM cache WHERE key = ?1').bind(cacheKey).run()

      // Update order status and add accounts
      await this.env.BCGEN_DB.prepare(`
        UPDATE orders 
        SET status = ?1, accountsData = ?2, fulfilledAt = ?3
        WHERE orderId = ?4
      `).bind(
        'completed',
        JSON.stringify(accounts),
        new Date().toISOString(),
        orderId
      ).run();
      
      console.log(`Order ${orderId} fulfilled with ${accounts.length} accounts from SheetDB`);

      // Get the updated order
      const order = await this.env.BCGEN_DB.prepare(`
        SELECT * FROM orders WHERE orderId = ?1
      `).bind(orderId).first();

      return {
        success: true,
        order: {
          ...order,
          accounts
        }
      };
    } catch (error) {
      console.error('Error fulfilling order from SheetDB:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }


  async handle(request, session) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Check authentication
    if (!session || !session.user || !session.user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = session.user.id;

    // Handle routes
    if (path === '/api/bcgen/availability' && request.method === 'GET') {
      const result = await this.getAvailability();
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/bcgen/create-order' && request.method === 'POST') {
      const data = await request.json();
      const result = await this.createOrder(data, userId, session);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/bcgen/user-orders' && request.method === 'GET') {
      const result = await this.getUserOrders(userId);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path.startsWith('/api/bcgen/order-status/') && request.method === 'GET') {
      const orderId = path.split('/').pop();
      const result = await this.getOrderStatus(orderId, userId);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/bcgen/refund-request' && request.method === 'POST') {
      const data = await request.json();
      const result = await this.refundRequest(data, userId);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}