<template>
  <div class="va-status-tab">
    <!-- Header with Actions -->
    <v-card class="mb-4">
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-account-group</v-icon>
        VA Status & Weekly Reports
        <v-spacer />
        <v-btn
          variant="outlined"
          prepend-icon="mdi-refresh"
          @click="refreshData"
          :loading="isLoading"
        >
          Refresh
        </v-btn>
      </v-card-title>
    </v-card>

    <!-- Summary Cards -->
    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 mb-2 text-primary">{{ stats.currentWeekTotal }}</div>
            <div class="text-subtitle-2">Sparks This Week</div>
            <div class="text-caption text-grey mt-1">
              <v-icon
                size="small"
                :color="stats.weekOverWeekChange >= 0 ? 'success' : 'error'"
                class="mr-1"
              >
                {{ stats.weekOverWeekChange >= 0 ? 'mdi-trending-up' : 'mdi-trending-down' }}
              </v-icon>
              {{ Math.abs(stats.weekOverWeekChange) }}% vs last week
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 mb-2 text-success">{{ stats.previousWeekTotal }}</div>
            <div class="text-subtitle-2">Sparks Last Week</div>
            <div class="text-caption text-grey mt-1">
              Previous period
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 mb-2 text-info">{{ stats.activeVAsThisWeek }}</div>
            <div class="text-subtitle-2">Active VAs</div>
            <div class="text-caption text-grey mt-1">
              {{ stats.activeVAsLastWeek }} last week
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <div class="text-h4 mb-2 text-warning">{{ stats.avgPerVAThisWeek }}</div>
            <div class="text-subtitle-2">Avg per VA</div>
            <div class="text-caption text-grey mt-1">
              {{ stats.avgPerVALastWeek }} last week
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Weekly Chart Component - Shows ALL sparks for trends -->
    <WeeklyChart
      :current-week-data="currentWeekAllData"
      :previous-week-data="previousWeekAllData"
      class="mb-4"
    />

    <!-- Payment Settings -->
    <v-card class="mb-4" :loading="isLoadingSettings">
      <v-card-title>
        <span>Payment Settings</span>
        <v-spacer />
        <v-btn
          color="primary"
          variant="elevated"
          :loading="isSavingSettings"
          :disabled="isLoadingSettings"
          @click="handleSaveSettings"
          prepend-icon="mdi-content-save"
        >
          Save Settings
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="defaultRate"
              label="Default Rate per Video"
              prefix="$"
              type="number"
              variant="outlined"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="defaultCommissionRate"
              label="Default Commission"
              :suffix="defaultCommissionType === 'percentage' ? '%' : '$'"
              type="number"
              variant="outlined"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="defaultCommissionType"
              label="Commission Type"
              :items="[{title: 'Percentage', value: 'percentage'}, {title: 'Fixed Amount', value: 'fixed'}]"
              variant="outlined"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="defaultPaymentMethod"
              label="Default Payment Method"
              :items="['Wise', 'Crypto', 'Wire', 'Zelle', 'Cash', 'PayPal', 'Other']"
              variant="outlined"
              density="compact"
              placeholder="Select default payment method..."
            />
          </v-col>
        </v-row>

        <h4 class="text-h6 mb-3" v-if="creators.length > 0">Creator Custom Rates & Commissions</h4>
        <v-row v-if="creators.length > 0">
          <v-col
            v-for="creator in creators"
            :key="creator.id"
            cols="12"
          >
            <v-card variant="outlined" class="pa-3">
              <div class="font-weight-medium mb-2">{{ creator.name }}</div>
              <v-row>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model="creator.rate"
                    label="Rate per Video"
                    prefix="$"
                    type="number"
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-text-field
                    v-model="creator.commissionRate"
                    label="Commission"
                    :suffix="creator.commissionType === 'percentage' ? '%' : '$'"
                    type="number"
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-select
                    v-model="creator.commissionType"
                    label="Type"
                    :items="[{title: 'Percentage', value: 'percentage'}, {title: 'Fixed', value: 'fixed'}]"
                    variant="outlined"
                    density="compact"
                    hide-details
                  />
                </v-col>
                <v-col cols="12" md="3">
                  <v-select
                    v-model="creator.paymentMethod"
                    label="Payment Method"
                    :items="['Wise', 'Crypto', 'Wire', 'Zelle', 'Cash', 'PayPal', 'Other']"
                    variant="outlined"
                    density="compact"
                    hide-details
                    placeholder="Select method..."
                  />
                </v-col>
              </v-row>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- VA Breakdown Table -->
    <v-card>
      <v-card-title>
        VA Productivity Breakdown
        <v-spacer />
        <v-chip color="info" size="small">Current Week</v-chip>
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="vaHeaders"
          :items="currentWeekData"
          :loading="isLoading"
          density="compact"
          :items-per-page="25"
        >
          <!-- VA Name/Email Column -->
          <template v-slot:item.va_email="{ item }">
            <div class="d-flex align-center">
              <v-avatar color="primary" size="32" class="mr-3">
                <span>{{ item.va_email.charAt(0).toUpperCase() }}</span>
              </v-avatar>
              <div>
                <div class="font-weight-medium">{{ item.va_email }}</div>
                <div class="text-caption text-grey">
                  {{ item.sparks_created }} unpaid spark{{ item.sparks_created !== 1 ? 's' : '' }}
                </div>
              </div>
            </div>
          </template>

          <!-- Total Sparks Created Column -->
          <template v-slot:item.total_sparks_created="{ item }">
            <div class="text-center">
              <div class="font-weight-medium">{{ item.total_sparks_created || 0 }}</div>
            </div>
          </template>

          <!-- Unpaid Sparks Column -->
          <template v-slot:item.sparks_created="{ item }">
            <div class="text-center">
              <div class="font-weight-medium text-warning">{{ item.sparks_created }}</div>
            </div>
          </template>

          <!-- Daily Breakdown -->
          <template v-slot:item.daily_breakdown="{ item }">
            <div class="d-flex gap-1">
              <v-chip
                v-for="(count, day) in item.daily_breakdown"
                :key="day"
                size="x-small"
                variant="tonal"
                :color="count > 0 ? 'success' : 'grey'"
              >
                {{ day.substring(0, 3) }}: {{ count || 0 }}
              </v-chip>
            </div>
          </template>

          <!-- Earnings Column -->
          <template v-slot:item.total_earnings="{ item }">
            <div class="text-success font-weight-medium">
              ${{ (item.total_earnings || 0).toFixed(2) }}
            </div>
          </template>

          <!-- Status Column -->
          <template v-slot:item.status="{ item }">
            <v-chip
              size="small"
              :color="getStatusColor(item.generation_type)"
              variant="tonal"
            >
              {{ item.generation_type }}
            </v-chip>
          </template>

          <!-- Actions Column -->
          <template v-slot:item.actions="{ item }">
            <v-btn
              color="primary"
              variant="outlined"
              size="small"
              prepend-icon="mdi-file-document-plus"
              @click="generateVAPaymentReport(item)"
              :loading="isGeneratingReport"
              :disabled="isGeneratingReport || item.sparks_created === 0"
            >
              Generate Report
            </v-btn>
          </template>

          <!-- No Data Message -->
          <template v-slot:no-data>
            <div class="text-center pa-4">
              <v-icon size="48" color="grey-lighten-2" class="mb-2">mdi-account-clock</v-icon>
              <div class="text-h6 text-grey">No VA activity this week</div>
              <div class="text-caption text-grey">VAs will appear here once they create sparks</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- Success Snackbar -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="4000"
      location="top"
    >
      {{ snackbarMessage }}
      <template v-slot:actions>
        <v-btn
          color="white"
          variant="text"
          @click="showSnackbar = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useVAStatus } from './composables/useVAStatus.js';
