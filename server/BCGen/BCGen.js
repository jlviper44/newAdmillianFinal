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

  async createOrder(data, userId) {
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

      // Generate order ID
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

      // Calculate total price (example pricing)
      const pricePerAccount = 5; // $5 per account
      const totalPrice = quantity * pricePerAccount;

      // Create order record
      const orderData = {
        orderId,
        userId,
        country,
        quantity,
        totalPrice,
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
        totalPrice,
        'pending',
        orderData.createdAt,
        JSON.stringify([])
      ).run();

      // Fetch accounts from SheetDB
      this.fulfillOrderFromSheetDB(orderId, country, quantity, sheetName);

      return {
        success: true,
        orderId,
        message: 'Order created successfully'
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
  async fulfillOrderFromSheetDB(orderId, country, quantity, sheetName) {
    // Execute asynchronously
    setTimeout(async () => {
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
        const accounts = sheetAccounts.slice(0, quantity).map((account) => {
          return {
            Username: account.Username || account.username || '',
            Password: account.Password || account.password || account.PassTiktok || account.passTiktok || '',
            'Recovery Code': account['Recovery Code'] || account['recovery code'] || account.Code2fa || account.code2fa || '',
            Email: account.Email || account.email || account.Mail || account.mail || '',
            'Email Password': account['Email Password'] || account['email password'] || account.Passmail || '',
            cookies: account.cookies || account.Cookies || '',
            country: country,
            // Add additional fields from SheetDB
            ID: account.ID || '',
            Name: account.Name || '',
            State: account.State || '',
            Status: account.Status || '',
            refunded: false
          };
        });

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
      } catch (error) {
        console.error('Error fulfilling order from SheetDB:', error);
        
        // Mark order as failed
        await this.env.BCGEN_DB.prepare(`
          UPDATE orders 
          SET status = ?1
          WHERE orderId = ?2
        `).bind('failed', orderId).run();
      }
    }, 2000); // Process after 2 seconds
  }


  async handle(request, session) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Check authentication
    if (!session || !session.user_id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle routes
    if (path === '/api/bcgen/availability' && request.method === 'GET') {
      const result = await this.getAvailability();
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/bcgen/create-order' && request.method === 'POST') {
      const data = await request.json();
      const result = await this.createOrder(data, session.user_id);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/bcgen/user-orders' && request.method === 'GET') {
      const result = await this.getUserOrders(session.user_id);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path.startsWith('/api/bcgen/order-status/') && request.method === 'GET') {
      const orderId = path.split('/').pop();
      const result = await this.getOrderStatus(orderId, session.user_id);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/bcgen/refund-request' && request.method === 'POST') {
      const data = await request.json();
      const result = await this.refundRequest(data, session.user_id);
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