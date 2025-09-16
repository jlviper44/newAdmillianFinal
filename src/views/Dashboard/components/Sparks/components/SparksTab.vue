<template>
  <div>
    <!-- Search and Filters Bar -->
    <v-card class="mb-4">
      <v-card-text>
        <v-row align="center">
          <v-col cols="12" md="3">
            <v-text-field
              :model-value="searchInput"
              @update:model-value="$emit('update:searchInput', $event)"
              label="Search sparks..."
              variant="outlined"
              density="compact"
              hide-details
              prepend-inner-icon="mdi-magnify"
              clearable
            />
          </v-col>

          <v-col cols="12" md="2">
            <v-select
              :model-value="typeFilter"
              @update:model-value="$emit('update:typeFilter', $event)"
              :items="typeOptions"
              label="Type"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>

          <v-col cols="12" md="2">
            <v-select
              :model-value="statusFilter"
              @update:model-value="$emit('update:statusFilter', $event)"
              :items="statusOptions"
              label="Status"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>

          <v-col cols="12" md="2">
            <v-select
              :model-value="creatorFilter"
              @update:model-value="$emit('update:creatorFilter', $event)"
              :items="creatorOptions"
              label="Creator"
              variant="outlined"
              density="compact"
              hide-details
            />
          </v-col>

          <v-col cols="auto">
            <v-checkbox
              :model-value="activeOnly"
              @update:model-value="$emit('update:activeOnly', $event)"
              label="Active Only"
              hide-details
              density="compact"
            />
          </v-col>

          <v-col cols="auto">
            <v-checkbox
              :model-value="showThumbnails"
              @update:model-value="$emit('update:showThumbnails', $event)"
              label="Show Thumbnails"
              hide-details
              density="compact"
            />
          </v-col>

          <v-col cols="auto" class="ml-auto">
            <v-btn
              v-if="!isBulkEditMode"
              variant="tonal"
              color="warning"
              class="mr-2"
              @click="startBulkEdit"
              prepend-icon="mdi-pencil-box-multiple"
            >
              Edit All
            </v-btn>
            <template v-if="isBulkEditMode">
              <v-btn
                color="success"
                variant="elevated"
                class="mr-2"
                @click="saveBulkEdit"
                prepend-icon="mdi-check-all"
                :loading="isSavingBulk"
              >
                Save All
              </v-btn>
              <v-btn
                color="error"
                variant="tonal"
                class="mr-2"
                @click="cancelBulkEdit"
                prepend-icon="mdi-close"
              >
                Cancel
              </v-btn>
            </template>
            <v-btn
              v-if="!isBulkEditMode"
              variant="tonal"
              color="primary"
              class="mr-2"
              @click="exportToCSV"
              prepend-icon="mdi-download"
            >
              Export CSV
            </v-btn>
            <v-btn
              v-if="!isBulkEditMode"
              color="primary"
              variant="elevated"
              class="mr-2"
              @click="openCreateModal"
              prepend-icon="mdi-plus"
            >
              Add Spark
            </v-btn>
            <v-btn
              v-if="!isBulkEditMode"
              color="secondary"
              variant="elevated"
              class="mr-2"
              @click="bulkAdd"
              prepend-icon="mdi-plus-box-multiple"
            >
              Bulk Add
            </v-btn>
            <v-btn
              v-if="!isBulkEditMode"
              variant="text"
              @click="clearFilters"
              prepend-icon="mdi-filter-remove"
            >
              Clear Filters
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Batch Update Controls (visible in bulk edit mode) -->
    <v-card v-if="isBulkEditMode" class="mb-4 batch-update-card">
      <v-card-title class="text-h6 pb-2">
        <v-icon class="mr-2">mdi-pencil-box-multiple</v-icon>
        Batch Update - Apply to Selected Items
        <v-spacer />
        <v-chip class="mr-2" color="white" variant="flat">
          {{ selectedItems.length }} selected
        </v-chip>
        <v-btn
          size="small"
          variant="tonal"
          class="mr-2"
          @click="selectedItems = [...filteredSparks]"
        >
          Select All
        </v-btn>
        <v-btn
          size="small"
          variant="tonal"
          @click="selectedItems = []"
        >
          Clear Selection
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-row align="center" dense>
          <v-col cols="12" md="2">
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
          <v-col cols="auto">
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              @click="applyBatchUpdate('status')"
              :disabled="!batchUpdate.status"
            >
              Apply Status
            </v-btn>
          </v-col>
          
          <v-col cols="12" md="2">
            <v-combobox
              v-model="batchUpdate.type"
              :items="typeItems"
              label="Type"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              placeholder="Select or enter type..."
            />
          </v-col>
          <v-col cols="auto">
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              @click="applyBatchUpdate('type')"
              :disabled="!batchUpdate.type"
            >
              Apply Type
            </v-btn>
          </v-col>
          
          <v-col cols="12" md="3">
            <v-text-field
              v-model="batchUpdate.name"
              label="Name"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              placeholder="Enter name..."
            />
          </v-col>
          <v-col cols="auto">
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              @click="applyBatchUpdate('name')"
              :disabled="!batchUpdate.name"
            >
              Apply Name
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Data Table -->
    <v-card>
      <v-card-text class="pa-2">
        <!-- Duplicate warnings -->
        <v-alert
          v-if="duplicateInfo && duplicateInfo.duplicateErrors && duplicateInfo.duplicateErrors.length > 0"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          <div class="font-weight-bold mb-2">
            <v-icon size="small" class="mr-1">mdi-alert-circle</v-icon>
            Duplicate entries detected:
          </div>
          <ul class="pl-4">
            <li v-for="(error, index) in duplicateInfo.duplicateErrors" :key="index" class="text-caption">
              {{ error }}
            </li>
          </ul>
          <div class="text-caption mt-2">Duplicate rows are highlighted in red.</div>
        </v-alert>
        <v-alert
          type="info"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          Double-click any cell to edit inline. Press Enter to save or Esc to cancel.
        </v-alert>
      </v-card-text>
      <v-data-table
        :headers="headersWithCheckbox"
        :items="filteredSparks"
        v-model:items-per-page="localItemsPerPage"
        :loading="isLoading"
        :items-per-page-options="[10, 25, 50, 100, 200]"
        v-model:page="localCurrentPage"
        :class="['sparks-table', { 'bulk-edit-table': isBulkEditMode }]"
        hover
        fixed-header
        height="600"
        :show-select="isBulkEditMode"
        v-model="selectedItems"
        :item-value="item => item"
        return-object
        :row-props="getRowProps"
      >
        <!-- Thumbnail Column -->
        <template v-slot:item.thumbnail="{ item }">
          <div class="thumbnail-container my-2">
            <v-img
              :src="item.thumbnail || defaultThumbnail"
              :alt="item.name"
              width="150"
              height="150"
              cover
              class="rounded cursor-pointer"
              @click="showLargePreview(item)"
              @error="handleImageError"
            />
          </div>
        </template>

        <!-- Name Column (editable) -->
        <template v-slot:item.name="{ item }">
          <div 
            v-if="!isBulkEditMode"
            @dblclick="startInlineEdit(item, 'name')"
            class="editable-cell"
            :title="'Double-click to edit'"
          >
            <v-text-field
              v-if="isEditing(item.id, 'name')"
              v-model="editingValues[`${item.id}-name`]"
              density="compact"
              variant="outlined"
              hide-details
              single-line
              autofocus
              @blur="saveInlineEdit(item, 'name')"
              @keyup.enter="saveInlineEdit(item, 'name')"
              @keyup.esc="cancelInlineEdit(item.id, 'name')"
            />
            <span v-else class="font-weight-medium">{{ item.name }}</span>
          </div>
          <v-text-field
            v-else
            :model-value="bulkEditValues[`${item.id}-name`]"
            @update:model-value="updateBulkEditValue(`${item.id}-name`, $event)"
            density="compact"
            variant="outlined"
            hide-details
            single-line
            class="bulk-edit-input"
          />
        </template>

        <!-- Type Column (editable) -->
        <template v-slot:item.type="{ item }">
          <div 
            v-if="!isBulkEditMode"
            @dblclick="startInlineEdit(item, 'type')"
            class="editable-cell"
            :title="'Double-click to edit'"
          >
            <v-combobox
              v-if="isEditing(item.id, 'type')"
              v-model="editingValues[`${item.id}-type`]"
              :items="typeItems"
              density="compact"
              variant="outlined"
              hide-details
              clearable
              autofocus
              @change="saveInlineEdit(item, 'type')"
              @keyup.enter.stop="saveInlineEdit(item, 'type')"
              @keyup.esc="cancelInlineEdit(item.id, 'type')"
            />
            <v-chip
              v-else
              size="small"
              :color="getTypeColor(item.type)"
              variant="flat"
            >
              {{ item.type || 'auto' }}
            </v-chip>
          </div>
          <v-combobox
            v-else
            :model-value="bulkEditValues[`${item.id}-type`]"
            @update:model-value="updateBulkEditValue(`${item.id}-type`, $event)"
            :items="typeItems"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            class="bulk-edit-input"
          />
        </template>

        <!-- Status Column (editable) -->
        <template v-slot:item.status="{ item }">
          <div 
            v-if="!isBulkEditMode"
            @dblclick="startInlineEdit(item, 'status')"
            class="editable-cell"
            :title="'Double-click to edit'"
          >
            <v-select
              v-if="isEditing(item.id, 'status')"
              v-model="editingValues[`${item.id}-status`]"
              :items="['active', 'testing', 'blocked']"
              :menu="menuStates[`${item.id}-status`]"
              @update:menu="val => menuStates[`${item.id}-status`] = val"
              density="compact"
              variant="outlined"
              hide-details
              autofocus
              @update:model-value="val => { editingValues[`${item.id}-status`] = val; saveInlineEdit(item, 'status'); }"
            />
            <v-chip
              v-else
              size="small"
              :color="getStatusColor(item.status)"
              variant="flat"
            >
              {{ getStatusLabel(item.status) }}
            </v-chip>
          </div>
          <v-select
            v-else
            :model-value="bulkEditValues[`${item.id}-status`]"
            @update:model-value="updateBulkEditValue(`${item.id}-status`, $event)"
            :items="['active', 'testing', 'blocked']"
            density="compact"
            variant="outlined"
            hide-details
            class="bulk-edit-input"
          />
        </template>

        <!-- Creator Column (editable) -->
        <template v-slot:item.creator="{ item }">
          <div 
            v-if="!isBulkEditMode"
            @dblclick="startInlineEdit(item, 'creator')"
            class="editable-cell"
            :title="'Double-click to edit'"
          >
            <v-select
              v-if="isEditing(item.id, 'creator')"
              v-model="editingValues[`${item.id}-creator`]"
              :items="virtualAssistants"
              :menu="menuStates[`${item.id}-creator`]"
              @update:menu="val => menuStates[`${item.id}-creator`] = val"
              density="compact"
              variant="outlined"
              hide-details
              autofocus
              @update:model-value="val => { editingValues[`${item.id}-creator`] = val; saveInlineEdit(item, 'creator'); }"
            />
            <span v-else>{{ item.creator || '-' }}</span>
          </div>
          <v-select
            v-else
            :model-value="bulkEditValues[`${item.id}-creator`]"
            @update:model-value="updateBulkEditValue(`${item.id}-creator`, $event)"
            :items="virtualAssistants"
            density="compact"
            variant="outlined"
            hide-details
            class="bulk-edit-input"
          />
        </template>

        <!-- TikTok Link Column -->
        <template v-slot:item.tiktok_link="{ item }">
          <div v-if="!isBulkEditMode">
            <v-btn
              icon
              variant="text"
              size="small"
              :href="item.tiktok_link"
              target="_blank"
              @click.stop
            >
              <v-icon>mdi-open-in-new</v-icon>
            </v-btn>
          </div>
          <v-text-field
            v-else
            :model-value="bulkEditValues[`${item.id}-tiktok_link`]"
            @update:model-value="updateBulkEditValue(`${item.id}-tiktok_link`, $event)"
            density="compact"
            variant="outlined"
            hide-details
            single-line
            class="bulk-edit-input"
            placeholder="Enter TikTok link..."
          />
        </template>

        <!-- Spark Code Column (editable) -->
        <template v-slot:item.spark_code="{ item }">
          <div 
            v-if="!isBulkEditMode"
            @dblclick="startInlineEdit(item, 'spark_code')"
            class="editable-cell d-flex align-center"
            :title="'Double-click to edit'"
          >
            <v-text-field
              v-if="isEditing(item.id, 'spark_code')"
              v-model="editingValues[`${item.id}-spark_code`]"
              density="compact"
              variant="outlined"
              hide-details
              single-line
              autofocus
              @blur="saveInlineEdit(item, 'spark_code')"
              @keyup.enter="saveInlineEdit(item, 'spark_code')"
              @keyup.esc="cancelInlineEdit(item.id, 'spark_code')"
            />
            <template v-else>
              <div class="d-flex align-center">
                <code class="mr-2 text-truncate spark-code-truncate">{{ item.spark_code }}</code>
                <v-btn
                  icon
                  variant="text"
                  size="x-small"
                  @click.stop="copyCode(item.spark_code)"
                >
                  <v-icon size="small">mdi-content-copy</v-icon>
                </v-btn>
              </div>
            </template>
          </div>
          <v-text-field
            v-else
            :model-value="bulkEditValues[`${item.id}-spark_code`]"
            @update:model-value="updateBulkEditValue(`${item.id}-spark_code`, $event)"
            density="compact"
            variant="outlined"
            hide-details
            single-line
            class="bulk-edit-input"
          />
        </template>

        <!-- Created Date Column -->
        <template v-slot:item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>

        <!-- Actions Column -->
        <template v-slot:item.actions="{ item }">
          <v-btn
            icon
            variant="text"
            size="small"
            color="primary"
            @click.stop="editSpark(item)"
          >
            <v-icon>mdi-pencil</v-icon>
          </v-btn>
          <v-btn
            icon
            variant="text"
            size="small"
            color="error"
            @click.stop="deleteSpark(item)"
          >
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, ref, watch, computed } from 'vue';

