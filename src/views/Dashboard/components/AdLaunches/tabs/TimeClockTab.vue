<template>
  <div>
    <!-- Clock In/Out Card -->
    <v-card class="mb-4">
      <v-card-title>Clock In/Out</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="selectedVA"
              label="Select VA"
              :items="vaList"
              item-title="name"
              item-value="email"
              @update:model-value="onVAChange"
            />
          </v-col>
          <v-col cols="12" md="6">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-overline">Current Status</div>
                <v-chip :color="clockStatus.isClockedIn ? 'green' : 'red'" variant="flat">
                  {{ clockStatus.isClockedIn ? 'Clocked In' : 'Clocked Out' }}
                </v-chip>
                <div v-if="clockStatus.lastAction" class="text-caption mt-1">
                  Since: {{ formatTime(clockStatus.lastAction) }}
                </div>
              </div>
              <v-btn
                :color="clockStatus.isClockedIn ? 'red' : 'green'"
                @click="toggleClock"
                size="large"
              >
                {{ clockStatus.isClockedIn ? 'Clock Out' : 'Clock In' }}
              </v-btn>
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Daily Summary -->
    <v-card class="mb-4">
      <v-card-title>Today's Summary</v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-overline">Total Hours</div>
              <div class="text-h4">{{ dailySummary.totalHours.toFixed(2) }}</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-overline">First Clock In</div>
              <div class="text-h6">{{ dailySummary.clockIn || '--:--' }}</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-overline">Last Clock Out</div>
              <div class="text-h6">{{ dailySummary.clockOut || '--:--' }}</div>
            </div>
          </v-col>
          <v-col cols="12" md="3">
            <div class="text-center">
              <div class="text-overline">Break Time</div>
              <div class="text-h6">{{ dailySummary.breakTime }} min</div>
              <div class="text-caption" v-if="dailySummary.punchCount > 1">
                {{ dailySummary.punchCount }} sessions
              </div>
            </div>
          </v-col>
        </v-row>
        
        <!-- Punch Log -->
        <v-divider class="my-4" />
        <div class="d-flex justify-space-between align-center mb-2">
          <div class="text-subtitle-2">Today's Punch Log</div>
          <v-btn 
            size="x-small" 
            variant="text" 
            @click="clearPunchLog"
            color="error"
          >
            Clear Log
          </v-btn>
        </div>
        <v-chip-group column>
          <v-chip 
            v-for="(entry, index) in todaysPunchLog" 
            :key="index"
            :color="entry.type === 'in' ? 'green' : 'red'"
            :variant="entry.manual ? 'outlined' : 'flat'"
            size="small"
          >
            {{ entry.type === 'in' ? 'IN' : 'OUT' }}: {{ formatTime(entry.time) }}
            <v-icon v-if="entry.manual" end size="x-small">mdi-pencil</v-icon>
          </v-chip>
        </v-chip-group>
        <div v-if="!todaysPunchLog || todaysPunchLog.length === 0" class="text-caption text-grey">
          No punches recorded today
        </div>
      </v-card-text>
    </v-card>

    <!-- Weekly Summary -->
    <v-card class="mb-4">
      <v-card-title>
        <v-row align="center">
          <v-col>Weekly Summary</v-col>
          <v-col cols="auto">
            <v-select
              v-model="selectedWeek"
              :items="weekOptions"
              item-title="display"
              item-value="value"
              @update:model-value="loadWeeklySummary"
              density="compact"
              hide-details
              style="width: 250px"
            />
          </v-col>
        </v-row>
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="weeklyHeaders"
          :items="weeklySummary"
          :items-per-page="7"
        >
          <template v-slot:item.hours="{ item }">
            {{ item.hours.toFixed(2) }} hrs
          </template>
          <template v-slot:item.actions="{ item }">
            <v-tooltip text="Use manual entry to add corrections">
              <template v-slot:activator="{ props }">
                <v-btn 
                  icon 
                  size="small" 
                  @click="editTimeEntry(item)"
                  v-bind="props"
                  :disabled="true"
                >
                  <v-icon>mdi-pencil</v-icon>
                </v-btn>
              </template>
            </v-tooltip>
          </template>
        </v-data-table>
        <div class="mt-4 text-right">
          <strong>Total Weekly Hours: {{ totalWeeklyHours.toFixed(2) }}</strong>
        </div>
      </v-card-text>
    </v-card>

    <!-- Manual Time Entry -->
    <v-card>
      <v-card-title>Manual Time Entry</v-card-title>
      <v-card-text>
        <v-form ref="manualEntryForm">
          <v-row>
            <v-col cols="12" md="3">
              <v-text-field
                v-model="manualEntry.date"
                label="Date"
                type="date"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model="manualEntry.clockIn"
                label="Clock In"
                type="time"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model="manualEntry.clockOut"
                label="Clock Out"
                type="time"
              />
            </v-col>
            <!-- Removed break minutes as it's calculated automatically from punch log -->
            <v-col cols="12" md="3">
              <v-textarea
                v-model="manualEntry.notes"
                label="Notes (optional)"
                rows="2"
              />
            </v-col>
            <v-col cols="12">
              <v-btn color="primary" @click="saveManualEntry">
                Add Manual Entry
              </v-btn>
              <v-chip class="ml-2" size="small" color="info">
                Entries will be added to punch log for selected date
              </v-chip>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>

    <!-- Edit Time Entry Dialog -->
    <v-dialog v-model="editDialog" max-width="500">
      <v-card>
        <v-card-title>Edit Time Entry</v-card-title>
        <v-card-text>
          <v-form>
            <v-text-field
              v-model="editingEntry.clockIn"
              label="Clock In"
              type="time"
            />
            <v-text-field
              v-model="editingEntry.clockOut"
              label="Clock Out"
              type="time"
            />
            <v-text-field
              v-model="editingEntry.breakMinutes"
              label="Break (minutes)"
              type="number"
            />
            <v-textarea
              v-model="editingEntry.notes"
              label="Notes"
              rows="2"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="editDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveEditedEntry">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import adLaunchesAPI from '@/services/adLaunchesAPI';

