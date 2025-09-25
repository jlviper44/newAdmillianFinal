<template>
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
        <div class="d-flex justify-space-between align-center">
          <div class="flex-grow-1">
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
          </div>
          <v-btn
            color="white"
            variant="elevated"
            size="small"
            @click="$emit('removeDuplicates')"
            class="ml-3"
          >
            <v-icon start>mdi-delete-sweep</v-icon>
            Remove Duplicates
          </v-btn>
        </div>
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
      :class="['sparks-table', { 'bulk-edit-table': isBulkEditMode, 'comment-bot-table': isCommentBotMode }]"
      hover
      :fixed-header="!isBulkEditMode"
      :height="isBulkEditMode ? undefined : 600"
      :show-select="isBulkEditMode || isCommentBotMode"
      v-model="selectedItems"
      :item-value="item => item"
      return-object
      :row-props="getRowProps"
    >
      <!-- Name Column (editable) -->
      <template v-slot:item.name="{ item }">
        <div
          v-if="!isBulkEditMode"
          @dblclick="$emit('startInlineEdit', item, 'name')"
          class="editable-cell"
          :title="'Double-click to edit'"
        >
          <v-text-field
            v-if="isEditing(item.id, 'name')"
            :model-value="editingValues[`${item.id}-name`]"
            @update:model-value="updateEditingValue(`${item.id}-name`, $event)"
            density="compact"
            variant="outlined"
            hide-details
            single-line
            autofocus
            @blur="$emit('saveInlineEdit', item, 'name')"
            @keyup.enter="$emit('saveInlineEdit', item, 'name')"
            @keyup.esc="$emit('cancelInlineEdit', item.id, 'name')"
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
          @dblclick="$emit('startInlineEdit', item, 'type')"
          class="editable-cell"
          :title="'Double-click to edit'"
        >
          <v-text-field
            v-if="isEditing(item.id, 'type')"
            :model-value="editingValues[`${item.id}-type`]"
            @update:model-value="updateEditingValue(`${item.id}-type`, $event)"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            autofocus
            @blur="$emit('saveInlineEdit', item, 'type')"
            @keyup.enter="$emit('saveInlineEdit', item, 'type')"
            @keyup.esc="$emit('cancelInlineEdit', item.id, 'type')"
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
        <v-text-field
          v-else
          :model-value="bulkEditValues[`${item.id}-type`]"
          @update:model-value="updateBulkEditValue(`${item.id}-type`, $event)"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="bulk-edit-input"
        />
      </template>

      <!-- Bot Status Column -->
      <template v-slot:item.bot_status="{ item }">
        <v-chip
          :color="getBotStatusColor(item.bot_status)"
          size="small"
          variant="tonal"
        >
          <v-progress-circular
            v-if="item.bot_status === 'processing'"
            size="12"
            width="2"
            indeterminate
            class="mr-1"
          />
          <v-icon v-else start size="x-small">
            {{ getBotStatusIcon(item.bot_status) }}
          </v-icon>
          {{ formatBotStatus(item.bot_status) }}
        </v-chip>
      </template>

      <!-- Status Column (editable) -->
      <template v-slot:item.status="{ item }">
        <div
          v-if="!isBulkEditMode"
          @dblclick="$emit('startInlineEdit', item, 'status')"
          class="editable-cell"
          :title="'Double-click to edit'"
        >
          <v-select
            v-if="isEditing(item.id, 'status')"
            :model-value="editingValues[`${item.id}-status`]"
            @update:model-value="val => { updateEditingValue(`${item.id}-status`, val); $emit('saveInlineEdit', item, 'status'); }"
            :items="['active', 'testing', 'untested', 'blocked']"
            density="compact"
            variant="outlined"
            hide-details
            autofocus
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
          :items="['active', 'testing', 'untested', 'blocked']"
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
          @dblclick="$emit('startInlineEdit', item, 'creator')"
          class="editable-cell"
          :title="'Double-click to edit'"
        >
          <v-select
            v-if="isEditing(item.id, 'creator')"
            :model-value="editingValues[`${item.id}-creator`]"
            @update:model-value="val => { updateEditingValue(`${item.id}-creator`, val); $emit('saveInlineEdit', item, 'creator'); }"
            :items="virtualAssistants"
            density="compact"
            variant="outlined"
            hide-details
            autofocus
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
          @click.stop="$emit('editSpark', item)"
        >
          <v-icon>mdi-pencil</v-icon>
        </v-btn>
        <v-btn
          icon
          variant="text"
          size="small"
          color="error"
          @click.stop="$emit('deleteSpark', item)"
        >
          <v-icon>mdi-delete</v-icon>
        </v-btn>
      </template>

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
            @click="$emit('showLargePreview', item)"
            @error="$emit('handleImageError', $event)"
          />
        </div>
      </template>

    </v-data-table>
  </v-card>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  filteredSparks: Array,
  isLoading: Boolean,
  itemsPerPage: Number,
  currentPage: Number,
  headers: Array,
  isBulkEditMode: Boolean,
  isCommentBotMode: Boolean,
  duplicateInfo: Object,
  defaultThumbnail: String,
  selectedForBot: Array,
  editingCells: Object,
  editingValues: Object,
  bulkEditValues: Object,
  virtualAssistants: Array
});

