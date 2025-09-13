// Launch Tracker API Handler using D1 Database
// Manages launch tracking entries with weekly organization

// Helper function to convert snake_case to camelCase
const toCamelCase = (str) => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// Helper function to transform database row to camelCase
const transformRow = (row) => {
  if (!row) return null;
  const transformed = {};
  for (const [key, value] of Object.entries(row)) {
    transformed[toCamelCase(key)] = value;
  }
  return transformed;
};

// Helper functions for date/week management
const getESTDate = (date = null) => {
  const baseDate = date ? new Date(date) : new Date();
  const utcTime = baseDate.getTime() + baseDate.getTimezoneOffset() * 60000;
  // Use EST/EDT offset based on daylight saving time
  const isDST = isDaylightSavingTime(baseDate);
  const estOffset = isDST ? -4 : -5; // EDT is UTC-4, EST is UTC-5
  return new Date(utcTime + (3600000 * estOffset));
};

// Check if date is in daylight saving time (US Eastern Time)
const isDaylightSavingTime = (date) => {
  const year = date.getFullYear();
  // DST starts second Sunday in March
  const dstStart = new Date(year, 2, 1); // March 1
  dstStart.setDate(dstStart.getDate() + ((7 - dstStart.getDay()) % 7) + 7); // Second Sunday
  
  // DST ends first Sunday in November
  const dstEnd = new Date(year, 10, 1); // November 1
  dstEnd.setDate(dstEnd.getDate() + ((7 - dstEnd.getDay()) % 7)); // First Sunday
  
  return date >= dstStart && date < dstEnd;
};

// Convert any date to EST/EDT
const toESTDate = (dateString) => {
  if (!dateString) return null;
  return getESTDate(new Date(dateString));
};

// Format date in EST timezone
const formatESTDate = (date) => {
  const estDate = date instanceof Date ? getESTDate(date) : getESTDate(new Date(date));
  return estDate.toISOString().split('T')[0];
};

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getWeekEnd = (date) => {
  const monday = getWeekStart(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
};

const formatWeekKey = (date) => {
  const monday = getWeekStart(date);
  return monday.toISOString().split('T')[0];
};

// Initialize database tables
async function initializeTables(env) {
  // Check if already initialized by checking for a flag in env
  if (env.TABLES_INITIALIZED) return;
  
  try {
    // Create launch_entries table if it doesn't exist
    await env.DASHBOARD_DB.prepare(`
      CREATE TABLE IF NOT EXISTS launch_entries (
        id TEXT PRIMARY KEY,
        va TEXT NOT NULL,
        campaign_id TEXT NOT NULL,
        bc_geo TEXT,
        bc_type TEXT,
        wh_obj TEXT,
        launch_target TEXT,
        status TEXT NOT NULL,
        ban TEXT,
        ad_spend REAL DEFAULT 0,
        bc_spend REAL DEFAULT 0,
        amount_lost REAL DEFAULT 0,
        real_spend REAL DEFAULT 0,
        offer TEXT,
        notes TEXT,
        week_key TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Create indexes separately (D1 syntax)
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_week ON launch_entries (week_key)`).run();
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_va ON launch_entries (va)`).run();
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_campaign ON launch_entries (campaign_id)`).run();
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_status ON launch_entries (status)`).run();

    // Create timeclock_entries table
    await env.DASHBOARD_DB.prepare(`
      CREATE TABLE IF NOT EXISTS timeclock_entries (
        id TEXT PRIMARY KEY,
        va TEXT NOT NULL,
        date TEXT NOT NULL,
        hours_worked REAL NOT NULL,
        bcs_launched INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        day_key TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Create indexes for timeclock
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_timeclock_va ON timeclock_entries (va)`).run();
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_timeclock_date ON timeclock_entries (date)`).run();
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_timeclock_day ON timeclock_entries (day_key)`).run();

    // Create clock_sessions table for storing actual clock in/out timestamps
    await env.DASHBOARD_DB.prepare(`
      CREATE TABLE IF NOT EXISTS clock_sessions (
        id TEXT PRIMARY KEY,
        va TEXT NOT NULL,
        date TEXT NOT NULL,
        clock_in DATETIME NOT NULL,
        clock_out DATETIME,
        hours_worked REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Create indexes for clock_sessions
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_clock_sessions_va ON clock_sessions (va)`).run();
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_clock_sessions_date ON clock_sessions (date)`).run();
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_clock_sessions_status ON clock_sessions (status)`).run();

    // Create VA rates table
    await env.DASHBOARD_DB.prepare(`
      CREATE TABLE IF NOT EXISTS va_rates (
        id TEXT PRIMARY KEY,
        va TEXT NOT NULL,
        hourly_rate REAL NOT NULL,
        commission_rate REAL NOT NULL,
        effective_date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(va, effective_date)
      )
    `).run();
    
    // Create payroll_reports table
    await env.DASHBOARD_DB.prepare(`
      CREATE TABLE IF NOT EXISTS payroll_reports (
        id TEXT PRIMARY KEY,
        va TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        total_hours REAL DEFAULT 0,
        total_real_spend REAL DEFAULT 0,
        hourly_rate REAL DEFAULT 5,
        commission_rate REAL DEFAULT 0.03,
        hourly_pay REAL DEFAULT 0,
        commission_pay REAL DEFAULT 0,
        bonus_amount REAL DEFAULT 0,
        bonus_reason TEXT,
        total_pay REAL DEFAULT 0,
        status TEXT DEFAULT 'unpaid',
        payment_method TEXT,
        payment_date DATETIME,
        edited BOOLEAN DEFAULT 0,
        voided BOOLEAN DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Create indexes for payroll
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_payroll_va ON payroll_reports (va)`).run();
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_payroll_status ON payroll_reports (status)`).run();
    await env.DASHBOARD_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_reports (period_start, period_end)`).run();

    console.log('Launch tracker and payroll tables initialized');
    env.TABLES_INITIALIZED = true;
  } catch (error) {
    console.error('Error initializing tables:', error);
    // Don't set flag on error so it can retry
  }
}

// Get entries for a specific week
async function getEntries(env, week = null) {
  try {
    const weekKey = week || formatWeekKey(getESTDate());
    
    const entries = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM launch_entries 
      WHERE week_key = ?
      ORDER BY timestamp DESC
    `).bind(weekKey).all();
    
    // Transform snake_case to camelCase for frontend
    const transformedEntries = (entries.results || []).map(transformRow);
    
    return { entries: transformedEntries };
  } catch (error) {
    console.error('Error fetching entries:', error);
    return { entries: [] };
  }
}

