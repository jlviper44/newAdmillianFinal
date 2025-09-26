<template>
  <div class="payments-tab">
    <!-- Undo Button -->
    <v-slide-y-transition>
      <v-alert
        v-if="showUndoButton"
        type="success"
        variant="tonal"
        closable
        @click:close="showUndoButton = false"
        class="mb-4"
      >
        <div class="d-flex align-center justify-space-between">
          <span>
            <template v-if="lastPaymentAction?.type === 'void'">
              Payment voided successfully for {{ lastPaymentAction?.creator }}
            </template>
            <template v-else>
              Payment marked successfully for {{ lastPaymentAction?.creator }}
              <span v-if="lastPaymentAction?.amount">
                (${{ lastPaymentAction.amount }})
              </span>
            </template>
          </span>
          <v-btn
            color="warning"
            variant="elevated"
            size="small"
            @click="handleUndoPayment"
            prepend-icon="mdi-undo"
          >
            Undo
          </v-btn>
        </div>
      </v-alert>
    </v-slide-y-transition>

    <!-- Summary Cards -->
    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-warning mb-2">{{ weeklyStats.pendingAmount }}</h3>
            <p class="text-body-2 text-grey">Pending Payments</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-success mb-2">{{ weeklyStats.paidAmount }}</h3>
            <p class="text-body-2 text-grey">Paid This Period</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-info mb-2">{{ weeklyStats.totalReports }}</h3>
            <p class="text-body-2 text-grey">Weekly Reports</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-primary mb-2">{{ weeklyStats.totalSparks }}</h3>
            <p class="text-body-2 text-grey">Total Sparks</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Weekly Reports Payment List -->
    <v-card>
      <v-card-title class="d-flex justify-space-between align-center">
        <span>Weekly Payment Reports</span>
        <v-btn
          color="primary"
          variant="outlined"
          size="small"
          @click="loadWeeklyPaymentReports"
          :loading="isLoading"
          prepend-icon="mdi-refresh"
        >
          Refresh
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="weeklyReportHeaders"
          :items="activePendingPayments"
          :loading="isLoading"
          density="compact"
          :items-per-page="25"
          class="compact-table"
        >
          <!-- VA Column -->
          <template v-slot:item.va_email="{ item }">
            <div class="d-flex align-center">
              <v-avatar color="primary" size="24" class="mr-2">
                <span class="text-caption font-weight-bold">{{ item.va_email.charAt(0).toUpperCase() }}</span>
              </v-avatar>
              <div>
                <div class="font-weight-medium text-caption">{{ item.va_email }}</div>
                <v-chip
                  size="x-small"
                  variant="tonal"
                  color="success"
                  class="text-xs"
                >
                  Weekly
                </v-chip>
              </div>
            </div>
          </template>

          <!-- Week Period Column -->
          <template v-slot:item.week_period="{ item }">
            <div>
              <div class="font-weight-medium text-caption mb-1">{{ formatWeekPeriod(item.week_start, item.week_end) }}</div>
              <v-chip
                size="x-small"
                variant="tonal"
                :color="item.generation_type === 'early' ? 'warning' : 'info'"
                class="mr-1 text-xs"
              >
                {{ item.generation_type }}
              </v-chip>
              <span class="text-xs text-grey">{{ item.generated_by }}</span>
            </div>
          </template>

          <!-- Sparks Count Column -->
          <template v-slot:item.sparks_count="{ item }">
            <v-chip
              color="info"
              variant="tonal"
              size="x-small"
              class="text-xs"
            >
              {{ item.sparks_count }} spark{{ item.sparks_count !== 1 ? 's' : '' }}
            </v-chip>
          </template>

          <!-- Original Amount Column -->
          <template v-slot:item.original_amount="{ item }">
            <div class="text-center">
              <div class="text-info font-weight-bold text-body-2">
                ${{ (item.original_amount || 0).toFixed(2) }}
              </div>
            </div>
          </template>

          <!-- Final Amount Column -->
          <template v-slot:item.amount="{ item }">
            <div v-if="item.status !== 'pending'" class="d-flex align-center gap-2">
              <span class="text-success font-weight-medium text-body-2">
                ${{ item.amount.toFixed(2) }}
              </span>
              <v-chip
                v-if="item.original_amount && item.amount !== item.original_amount"
                color="warning"
                variant="tonal"
                size="x-small"
                title="This amount was manually adjusted from the original calculation"
                class="text-xs"
              >
                Modified
              </v-chip>
            </div>
            <div v-else class="d-flex align-center justify-center gap-2">
              <v-text-field
                v-model="item.amount"
                variant="outlined"
                density="compact"
                type="number"
                step="0.01"
                min="0"
                style="max-width: 110px; font-size: 0.75rem; transform: scale(0.85);"
                hide-details
                @blur="updatePaymentAmount(item)"
                @keyup.enter="updatePaymentAmount(item)"
                :error="item.amount < 0"
                :color="item.original_amount && item.amount !== item.original_amount ? 'warning' : 'primary'"
              />
              <v-btn
                v-if="item.original_amount && item.amount !== item.original_amount"
                icon
                size="x-small"
                variant="text"
                color="warning"
                @click="resetPaymentAmount(item)"
                :title="`Reset to original amount ($${item.original_amount.toFixed(2)})`"
              >
                <v-icon size="small">mdi-restore</v-icon>
              </v-btn>
            </div>
          </template>

          <!-- Payment Method Column -->
          <template v-slot:item.payment_method="{ item }">
            <v-select
              v-model="item.payment_method"
              :items="['Wise', 'Crypto', 'Wire', 'Zelle', 'Cash', 'PayPal', 'Other']"
              variant="outlined"
              density="compact"
              style="max-width: 100px; font-size: 0.75rem; transform: scale(0.85);"
              hide-details
              placeholder="Select..."
            />
          </template>

          <!-- Status Column -->
          <template v-slot:item.status="{ item }">
            <v-chip
              :color="getPaymentStatusColor(item.status)"
              variant="tonal"
              size="x-small"
              class="text-xs"
            >
              {{ item.status }}
            </v-chip>
          </template>

          <!-- Actions Column -->
          <template v-slot:item.actions="{ item }">
            <div class="d-flex gap-1">
              <v-btn
                v-if="item.status === 'pending'"
                color="success"
                variant="outlined"
                size="x-small"
                @click="markWeeklyPaymentPaid(item)"
                prepend-icon="mdi-check-circle"
                class="text-xs"
              >
                Mark Paid
              </v-btn>
              <v-btn
                v-if="item.status === 'pending'"
                color="error"
                variant="outlined"
                size="x-small"
                @click="voidWeeklyPayment(item)"
                prepend-icon="mdi-cancel"
                class="text-xs"
              >
                Void
              </v-btn>
              <v-btn
                v-if="item.status === 'paid'"
                color="warning"
                variant="outlined"
                size="x-small"
                @click="undoWeeklyPayment(item)"
                prepend-icon="mdi-undo"
                class="text-xs"
              >
                Undo
              </v-btn>
            </div>
          </template>

          <!-- No Data Message -->
          <template v-slot:no-data>
            <div class="text-center pa-4">
              <v-icon size="48" color="grey-lighten-2" class="mb-2">mdi-calendar-week</v-icon>
              <div class="text-h6 text-grey">No weekly reports generated</div>
              <div class="text-caption text-grey">Use the VA Status tab to generate payment reports</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { usePayments } from './composables/usePayments.js';
