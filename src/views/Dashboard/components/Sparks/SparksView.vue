<template>
  <v-container fluid class="sparks-container">
    <!-- Tab Navigation -->
    <v-tabs v-model="activeTab" class="mb-4">
      <v-tab value="sparks">Sparks</v-tab>
      <v-tab v-if="!isAssistingUser" value="payments">Payments</v-tab>
      <v-tab v-if="!isAssistingUser" value="history">Payment History</v-tab>
      <v-tab v-if="!isAssistingUser" value="invoices">Invoices</v-tab>
    </v-tabs>

    <!-- Tab Content -->
    <v-window v-model="activeTab">
      <v-window-item value="sparks">
        <SparksTab />
      </v-window-item>

      <!-- Payments Tab Content -->
      <v-window-item value="payments">
        <PaymentsTab
          v-model:show-undo-button="showUndoButton"
          :last-payment-action="lastPaymentAction"
          :total-owed="totalOwed"
          :total-paid="totalPaid"
          :unpaid-sparks="unpaidSparks"
          :active-creators="activeCreators"
          v-model:default-rate="defaultRate"
          v-model:default-commission-rate="defaultCommissionRate"
          v-model:default-commission-type="defaultCommissionType"
          :is-saving-settings="isSavingSettings"
          :creators="creators"
          :payments-by-creator="paymentsByCreator"
          @undo-last-payment="undoLastPaymentLocal"
          @save-payment-settings="savePaymentSettings"
          @mark-creator-paid="markCreatorPaid"
        />
      </v-window-item>

      <!-- Payment History Tab Content -->
      <v-window-item value="history">
        <PaymentHistoryTab
          v-model:history-date-from="historyDateFrom"
          v-model:history-date-to="historyDateTo"
          v-model:history-creator-filter="historyCreatorFilter"
          :history-creator-options="historyCreatorOptions"
          :total-paid-in-period="totalPaidInPeriod"
          :total-payments="totalPayments"
          :total-videos-paid="totalVideosPaid"
          :payment-history-headers="paymentHistoryHeaders"
          :payment-history="paymentHistory"
          :items-per-page="itemsPerPage"
          :is-loading-history="isLoadingHistory"
          @filter-payment-history="filterPaymentHistory"
          @clear-history-filters="clearHistoryFiltersLocal"
          @export-payment-history="exportPaymentHistory"
          @show-payment-details="showPaymentDetails"
        />
      </v-window-item>

      <!-- Invoices Tab Content -->
      <v-window-item value="invoices">
        <InvoicesTab />
      </v-window-item>
    </v-window>



    <!-- Payment Details Modal -->
    <v-dialog v-model="showPaymentDetailsModal" max-width="600">
      <v-card>
        <v-card-title>
          Payment Details
          <v-spacer />
          <v-btn icon variant="text" @click="showPaymentDetailsModal = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text v-if="selectedPayment">
          <v-list density="compact">
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Creator</v-list-item-title>
              <v-list-item-subtitle>{{ selectedPayment.creator }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Payment Date</v-list-item-title>
              <v-list-item-subtitle>{{ formatDate(selectedPayment.paymentDate) }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Amount</v-list-item-title>
              <v-list-item-subtitle>${{ selectedPayment.amount }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Number of Videos</v-list-item-title>
              <v-list-item-subtitle>{{ selectedPayment.videoCount }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Payment Method</v-list-item-title>
              <v-list-item-subtitle>{{ selectedPayment.paymentMethod || 'N/A' }}</v-list-item-subtitle>
            </v-list-item>
            <v-list-item>
              <v-list-item-title class="font-weight-medium">Notes</v-list-item-title>
              <v-list-item-subtitle>{{ selectedPayment.notes || 'No notes' }}</v-list-item-subtitle>
            </v-list-item>
          </v-list>
          
          <v-divider class="my-3"></v-divider>
          
          <div class="text-subtitle-2 mb-2">Videos Included:</div>
          <v-list density="compact">
            <v-list-item
              v-for="video in selectedPayment.videos"
              :key="video.id"
              class="pl-0"
            >
              <template v-slot:prepend>
                <v-icon size="small" color="grey">mdi-video</v-icon>
              </template>
              <v-list-item-title>{{ video.name }}</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip size="x-small" variant="flat">{{ video.spark_code }}</v-chip>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showPaymentDetailsModal = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Modals -->
    <BulkDeleteConfirmationModal
      v-model="showDeleteSelectedModal"
      :selected-count="selectedForDelete.length"
      :is-loading="isDeletingSelected"
      @confirm="confirmDeleteSelected"
    />

    <DeleteConfirmationModal
      v-model="showDeleteModal"
      :spark="sparkToDelete"
      :is-loading="deleteLoading"
      @confirm="confirmDelete"
    />

    <!-- Snackbar -->
    <v-snackbar v-model="showSnackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showSnackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { sparksApi, templatesApi, usersApi, commentBotApi } from '@/services/api';
import { useAuth } from '@/composables/useAuth';
import { useSparks } from './components/sparks/composables/useSparks';
import { usePayments } from './components/payments/composables/usePayments';
import { useSparkUtils } from './components/sparks/composables/useSparkUtils';
import { useBulkOperations } from './components/sparks/composables/useBulkOperations';

// Import tab components
import SparksTab from './components/sparks/SparksTab.vue';
import PaymentsTab from './components/payments/PaymentsTab.vue';
import PaymentHistoryTab from './components/payment-history/PaymentHistoryTab.vue';
import InvoicesTab from './components/invoices/InvoicesTab.vue';

// Import modal components
import DeleteConfirmationModal from './components/sparks/modals/DeleteConfirmationModal.vue';
import BulkDeleteConfirmationModal from './components/sparks/modals/BulkDeleteConfirmationModal.vue';

// Get auth state
const { user, isAssistingUser } = useAuth();

// Use composables
const {
  sparks,
  isLoading,
  searchQuery: sparksSearchQuery,
  typeFilter: sparksTypeFilter,
  statusFilter: sparksStatusFilter,
  creatorFilter: sparksCreatorFilter,
  showThumbnails: sparksShowThumbnails,
  filteredSparks,
  typeOptions,
  statusOptions,
  creatorOptions,
  typeItems,
  fetchSparks,
  createSpark,
  updateSpark,
  deleteSpark,
  bulkUpdateSparks,
  clearFilters: clearSparksFilters,
  detectDuplicates
} = useSparks();

const {
  defaultRate,
  defaultCommissionRate,
  defaultCommissionType,
  paymentSettingsLoaded,
  isSavingSettings,
  paymentHistory,
  isLoadingHistory,
  historyDateFrom,
  historyDateTo,
  historyCreatorFilter,
  historyCreatorOptions,
  filteredPaymentHistory,
  totalPaidInPeriod,
  totalPayments,
  totalVideosPaid,
  lastPaymentAction,
  showUndoButton,
  getPaymentsByCreator,
  getTotalOwed,
  getTotalPaid,
  getUnpaidSparks,
  getActiveCreators,
  loadPaymentSettings,
  savePaymentSettings,
  loadPaymentHistory,
  recordPayment,
  undoLastPayment,
  clearHistoryFilters
} = usePayments();


// Use utility composable (excluding color functions that have different logic)
const {
  snackbarText,
  snackbarColor,
  showSnackbar,
  copyCode: copyCodeUtil,
  formatDate,
  handleImageError: handleImageErrorUtil,
  getInvoiceStatusColor,
  exportToCSV: exportToCSVUtil,
  showSuccess,
  showError,
  showInfo,
  showWarning
} = useSparkUtils();

// Keep local color functions with different logic/mappings
const getTypeColor = (type) => {
  const lowerType = (type || 'Auto').toLowerCase();
  switch (lowerType) {
    case 'cpi':
      return 'blue';
    case 'sweeps':
      return 'purple';
    case 'cash':
      return 'green';
    case 'paypal':
      return 'orange';
    case 'auto':
      return 'indigo';
    case 'home':
      return 'teal';
    default:
      return 'grey';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'testing':
      return 'warning';
    case 'blocked':
      return 'error';
    default:
      return 'grey';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'testing':
      return 'Testing';
    case 'blocked':
      return 'Blocked';
    default:
      return status;
  }
};

const copyCode = (code) => {
  navigator.clipboard.writeText(code);
  showSuccess('Spark code copied to clipboard');
};

const handleImageError = (event) => {
  event.target.src = defaultThumbnail;
};


// Use bulk operations composable (only for inline editing and selection)
const {
  selectedForDelete,
  showDeleteSelectedModal,
  isDeletingSelected,
  editingCells,
  editingValues,
  menuStates,
  isEditing,
  startInlineEdit: startInlineEditBase,
  cancelInlineEdit,
  saveInlineEdit: saveInlineEditBase,
  deleteSelected,
  confirmDeleteSelected: confirmDeleteSelectedBase,
  removeDuplicates: removeDuplicatesBase
} = useBulkOperations();

// Wrapper functions to pass required parameters
const startInlineEdit = (item, field) => startInlineEditBase(item, field, sparks.value);
const saveInlineEdit = async (item, field) => {
  try {
    await saveInlineEditBase(item, field, updateSpark);
    showSuccess(`${field.replace('_', ' ')} updated successfully`);
    await fetchSparks();
  } catch (error) {
    showError('Failed to update field: ' + (error.message || 'Unknown error'));
  }
};
const confirmDeleteSelected = async () => {
  await confirmDeleteSelectedBase(
    deleteSpark,
    fetchSparks,
    cancelBulkEdit,
    showSuccess,
    showWarning,
    showError
  );
};
const removeDuplicates = async () => {
  await removeDuplicatesBase(
    sparks.value,
    deleteSpark,
    fetchSparks,
    showSuccess,
    showInfo,
    showError,
    isLoading
  );
};

// Tab state
const activeTab = ref('sparks');

// Watch for tab changes and prevent VAs from accessing payment tabs
watch(activeTab, (newTab) => {
  if (isAssistingUser.value && (newTab === 'payments' || newTab === 'history')) {
    activeTab.value = 'sparks';
    snackbarText.value = 'Payment features are not available in Virtual Assistant mode';
    snackbarColor.value = 'warning';
    showSnackbar.value = true;
  }
});

// Data state (non-composable)
const offerTemplates = ref([]);
const creators = ref([]);
const virtualAssistants = ref([]);

// Bulk edit mode state (kept local for special thumbnail handling)
const isBulkEditMode = ref(false);
const bulkEditValues = ref({});
const isSavingBulk = ref(false);

// Comment Bot bulk mode state
const isCommentBotMode = ref(false);
const isProcessingBot = ref(false);
const commentBotSettings = ref({
  comment_group_id: null,
  like_count: 0,
  save_count: 0
});
const selectedForBot = ref([]);

// Filter state - use sparksSearchQuery from composable with debounce mapping
const searchInput = ref('');

// Debounce timer
let searchDebounceTimer = null;

// Watch search input with debounce and map to sparksSearchQuery from composable
watch(searchInput, (newValue) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    sparksSearchQuery.value = newValue;
  }, 300); // 300ms debounce
});
// Note: typeFilter, statusFilter, creatorFilter are provided by useSparks composable

// Table configuration
const itemsPerPage = ref(200); // Default to 200 items per page for bulk editing
const currentPage = ref(1);
// Note: showThumbnails is provided by useSparks composable as sparksShowThumbnails


// Comment Bot state
const commentGroups = ref([]);
const hasCommentBotAccess = ref(false);
const userCredits = ref(0);
const showDeleteModal = ref(false);
const sparkToDelete = ref(null);
const deleteLoading = ref(false);


// Note: Payment state (defaultRate, defaultCommissionRate, defaultCommissionType, paymentSettingsLoaded, isSavingSettings) provided by usePayments composable

// Payment History state
// Note: paymentHistory, isLoadingHistory, historyDateFrom, historyDateTo, historyCreatorFilter, historyCreatorOptions provided by usePayments composable
const showPaymentDetailsModal = ref(false);
const selectedPayment = ref(null);

// Undo state
// Note: lastPaymentAction, showUndoButton provided by usePayments composable
const undoTimeoutId = ref(null);

// Note: Invoice state (invoices, isLoadingInvoices, invoiceStatusFilter, invoiceCreatorFilter, invoiceDateFrom, invoiceDateTo, invoiceStatusOptions, invoiceCreatorOptions) provided by useInvoices composable

// Payment History Headers
const paymentHistoryHeaders = ref([
  { title: 'Date', key: 'paymentDate', sortable: true },
  { title: 'Creator', key: 'creator', sortable: true },
  { title: 'Videos', key: 'videoCount', sortable: true },
  { title: 'Amount', key: 'amount', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Method', key: 'paymentMethod', sortable: true },
  { title: 'Details', key: 'details', sortable: false }
]);


// Base table headers
const baseHeaders = [
  { title: 'Date', key: 'created_at' },
  { title: 'Preview', key: 'thumbnail', sortable: false, width: '120px' },
  { title: 'TikTok Link', key: 'tiktok_link', sortable: false },
  { title: 'Content Type', key: 'content_type', sortable: true, width: '130px' },
  { title: 'Spark Code', key: 'spark_code' },
  { title: 'Status', key: 'status' },
  { title: 'Bot Status', key: 'bot_status', sortable: true, width: '120px', align: 'center' },
  { title: 'Offer', key: 'type' },
  { title: 'Creator', key: 'creator' },
  { title: 'Name', key: 'name' },
  { title: 'Actions', key: 'actions', sortable: false }
];

// Computed headers based on sparksShowThumbnails toggle and bulk edit mode
const headers = computed(() => {
  let headers = baseHeaders;

  // Hide thumbnail if toggle is off
  if (!sparksShowThumbnails.value) {
    headers = headers.filter(h => h.key !== 'thumbnail');
  }
  
  // Hide only Actions column in bulk edit mode (keep TikTok link editable)
  if (isBulkEditMode.value) {
    headers = headers.filter(h => h.key !== 'actions');
    // Adjust column widths in bulk edit mode
    headers = headers.map(h => {
      if (h.key === 'spark_code') {
        return { ...h, width: '200px' };
      }
      if (h.key === 'tiktok_link') {
        return { ...h, width: '250px' };
      }
      return h;
    });
  }
  
  return headers;
});

// Note: typeItems, typeOptions, statusOptions, creatorOptions are provided by useSparks composable

// Default thumbnail
const defaultThumbnail = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjRTBFMEUwIi8+CjxwYXRoIGQ9Ik0yNSAxOEwyOSAyNUwyNSAzMkwyMSAyNVoiIGZpbGw9IiM5RTlFOUUiLz4KPC9zdmc+';

// Computed property for duplicate detection
const duplicateInfo = computed(() => {
  const linkMap = new Map();
  const codeMap = new Map();
  const duplicateIds = new Set();
  const duplicateErrors = [];
  
  // Check for duplicates in all sparks
  sparks.value.forEach(spark => {
    // Check for duplicate TikTok links
    if (spark.tiktok_link) {
      if (linkMap.has(spark.tiktok_link)) {
        const existingIds = linkMap.get(spark.tiktok_link);
        existingIds.push(spark.id);
        // Mark all instances as duplicates
        existingIds.forEach(id => duplicateIds.add(id));
      } else {
        linkMap.set(spark.tiktok_link, [spark.id]);
      }
    }
    
    // Check for duplicate spark codes
    if (spark.spark_code) {
      if (codeMap.has(spark.spark_code)) {
        const existingIds = codeMap.get(spark.spark_code);
        existingIds.push(spark.id);
        // Mark all instances as duplicates
        existingIds.forEach(id => duplicateIds.add(id));
      } else {
        codeMap.set(spark.spark_code, [spark.id]);
      }
    }
  });
  
  // Generate error messages
  linkMap.forEach((ids, link) => {
    if (ids.length > 1) {
      duplicateErrors.push(`Duplicate TikTok link found: ${link} (${ids.length} occurrences)`);
    }
  });
  
  codeMap.forEach((ids, code) => {
    if (ids.length > 1) {
      duplicateErrors.push(`Duplicate spark code found: ${code} (${ids.length} occurrences)`);
    }
  });
  
  return {
    duplicateIds,
    duplicateErrors,
    linkDuplicates: linkMap,
    codeDuplicates: codeMap
  };
});

// Note: filteredSparks is provided by useSparks composable

// Computed property for payments grouped by creator
const paymentsByCreator = computed(() => {
  const creatorMap = new Map();

  // Group sparks by creator (only unpaid ones, regardless of status)
  // payment_status can be undefined, null, 'unpaid', or anything other than 'paid'
  sparks.value
    .filter(spark => spark.creator && (!spark.payment_status || spark.payment_status !== 'paid'))
    .forEach(spark => {
      if (!creatorMap.has(spark.creator)) {
        creatorMap.set(spark.creator, {
          creator: spark.creator,
          videos: [],
          rate: defaultRate.value,
          total: 0
        });
      }
      creatorMap.get(spark.creator).videos.push(spark);
    });
  
  // Calculate totals and apply custom rates and commissions if available
  const paymentsList = Array.from(creatorMap.values());
  paymentsList.forEach(payment => {
    // Check if there's a custom rate and commission for this creator
    const customCreator = creators.value.find(c => c.name === payment.creator);
    if (customCreator) {
      if (customCreator.rate) {
        payment.rate = customCreator.rate;
      }
      payment.commissionRate = customCreator.commissionRate || defaultCommissionRate.value;
      payment.commissionType = customCreator.commissionType || defaultCommissionType.value;
    } else {
      payment.commissionRate = defaultCommissionRate.value;
      payment.commissionType = defaultCommissionType.value;
    }
    
    // Calculate base amount
    const baseAmount = payment.videos.length * payment.rate;
    
    // Calculate commission
    let commissionAmount = 0;
    if (payment.commissionRate > 0) {
      if (payment.commissionType === 'percentage') {
        commissionAmount = baseAmount * (payment.commissionRate / 100);
      } else if (payment.commissionType === 'fixed') {
        commissionAmount = payment.videos.length * payment.commissionRate;
      }
    }
    
    payment.baseAmount = baseAmount.toFixed(2);
    payment.commissionAmount = commissionAmount.toFixed(2);
    payment.total = (baseAmount + commissionAmount).toFixed(2);
  });
  
  // Sort by creator name
  return paymentsList.sort((a, b) => a.creator.localeCompare(b.creator));
});

// Computed properties for payments data
const totalOwed = computed(() => getTotalOwed(sparks.value));
const totalPaid = computed(() => getTotalPaid(sparks.value));
const unpaidSparks = computed(() => getUnpaidSparks(sparks.value).length);
const activeCreators = computed(() => getActiveCreators(sparks.value));

// Note: totalPaidInPeriod, totalPayments, totalVideosPaid are provided by usePayments composable

// Note: totalInvoices, totalInvoiced, pendingInvoices, paidInvoices are provided by useInvoices composable

// Note: fetchSparks is provided by useSparks composable
// Local function to sync creators from virtualAssistants after fetch
const syncCreatorsFromVAs = () => {
  const uniqueCreators = [...new Set(sparks.value.map(s => s.creator).filter(c => c))];

  if (virtualAssistants.value.length > 1) {  // More than just "None"
    // Use VAs for payments
    creators.value = virtualAssistants.value
      .filter(va => va.value !== '')
      .map(va => ({
        id: va.value,
        name: va.title,
        rate: defaultRate.value,
        commissionRate: defaultCommissionRate.value,
        commissionType: defaultCommissionType.value
      }));
  } else {
    // Fallback to extracting from existing data
    creators.value = uniqueCreators.map(name => ({
      id: name,
      name: name,
      rate: defaultRate.value,
      commissionRate: defaultCommissionRate.value,
      commissionType: defaultCommissionType.value
    }));
  }
};

const fetchOfferTemplates = async () => {
  try {
    const data = await templatesApi.getTemplatesList();
    offerTemplates.value = data.templates || [];
  } catch (error) {
    offerTemplates.value = [];
  }
};

const fetchVirtualAssistants = async () => {
  try {
    const response = await usersApi.getVirtualAssistants();
    console.log('Virtual assistants response:', response); // Debug log

    // The API returns { assistants: [...] }
    if (response && response.assistants && Array.isArray(response.assistants)) {
      virtualAssistants.value = response.assistants
        .filter(va => va.status === 'active') // Only show active VAs
        .map(va => ({
          title: va.email || 'Unknown VA',
          value: va.email || 'Unknown'
        }));

      console.log('Processed VAs:', virtualAssistants.value); // Debug log

      // Add main user's email if they're logged in (not a VA)
      if (!isAssistingUser.value && user.value?.email) {
        virtualAssistants.value.push({
          title: user.value.email,
          value: user.value.email
        });
      }

      // Add a "None" option at the beginning
      virtualAssistants.value.unshift({ title: 'None', value: '' });
    } else {
      console.log('No virtual assistants found in response, response structure:', response);
      virtualAssistants.value = [{ title: 'None', value: '' }];
    }

    console.log('Final virtualAssistants.value:', virtualAssistants.value); // Debug log
  } catch (error) {
    console.error('Failed to fetch virtual assistants:', error);
    virtualAssistants.value = [{ title: 'None', value: '' }];
  }
};

// Wrapper for clearFilters to handle local state
const clearFilters = () => {
  searchInput.value = '';
  sparksSearchQuery.value = '';
  clearSparksFilters();
  currentPage.value = 1;
};





// Local wrapper for exportToCSV with custom logic
const exportToCSV = () => {
  const headers = ['Name', 'Creator', 'Type', 'Status', 'Spark Code', 'Offer', 'Created'];
  const rows = filteredSparks.value.map(spark => ({
    name: spark.name,
    creator: spark.creator || '-',
    type: spark.type || 'Auto',
    status: spark.status,
    spark_code: spark.spark_code,
    offer: spark.offer_name || '-',
    created: formatDate(spark.created_at)
  }));

  exportToCSVUtil(rows, `sparks_${new Date().toISOString().split('T')[0]}.csv`);
};

const markPaid = (paymentId) => {
  showInfo('Mark paid feature coming soon');
};

const markCreatorPaid = async (creatorName) => {
  try {
    // Find all unpaid sparks for this creator (regardless of status)
    const creatorSparks = sparks.value.filter(
      spark => spark.creator === creatorName && (!spark.payment_status || spark.payment_status !== 'paid')
    );
    
    // Calculate payment amount with commission
    const customCreator = creators.value.find(c => c.name === creatorName);
    const rate = customCreator?.rate || defaultRate.value;
    const commissionRate = customCreator?.commissionRate || defaultCommissionRate.value;
    const commissionType = customCreator?.commissionType || defaultCommissionType.value;
    
    // Calculate base amount
    const baseAmount = creatorSparks.length * rate;
    
    // Calculate commission
    let commissionAmount = 0;
    if (commissionRate > 0) {
      if (commissionType === 'percentage') {
        commissionAmount = baseAmount * (commissionRate / 100);
      } else if (commissionType === 'fixed') {
        commissionAmount = creatorSparks.length * commissionRate;
      }
    }
    
    const totalAmount = baseAmount + commissionAmount;
    
    // Create payment history record
    const paymentRecord = {
      id: `payment_${Date.now()}`,
      creator: creatorName,
      paymentDate: new Date().toISOString(),
      amount: totalAmount.toFixed(2),
      baseAmount: baseAmount.toFixed(2),
      commissionAmount: commissionAmount.toFixed(2),
      videoCount: creatorSparks.length,
      status: 'paid',
      paymentMethod: 'Manual',
      notes: `Payment for ${creatorSparks.length} videos`,
      videos: creatorSparks.map(spark => ({
        id: spark.id,
        name: spark.name,
        spark_code: spark.spark_code
      }))
    };
    
    // Store undo information
    lastPaymentAction.value = {
      creator: creatorName,
      sparkIds: creatorSparks.map(s => s.id),
      sparks: creatorSparks.map(spark => ({
        ...spark,
        // Store the complete spark data for undo
      })),
      paymentRecord: paymentRecord,
      timestamp: Date.now()
    };
    
    // Show undo button with auto-hide after 30 seconds
    showUndoButton.value = true;
    if (undoTimeoutId.value) {
      clearTimeout(undoTimeoutId.value);
    }
    undoTimeoutId.value = setTimeout(() => {
      showUndoButton.value = false;
      lastPaymentAction.value = null;
    }, 30000); // Hide after 30 seconds
    
    // Save payment to backend
    try {
      await fetch('/api/sparks/record-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          creatorName: creatorName,
          paymentDate: paymentRecord.paymentDate,
          videoCount: paymentRecord.videoCount,
          baseAmount: paymentRecord.baseAmount,
          commissionAmount: paymentRecord.commissionAmount,
          totalAmount: paymentRecord.amount,
          paymentMethod: paymentRecord.paymentMethod,
          notes: paymentRecord.notes,
          sparkIds: creatorSparks.map(s => s.id)
        })
      });
    } catch (error) {
      console.error('Failed to save payment to backend:', error);
    }
    
    // Add to payment history locally
    paymentHistory.value.unshift(paymentRecord);
    
    // Update each spark's payment status to paid
    for (const spark of creatorSparks) {
      // Only send the required fields for update
      const updateData = {
        name: spark.name,
        creator: spark.creator,
        tiktokLink: spark.tiktok_link || spark.tiktokLink,
        sparkCode: spark.spark_code || spark.sparkCode,
        type: spark.type || 'auto',
        offer: spark.offer || '',
        status: spark.status,  // Keep the same status
        payment_status: 'paid'  // Mark as paid
      };

      await sparksApi.updateSpark(spark.id, updateData);
    }
    
    // Don't show success message yet - it's in the undo alert
    
    // Refresh the sparks list
    fetchSparks();
    
    // Update history creator options
    updateHistoryCreatorOptions();
  } catch (error) {
    showError('Failed to mark videos as paid: ' + (error.message || 'Unknown error'));
  }
};

