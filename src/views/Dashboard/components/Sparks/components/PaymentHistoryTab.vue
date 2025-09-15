<template>
  <div>
    <!-- Date Range Filter -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="3">
            <v-text-field
              :model-value="historyDateFrom"
              @update:model-value="$emit('update:historyDateFrom', $event)"
              label="From Date"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              :model-value="historyDateTo"
              @update:model-value="$emit('update:historyDateTo', $event)"
              label="To Date"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              :model-value="historyCreatorFilter"
              @update:model-value="$emit('update:historyCreatorFilter', $event)"
              :items="historyCreatorOptions"
              label="Creator"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="auto">
            <v-btn
              color="primary"
              variant="tonal"
              @click="filterPaymentHistory"
              prepend-icon="mdi-filter"
            >
              Apply Filter
            </v-btn>
          </v-col>
          <v-col cols="auto">
            <v-btn
              variant="text"
              @click="clearHistoryFilters"
              prepend-icon="mdi-filter-remove"
            >
              Clear
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Payment History Summary -->
    <v-row class="mb-4">
      <v-col cols="12" md="4">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-success mb-2">${{ totalPaidInPeriod }}</h3>
            <p class="text-body-2 text-grey">Total Paid in Period</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-info mb-2">{{ totalPayments }}</h3>
            <p class="text-body-2 text-grey">Total Payments</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-primary mb-2">{{ totalVideosPaid }}</h3>
            <p class="text-body-2 text-grey">Videos Paid</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Payment History Table -->
    <v-card>
      <v-card-title>
        Payment Records
        <v-spacer />
        <v-btn
          variant="tonal"
          color="primary"
          @click="exportPaymentHistory"
          prepend-icon="mdi-download"
          size="small"
        >
          Export History
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="paymentHistoryHeaders"
          :items="paymentHistory"
          :items-per-page="itemsPerPage"
          :loading="isLoadingHistory"
          class="elevation-0"
        >
          <!-- Payment Date Column -->
          <template v-slot:item.paymentDate="{ item }">
            {{ formatDate(item.paymentDate) }}
          </template>

          <!-- Creator Column with Avatar -->
          <template v-slot:item.creator="{ item }">
            <div class="d-flex align-center">
              <v-avatar size="28" color="primary" class="mr-2">
                <span class="text-caption">{{ item.creator.charAt(0) }}</span>
              </v-avatar>
              {{ item.creator }}
            </div>
          </template>

          <!-- Amount Column -->
          <template v-slot:item.amount="{ item }">
            <span class="text-success font-weight-medium">${{ item.amount }}</span>
          </template>

          <!-- Status Column -->
          <template v-slot:item.status="{ item }">
            <v-chip
              :color="item.status === 'paid' ? 'success' : 'warning'"
              size="small"
              variant="flat"
            >
              {{ item.status }}
            </v-chip>
          </template>

          <!-- Details Column -->
          <template v-slot:item.details="{ item }">
            <v-btn
              icon
              variant="text"
              size="small"
              @click="showPaymentDetails(item)"
            >
              <v-icon>mdi-information-outline</v-icon>
            </v-btn>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  historyDateFrom: String,
  historyDateTo: String,
  historyCreatorFilter: String,
  historyCreatorOptions: Array,
  totalPaidInPeriod: [Number, String],
  totalPayments: Number,
  totalVideosPaid: Number,
  paymentHistoryHeaders: Array,
  paymentHistory: Array,
  itemsPerPage: Number,
  isLoadingHistory: Boolean
});

const emit = defineEmits([
  'update:historyDateFrom',
  'update:historyDateTo',
  'update:historyCreatorFilter',
  'filterPaymentHistory',
  'clearHistoryFilters',
  'exportPaymentHistory',
  'showPaymentDetails'
]);

const filterPaymentHistory = () => emit('filterPaymentHistory');
const clearHistoryFilters = () => emit('clearHistoryFilters');
const exportPaymentHistory = () => emit('exportPaymentHistory');
const showPaymentDetails = (item) => emit('showPaymentDetails', item);
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};
</script>