// Create a new entry
async function createEntry(env, entry) {
  try {
    const now = getESTDate();
    const weekKey = formatWeekKey(now);
    
    // Calculate derived fields
    const adSpend = parseFloat(entry.adSpend || 0);
    const bcSpend = parseFloat(entry.bcSpend || 0);
    const amountLost = bcSpend - adSpend;
    const realSpend = adSpend - amountLost;
    
    const id = entry.id || `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await env.DASHBOARD_DB.prepare(`
      INSERT INTO launch_entries (
        id, va, campaign_id, bc_geo, bc_type, wh_obj, 
        launch_target, status, ban, ad_spend, bc_spend, 
        amount_lost, real_spend, offer, notes, week_key, 
        timestamp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      entry.va,
      entry.campaignId,
      entry.bcGeo || null,
      entry.bcType || null,
      entry.whObj || null,
      entry.launchTarget || null,
      entry.status,
      entry.ban || null,
      adSpend,
      bcSpend,
      amountLost,
      realSpend,
      entry.offer || null,
      entry.notes || null,
      weekKey,
      now.toISOString(),
      now.toISOString()
    ).run();
    
    // Return the created entry with camelCase fields
    const result = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM launch_entries WHERE id = ?
    `).bind(id).first();
    
    return transformRow(result);
  } catch (error) {
    console.error('Error creating entry:', error);
    throw error;
  }
}

// Update an existing entry
async function updateEntry(env, entryId, updates, week = null) {
  try {
    // Get existing entry first
    const existing = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM launch_entries WHERE id = ?
    `).bind(entryId).first();
    
    if (!existing) {
      throw new Error('Entry not found');
    }
    
    // Recalculate derived fields if spend values changed
    let adSpend = existing.ad_spend;
    let bcSpend = existing.bc_spend;
    
    if (updates.adSpend !== undefined) {
      adSpend = parseFloat(updates.adSpend || 0);
    }
    if (updates.bcSpend !== undefined) {
      bcSpend = parseFloat(updates.bcSpend || 0);
    }
    
    const amountLost = bcSpend - adSpend;
    const realSpend = adSpend - amountLost;
    
    // Build update query dynamically
    const updateFields = [];
    const values = [];
    
    const allowedFields = [
      'va', 'campaign_id', 'bc_geo', 'bc_type', 'wh_obj',
      'launch_target', 'status', 'ban', 'offer', 'notes'
    ];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        const dbField = field.replace(/([A-Z])/g, '_$1').toLowerCase();
        updateFields.push(`${dbField} = ?`);
        values.push(updates[field]);
      }
    }
    
    if (updates.adSpend !== undefined || updates.bcSpend !== undefined) {
      updateFields.push('ad_spend = ?', 'bc_spend = ?', 'amount_lost = ?', 'real_spend = ?');
      values.push(adSpend, bcSpend, amountLost, realSpend);
    }
    
    updateFields.push('updated_at = ?');
    values.push(getESTDate().toISOString());
    
    values.push(entryId);
    
    await env.DASHBOARD_DB.prepare(`
      UPDATE launch_entries 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).bind(...values).run();
    
    // Return updated entry with camelCase fields
    const result = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM launch_entries WHERE id = ?
    `).bind(entryId).first();
    
    return transformRow(result);
  } catch (error) {
    console.error('Error updating entry:', error);
    throw error;
  }
}

// Delete an entry
async function deleteEntry(env, entryId, week = null) {
  try {
    await env.DASHBOARD_DB.prepare(`
      DELETE FROM launch_entries WHERE id = ?
    `).bind(entryId).run();
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting entry:', error);
    throw error;
  }
}