// Note: undoLastPayment is provided by usePayments composable
// Local wrapper to handle undo timeout state
const undoLastPaymentLocal = async () => {
  await undoLastPayment();
  if (undoTimeoutId.value) {
    clearTimeout(undoTimeoutId.value);
    undoTimeoutId.value = null;
  }
};

// Payment History Methods
const filterPaymentHistory = () => {
  // In a real app, this would fetch filtered data from backend
  // For now, we'll filter the existing payment history
  let filtered = [...paymentHistory.value];
  
  if (historyDateFrom.value) {
    filtered = filtered.filter(p => new Date(p.paymentDate) >= new Date(historyDateFrom.value));
  }
  
  if (historyDateTo.value) {
    filtered = filtered.filter(p => new Date(p.paymentDate) <= new Date(historyDateTo.value));
  }
  
  if (historyCreatorFilter.value !== 'all') {
    filtered = filtered.filter(p => p.creator === historyCreatorFilter.value);
  }
  
  // Update the display (in real app, would update paymentHistory)
  showInfo(`Showing ${filtered.length} payment records`);
};

// Wrapper for clearHistoryFilters from composable
const clearHistoryFiltersLocal = () => {
  clearHistoryFilters();
  showInfo('Filters cleared');
};

const showPaymentDetails = (payment) => {
  selectedPayment.value = payment;
  showPaymentDetailsModal.value = true;
};