// Props
const props = defineProps({
  user: Object
});

// Emit
const emit = defineEmits(['show-message']);

// Data
const selectedVA = ref('');
const clockStatus = ref({
  isClockedIn: false,
  lastAction: null
});
const dailySummary = ref({
  totalHours: 0,
  clockIn: null,
  clockOut: null,
  breakTime: 0
});
const punchLogData = ref([]); // Reactive punch log
const weeklySummary = ref([]);
const selectedWeek = ref('current');
const weekOptions = ref([]);
const editDialog = ref(false);
const editingEntry = ref({});

const manualEntry = reactive({
  date: new Date().toISOString().split('T')[0],
  clockIn: '',
  clockOut: '',
  breakMinutes: 0,
  notes: ''
});

// VA List
const vaList = ref([
  { name: 'Tyler', email: 'tyler@example.com' },
  { name: 'Ryan', email: 'ryan@example.com' },
  { name: 'Other', email: 'other@example.com' }
]);

// Helper function to generate consistent cache keys
const getCacheKey = (email) => {
  if (!email) return null;
  // Sanitize email for use as localStorage key
  return `clockStatus_${email.replace(/[@\.]/g, '_')}`;
};

const getDailySummaryCacheKey = (email) => {
  if (!email) return null;
  const today = new Date().toISOString().split('T')[0];
  return `dailySummary_${email.replace(/[@\.]/g, '_')}_${today}`;
};

const getPunchLogCacheKey = (email) => {
  if (!email) return null;
  const today = new Date().toISOString().split('T')[0];
  return `punchLog_${email.replace(/[@\.]/g, '_')}_${today}`;
};

// Headers
const weeklyHeaders = [
  { title: 'Date', key: 'date' },
  { title: 'Day', key: 'day' },
  { title: 'Clock In', key: 'clockIn' },
  { title: 'Clock Out', key: 'clockOut' },
  { title: 'Hours', key: 'hours' },
  { title: 'Break', key: 'breakTime' },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Computed
const totalWeeklyHours = computed(() => {
  return weeklySummary.value.reduce((sum, day) => sum + day.hours, 0);
});

const todaysPunchLog = computed(() => {
  return punchLogData.value;
});

// Methods
const formatTime = (timestamp) => {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'America/New_York'
  });
};

const onVAChange = async () => {
  
  // Load punch log for the selected VA
  loadPunchLog();
  
  // refreshClockStatus already handles loading from cache
  await refreshClockStatus();
  await loadDailySummary();
  await loadWeeklySummary();
};

