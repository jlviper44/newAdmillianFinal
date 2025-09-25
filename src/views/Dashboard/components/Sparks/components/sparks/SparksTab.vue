<template>
  <div>
    <!-- Search and Filters Bar -->
    <SparksFilters
      :search-input="searchInput"
      :type-filter="typeFilter"
      :status-filter="statusFilter"
      :creator-filter="creatorFilter"
      :show-thumbnails="showThumbnails"
      :is-bulk-edit-mode="isBulkEditMode"
      :is-comment-bot-mode="isCommentBotMode"
      :type-options="typeOptions"
      :status-options="statusOptions"
      :creator-options="creatorOptions"
      @update:search-input="$emit('update:searchInput', $event)"
      @update:type-filter="$emit('update:typeFilter', $event)"
      @update:status-filter="$emit('update:statusFilter', $event)"
      @update:creator-filter="$emit('update:creatorFilter', $event)"
      @update:show-thumbnails="$emit('update:showThumbnails', $event)"
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
            @save-bulk-edit="saveBulkEdit"
            @cancel-bulk-edit="cancelBulkEdit"
            @delete-selected="$emit('deleteSelected', $event)"
            @export-to-c-s-v="exportToCSV"
            @bulk-add="bulkAdd"
            @start-comment-bot="$emit('startCommentBot')"
            @cancel-comment-bot="$emit('cancelCommentBot')"
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
      @update-comment-bot-settings="updateCommentBotSettings"
      @select-all-for-bot="selectAllForBot"
      @clear-selection="selectedItems = []"
      @execute-comment-bot="$emit('executeCommentBot')"
    />

    <!-- Batch Update Panel -->
    <SparksBatchUpdatePanel
      :is-bulk-edit-mode="isBulkEditMode"
      :selected-items="selectedItems"
      :virtual-assistants="virtualAssistants"
      @select-all-items="selectedItems = [...filteredSparks]"
      @clear-selection="selectedItems = []"
      @apply-batch-updates="applyBatchUpdates"
      @show-batch-update-success="showBatchUpdateSuccess"
      @show-batch-update-warning="showBatchUpdateWarning"
    />

    <!-- Data Table -->
    <SparksDataTable
      :filtered-sparks="filteredSparks"
      :is-loading="isLoading"
      :items-per-page="localItemsPerPage"
      :current-page="localCurrentPage"
      :headers="headers"
      :is-bulk-edit-mode="isBulkEditMode"
      :is-comment-bot-mode="isCommentBotMode"
      :duplicate-info="duplicateInfo"
      :default-thumbnail="defaultThumbnail"
      :selected-for-bot="selectedForBot"
      :editing-cells="editingCells"
      :editing-values="editingValues"
      :bulk-edit-values="bulkEditValues"
      :virtual-assistants="virtualAssistants"
      @update:current-page="$emit('update:currentPage', $event)"
      @update:items-per-page="$emit('update:itemsPerPage', $event)"
      @update:selected-for-bot="$emit('update:selectedForBot', $event)"
      @update:selected-items="selectedItems = $event"
      @remove-duplicates="$emit('removeDuplicates')"
      @show-large-preview="showLargePreview"
      @handle-image-error="handleImageError"
      @start-inline-edit="startInlineEdit"
      @save-inline-edit="saveInlineEdit"
      @cancel-inline-edit="cancelInlineEdit"
      @apply-batch-updates="$emit('applyBatchUpdates', $event)"
      @update-editing-value="updateEditingValue"
      @edit-spark="editSpark"
      @delete-spark="deleteSpark"
    />
  </div>
</template>

<script setup>
import { defineProps, defineEmits, ref, watch, nextTick } from 'vue';
import SparksFilters from './SparksFilters.vue';
import SparksToolbar from './SparksToolbar.vue';
import SparksCommentBotPanel from './SparksCommentBotPanel.vue';
import SparksBatchUpdatePanel from './SparksBatchUpdatePanel.vue';
import SparksDataTable from './SparksDataTable.vue';

const props = defineProps({
  sparks: Array,
  isLoading: Boolean,
  searchInput: String,
  typeFilter: String,
  statusFilter: String,
  creatorFilter: String,
  showThumbnails: Boolean,
  isBulkEditMode: Boolean,
  isSavingBulk: Boolean,
  isCommentBotMode: Boolean,
  isProcessingBot: Boolean,
  itemsPerPage: Number,
  currentPage: Number,
  headers: Array,
  filteredSparks: Array,
  editingCells: Object,
  editingValues: Object,
  menuStates: Object,
  bulkEditValues: Object,
  commentBotSettings: Object,
  selectedForBot: Array,
  commentGroups: Array,
  typeOptions: Array,
  statusOptions: Array,
  creatorOptions: Array,
  virtualAssistants: Array,
  typeItems: Array,
  defaultThumbnail: String,
  duplicateInfo: Object,
  hasCommentBotAccess: Boolean,
  userCredits: Number
});

