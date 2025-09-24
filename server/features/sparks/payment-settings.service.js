/**
 * Payment Settings Handler
 * Manages payment settings, rates, and commission configurations
 */

/**
 * Initialize payment settings tables
 */
export async function initializePaymentTables(db) {
  try {
    // Create payment_settings table for global and creator-specific settings
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS payment_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        team_id TEXT,
        setting_type TEXT NOT NULL, -- 'global' or 'creator'
        creator_name TEXT, -- NULL for global, creator name for specific
        base_rate REAL DEFAULT 1.0,
        commission_rate REAL DEFAULT 0, -- Percentage (0-100)
        commission_type TEXT DEFAULT 'percentage', -- 'percentage' or 'fixed'
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, team_id, setting_type, creator_name)
      )
    `).run();

    // Create payment_history table
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS payment_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        team_id TEXT,
        creator_name TEXT NOT NULL,
        payment_date DATETIME NOT NULL,
        video_count INTEGER NOT NULL,
        base_amount REAL NOT NULL,
        commission_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'completed',
        notes TEXT,
        spark_ids TEXT, -- JSON array of spark IDs
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create indexes for better performance
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_payment_settings_user_team 
      ON payment_settings(user_id, team_id)
    `).run();

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_payment_settings_creator 
      ON payment_settings(creator_name)
    `).run();

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_payment_history_user_team 
      ON payment_history(user_id, team_id)
    `).run();

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_payment_history_creator 
      ON payment_history(creator_name)
    `).run();

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_payment_history_date 
      ON payment_history(payment_date)
    `).run();

    console.log('Payment tables initialized successfully');
    return true;
  } catch (error) {
    console.error('Payment tables initialization error:', error);
    return false;
  }
}

/**
 * Get payment settings for a user/team
 */
export async function getPaymentSettings(db, userId, teamId) {
  try {
    const query = teamId
      ? 'SELECT * FROM payment_settings WHERE (user_id = ? OR team_id = ?) AND is_active = 1'
      : 'SELECT * FROM payment_settings WHERE user_id = ? AND team_id IS NULL AND is_active = 1';
    
    const params = teamId ? [userId, teamId] : [userId];
    const result = await db.prepare(query).bind(...params).all();
    
    return result.results || [];
  } catch (error) {
    console.error('Error getting payment settings:', error);
    return [];
  }
}

/**
 * Save or update payment settings
 */
export async function savePaymentSettings(db, settings) {
  try {
    const {
      userId,
      teamId,
      settingType,
      creatorName,
      baseRate,
      commissionRate,
      commissionType
    } = settings;

    const id = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Use REPLACE INTO to handle both insert and update
    await db.prepare(`
      REPLACE INTO payment_settings (
        id, user_id, team_id, setting_type, creator_name,
        base_rate, commission_rate, commission_type,
        is_active, updated_at
      ) VALUES (
        COALESCE((
          SELECT id FROM payment_settings 
          WHERE user_id = ? AND 
                ${teamId ? 'team_id = ?' : 'team_id IS NULL'} AND 
                setting_type = ? AND 
                ${creatorName ? 'creator_name = ?' : 'creator_name IS NULL'}
        ), ?),
        ?, ?, ?, ?,
        ?, ?, ?,
        1, CURRENT_TIMESTAMP
      )
    `).bind(
      userId,
      ...(teamId ? [teamId] : []),
      settingType,
      ...(creatorName ? [creatorName] : []),
      id,
      userId,
      teamId,
      settingType,
      creatorName,
      baseRate,
      commissionRate || 0,
      commissionType || 'percentage'
    ).run();

    return { success: true, id };
  } catch (error) {
    console.error('Error saving payment settings:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate payment with commission
 */
export function calculatePaymentWithCommission(videoCount, baseRate, commissionRate, commissionType = 'percentage') {
  const baseAmount = videoCount * baseRate;
  let commissionAmount = 0;

  if (commissionRate > 0) {
    if (commissionType === 'percentage') {
      commissionAmount = baseAmount * (commissionRate / 100);
    } else if (commissionType === 'fixed') {
      commissionAmount = videoCount * commissionRate;
    }
  }

  return {
    baseAmount: baseAmount.toFixed(2),
    commissionAmount: commissionAmount.toFixed(2),
    totalAmount: (baseAmount + commissionAmount).toFixed(2)
  };
}

/**
 * Record payment in history
 */
export async function recordPayment(db, paymentData) {
  try {
    const id = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.prepare(`
      INSERT INTO payment_history (
        id, user_id, team_id, creator_name, payment_date,
        video_count, base_amount, commission_amount, total_amount,
        payment_method, payment_status, notes, spark_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      paymentData.userId,
      paymentData.teamId || null,
      paymentData.creatorName,
      paymentData.paymentDate || new Date().toISOString(),
      paymentData.videoCount,
      paymentData.baseAmount,
      paymentData.commissionAmount || 0,
      paymentData.totalAmount,
      paymentData.paymentMethod || 'Manual',
      paymentData.paymentStatus || 'completed',
      paymentData.notes || null,
      JSON.stringify(paymentData.sparkIds || [])
    ).run();

    return { success: true, id };
  } catch (error) {
    console.error('Error recording payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get payment history
 */
export async function getPaymentHistory(db, userId, teamId, filters = {}) {
  try {
    let query = `
      SELECT * FROM payment_history 
      WHERE (user_id = ? ${teamId ? 'OR team_id = ?' : ''})
    `;
    
    const params = teamId ? [userId, teamId] : [userId];

    if (filters.creatorName) {
      query += ' AND creator_name = ?';
      params.push(filters.creatorName);
    }

    if (filters.dateFrom) {
      query += ' AND payment_date >= ?';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ' AND payment_date <= ?';
      params.push(filters.dateTo);
    }

    query += ' ORDER BY payment_date DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    const result = await db.prepare(query).bind(...params).all();
    
    return result.results || [];
  } catch (error) {
    console.error('Error getting payment history:', error);
    return [];
  }
}

/**
 * Handle payment settings API requests
 */
export async function handlePaymentSettings(request, env, userInfo) {
  console.log('handlePaymentSettings called with URL:', request.url);
  const db = env.DASHBOARD_DB;
  const { userId, teamId } = userInfo;
  const url = new URL(request.url);
  const pathname = url.pathname.replace('/api/sparks', '');
  console.log('Payment Settings - pathname:', pathname, 'method:', request.method);

  // Initialize payment tables if needed
  await initializePaymentTables(db);

  try {
    // GET payment settings
    if (request.method === 'GET' && pathname.includes('/payment-settings')) {
      const settings = await getPaymentSettings(db, userId, teamId);
      return new Response(JSON.stringify({ success: true, settings }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST/PUT save payment settings
    if ((request.method === 'POST' || request.method === 'PUT') && pathname.includes('/payment-settings')) {
      const data = await request.json();
      const result = await savePaymentSettings(db, {
        userId,
        teamId,
        ...data
      });
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET payment history
    if (request.method === 'GET' && pathname.includes('/payment-history')) {
      const filters = {
        creatorName: url.searchParams.get('creator'),
        dateFrom: url.searchParams.get('dateFrom'),
        dateTo: url.searchParams.get('dateTo'),
        limit: url.searchParams.get('limit')
      };
      
      const history = await getPaymentHistory(db, userId, teamId, filters);
      return new Response(JSON.stringify({ success: true, history }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST record payment
    if (request.method === 'POST' && pathname.includes('/record-payment')) {
      const data = await request.json();
      const result = await recordPayment(db, {
        userId,
        teamId,
        ...data
      });
      
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid payment endpoint' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Payment settings API error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}