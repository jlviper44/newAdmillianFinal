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

    <!-- Weekly Chart Component Placeholder -->
    <WeeklyChart
      :current-week-data="currentWeekData"
      :previous-week-data="previousWeekData"
      class="mb-4"
    />

    <!-- Payment Settings -->
    <v-card class="mb-4">
      <v-card-title>
        <span>Payment Settings</span>
        <v-spacer />
        <v-btn
          color="primary"
          variant="elevated"
          :loading="isSavingSettings"
          @click="handleSaveSettings"
          prepend-icon="mdi-content-save"
        >
          Save Settings
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-row>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="defaultRate"
              label="Default Rate per Video"
              prefix="$"
              type="number"
              variant="outlined"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="defaultCommissionRate"
              label="Default Commission"
              :suffix="defaultCommissionType === 'percentage' ? '%' : '$'"
              type="number"
              variant="outlined"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              v-model="defaultCommissionType"
              label="Commission Type"
              :items="[{title: 'Percentage', value: 'percentage'}, {title: 'Fixed Amount', value: 'fixed'}]"
              variant="outlined"
              density="compact"
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
                <v-col cols="12" md="4">
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
                <v-col cols="12" md="4">
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
                <v-col cols="12" md="4">
                  <v-select
                    v-model="creator.commissionType"
                    label="Type"
                    :items="[{title: 'Percentage', value: 'percentage'}, {title: 'Fixed', value: 'fixed'}]"
                    variant="outlined"
                    density="compact"
                    hide-details
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
                  {{ item.sparks_created }} spark{{ item.sparks_created !== 1 ? 's' : '' }} created
                </div>
              </div>
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
              :disabled="item.sparks_created === 0"
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
import { ref, computed, onMounted, watch } from 'vue';
import { useVAStatus } from './composables/useVAStatus.js';
import { usePayments } from '../Payments/composables/usePayments.js';
import { useSparks } from '../Sparks/composables/useSparks.js';
import WeeklyChart from './components/WeeklyChart.vue';

// Use VA Status composable
const {
  isLoading,
  getWeeklyComparison,
  generateEarlyReport,
  getCurrentWeekRange
} = useVAStatus();

// Use Payments composable for payment settings
const {
  defaultRate,
  defaultCommissionRate,
  defaultCommissionType,
  isSavingSettings,
  customCreatorRates,
  getCreatorsWithRates,
  savePaymentSettings,
  updateCreatorRate
} = usePayments();

// Use Sparks composable to get creator data
const { sparks, fetchSparks } = useSparks();

// Component state
const currentWeekData = ref([]);
const previousWeekData = ref([]);
const stats = ref({
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

// Table headers for VA breakdown
const vaHeaders = [
  { title: 'VA', key: 'va_email', sortable: true },
  { title: 'Sparks Created', key: 'sparks_created', sortable: true },
  { title: 'Daily Breakdown', key: 'daily_breakdown', sortable: false },
  { title: 'Earnings', key: 'total_earnings', sortable: true },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Computed properties
const creators = computed(() => {
  // Make the computed reactive to customCreatorRates changes
  customCreatorRates.value; // This ensures reactivity
  return getCreatorsWithRates(sparks.value);
});

// Methods
const refreshData = async () => {
  try {
    const comparison = await getWeeklyComparison();
    console.log('Weekly comparison data:', comparison);
    console.log('Current week data:', comparison.currentWeek);

    currentWeekData.value = comparison.currentWeek;
    previousWeekData.value = comparison.previousWeek;
    stats.value = comparison.stats;

    // Log the first item to see its structure
    if (comparison.currentWeek.length > 0) {
      console.log('First VA data item:', comparison.currentWeek[0]);
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
      updateCreatorRate(creator.name, creator.rate, creator.commissionRate, creator.commissionType);
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
    console.log('Generating payment report for VA:', vaData.va_email);

    // Use the current week's date range for this specific VA
    const currentWeek = getCurrentWeekRange();

    const result = await generateEarlyReport(
      currentWeek.start,
      currentWeek.end,
      [vaData.va_email], // Only this specific VA
      'admin'
    );

    console.log('Payment report generated successfully for', vaData.va_email, result);

    // Refresh the data to reflect any changes
    setTimeout(refreshData, 1000);
  } catch (error) {
    console.error('Failed to generate payment report for', vaData.va_email, ':', error);
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

// Load data on mount
onMounted(async () => {
  await Promise.all([
    refreshData(),
    fetchSparks()
  ]);
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