<template>
  <div>
    <v-card>
      <v-card-title>Calculate Payroll</v-card-title>
      <v-card-text>
        <v-form ref="payrollFormRef">
          <v-row>
            <!-- Date Range Selection -->
            <v-col cols="12">
              <v-card variant="outlined" class="mb-4">
                <v-card-text>
                  <v-row align="center">
                    <v-col cols="12" md="5">
                      <v-text-field
                        v-model="payrollForm.startDate"
                        label="Start Date"
                        type="date"
                        density="comfortable"
                      />
                    </v-col>
                    <v-col cols="12" md="2" class="text-center">
                      <span>to</span>
                    </v-col>
                    <v-col cols="12" md="5">
                      <v-text-field
                        v-model="payrollForm.endDate"
                        label="End Date"
                        type="date"
                        density="comfortable"
                      />
                    </v-col>
                  </v-row>
                  <v-row>
                    <v-col>
                      <v-chip-group v-model="selectedQuickRange" @update:model-value="applyQuickRange">
                        <v-chip value="current_week">Current Week</v-chip>
                        <v-chip value="last_week">Last Week</v-chip>
                        <v-chip value="current_month">Current Month</v-chip>
                        <v-chip value="last_month">Last Month</v-chip>
                      </v-chip-group>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- VA Selection -->
            <v-col cols="12" md="6">
              <v-select
                v-model="payrollForm.va"
                label="Select VA"
                :items="vaList"
                item-title="email"
                item-value="email"
                @update:model-value="onVAChange"
              />
            </v-col>

            <!-- Rates -->
            <v-col cols="12" md="3">
              <v-text-field
                v-model.number="payrollForm.hourlyRate"
                label="Hourly Rate"
                type="number"
                prefix="$"
                suffix="/hr"
              />
            </v-col>
            <v-col cols="12" md="3">
              <v-text-field
                v-model.number="payrollForm.commissionRate"
                label="Commission Rate"
                type="number"
                suffix="%"
              />
            </v-col>

            <!-- Bonus -->
            <v-col cols="12" md="6">
              <v-text-field
                v-model.number="payrollForm.bonusAmount"
                label="Bonus Amount"
                type="number"
                prefix="$"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="payrollForm.bonusReason"
                label="Bonus Reason"
              />
            </v-col>

            <!-- Payment Method -->
            <v-col cols="12" md="6">
              <v-select
                v-model="payrollForm.paymentMethod"
                label="Payment Method"
                :items="['PayPal', 'Zelle', 'Venmo', 'Bank Transfer', 'Check', 'Other']"
              />
            </v-col>

            <!-- Notes -->
            <v-col cols="12">
              <v-textarea
                v-model="payrollForm.notes"
                label="Notes"
                rows="3"
              />
            </v-col>

            <!-- Calculate Button -->
            <v-col cols="12">
              <v-btn
                color="primary"
                size="large"
                @click="calculatePayroll"
                :loading="calculating"
                block
              >
                Calculate Payroll
              </v-btn>
            </v-col>
          </v-row>
        </v-form>

        <!-- Calculation Results -->
        <v-expand-transition>
          <v-card v-if="payrollResult" class="mt-4" variant="outlined">
            <v-card-title class="bg-grey-lighten-4">
              Payroll Calculation Results
            </v-card-title>
            <v-card-text>
              <v-table density="comfortable">
                <tbody>
                  <tr>
                    <td><strong>Period:</strong></td>
                    <td>{{ formatDate(payrollForm.startDate) }} - {{ formatDate(payrollForm.endDate) }}</td>
                  </tr>
                  <tr>
                    <td><strong>Total Hours Worked:</strong></td>
                    <td>{{ payrollResult.totalHours.toFixed(2) }} hours</td>
                  </tr>
                  <tr>
                    <td><strong>Base Pay:</strong></td>
                    <td>${{ payrollResult.basePay.toFixed(2) }} ({{ payrollResult.totalHours.toFixed(2) }} hrs × ${{ payrollForm.hourlyRate }}/hr)</td>
                  </tr>
                  <tr>
                    <td><strong>Total Ad Spend:</strong></td>
                    <td>${{ payrollResult.totalAdSpend.toFixed(2) }}</td>
                  </tr>
                  <tr>
                    <td><strong>Commission:</strong></td>
                    <td>${{ payrollResult.commission.toFixed(2) }} ({{ payrollForm.commissionRate }}% of ${{ payrollResult.totalAdSpend.toFixed(2) }})</td>
                  </tr>
                  <tr v-if="payrollForm.bonusAmount > 0">
                    <td><strong>Bonus:</strong></td>
                    <td>${{ payrollForm.bonusAmount.toFixed(2) }} ({{ payrollForm.bonusReason }})</td>
                  </tr>
                  <tr class="bg-green-lighten-5">
                    <td><strong>Total Payroll:</strong></td>
                    <td><strong class="text-h5">${{ payrollResult.totalPayroll.toFixed(2) }}</strong></td>
                  </tr>
                </tbody>
              </v-table>

              <!-- Editable Details Table -->
              <div class="mt-4">
                <div class="d-flex justify-space-between align-center mb-2">
                  <h4>Time Entries</h4>
                  <div>
                    <v-chip v-if="dataSource === 'local'" color="success" size="small" class="mr-2">
                      <v-icon start size="small">mdi-clock-check</v-icon>
                      From Time Clock
                    </v-chip>
                    <v-btn size="small" @click="addManualPayrollEntry" color="primary">
                      Add Entry
                    </v-btn>
                  </div>
                </div>
                <v-data-table
                  :headers="payrollHeaders"
                  :items="payrollEntries"
                  density="compact"
                >
                  <template v-slot:item.date="{ item }">
                    <v-text-field
                      v-model="item.date"
                      density="compact"
                      hide-details
                      variant="underlined"
                      style="min-width: 120px"
                    />
                  </template>
                  <template v-slot:item.day="{ item }">
                    {{ item.day || new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }) }}
                  </template>
                  <template v-slot:item.hours="{ item }">
                    <v-text-field
                      v-model.number="item.hours"
                      type="number"
                      density="compact"
                      hide-details
                      variant="underlined"
                      @update:model-value="recalculatePayroll"
                    />
                  </template>
                  <template v-slot:item.adSpend="{ item }">
                    <v-text-field
                      v-model.number="item.adSpend"
                      type="number"
                      prefix="$"
                      density="compact"
                      hide-details
                      variant="underlined"
                      @update:model-value="recalculatePayroll"
                    />
                  </template>
                  <template v-slot:item.actions="{ item, index }">
                    <v-btn icon size="small" @click="removePayrollEntry(index)" color="red">
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </template>
                </v-data-table>
              </div>

              <!-- Action Buttons -->
              <v-row class="mt-4">
                <v-col>
                  <v-btn
                    color="success"
                    @click="savePayrollReport"
                    prepend-icon="mdi-content-save"
                  >
                    Save Payroll Report
                  </v-btn>
                  <v-btn
                    color="info"
                    @click="exportPayrollReport"
                    prepend-icon="mdi-download"
                    class="ml-2"
                  >
                    Export to CSV
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-expand-transition>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import adLaunchesAPI from '@/services/adLaunchesAPI';