const refreshClockStatus = async () => {
  if (!selectedVA.value) {
    return;
  }
  
  let hasValidCache = false;
  
  try {
    // First check localStorage for cached state
    const cacheKey = getCacheKey(selectedVA.value);
    
    const cachedStatus = localStorage.getItem(cacheKey);
    
    if (cachedStatus) {
      try {
        const parsed = JSON.parse(cachedStatus);
        // Use cached status immediately for better UX
        clockStatus.value = parsed;
        hasValidCache = true;
      } catch (e) {
        localStorage.removeItem(cacheKey);
        hasValidCache = false;
      }
    }
    
    // Then fetch from API to get the latest state
    
    const response = await adLaunchesAPI.getClockStatus(selectedVA.value);
    
    // Check if this is an error response
    if (response && (response.error || response.isError)) {
      // Don't update state if there's an error - keep the cached state
      return;
    }
    
    // Also check for network/fetch errors
    if (!response) {
      return;
    }
    
    if (response && response.data) {
      
      // Only update if the API data is actually valid
      if (typeof response.data.isClockedIn === 'boolean') {
        clockStatus.value = response.data;
        // Update localStorage with the latest state
        const dataToStore = JSON.stringify(response.data);
        localStorage.setItem(cacheKey, dataToStore);
      } else {
      }
    } else if (response && response.success === false) {
      // This is likely an error response
      // Don't update state
    } else if (response && typeof response.isClockedIn === 'boolean') {
      // Sometimes the API returns the data directly without a 'data' wrapper
      // Make sure isClockedIn is explicitly a boolean, not undefined
      const statusData = {
        isClockedIn: response.isClockedIn,
        lastAction: response.lastAction || null
      };
      clockStatus.value = statusData;
      localStorage.setItem(cacheKey, JSON.stringify(statusData));
    } else {
      // No data from API - check if we should keep cached state
      
      // Only reset to defaults if we don't have cached data
      if (!hasValidCache) {
        clockStatus.value = {
          isClockedIn: false,
          lastAction: null
        };
      } else {
        // Keep the cached state that was already loaded
      }
    }
  } catch (error) {
    // Keep using cached state if API fails
  }
};