// Get weekly summary
async function getWeeklySummary(env, vaName = null) {
  try {
    let query = `
      SELECT 
        week_key,
        COUNT(*) as totalEntries,
        SUM(ad_spend) as totalAdSpend,
        SUM(bc_spend) as totalBCSpend,
        SUM(amount_lost) as totalAmountLost,
        SUM(real_spend) as totalRealSpend,
        status,
        launch_target,
        offer,
        ban,
        wh_obj,
        COUNT(CASE WHEN status = 'Active' THEN 1 END) as activeCount,
        COUNT(CASE WHEN status = 'Banned' THEN 1 END) as bannedCount
      FROM launch_entries
    `;
    
    const params = [];
    if (vaName) {
      query += ' WHERE va = ?';
      params.push(vaName);
    }
    
    query += ' GROUP BY week_key ORDER BY week_key DESC';
    
    const result = await env.DASHBOARD_DB.prepare(query).bind(...params).all();
    
    // Process and format the summaries
    const summaries = [];
    const weekGroups = {};
    
    for (const row of result.results || []) {
      if (!weekGroups[row.week_key]) {
        weekGroups[row.week_key] = {
          week: `week_${row.week_key}`,
          totalEntries: 0,
          totalAdSpend: 0,
          totalBCSpend: 0,
          totalAmountLost: 0,
          totalRealSpend: 0,
          byStatus: {},
          byGeo: {},
          byOffer: {},
          byBan: {},
          byWhObj: {}
        };
      }
      
      const week = weekGroups[row.week_key];
      week.totalEntries = row.totalEntries;
      week.totalAdSpend = row.totalAdSpend || 0;
      week.totalBCSpend = row.totalBCSpend || 0;
      week.totalAmountLost = row.totalAmountLost || 0;
      week.totalRealSpend = row.totalRealSpend || 0;
    }
    
    // Get detailed breakdowns for each week
    for (const weekKey of Object.keys(weekGroups)) {
      const details = await env.DASHBOARD_DB.prepare(`
        SELECT status, launch_target, offer, ban, wh_obj, COUNT(*) as count
        FROM launch_entries
        WHERE week_key = ? ${vaName ? 'AND va = ?' : ''}
        GROUP BY status, launch_target, offer, ban, wh_obj
      `).bind(weekKey, ...(vaName ? [vaName] : [])).all();
      
      const week = weekGroups[weekKey];
      
      for (const detail of details.results || []) {
        if (detail.status) week.byStatus[detail.status] = (week.byStatus[detail.status] || 0) + detail.count;
        if (detail.launch_target) week.byGeo[detail.launch_target] = (week.byGeo[detail.launch_target] || 0) + detail.count;
        if (detail.offer) week.byOffer[detail.offer] = (week.byOffer[detail.offer] || 0) + detail.count;
        if (detail.ban) week.byBan[detail.ban] = (week.byBan[detail.ban] || 0) + detail.count;
        if (detail.wh_obj) week.byWhObj[detail.wh_obj] = (week.byWhObj[detail.wh_obj] || 0) + detail.count;
      }
      
      summaries.push(week);
    }
    
    return summaries;
  } catch (error) {
    console.error('Error getting weekly summary:', error);
    return [];
  }
}

// Export data to CSV
async function exportData(env, week = null) {
  try {
    const weekKey = week || formatWeekKey(getESTDate());
    
    const entries = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM launch_entries 
      WHERE week_key = ?
      ORDER BY timestamp DESC
    `).bind(weekKey).all();
    
    // Create CSV with headers
    const headers = ['VA', 'Time', 'Campaign ID', 'BC GEO', 'BC Type', 'WH Obj', 'Launch Target', 'Status', 'Ban', 'Ad Spend', 'BC Spend', 'Amount Lost', 'Real Spend', 'Offer', 'Notes'];
    const rows = (entries.results || []).map(e => [
      e.va || '',
      new Date(e.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' }),
      e.campaign_id || '',
      e.bc_geo || '',
      e.bc_type || '',
      e.wh_obj || '',
      e.launch_target || '',
      e.status || '',
      e.ban || '',
      e.ad_spend || '0',
      e.bc_spend || '0',
      e.amount_lost || '0',
      e.real_spend || '0',
      e.offer || '',
      e.notes || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="launch_tracker_week_${weekKey}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

// Get available weeks
async function getAvailableWeeks(env) {
  try {
    const weeks = await env.DASHBOARD_DB.prepare(`
      SELECT DISTINCT week_key 
      FROM launch_entries 
      ORDER BY week_key DESC
      LIMIT 12
    `).all();
    
    const result = [];
    for (const row of weeks.results || []) {
      const weekStart = new Date(row.week_key);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      result.push({
        key: row.week_key,
        display: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`
      });
    }
    
    // Always include current week even if no data
    const currentWeekKey = formatWeekKey(getESTDate());
    if (!result.find(w => w.key === currentWeekKey)) {
      const weekStart = new Date(currentWeekKey);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      result.unshift({
        key: currentWeekKey,
        display: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()} (Current)`
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error getting available weeks:', error);
    return [];
  }
}

// Time Clock Functions
async function submitTimeClock(env, data) {
  try {
    const { va, date, hoursWorked, bcsLaunched } = data;
    const dayKey = `day_${date}`;
    const id = `timeclock_${date}_${va}`;
    
    // Check if entry already exists
    const existing = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM timeclock_entries WHERE id = ?
    `).bind(id).first();
    
    if (existing) {
      // Update existing entry
      await env.DASHBOARD_DB.prepare(`
        UPDATE timeclock_entries 
        SET hours_worked = ?, bcs_launched = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(hoursWorked, bcsLaunched, id).run();
    } else {
      // Create new entry
      await env.DASHBOARD_DB.prepare(`
        INSERT INTO timeclock_entries (
          id, va, date, hours_worked, bcs_launched, day_key, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(id, va, date, hoursWorked, bcsLaunched, dayKey).run();
    }
    
    const result = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM timeclock_entries WHERE id = ?
    `).bind(id).first();
    
    return transformRow(result);
  } catch (error) {
    console.error('Error submitting time clock:', error);
    throw error;
  }
}

async function getTimeClockData(env, va, date) {
  try {
    const dayKey = `day_${date}`;
    
    // Get time clock entry
    const timeEntry = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM timeclock_entries 
      WHERE va = ? AND date = ?
    `).bind(va, date).first();
    
    // Get actual launch count for verification
    const launchCount = await env.DASHBOARD_DB.prepare(`
      SELECT COUNT(*) as count FROM launch_entries 
      WHERE va = ? AND DATE(timestamp) = ?
    `).bind(va, date).first();
    
    return {
      timeEntry: transformRow(timeEntry),
      actualLaunches: launchCount?.count || 0,
      dayKey
    };
  } catch (error) {
    console.error('Error getting time clock data:', error);
    throw error;
  }
}

