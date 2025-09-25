<template>
  <v-dialog v-model="dialog" fullscreen>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-table-large</v-icon>
        Sparks Spreadsheet View
        <v-spacer />
        <v-btn
          :variant="isBatchUpdateMode ? 'elevated' : 'outlined'"
          :color="isBatchUpdateMode ? 'primary' : 'default'"
          prepend-icon="mdi-pencil-box-multiple"
          @click="toggleBatchUpdate"
          class="mr-2"
        >
          {{ isBatchUpdateMode ? 'Hide Batch Update' : 'Batch Update' }}
        </v-btn>
        <v-btn
          v-if="hasCommentBotAccess"
          :variant="isCommentBotMode ? 'elevated' : 'outlined'"
          :color="isCommentBotMode ? 'primary' : 'default'"
          prepend-icon="mdi-robot"
          @click="toggleCommentBot"
          class="mr-2"
        >
          {{ isCommentBotMode ? 'Hide Comment Bot' : 'Comment Bot' }}
        </v-btn>
        <v-btn
          variant="outlined"
          color="error"
          prepend-icon="mdi-delete"
          @click="deleteSelected"
          :disabled="selectedRows.size === 0"
          class="mr-2"
        >
          Delete ({{ selectedRows.size }})
        </v-btn>
        <v-btn
          variant="outlined"
          prepend-icon="mdi-content-save"
          @click="saveChanges"
          :disabled="!hasChanges"
          class="mr-2"
        >
          Save Changes
        </v-btn>
        <v-btn icon @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-card-text>
        <!-- Batch Update Panel -->
        <v-card v-if="isBatchUpdateMode" class="mb-4 batch-update-card">
          <v-card-title class="text-h6 pb-2">
            <v-icon class="mr-2">mdi-pencil-box-multiple</v-icon>
            Batch Update - Apply to Selected Items
            <v-spacer />
            <v-chip class="mr-2" color="primary" variant="tonal">
              {{ selectedRows.size }} selected
            </v-chip>
            <v-btn
              size="small"
              variant="outlined"
              class="mr-2"
              @click="selectAllRows"
            >
              Select All
            </v-btn>
            <v-btn
              size="small"
              variant="outlined"
              @click="clearSelection"
            >
              Clear Selection
            </v-btn>
          </v-card-title>

          <v-card-text>
            <v-row align="center" dense>
              <!-- Status field -->
              <v-col cols="12" md="6">
                <v-row align="center" no-gutters>
                  <v-col cols="8">
                    <v-select
                      v-model="batchUpdate.status"
                      :items="['active', 'testing', 'blocked']"
                      label="Status"
                      density="compact"
                      variant="outlined"
                      hide-details
                      clearable
                    />
                  </v-col>
                  <v-col cols="4" class="pl-2">
                    <v-btn
                      size="small"
                      variant="tonal"
                      color="primary"
                      block
                      @click="applyBatchUpdate('status')"
                      :disabled="!batchUpdate.status"
                    >
                      Apply
                    </v-btn>
                  </v-col>
                </v-row>
              </v-col>

              <!-- Name field -->
              <v-col cols="12" md="6">
                <v-row align="center" no-gutters>
                  <v-col cols="8">
                    <v-text-field
                      v-model="batchUpdate.name"
                      label="Name"
                      density="compact"
                      variant="outlined"
                      hide-details
                      clearable
                    />
                  </v-col>
                  <v-col cols="4" class="pl-2">
                    <v-btn
                      size="small"
                      variant="tonal"
                      color="primary"
                      block
                      @click="applyBatchUpdate('name')"
                      :disabled="!batchUpdate.name"
                    >
                      Apply
                    </v-btn>
                  </v-col>
                </v-row>
              </v-col>

              <!-- Offer field -->
              <v-col cols="12" md="6">
                <v-row align="center" no-gutters>
                  <v-col cols="8">
                    <v-text-field
                      v-model="batchUpdate.offer"
                      label="Offer"
                      density="compact"
                      variant="outlined"
                      hide-details
                      clearable
                    />
                    <div class="mt-1">
                      <v-btn
                        v-for="offerType in ['CPI', 'Auto', 'Shein', 'Cash']"
                        :key="offerType"
                        size="x-small"
                        variant="tonal"
                        class="mr-1 mb-1"
                        @click="batchUpdate.offer = offerType"
                      >
                        {{ offerType }}
                      </v-btn>
                    </div>
                  </v-col>
                  <v-col cols="4" class="pl-2">
                    <v-btn
                      size="small"
                      variant="tonal"
                      color="primary"
                      block
                      @click="applyBatchUpdate('offer')"
                      :disabled="!batchUpdate.offer"
                    >
                      Apply
                    </v-btn>
                  </v-col>
                </v-row>
              </v-col>

              <!-- Creator field -->
              <v-col cols="12" md="6">
                <v-row align="center" no-gutters>
                  <v-col cols="8">
                    <v-select
                      v-model="batchUpdate.creator"
                      :items="virtualAssistants"
                      label="Creator (VA)"
                      density="compact"
                      variant="outlined"
                      hide-details
                      clearable
                    />
                  </v-col>
                  <v-col cols="4" class="pl-2">
                    <v-btn
                      size="small"
                      variant="tonal"
                      color="primary"
                      block
                      @click="applyBatchUpdate('creator')"
                      :disabled="!batchUpdate.creator"
                    >
                      Apply
                    </v-btn>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Comment Bot Panel -->
        <v-card v-if="isCommentBotMode" class="mb-4 batch-update-card">
          <v-card-title class="text-h6 pb-2">
            <v-icon class="mr-2">mdi-robot</v-icon>
            Comment Bot - Configure Settings
            <v-spacer />
            <v-chip class="mr-2" color="primary" variant="tonal">
              {{ selectedRows.size }} selected
            </v-chip>
            <v-btn
              size="small"
              variant="outlined"
              @click="cancelCommentBot"
            >
              Cancel
            </v-btn>
          </v-card-title>

          <v-card-text>
            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              <div class="d-flex align-center justify-space-between">
                <div>
                  <v-icon size="small" class="mr-1">mdi-coin</v-icon>
                  <strong>Available Credits:</strong> {{ userCredits || 0 }}
                </div>
                <div>
                  <v-icon size="small" class="mr-1">mdi-calculator</v-icon>
                  <strong>Cost per Order:</strong> 1 credit
                </div>
                <div>
                  <v-icon size="small" class="mr-1">mdi-cash</v-icon>
                  <strong>Total Cost:</strong> {{ selectedRows.size }} credits
                </div>
              </div>
            </v-alert>

            <v-row align="center" dense>
              <v-col cols="12" md="4">
                <v-select
                  v-model="commentBotSettings.commentGroupId"
                  :items="commentGroups"
                  item-title="name"
                  item-value="id"
                  label="Comment Group"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="commentBotSettings.likeCount"
                  label="Like Count"
                  type="number"
                  density="compact"
                  variant="outlined"
                  hide-details
                  min="0"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="commentBotSettings.saveCount"
                  label="Save Count"
                  type="number"
                  density="compact"
                  variant="outlined"
                  hide-details
                  min="0"
                />
              </v-col>
            </v-row>

            <div class="mt-4">
              <v-btn
                color="primary"
                variant="elevated"
                @click="executeCommentBot(commentBotSettings)"
                :disabled="selectedRows.size === 0 || !commentBotSettings.commentGroupId"
              >
                Execute Comment Bot
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <div class="spreadsheet-container">
          <!-- Column Headers -->
          <div class="spreadsheet-grid">
            <div class="header-row">
              <div class="cell header-cell checkbox-cell">
                <v-checkbox-btn
                  :model-value="isAllSelected"
                  @update:model-value="toggleSelectAll"
                  density="compact"
                />
              </div>
              <div class="cell header-cell" v-for="column in columns" :key="column.key">
                {{ column.title }}
              </div>
            </div>

            <!-- Data Rows -->
            <div
              v-for="(spark, rowIndex) in editableSparks"
              :key="spark.id"
              class="data-row"
              :class="{ 'changed-row': isRowChanged(spark.id), 'selected-row': selectedRows.has(spark.id) }"
            >
              <div class="cell data-cell checkbox-cell">
                <v-checkbox-btn
                  :model-value="selectedRows.has(spark.id)"
                  @update:model-value="toggleRowSelection(spark.id)"
                  density="compact"
                />
              </div>
              <div
                v-for="column in columns"
                :key="`${spark.id}-${column.key}`"
                class="cell data-cell"
                :class="{
                  'editing': editingCell === `${spark.id}-${column.key}`,
                  'readonly': column.key === 'content_type' || column.key === 'bot_status'
                }"
                @click="column.key !== 'content_type' && column.key !== 'bot_status' ? startEdit(spark.id, column.key, rowIndex) : null"
              >
                <!-- Editable Input -->
                <input
                  v-if="editingCell === `${spark.id}-${column.key}`"
                  v-model="editValue"
                  @blur="finishEdit(spark.id, column.key)"
                  @keydown.enter="finishEdit(spark.id, column.key)"
                  @keydown.escape="cancelEdit"
                  class="cell-input"
                  ref="cellInput"
                />

                <!-- Display Value -->
                <span v-else class="cell-content">
                  {{ formatCellValue(spark[column.key], column.key) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>

  <!-- Delete Confirmation Modal -->
  <v-dialog v-model="showDeleteModal" max-width="500">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon color="error" class="mr-3">mdi-delete-alert</v-icon>
        Confirm Delete
      </v-card-title>
      <v-card-text>
        <div class="text-body-1 mb-3">
          Are you sure you want to delete <strong>{{ selectedRows.size }}</strong> spark{{ selectedRows.size === 1 ? '' : 's' }}?
        </div>
        <v-alert
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-0"
        >
          <v-icon>mdi-alert</v-icon>
          This action cannot be undone. The selected sparks will be permanently removed.
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="showDeleteModal = false">
          Cancel
        </v-btn>
        <v-btn
          variant="elevated"
          color="error"
          @click="confirmDelete"
          :loading="isDeleting"
        >
          Delete {{ selectedRows.size }} Spark{{ selectedRows.size === 1 ? '' : 's' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue';
import { commentBotApi } from '@/services/api';

const props = defineProps({
  modelValue: Boolean,
  sparks: {
    type: Array,
    default: () => []
  },
  virtualAssistants: {
    type: Array,
    default: () => []
  },
  hasCommentBotAccess: {
    type: Boolean,
    default: false
  },
  userCredits: {
    type: Number,
    default: 0
  },
  commentGroups: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue', 'save-changes', 'delete-sparks']);

// Dialog state
const dialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// Spreadsheet columns
const columns = [
  { title: 'TikTok Link', key: 'tiktok_link' },
  { title: 'Content Type', key: 'content_type' },
  { title: 'Spark Code', key: 'spark_code' },
  { title: 'Status', key: 'status' },
  { title: 'Bot Status', key: 'bot_status' },
  { title: 'Offer', key: 'offer' },
  { title: 'Creator', key: 'creator' },
  { title: 'Name', key: 'name' }
];

// Editable data
const editableSparks = ref([]);
const originalData = ref({});
const changedCells = ref(new Set());

// Editing state
const editingCell = ref(null);
const editValue = ref('');
const cellInput = ref(null);

// Row selection state
const selectedRows = ref(new Set());

// Batch update state
const batchUpdate = ref({
  status: null,
  name: null,
  offer: null,
  creator: null
});

// Batch update state
const isBatchUpdateMode = ref(false);

// Comment bot state
const isCommentBotMode = ref(false);
const commentBotSettings = ref({
  commentGroupId: null,
  likeCount: 0,
  saveCount: 0
});

// Initialize data when dialog opens
watch(() => props.sparks, (newSparks) => {
  if (newSparks && newSparks.length > 0) {
    editableSparks.value = JSON.parse(JSON.stringify(newSparks));
    // Store original data for change tracking
    originalData.value = {};
    newSparks.forEach(spark => {
      originalData.value[spark.id] = { ...spark };
    });
    changedCells.value.clear();
  }
}, { immediate: true });

// Computed properties
const hasChanges = computed(() => changedCells.value.size > 0);

// Check if a row has changes
const isRowChanged = (sparkId) => {
  return Array.from(changedCells.value).some(cellKey => cellKey.startsWith(`${sparkId}-`));
};

// Start editing a cell
const startEdit = async (sparkId, columnKey, rowIndex) => {
  const spark = editableSparks.value[rowIndex];
  editingCell.value = `${sparkId}-${columnKey}`;
  editValue.value = spark[columnKey] || '';

  await nextTick();
  if (cellInput.value && cellInput.value[0]) {
    cellInput.value[0].focus();
    cellInput.value[0].select();
  }
};

// Finish editing a cell
const finishEdit = (sparkId, columnKey) => {
  const spark = editableSparks.value.find(s => s.id === sparkId);
  if (spark) {
    const oldValue = spark[columnKey];
    const newValue = editValue.value;

    if (oldValue !== newValue) {
      spark[columnKey] = newValue;
      changedCells.value.add(`${sparkId}-${columnKey}`);
    }
  }

  editingCell.value = null;
  editValue.value = '';
};

// Cancel editing
const cancelEdit = () => {
  editingCell.value = null;
  editValue.value = '';
};

// Format cell value for display
const formatCellValue = (value, columnKey) => {
  if (!value) return '';

  if (columnKey === 'tiktok_link' && value.length > 30) {
    return value.substring(0, 30) + '...';
  }

  return value;
};

// Save changes
const saveChanges = () => {
  const changes = [];

  editableSparks.value.forEach(spark => {
    const original = originalData.value[spark.id];
    const hasChanges = columns.some(col => original[col.key] !== spark[col.key]);

    if (hasChanges) {
      changes.push({
        id: spark.id,
        data: {
          name: spark.name,
          creator: spark.creator || '',
          sparkCode: spark.spark_code || '',
          offer: spark.offer || '',
          status: spark.status || 'active',
          tiktokLink: spark.tiktok_link || ''
        }
      });
    }
  });

  if (changes.length > 0) {
    emit('save-changes', changes);
  }

  closeDialog();
};

// Row selection functionality
const isAllSelected = computed(() => {
  return editableSparks.value.length > 0 && selectedRows.value.size === editableSparks.value.length;
});

const toggleSelectAll = (value) => {
  if (value) {
    selectedRows.value = new Set(editableSparks.value.map(spark => spark.id));
  } else {
    selectedRows.value.clear();
  }
};

const selectAllRows = () => {
  selectedRows.value = new Set(editableSparks.value.map(spark => spark.id));
};

const clearSelection = () => {
  selectedRows.value.clear();
};

const toggleRowSelection = (sparkId) => {
  if (selectedRows.value.has(sparkId)) {
    selectedRows.value.delete(sparkId);
  } else {
    selectedRows.value.add(sparkId);
  }
  // Trigger reactivity
  selectedRows.value = new Set(selectedRows.value);
};

// Batch update functionality
const applyBatchUpdate = (field) => {
  const value = batchUpdate.value[field];
  if (!value || selectedRows.value.size === 0) return;

  // Apply the update to all selected rows
  selectedRows.value.forEach(sparkId => {
    const spark = editableSparks.value.find(s => s.id === sparkId);
    if (spark) {
      spark[field] = value;
      changedCells.value.add(`${sparkId}-${field}`);
    }
  });

  // Clear the batch update field
  batchUpdate.value[field] = null;
};

// Batch update functionality
const toggleBatchUpdate = () => {
  isBatchUpdateMode.value = !isBatchUpdateMode.value;

  // Reset batch update fields when closing
  if (!isBatchUpdateMode.value) {
    batchUpdate.value = {
      status: null,
      name: null,
      offer: null,
      creator: null
    };
  }
};

// Delete modal state
const showDeleteModal = ref(false);
const isDeleting = ref(false);

// Comment bot functionality
const toggleCommentBot = () => {
  isCommentBotMode.value = !isCommentBotMode.value;

  // Reset settings when closing
  if (!isCommentBotMode.value) {
    commentBotSettings.value = {
      commentGroupId: null,
      likeCount: 0,
      saveCount: 0
    };
  }
};

const cancelCommentBot = () => {
  isCommentBotMode.value = false;
  commentBotSettings.value = {
    commentGroupId: null,
    likeCount: 0,
    saveCount: 0
  };
};

const executeCommentBot = async (settings) => {
  try {
    const selectedSparkIds = Array.from(selectedRows.value);

    if (!selectedSparkIds.length) {
      console.error('No sparks selected for comment bot');
      return;
    }

    if (!settings.commentGroupId) {
      console.error('No comment group selected');
      return;
    }

    console.log('Executing comment bot for sparks:', selectedSparkIds);
    console.log('Comment bot settings:', settings);

    let processedCount = 0;
    let failedCount = 0;

    for (const sparkId of selectedSparkIds) {
      try {
        const spark = editableSparks.value.find(s => s.id === sparkId);
        if (!spark) continue;

        // Update spark status to processing
        const updateData = {
          bot_status: 'processing'
        };

        // Update in local data immediately for UI feedback
        spark.bot_status = 'processing';

        // Extract post ID from TikTok link
        console.log('Processing spark:', spark.id, 'TikTok link:', spark.tiktok_link);
        const postId = extractPostIdFromTikTokLink(spark.tiktok_link);
        console.log('Extracted post ID:', postId);

        if (!postId) {
          console.log('Failed to extract post ID from link:', spark.tiktok_link);
          spark.bot_status = 'failed';
          failedCount++;
          continue;
        }

        // Create comment bot order with real API
        const orderData = {
          post_id: postId,
          comment_group_id: settings.commentGroupId,
          like_count: Math.min(settings.likeCount || 0, 3000),
          save_count: Math.min(settings.saveCount || 0, 500)
        };

        console.log(`Creating comment bot order for spark ${spark.id}:`, orderData);

        try {
          const response = await commentBotApi.createOrder(orderData);
          console.log(`Comment bot order created for spark ${spark.id}:`, response);

          // Update local spark data
          spark.bot_status = 'processing';
          spark.bot_post_id = postId;
          console.log(`Set bot_post_id for spark ${spark.id} to:`, postId);

          if (response.order_id) {
            spark.comment_bot_order_id = response.order_id;
            console.log(`Set comment_bot_order_id for spark ${spark.id} to:`, response.order_id);
          }
          processedCount++;

          console.log(`Updated spark ${spark.id} data:`, {
            bot_status: spark.bot_status,
            bot_post_id: spark.bot_post_id,
            comment_bot_order_id: spark.comment_bot_order_id
          });
        } catch (orderError) {
          console.error(`Failed to create comment bot order for spark ${spark.id}:`, orderError);
          spark.bot_status = 'failed';
          failedCount++;
        }

      } catch (error) {
        console.error(`Error processing spark ${sparkId}:`, error);
        failedCount++;
      }
    }

    // Save changes to server
    const changes = [];
    for (const sparkId of selectedSparkIds) {
      const spark = editableSparks.value.find(s => s.id === sparkId);
      if (spark) {
        changes.push({
          id: spark.id,
          data: {
            name: spark.name,
            creator: spark.creator || '',
            tiktokLink: spark.tiktok_link || '', // Use camelCase like old implementation
            sparkCode: spark.spark_code || '', // Use camelCase like old implementation
            type: spark.content_type || 'auto',
            status: spark.status || 'active',
            offer: spark.offer || '', // Use offer field
            bot_status: spark.bot_status,
            bot_post_id: spark.bot_post_id,
            comment_bot_order_id: spark.comment_bot_order_id
          }
        });
      }
    }

    if (changes.length > 0) {
      console.log('Saving comment bot changes to server:', changes);
      emit('save-changes', changes);
    } else {
      console.log('No changes to save');
    }

    console.log(`Comment bot execution completed: ${processedCount} queued, ${failedCount} failed`);

    // Close comment bot panel and clear selection
    isCommentBotMode.value = false;
    selectedRows.value.clear();

  } catch (error) {
    console.error('Comment bot execution failed:', error);
  }
};

// Extract post ID from TikTok link (improved with more patterns)
const extractPostIdFromTikTokLink = (link) => {
  if (!link) {
    console.log('No TikTok link provided');
    return null;
  }

  console.log('Extracting post ID from link:', link);

  const patterns = [
    /\/video\/(\d+)/i,
    /\/photo\/(\d+)/i,
    /\/v\/(\d+)/i,
    /tiktok\.com\/.*\/video\/(\d+)/i,
    /tiktok\.com\/.*\/photo\/(\d+)/i,
    /vm\.tiktok\.com\/(\w+)/i,
    /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
    /tiktok\.com\/@[\w.-]+\/photo\/(\d+)/i,
    /tiktok\.com\/t\/(\w+)/i
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = link.match(pattern);
    if (match) {
      console.log(`Pattern ${i + 1} matched:`, pattern, 'Result:', match[1]);
      return match[1];
    }
  }

  console.log('No patterns matched for link:', link);
  return null;
};

// Delete selected sparks
const deleteSelected = () => {
  if (selectedRows.value.size === 0) {
    return;
  }
  showDeleteModal.value = true;
};

const confirmDelete = async () => {
  isDeleting.value = true;

  try {
    const sparkIds = Array.from(selectedRows.value);
    console.log('Deleting sparks:', sparkIds);

    // Remove from local data immediately for UI responsiveness
    sparkIds.forEach(sparkId => {
      const index = editableSparks.value.findIndex(s => s.id === sparkId);
      if (index !== -1) {
        editableSparks.value.splice(index, 1);
      }
    });

    // Build delete requests
    const deletePromises = sparkIds.map(sparkId => ({
      id: sparkId,
      action: 'delete'
    }));

    // Emit delete event to parent
    emit('delete-sparks', deletePromises);

    // Clear selection and close modal
    selectedRows.value.clear();
    showDeleteModal.value = false;

    console.log(`Successfully deleted ${sparkIds.length} spark(s)`);

  } catch (error) {
    console.error('Failed to delete sparks:', error);
  } finally {
    isDeleting.value = false;
  }
};

// Close dialog
const closeDialog = () => {
  editingCell.value = null;
  editValue.value = '';
  selectedRows.value.clear();
  isBatchUpdateMode.value = false;
  isCommentBotMode.value = false;
  dialog.value = false;
};
</script>

<style scoped>
.spreadsheet-container {
  height: calc(100vh - 200px);
  overflow: auto;
  border: 1px solid #e0e0e0;
}

.spreadsheet-grid {
  min-width: 100%;
  display: table;
}

.header-row {
  display: table-row;
  background-color: #f5f5f5;
  position: sticky;
  top: 0;
  z-index: 10;
}

.data-row {
  display: table-row;
}

.data-row:hover {
  background-color: #f9f9f9;
}

.changed-row {
  background-color: #fff8e1 !important;
  border-left: 4px solid #ffb74d !important;
}

.selected-row {
  background-color: #e3f2fd !important;
}

.checkbox-cell {
  min-width: 40px !important;
  width: 40px !important;
  max-width: 40px !important;
  text-align: center;
  padding: 4px !important;
}

.batch-update-card {
  border: 1px solid #2196f3;
  border-radius: 8px;
}

.cell {
  display: table-cell;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  vertical-align: middle;
  min-width: 150px;
  max-width: 150px;
  width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-cell {
  font-weight: bold;
  background-color: #f5f5f5;
  position: sticky;
  top: 0;
}

.data-cell {
  cursor: pointer;
  position: relative;
}

.data-cell:hover {
  background-color: #e3f2fd;
}

.readonly {
  background-color: #f5f5f5 !important;
  cursor: default !important;
}

.readonly:hover {
  background-color: #f5f5f5 !important;
}

.editing {
  background-color: #ffffff !important;
  box-shadow: inset 0 0 0 2px #2196f3;
  position: relative;
  overflow: hidden;
  white-space: normal;
  z-index: 1;
}

.cell-input {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  background: transparent;
  box-sizing: border-box;
  resize: none;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 8px 12px;
}

.cell-content {
  display: block;
  word-break: break-word;
}

/* Dark theme support */
.v-theme--dark .spreadsheet-container {
  border-color: #424242;
}

.v-theme--dark .header-row {
  background-color: #303030;
}

.v-theme--dark .header-cell {
  background-color: #303030;
}

.v-theme--dark .cell {
  border-color: #424242;
}

.v-theme--dark .data-row:hover {
  background-color: #424242;
}

.v-theme--dark .data-cell:hover {
  background-color: #1976d2;
}

.v-theme--dark .changed-row {
  background-color: #3e3529 !important;
  border-left: 4px solid #ffb74d !important;
}

.v-theme--dark .selected-row {
  background-color: #1565c0 !important;
}

.v-theme--dark .batch-update-card {
  border-color: #1976d2;
}

.v-theme--dark .editing {
  background-color: #424242 !important;
}

.v-theme--dark .cell-input {
  color: #ffffff;
}

.v-theme--dark .readonly {
  background-color: #2e2e2e !important;
}

.v-theme--dark .readonly:hover {
  background-color: #2e2e2e !important;
}
</style>