const toggleClock = async () => {
  if (!selectedVA.value) {
    emit('show-message', { text: 'Please select a VA first', color: 'warning' });
    return;
  }
  
  try {
    const action = clockStatus.value.isClockedIn ? 'clock_out' : 'clock_in';
    
    // Optimistically update the UI AND localStorage immediately
    const previousStatus = clockStatus.value.isClockedIn;
    const newStatus = !previousStatus;
    const newLastAction = new Date().toISOString();
    
    
    // Update state
    clockStatus.value.isClockedIn = newStatus;
    clockStatus.value.lastAction = newLastAction;
    
    // Save to localStorage immediately (optimistic update)
    const cacheKey = getCacheKey(selectedVA.value);
    if (cacheKey) {
      const dataToStore = JSON.stringify(clockStatus.value);
      localStorage.setItem(cacheKey, dataToStore);
    }
    
    // Update punch log
    const punchLog = [...punchLogData.value];
    const newEntry = {
      type: newStatus ? 'in' : 'out',
      time: newLastAction,
      timestamp: new Date(newLastAction).getTime()
    };
    punchLog.push(newEntry);
    savePunchLog(punchLog); // This will update punchLogData.value
    
    // Store VA metadata for payroll calculator
    if (selectedVA.value) {
      const vaMetaKey = 'vaMetadata';
      let metadata = {};
      try {
        const stored = localStorage.getItem(vaMetaKey);
        if (stored) metadata = JSON.parse(stored);
      } catch (e) {
        // Start fresh
      }
      
      // Store VA info
      const sanitizedEmail = selectedVA.value.replace(/[@\.]/g, '_');
      metadata[sanitizedEmail] = {
        email: selectedVA.value,
        name: selectedVA.value.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        lastActive: newLastAction
      };
      
      localStorage.setItem(vaMetaKey, JSON.stringify(metadata));
    }
    
    // Update daily summary from punch log
    dailySummary.value = calculateLocalDailySummary();
    
    // Only push to server on clock OUT
    let response = null;
    if (action === 'clock_out') {
      // Send the complete session data to server
      const todayKey = new Date().toISOString().split('T')[0];
      const punchLogKey = `punch_log_${todayKey}_${sanitizedEmail}`;
      const todaysPunchLog = JSON.parse(localStorage.getItem(punchLogKey) || '[]');
      
      response = await adLaunchesAPI.recordClock({
        va: selectedVA.value,
        action,
        punchLog: todaysPunchLog,
        date: todayKey
      });
    } else {
      // Clock IN - only store locally, don't call server
      response = { success: true, offline: true };
    }
    
    
    // Check various response formats
    const isSuccess = response && (
      response.success === true ||
      response.status === 'success' ||
      response.ok === true ||
      // If no explicit success field, assume success if there's no error
      (!response.error && !response.message?.toLowerCase().includes('error'))
    );
    
    if (isSuccess) {
      // The state is already stored optimistically, just log success
      
      // Verify storage
      const cacheKey = getCacheKey(selectedVA.value);
      const stored = localStorage.getItem(cacheKey);
      emit('show-message', { 
        text: !previousStatus ? 'Clocked in successfully' : 'Clocked out successfully',
        color: 'success'
      });
      
      // Don't refresh immediately - let the UI update persist
      // Schedule refresh after a delay to get updated server state
      setTimeout(async () => {
        await loadDailySummary();
        await loadWeeklySummary();
        // Only refresh clock status if needed
        const statusCheck = await adLaunchesAPI.getClockStatus(selectedVA.value);
        if (statusCheck && statusCheck.data) {
          clockStatus.value = statusCheck.data;
          // Update cache with server's confirmed state
          const cacheKey = getCacheKey(selectedVA.value);
          const dataToStore = JSON.stringify(statusCheck.data);
          localStorage.setItem(cacheKey, dataToStore);
        } else if (statusCheck && !statusCheck.error) {
          // Handle direct response without data wrapper
          const statusData = {
            isClockedIn: statusCheck.isClockedIn !== undefined ? statusCheck.isClockedIn : clockStatus.value.isClockedIn,
            lastAction: statusCheck.lastAction || clockStatus.value.lastAction
          };
          clockStatus.value = statusData;
          const cacheKey = getCacheKey(selectedVA.value);
          localStorage.setItem(cacheKey, JSON.stringify(statusData));
        }
      }, 1000);
    } else {
      // Revert on failure
      clockStatus.value.isClockedIn = previousStatus;
      // Clear invalid cache
      const cacheKey = getCacheKey(selectedVA.value);
      if (cacheKey) localStorage.removeItem(cacheKey);
      emit('show-message', { text: response?.message || 'Failed to update clock status', color: 'error' });
    }
  } catch (error) {
    // Silently handle error - the optimistic update is already done
    // Don't revert since the local state is valid
  }
};

// Get or initialize today's punch log
const getTodaysPunchLog = () => {
  const logKey = getPunchLogCacheKey(selectedVA.value);
  if (!logKey) return [];
  
  const cached = localStorage.getItem(logKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      return [];
    }
  }
  return [];
};

// Load punch log into reactive data and sync clock status
const loadPunchLog = () => {
  punchLogData.value = getTodaysPunchLog();
  
  // Sync clock status with punch log
  if (punchLogData.value.length > 0) {
    const lastEntry = punchLogData.value[punchLogData.value.length - 1];
    const isClockedIn = lastEntry.type === 'in';
    
    clockStatus.value = {
      isClockedIn: isClockedIn,
      lastAction: lastEntry.time
    };
    
    // Update clock status in localStorage
    const cacheKey = getCacheKey(selectedVA.value);
    if (cacheKey) {
      localStorage.setItem(cacheKey, JSON.stringify(clockStatus.value));
    }
  }
};

// Save punch log to localStorage and update reactive data
const savePunchLog = (log) => {
  const logKey = getPunchLogCacheKey(selectedVA.value);
  if (logKey) {
    localStorage.setItem(logKey, JSON.stringify(log));
    punchLogData.value = log;
  }
};

// Clear punch log
const clearPunchLog = () => {
  if (confirm('Are you sure you want to clear today\'s punch log?')) {
    savePunchLog([]);
    clockStatus.value.isClockedIn = false;
    clockStatus.value.lastAction = null;
    
    // Update localStorage for clock status
    const cacheKey = getCacheKey(selectedVA.value);
    if (cacheKey) {
      localStorage.setItem(cacheKey, JSON.stringify(clockStatus.value));
    }
    
    // Recalculate summary
    dailySummary.value = calculateLocalDailySummary();
    emit('show-message', { text: 'Punch log cleared', color: 'info' });
  }
};