// Props
const props = defineProps({
  user: Object
});

// Emit
const emit = defineEmits(['show-message', 'switch-tab']);

// Get current week dates
const getCurrentWeekDates = () => {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  
  const monday = new Date(today.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  };
};

// Data
const currentWeek = getCurrentWeekDates();
const calculating = ref(false);
const payrollResult = ref(null);
const payrollEntries = ref([]);
const selectedQuickRange = ref(null);
const dataSource = ref('api'); // 'local' or 'api'

const payrollForm = reactive({
  va: props.user?.email || '',
  startDate: currentWeek.start,
  endDate: currentWeek.end,
  hourlyRate: 5,
  commissionRate: 3,
  bonusAmount: 0,
  bonusReason: '',
  paymentMethod: '',
  notes: ''
});

const vaList = ref([]);

const payrollHeaders = [
  { title: 'Date', key: 'date', width: '150px' },
  { title: 'Day', key: 'day', width: '80px' },
  { title: 'Hours', key: 'hours', width: '100px' },
  { title: 'Ad Spend', key: 'adSpend', width: '120px' },
  { title: 'Actions', key: 'actions', sortable: false, width: '80px' }
];

// Methods
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const applyQuickRange = (value) => {
  const today = new Date();
  let start, end;
  
  switch (value) {
    case 'current_week':
      const currentWeekDates = getCurrentWeekDates();
      start = currentWeekDates.start;
      end = currentWeekDates.end;
      break;
    case 'last_week':
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      const day = lastWeek.getDay();
      const diff = lastWeek.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(lastWeek.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      start = monday.toISOString().split('T')[0];
      end = sunday.toISOString().split('T')[0];
      break;
    case 'current_month':
      start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      break;
    case 'last_month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
      end = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];
      break;
  }
  
  payrollForm.startDate = start;
  payrollForm.endDate = end;
};