// Clock In/Out Functions with EST timestamps
async function clockIn(env, data) {
  try {
    // Ensure table exists first - force creation
    await env.DASHBOARD_DB.prepare(`
      CREATE TABLE IF NOT EXISTS clock_sessions (
        id TEXT PRIMARY KEY,
        va TEXT NOT NULL,
        date TEXT NOT NULL,
        clock_in DATETIME NOT NULL,
        clock_out DATETIME,
        hours_worked REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    const { va } = data;
    const now = getESTDate();
    const dateKey = now.toISOString().split('T')[0];
    
    // Check if already clocked in
    const activeSession = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM clock_sessions 
      WHERE va = ? AND status = 'active'
      ORDER BY clock_in DESC
      LIMIT 1
    `).bind(va).first();
    
    if (activeSession) {
      return {
        success: false,
        message: 'Already clocked in. Please clock out first.',
        session: transformRow(activeSession)
      };
    }
    
    // Create new clock session with EST timestamp
    const sessionId = `clock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clockInEST = now.toISOString();
    
    await env.DASHBOARD_DB.prepare(`
      INSERT INTO clock_sessions (
        id, va, date, clock_in, status
      ) VALUES (?, ?, ?, ?, 'active')
    `).bind(sessionId, va, dateKey, clockInEST).run();
    
    const newSession = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM clock_sessions WHERE id = ?
    `).bind(sessionId).first();
    
    return {
      success: true,
      message: `Clocked in at ${now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} EST`,
      session: transformRow(newSession)
    };
  } catch (error) {
    console.error('Clock in error:', error);
    throw error;
  }
}

async function clockOut(env, data) {
  try {
    // Ensure table exists first - force creation
    await env.DASHBOARD_DB.prepare(`
      CREATE TABLE IF NOT EXISTS clock_sessions (
        id TEXT PRIMARY KEY,
        va TEXT NOT NULL,
        date TEXT NOT NULL,
        clock_in DATETIME NOT NULL,
        clock_out DATETIME,
        hours_worked REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    const { va, notes } = data;
    const now = getESTDate();
    
    // Find active session
    const activeSession = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM clock_sessions 
      WHERE va = ? AND status = 'active'
      ORDER BY clock_in DESC
      LIMIT 1
    `).bind(va).first();
    
    if (!activeSession) {
      return {
        success: false,
        message: 'Not currently clocked in.'
      };
    }
    
    // Calculate hours worked
    const clockInTime = new Date(activeSession.clock_in);
    const hoursWorked = (now - clockInTime) / (1000 * 60 * 60);
    const clockOutEST = now.toISOString();
    
    // Update session with clock out time
    await env.DASHBOARD_DB.prepare(`
      UPDATE clock_sessions 
      SET clock_out = ?, hours_worked = ?, status = 'completed', notes = ?
      WHERE id = ?
    `).bind(clockOutEST, hoursWorked, notes, activeSession.id).run();
    
    const updatedSession = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM clock_sessions WHERE id = ?
    `).bind(activeSession.id).first();
    
    return {
      success: true,
      message: `Clocked out at ${now.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} EST. Worked ${hoursWorked.toFixed(2)} hours.`,
      session: transformRow(updatedSession)
    };
  } catch (error) {
    console.error('Clock out error:', error);
    throw error;
  }
}

async function getClockStatus(env, va) {
  try {
    // Ensure table exists with correct schema
    await env.DASHBOARD_DB.prepare(`
      CREATE TABLE IF NOT EXISTS clock_sessions (
        id TEXT PRIMARY KEY,
        va TEXT NOT NULL,
        date TEXT NOT NULL,
        clock_in DATETIME NOT NULL,
        clock_out DATETIME,
        hours_worked REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Get active session if any
    const activeSession = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM clock_sessions 
      WHERE va = ? AND status = 'active'
      ORDER BY clock_in DESC
      LIMIT 1
    `).bind(va).first();
    
    if (activeSession) {
      // Calculate current session duration
      const clockInTime = new Date(activeSession.clock_in);
      const now = getESTDate();
      const currentHours = (now - clockInTime) / (1000 * 60 * 60);
      
      return {
        isClockedIn: true,
        session: transformRow(activeSession),
        currentSessionHours: Math.round(currentHours * 100) / 100,
        clockInTime: activeSession.clock_in
      };
    }
    
    // Get today's completed sessions
    const today = getESTDate().toISOString().split('T')[0];
    const todaySessions = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM clock_sessions 
      WHERE va = ? AND date = ? AND status = 'completed'
      ORDER BY clock_in DESC
    `).bind(va, today).all();
    
    const totalHoursToday = (todaySessions.results || []).reduce((sum, s) => sum + (s.hours_worked || 0), 0);
    
    return {
      isClockedIn: false,
      todayHours: Math.round(totalHoursToday * 100) / 100,
      sessions: (todaySessions.results || []).map(transformRow)
    };
  } catch (error) {
    console.error('Get clock status error:', error);
    throw error;
  }
}