// Note: loadPaymentSettings is provided by usePayments composable

// Note: savePaymentSettings is provided by usePayments composable

const exportPaymentHistory = () => {
  const headers = ['Date', 'Creator', 'Videos', 'Amount', 'Status', 'Method', 'Notes'];
  const rows = paymentHistory.value.map(payment => [
    formatDate(payment.paymentDate),
    payment.creator,
    payment.videoCount,
    payment.amount,
    payment.status,
    payment.paymentMethod || 'N/A',
    payment.notes || ''
  ]);
  
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payment_history_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  
  showSuccess('Payment history exported successfully');
};

const updateHistoryCreatorOptions = () => {
  const uniqueCreators = new Set();
  
  // Get creators from payment history
  paymentHistory.value.forEach(p => uniqueCreators.add(p.creator));
  
  // Get creators from sparks
  sparks.value.forEach(spark => {
    if (spark.creator) uniqueCreators.add(spark.creator);
  });
  
  historyCreatorOptions.value = [
    { title: 'All Creators', value: 'all' },
    ...Array.from(uniqueCreators).map(creator => ({
      title: creator,
      value: creator
    }))
  ];
};


// Helper functions

// Handle batch update success
const handleBatchUpdateSuccess = (data) => {
  const fieldLabels = {
    type: 'Type',
    status: 'Status',
    creator: 'Creator'
  };
  const field = typeof data === 'string' ? data : data.field;
  const count = typeof data === 'object' ? data.count : 'all';
  showSuccess(`${fieldLabels[field] || field} applied to ${count} selected item${count !== 1 ? 's' : ''}`);
};