// Calculate total hours from punch log
const calculateTotalHours = (punchLog) => {
  if (!punchLog || punchLog.length === 0) return 0;
  let totalMinutes = 0;
  
  for (let i = 0; i < punchLog.length; i++) {
    const entry = punchLog[i];
    if (entry.type === 'in' && punchLog[i + 1] && punchLog[i + 1].type === 'out') {
      const inTime = new Date(entry.time);
      const outTime = new Date(punchLog[i + 1].time);
      const minutes = (outTime - inTime) / (1000 * 60);
      totalMinutes += minutes;
    }
  }
  
  // Check if currently clocked in (last entry is 'in')
  if (punchLog.length > 0 && punchLog[punchLog.length - 1].type === 'in') {
    const lastIn = new Date(punchLog[punchLog.length - 1].time);
    const now = new Date();
    const minutes = (now - lastIn) / (1000 * 60);
    totalMinutes += minutes;
  }
  
  return Math.round((totalMinutes / 60) * 100) / 100; // Convert to hours and round
};

// Calculate daily summary from punch log
const calculateLocalDailySummary = () => {
  const punchLog = punchLogData.value.length > 0 ? punchLogData.value : getTodaysPunchLog();
  
  if (punchLog.length === 0) {
    return {
      totalHours: 0,
      clockIn: null,
      clockOut: null,
      breakTime: 0,
      punchCount: 0
    };
  }
  
  const firstIn = punchLog.find(e => e.type === 'in');
  const lastOut = [...punchLog].reverse().find(e => e.type === 'out');
  const totalHours = calculateTotalHours(punchLog);
  
  // Calculate break time (time between clock out and next clock in)
  let breakMinutes = 0;
  for (let i = 0; i < punchLog.length - 1; i++) {
    if (punchLog[i].type === 'out' && punchLog[i + 1].type === 'in') {
      const outTime = new Date(punchLog[i].time);
      const inTime = new Date(punchLog[i + 1].time);
      breakMinutes += (inTime - outTime) / (1000 * 60);
    }
  }
  
  return {
    totalHours,
    clockIn: firstIn ? formatTime(firstIn.time) : null,
    clockOut: lastOut ? formatTime(lastOut.time) : null,
    breakTime: Math.round(breakMinutes),
    punchCount: punchLog.filter(e => e.type === 'in').length
  };
};


const loadDailySummary = async () => {
  if (!selectedVA.value) return;
  
  try {
    const response = await adLaunchesAPI.getDailySummary(selectedVA.value);
    
    // Check if response is an error
    if (response && (response.error || response.isError)) {
      dailySummary.value = calculateLocalDailySummary();
      return;
    }
    
    if (response) {
      // Handle different response structures
      if (response.data) {
        dailySummary.value = {
          totalHours: response.data.totalHours || response.data.hours_worked || 0,
          clockIn: response.data.clockIn || response.data.clock_in || null,
          clockOut: response.data.clockOut || response.data.clock_out || null,
          breakTime: response.data.breakTime || response.data.break_time || 0
        };
      } else if (response.totalHours !== undefined || response.hours_worked !== undefined) {
        // Response is the data directly
        dailySummary.value = {
          totalHours: response.totalHours || response.hours_worked || 0,
          clockIn: response.clockIn || response.clock_in || null,
          clockOut: response.clockOut || response.clock_out || null,
          breakTime: response.breakTime || response.break_time || 0
        };
        // Also cache the valid response
        const summaryCacheKey = getDailySummaryCacheKey(selectedVA.value);
        if (summaryCacheKey) {
          localStorage.setItem(summaryCacheKey, JSON.stringify(dailySummary.value));
        }
      } else if (response.success === false) {
        // API returned failure, use local calculation
        dailySummary.value = calculateLocalDailySummary();
      } else {
        // No valid data, use local calculation
        dailySummary.value = calculateLocalDailySummary();
      }
    } else {
      // No response, use local calculation
      dailySummary.value = calculateLocalDailySummary();
    }
  } catch (error) {
    // Use local calculation on error
    dailySummary.value = calculateLocalDailySummary();
  }
};

// Get punch log for a specific date
const getPunchLogForDate = (date) => {
  const dateStr = date.toISOString().split('T')[0];
  const logKey = `punchLog_${selectedVA.value.replace(/[@\.]/g, '_')}_${dateStr}`;
  const cached = localStorage.getItem(logKey);
  
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      return [];
    }
  }
  return [];
};