// Get daily clock summary
async function getClockDailySummary(env, date) {
  try {
    const targetDate = date || getESTDate().toISOString().split('T')[0];
    
    const result = await env.DASHBOARD_DB.prepare(`
      SELECT 
        va,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sessions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
        SUM(CASE WHEN status = 'completed' THEN hours_worked ELSE 0 END) as total_hours,
        MIN(clock_in) as first_clock_in,
        MAX(clock_out) as last_clock_out
      FROM clock_sessions
      WHERE date = ?
      GROUP BY va
      ORDER BY va
    `).bind(targetDate).all();
    
    return {
      success: true,
      date: targetDate,
      summary: (result.results || []).map(row => ({
        va: row.va,
        totalHours: row.total_hours || 0,
        completedSessions: row.completed_sessions || 0,
        activeSessions: row.active_sessions || 0,
        firstClockIn: row.first_clock_in,
        lastClockOut: row.last_clock_out
      }))
    };
  } catch (error) {
    console.error('Get daily summary error:', error);
    return { success: false, summary: [] };
  }
}

// Get weekly clock summary
async function getClockWeeklySummary(env, startDate) {
  try {
    const start = startDate || getWeekStart(getESTDate()).toISOString().split('T')[0];
    const startDateObj = new Date(start);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(startDateObj.getDate() + 6);
    const end = endDateObj.toISOString().split('T')[0];
    
    // Get data grouped by VA and date
    const result = await env.DASHBOARD_DB.prepare(`
      SELECT 
        va,
        date,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as sessions,
        SUM(CASE WHEN status = 'completed' THEN hours_worked ELSE 0 END) as hours_worked
      FROM clock_sessions
      WHERE date >= ? AND date <= ?
      GROUP BY va, date
      ORDER BY va, date
    `).bind(start, end).all();
    
    // Organize data
    const byVA = {};
    const byDay = {};
    
    (result.results || []).forEach(row => {
      // By VA
      if (!byVA[row.va]) {
        byVA[row.va] = {
          totalHours: 0,
          daysWorked: 0,
          dailyHours: {}
        };
      }
      byVA[row.va].totalHours += row.hours_worked || 0;
      if (row.hours_worked > 0) byVA[row.va].daysWorked++;
      byVA[row.va].dailyHours[row.date] = row.hours_worked || 0;
      
      // By Day
      if (!byDay[row.date]) {
        byDay[row.date] = {
          totalHours: 0,
          vaCount: 0
        };
      }
      byDay[row.date].totalHours += row.hours_worked || 0;
      if (row.hours_worked > 0) byDay[row.date].vaCount++;
    });
    
    return {
      success: true,
      weekStart: start,
      weekEnd: end,
      byVA,
      byDay
    };
  } catch (error) {
    console.error('Get weekly summary error:', error);
    return { success: false, byVA: {}, byDay: {} };
  }
}

// Payroll Functions
async function getPayrollData(env, va, startDate, endDate) {
  try {
    // Convert dates to EST for consistent querying
    const estStartDate = formatESTDate(startDate);
    const estEndDate = formatESTDate(endDate);
    
    // Get time entries for period
    const timeEntries = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM timeclock_entries 
      WHERE va = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(va, estStartDate, estEndDate).all();
    
    // Get clock sessions for daily breakdown
    const clockSessions = await env.DASHBOARD_DB.prepare(`
      SELECT date, va, SUM(hours_worked) as hours
      FROM clock_sessions
      WHERE va = ? AND date >= ? AND date <= ?
      GROUP BY date, va
      ORDER BY date ASC
    `).bind(va, estStartDate, estEndDate).all();
    
    // Get launch entries for real spend calculation
    const launches = await env.DASHBOARD_DB.prepare(`
      SELECT SUM(real_spend) as totalRealSpend 
      FROM launch_entries 
      WHERE va = ? AND DATE(timestamp) >= ? AND DATE(timestamp) <= ?
    `).bind(va, estStartDate, estEndDate).first();
    
    // Calculate totals
    let totalHours = 0;
    const entries = [];
    const dailyBreakdown = [];
    
    // Process timeclock entries
    for (const entry of timeEntries.results || []) {
      totalHours += entry.hours_worked;
      entries.push(transformRow(entry));
    }
    
    // Process clock sessions for daily breakdown
    for (const session of clockSessions.results || []) {
      dailyBreakdown.push({
        date: session.date,
        va: session.va,
        hours: session.hours || 0
      });
    }
    
    // If no clock sessions, use timeclock entries for daily breakdown
    if (dailyBreakdown.length === 0 && timeEntries.results?.length > 0) {
      for (const entry of timeEntries.results) {
        dailyBreakdown.push({
          date: entry.date,
          va: entry.va,
          hours: entry.hours_worked || 0
        });
      }
    }
    
    return {
      entries,
      totalHours,
      totalRealSpend: launches?.totalRealSpend || 0,
      period: { start: startDate, end: endDate },
      dailyBreakdown
    };
  } catch (error) {
    console.error('Error getting payroll data:', error);
    throw error;
  }
}