// Apply batch updates from child component
const applyBatchUpdates = (updates) => {
  // Create a new object to trigger reactivity
  bulkEditValues.value = {
    ...bulkEditValues.value,
    ...updates
  };
};

// Store the original showThumbnails state
let originalShowThumbnails = null;

// Bulk Edit Functions
const startBulkEdit = () => {
  isBulkEditMode.value = true;
  bulkEditValues.value = {};

  // Store current thumbnail state and disable thumbnails
  originalShowThumbnails = sparksShowThumbnails.value;
  sparksShowThumbnails.value = false;

  // Initialize bulk edit values with current values
  const newBulkEditValues = {};
  filteredSparks.value.forEach(spark => {
    newBulkEditValues[`${spark.id}-name`] = spark.name;
    newBulkEditValues[`${spark.id}-type`] = spark.type;
    newBulkEditValues[`${spark.id}-status`] = spark.status;
    newBulkEditValues[`${spark.id}-creator`] = spark.creator;
    newBulkEditValues[`${spark.id}-spark_code`] = spark.spark_code;
    newBulkEditValues[`${spark.id}-tiktok_link`] = spark.tiktok_link;
  });
  bulkEditValues.value = newBulkEditValues;
};

const cancelBulkEdit = () => {
  isBulkEditMode.value = false;
  bulkEditValues.value = {};

  // Restore original thumbnail state
  if (originalShowThumbnails !== null) {
    sparksShowThumbnails.value = originalShowThumbnails;
    originalShowThumbnails = null;
  }
};