import { usePayments } from '../Payments/composables/usePayments.js';
import { useSparks, onSparkEvent } from '../Sparks/composables/useSparks.js';
import WeeklyChart from './components/WeeklyChart.vue';

// Use VA Status composable
const {
  isLoading,
  getWeeklyComparison,
  getWeeklyProductivityBreakdown,
  generateEarlyReport,
  getCurrentWeekRange
} = useVAStatus();

// Use Payments composable for payment settings
const {
  defaultRate,
  defaultCommissionRate,
  defaultCommissionType,
  defaultPaymentMethod,
  isSavingSettings,
  isLoadingSettings,
  customCreatorRates,
  getCreatorsWithRates,
  savePaymentSettings,
  updateCreatorRate
} = usePayments();

// Use Sparks composable to get creator data
const { sparks, fetchSparks } = useSparks();

// Component state
const currentWeekData = ref([]); // For productivity breakdown (unpaid only)
const previousWeekData = ref([]); // For productivity breakdown (unpaid only)
const currentWeekAllData = ref([]); // For chart trends (all sparks)
const previousWeekAllData = ref([]); // For chart trends (all sparks)
const stats = ref({ // Overall stats (all sparks)
  currentWeekTotal: 0,
  previousWeekTotal: 0,
  weekOverWeekChange: 0,
  activeVAsThisWeek: 0,
  activeVAsLastWeek: 0,
  avgPerVAThisWeek: 0,
  avgPerVALastWeek: 0
});