async function createPayrollReport(env, report) {
  try {
    const id = `payroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Ensure dates are in EST
    const periodStart = formatESTDate(report.period.start);
    const periodEnd = formatESTDate(report.period.end);
    
    // Calculate pay components
    const hourlyPay = report.totalHours * report.hourlyRate;
    const commissionPay = report.totalRealSpend * report.commissionRate;
    const totalPay = hourlyPay + commissionPay + (report.bonusAmount || 0);
    
    await env.DASHBOARD_DB.prepare(`
      INSERT INTO payroll_reports (
        id, va, period_start, period_end, total_hours, total_real_spend,
        hourly_rate, commission_rate, hourly_pay, commission_pay,
        bonus_amount, bonus_reason, total_pay, status, payment_method, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      report.va,
      periodStart,
      periodEnd,
      report.totalHours,
      report.totalRealSpend,
      report.hourlyRate,
      report.commissionRate,
      hourlyPay,
      commissionPay,
      report.bonusAmount || 0,
      report.bonusReason || null,
      totalPay,
      'unpaid',
      report.paymentMethod || null,
      report.notes || null
    ).run();
    
    const result = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM payroll_reports WHERE id = ?
    `).bind(id).first();
    
    return transformRow(result);
  } catch (error) {
    console.error('Error creating payroll report:', error);
    throw error;
  }
}

async function getPayrollReports(env, va = null, status = null) {
  try {
    let query = `SELECT * FROM payroll_reports`;
    const params = [];
    const conditions = [];
    
    if (va) {
      conditions.push('va = ?');
      params.push(va);
    }
    
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const reports = await env.DASHBOARD_DB.prepare(query).bind(...params).all();
    
    return (reports.results || []).map(transformRow);
  } catch (error) {
    console.error('Error getting payroll reports:', error);
    throw error;
  }
}

async function updatePayrollReport(env, reportId, updates) {
  try {
    const updateFields = [];
    const values = [];
    
    // Status updates
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      values.push(updates.status);
      
      // If marking as paid, record payment date
      if (updates.status === 'paid') {
        updateFields.push('payment_date = CURRENT_TIMESTAMP');
      }
    }
    
    // Void report
    if (updates.voided !== undefined) {
      updateFields.push('voided = ?');
      values.push(updates.voided ? 1 : 0);
    }
    
    // Edit payroll details
    if (updates.edited !== undefined) {
      updateFields.push('edited = ?');
      values.push(updates.edited ? 1 : 0);
    }
    
    if (updates.totalHours !== undefined) {
      updateFields.push('total_hours = ?');
      values.push(updates.totalHours);
    }
    
    if (updates.hourlyRate !== undefined) {
      updateFields.push('hourly_rate = ?');
      values.push(updates.hourlyRate);
    }
    
    if (updates.commissionRate !== undefined) {
      updateFields.push('commission_rate = ?');
      values.push(updates.commissionRate);
    }
    
    if (updates.bonusAmount !== undefined) {
      updateFields.push('bonus_amount = ?');
      values.push(updates.bonusAmount);
    }
    
    if (updates.bonusReason !== undefined) {
      updateFields.push('bonus_reason = ?');
      values.push(updates.bonusReason);
    }
    
    // Recalculate pay if rates or hours changed
    if (updates.totalHours !== undefined || updates.hourlyRate !== undefined || 
        updates.commissionRate !== undefined || updates.bonusAmount !== undefined) {
      
      // Get current values
      const current = await env.DASHBOARD_DB.prepare(`
        SELECT * FROM payroll_reports WHERE id = ?
      `).bind(reportId).first();
      
      const hours = updates.totalHours ?? current.total_hours;
      const hourlyRate = updates.hourlyRate ?? current.hourly_rate;
      const commissionRate = updates.commissionRate ?? current.commission_rate;
      const realSpend = updates.totalRealSpend ?? current.total_real_spend;
      const bonus = updates.bonusAmount ?? current.bonus_amount;
      
      const hourlyPay = hours * hourlyRate;
      const commissionPay = realSpend * commissionRate;
      const totalPay = hourlyPay + commissionPay + bonus;
      
      updateFields.push('hourly_pay = ?', 'commission_pay = ?', 'total_pay = ?');
      values.push(hourlyPay, commissionPay, totalPay);
    }
    
    if (updates.paymentMethod !== undefined) {
      updateFields.push('payment_method = ?');
      values.push(updates.paymentMethod);
    }
    
    if (updates.paymentDate !== undefined) {
      updateFields.push('payment_date = ?');
      values.push(updates.paymentDate);
    }
    
    if (updates.notes !== undefined) {
      updateFields.push('notes = ?');
      values.push(updates.notes);
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(reportId);
    
    await env.DASHBOARD_DB.prepare(`
      UPDATE payroll_reports 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `).bind(...values).run();
    
    const result = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM payroll_reports WHERE id = ?
    `).bind(reportId).first();
    
    return transformRow(result);
  } catch (error) {
    console.error('Error updating payroll report:', error);
    throw error;
  }
}