const onVAChange = () => {
  loadVARates();
  // Clear previous results when VA changes
  payrollResult.value = null;
  payrollEntries.value = [];
};

const loadVARates = async () => {
  if (!payrollForm.va) return;
  
  // Always get rates from server - no localStorage backup
  try {
    const response = await adLaunchesAPI.getVARates(payrollForm.va, new Date().toISOString().split('T')[0]);
    if (response && response.success && response.data) {
      payrollForm.hourlyRate = response.data.hourlyRate || 5;
      payrollForm.commissionRate = response.data.commissionRate || 3;
    } else {
      // Use default rates if server doesn't have rates
      payrollForm.hourlyRate = 5;
      payrollForm.commissionRate = 3;
    }
  } catch (error) {
    // Server error - use defaults
    payrollForm.hourlyRate = 5;
    payrollForm.commissionRate = 3;
  }
};

// Get punch log for a date range
const getPunchLogsForDateRange = (startDate, endDate, vaEmail) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const entries = [];
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    const logKey = `punchLog_${vaEmail.replace(/[@\.]/g, '_')}_${dateStr}`;
    const cached = localStorage.getItem(logKey);
    
    if (cached) {
      try {
        const punchLog = JSON.parse(cached);
        
        // Calculate hours for this day
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
        
        if (totalMinutes > 0) {
          entries.push({
            date: dateStr,
            day: date.toLocaleDateString('en-US', { weekday: 'short' }),
            hours: Math.round((totalMinutes / 60) * 100) / 100,
            adSpend: 0 // This would need to come from another source
          });
        }
      } catch (e) {
        // Skip invalid entries
      }
    }
  }
  
  return entries;
};

const calculatePayroll = async () => {
  if (!payrollForm.va) {
    emit('show-message', { text: 'Please select a VA', color: 'warning' });
    return;
  }
  
  calculating.value = true;
  
  try {
    // First try to get data from punch logs
    const localEntries = getPunchLogsForDateRange(
      payrollForm.startDate,
      payrollForm.endDate,
      payrollForm.va
    );
    
    if (localEntries.length > 0) {
      // Calculate from local data
      const totalHours = localEntries.reduce((sum, e) => sum + e.hours, 0);
      const totalAdSpend = localEntries.reduce((sum, e) => sum + e.adSpend, 0);
      const basePay = totalHours * payrollForm.hourlyRate;
      const commission = totalAdSpend * (payrollForm.commissionRate / 100);
      
      payrollResult.value = {
        totalHours,
        totalAdSpend,
        basePay,
        commission,
        totalPayroll: basePay + commission + payrollForm.bonusAmount,
        entries: localEntries
      };
      payrollEntries.value = localEntries;
      dataSource.value = 'local';
      
      emit('show-message', { text: 'Payroll calculated from time clock data', color: 'success' });
    } else {
      // Try API if no local data
      try {
        const response = await adLaunchesAPI.calculatePayroll(payrollForm);
        if (response && response.success) {
          payrollResult.value = response.data;
          payrollEntries.value = response.data.entries || [];
        } else {
          // No data available
          emit('show-message', { text: 'No time entries found for this period', color: 'info' });
          payrollResult.value = {
            totalHours: 0,
            totalAdSpend: 0,
            basePay: 0,
            commission: 0,
            totalPayroll: payrollForm.bonusAmount,
            entries: []
          };
          payrollEntries.value = [];
        }
      } catch (apiError) {
        // API failed, but we already checked local
        emit('show-message', { text: 'No time entries found for this period', color: 'info' });
        payrollResult.value = {
          totalHours: 0,
          totalAdSpend: 0,
          basePay: 0,
          commission: 0,
          totalPayroll: payrollForm.bonusAmount,
          entries: []
        };
        payrollEntries.value = [];
      }
    }
  } catch (error) {
    emit('show-message', { text: 'Failed to calculate payroll', color: 'error' });
  } finally {
    calculating.value = false;
  }
};

