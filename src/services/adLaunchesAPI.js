const API_BASE = '/api';

// Check if we should use offline mode (can be set by user or auto-detected)
const isOfflineMode = () => {
  // Check if user has explicitly set offline mode
  const offlineMode = localStorage.getItem('offlineMode');
  if (offlineMode === 'true') return true;
  
  // Check if we're in development without backend
  if (window.location.hostname === 'localhost' && window.location.port === '5173') {
    // Development mode - check if backend ever responded successfully
    const backendWorked = localStorage.getItem('backendWorked');
    if (!backendWorked) {
      // Never seen backend work, assume offline
      return true;
    }
  }
  
  return false;
};

// Simple server availability check with no network call
const isServerLikelyAvailable = () => {
  // If we've seen the backend work before, assume it might be available
  const backendWorked = localStorage.getItem('backendWorked');
  
  // In production, always try
  if (window.location.hostname !== 'localhost') {
    return true;
  }
  
  // In development, only try if we've seen it work before
  return backendWorked === 'true';
};

const adLaunchesAPI = {
  // Tracker Tab APIs
  async getTrackerData(week) {
    try {
      const response = await fetch(`${API_BASE}/tracker/entries?week=${week}`, {
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async createLaunch(data) {
    try {
      const response = await fetch(`${API_BASE}/tracker/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async updateLaunch(id, data) {
    try {
      const response = await fetch(`${API_BASE}/launch-entry/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async deleteLaunch(id) {
    try {
      const response = await fetch(`${API_BASE}/launch-entry/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Time Clock APIs
  async getClockStatus(va) {
    try {
      const response = await fetch(`${API_BASE}/timeclock?va=${va}`, {
        credentials: 'include'
      });
      const data = await response.json();
      return data;
    } catch (error) {
      // Return error object that component can recognize
      return { success: false, error: error.message, isError: true };
    }
  },

  async recordClock(data) {
    // Skip API call in offline mode
    if (isOfflineMode()) {
      return { success: true, offline: true };
    }
    
    try {
      const endpoint = data.action === 'clock_in' ? '/clock-in' : '/clock-out';
      // Send only the required fields
      const payload = {
        va: data.va,
        notes: data.notes || ''
      };
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      // Mark that backend has worked at least once
      if (result && !result.error) {
        localStorage.setItem('backendWorked', 'true');
      }
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getDailySummary(va) {
    try {
      const response = await fetch(`${API_BASE}/clock-summary/daily?va=${va}`, {
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async getWeeklySummary(va, week) {
    try {
      const response = await fetch(`${API_BASE}/clock-summary/weekly?va=${va}&week=${week}`, {
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async addManualTimeEntry(data) {
    try {
      const response = await fetch(`${API_BASE}/timeclock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async updateTimeEntry(id, data) {
    try {
      const response = await fetch(`${API_BASE}/time-entry/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Payroll APIs
  async getVARates(va, date) {
    // Skip API call in offline mode
    if (isOfflineMode()) {
      return { success: false, offline: true };
    }
    
    try {
      // Backend expects: /api/va-rates/:va?date=...
      const encodedVA = encodeURIComponent(va);
      const response = await fetch(`${API_BASE}/va-rates/${encodedVA}?date=${date}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        return { success: false, error: `Server error: ${response.status}` };
      }
      
      const data = await response.json();
      
      // Mark that backend has worked
      if (data && !data.error) {
        localStorage.setItem('backendWorked', 'true');
      }
      
      return { success: true, data: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async calculatePayroll(data) {
    // Skip API call in offline mode
    if (isOfflineMode()) {
      return { success: false, offline: true };
    }
    
    try {
      const response = await fetch(`${API_BASE}/calculate-payroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async savePayrollReport(data) {
    // Always post to server - never use local storage for payroll
    try {
      const response = await fetch(`${API_BASE}/payroll-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        return { success: false, error: `Server error: ${response.status}` };
      }
      const result = await response.json();
      
      // Mark that backend has worked
      localStorage.setItem('backendWorked', 'true');
      
      return { success: true, data: result };
    } catch (error) {
      // Network error or server is down
      return { success: false, error: error.message };
    }
  },

  // Payroll History APIs
  async getPayrollHistory() {
    // Always fetch from server - never use local storage for payroll history
    try {
      const response = await fetch(`${API_BASE}/payroll-report`, {
        credentials: 'include'
      });
      if (!response.ok) {
        return { success: false, error: `Server error: ${response.status}` };
      }
      const data = await response.json();
      
      // Mark that backend has worked
      localStorage.setItem('backendWorked', 'true');
      
      return { success: true, data: data };
    } catch (error) {
      // Network error or server is down
      return { success: false, error: error.message };
    }
  },

  async updatePayrollInvoice(id, data) {
    // Always try server - this is critical data
    try {
      const response = await fetch(`${API_BASE}/payroll-report/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        console.error('Update invoice failed:', response.status, response.statusText);
        return { success: false, error: `Server error: ${response.status}` };
      }
      
      const result = await response.json();
      
      // Backend returns the updated record directly (not wrapped in success/data)
      if (result && result.id) {
        localStorage.setItem('backendWorked', 'true');
        return { success: true, data: result };
      }
      
      // If result has an error property
      if (result && result.error) {
        return { success: false, error: result.error };
      }
      
      // Return as successful if we got data back
      return { success: true, data: result };
    } catch (error) {
      console.error('Update invoice error:', error);
      return { success: false, error: error.message };
    }
  },

  async markInvoiceAsPaid(id, data) {
    try {
      const response = await fetch(`${API_BASE}/payroll-report/${id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async voidInvoice(id) {
    try {
      const response = await fetch(`${API_BASE}/payroll-report/${id}/void`, {
        method: 'POST',
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  async restoreInvoice(id) {
    try {
      const response = await fetch(`${API_BASE}/payroll-report/${id}/restore`, {
        method: 'POST',
        credentials: 'include'
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

export default adLaunchesAPI;