async function exportPayrollReport(env, reportId) {
  try {
    const report = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM payroll_reports WHERE id = ?
    `).bind(reportId).first();
    
    if (!report) {
      throw new Error('Report not found');
    }
    
    // Get time entries for the period
    const timeEntries = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM timeclock_entries 
      WHERE va = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(report.va, report.period_start, report.period_end).all();
    
    // Create CSV
    const headers = ['Date', 'Hours Worked', 'BCs Launched'];
    const rows = (timeEntries.results || []).map(e => [
      e.date,
      e.hours_worked,
      e.bcs_launched
    ]);
    
    // Add summary rows
    rows.push([]);
    rows.push(['Summary', '', '']);
    rows.push(['Total Hours', report.total_hours, '']);
    rows.push(['Total Real Spend', report.total_real_spend, '']);
    rows.push(['Hourly Pay', report.hourly_pay, '']);
    rows.push(['Commission Pay', report.commission_pay, '']);
    rows.push(['Bonus', report.bonus_amount, report.bonus_reason || '']);
    rows.push(['Total Pay', report.total_pay, '']);
    rows.push(['Status', report.status, '']);
    rows.push(['Payment Method', report.payment_method || '', '']);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payroll_${report.va}_${report.period_start}_${report.period_end}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting payroll report:', error);
    throw error;
  }
}

// Get effective rates for a VA on a specific date
async function getEffectiveRates(env, va, date) {
  try {
    // Get the most recent rate that's effective on or before the given date
    const rate = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM va_rates 
      WHERE va = ? AND effective_date <= ?
      ORDER BY effective_date DESC
      LIMIT 1
    `).bind(va, date).first();
    
    if (rate) {
      return {
        hourlyRate: rate.hourly_rate,
        commissionRate: rate.commission_rate
      };
    }
    
    // Default rates if no specific rates found
    return {
      hourlyRate: 5,
      commissionRate: 0.03
    };
  } catch (error) {
    console.error('Error getting effective rates:', error);
    // Return defaults on error
    return {
      hourlyRate: 5,
      commissionRate: 0.03
    };
  }
}