const emit = defineEmits([
  'update:currentPage',
  'update:itemsPerPage',
  'update:selected-for-bot',
  'update:selectedItems',
  'removeDuplicates',
  'showLargePreview',
  'handleImageError',
  'startInlineEdit',
  'saveInlineEdit',
  'cancelInlineEdit',
  'applyBatchUpdates',
  'updateEditingValue',
  'editSpark',
  'deleteSpark'
]);

// Local state for pagination
const localItemsPerPage = ref(props.itemsPerPage);
const localCurrentPage = ref(props.currentPage);
const selectedItems = ref([]);

// Computed property for headers
const headersWithCheckbox = computed(() => props.headers);

// Get row props for styling duplicate rows
const getRowProps = ({ item }) => {
  if (item.isDuplicate) {
    return {
      class: 'duplicate-row',
      style: 'background-color: rgba(244, 67, 54, 0.08) !important;'
    };
  }
  return {};
};

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

// Watch selectedItems and emit changes to parent
watch(selectedItems, (newVal) => {
  emit('update:selectedItems', newVal);
}, { deep: true });

// Helper functions
const isEditing = (itemId, field) => props.editingCells[`${itemId}-${field}`] === true;

const updateEditingValue = (key, value) => {
  // This would typically update a reactive editingValues object in parent
  // For now we'll emit an event to handle it in parent
  emit('updateEditingValue', key, value);
};

const updateBulkEditValue = (key, value) => {
  emit('applyBatchUpdates', { [key]: value });
};

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

const getBotStatusColor = (status) => {
  const colors = {
    'not_botted': 'grey',
    'queued': 'blue',
    'processing': 'orange',
    'completed': 'success',
    'failed': 'error'
  };
  return colors[status] || 'grey';
};

const getBotStatusIcon = (status) => {
  const icons = {
    'not_botted': 'mdi-robot-off',
    'queued': 'mdi-clock-outline',
    'processing': 'mdi-cog',
    'completed': 'mdi-check-circle',
    'failed': 'mdi-alert-circle'
  };
  return icons[status] || 'mdi-help-circle';
};

const formatBotStatus = (status) => {
  return status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Not Botted';
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

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
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

.thumbnail-container {
  display: flex;
  justify-content: center;
}

/* Smaller inputs for bulk edit mode */
.bulk-edit-input :deep(.v-field) {
  min-height: 20px !important;
  font-size: 10px !important;
}

.bulk-edit-input :deep(.v-field__input) {
  padding: 1px 4px !important;
  min-height: 18px !important;
  font-size: 10px !important;
}

.bulk-edit-input :deep(.v-input__control) {
  min-height: 20px !important;
}

.bulk-edit-input :deep(.v-field__append-inner) {
  padding-top: 1px !important;
}

.bulk-edit-input :deep(.v-select__selection) {
  font-size: 10px !important;
}

/* Compact table rows in bulk edit mode */
.bulk-edit-table :deep(tbody tr td) {
  padding: 2px 4px !important;
  height: 26px !important;
  max-height: 26px !important;
}

.bulk-edit-table :deep(tbody tr) {
  height: 26px !important;
}

/* Smaller font and denser display in bulk edit mode */
.bulk-edit-table {
  font-size: 11px;
}

/* Make table headers smaller too */
.bulk-edit-table :deep(thead tr th) {
  padding: 4px 4px !important;
  font-size: 11px !important;
  height: 32px !important;
}

/* Make checkboxes smaller */
.bulk-edit-table :deep(.v-checkbox .v-selection-control) {
  min-height: 20px !important;
}

.bulk-edit-table :deep(.v-selection-control__wrapper) {
  height: 20px !important;
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