// Calculate summary for a specific date from punch log
const calculateDailySummaryForDate = (date) => {
  const punchLog = getPunchLogForDate(date);
  
  if (punchLog.length === 0) {
    return {
      date: date.toISOString().split('T')[0],
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      clockIn: null,
      clockOut: null,
      hours: 0,
      breakTime: 0
    };
  }
  
  const firstIn = punchLog.find(e => e.type === 'in');
  const lastOut = [...punchLog].reverse().find(e => e.type === 'out');
  const totalHours = calculateTotalHours(punchLog);
  
  // Calculate break time
  let breakMinutes = 0;
  for (let i = 0; i < punchLog.length - 1; i++) {
    if (punchLog[i].type === 'out' && punchLog[i + 1].type === 'in') {
      const outTime = new Date(punchLog[i].time);
      const inTime = new Date(punchLog[i + 1].time);
      breakMinutes += (inTime - outTime) / (1000 * 60);
    }
  }
  
  return {
    date: date.toISOString().split('T')[0],
    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
    clockIn: firstIn ? formatTime(firstIn.time) : null,
    clockOut: lastOut ? formatTime(lastOut.time) : null,
    hours: totalHours,
    breakTime: `${Math.round(breakMinutes)} min`
  };
};

const loadWeeklySummary = async () => {
  if (!selectedVA.value) return;
  
  try {
    // First try API
    const response = await adLaunchesAPI.getWeeklySummary(selectedVA.value, selectedWeek.value);
    
    if (response && response.error) {
      // Generate from local punch logs
      const weekData = [];
      const today = new Date();
      
      // Get start of week (Sunday)
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      
      // Adjust for selected week
      if (selectedWeek.value === 'last') {
        startOfWeek.setDate(startOfWeek.getDate() - 7);
      } else if (selectedWeek.value.startsWith('week_')) {
        const weeksAgo = parseInt(selectedWeek.value.split('_')[1]);
        startOfWeek.setDate(startOfWeek.getDate() - (weeksAgo * 7));
      }
      
      // Generate data for each day of the week
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        
        // Don't include future dates
        if (date <= today) {
          weekData.push(calculateDailySummaryForDate(date));
        }
      }
      
      weeklySummary.value = weekData;
    } else if (response && response.data) {
      weeklySummary.value = Array.isArray(response.data) ? response.data : [];
    } else {
      // Generate from local punch logs as fallback
      const weekData = [];
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        if (date <= today) {
          weekData.push(calculateDailySummaryForDate(date));
        }
      }
      
      weeklySummary.value = weekData;
    }
  } catch (error) {
    // Generate from local punch logs on error
    const weekData = [];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      if (date <= today) {
        weekData.push(calculateDailySummaryForDate(date));
      }
    }
    
    weeklySummary.value = weekData;
  }
};

const generateWeekOptions = () => {
  const options = [
    { value: 'current', display: 'Current Week' },
    { value: 'last', display: 'Last Week' }
  ];
  
  // Add previous 4 weeks
  for (let i = 2; i <= 5; i++) {
    options.push({
      value: `week_${i}`,
      display: `${i} weeks ago`
    });
  }
  
  weekOptions.value = options;
};

const saveManualEntry = async () => {
  if (!selectedVA.value) {
    emit('show-message', { text: 'Please select a VA first', color: 'warning' });
    return;
  }
  
  if (!manualEntry.clockIn) {
    emit('show-message', { text: 'Clock in time is required', color: 'warning' });
    return;
  }
  
  try {
    // Create punch log entries from manual entry
    const entryDate = manualEntry.date;
    const logKey = `punchLog_${selectedVA.value.replace(/[@\.]/g, '_')}_${entryDate}`;
    
    // Get existing punch log for that date
    let punchLog = [];
    const cached = localStorage.getItem(logKey);
    if (cached) {
      try {
        punchLog = JSON.parse(cached);
      } catch (e) {
      }
    }
    
    // Add clock in entry
    const clockInDateTime = `${manualEntry.date}T${manualEntry.clockIn}:00`;
    punchLog.push({
      type: 'in',
      time: clockInDateTime,
      timestamp: new Date(clockInDateTime).getTime(),
      manual: true,
      notes: manualEntry.notes
    });
    
    // Add clock out entry if provided
    if (manualEntry.clockOut) {
      const clockOutDateTime = `${manualEntry.date}T${manualEntry.clockOut}:00`;
      punchLog.push({
        type: 'out',
        time: clockOutDateTime,
        timestamp: new Date(clockOutDateTime).getTime(),
        manual: true,
        notes: manualEntry.notes
      });
    }
    
    // Sort by timestamp
    punchLog.sort((a, b) => a.timestamp - b.timestamp);
    
    // Save the updated punch log
    localStorage.setItem(logKey, JSON.stringify(punchLog));
    
    // If it's today's log, update the reactive data
    const today = new Date().toISOString().split('T')[0];
    if (entryDate === today) {
      punchLogData.value = punchLog;
      dailySummary.value = calculateLocalDailySummary();
    }
    
    emit('show-message', { text: 'Manual entry added successfully', color: 'success' });
    
    // Reset form
    Object.assign(manualEntry, {
      date: new Date().toISOString().split('T')[0],
      clockIn: '',
      clockOut: '',
      breakMinutes: 0,
      notes: ''
    });
    
    // Reload summaries
    await loadWeeklySummary();
    
    // Skip API call - everything is handled locally
    // Remove this section if you want to enable API sync later
  } catch (error) {
    emit('show-message', { text: 'Failed to add manual entry', color: 'error' });
  }
};