const saveBulkEdit = async () => {
  isSavingBulk.value = true;
  
  try {
    const updates = [];
    
    // Collect all changes
    filteredSparks.value.forEach(spark => {
      const hasChanges = 
        bulkEditValues.value[`${spark.id}-name`] !== spark.name ||
        bulkEditValues.value[`${spark.id}-type`] !== spark.type ||
        bulkEditValues.value[`${spark.id}-status`] !== spark.status ||
        bulkEditValues.value[`${spark.id}-creator`] !== spark.creator ||
        bulkEditValues.value[`${spark.id}-spark_code`] !== spark.spark_code ||
        bulkEditValues.value[`${spark.id}-tiktok_link`] !== spark.tiktok_link;
      
      if (hasChanges) {
        updates.push({
          id: spark.id,
          name: bulkEditValues.value[`${spark.id}-name`],
          type: bulkEditValues.value[`${spark.id}-type`],
          status: bulkEditValues.value[`${spark.id}-status`],
          creator: bulkEditValues.value[`${spark.id}-creator`],
          sparkCode: bulkEditValues.value[`${spark.id}-spark_code`],
          tiktokLink: bulkEditValues.value[`${spark.id}-tiktok_link`]
        });
      }
    });
    
    if (updates.length === 0) {
      showSuccess('No changes to save');
      cancelBulkEdit();
      return;
    }
    
    // Save all updates
    let successCount = 0;
    let failedCount = 0;
    
    for (const update of updates) {
      try {
        await sparksApi.updateSpark(update.id, update);
        successCount++;
      } catch (error) {
        console.error(`Failed to update spark ${update.id}:`, error);
        failedCount++;
      }
    }
    
    if (successCount > 0) {
      showSuccess(`Successfully updated ${successCount} spark${successCount > 1 ? 's' : ''}`);
      // Refresh the data
      await fetchSparks();
    }
    
    if (failedCount > 0) {
      showError(`Failed to update ${failedCount} spark${failedCount > 1 ? 's' : ''}`);
    }
    
    cancelBulkEdit();
  } catch (error) {
    console.error('Bulk save error:', error);
    showError('Failed to save bulk changes');
  } finally {
    isSavingBulk.value = false;
  }
};

