// Launch Tracker API Handler
// Manages launch tracking entries with weekly organization

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
  return `week_${monday.toISOString().split('T')[0]}`;
};

// Get entries for a specific week
async function getEntries(env, week = null) {
  try {
    const weekKey = week || formatWeekKey(getESTDate());
    const data = await env.LAUNCH_TRACKER.get(weekKey, 'json') || { entries: [] };
    return data;
  } catch (error) {
    console.error('Error fetching entries:', error);
    return { entries: [] };
  }
}

// Create a new entry
async function createEntry(env, entry) {
  try {
    const now = getESTDate();
    
    // Calculate derived fields
    const adSpend = parseFloat(entry.adSpend || 0);
    const bcSpend = parseFloat(entry.bcSpend || 0);
    const amountLost = bcSpend - adSpend;
    const realSpend = adSpend - amountLost;
    
    const completeEntry = {
      ...entry,
      id: entry.id || `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: now.toISOString(),
      createdAt: now.toISOString(),
      amountLost: amountLost.toFixed(2),
      realSpend: realSpend.toFixed(2)
    };
    
    const weekKey = formatWeekKey(now);
    const data = await env.LAUNCH_TRACKER.get(weekKey, 'json') || { entries: [] };
    
    data.entries.push(completeEntry);
    
    await env.LAUNCH_TRACKER.put(weekKey, JSON.stringify(data));
    
    return completeEntry;
  } catch (error) {
    console.error('Error creating entry:', error);
    throw error;
  }
}

// Update an existing entry
async function updateEntry(env, entryId, updates, week = null) {
  try {
    const weekKey = week || formatWeekKey(getESTDate());
    const data = await env.LAUNCH_TRACKER.get(weekKey, 'json') || { entries: [] };
    
    const entryIndex = data.entries.findIndex(e => e.id === entryId);
    if (entryIndex === -1) {
      throw new Error('Entry not found');
    }
    
    // Recalculate derived fields if spend values changed
    if (updates.adSpend !== undefined || updates.bcSpend !== undefined) {
      const adSpend = parseFloat(updates.adSpend || data.entries[entryIndex].adSpend || 0);
      const bcSpend = parseFloat(updates.bcSpend || data.entries[entryIndex].bcSpend || 0);
      updates.amountLost = (bcSpend - adSpend).toFixed(2);
      updates.realSpend = (adSpend - updates.amountLost).toFixed(2);
    }
    
    data.entries[entryIndex] = { 
      ...data.entries[entryIndex], 
      ...updates,
      updatedAt: getESTDate().toISOString()
    };
    
    await env.LAUNCH_TRACKER.put(weekKey, JSON.stringify(data));
    
    return data.entries[entryIndex];
  } catch (error) {
    console.error('Error updating entry:', error);
    throw error;
  }
}

// Delete an entry
async function deleteEntry(env, entryId, week = null) {
  try {
    const weekKey = week || formatWeekKey(getESTDate());
    const data = await env.LAUNCH_TRACKER.get(weekKey, 'json') || { entries: [] };
    
    data.entries = data.entries.filter(e => e.id !== entryId);
    
    await env.LAUNCH_TRACKER.put(weekKey, JSON.stringify(data));
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting entry:', error);
    throw error;
  }
}

// Get weekly summary
async function getWeeklySummary(env, vaName = null) {
  try {
    const list = await env.LAUNCH_TRACKER.list();
    const summaries = [];
    
    for (const key of list.keys) {
      if (key.name.startsWith('week_')) {
        const data = await env.LAUNCH_TRACKER.get(key.name, 'json') || { entries: [] };
        
        let entries = data.entries || [];
        if (vaName) {
          entries = entries.filter(e => e.va === vaName);
        }
        
        const summary = {
          week: key.name,
          totalEntries: entries.length,
          totalAdSpend: entries.reduce((sum, e) => sum + (parseFloat(e.adSpend) || 0), 0),
          totalBCSpend: entries.reduce((sum, e) => sum + (parseFloat(e.bcSpend) || 0), 0),
          totalAmountLost: entries.reduce((sum, e) => sum + (parseFloat(e.amountLost) || 0), 0),
          totalRealSpend: entries.reduce((sum, e) => sum + (parseFloat(e.realSpend) || 0), 0),
          byStatus: {},
          byGeo: {},
          byOffer: {},
          byBan: {},
          byWhObj: {}
        };
        
        entries.forEach(e => {
          summary.byStatus[e.status] = (summary.byStatus[e.status] || 0) + 1;
          summary.byGeo[e.launchTarget] = (summary.byGeo[e.launchTarget] || 0) + 1;
          summary.byOffer[e.offer] = (summary.byOffer[e.offer] || 0) + 1;
          if (e.ban) summary.byBan[e.ban] = (summary.byBan[e.ban] || 0) + 1;
          if (e.whObj) summary.byWhObj[e.whObj] = (summary.byWhObj[e.whObj] || 0) + 1;
        });
        
        summaries.push(summary);
      }
    }
    
    // Sort by week (most recent first)
    summaries.sort((a, b) => b.week.localeCompare(a.week));
    
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
    const data = await env.LAUNCH_TRACKER.get(weekKey, 'json') || { entries: [] };
    
    // Create CSV with headers
    const headers = ['VA', 'Time', 'Campaign ID', 'BC GEO', 'BC Type', 'WH Obj', 'Launch Target', 'Status', 'Ban', 'Ad Spend', 'BC Spend', 'Amount Lost', 'Real Spend', 'Offer', 'Notes'];
    const rows = data.entries.map(e => [
      e.va || '',
      new Date(e.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' }),
      e.campaignId || '',
      e.bcGeo || '',
      e.bcType || '',
      e.whObj || '',
      e.launchTarget || '',
      e.status || '',
      e.ban || '',
      e.adSpend || '0',
      e.bcSpend || '0',
      e.amountLost || '0',
      e.realSpend || '0',
      e.offer || '',
      e.notes || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="launch_tracker_${weekKey}.csv"`
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
    const list = await env.LAUNCH_TRACKER.list({ prefix: 'week_' });
    const weeks = [];
    
    for (const key of list.keys) {
      const weekDate = key.name.replace('week_', '');
      const weekStart = new Date(weekDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      weeks.push({
        key: key.name,
        display: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`
      });
    }
    
    // Sort by date (most recent first)
    weeks.sort((a, b) => b.key.localeCompare(a.key));
    
    return weeks;
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