const recalculatePayroll = () => {
  if (!payrollResult.value) return;
  
  const totalHours = payrollEntries.value.reduce((sum, e) => sum + (e.hours || 0), 0);
  const totalAdSpend = payrollEntries.value.reduce((sum, e) => sum + (e.adSpend || 0), 0);
  const basePay = totalHours * payrollForm.hourlyRate;
  const commission = totalAdSpend * (payrollForm.commissionRate / 100);
  
  payrollResult.value = {
    ...payrollResult.value,
    totalHours,
    totalAdSpend,
    basePay,
    commission,
    totalPayroll: basePay + commission + payrollForm.bonusAmount
  };
  
  // Save updated rates to localStorage when recalculating
  if (payrollForm.va) {
    const ratesKey = `vaRates_${payrollForm.va.replace(/[@\.]/g, '_')}`;
    localStorage.setItem(ratesKey, JSON.stringify({
      hourlyRate: payrollForm.hourlyRate,
      commissionRate: payrollForm.commissionRate
    }));
  }
};

const addManualPayrollEntry = () => {
  const today = new Date();
  payrollEntries.value.push({
    date: today.toISOString().split('T')[0],
    day: today.toLocaleDateString('en-US', { weekday: 'short' }),
    hours: 0,
    adSpend: 0
  });
};

const removePayrollEntry = (index) => {
  payrollEntries.value.splice(index, 1);
  recalculatePayroll();
};

const savePayrollReport = async () => {
  if (!payrollResult.value) return;
  
  const reportData = {
    va: payrollForm.va,
    period: {
      start: payrollForm.startDate,
      end: payrollForm.endDate
    },
    totalHours: payrollResult.value.totalHours || 0,
    totalRealSpend: payrollResult.value.totalAdSpend || 0,
    hourlyRate: payrollForm.hourlyRate || 0,
    commissionRate: payrollForm.commissionRate / 100 || 0, // Convert percentage to decimal
    bonusAmount: payrollForm.bonusAmount || 0,
    bonusReason: payrollForm.bonusReason || '',
    entries: payrollEntries.value,
    notes: payrollForm.notes || '',
    createdAt: new Date().toISOString()
  };
  
  // Server-only save
  try {
    const response = await adLaunchesAPI.savePayrollReport(reportData);
    if (response && response.success) {
      emit('show-message', { text: 'Payroll report saved successfully', color: 'success' });
      emit('switch-tab', 'history');
    } else {
      // Server error - be specific about what went wrong
      const errorMsg = response?.error?.includes('500') 
        ? 'Backend server error - please ensure the payroll API endpoint is implemented'
        : response?.error || 'Failed to save payroll report to server';
      emit('show-message', { text: errorMsg, color: 'error' });
    }
  } catch (error) {
    emit('show-message', { text: 'Network error - could not reach server', color: 'error' });
  }
};

