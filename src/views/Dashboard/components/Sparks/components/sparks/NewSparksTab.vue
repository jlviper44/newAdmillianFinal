<template>
  <div>
    <!-- Search and Filters Bar -->
    <SparksFilters
      v-model:search-input="searchInput"
      v-model:type-filter="sparksTypeFilter"
      v-model:status-filter="sparksStatusFilter"
      v-model:creator-filter="sparksCreatorFilter"
      v-model:show-thumbnails="sparksShowThumbnails"
      :is-bulk-edit-mode="isBulkEditMode"
      :is-comment-bot-mode="isCommentBotMode"
      :type-options="typeOptions"
      :status-options="statusOptions"
      :creator-options="creatorOptions"
      @clear-filters="clearFilters"
    />

    <!-- Filters + Toolbar Row -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row align="center">
          <SparksToolbar
            :is-bulk-edit-mode="isBulkEditMode"
            :is-comment-bot-mode="isCommentBotMode"
            :is-saving-bulk="isSavingBulk"
            :has-comment-bot-access="hasCommentBotAccess"
            :selected-items="selectedItems"
            @start-bulk-edit="startBulkEdit"
            @save-bulk-edit="saveBulkEditLocal"
            @cancel-bulk-edit="cancelBulkEdit"
            @delete-selected="deleteSelectedLocal"
            @export-to-csv="exportToCSVLocal"
            @bulk-add="bulkAdd"
            @start-comment-bot="startCommentBot"
            @cancel-comment-bot="cancelCommentBot"
          />
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Comment Bot Panel -->
    <SparksCommentBotPanel
      :is-comment-bot-mode="isCommentBotMode"
      :user-credits="userCredits"
      :selected-for-bot="selectedForBot"
      :comment-bot-settings="commentBotSettings"
      :comment-groups="commentGroups"
      :is-processing-bot="isProcessingBot"
      @update-comment-bot-settings="updateCommentBotSettingsLocal"
      @select-all-for-bot="selectAllForBot"
      @clear-selection="selectedItems = []"
      @execute-comment-bot="executeCommentBot"
    />

    <!-- Batch Update Panel -->
    <SparksBatchUpdatePanel
      :is-bulk-edit-mode="isBulkEditMode"
      :selected-items="selectedItems"
      :virtual-assistants="virtualAssistants"
      @select-all-items="selectedItems = [...filteredSparks]"
      @clear-selection="selectedItems = []"
      @apply-batch-updates="saveBulkEditLocal"
      @show-batch-update-success="showSuccess"
      @show-batch-update-warning="showWarning"
    />

    <!-- Original Data Table - Now with proper headers -->
    <v-card class="mt-4">
      <SparksDataTable
        :filtered-sparks="filteredSparks || []"
        :is-loading="isLoading"
        :items-per-page="localItemsPerPage"
        :current-page="localCurrentPage"
        :headers="headers"
        :is-bulk-edit-mode="isBulkEditMode || false"
        :is-comment-bot-mode="isCommentBotMode || false"
        :duplicate-info="duplicateInfo"
        :default-thumbnail="defaultThumbnail"
        :selected-for-bot="selectedForBot || []"
        :editing-cells="editingCells || {}"
        :editing-values="editingValues || {}"
        :bulk-edit-values="bulkEditValues || {}"
        :virtual-assistants="virtualAssistants || []"
        v-model:current-page="localCurrentPage"
        v-model:items-per-page="localItemsPerPage"
        v-model:selected-for-bot="selectedForBot"
        v-model:selected-items="selectedItems"
        @remove-duplicates="removeDuplicatesLocal"
        @show-large-preview="showLargePreview"
        @handle-image-error="handleImageError"
        @start-inline-edit="startInlineEditLocal"
        @save-inline-edit="saveInlineEditLocal"
        @cancel-inline-edit="cancelInlineEditLocal"
        @apply-batch-updates="saveBulkEditLocal"
        @edit-spark="editSpark"
        @delete-spark="deleteSparkLocal"
      />
    </v-card>

    <!-- Spark Modals -->
    <SparkPreviewModal
      v-model="showPreview"
      :spark="previewSpark"
    />

    <SparkFormModal
      v-model="showCreateModal"
      :editing-spark-data="editingSparkData"
      :virtual-assistants="virtualAssistants"
      @save="saveSparkLocal"
    />

    <BulkAddModal
      v-model="showBulkAddModal"
      :virtual-assistants="virtualAssistants"
      :comment-groups="commentGroups"
      :has-comment-bot-access="hasCommentBotAccess"
      :user-credits="userCredits"
      :is-loading="isSavingBulk"
      @save="saveBulkAddLocal"
    />

    <!-- Snackbar for notifications -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="bottom"
    >
      {{ snackbarText }}
      <template v-slot:actions>
        <v-btn variant="text" @click="showSnackbar = false">Close</v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, computed } from 'vue';
