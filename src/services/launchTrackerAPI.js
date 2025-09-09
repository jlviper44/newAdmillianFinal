import axios from 'axios';

const API_BASE_URL = '';

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

const formatWeekKey = (date) => {
  const monday = getWeekStart(date);
  return monday.toISOString().split('T')[0];
};

const launchTrackerAPI = {
  // Get launch entries for a specific week
  async getEntries(week = null) {
    try {
      const weekKey = week || formatWeekKey(getESTDate());
      const response = await axios.get(`${API_BASE_URL}/api/tracker/entries`, {
        params: { week: weekKey },
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching entries:', error);
      return { entries: [] };
    }
  },

  // Create a new launch entry
  async createEntry(entry) {
    try {
      // Calculate derived fields
      const adSpend = parseFloat(entry.adSpend || 0);
      const bcSpend = parseFloat(entry.bcSpend || 0);
      const amountLost = bcSpend - adSpend;
      const realSpend = adSpend - amountLost;

      const completeEntry = {
        ...entry,
        id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        amountLost: amountLost.toFixed(2),
        realSpend: realSpend.toFixed(2)
      };

      const response = await axios.post(`${API_BASE_URL}/api/tracker/entries`, completeEntry, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Error creating entry:', error);
      throw error;
    }
  },

  // Update an existing entry
  async updateEntry(entryId, updates, week = null) {
    try {
      // Recalculate derived fields if spend values changed
      if (updates.adSpend !== undefined || updates.bcSpend !== undefined) {
        const adSpend = parseFloat(updates.adSpend || 0);
        const bcSpend = parseFloat(updates.bcSpend || 0);
        updates.amountLost = (bcSpend - adSpend).toFixed(2);
        updates.realSpend = (adSpend - updates.amountLost).toFixed(2);
      }

      updates.updatedAt = new Date().toISOString();

      const weekKey = week || formatWeekKey(getESTDate());
      const response = await axios.put(`${API_BASE_URL}/api/tracker/entries/${entryId}`, updates, {
        params: { week: weekKey },
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Error updating entry:', error);
      throw error;
    }
  },

  // Delete an entry
  async deleteEntry(entryId, week = null) {
    try {
      const weekKey = week || formatWeekKey(getESTDate());
      await axios.delete(`${API_BASE_URL}/api/tracker/entries/${entryId}`, {
        params: { week: weekKey },
        withCredentials: true
      });
      return { success: true };
    } catch (error) {
      console.error('Error deleting entry:', error);
      throw error;
    }
  },

  // Get weekly summary
  async getWeeklySummary(vaName = null) {
    try {
      const params = {};
      if (vaName) params.va = vaName;
      
      const response = await axios.get(`${API_BASE_URL}/api/tracker/weekly-summary`, { 
        params,
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching weekly summary:', error);
      return [];
    }
  },

  // Export data to CSV
  async exportData(week = null) {
    try {
      const weekKey = week || formatWeekKey(getESTDate());
      const response = await axios.get(`${API_BASE_URL}/api/tracker/export`, {
        params: { week: weekKey },
        responseType: 'blob',
        withCredentials: true
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `launch_tracker_${weekKey}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      return { success: true };
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  },

  // Get all available weeks
  async getAvailableWeeks() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/tracker/weeks`, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching available weeks:', error);
      return [];
    }
  },

  // Calculate totals for entries
  calculateTotals(entries) {
    return {
      entries: entries.length,
      adSpend: entries.reduce((sum, e) => sum + parseFloat(e.adSpend || 0), 0),
      bcSpend: entries.reduce((sum, e) => sum + parseFloat(e.bcSpend || 0), 0),
      amountLost: entries.reduce((sum, e) => sum + parseFloat(e.amountLost || 0), 0),
      realSpend: entries.reduce((sum, e) => sum + parseFloat(e.realSpend || 0), 0)
    };
  },

  // Helper to format currency
  formatCurrency(value) {
    return `$${parseFloat(value || 0).toFixed(2)}`;
  },

  // Helper to get current week string
  getCurrentWeekString() {
    const now = getESTDate();
    const weekStart = getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
  },

  // Helper functions exported for use in components
  utils: {
    getESTDate,
    getWeekStart,
    formatWeekKey,
    getCurrentWeekString() {
      return launchTrackerAPI.getCurrentWeekString();
    }
  }
};

export default launchTrackerAPI;