// Save VA rates
async function saveVARates(env, va, hourlyRate, commissionRate, effectiveDate) {
  try {
    const id = `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await env.DASHBOARD_DB.prepare(`
      INSERT OR REPLACE INTO va_rates (id, va, hourly_rate, commission_rate, effective_date)
      VALUES (?, ?, ?, ?, ?)
    `).bind(id, va, hourlyRate, commissionRate, effectiveDate).run();
    
    return { success: true, id };
  } catch (error) {
    console.error('Error saving VA rates:', error);
    return { success: false, error: error.message };
  }
}

async function generateWeeklyPayroll(env) {
  try {
    const now = getESTDate();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - (weekEnd.getDay() || 7)); // Last Sunday
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6); // Previous Monday
    
    const startDate = weekStart.toISOString().split('T')[0];
    const endDate = weekEnd.toISOString().split('T')[0];
    
    // Get all VAs who have time entries or clock sessions for the week
    const vasFromTimeclock = await env.DASHBOARD_DB.prepare(`
      SELECT DISTINCT va FROM timeclock_entries 
      WHERE date >= ? AND date <= ?
    `).bind(startDate, endDate).all();
    
    const vasFromClock = await env.DASHBOARD_DB.prepare(`
      SELECT DISTINCT va FROM clock_sessions 
      WHERE date >= ? AND date <= ?
    `).bind(startDate, endDate).all();
    
    // Combine unique VAs from both sources
    const vaSet = new Set();
    [...(vasFromTimeclock.results || []), ...(vasFromClock.results || [])].forEach(row => {
      vaSet.add(row.va);
    });
    
    const reports = [];
    
    for (const va of vaSet) {
      // Get payroll data
      const payrollData = await getPayrollData(env, va, startDate, endDate);
      
      // Skip if no hours worked
      if (payrollData.totalHours === 0) continue;
      
      // Get effective rates for this VA and period
      const rates = await getEffectiveRates(env, va, endDate);
      
      // Create report
      const report = await createPayrollReport(env, {
        va,
        period: { start: startDate, end: endDate },
        totalHours: payrollData.totalHours,
        totalRealSpend: payrollData.totalRealSpend,
        hourlyRate: rates.hourlyRate,
        commissionRate: rates.commissionRate,
        bonusAmount: 0,
        notes: 'Weekly automated payroll'
      });
      
      reports.push(report);
    }
    
    return reports;
  } catch (error) {
    console.error('Error generating weekly payroll:', error);
    throw error;
  }
}

// Main handler function
export async function handleAdLaunches(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  
  // Initialize tables on first use
  await initializeTables(env);
  
  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  
  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Route: GET /api/tracker/entries
    if (path === '/api/tracker/entries' && method === 'GET') {
      const week = url.searchParams.get('week');
      const data = await getEntries(env, week);
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }
    
    // Route: POST /api/tracker/entries
    if (path === '/api/tracker/entries' && method === 'POST') {
      const entry = await request.json();
      const newEntry = await createEntry(env, entry);
      return new Response(JSON.stringify(newEntry), { headers: corsHeaders });
    }
    
    // Route: PUT /api/tracker/entries/:id
    if (path.match(/^\/api\/tracker\/entries\/[^\/]+$/) && method === 'PUT') {
      const entryId = path.split('/').pop();
      const week = url.searchParams.get('week');
      const updates = await request.json();
      const updatedEntry = await updateEntry(env, entryId, updates, week);
      return new Response(JSON.stringify(updatedEntry), { headers: corsHeaders });
    }
    
    // Route: DELETE /api/tracker/entries/:id
    if (path.match(/^\/api\/tracker\/entries\/[^\/]+$/) && method === 'DELETE') {
      const entryId = path.split('/').pop();
      const week = url.searchParams.get('week');
      const result = await deleteEntry(env, entryId, week);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }
    
    // Route: GET /api/tracker/weekly-summary
    if (path === '/api/tracker/weekly-summary' && method === 'GET') {
      const va = url.searchParams.get('va');
      const summaries = await getWeeklySummary(env, va);
      return new Response(JSON.stringify(summaries), { headers: corsHeaders });
    }
    
    // Route: GET /api/tracker/export
    if (path === '/api/tracker/export' && method === 'GET') {
      const week = url.searchParams.get('week');
      return await exportData(env, week);
    }
    
    // Route: GET /api/tracker/weeks
    if (path === '/api/tracker/weeks' && method === 'GET') {
      const weeks = await getAvailableWeeks(env);
      return new Response(JSON.stringify(weeks), { headers: corsHeaders });
    }
    
    // Time Clock Routes
    // Route: POST /api/timeclock
    if (path === '/api/timeclock' && method === 'POST') {
      const data = await request.json();
      const result = await submitTimeClock(env, data);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }
    
    // Route: GET /api/timeclock
    if (path === '/api/timeclock' && method === 'GET') {
      const va = url.searchParams.get('va');
      const date = url.searchParams.get('date');
      const result = await getTimeClockData(env, va, date);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }
    
    // Clock In/Out Routes
    // Route: POST /api/clock-in
    if (path === '/api/clock-in' && method === 'POST') {
      try {
        const data = await request.json();
        const result = await clockIn(env, data);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      } catch (error) {
        console.error('Clock in error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          message: error.message || 'Failed to clock in'
        }), { headers: corsHeaders });
      }
    }
    
    // Route: POST /api/clock-out
    if (path === '/api/clock-out' && method === 'POST') {
      try {
        const data = await request.json();
        const result = await clockOut(env, data);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      } catch (error) {
        console.error('Clock out error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          message: error.message || 'Failed to clock out'
        }), { headers: corsHeaders });
      }
    }
    
    // Route: GET /api/clock-status/:va
    if (path.startsWith('/api/clock-status/') && method === 'GET') {
      try {
        const va = decodeURIComponent(path.split('/').pop());
        const result = await getClockStatus(env, va);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      } catch (error) {
        console.error('Clock status error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message,
          isClockedIn: false,
          todayHours: 0,
          sessions: []
        }), { 
          headers: corsHeaders,
          status: 200 // Return 200 with error in body instead of 500
        });
      }
    }
    
    // Route: GET /api/clock-summary/daily
    if (path === '/api/clock-summary/daily' && method === 'GET') {
      try {
        const date = url.searchParams.get('date');
        const result = await getClockDailySummary(env, date);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      } catch (error) {
        console.error('Daily summary error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          summary: [],
          error: error.message
        }), { headers: corsHeaders });
      }
    }
    
    // Route: GET /api/clock-summary/weekly
    if (path === '/api/clock-summary/weekly' && method === 'GET') {
      try {
        const startDate = url.searchParams.get('startDate');
        const result = await getClockWeeklySummary(env, startDate);
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      } catch (error) {
        console.error('Weekly summary error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          byVA: {},
          byDay: {},
          error: error.message
        }), { headers: corsHeaders });
      }
    }
    
    // Payroll Routes
    // Route: GET /api/payroll
    if (path === '/api/payroll' && method === 'GET') {
      const va = url.searchParams.get('va');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const result = await getPayrollData(env, va, startDate, endDate);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }
    
    // Route: POST /api/payroll-report
    if (path === '/api/payroll-report' && method === 'POST') {
      const report = await request.json();
      const result = await createPayrollReport(env, report);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }
    
    // Route: GET /api/payroll-report
    if (path === '/api/payroll-report' && method === 'GET') {
      const va = url.searchParams.get('va');
      const status = url.searchParams.get('status');
      const reports = await getPayrollReports(env, va, status);
      return new Response(JSON.stringify(reports), { headers: corsHeaders });
    }
    
    // Route: PUT /api/payroll-report/:id
    if (path.match(/^\/api\/payroll-report\/[^\/]+$/) && method === 'PUT') {
      const reportId = path.split('/').pop();
      const updates = await request.json();
      const result = await updatePayrollReport(env, reportId, updates);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }
    
    // Route: GET /api/payroll-report/export
    if (path === '/api/payroll-report/export' && method === 'GET') {
      const reportId = url.searchParams.get('id');
      return await exportPayrollReport(env, reportId);
    }
    
    // Route: POST /api/generate-weekly-payroll
    if (path === '/api/generate-weekly-payroll' && method === 'POST') {
      const reports = await generateWeeklyPayroll(env);
      return new Response(JSON.stringify(reports), { headers: corsHeaders });
    }
    
    // Route: POST /api/va-rates
    if (path === '/api/va-rates' && method === 'POST') {
      const { va, hourlyRate, commissionRate, effectiveDate } = await request.json();
      const result = await saveVARates(env, va, hourlyRate, commissionRate, effectiveDate);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }
    
    // Route: GET /api/va-rates/:va
    if (path.match(/^\/api\/va-rates\/[^\/]+$/) && method === 'GET') {
      const va = decodeURIComponent(path.split('/').pop());
      const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
      const rates = await getEffectiveRates(env, va, date);
      return new Response(JSON.stringify(rates), { headers: corsHeaders });
    }
    
    // Route not found
    return new Response(JSON.stringify({ error: 'Route not found' }), {
      status: 404,
      headers: corsHeaders
    });
    
  } catch (error) {
    console.error('Launch tracker error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Export for cron job usage
export { generateWeeklyPayroll };

export default handleAdLaunches;