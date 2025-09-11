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
const getESTDate = () => {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const estOffset = -5; // EST is UTC-5
  return new Date(utcTime + (3600000 * estOffset));
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
  } catch (error) {
    console.error('Error initializing tables:', error);
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

// Payroll Functions
async function getPayrollData(env, va, startDate, endDate) {
  try {
    // Get time entries for period
    const timeEntries = await env.DASHBOARD_DB.prepare(`
      SELECT * FROM timeclock_entries 
      WHERE va = ? AND date >= ? AND date <= ?
      ORDER BY date ASC
    `).bind(va, startDate, endDate).all();
    
    // Get launch entries for real spend calculation
    const launches = await env.DASHBOARD_DB.prepare(`
      SELECT SUM(real_spend) as totalRealSpend 
      FROM launch_entries 
      WHERE va = ? AND DATE(timestamp) >= ? AND DATE(timestamp) <= ?
    `).bind(va, startDate, endDate).first();
    
    // Calculate totals
    let totalHours = 0;
    const entries = [];
    
    for (const entry of timeEntries.results || []) {
      totalHours += entry.hours_worked;
      entries.push(transformRow(entry));
    }
    
    return {
      entries,
      totalHours,
      totalRealSpend: launches?.totalRealSpend || 0,
      period: { start: startDate, end: endDate }
    };
  } catch (error) {
    console.error('Error getting payroll data:', error);
    throw error;
  }
}

async function createPayrollReport(env, report) {
  try {
    const id = `payroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
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
      report.period.start,
      report.period.end,
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
    
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      values.push(updates.status);
    }
    
    if (updates.paymentMethod !== undefined) {
      updateFields.push('payment_method = ?');
      values.push(updates.paymentMethod);
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

async function generateWeeklyPayroll(env) {
  try {
    const now = getESTDate();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() - (weekEnd.getDay() || 7)); // Last Sunday
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6); // Previous Monday
    
    const startDate = weekStart.toISOString().split('T')[0];
    const endDate = weekEnd.toISOString().split('T')[0];
    
    // Get all VAs who have time entries for the week
    const vas = await env.DASHBOARD_DB.prepare(`
      SELECT DISTINCT va FROM timeclock_entries 
      WHERE date >= ? AND date <= ?
    `).bind(startDate, endDate).all();
    
    const reports = [];
    
    for (const vaRow of vas.results || []) {
      const va = vaRow.va;
      
      // Get payroll data
      const payrollData = await getPayrollData(env, va, startDate, endDate);
      
      // Create report
      const report = await createPayrollReport(env, {
        va,
        period: { start: startDate, end: endDate },
        totalHours: payrollData.totalHours,
        totalRealSpend: payrollData.totalRealSpend,
        hourlyRate: 5,
        commissionRate: 0.03,
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