import SparksFilters from './SparksFilters.vue';
import SparksToolbar from './SparksToolbar.vue';
import SparksCommentBotPanel from './SparksCommentBotPanel.vue';
import SparksBatchUpdatePanel from './SparksBatchUpdatePanel.vue';
import SparksDataTable from './SparksDataTable.vue';

// Import modal components
import SparkPreviewModal from './modals/SparkPreviewModal.vue';
import SparkFormModal from './modals/SparkFormModal.vue';
import BulkAddModal from './modals/BulkAddModal.vue';

// Import composables
import { useSparks } from './composables/useSparks';
import { useSparkUtils } from './composables/useSparkUtils';
import { useSparkForms } from './composables/useSparkForms';
import { useBulkOperations } from './composables/useBulkOperations';
import { useAuth } from '@/composables/useAuth';
import { sparksApi, templatesApi, usersApi, commentBotApi } from '@/services/api';

// Get auth state
const { user, isAssistingUser } = useAuth();

// Use composables directly
const {
  sparks,
  isLoading,
  searchQuery: searchInput,
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
  snackbarText,
  snackbarColor,
  showSnackbar,
  copyCode,
  formatDate,
  handleImageError,
  exportToCSV,
  showSuccess,
  showError,
  showInfo,
  showWarning
} = useSparkUtils();

const {
  showCreateModal,
  showBulkAddModal,
  editingSparkData,
  sparkForm,
  bulkAddForm,
  openCreateModal,
  editSpark,
  bulkAdd
} = useSparkForms(user, isAssistingUser);

const {
  isBulkEditMode,
  bulkEditValues,
  isSavingBulk,
  selectedForDelete,
  showDeleteSelectedModal,
  isDeletingSelected,
  editingCells,
  editingValues,
  menuStates,
  isEditing,
  startInlineEdit,
  cancelInlineEdit,
  saveInlineEdit,
  enableBulkEdit: startBulkEdit,
  cancelBulkEdit,
  saveBulkEdit,
  deleteSelected,
  confirmDeleteSelected,
  removeDuplicates
} = useBulkOperations();

// No props needed - everything comes from composables
const props = defineProps({});

// Minimal emits - only for coordination with parent if needed
const emit = defineEmits([]);

// Local state for pagination and selection
const localItemsPerPage = ref(10);
const localCurrentPage = ref(1);
const selectedItems = ref([]);

// Comment bot related state
const isCommentBotMode = ref(false);
const isProcessingBot = ref(false);
const selectedForBot = ref([]);
const commentBotSettings = ref({
  commentGroupId: null,
  likeCount: 0,
  saveCount: 0
});

// Mock data for comment groups and virtual assistants
const commentGroups = ref([
  { id: 1, name: 'Default Comments', value: 1 },
  { id: 2, name: 'Promotional Comments', value: 2 }
]);

const virtualAssistants = ref([
  { title: 'Assistant 1', value: 'assistant1' },
  { title: 'Assistant 2', value: 'assistant2' }
]);

// Mock user credits and access
const hasCommentBotAccess = ref(true);
const userCredits = ref(100);

// Base headers definition
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
  try {
    console.log('Computing headers...', {
      baseHeaders: baseHeaders.length,
      sparksShowThumbnails: sparksShowThumbnails?.value,
      isBulkEditMode: isBulkEditMode?.value
    });

    // For now, just return baseHeaders directly to test
    console.log('Returning baseHeaders directly:', baseHeaders.length, baseHeaders);
    return baseHeaders;

    // Original logic commented out for debugging
    /*
    let headers = [...baseHeaders]; // Create a copy to avoid mutation

    // Hide thumbnail if toggle is off
    if (sparksShowThumbnails?.value === false) {
      headers = headers.filter(h => h.key !== 'thumbnail');
    }

    // Hide only Actions column in bulk edit mode (keep TikTok link editable)
    if (isBulkEditMode?.value === true) {
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

    console.log('Computed headers result:', headers.length, headers);
    return headers;
    */
  } catch (error) {
    console.error('Error computing headers:', error);
    // Fallback to base headers
    return baseHeaders;
  }
});

