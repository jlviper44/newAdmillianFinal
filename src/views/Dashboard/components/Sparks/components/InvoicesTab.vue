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
              @click="openInvoiceGenerator"
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
              @click="downloadInvoice(item)"
              title="Download PDF"
            />
            <v-btn
              v-if="item.status === 'pending'"
              icon="mdi-check"
              size="small"
              variant="text"
              color="success"
              @click="markInvoicePaid(item)"
              title="Mark as Paid"
            />
            <v-btn
              v-if="item.status === 'pending'"
              icon="mdi-pencil"
              size="small"
              variant="text"
              @click="editInvoice(item)"
              title="Edit Invoice"
            />
            <v-btn
              v-if="item.status !== 'voided'"
              icon="mdi-close"
              size="small"
              variant="text"
              color="error"
              @click="voidInvoice(item)"
              title="Void Invoice"
            />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  invoiceStatusFilter: String,
  invoiceCreatorFilter: String,
  invoiceDateFrom: String,
  invoiceDateTo: String,
  invoiceStatusOptions: Array,
  invoiceCreatorOptions: Array,
  totalInvoices: Number,
  totalInvoiced: [Number, String],
  pendingInvoices: Number,
  paidInvoices: [Number, String],
  invoiceHeaders: Array,
  invoices: Array,
  isLoadingInvoices: Boolean
});

const emit = defineEmits([
  'update:invoiceStatusFilter',
  'update:invoiceCreatorFilter',
  'update:invoiceDateFrom',
  'update:invoiceDateTo',
  'openInvoiceGenerator',
  'openInvoiceSettings',
  'refreshInvoices',
  'viewInvoice',
  'downloadInvoice',
  'markInvoicePaid',
  'editInvoice',
  'voidInvoice'
]);

const openInvoiceGenerator = () => emit('openInvoiceGenerator');
const openInvoiceSettings = () => emit('openInvoiceSettings');
const refreshInvoices = () => emit('refreshInvoices');
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
const viewInvoice = (item) => emit('viewInvoice', item);
const downloadInvoice = (item) => emit('downloadInvoice', item);
const markInvoicePaid = (item) => emit('markInvoicePaid', item);
const editInvoice = (item) => emit('editInvoice', item);
const voidInvoice = (item) => emit('voidInvoice', item);
</script>