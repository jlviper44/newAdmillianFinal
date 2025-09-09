// Cloudflare Worker Script for TikTok Launch Tracker

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
  })
  
  // Get EST time helpers
  function getESTDate() {
    const now = new Date();
    const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
    const estOffset = -5; // EST is UTC-5 (not considering DST for simplicity)
    return new Date(utcTime + (3600000 * estOffset));
  }
  
  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }
  
  function getWeekEnd(date) {
    const monday = getWeekStart(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  }
  
  function formatWeekKey(date) {
    const monday = getWeekStart(date);
    return `week_${monday.toISOString().split('T')[0]}`;
  }
  
  function formatDayKey(date) {
    return `day_${date.toISOString().split('T')[0]}`;
  }
  
  async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;
  
    try {
      // API Routes
      if (path === '/api/entries' && request.method === 'GET') {
        return await getEntries(request);
      } else if (path === '/api/entries' && request.method === 'POST') {
        return await createEntry(request);
      } else if (path.startsWith('/api/entries/') && request.method === 'PUT') {
        return await updateEntry(request);
      } else if (path.startsWith('/api/entries/') && request.method === 'DELETE') {
        return await deleteEntry(request);
      } else if (path === '/api/weekly-summary' && request.method === 'GET') {
        return await getWeeklySummary(request);
      } else if (path === '/api/export' && request.method === 'GET') {
        return await exportData(request);
      } else if (path === '/api/timeclock' && request.method === 'POST') {
        return await submitTimeClock(request);
      } else if (path === '/api/timeclock' && request.method === 'GET') {
        return await getTimeClockData(request);
      } else if (path === '/api/payroll' && request.method === 'GET') {
        return await getPayrollData(request);
      } else if (path === '/api/payroll-report' && request.method === 'POST') {
        return await createPayrollReport(request);
      } else if (path === '/api/payroll-report' && request.method === 'GET') {
        return await getPayrollReports(request);
      } else if (path.startsWith('/api/payroll-report/') && request.method === 'PUT') {
        return await updatePayrollReport(request);
      } else if (path === '/api/payroll-report/export' && request.method === 'GET') {
        return await exportPayrollReport(request);
      } else if (path === '/api/generate-weekly-payroll' && request.method === 'POST') {
        return await generateWeeklyPayroll(request);
      } else if (path === '/scheduled' && request.method === 'GET') {
        return await handleScheduledTask(request);
      } else {
        // Return the HTML content for non-API routes
        return new Response(HTML_CONTENT, {
          headers: { 
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache'
          },
        });
      }
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function getEntries(request) {
    try {
      const url = new URL(request.url);
      const weekKey = url.searchParams.get('week') || formatWeekKey(getESTDate());
      
      const data = await TIKTOK_TRACKER.get(weekKey, 'json') || { entries: [] };
      
      return new Response(JSON.stringify(data), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
      });
    } catch (error) {
      console.error('Error in getEntries:', error);
      return new Response(JSON.stringify({ entries: [] }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function createEntry(request) {
    try {
      const entry = await request.json();
      const now = getESTDate();
      entry.id = `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      entry.timestamp = now.toISOString();
      entry.createdAt = now.toISOString();
      
      const weekKey = formatWeekKey(now);
      const data = await TIKTOK_TRACKER.get(weekKey, 'json') || { entries: [] };
      
      data.entries.push(entry);
      
      await TIKTOK_TRACKER.put(weekKey, JSON.stringify(data));
      
      return new Response(JSON.stringify(entry), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in createEntry:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function updateEntry(request) {
    try {
      const url = new URL(request.url);
      const entryId = url.pathname.split('/').pop();
      const updates = await request.json();
      
      const weekKey = url.searchParams.get('week') || formatWeekKey(getESTDate());
      const data = await TIKTOK_TRACKER.get(weekKey, 'json') || { entries: [] };
      
      const entryIndex = data.entries.findIndex(e => e.id === entryId);
      if (entryIndex === -1) {
        return new Response('Entry not found', { status: 404 });
      }
      
      data.entries[entryIndex] = { ...data.entries[entryIndex], ...updates };
      data.entries[entryIndex].updatedAt = getESTDate().toISOString();
      
      await TIKTOK_TRACKER.put(weekKey, JSON.stringify(data));
      
      return new Response(JSON.stringify(data.entries[entryIndex]), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in updateEntry:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function deleteEntry(request) {
    try {
      const url = new URL(request.url);
      const entryId = url.pathname.split('/').pop();
      const weekKey = url.searchParams.get('week') || formatWeekKey(getESTDate());
      
      const data = await TIKTOK_TRACKER.get(weekKey, 'json') || { entries: [] };
      
      data.entries = data.entries.filter(e => e.id !== entryId);
      
      await TIKTOK_TRACKER.put(weekKey, JSON.stringify(data));
      
      return new Response('Deleted', { status: 200 });
    } catch (error) {
      console.error('Error in deleteEntry:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function getWeeklySummary(request) {
    try {
      const url = new URL(request.url);
      const vaName = url.searchParams.get('va');
      
      // Get all weeks
      const list = await TIKTOK_TRACKER.list();
      const summaries = [];
      
      for (const key of list.keys) {
        if (key.name.startsWith('week_')) {
          const data = await TIKTOK_TRACKER.get(key.name, 'json') || { entries: [] };
          
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
      
      return new Response(JSON.stringify(summaries), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in getWeeklySummary:', error);
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function exportData(request) {
    try {
      const url = new URL(request.url);
      const weekKey = url.searchParams.get('week') || formatWeekKey(getESTDate());
      
      const data = await TIKTOK_TRACKER.get(weekKey, 'json') || { entries: [] };
      
      // Create CSV with updated headers including new fields
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
          'Content-Disposition': `attachment; filename="tiktok_launches_${weekKey}.csv"`
        },
      });
    } catch (error) {
      console.error('Error in exportData:', error);
      return new Response('Error exporting data', { status: 500 });
    }
  }
  
  async function submitTimeClock(request) {
    try {
      const data = await request.json();
      const now = getESTDate();
      const dayKey = formatDayKey(now);
      
      // Store time clock data
      const timeClockKey = `timeclock_${dayKey}_${data.va}`;
      await TIKTOK_TRACKER.put(timeClockKey, JSON.stringify({
        ...data,
        timestamp: now.toISOString(),
        dayKey: dayKey
      }));
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in submitTimeClock:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function getTimeClockData(request) {
    try {
      const url = new URL(request.url);
      const va = url.searchParams.get('va');
      const date = url.searchParams.get('date');
      
      if (!va || !date) {
        return new Response(JSON.stringify({ error: 'VA and date required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const dayKey = `day_${date}`;
      const timeClockKey = `timeclock_${dayKey}_${va}`;
      
      const timeClockData = await TIKTOK_TRACKER.get(timeClockKey, 'json');
      
      // Get launches for this VA on this date
      const weekKey = formatWeekKey(new Date(date));
      const weekData = await TIKTOK_TRACKER.get(weekKey, 'json') || { entries: [] };
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayLaunches = weekData.entries.filter(e => {
        const entryDate = new Date(e.timestamp);
        return e.va === va && entryDate >= dayStart && entryDate <= dayEnd;
      });
      
      return new Response(JSON.stringify({
        timeClockData,
        launches: dayLaunches.length,
        entries: dayLaunches
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in getTimeClockData:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function getPayrollData(request) {
    try {
      const url = new URL(request.url);
      const va = url.searchParams.get('va');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      
      if (!va || !startDate || !endDate) {
        return new Response(JSON.stringify({ error: 'VA, startDate, and endDate required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      let totalHours = 0;
      let totalRealSpend = 0;
      let timeClockEntries = [];
      let launchEntries = [];
      
      // Get all time clock entries for the period
      const list = await TIKTOK_TRACKER.list();
      
      for (const key of list.keys) {
        if (key.name.startsWith(`timeclock_`) && key.name.includes(va)) {
          const data = await TIKTOK_TRACKER.get(key.name, 'json');
          if (data && data.dayKey) {
            const clockDate = new Date(data.dayKey.replace('day_', ''));
            
            if (clockDate >= start && clockDate <= end) {
              totalHours += parseFloat(data.hoursWorked || 0);
              timeClockEntries.push(data);
            }
          }
        }
        
        if (key.name.startsWith('week_')) {
          const weekData = await TIKTOK_TRACKER.get(key.name, 'json') || { entries: [] };
          const vaEntries = (weekData.entries || []).filter(e => {
            const entryDate = new Date(e.timestamp);
            return e.va === va && entryDate >= start && entryDate <= end;
          });
          
          vaEntries.forEach(entry => {
            totalRealSpend += parseFloat(entry.realSpend || 0);
            launchEntries.push(entry);
          });
        }
      }
      
      const hourlyPay = totalHours * 5; // $5 per hour
      const commissionPay = totalRealSpend * 0.03; // 3% of real spend
      const totalPay = hourlyPay + commissionPay;
      
      return new Response(JSON.stringify({
        va,
        period: { start: startDate, end: endDate },
        totalHours,
        totalRealSpend,
        hourlyPay,
        commissionPay,
        totalPay,
        timeClockEntries,
        launchEntries: launchEntries.length
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in getPayrollData:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function createPayrollReport(request) {
    try {
      const report = await request.json();
      const now = getESTDate();
      report.id = `payroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      report.createdAt = now.toISOString();
      report.status = report.status || 'unpaid';
      
      // Store in payroll history
      const historyKey = `payroll_history_${report.va}_${report.id}`;
      await TIKTOK_TRACKER.put(historyKey, JSON.stringify(report));
      
      // Also store in a list for easy retrieval
      const listKey = `payroll_list_${report.va}`;
      const existingList = await TIKTOK_TRACKER.get(listKey, 'json') || { reports: [] };
      existingList.reports.push({
        id: report.id,
        period: report.period,
        totalPay: report.totalPay,
        status: report.status,
        createdAt: report.createdAt
      });
      await TIKTOK_TRACKER.put(listKey, JSON.stringify(existingList));
      
      return new Response(JSON.stringify(report), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in createPayrollReport:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function getPayrollReports(request) {
    try {
      const url = new URL(request.url);
      const va = url.searchParams.get('va');
      const reportId = url.searchParams.get('id');
      
      if (reportId && va) {
        // Get specific report
        const historyKey = `payroll_history_${va}_${reportId}`;
        const report = await TIKTOK_TRACKER.get(historyKey, 'json');
        return new Response(JSON.stringify(report || null), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (va) {
        // Get all reports for a VA
        const listKey = `payroll_list_${va}`;
        const list = await TIKTOK_TRACKER.get(listKey, 'json') || { reports: [] };
        return new Response(JSON.stringify(list), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        // Get all VAs with payroll reports
        const allVAs = new Set();
        const list = await TIKTOK_TRACKER.list({ prefix: 'payroll_list_' });
        
        for (const key of list.keys) {
          const va = key.name.replace('payroll_list_', '');
          allVAs.add(va);
        }
        
        const reports = [];
        for (const va of allVAs) {
          const listKey = `payroll_list_${va}`;
          const vaList = await TIKTOK_TRACKER.get(listKey, 'json') || { reports: [] };
          vaList.reports.forEach(report => {
            reports.push({ ...report, va });
          });
        }
        
        return new Response(JSON.stringify({ reports }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (error) {
      console.error('Error in getPayrollReports:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function updatePayrollReport(request) {
    try {
      const url = new URL(request.url);
      const reportId = url.pathname.split('/').pop();
      const updates = await request.json();
      const va = updates.va;
      
      if (!va) {
        return new Response(JSON.stringify({ error: 'VA required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Get existing report
      const historyKey = `payroll_history_${va}_${reportId}`;
      const existingReport = await TIKTOK_TRACKER.get(historyKey, 'json');
      
      if (!existingReport) {
        return new Response('Report not found', { status: 404 });
      }
      
      // Update report
      const updatedReport = { ...existingReport, ...updates };
      updatedReport.updatedAt = getESTDate().toISOString();
      
      await TIKTOK_TRACKER.put(historyKey, JSON.stringify(updatedReport));
      
      // Update list entry
      const listKey = `payroll_list_${va}`;
      const list = await TIKTOK_TRACKER.get(listKey, 'json') || { reports: [] };
      const reportIndex = list.reports.findIndex(r => r.id === reportId);
      if (reportIndex !== -1) {
        list.reports[reportIndex] = {
          id: reportId,
          period: updatedReport.period,
          totalPay: updatedReport.totalPay,
          status: updatedReport.status,
          createdAt: updatedReport.createdAt,
          updatedAt: updatedReport.updatedAt
        };
        await TIKTOK_TRACKER.put(listKey, JSON.stringify(list));
      }
      
      return new Response(JSON.stringify(updatedReport), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in updatePayrollReport:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function exportPayrollReport(request) {
    try {
      const url = new URL(request.url);
      const va = url.searchParams.get('va');
      const reportId = url.searchParams.get('id');
      
      if (!va || !reportId) {
        return new Response('VA and report ID required', { status: 400 });
      }
      
      const historyKey = `payroll_history_${va}_${reportId}`;
      const report = await TIKTOK_TRACKER.get(historyKey, 'json');
      
      if (!report) {
        return new Response('Report not found', { status: 404 });
      }
      
      // Create detailed CSV
      const csv = [
        ['Payroll Report'],
        [''],
        ['VA Name:', report.va],
        ['Period:', `${report.period.start} to ${report.period.end}`],
        ['Generated:', new Date(report.createdAt).toLocaleString('en-US', { timeZone: 'America/New_York' })],
        ['Status:', report.status],
        ['Payment Method:', report.paymentMethod || 'Not specified'],
        [''],
        ['Earnings Breakdown'],
        ['Total Hours Worked:', report.totalHours?.toFixed(1) || '0'],
        ['Hourly Rate:', `${report.hourlyRate || 5}/hour`],
        ['Hourly Pay:', `${report.hourlyPay?.toFixed(2) || '0.00'}`],
        [''],
        ['Total Real Spend:', `${report.totalRealSpend?.toFixed(2) || '0.00'}`],
        ['Commission Rate:', `${report.commissionRate || 3}%`],
        ['Commission Pay:', `${report.commissionPay?.toFixed(2) || '0.00'}`],
        [''],
        report.bonusAmount ? ['Bonus:', `${report.bonusAmount.toFixed(2)} (${report.bonusReason || 'No reason specified'})`] : [],
        [''],
        ['Total Pay:', `${report.totalPay?.toFixed(2) || '0.00'}`],
        [''],
        ['Notes:', report.notes || 'None']
      ].filter(row => row.length > 0).map(row => row.join(','));
      
      return new Response(csv.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="payroll_${va}_${report.period.start}_to_${report.period.end}.csv"`
        },
      });
    } catch (error) {
      console.error('Error in exportPayrollReport:', error);
      return new Response('Error exporting report', { status: 500 });
    }
  }
  
  async function generateWeeklyPayroll(request) {
    try {
      // Get all VAs
      const vaSet = new Set();
      const list = await TIKTOK_TRACKER.list();
      
      for (const key of list.keys) {
        if (key.name.startsWith('timeclock_')) {
          const parts = key.name.split('_');
          if (parts.length >= 4) {
            vaSet.add(parts[3]);
          }
        }
      }
      
      // Get last Monday and Sunday
      const now = getESTDate();
      const lastSunday = new Date(now);
      lastSunday.setDate(now.getDate() - now.getDay());
      lastSunday.setHours(23, 59, 59, 999);
      
      const lastMonday = new Date(lastSunday);
      lastMonday.setDate(lastSunday.getDate() - 6);
      lastMonday.setHours(0, 0, 0, 0);
      
      const reports = [];
      
      for (const va of vaSet) {
        // Get payroll data for the week
        const payrollData = await getPayrollDataForPeriod(va, lastMonday, lastSunday);
        
        if (payrollData.totalHours > 0 || payrollData.totalRealSpend > 0) {
          // Create payroll report
          const report = {
            va,
            period: {
              start: lastMonday.toISOString().split('T')[0],
              end: lastSunday.toISOString().split('T')[0]
            },
            totalHours: payrollData.totalHours,
            totalRealSpend: payrollData.totalRealSpend,
            hourlyRate: 5,
            commissionRate: 3,
            hourlyPay: payrollData.totalHours * 5,
            commissionPay: payrollData.totalRealSpend * 0.03,
            bonusAmount: 0,
            bonusReason: '',
            totalPay: (payrollData.totalHours * 5) + (payrollData.totalRealSpend * 0.03),
            status: 'unpaid',
            paymentMethod: '',
            notes: 'Auto-generated weekly payroll',
            timeClockEntries: payrollData.timeClockEntries,
            launchEntries: payrollData.launchEntries
          };
          
          // Save report
          const savedReport = await createPayrollReportInternal(report);
          reports.push(savedReport);
        }
      }
      
      return new Response(JSON.stringify({ 
        message: 'Weekly payroll generated',
        reports: reports.length,
        period: { start: lastMonday.toISOString().split('T')[0], end: lastSunday.toISOString().split('T')[0] }
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Error in generateWeeklyPayroll:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  async function getPayrollDataForPeriod(va, start, end) {
    let totalHours = 0;
    let totalRealSpend = 0;
    let timeClockEntries = [];
    let launchEntries = [];
    
    const list = await TIKTOK_TRACKER.list();
    
    for (const key of list.keys) {
      if (key.name.startsWith(`timeclock_`) && key.name.includes(va)) {
        const data = await TIKTOK_TRACKER.get(key.name, 'json');
        if (data && data.dayKey) {
          const clockDate = new Date(data.dayKey.replace('day_', ''));
          
          if (clockDate >= start && clockDate <= end) {
            totalHours += parseFloat(data.hoursWorked || 0);
            timeClockEntries.push(data);
          }
        }
      }
      
      if (key.name.startsWith('week_')) {
        const weekData = await TIKTOK_TRACKER.get(key.name, 'json') || { entries: [] };
        const vaEntries = (weekData.entries || []).filter(e => {
          const entryDate = new Date(e.timestamp);
          return e.va === va && entryDate >= start && entryDate <= end;
        });
        
        vaEntries.forEach(entry => {
          totalRealSpend += parseFloat(entry.realSpend || 0);
          launchEntries.push(entry);
        });
      }
    }
    
    return {
      totalHours,
      totalRealSpend,
      timeClockEntries,
      launchEntries: launchEntries.length
    };
  }
  
  async function createPayrollReportInternal(report) {
    const now = getESTDate();
    report.id = `payroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    report.createdAt = now.toISOString();
    report.status = report.status || 'unpaid';
    
    const historyKey = `payroll_history_${report.va}_${report.id}`;
    await TIKTOK_TRACKER.put(historyKey, JSON.stringify(report));
    
    const listKey = `payroll_list_${report.va}`;
    const existingList = await TIKTOK_TRACKER.get(listKey, 'json') || { reports: [] };
    existingList.reports.push({
      id: report.id,
      period: report.period,
      totalPay: report.totalPay,
      status: report.status,
      createdAt: report.createdAt
    });
    await TIKTOK_TRACKER.put(listKey, JSON.stringify(existingList));
    
    return report;
  }
  
  async function handleScheduledTask(request) {
    // This endpoint would be triggered by a Cloudflare Cron Trigger
    // Set to run every Monday at 00:15 EST
    const now = getESTDate();
    
    if (now.getDay() === 1 && now.getHours() === 0) {
      return await generateWeeklyPayroll(request);
    }
    
    return new Response('Not scheduled time', { status: 200 });
  }
  
  // HTML Content
  const HTML_CONTENT = `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>TikTok Launch Tracker</title>
      <style>
          * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
          }
          
          body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #f5f5f5;
              color: #333;
          }
          
          .container {
              max-width: 1600px;
              margin: 0 auto;
              padding: 20px;
          }
          
          .header {
              background: #fff;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .header h1 {
              font-size: 24px;
              margin-bottom: 10px;
          }
          
          .tab-container {
              background: #fff;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin-bottom: 20px;
          }
          
          .tabs {
              display: flex;
              border-bottom: 2px solid #e9ecef;
          }
          
          .tab {
              padding: 15px 30px;
              cursor: pointer;
              background: #f8f9fa;
              border: none;
              font-size: 16px;
              font-weight: 500;
              transition: all 0.3s;
          }
          
          .tab:hover {
              background: #e9ecef;
          }
          
          .tab.active {
              background: #007bff;
              color: white;
          }
          
          .tab-content {
              display: none;
              padding: 20px;
          }
          
          .tab-content.active {
              display: block;
          }
          
          .controls {
              display: flex;
              gap: 15px;
              margin-bottom: 20px;
              flex-wrap: wrap;
          }
          
          .control-group {
              display: flex;
              align-items: center;
              gap: 10px;
          }
          
          input, select, button {
              padding: 8px 12px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 14px;
          }
          
          button {
              background: #007bff;
              color: white;
              cursor: pointer;
              border: none;
          }
          
          button:hover {
              background: #0056b3;
          }
          
          .secondary-btn {
              background: #6c757d;
          }
          
          .secondary-btn:hover {
              background: #545b62;
          }
          
          .success-btn {
              background: #28a745;
          }
          
          .success-btn:hover {
              background: #218838;
          }
          
          .table-container {
              background: #fff;
              border-radius: 8px;
              overflow: auto;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              margin-bottom: 20px;
          }
          
          table {
              width: 100%;
              border-collapse: collapse;
              min-width: 1400px;
          }
          
          th, td {
              padding: 10px 8px;
              text-align: left;
              border-bottom: 1px solid #eee;
              font-size: 13px;
          }
          
          th {
              background: #f8f9fa;
              font-weight: 600;
              position: sticky;
              top: 0;
              z-index: 10;
          }
          
          tr:hover {
              background: #f8f9fa;
          }
          
          .editable {
              cursor: pointer;
              padding: 4px;
              border-radius: 4px;
          }
          
          .editable:hover {
              background: #e9ecef;
          }
          
          .editing {
              background: #fff3cd;
          }
          
          .totals-row {
              font-weight: bold;
              background: #e9ecef;
          }
          
          .summary-cards {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 15px;
              margin-bottom: 20px;
          }
          
          .summary-card {
              background: white;
              padding: 15px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .summary-card h3 {
              font-size: 14px;
              color: #666;
              margin-bottom: 5px;
          }
          
          .summary-card .value {
              font-size: 24px;
              font-weight: bold;
              color: #333;
          }
          
          .week-selector {
              background: #fff;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .status-badge {
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 500;
          }
          
          .status-active { background: #d4edda; color: #155724; }
          .status-banned { background: #f8d7da; color: #721c24; }
          .status-wh-ban { background: #fff3cd; color: #856404; }
          .status-bh-ban { background: #cce5ff; color: #004085; }
          .status-pf { background: #e2e3e5; color: #383d41; }
          
          .action-buttons {
              display: flex;
              gap: 5px;
          }
          
          .edit-btn, .delete-btn {
              padding: 4px 8px;
              font-size: 12px;
          }
          
          .delete-btn {
              background: #dc3545;
          }
          
          .delete-btn:hover {
              background: #c82333;
          }
          
          .add-entry-row {
              background: #e8f4fd;
          }
          
          .add-entry-row td {
              padding: 8px 4px;
          }
          
          .add-entry-row input, .add-entry-row select {
              width: 100%;
              padding: 6px;
              font-size: 13px;
          }
          
          .save-entry-btn {
              background: #28a745;
              padding: 6px 12px;
              font-size: 13px;
          }
          
          .save-entry-btn:hover {
              background: #218838;
          }
          
          .clock-in-section {
              background: #fff;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .clock-form {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
              gap: 20px;
              margin-bottom: 20px;
          }
          
          .form-group {
              display: flex;
              flex-direction: column;
              gap: 5px;
          }
          
          .form-group label {
              font-weight: 500;
              color: #495057;
          }
          
          .form-group input {
              width: 100%;
          }
          
          .clock-summary {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
              margin-top: 20px;
          }
          
          .payroll-section {
              background: #fff;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .payroll-results {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-top: 20px;
          }
          
          .payroll-breakdown {
              display: grid;
              gap: 10px;
              margin-top: 15px;
          }
          
          .payroll-line {
              display: flex;
              justify-content: space-between;
              padding: 10px;
              background: white;
              border-radius: 4px;
          }
          
          .payroll-total {
              font-size: 18px;
              font-weight: bold;
              background: #007bff;
              color: white;
          }
          
          .rate-settings {
              background: #e8f4fd;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
          }
          
          .rate-settings h3 {
              margin-bottom: 15px;
              color: #0056b3;
          }
          
          .rate-inputs {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 15px;
              margin-bottom: 15px;
          }
          
          .bonus-section {
              background: #fff3cd;
              padding: 15px;
              border-radius: 8px;
              margin-top: 20px;
          }
          
          .bonus-section h4 {
              margin-bottom: 10px;
              color: #856404;
          }
          
          .bonus-inputs {
              display: grid;
              grid-template-columns: 1fr 2fr;
              gap: 10px;
              align-items: end;
          }
          
          .modal {
              position: fixed;
              z-index: 1000;
              left: 0;
              top: 0;
              width: 100%;
              height: 100%;
              overflow: auto;
              background-color: rgba(0,0,0,0.4);
          }
          
          .modal-content {
              background-color: #fefefe;
              margin: 5% auto;
              padding: 20px;
              border: 1px solid #888;
              border-radius: 8px;
              width: 80%;
              max-width: 800px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          
          .close {
              color: #aaa;
              float: right;
              font-size: 28px;
              font-weight: bold;
              cursor: pointer;
          }
          
          .close:hover,
          .close:focus {
              color: black;
          }
          
          .modal-actions {
              display: flex;
              gap: 10px;
              justify-content: flex-end;
          }
          
          .payroll-history-section {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
          }
          
          .status-unpaid {
              background: #f8d7da;
              color: #721c24;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
          }
          
          .status-paid {
              background: #d4edda;
              color: #155724;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="header">
              <h1>TikTok Launch Tracker</h1>
          </div>
          
          <div class="tab-container">
              <div class="tabs">
                  <button class="tab active" onclick="switchTab('launches')">Launch Tracker</button>
                  <button class="tab" onclick="switchTab('clockin')">Clock In/Out</button>
                  <button class="tab" onclick="switchTab('payroll')">Payroll Calculator</button>
              </div>
              
              <!-- Launch Tracker Tab -->
              <div id="launches-tab" class="tab-content active">
                  <div class="controls">
                      <div class="control-group">
                          <label>VA:</label>
                          <input type="text" id="vaFilter" placeholder="Filter by VA">
                      </div>
                      <div class="control-group">
                          <label>Status:</label>
                          <select id="statusFilter">
                              <option value="">All</option>
                              <option value="Active">Active</option>
                              <option value="Banned">Banned</option>
                              <option value="WH Ban">WH Ban</option>
                              <option value="BH Ban">BH Ban</option>
                              <option value="PF">PF</option>
                              <option value="Other">Other</option>
                          </select>
                      </div>
                      <div class="control-group">
                          <label>Offer:</label>
                          <select id="offerFilter">
                              <option value="">All</option>
                              <option value="Cash">Cash</option>
                              <option value="Shein">Shein</option>
                              <option value="Auto">Auto</option>
                              <option value="CPI">CPI</option>
                              <option value="Other">Other</option>
                          </select>
                      </div>
                      <button onclick="applyFilters()">Apply Filters</button>
                      <button onclick="clearFilters()" class="secondary-btn">Clear</button>
                      <button onclick="exportData()">Export CSV</button>
                  </div>
                  
                  <div class="week-selector">
                      <h3>Current Week: <span id="currentWeek"></span></h3>
                      <select id="weekSelect" onchange="loadWeek()">
                          <option value="current">Current Week</option>
                      </select>
                  </div>
                  
                  <div class="summary-cards" id="summaryCards">
                      <div class="summary-card">
                          <h3>Total Entries</h3>
                          <div class="value" id="totalEntries">0</div>
                      </div>
                      <div class="summary-card">
                          <h3>Total Ad Spend</h3>
                          <div class="value" id="totalAdSpend">$0.00</div>
                      </div>
                      <div class="summary-card">
                          <h3>Total BC Spend</h3>
                          <div class="value" id="totalBCSpend">$0.00</div>
                      </div>
                      <div class="summary-card">
                          <h3>Total Amount Lost</h3>
                          <div class="value" id="totalAmountLost">$0.00</div>
                      </div>
                      <div class="summary-card">
                          <h3>Total Real Spend</h3>
                          <div class="value" id="totalRealSpend">$0.00</div>
                      </div>
                  </div>
                  
                  <div class="table-container">
                      <table id="entriesTable">
                          <thead>
                              <tr>
                                  <th>VA</th>
                                  <th>Time</th>
                                  <th>Campaign ID</th>
                                  <th>BC GEO</th>
                                  <th>BC Type</th>
                                  <th>WH Obj</th>
                                  <th>Launch Target</th>
                                  <th>Status</th>
                                  <th>Ban</th>
                                  <th>Ad Spend</th>
                                  <th>BC Spend</th>
                                  <th>Amount Lost</th>
                                  <th>Real Spend</th>
                                  <th>Offer</th>
                                  <th>Notes</th>
                                  <th>Actions</th>
                              </tr>
                          </thead>
                          <tbody id="tableBody">
                              <tr class="add-entry-row">
                                  <td><input type="text" id="newVa" placeholder="VA Name"></td>
                                  <td>-</td>
                                  <td><input type="text" id="newCampaignId" placeholder="Campaign ID"></td>
                                  <td><input type="text" id="newBcGeo" placeholder="BC GEO"></td>
                                  <td>
                                      <select id="newBcType">
                                          <option value="">Select...</option>
                                          <option value="Auto">Auto</option>
                                          <option value="Manual">Manual</option>
                                      </select>
                                  </td>
                                  <td>
                                      <select id="newWhObj">
                                          <option value="">Select...</option>
                                          <option value="Sales">Sales</option>
                                          <option value="Sales +">Sales +</option>
                                          <option value="Video Views">Video Views</option>
                                          <option value="Reach">Reach</option>
                                          <option value="Traffic">Traffic</option>
                                          <option value="Lead Gen">Lead Gen</option>
                                          <option value="Lead Gen +">Lead Gen +</option>
                                      </select>
                                  </td>
                                  <td>
                                      <select id="newLaunchTarget">
                                          <option value="">Select...</option>
                                          <option value="US">US</option>
                                          <option value="UK">UK</option>
                                          <option value="CAN">CAN</option>
                                          <option value="AUS">AUS</option>
                                          <option value="Other">Other</option>
                                      </select>
                                  </td>
                                  <td>
                                      <select id="newStatus">
                                          <option value="">Select...</option>
                                          <option value="Active">Active</option>
                                          <option value="Banned">Banned</option>
                                          <option value="WH Ban">WH Ban</option>
                                          <option value="BH Ban">BH Ban</option>
                                          <option value="PF">PF</option>
                                          <option value="Other">Other</option>
                                      </select>
                                  </td>
                                  <td>
                                      <select id="newBan">
                                          <option value="">Select...</option>
                                          <option value="WH Instant">WH Instant</option>
                                          <option value="WH Delay">WH Delay</option>
                                          <option value="BH Instant">BH Instant</option>
                                          <option value="BH Delay">BH Delay</option>
                                          <option value="Dupe">Dupe</option>
                                      </select>
                                  </td>
                                  <td><input type="number" id="newAdSpend" placeholder="0.00" step="0.01"></td>
                                  <td><input type="number" id="newBcSpend" placeholder="0.00" step="0.01"></td>
                                  <td>-</td>
                                  <td>-</td>
                                  <td>
                                      <select id="newOffer">
                                          <option value="">Select...</option>
                                          <option value="Cash">Cash</option>
                                          <option value="Shein">Shein</option>
                                          <option value="Auto">Auto</option>
                                          <option value="CPI">CPI</option>
                                          <option value="Other">Other</option>
                                      </select>
                                  </td>
                                  <td><input type="text" id="newNotes" placeholder="Notes"></td>
                                  <td><button class="save-entry-btn" onclick="saveNewEntry()">Add Entry</button></td>
                              </tr>
                          </tbody>
                          <tfoot>
                              <tr class="totals-row">
                                  <td colspan="9">Totals</td>
                                  <td id="footerAdSpend">$0.00</td>
                                  <td id="footerBCSpend">$0.00</td>
                                  <td id="footerAmountLost">$0.00</td>
                                  <td id="footerRealSpend">$0.00</td>
                                  <td colspan="3"></td>
                              </tr>
                          </tfoot>
                      </table>
                  </div>
                  
                  <div class="week-selector">
                      <h3>Previous Weeks</h3>
                      <div id="previousWeeks"></div>
                  </div>
              </div>
              
              <!-- Clock In/Out Tab -->
              <div id="clockin-tab" class="tab-content">
                  <div class="clock-in-section">
                      <h2>Daily Time Clock</h2>
                      <div class="clock-form">
                          <div class="form-group">
                              <label>VA Name</label>
                              <input type="text" id="clockVaName" placeholder="Enter your name">
                          </div>
                          <div class="form-group">
                              <label>Date</label>
                              <input type="date" id="clockDate" value="\${new Date().toISOString().split('T')[0]}">
                          </div>
                          <div class="form-group">
                              <label>Hours Worked</label>
                              <input type="number" id="hoursWorked" placeholder="0.0" step="0.5" min="0" max="24">
                          </div>
                          <div class="form-group">
                              <label>BCs Launched (Verification)</label>
                              <input type="number" id="bcsLaunched" placeholder="0" min="0">
                          </div>
                      </div>
                      <button onclick="checkLaunches()" class="secondary-btn">Check Today's Launches</button>
                      <button onclick="submitTimeClock()" class="success-btn">Submit Time Clock</button>
                      
                      <div id="clockSummary" class="clock-summary" style="display: none;">
                          <h3>Today's Summary</h3>
                          <div id="clockSummaryContent"></div>
                      </div>
                  </div>
              </div>
              
              <!-- Payroll Tab -->
              <div id="payroll-tab" class="tab-content">
                  <div class="payroll-section">
                      <h2>Payroll Management</h2>
                      
                      <!-- Payroll History Section -->
                      <div class="payroll-history-section" style="margin-bottom: 30px;">
                          <h3>Payroll History</h3>
                          <div class="controls" style="margin-bottom: 15px;">
                              <div class="control-group">
                                  <label>Filter by VA:</label>
                                  <input type="text" id="historyVaFilter" placeholder="VA name">
                              </div>
                              <div class="control-group">
                                  <label>Status:</label>
                                  <select id="historyStatusFilter">
                                      <option value="">All</option>
                                      <option value="unpaid">Unpaid</option>
                                      <option value="paid">Paid</option>
                                  </select>
                              </div>
                              <button onclick="loadPayrollHistory()">Filter</button>
                              <button onclick="generateWeeklyReports()" class="success-btn">Generate Weekly Reports</button>
                          </div>
                          
                          <div class="table-container" style="max-height: 400px;">
                              <table id="payrollHistoryTable">
                                  <thead>
                                      <tr>
                                          <th>VA</th>
                                          <th>Period</th>
                                          <th>Total Pay</th>
                                          <th>Status</th>
                                          <th>Payment Method</th>
                                          <th>Created</th>
                                          <th>Actions</th>
                                      </tr>
                                  </thead>
                                  <tbody id="payrollHistoryBody">
                                      <!-- Payroll history will be loaded here -->
                                  </tbody>
                              </table>
                          </div>
                      </div>
                      
                      <hr style="margin: 30px 0; border: 1px solid #e9ecef;">
                      
                      <!-- Create Custom Report Section -->
                      <h3>Create Custom Payroll Report</h3>
                      
                      <div class="rate-settings">
                          <h3>Pay Rate Settings</h3>
                          <div class="rate-inputs">
                              <div class="form-group">
                                  <label>Hourly Rate ($)</label>
                                  <input type="number" id="hourlyRate" value="5" min="0" step="0.25">
                              </div>
                              <div class="form-group">
                                  <label>Commission Rate (%)</label>
                                  <input type="number" id="commissionRate" value="3" min="0" max="100" step="0.1">
                              </div>
                          </div>
                      </div>
                      
                      <div class="clock-form">
                          <div class="form-group">
                              <label>VA Name</label>
                              <input type="text" id="payrollVaName" placeholder="Enter VA name">
                          </div>
                          <div class="form-group">
                              <label>Start Date</label>
                              <input type="date" id="payrollStartDate">
                          </div>
                          <div class="form-group">
                              <label>End Date</label>
                              <input type="date" id="payrollEndDate">
                          </div>
                          <div class="form-group">
                              <label>Payment Method</label>
                              <select id="paymentMethod">
                                  <option value="">Select method...</option>
                                  <option value="Wise">Wise</option>
                                  <option value="Crypto">Crypto</option>
                                  <option value="PayPal">PayPal</option>
                                  <option value="Other">Other</option>
                              </select>
                          </div>
                      </div>
                      
                      <div class="bonus-section">
                          <h4>Adjustments & Notes</h4>
                          <div class="bonus-inputs">
                              <div class="form-group">
                                  <label>Bonus Amount ($)</label>
                                  <input type="number" id="bonusAmount" value="0" min="0" step="0.01">
                              </div>
                              <div class="form-group">
                                  <label>Bonus Reason</label>
                                  <input type="text" id="bonusReason" placeholder="e.g., Performance bonus, Holiday bonus, etc.">
                              </div>
                          </div>
                          <div class="form-group" style="margin-top: 15px;">
                              <label>Notes</label>
                              <textarea id="payrollNotes" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" placeholder="Any additional notes for this payroll"></textarea>
                          </div>
                      </div>
                      
                      <button onclick="calculatePayroll()" class="success-btn" style="margin-top: 20px;">Calculate Pay</button>
                      
                      <div id="payrollResults" class="payroll-results" style="display: none;">
                          <h3>Payroll Summary</h3>
                          <div id="payrollContent"></div>
                          <div style="margin-top: 20px; display: flex; gap: 10px;">
                              <button onclick="savePayrollReport()" class="success-btn">Save Report</button>
                              <button onclick="downloadPayrollReport()" class="secondary-btn">Download CSV</button>
                          </div>
                      </div>
                  </div>
                  
                  <!-- Payroll Report Modal -->
                  <div id="payrollModal" class="modal" style="display: none;">
                      <div class="modal-content">
                          <span class="close" onclick="closePayrollModal()">&times;</span>
                          <h2>Payroll Report Details</h2>
                          <div id="modalPayrollContent"></div>
                          <div class="modal-actions" style="margin-top: 20px;">
                              <button onclick="updatePaymentStatus()" class="success-btn">Update Status</button>
                              <button onclick="downloadModalReport()" class="secondary-btn">Download</button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </div>
      
      <script>
          let currentData = { entries: [] };
          let filteredData = [];
          let currentWeek = '';
          let currentPayrollData = null;
          let currentPayrollReportId = null;
          
          // Initialize
          document.addEventListener('DOMContentLoaded', () => {
              updateCurrentWeek();
              loadWeek();
              loadPreviousWeeks();
              loadPayrollHistory();
              
              // Set default dates for payroll
              const today = new Date();
              const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
              document.getElementById('payrollStartDate').value = firstDay.toISOString().split('T')[0];
              document.getElementById('payrollEndDate').value = today.toISOString().split('T')[0];
          });
          
          function switchTab(tab) {
              // Update tab buttons
              document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
              event.target.classList.add('active');
              
              // Update content
              document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
              document.getElementById(\`\${tab}-tab\`).classList.add('active');
          }
          
          function updateCurrentWeek() {
              const now = new Date();
              const weekStart = getWeekStart(now);
              const weekEnd = getWeekEnd(now);
              
              document.getElementById('currentWeek').textContent = 
                  \`\${weekStart.toLocaleDateString()} - \${weekEnd.toLocaleDateString()}\`;
              
              currentWeek = formatWeekKey(now);
          }
          
          function getWeekStart(date) {
              const d = new Date(date);
              const day = d.getDay();
              const diff = d.getDate() - day + (day === 0 ? -6 : 1);
              const monday = new Date(d.setDate(diff));
              monday.setHours(0, 0, 0, 0);
              return monday;
          }
          
          function getWeekEnd(date) {
              const monday = getWeekStart(date);
              const sunday = new Date(monday);
              sunday.setDate(monday.getDate() + 6);
              sunday.setHours(23, 59, 59, 999);
              return sunday;
          }
          
          function formatWeekKey(date) {
              const monday = getWeekStart(date);
              return \`week_\${monday.toISOString().split('T')[0]}\`;
          }
          
          async function loadWeek() {
              const weekSelect = document.getElementById('weekSelect').value;
              const week = weekSelect === 'current' ? currentWeek : weekSelect;
              
              try {
                  const response = await fetch(\`/api/entries?week=\${week}\`);
                  currentData = await response.json();
                  filteredData = [...currentData.entries];
                  renderTable();
                  updateSummary();
              } catch (error) {
                  console.error('Error loading data:', error);
              }
          }
          
          async function loadPreviousWeeks() {
              try {
                  const response = await fetch('/api/weekly-summary');
                  const summaries = await response.json();
                  
                  const previousWeeksDiv = document.getElementById('previousWeeks');
                  const weekSelect = document.getElementById('weekSelect');
                  
                  summaries.forEach(summary => {
                      if (summary.week !== currentWeek) {
                          // Add to dropdown
                          const option = document.createElement('option');
                          option.value = summary.week;
                          option.textContent = summary.week.replace('week_', 'Week of ');
                          weekSelect.appendChild(option);
                          
                          // Add summary card
                          const card = document.createElement('div');
                          card.className = 'summary-card';
                          card.style.cursor = 'pointer';
                          card.onclick = () => {
                              document.getElementById('weekSelect').value = summary.week;
                              loadWeek();
                          };
                          card.innerHTML = \`
                              <h3>\${summary.week.replace('week_', 'Week of ')}</h3>
                              <div>Entries: \${summary.totalEntries}</div>
                              <div>Total Spend: $\${summary.totalRealSpend.toFixed(2)}</div>
                          \`;
                          previousWeeksDiv.appendChild(card);
                      }
                  });
              } catch (error) {
                  console.error('Error loading previous weeks:', error);
              }
          }
          
          function renderTable() {
              const tbody = document.getElementById('tableBody');
              // Remove all rows except the add entry row
              const addEntryRow = tbody.querySelector('.add-entry-row');
              tbody.innerHTML = '';
              tbody.appendChild(addEntryRow);
              
              filteredData.forEach(entry => {
                  const row = document.createElement('tr');
                  row.innerHTML = \`
                      <td class="editable" data-field="va" data-id="\${entry.id}">\${entry.va || ''}</td>
                      <td>\${new Date(entry.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td>
                      <td class="editable" data-field="campaignId" data-id="\${entry.id}">\${entry.campaignId || ''}</td>
                      <td class="editable" data-field="bcGeo" data-id="\${entry.id}">\${entry.bcGeo || ''}</td>
                      <td class="editable" data-field="bcType" data-id="\${entry.id}">\${entry.bcType || ''}</td>
                      <td class="editable" data-field="whObj" data-id="\${entry.id}">\${entry.whObj || ''}</td>
                      <td class="editable" data-field="launchTarget" data-id="\${entry.id}">\${entry.launchTarget || ''}</td>
                      <td class="editable" data-field="status" data-id="\${entry.id}">
                          <span class="status-badge status-\${(entry.status || '').toLowerCase().replace(/\s+/g, '-')}">\${entry.status || ''}</span>
                      </td>
                      <td class="editable" data-field="ban" data-id="\${entry.id}">\${entry.ban || ''}</td>
                      <td class="editable" data-field="adSpend" data-id="\${entry.id}">$\${parseFloat(entry.adSpend || 0).toFixed(2)}</td>
                      <td class="editable" data-field="bcSpend" data-id="\${entry.id}">$\${parseFloat(entry.bcSpend || 0).toFixed(2)}</td>
                      <td>$\${parseFloat(entry.amountLost || 0).toFixed(2)}</td>
                      <td>$\${parseFloat(entry.realSpend || 0).toFixed(2)}</td>
                      <td class="editable" data-field="offer" data-id="\${entry.id}">\${entry.offer || ''}</td>
                      <td class="editable" data-field="notes" data-id="\${entry.id}">\${entry.notes || ''}</td>
                      <td class="action-buttons">
                          <button class="delete-btn" onclick="deleteEntry('\${entry.id}')">Delete</button>
                      </td>
                  \`;
                  tbody.appendChild(row);
              });
              
              // Add click handlers for editable cells
              document.querySelectorAll('.editable').forEach(cell => {
                  cell.addEventListener('click', handleCellEdit);
              });
              
              updateFooterTotals();
          }
          
          function updateSummary() {
              const totals = calculateTotals(filteredData);
              
              document.getElementById('totalEntries').textContent = totals.entries;
              document.getElementById('totalAdSpend').textContent = \`$\${totals.adSpend.toFixed(2)}\`;
              document.getElementById('totalBCSpend').textContent = \`$\${totals.bcSpend.toFixed(2)}\`;
              document.getElementById('totalAmountLost').textContent = \`$\${totals.amountLost.toFixed(2)}\`;
              document.getElementById('totalRealSpend').textContent = \`$\${totals.realSpend.toFixed(2)}\`;
          }
          
          function updateFooterTotals() {
              const totals = calculateTotals(filteredData);
              
              document.getElementById('footerAdSpend').textContent = \`$\${totals.adSpend.toFixed(2)}\`;
              document.getElementById('footerBCSpend').textContent = \`$\${totals.bcSpend.toFixed(2)}\`;
              document.getElementById('footerAmountLost').textContent = \`$\${totals.amountLost.toFixed(2)}\`;
              document.getElementById('footerRealSpend').textContent = \`$\${totals.realSpend.toFixed(2)}\`;
          }
          
          function calculateTotals(data) {
              return {
                  entries: data.length,
                  adSpend: data.reduce((sum, e) => sum + parseFloat(e.adSpend || 0), 0),
                  bcSpend: data.reduce((sum, e) => sum + parseFloat(e.bcSpend || 0), 0),
                  amountLost: data.reduce((sum, e) => sum + parseFloat(e.amountLost || 0), 0),
                  realSpend: data.reduce((sum, e) => sum + parseFloat(e.realSpend || 0), 0)
              };
          }
          
          function handleCellEdit(event) {
              const cell = event.target;
              const field = cell.dataset.field;
              const id = cell.dataset.id;
              const currentValue = cell.textContent.replace('$', '').trim();
              
              // Create input based on field type
              let input;
              if (field === 'status' || field === 'bcType' || field === 'launchTarget' || field === 'offer' || field === 'ban' || field === 'whObj') {
                  input = createSelectForField(field, currentValue);
              } else {
                  input = document.createElement('input');
                  input.type = field === 'adSpend' || field === 'bcSpend' ? 'number' : 'text';
                  input.value = currentValue;
                  if (input.type === 'number') {
                      input.step = '0.01';
                  }
              }
              
              input.style.width = '100%';
              
              cell.innerHTML = '';
              cell.appendChild(input);
              cell.classList.add('editing');
              input.focus();
              
              const saveEdit = async () => {
                  const newValue = input.value;
                  const entry = currentData.entries.find(e => e.id === id);
                  
                  if (entry) {
                      entry[field] = newValue;
                      
                      // Recalculate derived fields
                      if (field === 'adSpend' || field === 'bcSpend') {
                          entry.amountLost = (parseFloat(entry.bcSpend || 0) - parseFloat(entry.adSpend || 0)).toFixed(2);
                          entry.realSpend = (parseFloat(entry.adSpend || 0) - parseFloat(entry.amountLost || 0)).toFixed(2);
                      }
                      
                      // Update on server
                      const weekSelect = document.getElementById('weekSelect').value;
                      const week = weekSelect === 'current' ? '' : weekSelect;
                      await fetch(\`/api/entries/\${id}?week=\${week}\`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(entry)
                      });
                      
                      renderTable();
                      updateSummary();
                  }
              };
              
              input.addEventListener('blur', saveEdit);
              input.addEventListener('keypress', (e) => {
                  if (e.key === 'Enter') {
                      saveEdit();
                  }
              });
          }
          
          function createSelectForField(field, currentValue) {
              const select = document.createElement('select');
              let options = [];
              
              switch(field) {
                  case 'status':
                      options = ['Active', 'Banned', 'WH Ban', 'BH Ban', 'PF', 'Other'];
                      break;
                  case 'bcType':
                      options = ['Auto', 'Manual'];
                      break;
                  case 'launchTarget':
                      options = ['US', 'UK', 'CAN', 'AUS', 'Other'];
                      break;
                  case 'offer':
                      options = ['Cash', 'Shein', 'Auto', 'CPI', 'Other'];
                      break;
                  case 'ban':
                      options = ['WH Instant', 'WH Delay', 'BH Instant', 'BH Delay', 'Dupe'];
                      break;
                  case 'whObj':
                      options = ['Sales', 'Sales +', 'Video Views', 'Reach', 'Traffic', 'Lead Gen', 'Lead Gen +'];
                      break;
              }
              
              options.forEach(opt => {
                  const option = document.createElement('option');
                  option.value = opt;
                  option.textContent = opt;
                  if (opt === currentValue) {
                      option.selected = true;
                  }
                  select.appendChild(option);
              });
              
              return select;
          }
          
          function applyFilters() {
              const vaFilter = document.getElementById('vaFilter').value.toLowerCase();
              const statusFilter = document.getElementById('statusFilter').value;
              const offerFilter = document.getElementById('offerFilter').value;
              
              filteredData = currentData.entries.filter(entry => {
                  if (vaFilter && !entry.va?.toLowerCase().includes(vaFilter)) return false;
                  if (statusFilter && entry.status !== statusFilter) return false;
                  if (offerFilter && entry.offer !== offerFilter) return false;
                  return true;
              });
              
              renderTable();
              updateSummary();
          }
          
          function clearFilters() {
              document.getElementById('vaFilter').value = '';
              document.getElementById('statusFilter').value = '';
              document.getElementById('offerFilter').value = '';
              filteredData = [...currentData.entries];
              renderTable();
              updateSummary();
          }
          
          async function saveNewEntry() {
              const entry = {
                  va: document.getElementById('newVa').value,
                  campaignId: document.getElementById('newCampaignId').value,
                  bcGeo: document.getElementById('newBcGeo').value,
                  bcType: document.getElementById('newBcType').value,
                  whObj: document.getElementById('newWhObj').value,
                  launchTarget: document.getElementById('newLaunchTarget').value,
                  status: document.getElementById('newStatus').value,
                  ban: document.getElementById('newBan').value,
                  adSpend: document.getElementById('newAdSpend').value || '0',
                  bcSpend: document.getElementById('newBcSpend').value || '0',
                  offer: document.getElementById('newOffer').value,
                  notes: document.getElementById('newNotes').value
              };
              
              // Validate required fields
              if (!entry.va || !entry.campaignId) {
                  alert('Please fill in at least VA and Campaign ID');
                  return;
              }
              
              // Calculate derived fields
              entry.amountLost = (parseFloat(entry.bcSpend || 0) - parseFloat(entry.adSpend || 0)).toFixed(2);
              entry.realSpend = (parseFloat(entry.adSpend || 0) - parseFloat(entry.amountLost || 0)).toFixed(2);
              
              try {
                  const response = await fetch('/api/entries', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(entry)
                  });
                  
                  if (response.ok) {
                      // Clear the form
                      document.getElementById('newVa').value = '';
                      document.getElementById('newCampaignId').value = '';
                      document.getElementById('newBcGeo').value = '';
                      document.getElementById('newBcType').value = '';
                      document.getElementById('newWhObj').value = '';
                      document.getElementById('newLaunchTarget').value = '';
                      document.getElementById('newStatus').value = '';
                      document.getElementById('newBan').value = '';
                      document.getElementById('newAdSpend').value = '';
                      document.getElementById('newBcSpend').value = '';
                      document.getElementById('newOffer').value = '';
                      document.getElementById('newNotes').value = '';
                      
                      loadWeek();
                  }
              } catch (error) {
                  console.error('Error adding entry:', error);
              }
          }
          
          async function deleteEntry(id) {
              if (confirm('Are you sure you want to delete this entry?')) {
                  const weekSelect = document.getElementById('weekSelect').value;
                  const week = weekSelect === 'current' ? '' : weekSelect;
                  
                  try {
                      await fetch(\`/api/entries/\${id}?week=\${week}\`, {
                          method: 'DELETE'
                      });
                      loadWeek();
                  } catch (error) {
                      console.error('Error deleting entry:', error);
                  }
              }
          }
          
          async function exportData() {
              const weekSelect = document.getElementById('weekSelect').value;
              const week = weekSelect === 'current' ? '' : weekSelect;
              
              window.location.href = \`/api/export?week=\${week}\`;
          }
          
          // Clock In/Out Functions
          async function checkLaunches() {
              const va = document.getElementById('clockVaName').value;
              const date = document.getElementById('clockDate').value;
              
              if (!va || !date) {
                  alert('Please enter VA name and date');
                  return;
              }
              
              try {
                  const response = await fetch(\`/api/timeclock?va=\${va}&date=\${date}\`);
                  const data = await response.json();
                  
                  document.getElementById('clockSummary').style.display = 'block';
                  document.getElementById('clockSummaryContent').innerHTML = \`
                      <p><strong>Launches found for \${va} on \${date}:</strong> \${data.launches}</p>
                      <p>Please verify this matches your count and update if needed.</p>
                  \`;
                  
                  document.getElementById('bcsLaunched').value = data.launches;
              } catch (error) {
                  console.error('Error checking launches:', error);
                  alert('Error checking launches');
              }
          }
          
          async function submitTimeClock() {
              const data = {
                  va: document.getElementById('clockVaName').value,
                  date: document.getElementById('clockDate').value,
                  hoursWorked: document.getElementById('hoursWorked').value,
                  bcsLaunched: document.getElementById('bcsLaunched').value
              };
              
              if (!data.va || !data.hoursWorked || !data.bcsLaunched) {
                  alert('Please fill in all fields');
                  return;
              }
              
              try {
                  const response = await fetch('/api/timeclock', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(data)
                  });
                  
                  if (response.ok) {
                      alert('Time clock submitted successfully!');
                      // Clear form
                      document.getElementById('hoursWorked').value = '';
                      document.getElementById('bcsLaunched').value = '';
                      document.getElementById('clockSummary').style.display = 'none';
                  }
              } catch (error) {
                  console.error('Error submitting time clock:', error);
                  alert('Error submitting time clock');
              }
          }
          
          // Payroll Functions
          async function calculatePayroll() {
              const va = document.getElementById('payrollVaName').value;
              const startDate = document.getElementById('payrollStartDate').value;
              const endDate = document.getElementById('payrollEndDate').value;
              const hourlyRate = parseFloat(document.getElementById('hourlyRate').value) || 5;
              const commissionRate = parseFloat(document.getElementById('commissionRate').value) || 3;
              const bonusAmount = parseFloat(document.getElementById('bonusAmount').value) || 0;
              const bonusReason = document.getElementById('bonusReason').value;
              
              if (!va || !startDate || !endDate) {
                  alert('Please fill in all fields');
                  return;
              }
              
              try {
                  const response = await fetch(\`/api/payroll?va=\${va}&startDate=\${startDate}&endDate=\${endDate}\`);
                  const data = await response.json();
                  
                  // Calculate pay with custom rates
                  const hourlyPay = data.totalHours * hourlyRate;
                  const commissionPay = data.totalRealSpend * (commissionRate / 100);
                  const totalPay = hourlyPay + commissionPay + bonusAmount;
                  
                  document.getElementById('payrollResults').style.display = 'block';
                  document.getElementById('payrollContent').innerHTML = \`
                      <div class="payroll-breakdown">
                          <div class="payroll-line">
                              <span>Period:</span>
                              <span>\${startDate} to \${endDate}</span>
                          </div>
                          <div class="payroll-line">
                              <span>Total Hours Worked:</span>
                              <span>\${data.totalHours.toFixed(1)} hours</span>
                          </div>
                          <div class="payroll-line">
                              <span>Hourly Pay ($\${hourlyRate}/hour):</span>
                              <span>$\${hourlyPay.toFixed(2)}</span>
                          </div>
                          <div class="payroll-line">
                              <span>Total Real Spend:</span>
                              <span>$\${data.totalRealSpend.toFixed(2)}</span>
                          </div>
                          <div class="payroll-line">
                              <span>Commission (\${commissionRate}% of Real Spend):</span>
                              <span>$\${commissionPay.toFixed(2)}</span>
                          </div>
                          \${bonusAmount > 0 ? \`
                          <div class="payroll-line">
                              <span>Bonus\${bonusReason ? \` (\${bonusReason})\` : ''}:</span>
                              <span>$\${bonusAmount.toFixed(2)}</span>
                          </div>
                          \` : ''}
                          <div class="payroll-line payroll-total">
                              <span>Total Pay:</span>
                              <span>$\${totalPay.toFixed(2)}</span>
                          </div>
                      </div>
                  \`;
              } catch (error) {
                  console.error('Error calculating payroll:', error);
                  alert('Error calculating payroll');
              }
          }
      </script>
  </body>
  </html>`;