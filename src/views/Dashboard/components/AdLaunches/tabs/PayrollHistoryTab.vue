<template>
  <div>
    <v-card>
      <v-card-text>
        <!-- Filters -->
        <v-row align="center" class="mb-4">
          <v-col cols="12" md="3">
            <v-select
              v-model="filterVA"
              label="Filter by VA"
              :items="['All', ...vaList.map(v => v.email)]"
              clearable
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="filterStatus"
              label="Filter by Status"
              :items="['All', 'Pending', 'Paid', 'Voided']"
              clearable
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="dateFrom"
              label="From Date"
              type="date"
              clearable
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-text-field
              v-model="dateTo"
              label="To Date"
              type="date"
              clearable
            />
          </v-col>
        </v-row>

        <!-- Summary Cards -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-overline">Total Invoices</div>
                <div class="text-h4">{{ filteredHistory.length }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-overline">Pending Amount</div>
                <div class="text-h4 text-orange">${{ pendingAmount.toFixed(2) }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-overline">Paid Amount</div>
                <div class="text-h4 text-green">${{ paidAmount.toFixed(2) }}</div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="3">
            <v-card variant="outlined">
              <v-card-text class="text-center">
                <div class="text-overline">Total Amount</div>
                <div class="text-h4">${{ totalAmount.toFixed(2) }}</div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <!-- History Table -->
        <v-data-table
          :headers="historyHeaders"
          :items="filteredHistory"
          :sort-by="[{ key: 'createdAt', order: 'desc' }]"
          class="elevation-1"
        >
          <template v-slot:item.period="{ item }">
            {{ formatDate(item.periodStart) }} - {{ formatDate(item.periodEnd) }}
          </template>

          <template v-slot:item.totalHours="{ item }">
            <div v-if="editingCell === `${item.id}-totalHours`" @click.stop>
              <v-text-field
                :id="`${item.id}-totalHours`"
                v-model.number="item.totalHours"
                type="number"
                density="compact"
                hide-details
                variant="underlined"
                @blur="saveInlineEdit(item)"
                @keyup.enter="saveInlineEdit(item)"
                @keyup.esc="cancelInlineEdit()"
              />
            </div>
            <div v-else @dblclick="startInlineEdit(item, 'totalHours')" :class="{ 'editable-cell': item.status === 'unpaid' }">
              {{ (item.totalHours || 0).toFixed(2) }}
            </div>
          </template>

          <template v-slot:item.hourlyRate="{ item }">
            <div v-if="editingCell === `${item.id}-hourlyRate`" @click.stop>
              <v-text-field
                :id="`${item.id}-hourlyRate`"
                v-model.number="item.hourlyRate"
                type="number"
                density="compact"
                hide-details
                variant="underlined"
                prefix="$"
                @blur="saveInlineEdit(item)"
                @keyup.enter="saveInlineEdit(item)"
                @keyup.esc="cancelInlineEdit()"
              />
            </div>
            <div v-else @dblclick="startInlineEdit(item, 'hourlyRate')" :class="{ 'editable-cell': item.status === 'unpaid' }">
              ${{ (item.hourlyRate || 0).toFixed(2) }}
            </div>
          </template>

          <template v-slot:item.totalRealSpend="{ item }">
            <div v-if="editingCell === `${item.id}-totalRealSpend`" @click.stop>
              <v-text-field
                :id="`${item.id}-totalRealSpend`"
                v-model.number="item.totalRealSpend"
                type="number"
                density="compact"
                hide-details
                variant="underlined"
                prefix="$"
                @blur="saveInlineEdit(item)"
                @keyup.enter="saveInlineEdit(item)"
                @keyup.esc="cancelInlineEdit()"
              />
            </div>
            <div v-else @dblclick="startInlineEdit(item, 'totalRealSpend')" :class="{ 'editable-cell': item.status === 'unpaid' }">
              ${{ (item.totalRealSpend || 0).toFixed(2) }}
            </div>
          </template>

          <template v-slot:item.status="{ item }">
            <div v-if="editingCell === `${item.id}-status`" @click.stop>
              <v-select
                :id="`${item.id}-status`"
                v-model="item.status"
                :items="['unpaid', 'paid', 'voided']"
                density="compact"
                hide-details
                variant="underlined"
                @update:model-value="saveInlineEdit(item)"
              />
            </div>
            <v-chip
              v-else
              :color="getStatusColor(item.status)"
              size="small"
              variant="flat"
              @dblclick="startInlineEdit(item, 'status')"
              :class="{ 'editable-chip': true }"
            >
              {{ item.status }}
            </v-chip>
          </template>
          
          <template v-slot:item.totalPay="{ item }">
            <div class="font-weight-bold">
              ${{ (item.totalPay || 0).toFixed(2) }}
            </div>
          </template>
          
          <template v-slot:item.actions="{ item }">
            <v-btn
              icon="mdi-eye"
              size="small"
              variant="text"
              @click="viewInvoice(item)"
              title="View Details"
            />
            <v-btn
              v-if="item.status === 'Pending'"
              icon="mdi-pencil"
              size="small"
              variant="text"
              @click="editInvoice(item)"
              title="Edit Invoice"
            />
            <v-btn
              v-if="item.status === 'Pending'"
              icon="mdi-check"
              size="small"
              variant="text"
              @click="markAsPaid(item)"
              color="green"
              title="Mark as Paid"
            />
            <v-btn
              v-if="item.status !== 'Voided'"
              icon="mdi-cancel"
              size="small"
              variant="text"
              @click="voidInvoice(item)"
              color="red"
              title="Void Invoice"
            />
            <v-btn
              v-if="item.status === 'Voided'"
              icon="mdi-restore"
              size="small"
              variant="text"
              @click="restoreInvoice(item)"
              color="blue"
              title="Restore Invoice"
            />
            <v-btn
              icon="mdi-download"
              size="small"
              variant="text"
              @click="exportInvoice(item)"
              title="Export PDF"
            />
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>

    <!-- View Invoice Dialog -->
    <v-dialog v-model="viewDialog" max-width="800">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          Invoice Details
          <v-btn icon="mdi-close" size="small" variant="text" @click="viewDialog = false" />
        </v-card-title>
        <v-card-text v-if="selectedInvoice">
          <v-row>
            <v-col cols="12" md="6">
              <div><strong>Invoice ID:</strong> #{{ selectedInvoice.id }}</div>
              <div><strong>VA:</strong> {{ selectedInvoice.va }}</div>
              <div><strong>Period:</strong> {{ formatDate(selectedInvoice.periodStart) }} - {{ formatDate(selectedInvoice.periodEnd) }}</div>
              <div><strong>Status:</strong> 
                <v-chip :color="getStatusColor(selectedInvoice.status)" size="small">
                  {{ selectedInvoice.status }}
                </v-chip>
              </div>
            </v-col>
            <v-col cols="12" md="6">
              <div><strong>Created:</strong> {{ formatDateTime(selectedInvoice.createdAt) }}</div>
              <div><strong>Payment Date:</strong> {{ selectedInvoice.paymentDate ? formatDate(selectedInvoice.paymentDate) : 'Not paid' }}</div>
              <div><strong>Payment Method:</strong> {{ selectedInvoice.paymentMethod || 'N/A' }}</div>
            </v-col>
          </v-row>
          
          <v-divider class="my-4" />
          
          <v-table density="compact">
            <tbody>
              <tr>
                <td>Hours Worked:</td>
                <td class="text-right">{{ selectedInvoice.totalHours?.toFixed(2) || 0 }} hrs</td>
              </tr>
              <tr>
                <td>Hourly Rate:</td>
                <td class="text-right">${{ selectedInvoice.hourlyRate?.toFixed(2) || 0 }}/hr</td>
              </tr>
              <tr>
                <td>Base Pay:</td>
                <td class="text-right">${{ selectedInvoice.hourlyPay?.toFixed(2) || 0 }}</td>
              </tr>
              <tr>
                <td>Ad Spend:</td>
                <td class="text-right">${{ selectedInvoice.totalRealSpend?.toFixed(2) || 0 }}</td>
              </tr>
              <tr>
                <td>Commission Rate:</td>
                <td class="text-right">{{ (selectedInvoice.commissionRate * 100 || 0).toFixed(0) }}%</td>
              </tr>
              <tr>
                <td>Commission:</td>
                <td class="text-right">${{ selectedInvoice.commissionPay?.toFixed(2) || 0 }}</td>
              </tr>
              <tr v-if="selectedInvoice.bonusAmount">
                <td>Bonus:</td>
                <td class="text-right">${{ selectedInvoice.bonusAmount?.toFixed(2) || 0 }}</td>
              </tr>
              <tr class="font-weight-bold">
                <td>Total:</td>
                <td class="text-right text-h6">${{ selectedInvoice.totalPay?.toFixed(2) || 0 }}</td>
              </tr>
            </tbody>
          </v-table>
          
          <div v-if="selectedInvoice.notes" class="mt-4">
            <strong>Notes:</strong>
            <div class="mt-2">{{ selectedInvoice.notes }}</div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Edit Invoice Dialog -->
    <v-dialog v-model="editDialog" max-width="600">
      <v-card>
        <v-card-title>Edit Invoice</v-card-title>
        <v-card-text v-if="editingInvoice">
          <v-form>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="editingInvoice.totalHours"
                  label="Hours Worked"
                  type="number"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="editingInvoice.hourlyRate"
                  label="Hourly Rate"
                  type="number"
                  prefix="$"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="editingInvoice.totalRealSpend"
                  label="Ad Spend"
                  type="number"
                  prefix="$"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="editingInvoice.commissionRatePercent"
                  label="Commission Rate"
                  type="number"
                  suffix="%"
                  @update:model-value="editingInvoice.commissionRate = $event / 100"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="editingInvoice.bonusAmount"
                  label="Bonus"
                  type="number"
                  prefix="$"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="editingInvoice.paymentMethod"
                  label="Payment Method"
                  :items="['PayPal', 'Zelle', 'Venmo', 'Bank Transfer', 'Check', 'Other']"
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="editingInvoice.notes"
                  label="Notes"
                  rows="3"
                />
              </v-col>
            </v-row>
          </v-form>
          <div class="mt-4">
            <strong>Calculated Total: ${{ calculateEditTotal() }}</strong>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="editDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveEditedInvoice">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Mark as Paid Dialog -->
    <v-dialog v-model="paidDialog" max-width="400">
      <v-card>
        <v-card-title>Mark Invoice as Paid</v-card-title>
        <v-card-text>
          <v-form>
            <v-text-field
              v-model="paymentData.payment_date"
              label="Payment Date"
              type="date"
            />
            <v-select
              v-model="paymentData.payment_method"
              label="Payment Method"
              :items="['PayPal', 'Zelle', 'Venmo', 'Bank Transfer', 'Check', 'Other']"
            />
            <v-textarea
              v-model="paymentData.payment_notes"
              label="Payment Notes"
              rows="2"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="paidDialog = false">Cancel</v-btn>
          <v-btn color="green" @click="confirmMarkAsPaid">Mark as Paid</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import adLaunchesAPI from '@/services/adLaunchesAPI';
import jsPDF from 'jspdf';

// Emit
const emit = defineEmits(['show-message']);

// Data
const payrollHistory = ref([]);
const filterVA = ref('All');
const filterStatus = ref('All');
const dateFrom = ref('');
const dateTo = ref('');
const viewDialog = ref(false);
const editDialog = ref(false);
const paidDialog = ref(false);
const selectedInvoice = ref(null);
const editingInvoice = ref(null);
const editingCell = ref(null); // Track which cell is being edited
const paymentData = reactive({
  payment_date: new Date().toISOString().split('T')[0],
  payment_method: '',
  payment_notes: ''
});

const vaList = ref([
  { name: 'Tyler', email: 'tyler@example.com' },
  { name: 'Ryan', email: 'ryan@example.com' },
  { name: 'Other', email: 'other@example.com' }
]);

const historyHeaders = [
  { title: 'Invoice #', key: 'id', width: '120px' },
  { title: 'VA', key: 'va', width: '150px' },
  { title: 'Period', key: 'period', width: '180px' },
  { title: 'Hours', key: 'totalHours', width: '80px' },
  { title: 'Rate', key: 'hourlyRate', width: '80px' },
  { title: 'Ad Spend', key: 'totalRealSpend', width: '100px' },
  { title: 'Total', key: 'totalPay', width: '100px' },
  { title: 'Status', key: 'status', width: '90px' },
  { title: 'Actions', key: 'actions', sortable: false, width: '150px' }
];

// Computed
const filteredHistory = computed(() => {
  let filtered = payrollHistory.value;
  
  if (filterVA.value && filterVA.value !== 'All') {
    filtered = filtered.filter(h => h.va === filterVA.value);
  }
  
  if (filterStatus.value && filterStatus.value !== 'All') {
    filtered = filtered.filter(h => h.status === filterStatus.value);
  }
  
  if (dateFrom.value) {
    filtered = filtered.filter(h => h.start_date >= dateFrom.value);
  }
  
  if (dateTo.value) {
    filtered = filtered.filter(h => h.end_date <= dateTo.value);
  }
  
  return filtered;
});

const pendingAmount = computed(() => {
  return filteredHistory.value
    .filter(h => h.status === 'unpaid' || h.status === 'Unpaid' || h.status === 'pending' || h.status === 'Pending')
    .reduce((sum, h) => sum + (h.totalPay || h.total || 0), 0);
});

const paidAmount = computed(() => {
  return filteredHistory.value
    .filter(h => h.status === 'paid' || h.status === 'Paid')
    .reduce((sum, h) => sum + (h.totalPay || h.total || 0), 0);
});

const totalAmount = computed(() => {
  return filteredHistory.value
    .filter(h => h.status !== 'voided' && h.status !== 'Voided')
    .reduce((sum, h) => sum + (h.totalPay || h.total || 0), 0);
});

// Methods
const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatDateTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusColor = (status) => {
  // Handle both uppercase and lowercase statuses
  const lowerStatus = status?.toLowerCase();
  switch (lowerStatus) {
    case 'paid': 
      return 'green';
    case 'unpaid':
    case 'pending': 
      return 'orange';
    case 'voided': 
      return 'red';
    default: 
      return 'grey';
  }
};

const loadPayrollHistory = async () => {
  try {
    // Server-only - no localStorage
    const response = await adLaunchesAPI.getPayrollHistory();
    if (response && response.success) {
      payrollHistory.value = response.data || [];
    } else {
      // No data from server
      payrollHistory.value = [];
      if (response && response.offline) {
        emit('show-message', { text: 'Payroll history requires server connection', color: 'info' });
      }
    }
  } catch (error) {
    payrollHistory.value = [];
    emit('show-message', { text: 'Failed to load payroll history', color: 'error' });
  }
};

const viewInvoice = (invoice) => {
  selectedInvoice.value = invoice;
  viewDialog.value = true;
};

const editInvoice = (invoice) => {
  editingInvoice.value = { 
    ...invoice,
    // Convert commission rate from decimal to percentage for display
    commissionRatePercent: (invoice.commissionRate || 0) * 100
  };
  editDialog.value = true;
};

// Inline editing functions
const originalValue = ref(null);

const startInlineEdit = (item, field) => {
  // Allow editing status for any invoice, but other fields only for unpaid
  if (field !== 'status' && item.status !== 'unpaid') return;
  
  editingCell.value = `${item.id}-${field}`;
  originalValue.value = item[field];
  
  // Focus the input field after a short delay
  setTimeout(() => {
    const input = document.querySelector(`[id="${item.id}-${field}"] input`);
    if (input) input.focus();
  }, 100);
};

const saveInlineEdit = async (item) => {
  editingCell.value = null;
  
  // Prepare update data
  const updateData = {};
  
  // Handle status change
  if (originalValue.value !== item.status) {
    updateData.status = item.status;
    
    // If marking as paid, set payment date
    if (item.status === 'paid' && !item.paymentDate) {
      updateData.paymentDate = new Date().toISOString().split('T')[0];
      item.paymentDate = updateData.paymentDate;
    }
    
    // If voiding, clear payment info
    if (item.status === 'voided') {
      updateData.paymentDate = null;
      updateData.paymentMethod = null;
      item.paymentDate = null;
      item.paymentMethod = null;
    }
  }
  
  // Recalculate totals if numeric fields changed
  if (item.totalHours !== undefined && item.hourlyRate !== undefined) {
    item.hourlyPay = item.totalHours * item.hourlyRate;
    updateData.totalHours = item.totalHours;
    updateData.hourlyRate = item.hourlyRate;
  }
  
  if (item.totalRealSpend !== undefined && item.commissionRate !== undefined) {
    item.commissionPay = item.totalRealSpend * item.commissionRate;
    updateData.totalRealSpend = item.totalRealSpend;
    updateData.commissionRate = item.commissionRate;
  }
  
  // Recalculate total
  if (updateData.totalHours || updateData.hourlyRate || updateData.totalRealSpend) {
    item.totalPay = (item.hourlyPay || 0) + (item.commissionPay || 0) + (item.bonusAmount || 0);
  }
  
  // Save to backend
  try {
    console.log('Updating invoice:', item.id, 'with data:', updateData);
    const response = await adLaunchesAPI.updatePayrollInvoice(item.id, updateData);
    console.log('Update response:', response);
    
    if (response && response.success) {
      emit('show-message', { text: 'Invoice updated successfully', color: 'success' });
      // Reload to get the updated data from server
      await loadPayrollHistory();
    } else {
      const errorMsg = response?.error || 'Failed to update invoice';
      console.error('Update failed:', errorMsg);
      emit('show-message', { text: errorMsg, color: 'error' });
      await loadPayrollHistory();
    }
  } catch (error) {
    console.error('Update error:', error);
    emit('show-message', { text: 'Failed to update invoice', color: 'error' });
    await loadPayrollHistory();
  }
};

const cancelInlineEdit = () => {
  editingCell.value = null;
  // Revert the value
  loadPayrollHistory();
};

const calculateEditTotal = () => {
  if (!editingInvoice.value) return 0;
  
  const basePay = (editingInvoice.value.totalHours || 0) * (editingInvoice.value.hourlyRate || 0);
  const commission = (editingInvoice.value.totalRealSpend || 0) * (editingInvoice.value.commissionRate || 0);
  const bonus = editingInvoice.value.bonusAmount || 0;
  
  return (basePay + commission + bonus).toFixed(2);
};

const saveEditedInvoice = async () => {
  try {
    // Recalculate totals
    const basePay = editingInvoice.value.hours_worked * editingInvoice.value.hourly_rate;
    const commission = editingInvoice.value.ad_spend * (editingInvoice.value.commission_rate / 100);
    editingInvoice.value.base_pay = basePay;
    editingInvoice.value.commission = commission;
    editingInvoice.value.total = basePay + commission + (editingInvoice.value.bonus || 0);
    
    const response = await adLaunchesAPI.updatePayrollInvoice(editingInvoice.value.id, editingInvoice.value);
    if (response.success) {
      emit('show-message', { text: 'Invoice updated successfully', color: 'success' });
      editDialog.value = false;
      await loadPayrollHistory();
    }
  } catch (error) {
    emit('show-message', { text: 'Failed to update invoice', color: 'error' });
  }
};

const markAsPaid = (invoice) => {
  selectedInvoice.value = invoice;
  paidDialog.value = true;
};

const confirmMarkAsPaid = async () => {
  try {
    const response = await adLaunchesAPI.markInvoiceAsPaid(selectedInvoice.value.id, paymentData);
    if (response.success) {
      emit('show-message', { text: 'Invoice marked as paid', color: 'success' });
      paidDialog.value = false;
      await loadPayrollHistory();
    }
  } catch (error) {
    emit('show-message', { text: 'Failed to mark invoice as paid', color: 'error' });
  }
};

const voidInvoice = async (invoice) => {
  if (!confirm('Are you sure you want to void this invoice?')) return;
  
  try {
    const response = await adLaunchesAPI.voidInvoice(invoice.id);
    if (response.success) {
      emit('show-message', { text: 'Invoice voided', color: 'success' });
      await loadPayrollHistory();
    }
  } catch (error) {
    emit('show-message', { text: 'Failed to void invoice', color: 'error' });
  }
};

const restoreInvoice = async (invoice) => {
  try {
    const response = await adLaunchesAPI.restoreInvoice(invoice.id);
    if (response.success) {
      emit('show-message', { text: 'Invoice restored', color: 'success' });
      await loadPayrollHistory();
    }
  } catch (error) {
    emit('show-message', { text: 'Failed to restore invoice', color: 'error' });
  }
};

const exportInvoice = (invoice) => {
  try {
    // Create PDF document
    const doc = new jsPDF();
    
    // Set font sizes
    const titleSize = 20;
    const headerSize = 14;
    const normalSize = 11;
    const smallSize = 9;
    
    // Colors
    doc.setTextColor(0, 0, 0);
    
    // Title
    doc.setFontSize(titleSize);
    doc.text('PAYROLL INVOICE', 105, 20, { align: 'center' });
    
    // Invoice details
    doc.setFontSize(normalSize);
    doc.text(`Invoice #: ${invoice.id}`, 20, 40);
    doc.text(`Date: ${formatDate(invoice.createdAt)}`, 20, 47);
    doc.text(`Period: ${formatDate(invoice.periodStart)} - ${formatDate(invoice.periodEnd)}`, 20, 54);
    
    // Status
    doc.setFontSize(smallSize);
    const statusColor = invoice.status === 'paid' ? [0, 128, 0] : 
                       invoice.status === 'voided' ? [255, 0, 0] : [255, 165, 0];
    doc.setTextColor(...statusColor);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 20, 61);
    doc.setTextColor(0, 0, 0);
    
    // VA Info
    doc.setFontSize(headerSize);
    doc.text('Virtual Assistant:', 20, 80);
    doc.setFontSize(normalSize);
    doc.text(invoice.va, 20, 88);
    
    // Payroll Details Header
    let yPos = 110;
    doc.setFontSize(headerSize);
    doc.text('Payroll Details', 20, yPos);
    
    // Draw line
    doc.setLineWidth(0.5);
    doc.line(20, yPos + 3, 190, yPos + 3);
    
    // Table headers
    yPos += 10;
    doc.setFontSize(smallSize);
    doc.setFillColor(240, 240, 240);
    doc.rect(20, yPos - 4, 170, 7, 'F');
    doc.text('Description', 25, yPos);
    doc.text('Amount', 160, yPos, { align: 'right' });
    
    // Line items
    yPos += 10;
    doc.setFontSize(normalSize);
    
    // Hours worked
    doc.text('Hours Worked', 25, yPos);
    doc.text(`${(invoice.totalHours || 0).toFixed(2)} hrs`, 160, yPos, { align: 'right' });
    
    // Hourly rate
    yPos += 8;
    doc.text('Hourly Rate', 25, yPos);
    doc.text(`$${(invoice.hourlyRate || 0).toFixed(2)}/hr`, 160, yPos, { align: 'right' });
    
    // Base pay
    yPos += 8;
    doc.setFont(undefined, 'bold');
    doc.text('Base Pay', 25, yPos);
    doc.text(`$${(invoice.hourlyPay || 0).toFixed(2)}`, 160, yPos, { align: 'right' });
    doc.setFont(undefined, 'normal');
    
    // Ad spend
    if (invoice.totalRealSpend > 0) {
      yPos += 8;
      doc.text('Ad Spend', 25, yPos);
      doc.text(`$${(invoice.totalRealSpend || 0).toFixed(2)}`, 160, yPos, { align: 'right' });
      
      // Commission
      yPos += 8;
      doc.text(`Commission (${((invoice.commissionRate || 0) * 100).toFixed(0)}%)`, 25, yPos);
      doc.text(`$${(invoice.commissionPay || 0).toFixed(2)}`, 160, yPos, { align: 'right' });
    }
    
    // Bonus
    if (invoice.bonusAmount > 0) {
      yPos += 8;
      doc.text(`Bonus${invoice.bonusReason ? `: ${invoice.bonusReason}` : ''}`, 25, yPos);
      doc.text(`$${(invoice.bonusAmount || 0).toFixed(2)}`, 160, yPos, { align: 'right' });
    }
    
    // Draw line before total
    yPos += 5;
    doc.setLineWidth(0.5);
    doc.line(20, yPos, 190, yPos);
    
    // Total
    yPos += 8;
    doc.setFontSize(headerSize);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL', 25, yPos);
    doc.text(`$${(invoice.totalPay || 0).toFixed(2)}`, 160, yPos, { align: 'right' });
    doc.setFont(undefined, 'normal');
    
    // Payment info if paid
    if (invoice.status === 'paid' && invoice.paymentDate) {
      yPos += 15;
      doc.setFontSize(normalSize);
      doc.text('Payment Information:', 20, yPos);
      yPos += 8;
      doc.setFontSize(smallSize);
      doc.text(`Payment Date: ${formatDate(invoice.paymentDate)}`, 25, yPos);
      if (invoice.paymentMethod) {
        yPos += 6;
        doc.text(`Payment Method: ${invoice.paymentMethod}`, 25, yPos);
      }
    }
    
    // Notes
    if (invoice.notes) {
      yPos += 15;
      doc.setFontSize(normalSize);
      doc.text('Notes:', 20, yPos);
      yPos += 8;
      doc.setFontSize(smallSize);
      const lines = doc.splitTextToSize(invoice.notes, 170);
      lines.forEach(line => {
        doc.text(line, 25, yPos);
        yPos += 6;
      });
    }
    
    // Footer
    doc.setFontSize(smallSize);
    doc.setTextColor(128, 128, 128);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 280, { align: 'center' });
    
    // Save the PDF
    doc.save(`payroll-invoice-${invoice.id}-${invoice.va.replace(/[@.]/g, '_')}.pdf`);
    
    emit('show-message', { text: 'Invoice downloaded successfully', color: 'success' });
  } catch (error) {
    console.error('Error generating PDF:', error);
    emit('show-message', { text: 'Failed to generate PDF', color: 'error' });
  }
};

// Lifecycle
onMounted(() => {
  loadPayrollHistory();
});
</script>

<style scoped>
.editable-cell {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.editable-cell:hover {
  background-color: rgba(0, 0, 0, 0.04);
  outline: 1px dashed rgba(0, 0, 0, 0.2);
}

.editable-chip {
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.editable-chip:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.font-weight-bold {
  font-weight: 600;
}
</style>