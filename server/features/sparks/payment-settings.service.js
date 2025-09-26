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
        payment_method TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, team_id, setting_type, creator_name)
      )
    `).run();

    // Add payment_method column if it doesn't exist (for existing tables)
    try {
      await db.prepare(`ALTER TABLE payment_settings ADD COLUMN payment_method TEXT`).run();
      console.log('Added payment_method column to payment_settings table');
    } catch (error) {
      // Column already exists or other error - this is expected for new tables
      if (!error.message.includes('duplicate column name')) {
        console.warn('Could not add payment_method column:', error.message);
      }
    }

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

    // Create weekly_payment_entries table for generated payment reports
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS weekly_payment_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        team_id TEXT,
        va_email TEXT NOT NULL,
        week_start TEXT NOT NULL,
        week_end TEXT NOT NULL,
        sparks_count INTEGER NOT NULL,
        amount REAL NOT NULL,
        original_amount REAL NOT NULL,
        payment_method TEXT,
        status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'voided'
        payment_type TEXT DEFAULT 'weekly',
        generation_type TEXT DEFAULT 'automatic', -- 'automatic', 'early', 'manual'
        generated_by TEXT DEFAULT 'system',
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        paid_at DATETIME,
        voided_at DATETIME,
        spark_ids TEXT, -- JSON array of spark IDs included in this report
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Add payment_method column if it doesn't exist (for existing tables)
    try {
      await db.prepare(`ALTER TABLE weekly_payment_entries ADD COLUMN payment_method TEXT`).run();
      console.log('Added payment_method column to weekly_payment_entries table');
    } catch (error) {
      // Column already exists or other error - this is expected for new tables
      if (!error.message.includes('duplicate column name')) {
        console.warn('Could not add payment_method column to weekly_payment_entries:', error.message);
      }
    }

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

    // Create indexes for weekly payment entries
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_weekly_payment_entries_user_team
      ON weekly_payment_entries(user_id, team_id)
    `).run();

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_weekly_payment_entries_va_email
      ON weekly_payment_entries(va_email)
    `).run();

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_weekly_payment_entries_week
      ON weekly_payment_entries(week_start, week_end)
    `).run();

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_weekly_payment_entries_status
      ON weekly_payment_entries(status)
    `).run();

    console.log('Payment tables initialized successfully');
    return true;
  } catch (error) {
    console.error('Payment tables initialization error:', error);
    try {
      const { logError } = await import('../../shared/utils/logError.js');
      await logError({ DASHBOARD_DB: db }, error, 'payment-settings', { action: 'initializePaymentTables' });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
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
    try {
      const { logError } = await import('../../shared/utils/logError.js');
      await logError({ DASHBOARD_DB: db }, error, 'payment-settings', { action: 'getPaymentSettings', userId, teamId });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
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
      commissionType,
      paymentMethod
    } = settings;

    const id = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use REPLACE INTO to handle both insert and update
    await db.prepare(`
      REPLACE INTO payment_settings (
        id, user_id, team_id, setting_type, creator_name,
        base_rate, commission_rate, commission_type, payment_method,
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
        ?, ?, ?, ?,
        1, CURRENT_TIMESTAMP
      )
    `).bind(
      userId,
      ...(teamId ? [teamId] : []),
      settingType,
      ...(creatorName ? [creatorName] : []),
      id,
      userId,
      teamId || null,
      settingType,
      creatorName || null,
      baseRate,
      commissionRate || 0,
      commissionType || 'percentage',
      paymentMethod || null
    ).run();

    return { success: true, id };
  } catch (error) {
    console.error('Error saving payment settings:', error);
    console.log('>>> ATTEMPTING TO LOG ERROR TO DATABASE <<<');
    try {
      const { logError } = await import('../../shared/utils/logError.js');
      console.log('>>> logError imported, calling it now <<<');
      await logError({ DASHBOARD_DB: db }, error, 'payment-settings', { action: 'savePaymentSettings', userId: settings.userId, teamId: settings.teamId });
      console.log('>>> ERROR LOGGED SUCCESSFULLY <<<');
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
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
    try {
      const { logError } = await import('../../shared/utils/logError.js');
      await logError({ DASHBOARD_DB: db }, error, 'payment-settings', { action: 'recordPayment', userId: paymentData.userId, teamId: paymentData.teamId });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
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
    try {
      const { logError } = await import('../../shared/utils/logError.js');
      await logError({ DASHBOARD_DB: db }, error, 'payment-settings', { action: 'getPaymentHistory', userId, teamId });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
    return [];
  }
}

/**
 * Create weekly payment entry
 */
export async function createWeeklyPaymentEntry(db, entryData) {
  try {
    const id = entryData.id || `weekly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Creating weekly payment entry with data:', {
      id,
      userId: entryData.userId,
      teamId: entryData.teamId,
      va_email: entryData.va_email,
      week_start: entryData.week_start,
      week_end: entryData.week_end,
      sparks_count: entryData.sparks_count,
      amount: entryData.amount,
      original_amount: entryData.original_amount,
      payment_method: entryData.payment_method,
      status: entryData.status || 'pending',
      payment_type: entryData.payment_type || 'weekly',
      generation_type: entryData.generation_type || 'automatic',
      generated_by: entryData.generated_by || 'system',
      generated_at: entryData.generated_at || new Date().toISOString(),
      spark_ids: entryData.spark_ids
    });

    // Ensure all required fields are not undefined
    const cleanData = {
      id,
      userId: entryData.userId,
      teamId: entryData.teamId || null,
      va_email: entryData.va_email,
      week_start: entryData.week_start,
      week_end: entryData.week_end,
      sparks_count: entryData.sparks_count || 0,
      amount: entryData.amount || 0,
      original_amount: entryData.original_amount || 0,
      payment_method: entryData.payment_method || null,
      status: entryData.status || 'pending',
      payment_type: entryData.payment_type || 'weekly',
      generation_type: entryData.generation_type || 'automatic',
      generated_by: entryData.generated_by || 'system',
      generated_at: entryData.generated_at || new Date().toISOString(),
      spark_ids: JSON.stringify(entryData.spark_ids || [])
    };

    await db.prepare(`
      INSERT INTO weekly_payment_entries (
        id, user_id, team_id, va_email, week_start, week_end,
        sparks_count, amount, original_amount, payment_method, status, payment_type,
        generation_type, generated_by, generated_at, spark_ids
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      cleanData.id,
      cleanData.userId,
      cleanData.teamId,
      cleanData.va_email,
      cleanData.week_start,
      cleanData.week_end,
      cleanData.sparks_count,
      cleanData.amount,
      cleanData.original_amount,
      cleanData.payment_method,
      cleanData.status,
      cleanData.payment_type,
      cleanData.generation_type,
      cleanData.generated_by,
      cleanData.generated_at,
      cleanData.spark_ids
    ).run();

    console.log('Weekly payment entry created successfully:', id);
    return { success: true, id };
  } catch (error) {
    console.error('Error creating weekly payment entry:', error);
    try {
      const { logError } = await import('../../shared/utils/logError.js');
      await logError({ DASHBOARD_DB: db }, error, 'weekly-payments', { action: 'createWeeklyPaymentEntry', userId: entryData.userId, teamId: entryData.teamId });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Get weekly payment entries
 */
export async function getWeeklyPaymentEntries(db, userId, teamId) {
  try {
    const query = `
      SELECT * FROM weekly_payment_entries
      WHERE (user_id = ? ${teamId ? 'OR team_id = ?' : ''})
      ORDER BY created_at DESC
    `;

    const params = teamId ? [userId, teamId] : [userId];
    const result = await db.prepare(query).bind(...params).all();

    return result.results || [];
  } catch (error) {
    console.error('Error getting weekly payment entries:', error);
    try {
      const { logError } = await import('../../shared/utils/logError.js');
      await logError({ DASHBOARD_DB: db }, error, 'weekly-payments', { action: 'getWeeklyPaymentEntries', userId, teamId });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
    return [];
  }
}

/**
 * Update weekly payment entry status
 */
export async function updateWeeklyPaymentEntryStatus(db, entryId, status, userId, teamId) {
  try {
    const updateData = { status, updated_at: new Date().toISOString() };

    // Add timestamp fields based on status
    if (status === 'paid') {
      updateData.paid_at = new Date().toISOString();
    } else if (status === 'voided') {
      updateData.voided_at = new Date().toISOString();
    } else if (status === 'pending') {
      // Clear timestamps when reverting to pending
      updateData.paid_at = null;
      updateData.voided_at = null;
    }

    let query = 'UPDATE weekly_payment_entries SET status = ?, updated_at = ?';
    let params = [status, updateData.updated_at];

    if (updateData.paid_at) {
      query += ', paid_at = ?';
      params.push(updateData.paid_at);
    }

    if (updateData.voided_at) {
      query += ', voided_at = ?';
      params.push(updateData.voided_at);
    }

    if (updateData.paid_at === null) {
      query += ', paid_at = NULL';
    }

    if (updateData.voided_at === null) {
      query += ', voided_at = NULL';
    }

    query += ' WHERE id = ? AND (user_id = ? OR team_id = ?)';
    params.push(entryId, userId, teamId || userId);

    await db.prepare(query).bind(...params).run();

    return { success: true };
  } catch (error) {
    console.error('Error updating weekly payment entry status:', error);
    try {
      const { logError } = await import('../../shared/utils/logError.js');
      await logError({ DASHBOARD_DB: db }, error, 'weekly-payments', { action: 'updateWeeklyPaymentEntryStatus', entryId, status, userId, teamId });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Update weekly payment entry amount
 */
export async function updateWeeklyPaymentEntryAmount(db, entryId, amount, userId, teamId) {
  try {
    await db.prepare(`
      UPDATE weekly_payment_entries
      SET amount = ?, updated_at = ?
      WHERE id = ? AND (user_id = ? OR team_id = ?)
    `).bind(
      amount,
      new Date().toISOString(),
      entryId,
      userId,
      teamId || userId
    ).run();

    return { success: true };
  } catch (error) {
    console.error('Error updating weekly payment entry amount:', error);
    try {
      const { logError } = await import('../../shared/utils/logError.js');
      await logError({ DASHBOARD_DB: db }, error, 'weekly-payments', { action: 'updateWeeklyPaymentEntryAmount', entryId, amount, userId, teamId });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Update weekly payment entry payment method
 */
export async function updateWeeklyPaymentEntryPaymentMethod(db, entryId, paymentMethod, userId, teamId) {
  try {
    await db.prepare(`
      UPDATE weekly_payment_entries
      SET payment_method = ?, updated_at = ?
      WHERE id = ? AND (user_id = ? OR team_id = ?)
    `).bind(
      paymentMethod,
      new Date().toISOString(),
      entryId,
      userId,
      teamId || userId
    ).run();

    return { success: true };
  } catch (error) {
    console.error('Error updating weekly payment entry payment method:', error);
    try {
      const { logError } = await import('../../shared/utils/logError.js');
      await logError({ DASHBOARD_DB: db }, error, 'weekly-payments', { action: 'updateWeeklyPaymentEntryPaymentMethod', entryId, paymentMethod, userId, teamId });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
    return { success: false, error: error.message };
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

    // GET weekly payment entries
    if (request.method === 'GET' && pathname.includes('/weekly-payment-entries')) {
      const entries = await getWeeklyPaymentEntries(db, userId, teamId);
      return new Response(JSON.stringify({ success: true, entries }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST create weekly payment entry
    if (request.method === 'POST' && pathname.includes('/weekly-payment-entries')) {
      const data = await request.json();
      const result = await createWeeklyPaymentEntry(db, {
        userId,
        teamId,
        ...data
      });

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // PUT update weekly payment entry status
    if (request.method === 'PUT' && pathname.includes('/weekly-payment-entries/') && pathname.includes('/status')) {
      const pathParts = pathname.split('/');
      const entryId = pathParts[pathParts.findIndex(p => p === 'weekly-payment-entries') + 1];
      const data = await request.json();

      const result = await updateWeeklyPaymentEntryStatus(db, entryId, data.status, userId, teamId);

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // PUT update weekly payment entry amount
    if (request.method === 'PUT' && pathname.includes('/weekly-payment-entries/') && pathname.includes('/amount')) {
      const pathParts = pathname.split('/');
      const entryId = pathParts[pathParts.findIndex(p => p === 'weekly-payment-entries') + 1];
      const data = await request.json();

      const result = await updateWeeklyPaymentEntryAmount(db, entryId, data.amount, userId, teamId);

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // PUT update weekly payment entry payment method
    if (request.method === 'PUT' && pathname.includes('/weekly-payment-entries/') && pathname.includes('/payment-method')) {
      const pathParts = pathname.split('/');
      const entryId = pathParts[pathParts.findIndex(p => p === 'weekly-payment-entries') + 1];
      const data = await request.json();

      const result = await updateWeeklyPaymentEntryPaymentMethod(db, entryId, data.payment_method, userId, teamId);

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
    try {
      const { logError } = await import('../../shared/utils/logError.js');
      await logError(env, error, 'payment-settings', { action: 'handlePaymentSettings', userId: userInfo.userId, teamId: userInfo.teamId, pathname });
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}