// Snackbar state
const showSnackbar = ref(false);
const snackbarMessage = ref('');
const snackbarColor = ref('success');

// Report generation state
const isGeneratingReport = ref(false);

// Event cleanup functions
const eventCleanupFunctions = [];

// Table headers for VA breakdown
const vaHeaders = [
  { title: 'VA', key: 'va_email', sortable: true },
  { title: 'Sparks Created', key: 'total_sparks_created', sortable: true },
  { title: 'Unpaid Sparks', key: 'sparks_created', sortable: true },
  { title: 'Daily Breakdown', key: 'daily_breakdown', sortable: false },
  { title: 'Earnings', key: 'total_earnings', sortable: true },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Computed properties
const creators = ref([]);

// Update creators when sparks or customCreatorRates change
const updateCreators = () => {
  creators.value = getCreatorsWithRates(sparks.value);
};

// Watch for changes to update creators
watch([sparks, customCreatorRates], updateCreators, { deep: true });

// Methods
const refreshData = async () => {
  try {
    // Prepare payment settings object to pass to useVAStatus functions
    const paymentSettings = {
      defaultRate: defaultRate.value,
      defaultCommissionRate: defaultCommissionRate.value,
      defaultCommissionType: defaultCommissionType.value,
      customCreatorRates: customCreatorRates.value
    };

    // Get overall stats (all sparks) and productivity breakdown (unpaid only) in parallel
    const [comparison, productivityBreakdown] = await Promise.all([
      getWeeklyComparison(paymentSettings), // All sparks for stats
      getWeeklyProductivityBreakdown(paymentSettings) // Unpaid sparks for breakdown table
    ]);

    console.log('Weekly comparison data (all sparks):', comparison);
    console.log('Productivity breakdown data (unpaid only):', productivityBreakdown);

    // Use all-sparks data for stats display and chart trends
    stats.value = comparison.stats;
    currentWeekAllData.value = comparison.currentWeek; // For chart trends
    previousWeekAllData.value = comparison.previousWeek; // For chart trends

    // Use unpaid-sparks data for productivity breakdown table, but add total sparks count
    currentWeekData.value = productivityBreakdown.currentWeek.map(unpaidVA => {
      // Find corresponding VA data from all-sparks dataset
      const allVA = comparison.currentWeek.find(allVA => allVA.va_email === unpaidVA.va_email);
      return {
        ...unpaidVA,
        total_sparks_created: allVA ? allVA.sparks_created : 0
      };
    });

    previousWeekData.value = productivityBreakdown.previousWeek.map(unpaidVA => {
      // Find corresponding VA data from all-sparks dataset
      const allVA = comparison.previousWeek.find(allVA => allVA.va_email === unpaidVA.va_email);
      return {
        ...unpaidVA,
        total_sparks_created: allVA ? allVA.sparks_created : 0
      };
    });

    console.log('Stats (all sparks):', stats.value);
    console.log('Chart data (all sparks):', currentWeekAllData.value);
    console.log('Productivity breakdown (unpaid sparks):', currentWeekData.value);

    // Log the first item to see its structure
    if (currentWeekData.value.length > 0) {
      console.log('First VA productivity item (unpaid only):', currentWeekData.value[0]);
    }
  } catch (error) {
    console.error('Failed to refresh VA status data:', error);
  }
};


const getStatusColor = (generationType) => {
  switch (generationType) {
    case 'automatic': return 'success';
    case 'early': return 'warning';
    case 'custom': return 'info';
    default: return 'grey';
  }
};

const handleSaveSettings = async () => {
  try {
    // Update custom creator rates from the form data
    creators.value.forEach(creator => {
      updateCreatorRate(creator.name, creator.rate, creator.commissionRate, creator.commissionType, creator.paymentMethod);
    });

    // Save all payment settings including custom rates
    await savePaymentSettings();
    console.log('Payment settings saved successfully');

    // Show success message using snackbar
    snackbarMessage.value = 'Payment settings saved successfully!';
    snackbarColor.value = 'success';
    showSnackbar.value = true;

    // Refresh VA data to reflect new settings
    await refreshData();
  } catch (error) {
    console.error('Failed to save payment settings:', error);

    // Show error message using snackbar
    snackbarMessage.value = 'Failed to save payment settings. Please try again.';
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  }
};

const generateVAPaymentReport = async (vaData) => {
  try {
    isGeneratingReport.value = true;
    console.log('Generating payment report for VA:', vaData.va_email);

    // Show starting notification
    snackbarMessage.value = `Generating payment report for ${vaData.va_email}...`;
    snackbarColor.value = 'info';
    showSnackbar.value = true;

    // Use the current week's date range for this specific VA
    const currentWeek = getCurrentWeekRange();

    // Prepare payment settings object to pass to generateEarlyReport
    const paymentSettings = {
      defaultRate: defaultRate.value,
      defaultCommissionRate: defaultCommissionRate.value,
      defaultCommissionType: defaultCommissionType.value,
      defaultPaymentMethod: defaultPaymentMethod.value,
      customCreatorRates: customCreatorRates.value
    };

    const result = await generateEarlyReport(
      currentWeek.start,
      currentWeek.end,
      [vaData.va_email], // Only this specific VA
      'admin',
      paymentSettings
    );

    console.log('Payment report generated successfully for', vaData.va_email, result);

    // Show success notification with details
    const sparkCount = result.sparksMarkedAsPaid || 0;
    snackbarMessage.value = `Payment report generated for ${vaData.va_email}! ${sparkCount} sparks marked as paid.`;
    snackbarColor.value = 'success';
    showSnackbar.value = true;

    // Refresh the data to reflect any changes
    setTimeout(refreshData, 1000);
  } catch (error) {
    console.error('Failed to generate payment report for', vaData.va_email, ':', error);

    // Show error notification
    snackbarMessage.value = `Failed to generate payment report for ${vaData.va_email}. ${error.message}`;
    snackbarColor.value = 'error';
    showSnackbar.value = true;
  } finally {
    isGeneratingReport.value = false;
  }
};

// Note: Auto-recalculation will happen when settings are saved

// Watch for payment settings changes to recalculate earnings
watch([defaultRate, defaultCommissionRate, defaultCommissionType], async () => {
  console.log('Payment settings changed, recalculating VA earnings...');
  await refreshData();
}, { deep: true });

// Watch for custom creator rates changes
watch(customCreatorRates, async () => {
  console.log('Custom creator rates changed, recalculating VA earnings...');
  await refreshData();
}, { deep: true });

// Watch for when payment settings are initially loaded
watch(isLoadingSettings, async (newValue, oldValue) => {
  if (oldValue === true && newValue === false) {
    console.log('Payment settings loaded, recalculating VA earnings...');
    await refreshData();
  }
});

// Auto-refresh function for spark events
const handleSparkChange = async (sparkData) => {
  console.log('🔄 VA Status: Auto-refreshing due to spark change:', sparkData);

  // Refresh the data silently
  await refreshData();
};

// Load data on mount and set up event listeners
onMounted(async () => {
  await Promise.all([
    refreshData(),
    fetchSparks()
  ]);
  updateCreators(); // Initialize creators after data is loaded

  // Set up event listeners for automatic refresh
  const sparkCreatedCleanup = onSparkEvent('sparkCreated', handleSparkChange);
  const sparkUpdatedCleanup = onSparkEvent('sparkUpdated', handleSparkChange);
  const sparkDeletedCleanup = onSparkEvent('sparkDeleted', handleSparkChange);

  // Store cleanup functions
  eventCleanupFunctions.push(sparkCreatedCleanup, sparkUpdatedCleanup, sparkDeletedCleanup);

  console.log('✅ VA Status: Event listeners set up for auto-refresh');
});

// Cleanup event listeners on unmount
onUnmounted(() => {
  console.log('🧹 VA Status: Cleaning up event listeners');
  eventCleanupFunctions.forEach(cleanup => cleanup());
});
</script>

<style scoped>
.va-status-tab {
  /* Add custom styles here */
}

.text-h4 {
  font-weight: 600;
}

.v-chip--small {
  font-size: 0.75rem;
}
</style>