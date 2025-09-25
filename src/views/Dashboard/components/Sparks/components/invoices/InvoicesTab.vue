<template>
  <div>
    <!-- Invoice Actions Bar -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="3">
            <v-select
              :model-value="invoiceStatusFilter"
              @update:model-value="$emit('update:invoiceStatusFilter', $event)"
              :items="invoiceStatusOptions"
              label="Status"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              :model-value="invoiceCreatorFilter"
              @update:model-value="$emit('update:invoiceCreatorFilter', $event)"
              :items="invoiceCreatorOptions"
              label="Creator"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              :model-value="invoiceDateFrom"
              @update:model-value="$emit('update:invoiceDateFrom', $event)"
              label="From Date"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="2">
            <v-text-field
              :model-value="invoiceDateTo"
              @update:model-value="$emit('update:invoiceDateTo', $event)"
              label="To Date"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="auto">
            <v-btn
              color="primary"
              variant="elevated"
              @click="openInvoiceGeneratorLocal"
              prepend-icon="mdi-file-document-plus"
            >
              Create Invoice
            </v-btn>
          </v-col>
          <v-col cols="auto">
            <v-btn
              color="secondary"
              variant="tonal"
              @click="openInvoiceSettings"
              prepend-icon="mdi-cog"
            >
              Settings
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Invoice Statistics -->
    <v-row class="mb-4">
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-primary mb-2">{{ totalInvoices }}</h3>
            <p class="text-body-2 text-grey">Total Invoices</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-success mb-2">${{ totalInvoiced }}</h3>
            <p class="text-body-2 text-grey">Total Invoiced</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-warning mb-2">{{ pendingInvoices }}</h3>
            <p class="text-body-2 text-grey">Pending</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="3">
        <v-card>
          <v-card-text class="text-center">
            <h3 class="text-h4 text-info mb-2">${{ paidInvoices }}</h3>
            <p class="text-body-2 text-grey">Paid</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Invoices List -->
    <v-card>
      <v-card-title>
        Invoices
        <v-spacer />
        <v-btn
          variant="text"
          color="primary"
          @click="refreshInvoices"
          prepend-icon="mdi-refresh"
        >
          Refresh
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-data-table
          :headers="invoiceHeaders"
          :items="invoices"
          :loading="isLoadingInvoices"
          items-per-page="10"
          class="elevation-0"
        >
          <!-- Invoice Number Column -->
          <template v-slot:item.invoice_number="{ item }">
            <span class="font-weight-medium">{{ item.invoice_number }}</span>
          </template>

          <!-- Status Column -->
          <template v-slot:item.status="{ item }">
            <v-chip
              :color="getInvoiceStatusColor(item.status)"
              size="small"
              variant="tonal"
            >
              {{ item.status }}
            </v-chip>
          </template>

          <!-- Date Column -->
          <template v-slot:item.invoice_date="{ item }">
            {{ formatDate(item.invoice_date) }}
          </template>

          <!-- Amount Column -->
          <template v-slot:item.total_amount="{ item }">
            <span class="font-weight-medium">${{ item.total_amount.toFixed(2) }}</span>
          </template>

          <!-- Actions Column -->
          <template v-slot:item.actions="{ item }">
            <v-btn
              icon="mdi-eye"
              size="small"
              variant="text"
              @click="viewInvoice(item)"
              title="View Invoice"
            />
            <v-btn
              icon="mdi-download"
              size="small"
              variant="text"
              @click="downloadInvoiceLocal(item)"
              title="Download PDF"
            />
            <v-btn
              v-if="item.status === 'pending'"
              icon="mdi-check"
              size="small"
              variant="text"
              color="success"
              @click="markInvoicePaidLocal(item)"
              title="Mark as Paid"
            />
            <v-btn
              v-if="item.status === 'pending'"
              icon="mdi-pencil"
              size="small"
              variant="text"
              @click="editInvoiceLocal(item)"
              title="Edit Invoice"
            />
            <v-btn
              v-if="item.status !== 'voided'"
              icon="mdi-close"
              size="small"
              variant="text"
              color="error"
              @click="voidInvoiceLocal(item)"
              title="Void Invoice"
            />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { useInvoices } from './composables/useInvoices';
import { useSparkUtils } from '../sparks/composables/useSparkUtils';
import { usePayments } from '../payments/composables/usePayments';
import { useSparks } from '../sparks/composables/useSparks';
import { useAuth } from '@/composables/useAuth';

// Get auth state for creators data
const { user } = useAuth();

// Use composables directly
const {
  invoices,
  isLoadingInvoices,
  invoiceStatusFilter,
  invoiceCreatorFilter,
  invoiceDateFrom,
  invoiceDateTo,
  invoiceStatusOptions,
  invoiceCreatorOptions,
  filteredInvoices,
  totalInvoices,
  totalInvoiced,
  pendingInvoices,
  paidInvoices,
  loadInvoices,
  markInvoicePaid,
  openInvoiceGenerator,
  viewInvoice,
  downloadInvoiceWithPDF,
  editInvoice,
  voidInvoiceWithConfirmation
} = useInvoices();

const { sparks } = useSparks();
const { defaultRate, defaultCommissionRate, defaultCommissionType } = usePayments();
const { showWarning, showSuccess, showError, showInfo } = useSparkUtils();

// Props are no longer needed since we're using composables directly
const props = defineProps({});

// Define invoice headers locally
const invoiceHeaders = [
  { title: 'Invoice #', key: 'invoice_number', sortable: true },
  { title: 'Creator', key: 'creator_name', sortable: true },
  { title: 'Date', key: 'invoice_date', sortable: true },
  { title: 'Due Date', key: 'due_date', sortable: true },
  { title: 'Amount', key: 'total_amount', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Only emit filter updates to parent if needed for synchronization
const emit = defineEmits([
  'update:invoiceStatusFilter',
  'update:invoiceCreatorFilter',
  'update:invoiceDateFrom',
  'update:invoiceDateTo'
]);

// Local functions that call composable functions directly
const openInvoiceGeneratorLocal = async () => {
  // Create mock creators array - this should ideally come from a separate composable
  const creators = [];
  await openInvoiceGenerator(sparks.value, defaultRate.value, defaultCommissionRate.value, defaultCommissionType.value, creators, showWarning, showSuccess, showError);
};

const refreshInvoices = async () => {
  await loadInvoices();
};

const openInvoiceSettings = () => {
  showInfo('Invoice settings will be available soon');
};

const downloadInvoiceLocal = async (invoice) => {
  await downloadInvoiceWithPDF(invoice, showSuccess, showError);
};

const markInvoicePaidLocal = async (invoice) => {
  await markInvoicePaid(invoice.id, {});
};

const editInvoiceLocal = (invoice) => {
  editInvoice(invoice, showInfo);
};

const voidInvoiceLocal = async (invoice) => {
  await voidInvoiceWithConfirmation(invoice);
};

// Utility functions
const getInvoiceStatusColor = (status) => {
  switch (status) {
    case 'paid': return 'success';
    case 'pending': return 'warning';
    case 'overdue': return 'error';
    case 'voided': return 'grey';
    default: return 'grey';
  }
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};
</script>