// Comment Bot Functions
const checkCommentBotAccess = async () => {
  try {
    // Check user subscriptions from the auth state
    const currentUser = user.value;
    console.log('Current user:', currentUser);
    console.log('Full user object keys:', currentUser ? Object.keys(currentUser) : 'No user');
    
    // Try different possible subscription fields
    const subscriptions = currentUser?.subscriptions || 
                          currentUser?.subscription || 
                          currentUser?.plans || 
                          currentUser?.access || 
                          [];
    
    console.log('Found subscriptions:', subscriptions);
    
    // Check if user has both Comment Bot and Dashboard subscriptions
    const hasCommentBot = subscriptions.includes('comment_bot');
    const hasDashboard = subscriptions.includes('dashboard');
    
    // Check if user is admin (admins get access to all features)
    const isAdmin = currentUser?.isAdmin === true;
    
    console.log('Has comment_bot subscription:', hasCommentBot);
    console.log('Has dashboard subscription:', hasDashboard);
    console.log('Is admin:', isAdmin);
    
    // Grant access if user has subscriptions OR is an admin
    hasCommentBotAccess.value = (hasCommentBot && hasDashboard) || isAdmin;
    console.log('Comment Bot access granted:', hasCommentBotAccess.value);
    
    if (hasCommentBotAccess.value) {
      // Fetch comment groups
      try {
        const groupsResponse = await commentBotApi.getCommentGroups();
        console.log('Comment groups API response:', groupsResponse);
        
        // Check if the response has the expected structure
        if (groupsResponse.success && groupsResponse.data) {
          commentGroups.value = groupsResponse.data;
        } else if (Array.isArray(groupsResponse)) {
          commentGroups.value = groupsResponse;
        } else if (groupsResponse.commentGroups) {
          commentGroups.value = groupsResponse.commentGroups;
        } else {
          // Try to use the response directly if it looks like an array
          commentGroups.value = groupsResponse || [];
        }
        
        console.log('Processed comment groups:', commentGroups.value);
      } catch (error) {
        console.error('Failed to fetch comment groups:', error);
        showWarning('Comment groups unavailable');
      }
      
      // Get user credits from existing subscription data (no need for API call)
      try {
        // Get Comment Bot specific credits (matching CommentBot.vue logic)
        const commentBotData = subscriptions.value?.comment_bot;
        userCredits.value = commentBotData?.totalCredits || 0;

        console.log('User credits:', userCredits.value);
      } catch (error) {
        console.error('Failed to get user credits:', error);
        userCredits.value = 0;
      }
    }
  } catch (error) {
    console.error('Failed to check Comment Bot access:', error);
    hasCommentBotAccess.value = false;
  }
};