import { useVAStatus } from '../VAStatus/composables/useVAStatus.js';
import { onSparkEvent, emitSparkEvent } from '../sparks/composables/useSparks.js';
import { sparksApi } from '@/services/api';

// Use the payments composable for undo functionality and payment settings
const {
  lastPaymentAction,
  showUndoButton,
  undoLastPayment,
  defaultPaymentMethod,
  customCreatorRates
} = usePayments();

// Weekly payment reports data
const weeklyPaymentReports = ref([]);

// Headers for weekly reports table
const weeklyReportHeaders = [
  { title: 'VA', key: 'va_email', sortable: true },
  { title: 'Week Period', key: 'week_period', sortable: true },
  { title: 'Sparks', key: 'sparks_count', sortable: true },
  { title: 'Original Amount', key: 'original_amount', sortable: true },
  { title: 'Final Amount', key: 'amount', sortable: true },
  { title: 'Payment Method', key: 'payment_method', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Use VA Status composable to get weekly payment entries
const { getWeeklyPaymentEntries } = useVAStatus();

// State for loading
const isLoading = ref(false);

// Computed property to filter only pending payments for Active Payments tab
const activePendingPayments = computed(() => {
  return weeklyPaymentReports.value.filter(r => r.status === 'pending');
});

// Computed properties for weekly statistics
const weeklyStats = computed(() => {
  const reports = weeklyPaymentReports.value;

  const pendingReports = reports.filter(r => r.status === 'pending');
  const paidReports = reports.filter(r => r.status === 'paid');

  // Calculate adjustment amounts
  const totalOriginal = reports.reduce((sum, r) => sum + (r.original_amount || 0), 0);
  const totalFinal = reports.reduce((sum, r) => sum + r.amount, 0);
  const totalAdjustment = totalFinal - totalOriginal;

  return {
    pendingAmount: `$${pendingReports.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}`,
    paidAmount: `$${paidReports.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}`,
    totalReports: reports.length,
    totalSparks: reports.reduce((sum, r) => sum + r.sparks_count, 0),
    totalAdjustment: totalAdjustment,
    adjustmentDisplay: totalAdjustment === 0 ? '$0.00' :
      (totalAdjustment > 0 ? `+$${totalAdjustment.toFixed(2)}` : `-$${Math.abs(totalAdjustment).toFixed(2)}`)
  };
});

const handleUndoPayment = async () => {
  try {
    await undoLastPayment();
    console.log('Payment undone successfully');
  } catch (error) {
    console.error('Failed to undo payment:', error);
  }
};

// Weekly payment methods
const formatWeekPeriod = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
};

const getPaymentStatusColor = (status) => {
  switch (status) {
    case 'pending': return 'warning';
    case 'paid': return 'success';
    case 'voided': return 'error';
    default: return 'grey';
  }
};

const markWeeklyPaymentPaid = async (payment) => {
  try {
    console.log('Marking weekly payment as paid:', payment);

    // First update payment method if it was changed
    if (payment.payment_method) {
      await sparksApi.updateWeeklyPaymentEntryPaymentMethod(payment.id, payment.payment_method);
    }

    // Then mark as paid
    await sparksApi.updateWeeklyPaymentEntryStatus(payment.id, 'paid');
    payment.status = 'paid';
    payment.paid_at = new Date().toISOString();

    // Emit event to refresh History and Invoices
    emitSparkEvent('paymentMarkedPaid', {
      paymentId: payment.id,
      vaEmail: payment.va_email,
      amount: payment.amount,
      status: 'paid'
    });
  } catch (error) {
    console.error('Failed to mark weekly payment as paid:', error);
  }
};

const voidWeeklyPayment = async (payment) => {
  try {
    console.log('Voiding weekly payment:', payment);
    await sparksApi.updateWeeklyPaymentEntryStatus(payment.id, 'voided');
    payment.status = 'voided';
    payment.voided_at = new Date().toISOString();

    // Emit event to refresh History and Invoices
    emitSparkEvent('paymentMarkedVoid', {
      paymentId: payment.id,
      vaEmail: payment.va_email,
      amount: payment.amount,
      status: 'voided'
    });
  } catch (error) {
    console.error('Failed to void weekly payment:', error);
  }
};

const undoWeeklyPayment = async (payment) => {
  try {
    console.log('Undoing weekly payment:', payment);
    await sparksApi.updateWeeklyPaymentEntryStatus(payment.id, 'pending');
    payment.status = 'pending';
    delete payment.paid_at;
    delete payment.voided_at;
  } catch (error) {
    console.error('Failed to undo weekly payment:', error);
  }
};

const updatePaymentAmount = async (payment) => {
  try {
    // Ensure amount is a number
    payment.amount = parseFloat(payment.amount) || 0;

    // Validate minimum amount
    if (payment.amount < 0) {
      payment.amount = 0;
    }

    console.log('Updating payment amount:', {
      id: payment.id,
      va_email: payment.va_email,
      originalAmount: payment.originalAmount,
      newAmount: payment.amount
    });

    // Update the amount in database
    await sparksApi.updateWeeklyPaymentEntryAmount(payment.id, payment.amount);

    console.log('Payment amount updated successfully');
  } catch (error) {
    console.error('Failed to update payment amount:', error);
    // Revert to original amount on error
    if (payment.original_amount !== undefined) {
      payment.amount = payment.original_amount;
    }
  }
};

const resetPaymentAmount = (payment) => {
  try {
    if (payment.original_amount !== undefined) {
      payment.amount = payment.original_amount;
      console.log('Reset payment amount to original:', {
        id: payment.id,
        va_email: payment.va_email,
        resetAmount: payment.original_amount
      });
    }
  } catch (error) {
    console.error('Failed to reset payment amount:', error);
  }
};


// Load weekly payment reports
const loadWeeklyPaymentReports = async () => {
  try {
    isLoading.value = true;
    console.log('📋 PaymentsTab: Loading weekly payment reports...');

    // Prepare payment settings for hierarchy application
    const paymentSettings = {
      defaultPaymentMethod: defaultPaymentMethod.value,
      customCreatorRates: customCreatorRates.value
    };

    const entries = await getWeeklyPaymentEntries(paymentSettings);
    console.log('📋 PaymentsTab: Weekly payment entries loaded:', entries);
    console.log('📋 PaymentsTab: Entries length:', entries.length);
    if (entries.length > 0) {
      console.log('📋 PaymentsTab: First entry structure:', entries[0]);
      console.log('📋 PaymentsTab: First entry original_amount:', entries[0].original_amount);
      console.log('📋 PaymentsTab: First entry amount:', entries[0].amount);
    }
    weeklyPaymentReports.value = entries;
    console.log('📋 PaymentsTab: weeklyPaymentReports updated to:', weeklyPaymentReports.value);
  } catch (error) {
    console.error('❌ PaymentsTab: Failed to load weekly payment reports:', error);
  } finally {
    isLoading.value = false;
    console.log('📋 PaymentsTab: Loading complete. Final entries count:', weeklyPaymentReports.value.length);
  }
};

// Load data on mount and setup refresh interval
onMounted(async () => {
  await loadWeeklyPaymentReports();

  // Set up auto-refresh when payment reports are generated from VA Status
  onSparkEvent('paymentReportGenerated', async (reportData) => {
    console.log('🔄 PaymentsTab: Auto-refreshing due to payment report generation:', reportData);

    // Refresh the payment data to show new pending payments
    await loadWeeklyPaymentReports();

    console.log('✅ PaymentsTab: Auto-refresh completed after payment report generation');
  });
});

// Add refresh function for external use
const refreshData = loadWeeklyPaymentReports;
</script>

<style scoped>
.payments-tab {
  /* Add your custom styles here */
}

.compact-table :deep(.v-data-table__td) {
  padding: 4px 8px !important;
  height: auto !important;
}

.compact-table :deep(.v-data-table__th) {
  padding: 8px 8px !important;
  font-size: 0.75rem !important;
  font-weight: 600 !important;
}

.compact-table :deep(.v-data-table-header__content) {
  font-size: 0.75rem !important;
  font-weight: 600 !important;
}

.text-xs {
  font-size: 0.65rem !important;
}
</style>