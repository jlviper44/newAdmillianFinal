export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;
  
      // API Routes
      if (path === '/api/ads' && request.method === 'GET') {
        return await getAds(env);
      } else if (path === '/api/ads' && request.method === 'POST') {
        return await createAd(request, env);
      } else if (path.startsWith('/api/ads/') && request.method === 'PUT') {
        const id = path.split('/')[3];
        return await updateAd(id, request, env);
      } else if (path.startsWith('/api/ads/') && request.method === 'DELETE') {
        const id = path.split('/')[3];
        return await deleteAd(id, env);
      } else if (path === '/api/ads/bulk' && request.method === 'POST') {
        return await bulkCreateAds(request, env);
      } else if (path === '/api/settings' && request.method === 'GET') {
        return await getSettings(env);
      } else if (path === '/api/settings' && request.method === 'PUT') {
        return await updateSettings(request, env);
      } else if (path === '/api/payments/mark' && request.method === 'POST') {
        return await markAsPaid(request, env);
      } else if (path === '/api/export' && request.method === 'GET') {
        return await exportData(env);
      }
  
      // Return HTML for main page
      return new Response(getHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
  };
  
  // KV Operations
  async function getAds(env) {
    try {
      const list = await env.ADS.list();
      const ads = [];
      
      for (const key of list.keys) {
        if (key.name.startsWith('ad_')) {
          const ad = await env.ADS.get(key.name, 'json');
          if (ad) ads.push(ad);
        }
      }
      
      return new Response(JSON.stringify(ads), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  async function createAd(request, env) {
    try {
      const ad = await request.json();
      ad.id = crypto.randomUUID();
      ad.createdDate = new Date().toISOString();
      ad.paid = ad.paid || false;
      
      await env.ADS.put(`ad_${ad.id}`, JSON.stringify(ad));
      
      return new Response(JSON.stringify(ad), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  async function updateAd(id, request, env) {
    try {
      const updates = await request.json();
      const existing = await env.ADS.get(`ad_${id}`, 'json');
      
      if (!existing) {
        return new Response(JSON.stringify({ error: 'Ad not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const updated = { ...existing, ...updates };
      await env.ADS.put(`ad_${id}`, JSON.stringify(updated));
      
      return new Response(JSON.stringify(updated), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  async function deleteAd(id, env) {
    try {
      await env.ADS.delete(`ad_${id}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  async function bulkCreateAds(request, env) {
    try {
      const { baseName, type, sparkCodes, tiktokLinks } = await request.json();
      const created = [];
      
      for (let i = 0; i < Math.max(sparkCodes.length, tiktokLinks.length); i++) {
        const ad = {
          id: crypto.randomUUID(),
          name: `${baseName}-${String(i + 1).padStart(2, '0')}`,
          creator: baseName.split('-')[0],
          sparkCode: sparkCodes[i] || '',
          tiktokLink: tiktokLinks[i] || '',
          postId: extractPostId(tiktokLinks[i] || ''),
          type: type,
          status: 'New',
          winner: 'Unknown',
          notes: '',
          createdDate: new Date().toISOString(),
          paid: false
        };
        
        await env.ADS.put(`ad_${ad.id}`, JSON.stringify(ad));
        created.push(ad);
      }
      
      return new Response(JSON.stringify(created), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  async function getSettings(env) {
    try {
      const settings = await env.ADS.get('settings', 'json') || {
        defaultRate: 1,
        creatorRates: {}
      };
      
      return new Response(JSON.stringify(settings), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  async function updateSettings(request, env) {
    try {
      const settings = await request.json();
      await env.ADS.put('settings', JSON.stringify(settings));
      
      return new Response(JSON.stringify(settings), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  async function markAsPaid(request, env) {
    try {
      const { adIds } = await request.json();
      const updated = [];
      
      for (const id of adIds) {
        const ad = await env.ADS.get(`ad_${id}`, 'json');
        if (ad) {
          ad.paid = true;
          ad.paidDate = new Date().toISOString();
          await env.ADS.put(`ad_${id}`, JSON.stringify(ad));
          updated.push(ad);
        }
      }
      
      // Log payment
      const paymentLog = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        adIds: adIds,
        count: updated.length
      };
      await env.ADS.put(`payment_${paymentLog.id}`, JSON.stringify(paymentLog));
      
      return new Response(JSON.stringify(updated), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  async function exportData(env) {
    try {
      const list = await env.ADS.list();
      const ads = [];
      
      for (const key of list.keys) {
        if (key.name.startsWith('ad_')) {
          const ad = await env.ADS.get(key.name, 'json');
          if (ad) ads.push(ad);
        }
      }
      
      // Convert to CSV
      const headers = ['ID', 'Name', 'Creator', 'TikTok Link', 'Post ID', 'Spark Code', 'Type', 'Status', 'Winner', 'Notes', 'Created Date', 'Paid', 'Paid Date'];
      const rows = ads.map(ad => [
        ad.id,
        ad.name,
        ad.creator,
        ad.tiktokLink,
        ad.postId,
        ad.sparkCode,
        ad.type,
        ad.status,
        ad.winner,
        ad.notes,
        ad.createdDate,
        ad.paid,
        ad.paidDate || ''
      ]);
      
      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="tiktok-ads-export.csv"'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  function extractPostId(url) {
    const match = url.match(/video\/(\d+)/);
    return match ? match[1] : '';
  }
  
  function getHTML() {
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TikTok Ad Campaign Tracker</title>
      <style>
          * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
          }
          
          body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              background: #0f0f0f;
              color: #e0e0e0;
              line-height: 1.6;
          }
          
          .container {
              max-width: 1400px;
              margin: 0 auto;
              padding: 20px;
          }
          
          header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 1px solid #333;
          }
          
          h1 {
              font-size: 28px;
              font-weight: 600;
              background: linear-gradient(45deg, #00f2ea, #ff0050);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
          }
          
          .tabs {
              display: flex;
              gap: 20px;
              margin-bottom: 30px;
          }
          
          .tab {
              padding: 10px 20px;
              background: #1a1a1a;
              border: 1px solid #333;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.3s;
          }
          
          .tab.active {
              background: #2a2a2a;
              border-color: #00f2ea;
              color: #00f2ea;
          }
          
          .controls {
              display: flex;
              gap: 15px;
              margin-bottom: 20px;
              flex-wrap: wrap;
              align-items: center;
          }
          
          .search-box {
              flex: 1;
              min-width: 200px;
              padding: 10px 15px;
              background: #1a1a1a;
              border: 1px solid #333;
              border-radius: 8px;
              color: #e0e0e0;
              font-size: 14px;
          }
          
          .filter-group {
              display: flex;
              gap: 10px;
              align-items: center;
          }
          
          select {
              padding: 8px 12px;
              background: #1a1a1a;
              border: 1px solid #333;
              border-radius: 6px;
              color: #e0e0e0;
              font-size: 14px;
              cursor: pointer;
          }
          
          button {
              padding: 10px 20px;
              background: linear-gradient(45deg, #00f2ea, #ff0050);
              border: none;
              border-radius: 8px;
              color: white;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.3s;
          }
          
          button:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 15px rgba(0, 242, 234, 0.3);
          }
          
          .secondary-btn {
              background: #2a2a2a;
              border: 1px solid #333;
          }
          
          .secondary-btn:hover {
              background: #3a3a3a;
              box-shadow: none;
          }
          
          .table-container {
              background: #1a1a1a;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          }
          
          table {
              width: 100%;
              border-collapse: collapse;
          }
          
          th {
              background: #2a2a2a;
              padding: 15px;
              text-align: left;
              font-weight: 500;
              color: #00f2ea;
              cursor: pointer;
              user-select: none;
              position: sticky;
              top: 0;
              z-index: 10;
          }
          
          th:hover {
              background: #333;
          }
          
          td {
              padding: 12px 15px;
              border-bottom: 1px solid #333;
              cursor: pointer;
              transition: background 0.2s;
          }
          
          tr:hover td {
              background: #252525;
          }
          
          .badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 500;
          }
          
          .badge-new { background: #1e40af; color: white; }
          .badge-active { background: #059669; color: white; }
          .badge-banned { background: #dc2626; color: white; }
          .badge-dead { background: #6b7280; color: white; }
          .badge-yes { background: #f59e0b; color: white; }
          .badge-no { background: #6b7280; color: white; }
          .badge-unknown { background: #4b5563; color: white; }
          .badge-auto { background: #7c3aed; }
          .badge-cpi { background: #2563eb; }
          .badge-cash { background: #10b981; }
          .badge-shein { background: #ec4899; }
          .badge-other { background: #6b7280; }
          
          .edit-input {
              width: 100%;
              padding: 8px;
              background: #0a0a0a;
              border: 2px solid #00f2ea;
              border-radius: 4px;
              color: #e0e0e0;
              font-size: 14px;
          }
          
          .edit-select {
              width: 100%;
              padding: 8px;
              background: #0a0a0a;
              border: 2px solid #00f2ea;
              border-radius: 4px;
              color: #e0e0e0;
              font-size: 14px;
          }
          
          .modal {
              display: none;
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: rgba(0, 0, 0, 0.8);
              z-index: 1000;
              backdrop-filter: blur(5px);
          }
          
          .modal-content {
              position: relative;
              background: #1a1a1a;
              margin: 50px auto;
              padding: 30px;
              width: 90%;
              max-width: 800px;
              border-radius: 12px;
              box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }
          
          .modal-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
          }
          
          .modal h2 {
              font-size: 24px;
              color: #00f2ea;
          }
          
          .close {
              font-size: 28px;
              color: #666;
              cursor: pointer;
              transition: color 0.3s;
          }
          
          .close:hover {
              color: #e0e0e0;
          }
          
          .form-group {
              margin-bottom: 20px;
          }
          
          .form-group label {
              display: block;
              margin-bottom: 8px;
              color: #b0b0b0;
              font-size: 14px;
          }
          
          .form-group input,
          .form-group select,
          .form-group textarea {
              width: 100%;
              padding: 10px;
              background: #0a0a0a;
              border: 1px solid #333;
              border-radius: 6px;
              color: #e0e0e0;
              font-size: 14px;
          }
          
          .form-group textarea {
              min-height: 150px;
              resize: vertical;
          }
          
          .textarea-group {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
          }
          
          .preview-section {
              margin-top: 20px;
              padding: 15px;
              background: #0a0a0a;
              border-radius: 8px;
              border: 1px solid #333;
          }
          
          .preview-item {
              padding: 8px;
              margin-bottom: 5px;
              background: #1a1a1a;
              border-radius: 4px;
              font-size: 14px;
          }
          
          .action-buttons {
              display: flex;
              gap: 10px;
              justify-content: flex-end;
              margin-top: 20px;
          }
          
          .payment-section {
              display: none;
          }
          
          .payment-settings {
              background: #1a1a1a;
              padding: 20px;
              border-radius: 12px;
              margin-bottom: 20px;
          }
          
          .rate-input {
              display: flex;
              gap: 10px;
              align-items: center;
              margin-bottom: 15px;
          }
          
          .rate-input input {
              width: 100px;
          }
          
          .creator-payments {
              display: grid;
              gap: 15px;
          }
          
          .creator-card {
              background: #2a2a2a;
              padding: 20px;
              border-radius: 8px;
              border: 1px solid #333;
          }
          
          .creator-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
          }
          
          .creator-name {
              font-size: 18px;
              font-weight: 500;
              color: #00f2ea;
          }
          
          .creator-stats {
              display: flex;
              gap: 20px;
              font-size: 14px;
              color: #b0b0b0;
          }
          
          .unpaid-list {
              margin-top: 10px;
              font-size: 14px;
          }
          
          .unpaid-item {
              padding: 5px 0;
              display: flex;
              justify-content: space-between;
              border-bottom: 1px solid #333;
          }
          
          .checkbox-wrapper {
              display: flex;
              align-items: center;
              gap: 10px;
          }
          
          .checkbox-wrapper input[type="checkbox"] {
              width: 18px;
              height: 18px;
              cursor: pointer;
          }
          
          .stats-dashboard {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin-bottom: 30px;
          }
          
          .stat-card {
              background: #1a1a1a;
              padding: 20px;
              border-radius: 12px;
              text-align: center;
              border: 1px solid #333;
          }
          
          .stat-value {
              font-size: 32px;
              font-weight: 600;
              color: #00f2ea;
              margin-bottom: 5px;
          }
          
          .stat-label {
              font-size: 14px;
              color: #b0b0b0;
          }
          
          .add-row {
              display: none;
              background: #252525;
          }
          
          .add-row td {
              padding: 10px;
          }
          
          .add-row input,
          .add-row select {
              width: 100%;
              padding: 8px;
              background: #0a0a0a;
              border: 1px solid #00f2ea;
              border-radius: 4px;
              color: #e0e0e0;
          }
          
          .link-icon {
              color: #00f2ea;
              text-decoration: none;
              font-size: 18px;
          }
          
          .link-icon:hover {
              color: #ff0050;
          }
          
          @media (max-width: 768px) {
              .container {
                  padding: 10px;
              }
              
              .controls {
                  flex-direction: column;
                  align-items: stretch;
              }
              
              .table-container {
                  overflow-x: auto;
              }
              
              table {
                  min-width: 800px;
              }
              
              .modal-content {
                  margin: 20px;
                  padding: 20px;
              }
              
              .textarea-group {
                  grid-template-columns: 1fr;
              }
          }
          
          .loading {
              text-align: center;
              padding: 40px;
              color: #666;
          }
          
          .error {
              background: #dc2626;
              color: white;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
          }
          
          .success {
              background: #059669;
              color: white;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
          }
      </style>
  </head>
  <body>
      <div class="container">
          <header>
              <h1>TikTok Ad Campaign Tracker</h1>
              <div>
                  <button class="secondary-btn" onclick="exportData()">Export CSV</button>
              </div>
          </header>
          
          <div class="tabs">
              <div class="tab active" onclick="switchTab('ads')">Ads</div>
              <div class="tab" onclick="switchTab('payments')">Payments</div>
          </div>
          
          <div id="ads-section">
              <div class="controls">
                  <input type="text" class="search-box" placeholder="Search ads..." oninput="filterAds()">
                  
                  <div class="filter-group">
                      <select id="type-filter" onchange="filterAds()">
                          <option value="">All Types</option>
                          <option value="Auto">Auto</option>
                          <option value="CPI">CPI</option>
                          <option value="Cash">Cash</option>
                          <option value="Shein">Shein</option>
                          <option value="Other">Other</option>
                      </select>
                      
                      <select id="status-filter" onchange="filterAds()">
                          <option value="">All Status</option>
                          <option value="New">New</option>
                          <option value="Active">Active</option>
                          <option value="Banned">Banned</option>
                          <option value="Dead">Dead</option>
                      </select>
                      
                      <select id="winner-filter" onchange="filterAds()">
                          <option value="">All Winners</option>
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                          <option value="Unknown">Unknown</option>
                      </select>
                  </div>
                  
                  <div class="checkbox-wrapper">
                      <input type="checkbox" id="winners-only" onchange="filterAds()">
                      <label for="winners-only">Active & Winners Only</label>
                  </div>
                  
                  <button onclick="showAddRow()">Add Ad</button>
                  <button onclick="showBulkModal()">Bulk Add</button>
                  <button class="secondary-btn" onclick="clearFilters()">Clear Filters</button>
              </div>
              
              <div class="table-container">
                  <table id="ads-table">
                      <thead>
                          <tr>
                              <th onclick="sortTable('name')">Name ↕</th>
                              <th onclick="sortTable('creator')">Creator ↕</th>
                              <th onclick="sortTable('type')">Type ↕</th>
                              <th onclick="sortTable('status')">Status ↕</th>
                              <th onclick="sortTable('winner')">Winner ↕</th>
                              <th>TikTok</th>
                              <th onclick="sortTable('sparkCode')">Spark Code ↕</th>
                              <th onclick="sortTable('notes')">Notes ↕</th>
                              <th onclick="sortTable('createdDate')">Created ↕</th>
                              <th>Actions</th>
                          </tr>
                      </thead>
                      <tbody>
                          <tr class="add-row" id="add-row">
                              <td><input type="text" id="new-name" placeholder="Name"></td>
                              <td><input type="text" id="new-creator" placeholder="Creator"></td>
                              <td>
                                  <select id="new-type">
                                      <option value="Auto">Auto</option>
                                      <option value="CPI">CPI</option>
                                      <option value="Cash">Cash</option>
                                      <option value="Shein">Shein</option>
                                      <option value="Other">Other</option>
                                  </select>
                              </td>
                              <td>
                                  <select id="new-status">
                                      <option value="New">New</option>
                                      <option value="Active">Active</option>
                                      <option value="Banned">Banned</option>
                                      <option value="Dead">Dead</option>
                                  </select>
                              </td>
                              <td>
                                  <select id="new-winner">
                                      <option value="Unknown">Unknown</option>
                                      <option value="Yes">Yes</option>
                                      <option value="No">No</option>
                                  </select>
                              </td>
                              <td><input type="text" id="new-tiktok" placeholder="TikTok Link" onpaste="handleTikTokPaste(event)"></td>
                              <td><input type="text" id="new-spark" placeholder="Spark Code"></td>
                              <td><input type="text" id="new-notes" placeholder="Notes"></td>
                              <td>-</td>
                              <td>
                                  <button onclick="saveNewAd()">Save</button>
                                  <button class="secondary-btn" onclick="hideAddRow()">Cancel</button>
                              </td>
                          </tr>
                      </tbody>
                  </table>
                  <div class="loading" id="loading">Loading ads...</div>
              </div>
          </div>
          
          <div id="payments-section" class="payment-section">
              <div class="stats-dashboard">
                  <div class="stat-card">
                      <div class="stat-value" id="total-owed">$0</div>
                      <div class="stat-label">Total Owed</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-value" id="total-paid">$0</div>
                      <div class="stat-label">Total Paid</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-value" id="unpaid-count">0</div>
                      <div class="stat-label">Unpaid Ads</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-value" id="creator-count">0</div>
                      <div class="stat-label">Active Creators</div>
                  </div>
              </div>
              
              <div class="payment-settings">
                  <h3 style="margin-bottom: 15px;">Payment Settings</h3>
                  <div class="rate-input">
                      <label>Default Rate per Video: $</label>
                      <input type="number" id="default-rate" value="1" step="0.01" onchange="updateDefaultRate()">
                  </div>
                  <div id="creator-rates"></div>
              </div>
              
              <div class="creator-payments" id="creator-payments"></div>
          </div>
      </div>
      
      <div id="bulk-modal" class="modal">
          <div class="modal-content">
              <div class="modal-header">
                  <h2>Bulk Add Ads</h2>
                  <span class="close" onclick="closeBulkModal()">&times;</span>
              </div>
              
              <div class="form-group">
                  <label>Base Name (e.g., Max-0901)</label>
                  <input type="text" id="bulk-base-name" placeholder="Max-0901">
              </div>
              
              <div class="form-group">
                  <label>Type</label>
                  <select id="bulk-type">
                      <option value="Auto">Auto</option>
                      <option value="CPI">CPI</option>
                      <option value="Cash">Cash</option>
                      <option value="Shein">Shein</option>
                      <option value="Other">Other</option>
                  </select>
              </div>
              
              <div class="textarea-group">
                  <div class="form-group">
                      <label>Spark Codes (one per line)</label>
                      <textarea id="bulk-spark-codes" placeholder="SC001\nSC002\nSC003"></textarea>
                  </div>
                  <div class="form-group">
                      <label>TikTok Links (one per line)</label>
                      <textarea id="bulk-tiktok-links" placeholder="https://www.tiktok.com/@user/video/123\nhttps://www.tiktok.com/@user/video/456"></textarea>
                  </div>
              </div>
              
              <div class="preview-section" id="bulk-preview" style="display: none;">
                  <h3 style="margin-bottom: 10px;">Preview</h3>
                  <div id="preview-content"></div>
              </div>
              
              <div class="action-buttons">
                  <button class="secondary-btn" onclick="previewBulkAds()">Preview</button>
                  <button onclick="saveBulkAds()">Save All</button>
              </div>
          </div>
      </div>
      
      <script>
          let ads = [];
          let settings = { defaultRate: 1, creatorRates: {} };
          let sortColumn = 'createdDate';
          let sortDirection = 'desc';
          let currentEditCell = null;
          
          // Initialize
          async function init() {
              await loadAds();
              await loadSettings();
          }
          
          // Load ads from KV
          async function loadAds() {
              try {
                  const response = await fetch('/api/ads');
                  if (!response.ok) throw new Error('Failed to load ads');
                  ads = await response.json();
                  renderAdsTable();
                  updatePaymentStats();
              } catch (error) {
                  console.error('Error loading ads:', error);
                  showError('Failed to load ads. Please refresh the page.');
              }
          }
          
          // Load settings from KV
          async function loadSettings() {
              try {
                  const response = await fetch('/api/settings');
                  if (!response.ok) throw new Error('Failed to load settings');
                  settings = await response.json();
                  document.getElementById('default-rate').value = settings.defaultRate;
                  renderCreatorRates();
              } catch (error) {
                  console.error('Error loading settings:', error);
              }
          }
          
          // Render ads table
          function renderAdsTable() {
              const tbody = document.querySelector('#ads-table tbody');
              const addRow = document.getElementById('add-row');
              
              // Clear existing rows except add row
              while (tbody.children.length > 1) {
                  tbody.removeChild(tbody.lastChild);
              }
              
              // Sort ads
              const sortedAds = [...ads].sort((a, b) => {
                  let aVal = a[sortColumn];
                  let bVal = b[sortColumn];
                  
                  if (sortColumn === 'createdDate') {
                      aVal = new Date(aVal);
                      bVal = new Date(bVal);
                  }
                  
                  if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
                  if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
                  return 0;
              });
              
              // Filter ads
              const searchTerm = document.querySelector('.search-box').value.toLowerCase();
              const typeFilter = document.getElementById('type-filter').value;
              const statusFilter = document.getElementById('status-filter').value;
              const winnerFilter = document.getElementById('winner-filter').value;
              const winnersOnly = document.getElementById('winners-only').checked;
              
              const filteredAds = sortedAds.filter(ad => {
                  if (searchTerm && !Object.values(ad).some(val => 
                      String(val).toLowerCase().includes(searchTerm)
                  )) return false;
                  
                  if (typeFilter && ad.type !== typeFilter) return false;
                  if (statusFilter && ad.status !== statusFilter) return false;
                  if (winnerFilter && ad.winner !== winnerFilter) return false;
                  if (winnersOnly && (ad.status !== 'Active' || ad.winner !== 'Yes')) return false;
                  
                  return true;
              });
              
              // Render rows
              filteredAds.forEach(ad => {
                  const row = document.createElement('tr');
                  row.innerHTML = \`
                      <td onclick="editCell(this, '\${ad.id}', 'name')">\${ad.name}</td>
                      <td onclick="editCell(this, '\${ad.id}', 'creator')">\${ad.creator}</td>
                      <td onclick="editCell(this, '\${ad.id}', 'type')"><span class="badge badge-\${ad.type.toLowerCase()}">\${ad.type}</span></td>
                      <td onclick="editCell(this, '\${ad.id}', 'status')"><span class="badge badge-\${ad.status.toLowerCase()}">\${ad.status}</span></td>
                      <td onclick="editCell(this, '\${ad.id}', 'winner')"><span class="badge badge-\${ad.winner.toLowerCase()}">\${ad.winner}</span></td>
                      <td>\${ad.tiktokLink ? \`<a href="\${ad.tiktokLink}" target="_blank" class="link-icon">🔗</a>\` : '-'}</td>
                      <td onclick="editCell(this, '\${ad.id}', 'sparkCode')">\${ad.sparkCode || '-'}</td>
                      <td onclick="editCell(this, '\${ad.id}', 'notes')">\${ad.notes || '-'}</td>
                      <td>\${new Date(ad.createdDate).toLocaleDateString()}</td>
                      <td><button class="secondary-btn" onclick="deleteAd('\${ad.id}')">Delete</button></td>
                  \`;
                  tbody.appendChild(row);
              });
              
              document.getElementById('loading').style.display = 'none';
          }
          
          // Edit cell inline
          function editCell(cell, adId, field) {
              if (currentEditCell) {
                  cancelEdit();
              }
              
              currentEditCell = { cell, adId, field };
              const ad = ads.find(a => a.id === adId);
              const currentValue = ad[field] || '';
              
              if (field === 'type' || field === 'status' || field === 'winner') {
                  const options = {
                      type: ['Auto', 'CPI', 'Cash', 'Shein', 'Other'],
                      status: ['New', 'Active', 'Banned', 'Dead'],
                      winner: ['Yes', 'No', 'Unknown']
                  };
                  
                  const select = document.createElement('select');
                  select.className = 'edit-select';
                  options[field].forEach(opt => {
                      const option = document.createElement('option');
                      option.value = opt;
                      option.textContent = opt;
                      if (opt === currentValue) option.selected = true;
                      select.appendChild(option);
                  });
                  
                  select.onblur = () => saveEdit(select.value);
                  select.onkeydown = (e) => {
                      if (e.key === 'Enter') saveEdit(select.value);
                      if (e.key === 'Escape') cancelEdit();
                  };
                  
                  cell.innerHTML = '';
                  cell.appendChild(select);
                  select.focus();
              } else {
                  const input = document.createElement('input');
                  input.type = 'text';
                  input.className = 'edit-input';
                  input.value = currentValue;
                  
                  input.onblur = () => saveEdit(input.value);
                  input.onkeydown = (e) => {
                      if (e.key === 'Enter') saveEdit(input.value);
                      if (e.key === 'Escape') cancelEdit();
                  };
                  
                  cell.innerHTML = '';
                  cell.appendChild(input);
                  input.focus();
                  input.select();
              }
          }
          
          // Save edit
          async function saveEdit(newValue) {
              if (!currentEditCell) return;
              
              const { adId, field } = currentEditCell;
              const ad = ads.find(a => a.id === adId);
              
              if (ad[field] !== newValue) {
                  try {
                      const response = await fetch(\`/api/ads/\${adId}\`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ [field]: newValue })
                      });
                      
                      if (!response.ok) throw new Error('Failed to update ad');
                      
                      const updated = await response.json();
                      const index = ads.findIndex(a => a.id === adId);
                      ads[index] = updated;
                      
                      renderAdsTable();
                      if (field === 'creator' || field === 'paid') {
                          updatePaymentStats();
                      }
                  } catch (error) {
                      console.error('Error updating ad:', error);
                      showError('Failed to update ad. Please try again.');
                      renderAdsTable();
                  }
              } else {
                  renderAdsTable();
              }
              
              currentEditCell = null;
          }
          
          // Cancel edit
          function cancelEdit() {
              if (currentEditCell) {
                  renderAdsTable();
                  currentEditCell = null;
              }
          }
          
          // Show add row
          function showAddRow() {
              document.getElementById('add-row').style.display = 'table-row';
              document.getElementById('new-name').focus();
          }
          
          // Hide add row
          function hideAddRow() {
              document.getElementById('add-row').style.display = 'none';
              // Clear inputs
              ['new-name', 'new-creator', 'new-tiktok', 'new-spark', 'new-notes'].forEach(id => {
                  document.getElementById(id).value = '';
              });
          }
          
          // Handle TikTok paste
          function handleTikTokPaste(event) {
              setTimeout(() => {
                  const url = event.target.value;
                  const postId = extractPostId(url);
                  // Auto-fill post ID if needed (currently we handle this server-side)
              }, 0);
          }
          
          // Extract post ID from TikTok URL
          function extractPostId(url) {
              const match = url.match(/video\\/(\\d+)/);
              return match ? match[1] : '';
          }
          
          // Save new ad
          async function saveNewAd() {
              const ad = {
                  name: document.getElementById('new-name').value,
                  creator: document.getElementById('new-creator').value,
                  type: document.getElementById('new-type').value,
                  status: document.getElementById('new-status').value,
                  winner: document.getElementById('new-winner').value,
                  tiktokLink: document.getElementById('new-tiktok').value,
                  sparkCode: document.getElementById('new-spark').value,
                  notes: document.getElementById('new-notes').value
              };
              
              if (!ad.name) {
                  showError('Name is required');
                  return;
              }
              
              try {
                  const response = await fetch('/api/ads', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(ad)
                  });
                  
                  if (!response.ok) throw new Error('Failed to create ad');
                  
                  const newAd = await response.json();
                  ads.push(newAd);
                  renderAdsTable();
                  updatePaymentStats();
                  hideAddRow();
                  showSuccess('Ad created successfully');
              } catch (error) {
                  console.error('Error creating ad:', error);
                  showError('Failed to create ad. Please try again.');
              }
          }
          
          // Delete ad
          async function deleteAd(id) {
              if (!confirm('Are you sure you want to delete this ad?')) return;
              
              try {
                  const response = await fetch(\`/api/ads/\${id}\`, {
                      method: 'DELETE'
                  });
                  
                  if (!response.ok) throw new Error('Failed to delete ad');
                  
                  ads = ads.filter(a => a.id !== id);
                  renderAdsTable();
                  updatePaymentStats();
                  showSuccess('Ad deleted successfully');
              } catch (error) {
                  console.error('Error deleting ad:', error);
                  showError('Failed to delete ad. Please try again.');
              }
          }
          
          // Sort table
          function sortTable(column) {
              if (sortColumn === column) {
                  sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
              } else {
                  sortColumn = column;
                  sortDirection = 'asc';
              }
              renderAdsTable();
          }
          
          // Filter ads
          function filterAds() {
              renderAdsTable();
          }
          
          // Clear filters
          function clearFilters() {
              document.querySelector('.search-box').value = '';
              document.getElementById('type-filter').value = '';
              document.getElementById('status-filter').value = '';
              document.getElementById('winner-filter').value = '';
              document.getElementById('winners-only').checked = false;
              renderAdsTable();
          }
          
          // Show bulk modal
          function showBulkModal() {
              document.getElementById('bulk-modal').style.display = 'block';
          }
          
          // Close bulk modal
          function closeBulkModal() {
              document.getElementById('bulk-modal').style.display = 'none';
              // Clear inputs
              document.getElementById('bulk-base-name').value = '';
              document.getElementById('bulk-spark-codes').value = '';
              document.getElementById('bulk-tiktok-links').value = '';
              document.getElementById('bulk-preview').style.display = 'none';
          }
          
          // Preview bulk ads
          function previewBulkAds() {
              const baseName = document.getElementById('bulk-base-name').value;
              const sparkCodes = document.getElementById('bulk-spark-codes').value.split('\\n').filter(s => s.trim());
              const tiktokLinks = document.getElementById('bulk-tiktok-links').value.split('\\n').filter(s => s.trim());
              
              if (!baseName) {
                  showError('Base name is required');
                  return;
              }
              
              const previewContent = document.getElementById('preview-content');
              previewContent.innerHTML = '';
              
              const count = Math.max(sparkCodes.length, tiktokLinks.length);
              for (let i = 0; i < count; i++) {
                  const name = \`\${baseName}-\${String(i + 1).padStart(2, '0')}\`;
                  const div = document.createElement('div');
                  div.className = 'preview-item';
                  div.textContent = \`\${name} - Spark: \${sparkCodes[i] || 'N/A'} - TikTok: \${tiktokLinks[i] ? '✓' : 'N/A'}\`;
                  previewContent.appendChild(div);
              }
              
              document.getElementById('bulk-preview').style.display = 'block';
          }
          
          // Save bulk ads
          async function saveBulkAds() {
              const baseName = document.getElementById('bulk-base-name').value;
              const type = document.getElementById('bulk-type').value;
              const sparkCodes = document.getElementById('bulk-spark-codes').value.split('\\n').filter(s => s.trim());
              const tiktokLinks = document.getElementById('bulk-tiktok-links').value.split('\\n').filter(s => s.trim());
              
              if (!baseName) {
                  showError('Base name is required');
                  return;
              }
              
              try {
                  const response = await fetch('/api/ads/bulk', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ baseName, type, sparkCodes, tiktokLinks })
                  });
                  
                  if (!response.ok) throw new Error('Failed to create ads');
                  
                  const created = await response.json();
                  ads.push(...created);
                  renderAdsTable();
                  updatePaymentStats();
                  closeBulkModal();
                  showSuccess(\`Created \${created.length} ads successfully\`);
              } catch (error) {
                  console.error('Error creating bulk ads:', error);
                  showError('Failed to create ads. Please try again.');
              }
          }
          
          // Switch tab
          function switchTab(tab) {
              document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
              event.target.classList.add('active');
              
              if (tab === 'ads') {
                  document.getElementById('ads-section').style.display = 'block';
                  document.getElementById('payments-section').style.display = 'none';
              } else {
                  document.getElementById('ads-section').style.display = 'none';
                  document.getElementById('payments-section').style.display = 'block';
                  renderPaymentSection();
              }
          }
          
          // Update payment stats
          function updatePaymentStats() {
              const unpaidAds = ads.filter(ad => !ad.paid);
              const paidAds = ads.filter(ad => ad.paid);
              const creators = [...new Set(ads.map(ad => ad.creator).filter(c => c))];
              
              let totalOwed = 0;
              let totalPaid = 0;
              
              unpaidAds.forEach(ad => {
                  const rate = settings.creatorRates[ad.creator] || settings.defaultRate;
                  totalOwed += rate;
              });
              
              paidAds.forEach(ad => {
                  const rate = settings.creatorRates[ad.creator] || settings.defaultRate;
                  totalPaid += rate;
              });
              
              document.getElementById('total-owed').textContent = \`$\${totalOwed.toFixed(2)}\`;
              document.getElementById('total-paid').textContent = \`$\${totalPaid.toFixed(2)}\`;
              document.getElementById('unpaid-count').textContent = unpaidAds.length;
              document.getElementById('creator-count').textContent = creators.length;
          }
          
          // Render payment section
          function renderPaymentSection() {
              renderCreatorRates();
              renderCreatorPayments();
          }
          
          // Render creator rates
          function renderCreatorRates() {
              const container = document.getElementById('creator-rates');
              container.innerHTML = '<h4 style="margin: 15px 0 10px;">Creator Custom Rates</h4>';
              
              const creators = [...new Set(ads.map(ad => ad.creator).filter(c => c))];
              
              creators.forEach(creator => {
                  const div = document.createElement('div');
                  div.className = 'rate-input';
                  div.innerHTML = \`
                      <label>\${creator}: $</label>
                      <input type="number" value="\${settings.creatorRates[creator] || settings.defaultRate}" 
                             step="0.01" onchange="updateCreatorRate('\${creator}', this.value)">
                  \`;
                  container.appendChild(div);
              });
          }
          
          // Render creator payments
          function renderCreatorPayments() {
              const container = document.getElementById('creator-payments');
              container.innerHTML = '';
              
              const creatorGroups = {};
              ads.forEach(ad => {
                  if (ad.creator && !ad.paid) {
                      if (!creatorGroups[ad.creator]) {
                          creatorGroups[ad.creator] = [];
                      }
                      creatorGroups[ad.creator].push(ad);
                  }
              });
              
              Object.entries(creatorGroups).forEach(([creator, creatorAds]) => {
                  const rate = settings.creatorRates[creator] || settings.defaultRate;
                  const total = creatorAds.length * rate;
                  
                  const card = document.createElement('div');
                  card.className = 'creator-card';
                  card.innerHTML = \`
                      <div class="creator-header">
                          <div class="creator-name">\${creator}</div>
                          <div>
                              <span style="margin-right: 15px;">Unpaid: \${creatorAds.length}</span>
                              <span style="color: #00f2ea;">Total: $\${total.toFixed(2)}</span>
                          </div>
                      </div>
                      <div class="creator-stats">
                          <span>Rate: $\${rate}/video</span>
                          <button onclick="markCreatorPaid('\${creator}')">Mark All Paid</button>
                      </div>
                      <div class="unpaid-list">
                          \${creatorAds.map(ad => \`
                              <div class="unpaid-item">
                                  <span>\${ad.name}</span>
                                  <span>\${new Date(ad.createdDate).toLocaleDateString()}</span>
                              </div>
                          \`).join('')}
                      </div>
                  \`;
                  container.appendChild(card);
              });
          }
          
          // Update default rate
          async function updateDefaultRate() {
              settings.defaultRate = parseFloat(document.getElementById('default-rate').value);
              await saveSettings();
              updatePaymentStats();
              renderCreatorPayments();
          }
          
          // Update creator rate
          async function updateCreatorRate(creator, rate) {
              settings.creatorRates[creator] = parseFloat(rate);
              await saveSettings();
              updatePaymentStats();
              renderCreatorPayments();
          }
          
          // Save settings
          async function saveSettings() {
              try {
                  await fetch('/api/settings', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(settings)
                  });
              } catch (error) {
                  console.error('Error saving settings:', error);
              }
          }
          
          // Mark creator paid
          async function markCreatorPaid(creator) {
              const creatorAds = ads.filter(ad => ad.creator === creator && !ad.paid);
              const adIds = creatorAds.map(ad => ad.id);
              
              if (!confirm(\`Mark \${creatorAds.length} ads as paid for \${creator}?\\n\\nThis action cannot be undone.\`)) {
                  return;
              }
              
              try {
                  const response = await fetch('/api/payments/mark', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ adIds })
                  });
                  
                  if (!response.ok) throw new Error('Failed to mark as paid');
                  
                  const updated = await response.json();
                  updated.forEach(updatedAd => {
                      const index = ads.findIndex(a => a.id === updatedAd.id);
                      ads[index] = updatedAd;
                  });
                  
                  updatePaymentStats();
                  renderCreatorPayments();
                  showSuccess(\`Marked \${updated.length} ads as paid\`);
              } catch (error) {
                  console.error('Error marking as paid:', error);
                  showError('Failed to mark ads as paid. Please try again.');
              }
          }
          
          // Export data
          async function exportData() {
              try {
                  window.location.href = '/api/export';
              } catch (error) {
                  console.error('Error exporting data:', error);
                  showError('Failed to export data. Please try again.');
              }
          }
          
          // Show error message
          function showError(message) {
              const div = document.createElement('div');
              div.className = 'error';
              div.textContent = message;
              document.querySelector('.container').insertBefore(div, document.querySelector('.container').firstChild);
              setTimeout(() => div.remove(), 5000);
          }
          
          // Show success message
          function showSuccess(message) {
              const div = document.createElement('div');
              div.className = 'success';
              div.textContent = message;
              document.querySelector('.container').insertBefore(div, document.querySelector('.container').firstChild);
              setTimeout(() => div.remove(), 3000);
          }
          
          // Initialize on load
          window.addEventListener('load', init);
          
          // Close modal on outside click
          window.onclick = function(event) {
              const modal = document.getElementById('bulk-modal');
              if (event.target === modal) {
                  closeBulkModal();
              }
          }
      </script>
  </body>
  </html>`;
  }