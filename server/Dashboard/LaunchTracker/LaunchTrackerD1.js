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

    console.log('Launch tracker tables initialized');
  } catch (error) {
    console.error('Error initializing launch tracker tables:', error);
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

// Main handler function
export async function handleLaunchTracker(request, env) {
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

export default handleLaunchTracker;