const props = defineProps({
  sparks: Array,
  isLoading: Boolean,
  searchInput: String,
  typeFilter: String,
  statusFilter: String,
  creatorFilter: String,
  activeOnly: Boolean,
  showThumbnails: Boolean,
  isBulkEditMode: Boolean,
  isSavingBulk: Boolean,
  itemsPerPage: Number,
  currentPage: Number,
  headers: Array,
  filteredSparks: Array,
  editingCells: Object,
  editingValues: Object,
  menuStates: Object,
  bulkEditValues: Object,
  typeOptions: Array,
  statusOptions: Array,
  creatorOptions: Array,
  virtualAssistants: Array,
  typeItems: Array,
  defaultThumbnail: String,
  duplicateInfo: Object
});

const emit = defineEmits([
  'update:searchInput',
  'update:typeFilter',
  'update:statusFilter',
  'update:creatorFilter',
  'update:activeOnly',
  'update:showThumbnails',
  'update:currentPage',
  'update:itemsPerPage',
  'clearFilters',
  'startBulkEdit',
  'saveBulkEdit',
  'cancelBulkEdit',
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
  'applyBatchUpdates'
]);

// Local state for pagination to handle v-model properly
const localItemsPerPage = ref(props.itemsPerPage);
const localCurrentPage = ref(props.currentPage);