// Add duplicate marking to filtered sparks
const sparksWithDuplicateInfo = computed(() => {
  try {
    if (!filteredSparks.value || !Array.isArray(filteredSparks.value)) {
      console.log('filteredSparks not available:', filteredSparks.value);
      return [];
    }

    const duplicateIds = duplicateInfo.value?.duplicateIds || new Set();
    return filteredSparks.value.map(spark => ({
      ...spark,
      isDuplicate: duplicateIds.has(spark.id)
    }));
  } catch (error) {
    console.error('Error in sparksWithDuplicateInfo:', error);
    return filteredSparks.value || [];
  }
});

// Default thumbnail - using base64 SVG like in SparksView
const defaultThumbnail = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjRTBFMEUwIi8+CjxwYXRoIGQ9Ik0yNSAxOEwyOSAyNUwyNSAzMkwyMSAyNVoiIGZpbGw9IiM5RTlFOUUiLz4KPC9zdmc+';

// Advanced duplicate detection logic
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
    hasDuplicates: duplicateIds.size > 0
  };
});

// Color utility functions (keeping original SparksView.vue logic)
const getTypeColor = (type) => {
  const lowerType = (type || 'Auto').toLowerCase();
  switch (lowerType) {
    case 'cpi': return 'blue';
    case 'sweeps': return 'green';
    case 'cash': return 'orange';
    case 'paypal': return 'purple';
    case 'home': return 'teal';
    case 'auto': return 'grey';
    default: return 'primary';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'active': return 'success';
    case 'testing': return 'warning';
    case 'untested': return 'info';
    case 'blocked': return 'error';
    default: return 'grey';
  }
};

const getStatusLabel = (status) => {
  switch (status) {
    case 'active': return 'Active';
    case 'testing': return 'Testing';
    case 'untested': return 'Untested';
    case 'blocked': return 'Blocked';
    default: return status || 'Unknown';
  }
};

// Export to CSV functionality is handled by useSparkUtils composable

// Remove duplicates functionality
const removeDuplicatesLocal = async () => {
  try {
    const duplicateIds = Array.from(duplicateInfo.value.duplicateIds);
    if (duplicateIds.length === 0) {
      showWarning('No duplicates found to remove');
      return;
    }

    // Keep the first occurrence of each duplicate group and remove the rest
    const linkMap = new Map();
    const codeMap = new Map();
    const idsToDelete = new Set();

    sparks.value.forEach(spark => {
      if (spark.tiktok_link && linkMap.has(spark.tiktok_link)) {
        idsToDelete.add(spark.id);
      } else if (spark.tiktok_link) {
        linkMap.set(spark.tiktok_link, spark.id);
      }

      if (spark.spark_code && codeMap.has(spark.spark_code)) {
        idsToDelete.add(spark.id);
      } else if (spark.spark_code) {
        codeMap.set(spark.spark_code, spark.id);
      }
    });

    for (const id of idsToDelete) {
      await deleteSpark(id);
    }

    await fetchSparks();
    showSuccess(`Removed ${idsToDelete.size} duplicate entries`);
  } catch (error) {
    showError('Failed to remove duplicates');
  }
};

// Local wrapper functions that call composable functions
const clearFilters = () => {
  clearSparksFilters();
};

const startInlineEditLocal = (item, field) => {
  startInlineEdit(item, field, sparks.value);
};

const saveInlineEditLocal = async (item, field) => {
  try {
    // Get the new value from editingValues
    const key = `${item.id}-${field}`;
    const newValue = editingValues.value[key];

    if (newValue === item[field]) {
      // No change, just cancel the edit
      cancelInlineEdit(item.id, field);
      return;
    }

    // Create complete update data with all required fields (matching SparksView.vue format)
    const updateData = {
      name: item.name,
      creator: item.creator || 'None',
      tiktokLink: item.tiktok_link || '',
      sparkCode: item.spark_code || '',
      type: item.type || 'auto',
      status: item.status || 'active',
      offerName: item.offer_name || ''
    };

    // Update the specific field that was edited
    const fieldMapping = {
      'name': 'name',
      'creator': 'creator',
      'tiktok_link': 'tiktokLink',
      'spark_code': 'sparkCode',
      'type': 'type',
      'status': 'status',
      'offer_name': 'offerName'
    };

    const apiField = fieldMapping[field] || field;
    updateData[apiField] = newValue;

    console.log('Saving inline edit:', { itemId: item.id, field, newValue, updateData });

    await updateSpark(item.id, updateData);

    // Cancel the edit state
    cancelInlineEdit(item.id, field);

    showSuccess(`${field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} updated successfully`);

    // Refresh the sparks data after successful update
    await fetchSparks();
  } catch (error) {
    console.error('Inline edit save error:', error);
    showError('Failed to update: ' + (error.message || 'Unknown error'));
  }
};