// Get list of VAs from localStorage punch logs
const getAvailableVAs = () => {
  const vas = new Set();
  const keys = Object.keys(localStorage);
  
  // Look for punch log entries
  keys.forEach(key => {
    if (key.startsWith('punchLog_')) {
      // Extract email from key: punchLog_email_date
      const parts = key.split('_');
      if (parts.length >= 3) {
        // Reconstruct email (was sanitized with _ for @ and .)
        const emailParts = parts.slice(1, -1).join('_');
        // Try to restore the email format
        const email = emailParts.replace(/_/g, (match, offset) => {
          // This is approximate - we stored it sanitized
          // We'll need to store a mapping or use a different approach
          return offset === emailParts.lastIndexOf('_') ? '.com' : 
                 offset === emailParts.indexOf('_') ? '@' : '.';
        });
        
        // For now, let's check if we have actual email stored
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            if (parsed && parsed.length > 0) {
              // We have data for this VA
              vas.add(emailParts);
            }
          } catch (e) {
            // Skip invalid entries
          }
        }
      }
    }
  });
  
  // Also check for known VAs with stored rates
  keys.forEach(key => {
    if (key.startsWith('vaRates_')) {
      const emailParts = key.replace('vaRates_', '');
      vas.add(emailParts);
    }
  });
  
  // Convert sanitized emails back to proper format
  const vaEmails = Array.from(vas).map(sanitized => {
    // Common VA emails we know about
    const knownEmails = {
      'justin_m_lee_dev_gmail_com': 'justin.m.lee.dev@gmail.com',
      'tyler_example_com': 'tyler@example.com',
      'ryan_example_com': 'ryan@example.com'
    };
    
    if (knownEmails[sanitized]) {
      return {
        name: knownEmails[sanitized].split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        email: knownEmails[sanitized]
      };
    }
    
    // Try to reconstruct email
    const reconstructed = sanitized
      .replace(/_com$/, '.com')
      .replace(/_org$/, '.org')
      .replace(/_net$/, '.net')
      .replace(/_/, '@');
    
    return {
      name: reconstructed.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      email: reconstructed
    };
  });
  
  // Always include current user if logged in
  if (props.user?.email && !vaEmails.find(va => va.email === props.user.email)) {
    vaEmails.unshift({
      name: props.user.name || props.user.email.split('@')[0],
      email: props.user.email
    });
  }
  
  return vaEmails.length > 0 ? vaEmails : [
    { name: 'No VAs found', email: '' }
  ];
};

// Initialize on mount
onMounted(() => {
  // Load available VAs
  vaList.value = getAvailableVAs();
  
  if (props.user?.email) {
    payrollForm.va = props.user.email;
    loadVARates();
  }
});

// Watch for VA selection changes
watch(() => payrollForm.va, async (newVA) => {
  if (newVA) {
    await loadVARates();
  }
});

// Save VA rates to server when they change
const saveVARatesToServer = async () => {
  if (!payrollForm.va) return;
  
  try {
    const response = await fetch('/api/va-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        va: payrollForm.va,
        hourlyRate: payrollForm.hourlyRate,
        commissionRate: payrollForm.commissionRate,
        effectiveDate: new Date().toISOString().split('T')[0]
      })
    });
    
    if (!response.ok) {
      console.error('Failed to save VA rates to server');
    }
  } catch (error) {
    console.error('Error saving VA rates:', error);
  }
};

// Watch for rate changes and save to server
let ratesSaveTimeout = null;
watch([() => payrollForm.hourlyRate, () => payrollForm.commissionRate], () => {
  if (!payrollForm.va) return;
  
  // Debounce saves to avoid too many API calls
  clearTimeout(ratesSaveTimeout);
  ratesSaveTimeout = setTimeout(() => {
    saveVARatesToServer();
  }, 1000); // Save 1 second after user stops typing
});

const exportPayrollReport = () => {
  if (!payrollResult.value) return;
  
  const csv = [
    ['Payroll Report'],
    ['VA', payrollForm.va],
    ['Period', `${payrollForm.startDate} to ${payrollForm.endDate}`],
    [''],
    ['Date', 'Hours', 'Ad Spend'],
    ...payrollEntries.value.map(e => [e.date, e.hours, e.adSpend]),
    [''],
    ['Summary'],
    ['Total Hours', payrollResult.value.totalHours],
    ['Hourly Rate', payrollForm.hourlyRate],
    ['Base Pay', payrollResult.value.basePay],
    ['Total Ad Spend', payrollResult.value.totalAdSpend],
    ['Commission Rate', `${payrollForm.commissionRate}%`],
    ['Commission', payrollResult.value.commission],
    ['Bonus', payrollForm.bonusAmount],
    ['Total Payroll', payrollResult.value.totalPayroll]
  ].map(row => row.join(',')).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-${payrollForm.va}-${payrollForm.startDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
</script>