const emit = defineEmits([
  'update:searchInput',
  'update:typeFilter',
  'update:statusFilter',
  'update:creatorFilter',
  'update:showThumbnails',
  'update:currentPage',
  'update:itemsPerPage',
  'update:selectedForBot',
  'update:selected-for-bot',
  'clearFilters',
  'startBulkEdit',
  'saveBulkEdit',
  'cancelBulkEdit',
  'startCommentBot',
  'executeCommentBot',
  'cancelCommentBot',
  'toggleBotSelection',
  'updateCommentBotSettings',
  'exportToCSV',
  'openCreateModal',
  'bulkAdd',
  'showLargePreview',
  'handleImageError',
  'startInlineEdit',
  'saveInlineEdit',
  'cancelInlineEdit',
  'copyCode',
  'editSpark',
  'deleteSpark',
  'showBatchUpdateSuccess',
  'showBatchUpdateWarning',
  'applyBatchUpdates',
  'removeDuplicates',
  'deleteSelected'
]);

// Local state for pagination to handle v-model properly
const localItemsPerPage = ref(props.itemsPerPage);
const localCurrentPage = ref(props.currentPage);

// Selected items for bulk operations
const selectedItems = ref([]);

// Watch for prop changes and update local state
watch(() => props.itemsPerPage, (newVal) => {
  localItemsPerPage.value = newVal;
});

watch(() => props.currentPage, (newVal) => {
  localCurrentPage.value = newVal;
});

// Watch local changes and emit updates
watch(localItemsPerPage, (newVal) => {
  emit('update:itemsPerPage', newVal);
});

watch(localCurrentPage, (newVal) => {
  emit('update:currentPage', newVal);
});

// Watch for bulk edit mode changes to clear selection
watch(() => props.isBulkEditMode, (newVal) => {
  if (!newVal) {
    selectedItems.value = [];
  }
});

// Watch for comment bot mode changes
watch(() => props.isCommentBotMode, (newVal) => {
  if (newVal) {
    selectedItems.value = [];
  }
});

// Sync selectedItems with selectedForBot when in comment bot mode
let isUpdatingFromParent = false;
let isUpdatingFromLocal = false;

watch(selectedItems, (newVal) => {
  if (props.isCommentBotMode && !isUpdatingFromParent) {
    isUpdatingFromLocal = true;
    const selectedIds = newVal.map(item => item.id);
    emit('update:selected-for-bot', selectedIds);
    nextTick(() => { isUpdatingFromLocal = false; });
  }
});

// Also sync selectedForBot back to selectedItems
watch(() => props.selectedForBot, (newVal) => {
  if (props.isCommentBotMode && newVal && !isUpdatingFromLocal) {
    isUpdatingFromParent = true;
    // Find the full items from filteredSparks that match the IDs
    selectedItems.value = props.filteredSparks.filter(item =>
      newVal.includes(item.id)
    );
    nextTick(() => { isUpdatingFromParent = false; });
  }
});

// Comment Bot functions
const selectAllForBot = () => {
  const validSparks = props.filteredSparks.filter(s => s.tiktok_link);
  selectedItems.value = validSparks;
};

const updateCommentBotSettings = (updatedSettings) => {
  emit('updateCommentBotSettings', updatedSettings);
};

// Pass through methods
const clearFilters = () => emit('clearFilters');
const startBulkEdit = () => emit('startBulkEdit');
const saveBulkEdit = () => emit('saveBulkEdit');
const cancelBulkEdit = () => emit('cancelBulkEdit');
const exportToCSV = () => emit('exportToCSV');
const bulkAdd = () => emit('bulkAdd');
const showLargePreview = (item) => emit('showLargePreview', item);
const handleImageError = (event) => emit('handleImageError', event);
const startInlineEdit = (item, field) => emit('startInlineEdit', item, field);
const saveInlineEdit = (item, field) => emit('saveInlineEdit', item, field);
const cancelInlineEdit = (itemId, field) => emit('cancelInlineEdit', itemId, field);
const editSpark = (item) => emit('editSpark', item);
const deleteSpark = (item) => emit('deleteSpark', item);

// Update single bulk edit value
const updateEditingValue = (key, value) => {
  emit('applyBatchUpdates', { [key]: value });
};

// Batch update functions
const applyBatchUpdates = (updates) => {
  emit('applyBatchUpdates', updates);
};

const showBatchUpdateSuccess = (info) => {
  emit('showBatchUpdateSuccess', info);
};

const showBatchUpdateWarning = (message) => {
  emit('showBatchUpdateWarning', message);
};
</script>