const cancelInlineEditLocal = (itemId, field) => {
  cancelInlineEdit(itemId, field);
};

const deleteSparkLocal = async (spark) => {
  try {
    await deleteSpark(spark.id);
    showSuccess('Spark deleted successfully');
    await fetchSparks();
  } catch (error) {
    showError('Failed to delete spark');
  }
};

// Bulk edit functionality is handled by useBulkOperations composable

const applyBatchUpdates = (updates) => {
  // This would be handled by the bulk operations composable
  // For now, keep a simple implementation if needed
  if (bulkEditValues?.value) {
    Object.assign(bulkEditValues.value, updates);
  }
};

const saveBulkEditLocal = async () => {
  try {
    await saveBulkEdit();
    showSuccess('Bulk updates applied successfully');
    await fetchSparks();
  } catch (error) {
    showError('Failed to apply bulk updates');
  }
};

const deleteSelectedLocal = async () => {
  if (!selectedItems.value?.length) {
    showWarning('No items selected for deletion');
    return;
  }

  try {
    for (const item of selectedItems.value) {
      await deleteSpark(item.id);
    }

    await fetchSparks();
    showSuccess(`Successfully deleted ${selectedItems.value.length} sparks`);
    selectedItems.value = [];
  } catch (error) {
    showError('Failed to delete selected items');
  }
};

const exportToCSVLocal = () => {
  const exportData = sparksWithDuplicateInfo.value.map(spark => ({
    name: spark.name || '',
    creator: spark.creator || '',
    type: spark.type || '',
    status: spark.status || '',
    sparkCode: spark.spark_code || '',
    offer: spark.offer || '',
    created: formatDate(spark.created_at)
  }));

  exportToCSV(exportData, `sparks_${new Date().toISOString().split('T')[0]}.csv`);
};

// Advanced comment bot functionality from SparksView.vue
const startCommentBot = () => {
  isCommentBotMode.value = true;
  selectedItems.value = [];
  selectedForBot.value = [];

  // Check access and initialize
  checkCommentBotAccess();
};

const cancelCommentBot = () => {
  isCommentBotMode.value = false;
  selectedForBot.value = [];
  selectedItems.value = [];
  isProcessingBot.value = false;
};

const checkCommentBotAccess = async () => {
  try {
    // Mock implementation - replace with actual API calls as needed
    const currentUser = user.value;
    if (!currentUser) {
      hasCommentBotAccess.value = false;
      return;
    }

    // Check subscriptions (implement based on your auth system)
    const subscriptions = currentUser?.subscriptions || [];
    const hasCommentBot = subscriptions.includes('comment_bot');
    const hasDashboard = subscriptions.includes('dashboard');
    const isAdmin = currentUser?.isAdmin === true;

    hasCommentBotAccess.value = hasCommentBot || hasDashboard || isAdmin;

    if (hasCommentBotAccess.value) {
      // Load comment groups and credits
      try {
        // Mock comment groups - replace with actual API
        commentGroups.value = [
          { id: '1', name: 'Default Group', description: 'Default comment group' }
        ];

        // Mock user credits - replace with actual API
        userCredits.value = 100;
      } catch (error) {
        console.error('Error loading comment bot data:', error);
      }
    }
  } catch (error) {
    console.error('Error checking comment bot access:', error);
    hasCommentBotAccess.value = false;
  }
};

const executeCommentBot = async () => {
  if (!selectedForBot.value?.length) {
    showError('Please select sparks to process');
    return;
  }

  if (!commentBotSettings.value.selectedGroup) {
    showError('Please select a comment group');
    return;
  }

  isProcessingBot.value = true;

  try {
    let processedCount = 0;
    let failedCount = 0;

    for (const sparkId of selectedForBot.value) {
      try {
        const spark = sparks.value.find(s => s.id === sparkId);
        if (!spark) continue;

        // Update spark status to processing
        const updateData = {
          bot_status: 'processing'
        };

        await updateSpark(spark.id, updateData);

        // Extract post ID from TikTok link
        const postId = extractPostIdFromTikTokLink(spark.tiktok_link);
        if (!postId) {
          // Update status to failed
          await updateSpark(spark.id, { bot_status: 'failed' });
          failedCount++;
          continue;
        }

        // Mock API call to create comment bot order
        // Replace with actual commentBotApi.createOrder call
        const orderData = {
          postId,
          groupId: commentBotSettings.value.selectedGroup,
          sparkId: spark.id
        };

        // Simulate API response
        const mockResponse = { success: true, orderId: `order_${Date.now()}_${spark.id}` };

        if (mockResponse.success) {
          await updateSpark(spark.id, {
            bot_status: 'queued',
            comment_bot_order_id: mockResponse.orderId
          });
          processedCount++;
        } else {
          await updateSpark(spark.id, { bot_status: 'failed' });
          failedCount++;
        }

      } catch (error) {
        console.error(`Error processing spark ${sparkId}:`, error);
        failedCount++;
      }
    }

    await fetchSparks();

    if (processedCount > 0) {
      showSuccess(`Successfully queued ${processedCount} sparks for comment bot processing`);
    }

    if (failedCount > 0) {
      showWarning(`${failedCount} sparks failed to process`);
    }

  } catch (error) {
    showError('Failed to execute comment bot');
    console.error('Comment bot execution error:', error);
  } finally {
    isProcessingBot.value = false;
    cancelCommentBot();
  }
};