// Batch update state
const batchUpdate = ref({
  name: '',
  type: null,
  status: null
});

// Selected items for bulk operations
const selectedItems = ref([]);

// Computed property for headers (use regular headers since checkbox is handled by show-select)
const headersWithCheckbox = computed(() => props.headers);

// Watch for bulk edit mode changes to clear selection
watch(() => props.isBulkEditMode, (newVal) => {
  if (!newVal) {
    selectedItems.value = [];
  }
});

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

// Pass through methods
const clearFilters = () => emit('clearFilters');
const startBulkEdit = () => emit('startBulkEdit');
const saveBulkEdit = () => emit('saveBulkEdit');
const cancelBulkEdit = () => emit('cancelBulkEdit');
const exportToCSV = () => emit('exportToCSV');
const openCreateModal = () => emit('openCreateModal');
const bulkAdd = () => emit('bulkAdd');
const showLargePreview = (item) => emit('showLargePreview', item);
const handleImageError = (event) => emit('handleImageError', event);
const startInlineEdit = (item, field) => emit('startInlineEdit', item, field);
const saveInlineEdit = (item, field) => emit('saveInlineEdit', item, field);
const cancelInlineEdit = (itemId, field) => emit('cancelInlineEdit', itemId, field);
const copyCode = (code) => emit('copyCode', code);
const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};
const editSpark = (item) => emit('editSpark', item);
const deleteSpark = (item) => emit('deleteSpark', item);

