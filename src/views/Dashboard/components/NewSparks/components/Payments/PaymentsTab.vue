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
      <v-card-title>Weekly Payment Reports</v-card-title>
      <v-card-text>
        <v-data-table
          :headers="weeklyReportHeaders"
          :items="weeklyPaymentReports"
          :loading="isLoading"
          density="compact"
          :items-per-page="25"
        >
          <!-- VA Column -->
          <template v-slot:item.va_email="{ item }">
            <div class="d-flex align-center">
              <v-avatar color="primary" size="32" class="mr-3">
                <span>{{ item.va_email.charAt(0).toUpperCase() }}</span>
              </v-avatar>
              <div>
                <div class="font-weight-medium">{{ item.va_email }}</div>
                <div class="text-caption text-grey">
                  Weekly Report
                </div>
              </div>
            </div>
          </template>

          <!-- Week Period Column -->
          <template v-slot:item.week_period="{ item }">
            <div>
              <div class="font-weight-medium">{{ formatWeekPeriod(item.week_start, item.week_end) }}</div>
              <div class="text-caption text-grey">
                {{ item.generation_type }} • {{ item.generated_by }}
              </div>
            </div>
          </template>

          <!-- Sparks Count Column -->
          <template v-slot:item.sparks_count="{ item }">
            <v-chip
              color="info"
              variant="tonal"
              size="small"
            >
              {{ item.sparks_count }} spark{{ item.sparks_count !== 1 ? 's' : '' }}
            </v-chip>
          </template>

          <!-- Amount Column -->
          <template v-slot:item.amount="{ item }">
            <div class="text-success font-weight-medium">
              ${{ item.amount.toFixed(2) }}
            </div>
          </template>

          <!-- Status Column -->
          <template v-slot:item.status="{ item }">
            <v-chip
              :color="getPaymentStatusColor(item.status)"
              variant="tonal"
              size="small"
            >
              {{ item.status }}
            </v-chip>
          </template>

          <!-- Actions Column -->
          <template v-slot:item.actions="{ item }">
            <div class="d-flex gap-2">
              <v-btn
                v-if="item.status === 'pending'"
                color="success"
                variant="outlined"
                size="small"
                @click="markWeeklyPaymentPaid(item)"
                prepend-icon="mdi-check-circle"
              >
                Mark Paid
              </v-btn>
              <v-btn
                v-if="item.status === 'pending'"
                color="error"
                variant="outlined"
                size="small"
                @click="voidWeeklyPayment(item)"
                prepend-icon="mdi-cancel"
              >
                Void
              </v-btn>
              <v-btn
                v-if="item.status === 'paid'"
                color="warning"
                variant="outlined"
                size="small"
                @click="undoWeeklyPayment(item)"
                prepend-icon="mdi-undo"
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

// Use the payments composable for undo functionality
const {
  lastPaymentAction,
  showUndoButton,
  undoLastPayment
} = usePayments();

// Weekly payment reports data
const weeklyPaymentReports = computed(() => getWeeklyPaymentEntries());

// Headers for weekly reports table
const weeklyReportHeaders = [
  { title: 'VA', key: 'va_email', sortable: true },
  { title: 'Week Period', key: 'week_period', sortable: true },
  { title: 'Sparks', key: 'sparks_count', sortable: true },
  { title: 'Amount', key: 'amount', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Use VA Status composable to get weekly payment entries
const { getWeeklyPaymentEntries } = useVAStatus();

// Computed properties for weekly statistics
const weeklyStats = computed(() => {
  const reports = weeklyPaymentReports.value;

  const pendingReports = reports.filter(r => r.status === 'pending');
  const paidReports = reports.filter(r => r.status === 'paid');

  return {
    pendingAmount: `$${pendingReports.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}`,
    paidAmount: `$${paidReports.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}`,
    totalReports: reports.length,
    totalSparks: reports.reduce((sum, r) => sum + r.sparks_count, 0)
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
    // TODO: Implement API call to mark weekly payment as paid
    payment.status = 'paid';
    payment.paid_at = new Date().toISOString();
  } catch (error) {
    console.error('Failed to mark weekly payment as paid:', error);
  }
};

const voidWeeklyPayment = async (payment) => {
  try {
    console.log('Voiding weekly payment:', payment);
    // TODO: Implement API call to void weekly payment
    payment.status = 'voided';
    payment.voided_at = new Date().toISOString();
  } catch (error) {
    console.error('Failed to void weekly payment:', error);
  }
};

const undoWeeklyPayment = async (payment) => {
  try {
    console.log('Undoing weekly payment:', payment);
    // TODO: Implement API call to undo weekly payment
    payment.status = 'pending';
    delete payment.paid_at;
    delete payment.voided_at;
  } catch (error) {
    console.error('Failed to undo weekly payment:', error);
  }
};

// No data loading needed - weekly reports are computed on-demand
</script>

<style scoped>
.payments-tab {
  /* Add your custom styles here */
}
</style>