const editTimeEntry = (entry) => {
  // For now, editing is disabled since we need to edit the punch log
  emit('show-message', { 
    text: 'To edit time entries, please use manual entry to add corrections', 
    color: 'info' 
  });
  return;
  
  // TODO: Implement punch log editing
  // editingEntry.value = { ...entry };
  // editDialog.value = true;
};

const saveEditedEntry = async () => {
  // Disabled for now
  editDialog.value = false;
};


const cleanupOldCacheEntries = () => {
  try {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    const ONE_DAY = 24 * 60 * 60 * 1000;
    
    keys.forEach(key => {
      if (key.startsWith('clockStatus_')) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            // Clean up entries older than 1 day
            if (parsed.lastAction) {
              const lastActionTime = new Date(parsed.lastAction).getTime();
              if (now - lastActionTime > ONE_DAY) {
                localStorage.removeItem(key);
              }
            }
          } catch (e) {
            // Remove invalid entries
            localStorage.removeItem(key);
          }
        }
      }
    });
  } catch (error) {
  }
};

// Handle visibility change to refresh when tab becomes visible
const handleVisibilityChange = () => {
  if (!document.hidden && selectedVA.value) {
    // Refresh status when page becomes visible
    refreshClockStatus();
  }
};

// Update total hours in real-time when clocked in
let updateInterval = null;

const startRealtimeUpdate = () => {
  if (updateInterval) clearInterval(updateInterval);
  
  updateInterval = setInterval(() => {
    if (clockStatus.value.isClockedIn) {
      // Recalculate from punch log
      dailySummary.value = calculateLocalDailySummary();
    }
  }, 60000); // Update every minute
};

const stopRealtimeUpdate = () => {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
};

// Watch for clock status changes
watch(() => clockStatus.value.isClockedIn, (isClockedIn) => {
  if (isClockedIn) {
    startRealtimeUpdate();
  } else {
    stopRealtimeUpdate();
  }
});

// Lifecycle
onMounted(() => {
  
  // Clean up old cache entries
  cleanupOldCacheEntries();
  
  if (props.user?.email) {
    selectedVA.value = props.user.email;
    
    // Load cached state immediately on mount for instant UI
    const cacheKey = getCacheKey(props.user.email);
    
    const cachedStatus = localStorage.getItem(cacheKey);
    
    if (cachedStatus) {
      try {
        const parsed = JSON.parse(cachedStatus);
        clockStatus.value = parsed;
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    } else {
    }
    
    // Load punch log and calculate daily summary
    loadPunchLog();
    if (punchLogData.value.length > 0) {
      dailySummary.value = calculateLocalDailySummary();
    }
    
    // Load daily and weekly summaries
    loadDailySummary();
    loadWeeklySummary();
    
    // Then verify clock status with API (but don't overwrite cache if API fails)
    refreshClockStatus();
  } else {
  }
  
  generateWeekOptions();
  
  // Add visibility change listener
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Start real-time update if clocked in
  if (clockStatus.value.isClockedIn) {
    startRealtimeUpdate();
  }
  
});

onUnmounted(() => {
  // Remove visibility change listener
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  // Stop real-time update
  stopRealtimeUpdate();
});
</script>