const extractPostIdFromTikTokLink = (link) => {
  if (!link) return null;

  const patterns = [
    /\/video\/(\d+)/,
    /\/v\/(\d+)/,
    /tiktok\.com\/.*\/video\/(\d+)/
  ];

  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match) return match[1];
  }

  return null;
};

const selectAllForBot = () => {
  const validSparks = sparksWithDuplicateInfo.value.filter(s =>
    s.tiktok_link && s.bot_status !== 'completed'
  );
  selectedItems.value = validSparks;
  selectedForBot.value = validSparks.map(s => s.id);
};

const updateCommentBotSettingsLocal = (settings) => {
  commentBotSettings.value = { ...commentBotSettings.value, ...settings };
};

// Modal state and functions
const showPreview = ref(false);
const previewSpark = ref(null);

const showLargePreview = (spark) => {
  previewSpark.value = spark;
  showPreview.value = true;
};

// Save spark function
const saveSparkLocal = async (sparkData) => {
  try {
    if (editingSparkData.value) {
      // Update existing spark
      await updateSpark(editingSparkData.value.id, sparkData);
      showSuccess('Spark updated successfully');
    } else {
      // Create new spark
      await createSpark(sparkData);
      showSuccess('Spark created successfully');
    }
    await fetchSparks();
  } catch (error) {
    showError('Failed to save spark');
  }
};

// Save bulk add function
const saveBulkAddLocal = async (data) => {
  try {
    const { sparks: sparksToCreate, enableCommentBot, commentBotSettings } = data;

    for (const sparkData of sparksToCreate) {
      await createSpark(sparkData);
    }

    showSuccess(`Successfully created ${sparksToCreate.length} sparks`);
    await fetchSparks();

    if (enableCommentBot) {
      // TODO: Implement comment bot functionality
      showInfo('Comment bot functionality will be implemented');
    }
  } catch (error) {
    showError('Failed to create sparks');
  }
};

// Helper functions
const fetchOfferTemplates = async () => {
  try {
    const data = await templatesApi.getTemplatesList();
    // Store templates if needed for child components
  } catch (error) {
    console.error('Failed to fetch offer templates:', error);
  }
};

const fetchVirtualAssistants = async () => {
  try {
    const response = await usersApi.getVirtualAssistants();
    if (response && response.assistants && Array.isArray(response.assistants)) {
      const processedVAs = response.assistants
        .filter(va => va.status === 'active')
        .map(va => ({
          title: va.email || 'Unknown VA',
          value: va.email || 'Unknown'
        }));

      // Add main user's email if they're logged in (not a VA)
      if (!isAssistingUser.value && user.value?.email) {
        processedVAs.push({
          title: user.value.email,
          value: user.value.email
        });
      }

      // Add a "None" option at the beginning
      processedVAs.unshift({ title: 'None', value: '' });
      virtualAssistants.value = processedVAs;
    } else {
      virtualAssistants.value = [{ title: 'None', value: '' }];
    }
  } catch (error) {
    console.error('Failed to fetch virtual assistants:', error);
    virtualAssistants.value = [{ title: 'None', value: '' }];
  }
};

// Initialize data
onMounted(async () => {
  try {
    console.log('NewSparksTab mounted, fetching data...');

    // Fetch VAs and templates first, then sparks
    await Promise.all([
      fetchVirtualAssistants(),
      fetchOfferTemplates()
    ]);

    if (typeof fetchSparks === 'function') {
      await fetchSparks();
      console.log('Sparks loaded:', sparks.value?.length || 0);
    } else {
      console.warn('fetchSparks is not a function:', fetchSparks);
    }

    // Check Comment Bot access
    await checkCommentBotAccess();
  } catch (error) {
    console.error('Error loading data:', error);
    showError('Failed to load data');
  }
});
</script>