// Update single bulk edit value
const updateBulkEditValue = (key, value) => {
  emit('applyBatchUpdates', { [key]: value });
};

// Batch update function
const applyBatchUpdate = (field) => {
  const value = batchUpdate.value[field];
  
  if (value === null || value === undefined) {
    return;
  }
  
  // Check if any items are selected
  if (selectedItems.value.length === 0) {
    emit('showBatchUpdateWarning', 'Please select items to update');
    return;
  }
  
  // Prepare updates for selected items
  const updates = {};
  selectedItems.value.forEach(spark => {
    const key = `${spark.id}-${field === 'spark_code' ? 'spark_code' : field}`;
    updates[key] = value;
  });
  
  // Emit the updates to parent
  emit('applyBatchUpdates', updates);
  
  // Clear the batch update field after applying
  batchUpdate.value[field] = field === 'creator' ? undefined : null;
  
  // Show success message (emit to parent)
  emit('showBatchUpdateSuccess', { field, count: selectedItems.value.length });
};

// Get row props for styling duplicate rows
const getRowProps = ({ item }) => {
  if (item.isDuplicate) {
    return {
      class: 'duplicate-row',
      style: 'background-color: rgba(244, 67, 54, 0.08) !important;' // Very light red background with transparency
    };
  }
  return {};
};