const startCommentBotMode = () => {
  if (!hasCommentBotAccess.value) {
    showWarning('Comment Bot subscription required for this feature');
    return;
  }
  
  // Reset state first before enabling mode
  selectedForBot.value = [];
  commentBotSettings.value = {
    comment_group_id: null,
    like_count: 0,
    save_count: 0
  };
  
  // Then enable mode
  isBulkEditMode.value = false; // Ensure bulk edit is off
  
  // Use nextTick to avoid recursive updates
  nextTick(() => {
    isCommentBotMode.value = true;
  });
};

const cancelCommentBotMode = () => {
  isCommentBotMode.value = false;
  selectedForBot.value = [];
  commentBotSettings.value = {
    comment_group_id: null,
    like_count: 0,
    save_count: 0
  };
};

const toggleBotSelection = (sparkId) => {
  const index = selectedForBot.value.indexOf(sparkId);
  if (index > -1) {
    selectedForBot.value.splice(index, 1);
  } else {
    selectedForBot.value.push(sparkId);
  }
};

const executeCommentBot = async () => {
  if (selectedForBot.value.length === 0) {
    showError('Please select at least one spark');
    return;
  }

  if (!commentBotSettings.value.comment_group_id &&
      commentBotSettings.value.like_count === 0 &&
      commentBotSettings.value.save_count === 0) {
    showWarning('Please configure bot settings');
    return;
  }

  isProcessingBot.value = true;

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  try {
    // First, update all selected sparks to 'queued' status in the database
    for (const sparkId of selectedForBot.value) {
      const spark = sparks.value.find(s => s.id === sparkId);
      if (!spark) continue;

      // Only update sparks that have a TikTok link
      if (!spark.tiktok_link) {
        console.warn(`Skipping ${spark.name} - no TikTok link`);
        continue;
      }

      try {
        // Prepare update data with camelCase field names like the inline edit does
        const updateData = {
          name: spark.name,
          creator: spark.creator || 'None',
          tiktokLink: spark.tiktok_link,  // Use camelCase!
          sparkCode: spark.spark_code || '',  // Use camelCase!
          type: spark.type || 'auto',
          status: spark.status || 'active',
          offerName: spark.offer_name || '',  // Use camelCase!
          bot_status: 'queued'
        };

        const response = await sparksApi.updateSpark(spark.id, updateData);
      } catch (err) {
        console.error(`Failed to set queued status for ${spark.name}:`, err);
      }
    }

    // Refresh sparks to show queued status
    await fetchSparks();

    // Process each selected spark
    for (const sparkId of selectedForBot.value) {
      const spark = sparks.value.find(s => s.id === sparkId);
      if (!spark || !spark.tiktok_link) {
        skipCount++;
        continue;
      }

      const postId = extractPostIdFromTikTokLink(spark.tiktok_link);
      if (!postId) {
        console.warn(`No valid post ID for spark ${spark.name}, skipping`);

        // Update to failed in database
        try {
          const updateData = {
            name: spark.name,
            creator: spark.creator || 'None',
            tiktokLink: spark.tiktok_link,  // Use camelCase!
            sparkCode: spark.spark_code || '',  // Use camelCase!
            type: spark.type || 'auto',
            status: spark.status || 'active',
            offerName: spark.offer_name || '',  // Use camelCase!
            bot_status: 'failed'
          };

          await sparksApi.updateSpark(spark.id, updateData);
        } catch (updateError) {
          console.error(`Failed to update spark status in database:`, updateError);
        }

        failCount++;
        continue;
      }

      const orderData = {
        post_id: postId,
        comment_group_id: commentBotSettings.value.comment_group_id,
        like_count: Math.min(commentBotSettings.value.like_count || 0, 3000),
        save_count: Math.min(commentBotSettings.value.save_count || 0, 500)
      };

      console.log(`Creating order for spark ${spark.name}:`, orderData);

      try {
        // Use the regular createOrder endpoint
        const response = await commentBotApi.createOrder(orderData);
        console.log(`Order created for ${spark.name}:`, response);

        // Update the spark in the database with the post ID and processing status
        try {
          const updateData = {
            name: spark.name,
            creator: spark.creator || 'None',
            tiktokLink: spark.tiktok_link,  // Use camelCase!
            sparkCode: spark.spark_code || '',  // Use camelCase!
            type: spark.type || 'auto',
            status: spark.status || 'active',
            offerName: spark.offer_name || '',  // Use camelCase!
            bot_post_id: postId,
            bot_status: 'processing'
          };

          await sparksApi.updateSpark(spark.id, updateData);
        } catch (updateError) {
          console.error(`Failed to update spark ${spark.name} in database:`, updateError);
          console.error(`Update data:`, updateData);
          // Don't fail the whole operation if DB update fails
        }

        successCount++;
      } catch (error) {
        console.error(`Failed to create order for spark ${spark.name}:`, error);

        // Try to update in database with failed status
        try {
          const updateData = {
            name: spark.name,
            creator: spark.creator || 'None',
            tiktokLink: spark.tiktok_link,  // Use camelCase!
            sparkCode: spark.spark_code || '',  // Use camelCase!
            type: spark.type || 'auto',
            status: spark.status || 'active',
            offerName: spark.offer_name || '',  // Use camelCase!
            bot_status: 'failed'
          };

          await sparksApi.updateSpark(spark.id, updateData);
        } catch (updateError) {
          console.error(`Failed to update spark status in database:`, updateError);
        }

        failCount++;
      }
    }
    
    // Provide detailed feedback based on results
    if (failCount > 0 && successCount > 0) {
      showWarning(`Processed ${selectedForBot.value.length} sparks: ${successCount} succeeded, ${failCount} failed${skipCount > 0 ? `, ${skipCount} skipped` : ''}`);
    } else if (failCount > 0 && successCount === 0) {
      showError(`All ${failCount} sparks failed to process${skipCount > 0 ? ` (${skipCount} skipped)` : ''}`);
    } else if (skipCount > 0 && successCount === 0) {
      showError(`No valid sparks to process (${skipCount} skipped)`);
    } else {
      showSuccess(`Successfully processed all ${successCount} sparks`);
    }
    
    cancelCommentBotMode();
    await fetchSparks();
  } catch (error) {
    console.error('Bot processing failed:', error);
    showError('Failed to process sparks');
  } finally {
    isProcessingBot.value = false;
  }
};