// Helper methods that need to be passed directly
const isEditing = (itemId, field) => props.editingCells[`${itemId}-${field}`] === true;
const getTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'cpi': return 'blue';
    case 'sweeps': return 'green';
    case 'cash': return 'orange';
    case 'paypal': return 'purple';
    case 'home': return 'teal';
    default: return 'grey';
  }
};
const getStatusColor = (status) => {
  switch (status) {
    case 'active': return 'success';
    case 'testing': return 'warning';
    case 'blocked': return 'error';
    default: return 'grey';
  }
};
const getStatusLabel = (status) => {
  switch (status) {
    case 'active': return 'Active';
    case 'testing': return 'Testing';
    case 'blocked': return 'Blocked';
    default: return status || 'Unknown';
  }
};
</script>

<style scoped>
.editable-cell {
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.editable-cell:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.spark-code-truncate {
  max-width: 200px;
  display: inline-block;
}

.thumbnail-container {
  display: flex;
  justify-content: center;
}

/* Smaller inputs for bulk edit mode */
.bulk-edit-input :deep(.v-field) {
  min-height: 28px !important;
  font-size: 12px !important;
}

.bulk-edit-input :deep(.v-field__input) {
  padding: 2px 8px !important;
  min-height: 24px !important;
  font-size: 12px !important;
}

.bulk-edit-input :deep(.v-input__control) {
  min-height: 28px !important;
}

.bulk-edit-input :deep(.v-field__append-inner) {
  padding-top: 2px !important;
}

.bulk-edit-input :deep(.v-select__selection) {
  font-size: 12px !important;
}

/* Compact table rows in bulk edit mode */
.bulk-edit-table :deep(tbody tr td) {
  padding: 4px 8px !important;
  height: 36px !important;
  max-height: 36px !important;
}

.bulk-edit-table :deep(tbody tr) {
  height: 36px !important;
}

/* Increase items per page in bulk edit mode for better visibility */
.bulk-edit-table {
  font-size: 13px;
}

/* Batch update card styling */
.batch-update-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.batch-update-card .v-card-title {
  color: white;
}

.batch-update-card .v-alert {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

/* Duplicate row styling - subtle red tint */
.duplicate-row {
  background-color: rgba(244, 67, 54, 0.08) !important;
  position: relative;
}

.duplicate-row:hover {
  background-color: rgba(244, 67, 54, 0.12) !important;
}

/* Add a red left border for additional visual indicator */
.duplicate-row::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: #f44336;
}

/* Dark mode support for duplicate rows */
.v-theme--dark .duplicate-row {
  background-color: rgba(244, 67, 54, 0.15) !important;
}

.v-theme--dark .duplicate-row:hover {
  background-color: rgba(244, 67, 54, 0.2) !important;
}

/* Ensure duplicate row style overrides table hover styles */
.sparks-table :deep(.duplicate-row td) {
  background-color: inherit !important;
}

/* Ensure text remains readable on duplicate rows */
.duplicate-row :deep(*) {
  color: inherit !important;
  opacity: 1 !important;
}
</style>