// Extract Post ID from TikTok Link
const extractPostIdFromTikTokLink = (link) => {
  if (!link) return null;
  
  const patterns = [
    /\/video\/(\d{19})/,
    /@[\w.]+\/video\/(\d{19})/,
    /\/(\d{19})(?:\?|$)/
  ];
  
  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

const handleCommentBotRefresh = async () => {
  await fetchSparks();
  showSuccess('Sparks updated with bot status');
};

// Bot status refresh interval
let botStatusInterval = null;

// Function to refresh bot statuses for processing sparks
const refreshBotStatuses = async () => {
  const processingSparks = sparks.value.filter(s =>
    s.bot_post_id &&
    (s.bot_status === 'queued' || s.bot_status === 'processing' || s.bot_status === 'pending')
  );

  if (processingSparks.length === 0) {
    return; // No sparks to check
  }

  try {
    // Get all active orders from comment bot
    const ordersResponse = await commentBotApi.getOrders();

    if (!ordersResponse || !ordersResponse.orders) {
      return;
    }

    // Create a map of post_id to order status
    const orderStatusMap = {};
    ordersResponse.orders.forEach(order => {
      if (order.post_id) {
        orderStatusMap[order.post_id] = order.status || 'processing';
      }
    });

    // Check if any sparks need status updates
    let hasUpdates = false;

    for (const spark of processingSparks) {
      let newStatus = spark.bot_status;

      if (orderStatusMap[spark.bot_post_id]) {
        // Found matching order - update to its status
        newStatus = orderStatusMap[spark.bot_post_id];
      } else {
        // No matching order found - mark as completed
        newStatus = 'completed';
      }

      // Only update if status changed
      if (newStatus !== spark.bot_status) {
        hasUpdates = true;

        // Update in database with camelCase fields
        try {
          const updateData = {
            name: spark.name,
            creator: spark.creator || 'None',
            tiktokLink: spark.tiktok_link || '',  // Use camelCase!
            sparkCode: spark.spark_code || '',  // Use camelCase!
            type: spark.type || 'auto',
            status: spark.status || 'active',
            offerName: spark.offer_name || '',  // Use camelCase!
            bot_status: newStatus
          };

          await sparksApi.updateSpark(spark.id, updateData);
        } catch (err) {
          console.error(`Failed to update spark ${spark.id} status in DB:`, err);
        }
      }
    }

    // Refresh sparks if any updates were made
    if (hasUpdates) {
      await fetchSparks();
    }
  } catch (error) {
    console.error('Failed to refresh bot statuses:', error);
  }
};

// Lifecycle
onMounted(async () => {
  // Fetch VAs and templates first, then sparks
  await Promise.all([
    fetchVirtualAssistants(),
    fetchOfferTemplates()
  ]);
  await fetchSparks();
  syncCreatorsFromVAs();

  // Load payment settings from backend
  await loadPaymentSettings();

  // Load payment history and update creator options
  loadPaymentHistory();
  updateHistoryCreatorOptions();

  // Load invoices
  await fetchInvoices();

  // Check Comment Bot access and fetch comment groups
  await checkCommentBotAccess();

  // Start periodic bot status refresh (every 10 seconds)
  botStatusInterval = setInterval(refreshBotStatuses, 10000);
});

// Clean up interval on unmount
onUnmounted(() => {
  if (botStatusInterval) {
    clearInterval(botStatusInterval);
  }
});
</script>

<style scoped>
.sparks-container {
  padding-top: 20px;
}

.thumbnail-container {
  display: inline-block;
  overflow: hidden;
  border-radius: 4px;
}

.cursor-pointer {
  cursor: pointer;
}

.sparks-table :deep(tbody tr:hover) {
  cursor: pointer;
}

code {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.05);
  font-family: monospace;
}

:deep(.v-data-table__th) {
  font-weight: 600 !important;
}

.preview-list {
  max-height: 400px;
  overflow-y: auto;
  background-color: transparent;
}

.preview-list .v-list-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  padding: 12px 0;
}

.preview-list .v-list-item:last-child {
  border-bottom: none;
}

/* Inline editing styles */
.editable-cell {
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
  min-height: 32px;
  display: flex;
  align-items: center;
  position: relative;
}

.editable-cell:hover {
  background-color: rgba(33, 150, 243, 0.08);
}

.v-theme--dark .editable-cell:hover {
  background-color: rgba(33, 150, 243, 0.15);
}

.editable-cell:deep(.v-field) {
  min-height: 32px !important;
}

.editable-cell:deep(.v-field__input) {
  padding: 4px 8px !important;
  min-height: 32px !important;
}

.editable-cell:deep(.v-input__details) {
  display: none !important;
}

.editable-cell:deep(.v-select__selection) {
  margin: 0 !important;
}

/* Ensure table doesn't clip dropdowns */
.sparks-table :deep(.v-data-table__td) {
  white-space: nowrap;
  position: relative;
  overflow: visible;
}

/* Performance optimizations */
.sparks-table {
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.v-data-table__wrapper {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.spark-code-truncate {
  max-width: 150px;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
</style>